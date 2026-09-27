<?php
/**
 * POLIMAP — Reportes comunitarios (módulo de Katia)
 *
 *   POST  /api/reportes.php                      → crea un reporte (FormData, con foto opcional)
 *   GET   /api/reportes.php?folios=POLI-2026-0001,POLI-2026-0002
 *                                                → "Mis reportes" (solo esos folios)
 *   GET   /api/reportes.php  (+ encabezado X-Admin-Token)
 *                                                → todos, para el panel admin
 *   PATCH /api/reportes.php  (+ X-Admin-Token)   → cambia estado / comentario
 *
 * Al crear un reporte, además de guardarlo, manda un aviso por correo
 * (api/notificar.php). Si el correo falla, el reporte igual queda guardado.
 *
 * Campos y categorías: ver docs/contrato-datos.md, sección 3.
 */
require __DIR__ . '/database.php';
require __DIR__ . '/notificar.php';   // aviso por correo de reportes nuevos

const CATEGORIAS = ['basura', 'mobiliario', 'banos', 'fuga', 'iluminacion', 'riesgo', 'otro'];
const ESTADOS    = ['recibido', 'revision', 'proceso', 'resuelto'];

switch ($_SERVER['REQUEST_METHOD']) {
    case 'POST':  crear_reporte();   break;
    case 'GET':   listar_reportes(); break;
    case 'PATCH': cambiar_estado();  break;
    default:      error_json('Método no permitido', 405);
}

// =======================================================================
// POST: crear reporte
// =======================================================================
function crear_reporte(): void
{
    global $CONFIG;

    // 1) Leer y limpiar los campos del FormData ---------------------------
    $categoria   = trim($_POST['categoria'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $edificio    = ($_POST['edificio_number'] ?? '') === '' ? null : filter_var($_POST['edificio_number'], FILTER_VALIDATE_INT);
    $zona        = trim($_POST['zona'] ?? '') ?: null;
    $anonimo     = ($_POST['anonimo'] ?? '1') === '0' ? 0 : 1;
    $lat         = coordenada($_POST['lat'] ?? '', 90);
    $lng         = coordenada($_POST['lng'] ?? '', 180);
    $precision   = ($_POST['precision_m'] ?? '') === '' ? null : max(0, min(65535, (int) round((float) $_POST['precision_m'])));

    // 2) Validar (mismas reglas que el formulario de ReportScreen.jsx) -----
    if (!in_array($categoria, CATEGORIAS, true)) {
        error_json('Selecciona una categoría válida');
    }
    if (mb_strlen($descripcion) < 10) {
        error_json('Escribe una descripción de al menos 10 caracteres');
    }
    if (mb_strlen($descripcion) > 500) {
        error_json('La descripción no puede pasar de 500 caracteres');
    }
    if ($edificio === false) {
        error_json('El número de edificio no es válido');
    }
    if ($edificio === null && $zona === null) {
        error_json('Indica la ubicación (edificio o zona)');
    }
    if ($zona !== null && mb_strlen($zona) > 100) {
        error_json('La zona es demasiado larga');
    }
    if (($lat === null) !== ($lng === null)) {
        error_json('Faltan coordenadas: se necesitan lat y lng juntas');
    }

    // 3) Guardar la foto (opcional) ---------------------------------------
    $foto = guardar_foto($CONFIG);

    // 4) Insertar y generar el folio con el id ----------------------------
    $pdo = db();
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            'INSERT INTO reportes
               (categoria, edificio_number, zona, descripcion, foto, lat, lng, precision_m, anonimo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$categoria, $edificio, $zona, $descripcion, $foto, $lat, $lng, $precision, $anonimo]);

        $id    = (int) $pdo->lastInsertId();
        $folio = sprintf('POLI-%s-%04d', date('Y'), $id);   // POLI-2026-0001
        $pdo->prepare('UPDATE reportes SET folio = ? WHERE id = ?')->execute([$folio, $id]);

        $creado = $pdo->query("SELECT creado_en FROM reportes WHERE id = $id")->fetchColumn();
        $pdo->commit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($foto) @unlink($CONFIG['upload_dir'] . '/' . $foto);  // no dejar fotos huérfanas
        error_log('POLIMAP reporte: ' . $e->getMessage());
        // 1452 = llave foránea: el edificio no existe
        $msg = ($e->errorInfo[1] ?? 0) === 1452 ? 'Ese edificio no existe' : 'No se pudo guardar el reporte';
        error_json($msg, ($e->errorInfo[1] ?? 0) === 1452 ? 400 : 500);
    }

    // 5) Aviso por correo (solo avisa: si falla, el reporte ya está guardado) --
    $ubicacion = $zona ?? '';
    if ($edificio !== null) {
        $nombre = $pdo->prepare('SELECT name FROM edificios WHERE number = ?');
        $nombre->execute([$edificio]);
        $ubicacion = "Edificio $edificio · " . ($nombre->fetchColumn() ?: '');
    }
    $avisoEnviado = notificar_reporte([
        'folio'       => $folio,
        'categoria'   => $categoria,
        'descripcion' => $descripcion,
        'ubicacion'   => $ubicacion,
        'lat'         => $lat,
        'lng'         => $lng,
        'anonimo'     => $anonimo,
        'creado_en'   => $creado,
    ], $foto ? $CONFIG['upload_dir'] . '/' . $foto : null);

    responder([
        'ok'           => true,
        'folio'        => $folio,
        'estado'       => 'recibido',
        'createdAt'    => iso($creado),
        'avisoEnviado' => $avisoEnviado,   // true si llegó el correo; false no es error
    ], 201);
}

/** Convierte texto a coordenada; null si viene vacío; error si está fuera de rango. */
function coordenada(string $valor, int $limite): ?float
{
    if ($valor === '') return null;
    if (!is_numeric($valor) || abs((float) $valor) > $limite) {
        error_json('Coordenadas no válidas');
    }
    return round((float) $valor, 6);
}

/**
 * Valida y guarda la foto en api/uploads/ con un nombre aleatorio.
 * Regresa el nombre del archivo, o null si no mandaron foto.
 */
function guardar_foto(array $CONFIG): ?string
{
    if (empty($_FILES['foto']) || $_FILES['foto']['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $f = $_FILES['foto'];

    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE
        || $f['size'] > $CONFIG['upload_max_mb'] * 1024 * 1024) {
        error_json('La foto pesa más de ' . $CONFIG['upload_max_mb'] . ' MB');
    }
    if ($f['error'] !== UPLOAD_ERR_OK) {
        error_json('No se pudo subir la foto');
    }

    // Revisamos el contenido real del archivo, no la extensión que diga el nombre.
    $tipos = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime  = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!isset($tipos[$mime])) {
        error_json('La foto debe ser JPG, PNG o WEBP');
    }

    if (!is_dir($CONFIG['upload_dir'])) {
        mkdir($CONFIG['upload_dir'], 0755, true);
    }
    $nombre = bin2hex(random_bytes(12)) . '.' . $tipos[$mime];   // ej. 9f2c…a1.jpg
    if (!move_uploaded_file($f['tmp_name'], $CONFIG['upload_dir'] . '/' . $nombre)) {
        error_json('No se pudo guardar la foto', 500);
    }
    return $nombre;
}

// =======================================================================
// GET: "Mis reportes" (por folios) o todos (admin)
// =======================================================================
function listar_reportes(): void
{
    global $CONFIG;
    $pdo = db();
    $sql = 'SELECT folio, categoria, edificio_number, zona, descripcion, foto, lat, lng,
                   estado, comentario_admin, creado_en, actualizado_en
              FROM reportes';

    if (!empty($_GET['folios'])) {
        // "POLI-2026-0001,POLI-2026-0002" → máximo 50 folios con formato válido
        $folios = array_slice(array_filter(
            array_map('trim', explode(',', $_GET['folios'])),
            fn ($f) => preg_match('/^POLI-\d{4}-\d{4,}$/', $f)
        ), 0, 50);
        if (!$folios) responder([]);

        $marcas = implode(',', array_fill(0, count($folios), '?'));   // ?,?,?
        $stmt = $pdo->prepare("$sql WHERE folio IN ($marcas) ORDER BY id DESC");
        $stmt->execute(array_values($folios));
    } else {
        exigir_admin();   // la lista completa solo la ve el administrador
        $stmt = $pdo->query("$sql ORDER BY id DESC");
    }

    responder(array_map(fn ($r) => [
        'folio'           => $r['folio'],
        'categoria'       => $r['categoria'],
        'edificioNumber'  => int_o_null($r['edificio_number']),
        'zona'            => $r['zona'],
        'descripcion'     => $r['descripcion'],
        'foto'            => $r['foto'] ? $CONFIG['upload_url'] . '/' . $r['foto'] : null,
        'lat'             => num_o_null($r['lat']),
        'lng'             => num_o_null($r['lng']),
        'estado'          => $r['estado'],
        'comentarioAdmin' => $r['comentario_admin'],
        'createdAt'       => iso($r['creado_en']),
        'updatedAt'       => iso($r['actualizado_en']),
    ], $stmt->fetchAll()));
}

// =======================================================================
// PATCH: cambiar estado (panel admin)
// Cuerpo JSON: { "folio": "POLI-2026-0001", "estado": "proceso", "comentarioAdmin": "..." }
// =======================================================================
function cambiar_estado(): void
{
    exigir_admin();

    $datos  = json_decode(file_get_contents('php://input'), true) ?? [];
    $folio  = $datos['folio'] ?? '';
    $estado = $datos['estado'] ?? '';
    $coment = isset($datos['comentarioAdmin']) ? mb_substr(trim((string) $datos['comentarioAdmin']), 0, 500) : null;

    if (!in_array($estado, ESTADOS, true)) {
        error_json('Estado no válido (recibido, revision, proceso, resuelto)');
    }

    $stmt = db()->prepare(
        'UPDATE reportes SET estado = ?, comentario_admin = COALESCE(?, comentario_admin) WHERE folio = ?'
    );
    $stmt->execute([$estado, $coment, $folio]);

    // rowCount es 0 si no existe el folio (o si no cambió nada): lo revisamos.
    if ($stmt->rowCount() === 0) {
        $existe = db()->prepare('SELECT 1 FROM reportes WHERE folio = ?');
        $existe->execute([$folio]);
        if (!$existe->fetchColumn()) error_json('No existe ese folio', 404);
    }
    responder(['ok' => true]);
}

/** Corta la petición si no trae la clave de administrador correcta. */
function exigir_admin(): void
{
    global $CONFIG;
    $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if ($token === '' || !hash_equals($CONFIG['admin_token'], $token)) {
        error_json('No autorizado', 401);
    }
}
