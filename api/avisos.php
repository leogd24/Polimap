<?php
/**
 * POLIMAP — Avisos de la app (sección de Leo)
 *
 *   GET    /api/avisos.php           → avisos vigentes hoy (público, lo usa Inicio)
 *   GET    /api/avisos.php?todos=1   → todos, también los vencidos (admin)
 *   POST   /api/avisos.php           → crear aviso (admin)
 *   PATCH  /api/avisos.php           → editar aviso (admin)  (POST ?_method=PATCH)
 *   DELETE /api/avisos.php           → borrar aviso (admin)  (POST ?_method=DELETE)
 *
 * Campos del JSON: id, title, content, type, startDate, endDate (+ vigente en ?todos).
 * type: general | urgente | evento. Fechas: "AAAA-MM-DD".
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';

const TIPOS_AVISO = ['general', 'urgente', 'evento'];

switch (metodo_http()) {
    case 'GET':    empty($_GET['todos']) ? avisos_vigentes() : avisos_todos(); break;
    case 'POST':   guardar_aviso(null); break;
    case 'PATCH':  guardar_aviso((int) (leer_json()['id'] ?? 0)); break;
    case 'DELETE': borrar_aviso(); break;
    default:       error_json('Método no permitido', 405);
}

function avisos_vigentes(): void
{
    // Primero los urgentes y luego del más reciente al más viejo.
    $stmt = db()->prepare(
        "SELECT id, titulo, contenido, tipo, fecha_inicio, fecha_fin
           FROM avisos
          WHERE ? BETWEEN fecha_inicio AND fecha_fin
          ORDER BY (tipo = 'urgente') DESC, fecha_inicio DESC, id DESC"
    );
    $stmt->execute([date('Y-m-d')]);
    responder(array_map('aviso_json', $stmt->fetchAll()));
}

function avisos_todos(): void
{
    exigir_admin();
    $filas = db()->query(
        'SELECT id, titulo, contenido, tipo, fecha_inicio, fecha_fin FROM avisos ORDER BY fecha_fin DESC, id DESC'
    )->fetchAll();
    $hoy = date('Y-m-d');
    responder(array_map(fn ($a) => aviso_json($a) + [
        'vigente' => $a['fecha_inicio'] <= $hoy && $hoy <= $a['fecha_fin'],
    ], $filas));
}

function aviso_json(array $a): array
{
    return [
        'id'        => (int) $a['id'],
        'title'     => $a['titulo'],
        'content'   => $a['contenido'] ?? '',
        'type'      => $a['tipo'],
        'startDate' => $a['fecha_inicio'],
        'endDate'   => $a['fecha_fin'],
    ];
}

/** Crea (id null) o edita un aviso. Cuerpo JSON con title, content, type, startDate, endDate. */
function guardar_aviso(?int $id): void
{
    exigir_admin();
    $d = leer_json();

    $titulo    = trim((string) ($d['title'] ?? ''));
    $contenido = trim((string) ($d['content'] ?? ''));
    $tipo      = (string) ($d['type'] ?? 'general');
    $inicio    = (string) ($d['startDate'] ?? '');
    $fin       = (string) ($d['endDate'] ?? '');

    if (mb_strlen($titulo) < 3 || mb_strlen($titulo) > 150) error_json('El título debe tener de 3 a 150 caracteres');
    if (mb_strlen($contenido) > 2000) error_json('El contenido no puede pasar de 2000 caracteres');
    if (!in_array($tipo, TIPOS_AVISO, true)) error_json('Tipo no válido (general, urgente, evento)');
    if (!fecha_valida($inicio) || !fecha_valida($fin)) error_json('Las fechas deben ser AAAA-MM-DD');
    if ($fin < $inicio) error_json('La fecha final no puede ser antes de la inicial');

    $pdo = db();
    if ($id === null) {
        $pdo->prepare('INSERT INTO avisos (titulo, contenido, tipo, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?)')
            ->execute([$titulo, $contenido, $tipo, $inicio, $fin]);
        $id = (int) $pdo->lastInsertId();
        $codigo = 201;
    } else {
        $stmt = $pdo->prepare('UPDATE avisos SET titulo = ?, contenido = ?, tipo = ?, fecha_inicio = ?, fecha_fin = ? WHERE id = ?');
        $stmt->execute([$titulo, $contenido, $tipo, $inicio, $fin, $id]);
        $existe = $pdo->prepare('SELECT 1 FROM avisos WHERE id = ?');
        $existe->execute([$id]);
        if (!$existe->fetchColumn()) error_json('No existe ese aviso', 404);
        $codigo = 200;
    }
    responder(['ok' => true, 'id' => $id], $codigo);
}

function borrar_aviso(): void
{
    exigir_admin();
    $id = (int) (leer_json()['id'] ?? 0);
    $stmt = db()->prepare('DELETE FROM avisos WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) error_json('No existe ese aviso', 404);
    responder(['ok' => true]);
}

function fecha_valida(string $f): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $f);
    return $d && $d->format('Y-m-d') === $f;
}
