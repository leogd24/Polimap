<?php
/**
 * POLIMAP — Reportes comunitarios (módulo de Katia)
 *
 * Todo requiere sesión (api/auth.php). La cookie viaja sola en cada petición.
 *
 *   POST  /api/reportes.php                 → crea un reporte (alumno; FormData, foto opcional)
 *   GET   /api/reportes.php                 → "Mis reportes": los de la cuenta con sesión
 *   GET   /api/reportes.php?todos=1         → todos, para el panel admin
 *   GET   /api/reportes.php?historial=POLI-2026-0001 → cambios de ese reporte (admin)
 *   GET   /api/reportes.php?historial=todos → últimos 200 cambios de todos (admin)
 *   PATCH /api/reportes.php                 → cambia estado / prioridad / comentario (admin)
 *         (se manda como POST ?_method=PATCH)
 *
 * Al crear un reporte, además de guardarlo, manda un aviso por correo
 * (api/notificar.php). Si el correo falla, el reporte igual queda guardado.
 *
 * Campos y categorías: ver docs/contrato-datos.md, sección 3.
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';      // quién está usando la API
require __DIR__ . '/notificar.php';   // aviso por correo de reportes nuevos

const CATEGORIAS = ['basura', 'mobiliario', 'banos', 'fuga', 'iluminacion', 'riesgo', 'otro'];
const ESTADOS    = ['recibido', 'revision', 'proceso', 'resuelto'];
const PRIORIDADES = ['baja', 'media', 'alta'];
// Estas categorías entran solas como "urgentes" (prioridad alta).
const CATEGORIAS_URGENTES = ['fuga', 'riesgo'];

// metodo_http() (database.php) convierte POST ?_method=PATCH en PATCH,
// porque algunos hostings gratuitos bloquean PATCH.
switch (metodo_http()) {
    case 'POST':  crear_reporte();   break;
    case 'GET':
        if (isset($_GET['historial'])) listar_historial();
        else listar_reportes();
        break;
    case 'PATCH': cambiar_reporte(); break;
    default:      error_json('Método no permitido', 405);
}

// =======================================================================
// POST: crear reporte
// =======================================================================
function crear_reporte(): void
{
    global $CONFIG;
    $usuario = exigir_app();   // solo alumnos con sesión pueden reportar

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
        $prioridad = in_array($categoria, CATEGORIAS_URGENTES, true) ? 'alta' : 'media';
        $creado    = ahora();
        $stmt = $pdo->prepare(
            'INSERT INTO reportes
               (categoria, edificio_number, zona, descripcion, foto, lat, lng, precision_m, anonimo,
                prioridad, usuario_id, creado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$categoria, $edificio, $zona, $descripcion, $foto, $lat, $lng, $precision, $anonimo,
                        $prioridad, $usuario['id'], $creado]);

        $id    = (int) $pdo->lastInsertId();
        $folio = sprintf('POLI-%s-%04d', date('Y'), $id);   // POLI-2026-0001
        $pdo->prepare('UPDATE reportes SET folio = ? WHERE id = ?')->execute([$folio, $id]);
        guardar_historial($id, $usuario['id'], 'creado', null, 'recibido');
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
        'autor'       => $anonimo ? null : trim($usuario['nombre'] . ' <' . $usuario['correo'] . '>'),
        'prioridad'   => $prioridad,
        'creado_en'   => $creado,
    ], $foto ? $CONFIG['upload_dir'] . '/' . $foto : null);

    responder([
        'ok'           => true,
        'folio'        => $folio,
        'estado'       => 'recibido',
        'prioridad'    => $prioridad,
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
// GET: "Mis reportes" (los de mi cuenta) o todos (admin)
// =======================================================================
function listar_reportes(): void
{
    $pdo = db();
    $sql = 'SELECT r.id, r.folio, r.categoria, r.edificio_number, r.zona, r.descripcion, r.foto,
                   r.lat, r.lng, r.anonimo, r.estado, r.prioridad, r.comentario_admin,
                   r.creado_en, r.actualizado_en, r.resuelto_en,
                   u.nombre AS autor_nombre, u.correo AS autor_correo
              FROM reportes r LEFT JOIN usuarios u ON u.id = r.usuario_id';

    if (!empty($_GET['todos'])) {
        exigir_admin();   // la lista completa solo la ve el administrador
        $filas = $pdo->query("$sql ORDER BY r.id DESC")->fetchAll();
        responder(array_map(fn ($r) => reporte_json($r, true), $filas));
    }

    $usuario = exigir_app();
    $stmt = $pdo->prepare("$sql WHERE r.usuario_id = ? ORDER BY r.id DESC");
    $stmt->execute([$usuario['id']]);
    responder(array_map(fn ($r) => reporte_json($r, false), $stmt->fetchAll()));
}

/** Fila de la BD → JSON del contrato. El autor solo lo ve el admin y solo si NO es anónimo. */
function reporte_json(array $r, bool $paraAdmin): array
{
    global $CONFIG;
    $json = [
        'folio'           => $r['folio'],
        'categoria'       => $r['categoria'],
        'edificioNumber'  => int_o_null($r['edificio_number']),
        'zona'            => $r['zona'],
        'descripcion'     => $r['descripcion'],
        'foto'            => $r['foto'] ? $CONFIG['upload_url'] . '/' . $r['foto'] : null,
        'lat'             => num_o_null($r['lat']),
        'lng'             => num_o_null($r['lng']),
        'anonimo'         => (bool) $r['anonimo'],
        'estado'          => $r['estado'],
        'prioridad'       => $r['prioridad'],
        'comentarioAdmin' => $r['comentario_admin'],
        'createdAt'       => iso($r['creado_en']),
        'updatedAt'       => iso($r['actualizado_en']),
        'resolvedAt'      => iso($r['resuelto_en']),
    ];
    if ($paraAdmin) {
        $json['autor'] = (!$r['anonimo'] && $r['autor_correo'])
            ? ['nombre' => $r['autor_nombre'], 'correo' => $r['autor_correo']]
            : null;
    }
    return $json;
}

// =======================================================================
// GET ?historial=FOLIO | todos  (admin)
// =======================================================================
function listar_historial(): void
{
    exigir_admin();
    $sql = 'SELECT h.accion, h.valor_anterior, h.valor_nuevo, h.creado_en,
                   r.folio, u.nombre, u.correo, r.anonimo
              FROM reportes_historial h
              JOIN reportes r ON r.id = h.reporte_id
              LEFT JOIN usuarios u ON u.id = h.usuario_id';

    if ($_GET['historial'] === 'todos') {
        $stmt = db()->query("$sql ORDER BY h.id DESC LIMIT 200");
    } else {
        $stmt = db()->prepare("$sql WHERE r.folio = ? ORDER BY h.id DESC");
        $stmt->execute([$_GET['historial']]);
    }

    responder(array_map(function ($h) {
        // Si el que lo creó pidió anonimato, en el historial tampoco sale su nombre.
        $oculto = $h['accion'] === 'creado' && $h['anonimo'];
        return [
            'folio'    => $h['folio'],
            'accion'   => $h['accion'],
            'antes'    => $h['valor_anterior'],
            'despues'  => $h['valor_nuevo'],
            'fecha'    => iso($h['creado_en']),
            'quien'    => ($oculto || !$h['correo']) ? null : ['nombre' => $h['nombre'], 'correo' => $h['correo']],
        ];
    }, $stmt->fetchAll()));
}

// =======================================================================
// PATCH: cambiar estado, prioridad o comentario (panel admin)
// Cuerpo JSON (manda solo lo que cambia):
//   { "folio": "POLI-2026-0001", "estado": "proceso", "prioridad": "alta", "comentarioAdmin": "..." }
// =======================================================================
function cambiar_reporte(): void
{
    $admin = exigir_admin();
    $datos = leer_json();

    $stmt = db()->prepare('SELECT id, estado, prioridad, comentario_admin, resuelto_en FROM reportes WHERE folio = ?');
    $stmt->execute([(string) ($datos['folio'] ?? '')]);
    $actual = $stmt->fetch();
    if (!$actual) error_json('No existe ese folio', 404);

    $nuevo = [
        'estado'           => $actual['estado'],
        'prioridad'        => $actual['prioridad'],
        'comentario_admin' => $actual['comentario_admin'],
        'resuelto_en'      => $actual['resuelto_en'],
    ];
    if (array_key_exists('estado', $datos)) {
        if (!in_array($datos['estado'], ESTADOS, true)) {
            error_json('Estado no válido (recibido, revision, proceso, resuelto)');
        }
        $nuevo['estado'] = $datos['estado'];
    }
    if (array_key_exists('prioridad', $datos)) {
        if (!in_array($datos['prioridad'], PRIORIDADES, true)) {
            error_json('Prioridad no válida (baja, media, alta)');
        }
        $nuevo['prioridad'] = $datos['prioridad'];
    }
    if (array_key_exists('comentarioAdmin', $datos)) {
        $texto = mb_substr(trim((string) $datos['comentarioAdmin']), 0, 500);
        $nuevo['comentario_admin'] = $texto === '' ? null : $texto;
    }

    // Fecha de solución: se pone al marcar "resuelto" y se quita si lo reabren.
    if ($nuevo['estado'] === 'resuelto' && $actual['estado'] !== 'resuelto') $nuevo['resuelto_en'] = ahora();
    if ($nuevo['estado'] !== 'resuelto') $nuevo['resuelto_en'] = null;

    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE reportes SET estado = ?, prioridad = ?, comentario_admin = ?, resuelto_en = ?, actualizado_en = ? WHERE id = ?')
        ->execute([$nuevo['estado'], $nuevo['prioridad'], $nuevo['comentario_admin'], $nuevo['resuelto_en'], ahora(), $actual['id']]);

    // Una línea de historial por cada cosa que cambió.
    $cambios = ['estado' => 'estado', 'prioridad' => 'prioridad', 'comentario_admin' => 'comentario'];
    foreach ($cambios as $campo => $accion) {
        if ($nuevo[$campo] !== $actual[$campo]) {
            guardar_historial((int) $actual['id'], $admin['id'], $accion, $actual[$campo], $nuevo[$campo]);
        }
    }
    $pdo->commit();

    responder([
        'ok'              => true,
        'folio'           => $datos['folio'],
        'estado'          => $nuevo['estado'],
        'prioridad'       => $nuevo['prioridad'],
        'comentarioAdmin' => $nuevo['comentario_admin'],
        'updatedAt'       => iso(ahora()),
        'resolvedAt'      => iso($nuevo['resuelto_en']),
    ]);
}

/** Agrega una línea al historial de un reporte. */
function guardar_historial(int $reporteId, ?int $usuarioId, string $accion, ?string $antes, ?string $despues): void
{
    db()->prepare(
        'INSERT INTO reportes_historial (reporte_id, usuario_id, accion, valor_anterior, valor_nuevo, creado_en)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$reporteId, $usuarioId, $accion, $antes, $despues, ahora()]);
}
