<?php
/**
 * POLIMAP — Usuarios admin y correos de prueba (solo el administrador maestro)
 *
 *   GET    /api/accesos.php                 → { accesos, usuarios }  (lista y resumen)
 *   GET    /api/accesos.php?personas=1&q=&tipo=&pagina=0
 *                                           → personas que han entrado (buscador y filtros)
 *   POST   /api/accesos.php  { correo, rol: 'admin'|'prueba', nota, invitar }  → agregar
 *   POST   /api/accesos.php  { accion: 'nota', id, nota }          → cambiar la nota
 *   POST   /api/accesos.php  { accion: 'reset_clave', id }         → borrar su contraseña
 *                                                                    (la vuelve a crear con un código)
 *   POST   /api/accesos.php  { accion: 'desbloquear', id }         → quitar el bloqueo de 15 min
 *   POST   /api/accesos.php  { accion: 'invitar', id }             → correo con instrucciones
 *   DELETE /api/accesos.php  { id }                                → quitar (POST ?_method=DELETE)
 *
 * rol 'admin'  → profesor que podrá entrar al panel. Debe ser @academicos.udg.mx.
 *                Su contraseña la crea él mismo con un código que le llega al correo.
 * rol 'prueba' → cualquier correo que podrá reportar en la app como alumno
 *                (evaluadores, compañeros que prueban con Gmail).
 *
 * Las cuentas con rol 'maestro' NO se agregan ni se quitan desde aquí: solo
 * con SQL en phpMyAdmin (así nadie deja el panel sin dueño por accidente).
 * Todo lo que se haga aquí queda en la bitácora (Historial de cambios).
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';
require __DIR__ . '/notificar.php';
require __DIR__ . '/bitacora.php';

$maestro = exigir_maestro();

switch (metodo_http()) {
    case 'GET':
        empty($_GET['personas']) ? listar_accesos() : listar_personas();
        break;
    case 'POST':
        $d = leer_json();
        switch ($d['accion'] ?? '') {
            case 'nota':        cambiar_nota($d); break;
            case 'reset_clave': reset_clave($d); break;
            case 'desbloquear': desbloquear($d); break;
            case 'invitar':     invitar_por_id((int) ($d['id'] ?? 0)); break;
            default:            agregar_acceso($maestro, $d);
        }
        break;
    case 'DELETE':
        quitar_acceso();
        break;
    default:
        error_json('Método no permitido', 405);
}

/** La fila de accesos o 404. */
function acceso_o_404(int $id): array
{
    $s = db()->prepare('SELECT id, correo, rol, nota FROM accesos WHERE id = ?');
    $s->execute([$id]);
    $a = $s->fetch();
    if (!$a) error_json('No existe ese acceso', 404);
    return $a;
}

function listar_accesos(): void
{
    $pdo = db();
    $accesos = $pdo->query(
        "SELECT a.id, a.correo, a.rol, a.nota, a.agregado_por, a.creado_en, a.bloqueado_hasta,
                (a.clave_hash IS NOT NULL) AS tiene_clave, u.id AS uid, u.nombre, u.foto, u.ultimo_acceso
           FROM accesos a LEFT JOIN usuarios u ON u.correo = a.correo
          ORDER BY FIELD(a.rol, 'maestro', 'admin', 'prueba'), a.correo"
    )->fetchAll();

    // Cuántos cambios hizo cada admin en los últimos 7 días (reportes + bitácora).
    $semana = ahora(-7 * 86400);
    $cambios = [];
    $s = $pdo->prepare("SELECT usuario_id, COUNT(*) AS n FROM reportes_historial WHERE creado_en >= ? AND usuario_id IS NOT NULL AND accion NOT IN ('creado', 'apoyo') GROUP BY usuario_id");
    $s->execute([$semana]);
    foreach ($s->fetchAll() as $f) $cambios[(int) $f['usuario_id']] = (int) $f['n'];
    try {
        $s = $pdo->prepare("SELECT usuario_id, COUNT(*) AS n FROM bitacora WHERE creado_en >= ? AND usuario_id IS NOT NULL AND tipo <> 'sesion' GROUP BY usuario_id");
        $s->execute([$semana]);
        foreach ($s->fetchAll() as $f) $cambios[(int) $f['usuario_id']] = ($cambios[(int) $f['usuario_id']] ?? 0) + (int) $f['n'];
    } catch (Throwable $e) {
        // sin bitácora todavía
    }

    $resumen = resumen_personas();
    responder([
        'accesos'  => array_map(fn ($a) => [
            'id'             => (int) $a['id'],
            'correo'         => $a['correo'],
            'rol'            => $a['rol'],
            'nota'           => $a['nota'],
            'tieneClave'     => (bool) $a['tiene_clave'],   // ya creó su contraseña del panel
            'bloqueadoHasta' => $a['bloqueado_hasta'] && $a['bloqueado_hasta'] > ahora() ? iso($a['bloqueado_hasta']) : null,
            'agregadoPor'    => $a['agregado_por'],
            'createdAt'      => iso($a['creado_en']),
            'usuarioId'      => $a['uid'] ? (int) $a['uid'] : null,
            'nombre'         => $a['nombre'],            // null si todavía no entra
            'foto'           => $a['foto'],
            'lastLogin'      => iso($a['ultimo_acceso']),
            'cambiosSemana'  => $a['uid'] ? ($cambios[(int) $a['uid']] ?? 0) : 0,
        ], $accesos),
        'usuarios' => $resumen,
        'correoActivo' => correo_activo(), // para saber si se pueden mandar invitaciones
    ]);
}

/** Todas las personas con su tipo (alumno, admin, prueba…). Son pocas: se calcula en PHP. */
function todas_las_personas(): array
{
    global $CONFIG;
    $alumnos = strtolower($CONFIG['dominio_alumnos'] ?? 'alumnos.udg.mx');
    $academicos = strtolower($CONFIG['dominio_academicos'] ?? 'academicos.udg.mx');
    $filas = db()->query(
        'SELECT u.id, u.correo, u.nombre, u.foto, u.creado_en, u.ultimo_acceso, a.rol
           FROM usuarios u LEFT JOIN accesos a ON a.correo = u.correo
          ORDER BY u.ultimo_acceso DESC'
    )->fetchAll();
    return array_map(function ($u) use ($alumnos, $academicos) {
        $dominio = dominio_de($u['correo']);
        $tipo = match (true) {
            $u['rol'] === 'maestro' => 'maestro',
            $u['rol'] === 'admin' && $dominio === $academicos => 'admin',
            $dominio === $alumnos => 'alumno',
            $u['rol'] === 'prueba' => 'prueba',
            $dominio === $academicos => 'academico',
            default => 'ninguno',
        };
        return [
            'id'        => (int) $u['id'],
            'correo'    => $u['correo'],
            'nombre'    => $u['nombre'],
            'foto'      => $u['foto'],
            'tipo'      => $tipo,
            'createdAt' => iso($u['creado_en']),
            'lastLogin' => iso($u['ultimo_acceso']),
        ];
    }, $filas);
}

function resumen_personas(): array
{
    $todas = todas_las_personas();
    $hace7 = str_replace(' ', 'T', ahora(-7 * 86400));
    $porTipo = [];
    foreach ($todas as $p) $porTipo[$p['tipo']] = ($porTipo[$p['tipo']] ?? 0) + 1;
    return [
        'total'     => count($todas),
        'activos7'  => count(array_filter($todas, fn ($p) => ($p['lastLogin'] ?? '') >= $hace7)),
        'porTipo'   => $porTipo,
        'recientes' => array_slice($todas, 0, 10),
    ];
}

function listar_personas(): void
{
    $q = mb_strtolower(trim((string) ($_GET['q'] ?? '')));
    $tipo = (string) ($_GET['tipo'] ?? '');
    $pagina = max(0, (int) ($_GET['pagina'] ?? 0));
    $lista = array_values(array_filter(todas_las_personas(), function ($p) use ($q, $tipo) {
        if ($tipo !== '' && $p['tipo'] !== $tipo) return false;
        if ($q !== '' && !str_contains(mb_strtolower($p['correo'] . ' ' . $p['nombre']), $q)) return false;
        return true;
    }));
    $porPagina = 40;
    responder([
        'total'  => count($lista),
        'items'  => array_slice($lista, $pagina * $porPagina, $porPagina),
        'hayMas' => count($lista) > ($pagina + 1) * $porPagina,
    ]);
}

function agregar_acceso(array $maestro, array $d): void
{
    global $CONFIG;
    $correo = strtolower(trim((string) ($d['correo'] ?? '')));
    $rol    = (string) ($d['rol'] ?? '');
    $nota   = mb_substr(trim((string) ($d['nota'] ?? '')), 0, 120);
    $academicos = strtolower($CONFIG['dominio_academicos'] ?? 'academicos.udg.mx');

    if (!filter_var($correo, FILTER_VALIDATE_EMAIL) || mb_strlen($correo) > 190) {
        error_json('Escribe un correo válido');
    }
    if (!in_array($rol, ['admin', 'prueba'], true)) {
        error_json('Rol no válido (admin o prueba)');
    }
    if ($rol === 'admin' && dominio_de($correo) !== $academicos) {
        error_json("Los administradores deben tener correo @$academicos");
    }
    $existe = db()->prepare('SELECT 1 FROM accesos WHERE correo = ?');
    $existe->execute([$correo]);
    if ($existe->fetchColumn()) error_json('Ese correo ya está en la lista', 409);

    db()->prepare('INSERT INTO accesos (correo, rol, nota, agregado_por, creado_en) VALUES (?, ?, ?, ?, ?)')
        ->execute([$correo, $rol, $nota, $maestro['correo'], ahora()]);
    $id = (int) db()->lastInsertId();
    bitacora('acceso', 'agregar', $correo, ($rol === 'admin' ? 'Profesor administrador' : 'Correo de prueba') . ($nota !== '' ? " · $nota" : ''));

    // Invitación por correo (opcional, solo admins).
    $invitado = null;
    if ($rol === 'admin' && !empty($d['invitar'])) $invitado = mandar_invitacion($correo, $nota);
    responder(['ok' => true, 'id' => $id, 'invitado' => $invitado], 201);
}

function cambiar_nota(array $d): void
{
    $a = acceso_o_404((int) ($d['id'] ?? 0));
    $nota = mb_substr(trim((string) ($d['nota'] ?? '')), 0, 120);
    db()->prepare('UPDATE accesos SET nota = ? WHERE id = ?')->execute([$nota, $a['id']]);
    bitacora('acceso', 'nota', $a['correo'], $nota !== '' ? "Nota: $nota" : 'Quitó la nota');
    responder(['ok' => true]);
}

/** Borra su contraseña: la próxima vez entra con "Crear o recuperar contraseña" (código al correo). */
function reset_clave(array $d): void
{
    $a = acceso_o_404((int) ($d['id'] ?? 0));
    if ($a['rol'] === 'prueba') error_json('Los correos de prueba no tienen contraseña del panel');
    db()->prepare('UPDATE accesos SET clave_hash = NULL, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?')->execute([$a['id']]);
    // Cierra sus sesiones abiertas del panel y de la app.
    $u = db()->prepare('SELECT id FROM usuarios WHERE correo = ?');
    $u->execute([$a['correo']]);
    if ($uid = $u->fetchColumn()) db()->prepare('DELETE FROM sesiones WHERE usuario_id = ?')->execute([$uid]);
    bitacora('acceso', 'reset_clave', $a['correo'], 'Se borró su contraseña y se cerraron sus sesiones');
    responder(['ok' => true]);
}

function desbloquear(array $d): void
{
    $a = acceso_o_404((int) ($d['id'] ?? 0));
    db()->prepare('UPDATE accesos SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?')->execute([$a['id']]);
    bitacora('acceso', 'desbloquear', $a['correo']);
    responder(['ok' => true]);
}

function invitar_por_id(int $id): void
{
    $a = acceso_o_404($id);
    if ($a['rol'] === 'prueba') error_json('La invitación es para profesores administradores');
    $ok = mandar_invitacion($a['correo'], (string) $a['nota']);
    if (!$ok) error_json('No se pudo mandar el correo. Revisa la sección "correo" de config.php.', 502);
    responder(['ok' => true]);
}

/** Correo con los pasos para entrar al panel. Regresa true si se envió. */
function mandar_invitacion(string $correo, string $nota): bool
{
    if (!correo_activo()) return false;
    $sitio = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'polimap.ct.ws');
    $panel = $sitio . '/admin.html';
    $html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">'
        . '<div style="background:#14203A;color:#fff;padding:18px;border-radius:14px 14px 0 0;font-size:20px;font-weight:bold">POLIMAP · Panel de administración</div>'
        . '<div style="border:1px solid #dce3ed;border-top:0;padding:24px;border-radius:0 0 14px 14px;color:#14203A">'
        . '<p style="margin:0 0 12px">Hola' . ($nota !== '' ? ' (' . htmlspecialchars($nota) . ')' : '') . ', te agregaron como <b>administrador</b> del panel de POLIMAP de la Escuela Politécnica.</p>'
        . '<p style="margin:0 0 6px"><b>Para entrar la primera vez:</b></p>'
        . '<ol style="margin:0 0 16px;padding-left:20px;line-height:1.6">'
        . '<li>Abre <a href="' . $panel . '">' . $panel . '</a></li>'
        . '<li>Toca <b>"¿Primera vez u olvidaste tu contraseña?"</b> y escribe este correo.</li>'
        . '<li>Te llegará un código de 6 dígitos: con él creas tu contraseña.</li>'
        . '</ol>'
        . '<p style="margin:0 0 16px">También puedes entrar con el botón <b>Google</b> usando tu correo institucional.</p>'
        . '<p style="margin:0;color:#5d6980;font-size:13px">Si no esperabas este correo, ignóralo.</p></div></div>';
    $texto = "Te agregaron como administrador del panel de POLIMAP.\n1) Abre $panel\n2) Toca \"¿Primera vez u olvidaste tu contraseña?\" y escribe tu correo.\n3) Con el código que te llegue crea tu contraseña.\nTambién puedes entrar con Google.";
    $ok = enviar_correo([$correo], 'Tu acceso al panel de POLIMAP', $html, $texto);
    if ($ok) bitacora('acceso', 'invitar', $correo, 'Se mandó el correo con los pasos para entrar');
    return $ok;
}

function quitar_acceso(): void
{
    $id = (int) (leer_json()['id'] ?? 0);
    $s = db()->prepare('SELECT correo, rol FROM accesos WHERE id = ?');
    $s->execute([$id]);
    $a = $s->fetch();
    // La cuenta maestra no se quita desde el panel (solo con SQL).
    $stmt = db()->prepare("DELETE FROM accesos WHERE id = ? AND rol <> 'maestro'");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) error_json('No existe ese acceso o es la cuenta maestra', 404);
    bitacora('acceso', 'quitar', $a['correo'], $a['rol'] === 'admin' ? 'Ya no entra al panel' : 'Correo de prueba');
    responder(['ok' => true]);
}
