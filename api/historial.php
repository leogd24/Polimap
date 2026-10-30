<?php
/**
 * POLIMAP — Historial de cambios del panel (todo junto).   Responsable: Alexis
 *
 *   GET /api/historial.php?tipo=todo&quien=&desde=&hasta=&q=&pagina=0
 *
 * Junta dos fuentes, de la más nueva a la más vieja:
 *   - reportes_historial → cambios de reportes (estado, prioridad, comentario,
 *                           creado, "a mí también me pasa")
 *   - bitacora           → avisos, moderación de comentarios, accesos y
 *                           entradas al panel (api/bitacora.php)
 *
 * Filtros (todos opcionales):
 *   tipo   todo | reporte | aviso | comentario | acceso | sesion
 *   quien  id de usuario (admin), o "alumnos" (lo que hicieron los alumnos)
 *   desde, hasta  AAAA-MM-DD
 *   q      texto: folio, título, correo o detalle
 *   pagina 0, 1, 2… (60 por página)
 *
 * Responde:
 *   { items: [{ id, tipo, accion, objeto, detalle, antes, despues, folio, fecha,
 *               quien: { id, nombre, correo, foto } | null, correo }],
 *     hayMas, resumen: { hoy, semana, fallidosSemana, masActivo, porTipo },
 *     admins: [{ id, nombre, correo, foto }] }
 *
 * Privacidad (igual que antes): quien envió un reporte anónimo y quienes se
 * suman con "a mí también me pasa" no aparecen con nombre.
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';

const POR_PAGINA = 60;
const TIPOS_HISTORIAL = ['todo', 'reporte', 'aviso', 'comentario', 'acceso', 'sesion', 'perdido'];

exigir_admin();
if (metodo_http() !== 'GET') error_json('Método no permitido', 405);

$tipo   = in_array($_GET['tipo'] ?? 'todo', TIPOS_HISTORIAL, true) ? $_GET['tipo'] ?? 'todo' : 'todo';
$quien  = trim((string) ($_GET['quien'] ?? ''));
$desde  = fecha_o_null($_GET['desde'] ?? '');
$hasta  = fecha_o_null($_GET['hasta'] ?? '');
$q      = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 80);
$pagina = max(0, min(50, (int) ($_GET['pagina'] ?? 0)));
$cuantos = ($pagina + 1) * POR_PAGINA + 1; // uno de más para saber si "hay más"

$items = [];
if ($tipo === 'todo' || $tipo === 'reporte') $items = array_merge($items, de_reportes($quien, $desde, $hasta, $q, $cuantos));
if ($tipo !== 'reporte') $items = array_merge($items, de_bitacora($tipo, $quien, $desde, $hasta, $q, $cuantos));

// Más nuevo primero; si tienen la misma hora, el de id más alto primero.
usort($items, fn ($a, $b) => strcmp($b['fecha'], $a['fecha']) ?: strcmp($b['id'], $a['id']));
$pedazo = array_slice($items, $pagina * POR_PAGINA, POR_PAGINA + 1);

responder([
    'items'   => array_slice($pedazo, 0, POR_PAGINA),
    'hayMas'  => count($pedazo) > POR_PAGINA,
    'resumen' => $pagina === 0 ? resumen() : null,
    'admins'  => $pagina === 0 ? admins() : null,
]);

// ---------------------------------------------------------------------------

function fecha_o_null($f): ?string
{
    $d = DateTime::createFromFormat('Y-m-d', (string) $f);
    return $d && $d->format('Y-m-d') === $f ? $f : null;
}

function de_reportes(string $quien, ?string $desde, ?string $hasta, string $q, int $limite): array
{
    $donde = [];
    $params = [];
    if ($quien === 'alumnos') $donde[] = "h.accion IN ('creado', 'apoyo')";
    elseif ($quien !== '') {
        $donde[] = "h.usuario_id = ? AND h.accion NOT IN ('creado', 'apoyo')";
        $params[] = (int) $quien;
    }
    if ($desde) { $donde[] = 'h.creado_en >= ?'; $params[] = "$desde 00:00:00"; }
    if ($hasta) { $donde[] = 'h.creado_en <= ?'; $params[] = "$hasta 23:59:59"; }
    if ($q !== '') {
        $donde[] = '(r.folio LIKE ? OR h.valor_nuevo LIKE ? OR u.correo LIKE ? OR u.nombre LIKE ?)';
        array_push($params, "%$q%", "%$q%", "%$q%", "%$q%");
    }
    $sql = 'SELECT h.id, h.accion, h.valor_anterior, h.valor_nuevo, h.creado_en, r.folio, r.anonimo,
                   u.id AS uid, u.nombre, u.correo, u.foto
              FROM reportes_historial h
              JOIN reportes r ON r.id = h.reporte_id
              LEFT JOIN usuarios u ON u.id = h.usuario_id'
         . ($donde ? ' WHERE ' . implode(' AND ', $donde) : '')
         . ' ORDER BY h.creado_en DESC, h.id DESC LIMIT ' . (int) $limite;
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    return array_map(function ($h) {
        $oculto = ($h['accion'] === 'creado' && $h['anonimo']) || $h['accion'] === 'apoyo';
        return [
            'id'      => 'r' . str_pad((string) $h['id'], 10, '0', STR_PAD_LEFT),
            'tipo'    => 'reporte',
            'accion'  => $h['accion'],
            'objeto'  => $h['folio'],
            'folio'   => $h['folio'],
            'antes'   => $h['valor_anterior'],
            'despues' => $h['valor_nuevo'],
            'detalle' => null,
            'fecha'   => iso($h['creado_en']),
            'quien'   => ($oculto || !$h['correo']) ? null
                : ['id' => (int) $h['uid'], 'nombre' => $h['nombre'], 'correo' => $h['correo'], 'foto' => $h['foto']],
            'correo'  => null,
        ];
    }, $stmt->fetchAll());
}

function de_bitacora(string $tipo, string $quien, ?string $desde, ?string $hasta, string $q, int $limite): array
{
    $donde = [];
    $params = [];
    if ($tipo !== 'todo') { $donde[] = 'b.tipo = ?'; $params[] = $tipo; }
    if ($quien === 'alumnos') return [];             // la bitácora es solo del panel
    if ($quien !== '') { $donde[] = 'b.usuario_id = ?'; $params[] = (int) $quien; }
    if ($desde) { $donde[] = 'b.creado_en >= ?'; $params[] = "$desde 00:00:00"; }
    if ($hasta) { $donde[] = 'b.creado_en <= ?'; $params[] = "$hasta 23:59:59"; }
    if ($q !== '') {
        $donde[] = '(b.objeto LIKE ? OR b.detalle LIKE ? OR b.correo LIKE ? OR u.nombre LIKE ?)';
        array_push($params, "%$q%", "%$q%", "%$q%", "%$q%");
    }
    try {
        $stmt = db()->prepare(
            'SELECT b.id, b.tipo, b.accion, b.objeto, b.detalle, b.correo, b.creado_en,
                    u.id AS uid, u.nombre, u.correo AS ucorreo, u.foto
               FROM bitacora b LEFT JOIN usuarios u ON u.id = b.usuario_id'
            . ($donde ? ' WHERE ' . implode(' AND ', $donde) : '')
            . ' ORDER BY b.creado_en DESC, b.id DESC LIMIT ' . (int) $limite
        );
        $stmt->execute($params);
    } catch (Throwable $e) {
        return []; // falta importar sql/polimap.sql
    }
    return array_map(fn ($b) => [
        'id'      => 'b' . str_pad((string) $b['id'], 10, '0', STR_PAD_LEFT),
        'tipo'    => $b['tipo'],
        'accion'  => $b['accion'],
        'objeto'  => $b['objeto'],
        'folio'   => null,
        'antes'   => null,
        'despues' => null,
        'detalle' => $b['detalle'],
        'fecha'   => iso($b['creado_en']),
        'quien'   => $b['uid'] ? ['id' => (int) $b['uid'], 'nombre' => $b['nombre'], 'correo' => $b['ucorreo'], 'foto' => $b['foto']] : null,
        'correo'  => $b['correo'], // para intentos de entrada sin cuenta
    ], $stmt->fetchAll());
}

/** Números de arriba: movimientos de hoy y de la semana, intentos fallidos y el admin más activo. */
function resumen(): array
{
    $pdo = db();
    $hoy = date('Y-m-d') . ' 00:00:00';
    $semana = ahora(-7 * 86400);
    $contar = function (string $sql, array $p) use ($pdo) {
        try {
            $s = $pdo->prepare($sql);
            $s->execute($p);
            return (int) $s->fetchColumn();
        } catch (Throwable $e) {
            return 0;
        }
    };
    $porTipo = ['reporte' => $contar('SELECT COUNT(*) FROM reportes_historial WHERE creado_en >= ?', [$semana])];
    foreach (['aviso', 'comentario', 'acceso', 'sesion', 'perdido'] as $t) {
        $porTipo[$t] = $contar('SELECT COUNT(*) FROM bitacora WHERE tipo = ? AND creado_en >= ?', [$t, $semana]);
    }

    // Admin más activo de la semana (cambios en reportes + bitácora, sin contar entradas).
    $activos = [];
    $s = $pdo->prepare("SELECT usuario_id, COUNT(*) AS n FROM reportes_historial WHERE creado_en >= ? AND usuario_id IS NOT NULL AND accion NOT IN ('creado', 'apoyo') GROUP BY usuario_id");
    $s->execute([$semana]);
    foreach ($s->fetchAll() as $f) $activos[(int) $f['usuario_id']] = (int) $f['n'];
    try {
        $s = $pdo->prepare("SELECT usuario_id, COUNT(*) AS n FROM bitacora WHERE creado_en >= ? AND usuario_id IS NOT NULL AND tipo <> 'sesion' GROUP BY usuario_id");
        $s->execute([$semana]);
        foreach ($s->fetchAll() as $f) $activos[(int) $f['usuario_id']] = ($activos[(int) $f['usuario_id']] ?? 0) + (int) $f['n'];
    } catch (Throwable $e) {
    }
    arsort($activos);
    $masActivo = null;
    if ($activos) {
        $id = array_key_first($activos);
        $u = $pdo->prepare('SELECT id, nombre, correo, foto FROM usuarios WHERE id = ?');
        $u->execute([$id]);
        if ($fila = $u->fetch()) $masActivo = ['id' => (int) $fila['id'], 'nombre' => $fila['nombre'], 'correo' => $fila['correo'], 'foto' => $fila['foto'], 'cambios' => $activos[$id]];
    }

    return [
        'hoy'            => $contar('SELECT COUNT(*) FROM reportes_historial WHERE creado_en >= ?', [$hoy])
                          + $contar("SELECT COUNT(*) FROM bitacora WHERE creado_en >= ? AND tipo <> 'sesion'", [$hoy]),
        'semana'         => array_sum($porTipo) - $porTipo['sesion'],
        'fallidosSemana' => $contar("SELECT COUNT(*) FROM bitacora WHERE tipo = 'sesion' AND accion IN ('clave_incorrecta', 'bloqueo') AND creado_en >= ?", [$semana]),
        'masActivo'      => $masActivo,
        'porTipo'        => $porTipo,
    ];
}

/** Admins (para el filtro "Quién"): los de la lista de accesos que ya entraron alguna vez. */
function admins(): array
{
    $filas = db()->query(
        "SELECT u.id, u.nombre, u.correo, u.foto
           FROM accesos a JOIN usuarios u ON u.correo = a.correo
          WHERE a.rol IN ('maestro', 'admin')
          ORDER BY u.nombre"
    )->fetchAll();
    return array_map(fn ($u) => ['id' => (int) $u['id'], 'nombre' => $u['nombre'], 'correo' => $u['correo'], 'foto' => $u['foto']], $filas);
}
