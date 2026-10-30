<?php
/**
 * POLIMAP — Calendario del grupo (exámenes y entregas), consejales y encuadres.
 * Responsable: Alexis. Ver docs/calendario-calificaciones.md.
 *
 * Alumnos (cualquiera puede LEER; solo el consejal y el subconsejal del grupo PUBLICAN):
 *   GET  /api/calendario.php?grupo=1AM%20TIN
 *        → { fechas, encuadres, consejales, puedoPublicar, miRol }
 *          fechas: de hace 7 días en adelante, en orden.
 *   GET  /api/calendario.php?mios=1        → { grupos: [{ grupo, rol }] } donde soy consejal
 *   POST { accion: 'fecha', id?, grupo, tipo, materia, titulo, detalle, fecha, hora, notificar }
 *        crea (sin id) o edita. Al crear (y con notificar) manda notificación a los
 *        celulares que eligieron ese grupo en Horario.
 *   POST { accion: 'borrar', id }
 *   POST { accion: 'encuadre', grupo, materia, criterios: [{nombre, porcentaje}], asistenciaMin }
 *        criterios vacío = borrar el encuadre de esa materia.
 *
 * Panel (admin):
 *   GET  /api/calendario.php?consejales=1  → { consejales: [{ grupo, correo, rol, nombre, foto, entro }] }
 *   POST { accion: 'asignar', grupo, correo, rol, reemplazar? }   rol: consejal | subconsejal
 *        Cada grupo tiene un DUETO: un consejal y un subconsejal. Si ese lugar ya
 *        está ocupado responde 409 con { ocupado } y hay que mandar reemplazar: true.
 *        Un alumno solo puede estar en un grupo: si ya estaba en otro, se mueve.
 *   POST { accion: 'quitar',  grupo, correo }
 *   (las dos quedan en Historial → Accesos)
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';
require __DIR__ . '/moderacion.php';
require __DIR__ . '/bitacora.php';
require __DIR__ . '/webpush.php';
require __DIR__ . '/audiencia.php';

// (Las constantes van ANTES del switch: PHP las define al ejecutar esa línea.)
const TIPOS_FECHA = ['examen', 'entrega', 'exposicion', 'practica', 'otro'];
const NOMBRE_TIPO = ['examen' => 'Examen', 'entrega' => 'Entrega', 'exposicion' => 'Exposición', 'practica' => 'Práctica', 'otro' => 'Fecha'];
const ROLES_CONSEJAL = ['consejal', 'subconsejal'];
const NOMBRE_ROL = ['consejal' => 'consejal', 'subconsejal' => 'subconsejal'];
const FECHAS_POR_DIA = 20;     // por consejal, para evitar abusos
const MAX_CRITERIOS = 12;

switch (metodo_http()) {
    case 'GET':
        if (!empty($_GET['consejales'])) listar_consejales();
        if (!empty($_GET['mios'])) mis_grupos();
        calendario_del_grupo();
        break;
    case 'POST':
        $d = leer_json();
        switch ($d['accion'] ?? '') {
            case 'fecha':    guardar_fecha($d); break;
            case 'borrar':   borrar_fecha($d); break;
            case 'encuadre': guardar_encuadre($d); break;
            case 'asignar':  asignar_consejal($d); break;
            case 'quitar':   quitar_consejal($d); break;
            default: error_json('Acción no válida');
        }
        break;
    default: error_json('Método no permitido', 405);
}

// ---------------------------------------------------------------------------
// Quién puede publicar
// ---------------------------------------------------------------------------

/** Consejal/subconsejal del grupo o admin; si no, corta con 403. */
function exigir_publicar(string $grupo): array
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión para publicar fechas', 401);
    if ($u['permisos']['admin'] || rol_en_grupo($u, $grupo)) return $u;
    error_json("Solo los consejales de $grupo pueden publicar fechas. Pide a la coordinación que te designe.", 403);
}

function grupo_requerido($v): string
{
    $g = grupo_o_null($v);
    if (!$g) error_json('Grupo no válido (ej. 1AM TIN)');
    return $g;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function fecha_json(array $f, ?array $u): array
{
    return [
        'id'        => (int) $f['id'],
        'grupo'     => $f['grupo'],
        'tipo'      => $f['tipo'],
        'materia'   => $f['materia'] ?? '',
        'titulo'    => $f['titulo'],
        'detalle'   => $f['detalle'] ?? '',
        'fecha'     => $f['fecha'],
        'hora'      => $f['hora'] ?: null,
        'por'       => $u ? ($f['nombre'] ?? null) : null,   // el nombre solo con sesión
        'creadoEn'  => iso($f['creado_en']),
        'editadoEn' => iso($f['editado_en']),
    ];
}

function calendario_del_grupo(): void
{
    $grupo = grupo_requerido($_GET['grupo'] ?? '');
    $u = usuario_actual();
    $pdo = db();

    $s = $pdo->prepare(
        'SELECT f.*, u.nombre FROM grupo_fechas f LEFT JOIN usuarios u ON u.id = f.usuario_id
         WHERE f.grupo = ? AND f.fecha >= ? ORDER BY f.fecha, COALESCE(f.hora, \'99:99\'), f.id LIMIT 150'
    );
    $s->execute([$grupo, date('Y-m-d', time() - 7 * 86400)]);
    $fechas = array_map(fn ($f) => fecha_json($f, $u), $s->fetchAll());

    $s = $pdo->prepare('SELECT e.*, u.nombre FROM grupo_encuadres e LEFT JOIN usuarios u ON u.id = e.usuario_id WHERE e.grupo = ? ORDER BY e.materia');
    $s->execute([$grupo]);
    $encuadres = array_map(fn ($e) => [
        'materia'       => $e['materia'],
        'criterios'     => json_decode($e['criterios'], true) ?: [],
        'asistenciaMin' => (int) $e['asistencia_min'],
        'actualizadoEn' => iso($e['actualizado_en']),
        'por'           => $u ? ($e['nombre'] ?? null) : null,
    ], $s->fetchAll());

    // Consejales: el nombre solo con sesión (nunca el correo).
    $s = $pdo->prepare('SELECT c.rol, u.nombre, u.foto FROM grupo_consejales c LEFT JOIN usuarios u ON u.correo = c.correo WHERE c.grupo = ? ORDER BY (c.rol = \'consejal\') DESC, u.nombre');
    $s->execute([$grupo]);
    $consejales = $u ? array_map(fn ($c) => ['rol' => $c['rol'], 'nombre' => $c['nombre'] ?: 'Aún no entra a la app', 'foto' => $c['foto']], $s->fetchAll()) : [];

    $rol = rol_en_grupo($u, $grupo);
    responder([
        'grupo'         => $grupo,
        'fechas'        => $fechas,
        'encuadres'     => $encuadres,
        'consejales'    => $consejales,
        'miRol'         => $rol,
        'puedoPublicar' => $u !== null && ($rol !== null || $u['permisos']['admin']),
    ]);
}

function mis_grupos(): void
{
    $u = usuario_actual();
    if (!$u) responder(['grupos' => []]);
    $s = db()->prepare('SELECT grupo, rol FROM grupo_consejales WHERE correo = ? ORDER BY grupo');
    $s->execute([strtolower($u['correo'])]);
    responder(['grupos' => $s->fetchAll()]);
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

function texto_limpio($v, int $max, string $campo, bool $requerido = false): ?string
{
    $t = trim(preg_replace('/\s+/u', ' ', (string) ($v ?? '')));
    if ($t === '') {
        if ($requerido) error_json("Falta $campo");
        return null;
    }
    if (mb_strlen($t) > $max) error_json(ucfirst($campo) . " puede tener hasta $max caracteres");
    return $t;
}

function guardar_fecha(array $d): void
{
    $id = (int) ($d['id'] ?? 0);
    $pdo = db();
    if ($id) {
        // Al editar, el grupo es el de la fecha guardada (no se puede mover a otro grupo).
        $s = $pdo->prepare('SELECT grupo FROM grupo_fechas WHERE id = ?');
        $s->execute([$id]);
        $grupo = $s->fetchColumn();
        if ($grupo === false) error_json('Esa fecha ya no existe', 404);
    } else {
        $grupo = grupo_requerido($d['grupo'] ?? '');
    }
    $u = exigir_publicar($grupo);

    $tipo = in_array($d['tipo'] ?? '', TIPOS_FECHA, true) ? $d['tipo'] : 'examen';
    $titulo = texto_limpio($d['titulo'] ?? '', 120, 'el título', true);
    $materia = texto_limpio($d['materia'] ?? '', 120, 'la materia');
    $detalle = texto_limpio($d['detalle'] ?? '', 500, 'el detalle');
    $fecha = (string) ($d['fecha'] ?? '');
    $f = DateTime::createFromFormat('Y-m-d', $fecha);
    if (!$f || $f->format('Y-m-d') !== $fecha) error_json('La fecha debe ser AAAA-MM-DD');
    if ($fecha < date('Y-m-d', time() - 7 * 86400) || $fecha > date('Y-m-d', time() + 200 * 86400)) error_json('La fecha debe estar dentro del semestre');
    $hora = trim((string) ($d['hora'] ?? ''));
    if ($hora === '') $hora = null;
    elseif (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $hora)) error_json('La hora debe ser HH:MM');

    // Mismo filtro y pausa que lo demás público (api/moderacion.php).
    if (!$u['permisos']['admin'] && ($pausa = pausa_de($u['id'], 'publicaciones'))) error_json($pausa, 403);
    $texto = implode(' · ', array_filter([$titulo, $detalle]));
    $revision = moderar_texto($texto);
    if (!$revision['ok']) {
        $extra = registrar_bloqueo($u['id'], null, 'fecha', "[$grupo] $texto", $revision['motivo']);
        error_json(mensaje_moderacion_general($revision['mensaje']) . $extra, 422);
    }

    if ($id) {
        $pdo->prepare('UPDATE grupo_fechas SET tipo = ?, materia = ?, titulo = ?, detalle = ?, fecha = ?, hora = ?, editado_en = ? WHERE id = ?')
            ->execute([$tipo, $materia, $titulo, $detalle, $fecha, $hora, ahora(), $id]);
    } else {
        $c = $pdo->prepare('SELECT COUNT(*) FROM grupo_fechas WHERE usuario_id = ? AND creado_en > ?');
        $c->execute([$u['id'], ahora(-86400)]);
        if ((int) $c->fetchColumn() >= FECHAS_POR_DIA) error_json('Llegaste al máximo de ' . FECHAS_POR_DIA . ' fechas por día.', 429);
        $pdo->prepare('INSERT INTO grupo_fechas (grupo, tipo, materia, titulo, detalle, fecha, hora, usuario_id, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$grupo, $tipo, $materia, $titulo, $detalle, $fecha, $hora, $u['id'], ahora()]);
        $id = (int) $pdo->lastInsertId();
    }

    // Notificación al grupo (solo al crear, o al editar si lo piden).
    $push = null;
    if (!empty($d['notificar'])) {
        try {
            $cuando = fecha_bonita($fecha) . ($hora ? " a las $hora" : '');
            $push = push_a_suscritos([
                'title' => "$grupo · " . NOMBRE_TIPO[$tipo] . (empty($d['id']) ? '' : ' (cambió)'),
                'body'  => ($materia ? mb_convert_case(mb_strtolower($materia), MB_CASE_TITLE) . ': ' : '') . "$titulo — $cuando",
                'url'   => '/?tab=horario&vista=fechas',
                'tag'   => "polimap-fecha-$id",
            ], null, $grupo);
        } catch (Throwable $e) {
            error_log('POLIMAP push calendario: ' . $e->getMessage());
            $push = ['error' => 'No se pudo mandar la notificación'];
        }
    }

    $s = $pdo->prepare('SELECT f.*, u.nombre FROM grupo_fechas f LEFT JOIN usuarios u ON u.id = f.usuario_id WHERE f.id = ?');
    $s->execute([$id]);
    responder(['ok' => true, 'fecha' => fecha_json($s->fetch(), $u), 'push' => $push], empty($d['id']) ? 201 : 200);
}

/** "jueves 5 de noviembre" (sin depender del idioma del servidor). */
function fecha_bonita(string $ymd): string
{
    $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $t = strtotime($ymd . ' 12:00:00');
    return $dias[(int) date('w', $t)] . ' ' . (int) date('j', $t) . ' de ' . $meses[(int) date('n', $t)];
}

function borrar_fecha(array $d): void
{
    $id = (int) ($d['id'] ?? 0);
    $s = db()->prepare('SELECT grupo FROM grupo_fechas WHERE id = ?');
    $s->execute([$id]);
    $grupo = $s->fetchColumn();
    if ($grupo === false) error_json('Esa fecha ya no existe', 404);
    exigir_publicar($grupo);
    db()->prepare('DELETE FROM grupo_fechas WHERE id = ?')->execute([$id]);
    responder(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Encuadres (para la calculadora)
// ---------------------------------------------------------------------------

function guardar_encuadre(array $d): void
{
    $grupo = grupo_requerido($d['grupo'] ?? '');
    $u = exigir_publicar($grupo);
    $materia = texto_limpio($d['materia'] ?? '', 120, 'la materia', true);
    $pdo = db();

    $lista = is_array($d['criterios'] ?? null) ? $d['criterios'] : [];
    if (!$lista) {
        $pdo->prepare('DELETE FROM grupo_encuadres WHERE grupo = ? AND materia = ?')->execute([$grupo, $materia]);
        responder(['ok' => true, 'borrado' => true]);
    }
    if (count($lista) > MAX_CRITERIOS) error_json('Máximo ' . MAX_CRITERIOS . ' criterios');
    $criterios = [];
    $suma = 0;
    foreach ($lista as $c) {
        $nombre = texto_limpio($c['nombre'] ?? '', 40, 'el nombre del criterio', true);
        $pct = (int) round((float) ($c['porcentaje'] ?? 0));
        if ($pct < 1 || $pct > 100) error_json("El porcentaje de \"$nombre\" debe ser de 1 a 100");
        $criterios[] = ['nombre' => $nombre, 'porcentaje' => $pct];
        $suma += $pct;
    }
    if ($suma !== 100) error_json("Los porcentajes deben sumar 100 (ahora suman $suma)");
    $asistencia = (int) ($d['asistenciaMin'] ?? 80);
    if ($asistencia < 50 || $asistencia > 100) error_json('La asistencia mínima debe ser de 50 a 100 %');

    $json = json_encode($criterios, JSON_UNESCAPED_UNICODE);
    $pdo->prepare('DELETE FROM grupo_encuadres WHERE grupo = ? AND materia = ?')->execute([$grupo, $materia]);
    $pdo->prepare('INSERT INTO grupo_encuadres (grupo, materia, criterios, asistencia_min, usuario_id, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$grupo, $materia, $json, $asistencia, $u['id'], ahora()]);
    responder(['ok' => true, 'encuadre' => ['materia' => $materia, 'criterios' => $criterios, 'asistenciaMin' => $asistencia, 'actualizadoEn' => iso(ahora()), 'por' => $u['nombre']]]);
}

// ---------------------------------------------------------------------------
// Consejales (panel)
// ---------------------------------------------------------------------------

function listar_consejales(): void
{
    exigir_admin();
    $s = db()->query(
        'SELECT c.grupo, c.correo, c.rol, c.creado_en, u.nombre, u.foto, u.id AS uid
         FROM grupo_consejales c LEFT JOIN usuarios u ON u.correo = c.correo ORDER BY c.grupo, (c.rol = \'consejal\') DESC, c.correo'
    );
    responder(['consejales' => array_map(fn ($c) => [
        'grupo'    => $c['grupo'],
        'correo'   => $c['correo'],
        'rol'      => $c['rol'],
        'nombre'   => $c['nombre'],
        'foto'     => $c['foto'],
        'entro'    => $c['uid'] !== null,     // ¿ya inició sesión en la app alguna vez?
        'creadoEn' => iso($c['creado_en']),
    ], $s->fetchAll())]);
}

function asignar_consejal(array $d): void
{
    $admin = exigir_admin();
    $grupo = grupo_requerido($d['grupo'] ?? '');
    $correo = strtolower(trim((string) ($d['correo'] ?? '')));
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) error_json('Escribe un correo válido');
    if (!permisos_de($correo)['app']) error_json('Ese correo no puede entrar a la app (usa el @alumnos.udg.mx del alumno)');
    $rol = in_array($d['rol'] ?? '', ROLES_CONSEJAL, true) ? $d['rol'] : 'consejal';
    $pdo = db();

    // ¿Ese lugar del dueto ya tiene a alguien? Se pregunta antes de reemplazar.
    $s = $pdo->prepare('SELECT c.correo, u.nombre FROM grupo_consejales c LEFT JOIN usuarios u ON u.correo = c.correo WHERE c.grupo = ? AND c.rol = ? AND c.correo <> ?');
    $s->execute([$grupo, $rol, $correo]);
    $ocupado = $s->fetch();
    if ($ocupado && empty($d['reemplazar'])) {
        responder([
            'ok'      => false,
            'error'   => "$grupo ya tiene " . NOMBRE_ROL[$rol] . ': ' . ($ocupado['nombre'] ?: $ocupado['correo']) . '.',
            'ocupado' => ['correo' => $ocupado['correo'], 'nombre' => $ocupado['nombre']],
        ], 409);
    }

    // ¿Ya estaba en otro grupo o en otro lugar? Un alumno solo tiene un lugar.
    $s = $pdo->prepare('SELECT grupo, rol FROM grupo_consejales WHERE correo = ?');
    $s->execute([$correo]);
    $antes = $s->fetch() ?: null;

    $pdo->beginTransaction();
    if ($ocupado) $pdo->prepare('DELETE FROM grupo_consejales WHERE grupo = ? AND rol = ?')->execute([$grupo, $rol]);
    $pdo->prepare('DELETE FROM grupo_consejales WHERE correo = ?')->execute([$correo]);
    $pdo->prepare('INSERT INTO grupo_consejales (grupo, correo, rol, asignado_por, creado_en) VALUES (?, ?, ?, ?, ?)')
        ->execute([$grupo, $correo, $rol, $admin['id'], ahora()]);
    $pdo->commit();

    $detalle = "$grupo · " . NOMBRE_ROL[$rol];
    if ($ocupado) $detalle .= ' (reemplaza a ' . $ocupado['correo'] . ')';
    if ($antes && $antes['grupo'] !== $grupo) $detalle .= ' (antes en ' . $antes['grupo'] . ')';
    bitacora('acceso', 'consejal', $correo, $detalle, $admin['id'], $admin['correo']);
    responder(['ok' => true, 'antes' => $antes, 'reemplazado' => $ocupado ? $ocupado['correo'] : null], 201);
}

function quitar_consejal(array $d): void
{
    $admin = exigir_admin();
    $grupo = grupo_requerido($d['grupo'] ?? '');
    $correo = strtolower(trim((string) ($d['correo'] ?? '')));
    db()->prepare('DELETE FROM grupo_consejales WHERE grupo = ? AND correo = ?')->execute([$grupo, $correo]);
    bitacora('acceso', 'quitar_consejal', $correo, $grupo, $admin['id'], $admin['correo']);
    responder(['ok' => true]);
}
