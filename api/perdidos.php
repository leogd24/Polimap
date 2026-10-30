<?php
/**
 * POLIMAP — Objetos perdidos y encontrados.   Responsable: Alexis
 *
 *   GET    /api/perdidos.php?tipo=perdido|encontrado|todos&categoria=&q=&pagina=0
 *                                   → lista de publicaciones activas (público;
 *                                     el nombre y el correo solo con sesión)
 *   GET    /api/perdidos.php?mios=1 → mis publicaciones (todas, con su estado)
 *   GET    /api/perdidos.php?panel=1 → todo, también ocultas y reportadas (admin)
 *   POST   /api/perdidos.php?accion=foto   (multipart, campo "foto") → sube la foto (alumno)
 *   POST   /api/perdidos.php  { accion: 'publicar', tipo, titulo, descripcion, categoria,
 *                               edificio, lugar, entrega, fecha, foto, mostrarCorreo }
 *   POST   /api/perdidos.php  { accion: 'resolver', id }         → "ya lo encontré / ya se entregó"
 *   POST   /api/perdidos.php  { accion: 'reportar', id, motivo } → 3 reportes = se oculta solo
 *   POST   /api/perdidos.php  { accion: 'moderar', id, estado }  → admin: activo | oculto
 *   DELETE /api/perdidos.php  { id }                              → el autor o un admin
 *
 * Cuidados (ámbito institucional):
 *   - Mismo filtro de texto que los comentarios (moderacion.php): groserías,
 *     amenazas, teléfonos, correos y enlaces de fuera se bloquean.
 *   - 3 textos bloqueados en 24 h = la cuenta se pausa 24 h (igual que en comentarios).
 *     Lo bloqueado lo revisa un admin en el panel → Comentarios → Bloqueados.
 *   - Si un admin pausó tu cuenta, tampoco puedes publicar aquí.
 *   - Máximo 5 publicaciones por día. Se borran solas 30 días después.
 *   - El correo del autor solo lo ven alumnos con sesión, y solo si él lo permitió.
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';
require __DIR__ . '/moderacion.php';
require __DIR__ . '/bitacora.php';

const TIPOS_PERDIDO = ['perdido', 'encontrado'];
const CATEGORIAS_PERDIDO = ['electronica', 'credencial', 'ropa', 'utiles', 'llaves', 'botella', 'dinero', 'otro'];
const MOTIVOS_PERDIDO = ['falso', 'ofensivo', 'spam', 'datos', 'otro'];
const DIAS_VIGENCIA = 30;
const POR_DIA = 5;
const REPORTES_OCULTAR = 3;
const POR_PAGINA_PERDIDOS = 30;
// (Las constantes van ANTES del switch: PHP las define al ejecutar esa línea.)
const SQL_PERDIDOS = 'SELECT p.*, u.nombre, u.correo, u.foto AS ufoto FROM perdidos p JOIN usuarios u ON u.id = p.usuario_id';

switch (metodo_http()) {
    case 'GET':
        if (!empty($_GET['panel'])) listar_panel();
        listar();
        break;
    case 'POST':
        if (($_GET['accion'] ?? '') === 'foto') subir_foto_perdido();
        $d = leer_json();
        switch ($d['accion'] ?? '') {
            case 'publicar': publicar($d); break;
            case 'resolver': resolver($d); break;
            case 'reportar': reportar_perdido($d); break;
            case 'moderar':  moderar($d); break;
            default: error_json('Acción no válida');
        }
        break;
    case 'DELETE': borrar_perdido(leer_json()); break;
    default: error_json('Método no permitido', 405);
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function carpeta_perdidos(): string
{
    global $CONFIG;
    $dir = $CONFIG['upload_dir'] . '/perdidos';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}

/** Una fila → JSON. El correo y el nombre solo si hay sesión. */
function perdido_json(array $p, ?array $yo, bool $admin = false): array
{
    global $CONFIG;
    $mio = $yo && (int) $p['usuario_id'] === (int) $yo['id'];
    $conSesion = $yo !== null;
    return [
        'id'          => (int) $p['id'],
        'type'        => $p['tipo'],
        'title'       => $p['titulo'],
        'description' => $p['descripcion'] ?? '',
        'category'    => $p['categoria'],
        'building'    => $p['edificio_number'] !== null ? (int) $p['edificio_number'] : null,
        'place'       => $p['lugar'] ?? '',
        'handover'    => $p['entrega'] ?? '',
        'date'        => $p['fecha'],
        'photo'       => $p['foto'] ? $CONFIG['upload_url'] . '/perdidos/' . $p['foto'] : null,
        'status'      => $p['vence_en'] <= ahora() && $p['estado'] === 'activo' ? 'vencido' : $p['estado'],
        'reports'     => $admin ? (int) $p['reportes'] : null,
        'createdAt'   => iso($p['creado_en']),
        'expiresAt'   => iso($p['vence_en']),
        'mine'        => $mio,
        'author'      => $conSesion || $admin ? ['nombre' => $p['nombre'], 'foto' => $p['ufoto']] : null,
        'contact'     => ($conSesion && !$mio && $p['mostrar_correo']) || $admin ? $p['correo'] : null,
    ];
}

function listar(): void
{
    $yo = usuario_actual();
    $pdo = db();
    limpiar_vencidos($pdo);

    if (!empty($_GET['mios'])) {
        if (!$yo) error_json('Inicia sesión para ver tus publicaciones', 401);
        $s = $pdo->prepare(SQL_PERDIDOS . ' WHERE p.usuario_id = ? ORDER BY p.creado_en DESC');
        $s->execute([$yo['id']]);
        responder(['items' => array_map(fn ($p) => perdido_json($p, $yo), $s->fetchAll()), 'hayMas' => false]);
    }

    $donde = ["p.estado = 'activo'", 'p.vence_en > ?'];
    $params = [ahora()];
    $tipo = (string) ($_GET['tipo'] ?? 'todos');
    if (in_array($tipo, TIPOS_PERDIDO, true)) {
        $donde[] = 'p.tipo = ?';
        $params[] = $tipo;
    }
    $cat = (string) ($_GET['categoria'] ?? '');
    if (in_array($cat, CATEGORIAS_PERDIDO, true)) {
        $donde[] = 'p.categoria = ?';
        $params[] = $cat;
    }
    $q = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 60);
    if ($q !== '') {
        $donde[] = '(p.titulo LIKE ? OR p.descripcion LIKE ? OR p.lugar LIKE ?)';
        array_push($params, "%$q%", "%$q%", "%$q%");
    }
    $pagina = max(0, min(20, (int) ($_GET['pagina'] ?? 0)));
    $s = $pdo->prepare(SQL_PERDIDOS . ' WHERE ' . implode(' AND ', $donde) . ' ORDER BY p.creado_en DESC LIMIT ' . (POR_PAGINA_PERDIDOS + 1) . ' OFFSET ' . ($pagina * POR_PAGINA_PERDIDOS));
    $s->execute($params);
    $filas = $s->fetchAll();
    responder([
        'items'  => array_map(fn ($p) => perdido_json($p, $yo), array_slice($filas, 0, POR_PAGINA_PERDIDOS)),
        'hayMas' => count($filas) > POR_PAGINA_PERDIDOS,
    ]);
}

function listar_panel(): void
{
    $admin = exigir_admin();
    $s = db()->prepare(SQL_PERDIDOS . ' ORDER BY (p.estado = \'oculto\') DESC, p.reportes DESC, p.creado_en DESC LIMIT 200');
    $s->execute();
    responder(['items' => array_map(fn ($p) => perdido_json($p, $admin, true), $s->fetchAll())]);
}

/** Borra (con su foto) lo que venció hace más de 30 días. Pocas a la vez. */
function limpiar_vencidos(PDO $pdo): void
{
    $s = $pdo->prepare('SELECT id, foto FROM perdidos WHERE vence_en < ? LIMIT 20');
    $s->execute([ahora(-DIAS_VIGENCIA * 86400)]);
    foreach ($s->fetchAll() as $p) {
        if ($p['foto']) @unlink(carpeta_perdidos() . '/' . $p['foto']);
        $pdo->prepare('DELETE FROM perdidos WHERE id = ?')->execute([$p['id']]);
    }
}

// ---------------------------------------------------------------------------
// Publicar
// ---------------------------------------------------------------------------

function alumno_con_sesion(): array
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión con tu correo @alumnos.udg.mx para publicar', 401);
    if (!$u['permisos']['app']) error_json('Solo las cuentas de la escuela pueden publicar', 403);
    return $u;
}

function subir_foto_perdido(): void
{
    global $CONFIG;
    alumno_con_sesion();
    $f = $_FILES['foto'] ?? null;
    if (!$f || $f['error'] === UPLOAD_ERR_NO_FILE) error_json('Falta la foto');
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['size'] > $CONFIG['upload_max_mb'] * 1024 * 1024) error_json('La foto pesa más de ' . $CONFIG['upload_max_mb'] . ' MB');
    if ($f['error'] !== UPLOAD_ERR_OK) error_json('No se pudo subir la foto');
    $tipos = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!isset($tipos[$mime])) error_json('La foto debe ser JPG, PNG o WEBP');
    $nombre = bin2hex(random_bytes(12)) . '.' . $tipos[$mime];
    if (!move_uploaded_file($f['tmp_name'], carpeta_perdidos() . '/' . $nombre)) error_json('No se pudo guardar la foto', 500);
    responder(['ok' => true, 'archivo' => $nombre, 'url' => $CONFIG['upload_url'] . '/perdidos/' . $nombre], 201);
}

function texto_opcional($v, int $max, string $campo): ?string
{
    $t = trim(preg_replace('/\s+/u', ' ', (string) ($v ?? '')));
    if ($t === '') return null;
    if (mb_strlen($t) > $max) error_json("$campo puede tener hasta $max caracteres");
    return $t;
}

function publicar(array $d): void
{
    $u = alumno_con_sesion();
    if ($p = pausa_de($u['id'], 'publicaciones')) error_json($p, 403);
    $pdo = db();

    $tipo = (string) ($d['tipo'] ?? '');
    if (!in_array($tipo, TIPOS_PERDIDO, true)) error_json('Elige si lo perdiste o lo encontraste');
    $titulo = texto_opcional($d['titulo'] ?? '', 80, 'El título');
    if (!$titulo || mb_strlen($titulo) < 3) error_json('Escribe qué es (al menos 3 letras)');
    $descripcion = texto_opcional($d['descripcion'] ?? '', 500, 'La descripción');
    $lugar = texto_opcional($d['lugar'] ?? '', 100, 'El lugar');
    $entrega = $tipo === 'encontrado' ? texto_opcional($d['entrega'] ?? '', 120, '"Dónde recogerlo"') : null;
    $categoria = in_array($d['categoria'] ?? '', CATEGORIAS_PERDIDO, true) ? $d['categoria'] : 'otro';
    $edificio = isset($d['edificio']) && $d['edificio'] !== '' && $d['edificio'] !== null ? (int) $d['edificio'] : null;
    if ($edificio !== null && ($edificio < 1 || $edificio > 10)) error_json('Edificio no válido (1 a 10)');
    $fecha = (string) ($d['fecha'] ?? date('Y-m-d'));
    $f = DateTime::createFromFormat('Y-m-d', $fecha);
    if (!$f || $f->format('Y-m-d') !== $fecha) error_json('La fecha debe ser AAAA-MM-DD');
    if ($fecha > date('Y-m-d')) error_json('La fecha no puede ser en el futuro');
    if ($fecha < date('Y-m-d', time() - 60 * 86400)) error_json('Solo cosas de los últimos 60 días');
    $foto = null;
    if (!empty($d['foto'])) {
        $foto = basename((string) $d['foto']);
        if (!preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $foto) || !is_file(carpeta_perdidos() . '/' . $foto)) error_json('La foto no es válida; vuelve a subirla');
    }

    // Límite por día
    $c = $pdo->prepare('SELECT COUNT(*) FROM perdidos WHERE usuario_id = ? AND creado_en > ?');
    $c->execute([$u['id'], ahora(-86400)]);
    if ((int) $c->fetchColumn() >= POR_DIA) error_json('Llegaste al máximo de ' . POR_DIA . ' publicaciones por día.', 429);

    // Mismo filtro que los comentarios
    $revision = moderar_texto(implode(' · ', array_filter([$titulo, $descripcion, $lugar, $entrega])));
    if (!$revision['ok']) {
        $texto = implode(' · ', array_filter([$titulo, $descripcion, $lugar, $entrega]));
        $extra = registrar_bloqueo($u['id'], null, 'perdido', $texto, $revision['motivo']);
        responder(['ok' => false, 'bloqueado' => true, 'motivo' => $revision['motivo'], 'error' => mensaje_moderacion_general($revision['mensaje']) . $extra], 422);
    }

    $pdo->prepare(
        'INSERT INTO perdidos (tipo, titulo, descripcion, categoria, edificio_number, lugar, entrega, fecha, foto, mostrar_correo, usuario_id, creado_en, vence_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$tipo, $titulo, $descripcion, $categoria, $edificio, $lugar, $entrega, $fecha, $foto, !empty($d['mostrarCorreo']) ? 1 : 0, $u['id'], ahora(), ahora(DIAS_VIGENCIA * 86400)]);
    $id = (int) $pdo->lastInsertId();
    responder(['ok' => true, 'item' => uno($id, $u)], 201);
}

function uno(int $id, ?array $yo): array
{
    $s = db()->prepare(SQL_PERDIDOS . ' WHERE p.id = ?');
    $s->execute([$id]);
    $p = $s->fetch();
    if (!$p) error_json('Esa publicación ya no existe', 404);
    return perdido_json($p, $yo);
}

function del_autor(int $id, array $u): array
{
    $s = db()->prepare('SELECT * FROM perdidos WHERE id = ?');
    $s->execute([$id]);
    $p = $s->fetch();
    if (!$p) error_json('Esa publicación ya no existe', 404);
    if ((int) $p['usuario_id'] !== (int) $u['id'] && !$u['permisos']['admin']) error_json('Solo quien la publicó puede cambiarla', 403);
    return $p;
}

function resolver(array $d): void
{
    $u = alumno_con_sesion();
    $id = (int) ($d['id'] ?? 0);
    del_autor($id, $u);
    db()->prepare("UPDATE perdidos SET estado = 'resuelto', resuelto_en = ? WHERE id = ?")->execute([ahora(), $id]);
    responder(['ok' => true, 'item' => uno($id, $u)]);
}

function reportar_perdido(array $d): void
{
    $u = alumno_con_sesion();
    $id = (int) ($d['id'] ?? 0);
    $motivo = in_array($d['motivo'] ?? '', MOTIVOS_PERDIDO, true) ? $d['motivo'] : 'otro';
    $pdo = db();
    $p = $pdo->prepare('SELECT usuario_id FROM perdidos WHERE id = ?');
    $p->execute([$id]);
    $autor = $p->fetchColumn();
    if ($autor === false) error_json('Esa publicación ya no existe', 404);
    if ((int) $autor === (int) $u['id']) error_json('No puedes reportar tu propia publicación');
    $ya = $pdo->prepare('SELECT 1 FROM denuncias WHERE perdido_id = ? AND usuario_id = ?');
    $ya->execute([$id, $u['id']]);
    if ($ya->fetchColumn()) responder(['ok' => true, 'yaReportado' => true]);
    $pdo->prepare('INSERT INTO denuncias (perdido_id, usuario_id, motivo, creado_en) VALUES (?, ?, ?, ?)')->execute([$id, $u['id'], $motivo, ahora()]);
    $pdo->prepare('UPDATE perdidos SET reportes = reportes + 1 WHERE id = ?')->execute([$id]);
    // 3 reportes: se oculta hasta que un admin lo revise.
    $pdo->prepare("UPDATE perdidos SET estado = 'oculto' WHERE id = ? AND reportes >= ? AND estado = 'activo'")->execute([$id, REPORTES_OCULTAR]);
    responder(['ok' => true]);
}

function moderar(array $d): void
{
    $admin = exigir_admin();
    $id = (int) ($d['id'] ?? 0);
    $estado = $d['estado'] ?? '';
    if (!in_array($estado, ['activo', 'oculto'], true)) error_json('Estado no válido');
    $s = db()->prepare('SELECT titulo FROM perdidos WHERE id = ?');
    $s->execute([$id]);
    $titulo = $s->fetchColumn();
    if ($titulo === false) error_json('Esa publicación ya no existe', 404);
    db()->prepare('UPDATE perdidos SET estado = ?' . ($estado === 'activo' ? ', reportes = 0' : '') . ' WHERE id = ?')->execute([$estado, $id]);
    if ($estado === 'activo') db()->prepare('DELETE FROM denuncias WHERE perdido_id = ?')->execute([$id]);
    bitacora('perdido', $estado === 'activo' ? 'mostrar' : 'ocultar', $titulo, '', $admin['id'], $admin['correo']);
    responder(['ok' => true]);
}

function borrar_perdido(array $d): void
{
    $u = alumno_con_sesion_o_admin();
    $id = (int) ($d['id'] ?? 0);
    $p = del_autor($id, $u);
    db()->prepare('DELETE FROM perdidos WHERE id = ?')->execute([$id]);
    if ($p['foto']) @unlink(carpeta_perdidos() . '/' . $p['foto']);
    if ((int) $p['usuario_id'] !== (int) $u['id']) bitacora('perdido', 'borrar', $p['titulo'], '', $u['id'], $u['correo']);
    responder(['ok' => true]);
}

function alumno_con_sesion_o_admin(): array
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión', 401);
    return $u;
}
