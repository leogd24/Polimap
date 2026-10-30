<?php
/**
 * POLIMAP — Comentarios de los avisos (como en Instagram).   Responsable: Alexis
 *
 * Para todos:
 *   GET  /api/comentarios.php?aviso=12   → comentarios visibles con sus respuestas
 *
 * Con sesión de alumno (@alumnos.udg.mx) o admin:
 *   POST { accion: 'comentar', aviso, texto, padre? }   → publica (pasa por el filtro)
 *   POST { accion: 'reportar', id, motivo }             → 3 reportes = se oculta solo
 *   POST { accion: 'borrar', id }                       → el autor (o un admin) lo borra
 *
 * Panel (admin):
 *   GET  /api/comentarios.php?moderacion=1  → reportados/ocultos, bloqueados por el filtro,
 *                                             silenciados y comentarios recientes
 *   POST { accion: 'ocultar' | 'mostrar', id, motivo? }
 *   POST { accion: 'silenciar', usuario, dias (1|7|30|0), motivo }  /  { accion: 'quitar_silencio', usuario }
 *        dias 0 = permanente (solo la cuenta maestra la puede quitar)
 *   POST { accion: 'revisar_bloqueo', id, veredicto: 'correcto' | 'error' }
 *        un admin confirma lo que bloqueó el filtro (comentarios, perdidos, fechas
 *        o avisos de consejales). "error" = no cuenta para la pausa automática.
 *
 * Reglas para cuidar el ambiente institucional:
 *   - Se publica con nombre y foto de la cuenta UdeG (nadie es anónimo).
 *   - Filtro automático (api/moderacion.php): groserías, amenazas, teléfonos,
 *     correos y enlaces de fuera. Lo bloqueado queda en moderacion_log.
 *   - 3 bloqueos en 24 h = no puede comentar durante 24 h.
 *   - Máximo 4 comentarios por minuto y 60 por día; no se repite el mismo texto.
 *   - Un admin puede ocultar, borrar o silenciar desde el panel.
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';
require __DIR__ . '/moderacion.php';
require __DIR__ . '/bitacora.php';
require __DIR__ . '/audiencia.php';

const REPORTES_PARA_OCULTAR = 3;
const MOTIVOS_REPORTE = ['ofensivo', 'acoso', 'spam', 'datos', 'otro'];

switch (metodo_http()) {
    case 'GET':
        if (!empty($_GET['moderacion'])) panel_moderacion();
        else listar((int) ($_GET['aviso'] ?? 0));
        break;
    case 'POST':
        $d = leer_json();
        switch ($d['accion'] ?? '') {
            case 'comentar':        comentar($d); break;
            case 'reportar':        reportar($d); break;
            case 'borrar':          borrar($d); break;
            case 'ocultar':         cambiar_estado($d, 'oculto'); break;
            case 'mostrar':         cambiar_estado($d, 'visible'); break;
            case 'silenciar':       silenciar($d); break;
            case 'quitar_silencio': quitar_silencio($d); break;
            case 'revisar_bloqueo': revisar_bloqueo($d); break;
            default:                error_json('Acción no válida');
        }
        break;
    default:
        error_json('Método no permitido', 405);
}

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

/** ¿Este correo es de un admin? (se recuerda para no preguntar 20 veces) */
function es_admin_correo(string $correo): bool
{
    static $cache = [];
    return $cache[$correo] ??= permisos_de($correo)['admin'];
}

/** JSON público de un comentario. */
function comentario_json(array $c, ?array $yo): array
{
    $admin = es_admin_correo($c['correo']);
    return [
        'id'        => (int) $c['id'],
        'text'      => $c['texto'],
        'createdAt' => iso($c['creado_en']),
        'parent'    => $c['padre_id'] === null ? null : (int) $c['padre_id'],
        'author'    => [
            'id'     => (int) $c['usuario_id'],
            'nombre' => $admin ? ($c['nombre'] ?: 'Equipo POLIMAP') : ($c['nombre'] ?: 'Alumno'),
            'foto'   => $c['foto'],
            'admin'  => $admin,
        ],
        'mine'      => $yo && (int) $c['usuario_id'] === $yo['id'],
        'canDelete' => $yo && ((int) $c['usuario_id'] === $yo['id'] || $yo['permisos']['admin']),
    ];
}

/** El aviso existe? Regresa la fila o corta con 404. */
function aviso_o_404(int $id): array
{
    $stmt = db()->prepare('SELECT id, titulo, comentarios_abiertos, fecha_inicio, fecha_fin FROM avisos WHERE id = ?');
    $stmt->execute([$id]);
    $a = $stmt->fetch();
    // Si el aviso es solo para consejales, los demás no ven ni sus comentarios.
    if (!$a || !puede_ver_aviso($id, usuario_actual())) error_json('No existe ese aviso', 404);
    return $a;
}

// ---------------------------------------------------------------------------
// Para todos
// ---------------------------------------------------------------------------
function listar(int $avisoId): void
{
    $a = aviso_o_404($avisoId);
    $yo = usuario_actual();
    $stmt = db()->prepare(
        "SELECT c.id, c.usuario_id, c.padre_id, c.texto, c.estado, c.creado_en, u.nombre, u.correo, u.foto
           FROM avisos_comentarios c JOIN usuarios u ON u.id = c.usuario_id
          WHERE c.aviso_id = ?
          ORDER BY c.creado_en, c.id"
    );
    $stmt->execute([$avisoId]);
    $raiz = [];
    $respuestas = [];
    foreach ($stmt->fetchAll() as $c) {
        if ($c['padre_id'] === null) {
            // Los comentarios borrados u ocultos se guardan aparte: solo se muestran
            // como "Comentario eliminado" si tienen respuestas visibles.
            $j = comentario_json($c, $yo) + ['replies' => [], 'removed' => $c['estado'] !== 'visible'];
            if ($j['removed']) {
                $j['text'] = null;
                $j['author'] = ['id' => 0, 'nombre' => '', 'foto' => null, 'admin' => false];
                $j['mine'] = $j['canDelete'] = false;
            }
            $raiz[$j['id']] = $j;
        } elseif ($c['estado'] === 'visible') {
            $respuestas[] = comentario_json($c, $yo);
        }
    }
    foreach ($respuestas as $r) {
        if (isset($raiz[$r['parent']])) $raiz[$r['parent']]['replies'][] = $r;
    }
    $raiz = array_filter($raiz, fn ($c) => !$c['removed'] || $c['replies']);
    $pausa = $yo ? pausa_de($yo['id']) : null;
    responder([
        'allowComments' => (bool) $a['comentarios_abiertos'],
        'total'         => count(array_filter($raiz, fn ($c) => !$c['removed'])) + array_sum(array_map(fn ($c) => count($c['replies']), $raiz)),
        'comments'      => array_values($raiz),
        'canComment'    => $yo && $yo['permisos']['app'] && $a['comentarios_abiertos'] && !$pausa,
        'paused'        => $pausa,
    ]);
}

// ---------------------------------------------------------------------------
// Con sesión
// ---------------------------------------------------------------------------
function comentar(array $d): void
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión con tu correo @alumnos.udg.mx para comentar', 401);
    if (!$u['permisos']['app']) error_json('Solo las cuentas @alumnos.udg.mx pueden comentar', 403);

    $avisoId = (int) ($d['aviso'] ?? 0);
    $a = aviso_o_404($avisoId);
    if (!$a['comentarios_abiertos'] && !$u['permisos']['admin']) error_json('Los comentarios de este aviso están cerrados', 403);

    $texto = trim(preg_replace('/\s+/u', ' ', (string) ($d['texto'] ?? '')));
    if (mb_strlen($texto) < 2) error_json('Escribe tu comentario');
    if (mb_strlen($texto) > 500) error_json('El comentario no puede pasar de 500 caracteres');

    if (!$u['permisos']['admin'] && ($pausa = pausa_de($u['id']))) error_json($pausa, 403);

    $pdo = db();
    // Límites: 4 por minuto, 60 por día, y no repetir el mismo texto en 10 min.
    $cuenta = $pdo->prepare('SELECT COUNT(*) FROM avisos_comentarios WHERE usuario_id = ? AND creado_en > ?');
    $cuenta->execute([$u['id'], ahora(-60)]);
    if ((int) $cuenta->fetchColumn() >= 4) error_json('Vas muy rápido. Espera un momento antes de comentar otra vez.', 429);
    $cuenta->execute([$u['id'], ahora(-86400)]);
    if ((int) $cuenta->fetchColumn() >= 60) error_json('Llegaste al máximo de comentarios por hoy.', 429);
    $igual = $pdo->prepare('SELECT 1 FROM avisos_comentarios WHERE usuario_id = ? AND texto = ? AND creado_en > ?');
    $igual->execute([$u['id'], $texto, ahora(-600)]);
    if ($igual->fetchColumn()) error_json('Ya publicaste ese mismo comentario.', 409);

    // Respuesta: el "padre" debe ser de este aviso; si era una respuesta, se cuelga del comentario original.
    $padre = null;
    if (!empty($d['padre'])) {
        $p = $pdo->prepare("SELECT id, padre_id FROM avisos_comentarios WHERE id = ? AND aviso_id = ? AND estado = 'visible'");
        $p->execute([(int) $d['padre'], $avisoId]);
        $fila = $p->fetch();
        if (!$fila) error_json('El comentario al que respondes ya no está disponible', 404);
        $padre = $fila['padre_id'] !== null ? (int) $fila['padre_id'] : (int) $fila['id'];
    }

    // Filtro (los admins también pasan por él: la cuenta es institucional).
    $revision = moderar_texto($texto);
    if (!$revision['ok']) {
        $extra = registrar_bloqueo($u['id'], $avisoId, 'comentario', $texto, $revision['motivo']);
        responder(['ok' => false, 'bloqueado' => true, 'motivo' => $revision['motivo'], 'error' => $revision['mensaje'] . $extra], 422);
    }

    $pdo->prepare('INSERT INTO avisos_comentarios (aviso_id, usuario_id, padre_id, texto, creado_en) VALUES (?, ?, ?, ?, ?)')
        ->execute([$avisoId, $u['id'], $padre, $texto, ahora()]);
    $id = (int) $pdo->lastInsertId();
    $c = $pdo->prepare(
        'SELECT c.id, c.usuario_id, c.padre_id, c.texto, c.creado_en, u.nombre, u.correo, u.foto
           FROM avisos_comentarios c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ?'
    );
    $c->execute([$id]);
    responder(['ok' => true, 'comment' => comentario_json($c->fetch(), $u) + ['replies' => []]], 201);
}

function reportar(array $d): void
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión para reportar', 401);
    $id = (int) ($d['id'] ?? 0);
    $motivo = in_array($d['motivo'] ?? '', MOTIVOS_REPORTE, true) ? $d['motivo'] : 'otro';
    $pdo = db();
    $c = $pdo->prepare("SELECT id, usuario_id, estado FROM avisos_comentarios WHERE id = ?");
    $c->execute([$id]);
    $fila = $c->fetch();
    if (!$fila || $fila['estado'] === 'borrado') error_json('Ese comentario ya no existe', 404);
    if ((int) $fila['usuario_id'] === $u['id']) error_json('No puedes reportar tu propio comentario');

    $ya = $pdo->prepare('SELECT 1 FROM denuncias WHERE comentario_id = ? AND usuario_id = ?');
    $ya->execute([$id, $u['id']]);
    if (!$ya->fetchColumn()) {
        $pdo->prepare('INSERT INTO denuncias (comentario_id, usuario_id, motivo, creado_en) VALUES (?, ?, ?, ?)')
            ->execute([$id, $u['id'], $motivo, ahora()]);
        $pdo->prepare('UPDATE avisos_comentarios SET reportes = reportes + 1 WHERE id = ?')->execute([$id]);
        // Con 3 reportes se oculta solo hasta que un admin lo revise.
        $pdo->prepare(
            "UPDATE avisos_comentarios SET estado = 'oculto', motivo = ? WHERE id = ? AND estado = 'visible' AND reportes >= ?"
        )->execute(['Se ocultó solo por ' . REPORTES_PARA_OCULTAR . ' reportes', $id, REPORTES_PARA_OCULTAR]);
    }
    responder(['ok' => true, 'mensaje' => 'Gracias. El equipo del Poli revisará el comentario.']);
}

function borrar(array $d): void
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión', 401);
    $id = (int) ($d['id'] ?? 0);
    $c = db()->prepare('SELECT usuario_id FROM avisos_comentarios WHERE id = ?');
    $c->execute([$id]);
    $autor = $c->fetchColumn();
    if ($autor === false) error_json('Ese comentario ya no existe', 404);
    $esMio = (int) $autor === $u['id'];
    if (!$esMio && !$u['permisos']['admin']) error_json('Solo puedes borrar tus comentarios', 403);
    db()->prepare("UPDATE avisos_comentarios SET estado = 'borrado', motivo = ? WHERE id = ?")
        ->execute([$esMio ? 'Lo borró su autor' : 'Borrado por ' . $u['correo'], $id]);
    if (!$esMio) bitacora('comentario', 'borrar', resumen_comentario($id), '', $u['id'], $u['correo']);
    responder(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Panel de moderación (admin)
// ---------------------------------------------------------------------------
function panel_moderacion(): void
{
    exigir_admin();
    $pdo = db();
    $base = "SELECT c.id, c.aviso_id, c.usuario_id, c.padre_id, c.texto, c.estado, c.motivo, c.reportes, c.creado_en,
                    u.nombre, u.correo, u.foto, a.titulo AS aviso_titulo
               FROM avisos_comentarios c
               JOIN usuarios u ON u.id = c.usuario_id
               JOIN avisos a ON a.id = c.aviso_id";
    $fila = fn ($c) => [
        'id'        => (int) $c['id'],
        'aviso'     => ['id' => (int) $c['aviso_id'], 'title' => $c['aviso_titulo']],
        'text'      => $c['texto'],
        'estado'    => $c['estado'],
        'motivo'    => $c['motivo'],
        'reportes'  => (int) $c['reportes'],
        'createdAt' => iso($c['creado_en']),
        'author'    => ['id' => (int) $c['usuario_id'], 'nombre' => $c['nombre'], 'correo' => $c['correo'], 'foto' => $c['foto']],
    ];

    $revisar = $pdo->query("$base WHERE c.estado = 'oculto' OR (c.estado = 'visible' AND c.reportes > 0) ORDER BY c.creado_en DESC LIMIT 100")->fetchAll();
    // Motivos de los reportes de cada comentario.
    $motivos = [];
    if ($revisar) {
        $ids = array_map(fn ($c) => (int) $c['id'], $revisar);
        $m = $pdo->prepare('SELECT comentario_id, motivo, COUNT(*) AS n FROM denuncias WHERE comentario_id IN (' .
            implode(',', array_fill(0, count($ids), '?')) . ') GROUP BY comentario_id, motivo');
        $m->execute($ids);
        foreach ($m->fetchAll() as $r) $motivos[(int) $r['comentario_id']][$r['motivo']] = (int) $r['n'];
    }
    $recientes = $pdo->query("$base WHERE c.estado = 'visible' ORDER BY c.creado_en DESC LIMIT 60")->fetchAll();
    // Lo que bloqueó el filtro en TODO lo público (comentarios, perdidos, fechas y avisos de consejales).
    // Primero lo que falta revisar.
    $bloqueados = $pdo->query(
        'SELECT l.id, l.texto, l.motivo, l.origen, l.veredicto, l.revisado_por, l.revisado_en, l.creado_en, l.aviso_id,
                u.id AS usuario_id, u.nombre, u.correo, u.foto
           FROM moderacion_log l JOIN usuarios u ON u.id = l.usuario_id
          ORDER BY (l.veredicto IS NULL) DESC, l.creado_en DESC LIMIT 150'
    )->fetchAll();
    $silenciados = $pdo->prepare(
        'SELECT id AS usuario_id, silenciado_hasta AS hasta, silenciado_motivo AS motivo, silenciado_por AS por, nombre, correo
           FROM usuarios WHERE silenciado_hasta > ? ORDER BY silenciado_hasta DESC'
    );
    $silenciados->execute([ahora()]);

    responder([
        'revisar'     => array_map(fn ($c) => $fila($c) + ['reportMotivos' => $motivos[(int) $c['id']] ?? []], $revisar),
        'recientes'   => array_map($fila, $recientes),
        'bloqueados'  => array_map(fn ($l) => [
            'id'        => (int) $l['id'],
            'text'      => $l['texto'],
            'motivo'    => $l['motivo'],
            'createdAt' => iso($l['creado_en']),
            'avisoId'   => $l['aviso_id'] === null ? null : (int) $l['aviso_id'],
            'origen'    => $l['origen'] ?? 'comentario',
            'veredicto' => $l['veredicto'],
            'revisadoPor' => $l['revisado_por'],
            'revisadoEn'  => iso($l['revisado_en']),
            'author'    => ['id' => (int) $l['usuario_id'], 'nombre' => $l['nombre'], 'correo' => $l['correo'], 'foto' => $l['foto']],
        ], $bloqueados),
        'silenciados' => array_map(fn ($s) => [
            'usuario' => ['id' => (int) $s['usuario_id'], 'nombre' => $s['nombre'], 'correo' => $s['correo']],
            'hasta'   => iso($s['hasta']),
            'permanente' => es_pausa_permanente($s['hasta']),
            'motivo'  => $s['motivo'],
            'por'     => $s['por'],
        ], $silenciados->fetchAll()),
    ]);
}

function cambiar_estado(array $d, string $estado): void
{
    $admin = exigir_admin();
    $id = (int) ($d['id'] ?? 0);
    $pdo = db();
    if ($estado === 'visible') {
        // "Está bien": vuelve a verse y se limpian sus reportes (para que no se oculte otra vez).
        $pdo->prepare("UPDATE avisos_comentarios SET estado = 'visible', motivo = NULL, reportes = 0 WHERE id = ? AND estado <> 'borrado'")
            ->execute([$id]);
        $pdo->prepare('DELETE FROM denuncias WHERE comentario_id = ?')->execute([$id]);
    } else {
        $motivo = trim((string) ($d['motivo'] ?? '')) ?: 'Ocultado por ' . $admin['correo'];
        $pdo->prepare("UPDATE avisos_comentarios SET estado = 'oculto', motivo = ? WHERE id = ? AND estado <> 'borrado'")
            ->execute([mb_substr($motivo, 0, 120), $id]);
    }
    bitacora('comentario', $estado === 'visible' ? 'mostrar' : 'ocultar', resumen_comentario($id), '', $admin['id'], $admin['correo']);
    responder(['ok' => true]);
}

function silenciar(array $d): void
{
    $admin = exigir_admin();
    $usuario = (int) ($d['usuario'] ?? 0);
    // 1, 7 o 30 días; 0 = permanente (solo la cuenta maestra la puede quitar).
    $dias = in_array((int) ($d['dias'] ?? 1), [0, 1, 7, 30], true) ? (int) $d['dias'] : 1;
    $existe = db()->prepare('SELECT correo FROM usuarios WHERE id = ?');
    $existe->execute([$usuario]);
    $correo = $existe->fetchColumn();
    if (!$correo) error_json('No existe esa cuenta', 404);
    if (permisos_de($correo)['admin']) error_json('No se puede silenciar a un administrador');
    $hasta = $dias === 0 ? PAUSA_PERMANENTE : ahora($dias * 86400);
    $pdo = db();
    // La pausa vive en la cuenta (usuarios.silenciado_*).
    $pdo->prepare('UPDATE usuarios SET silenciado_hasta = ?, silenciado_motivo = ?, silenciado_por = ?, silenciado_en = ? WHERE id = ?')
        ->execute([$hasta, mb_substr(trim((string) ($d['motivo'] ?? '')), 0, 120) ?: null, $admin['correo'], ahora(), $usuario]);
    bitacora('comentario', 'pausar', $correo, ($dias === 0 ? 'permanente' : "$dias día(s)") . (trim((string) ($d['motivo'] ?? '')) !== '' ? ' · ' . trim((string) $d['motivo']) : ''), $admin['id'], $admin['correo']);
    responder(['ok' => true, 'hasta' => iso($hasta), 'permanente' => $dias === 0]);
}

function quitar_silencio(array $d): void
{
    $admin = exigir_admin();
    $usuario = (int) ($d['usuario'] ?? 0);
    $c = db()->prepare('SELECT correo, silenciado_hasta FROM usuarios WHERE id = ?');
    $c->execute([$usuario]);
    $cuenta = $c->fetch();
    if (!$cuenta) error_json('No existe esa cuenta', 404);
    if (es_pausa_permanente($cuenta['silenciado_hasta']) && empty($admin['permisos']['maestro'])) {
        error_json('Es una pausa permanente: solo la cuenta maestra la puede quitar.', 403);
    }
    db()->prepare('UPDATE usuarios SET silenciado_hasta = NULL, silenciado_motivo = NULL, silenciado_por = NULL, silenciado_en = NULL WHERE id = ?')->execute([$usuario]);
    bitacora('comentario', 'quitar_pausa', (string) $cuenta['correo'], '', $admin['id'], $admin['correo']);
    responder(['ok' => true]);
}

/** Un admin confirma lo que bloqueó el filtro: 'correcto' (bien bloqueado) o 'error' (no era grosería). */
function revisar_bloqueo(array $d): void
{
    $admin = exigir_admin();
    $id = (int) ($d['id'] ?? 0);
    $veredicto = in_array($d['veredicto'] ?? '', ['correcto', 'error'], true) ? $d['veredicto'] : null;
    $s = db()->prepare('SELECT l.texto, u.correo FROM moderacion_log l JOIN usuarios u ON u.id = l.usuario_id WHERE l.id = ?');
    $s->execute([$id]);
    $fila = $s->fetch();
    if (!$fila) error_json('Ese bloqueo ya no existe', 404);
    db()->prepare('UPDATE moderacion_log SET veredicto = ?, revisado_por = ?, revisado_en = ? WHERE id = ?')
        ->execute([$veredicto, $veredicto ? $admin['correo'] : null, $veredicto ? ahora() : null, $id]);
    bitacora('comentario', 'revisar_bloqueo', $fila['correo'] . ': “' . mb_strimwidth($fila['texto'], 0, 60, '…') . '”',
        $veredicto === 'error' ? 'Error del filtro' : ($veredicto === 'correcto' ? 'Bien bloqueado' : 'Sin revisar'), $admin['id'], $admin['correo']);
    responder(['ok' => true]);
}

/** "Ana Lopez: “¿A qué hora empieza…”" para la bitácora. */
function resumen_comentario(int $id): string
{
    $s = db()->prepare('SELECT c.texto, u.nombre FROM avisos_comentarios c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ?');
    $s->execute([$id]);
    $c = $s->fetch();
    return $c ? $c['nombre'] . ': “' . mb_strimwidth($c['texto'], 0, 80, '…') . '”' : "Comentario #$id";
}
