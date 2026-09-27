<?php
/**
 * POLIMAP — GET /api/avisos.php → avisos vigentes (sección de Leo)
 *
 * Solo regresa los que están vigentes hoy (entre fecha_inicio y fecha_fin),
 * primero los urgentes y luego del más reciente al más viejo.
 * Campos del JSON: id, title, content, type, startDate, endDate.
 */
require __DIR__ . '/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

$filas = db()->query(
    "SELECT id, titulo, contenido, tipo, fecha_inicio, fecha_fin
       FROM avisos
      WHERE CURDATE() BETWEEN fecha_inicio AND fecha_fin
      ORDER BY (tipo = 'urgente') DESC, fecha_inicio DESC, id DESC"
)->fetchAll();

responder(array_map(fn ($a) => [
    'id'        => (int) $a['id'],
    'title'     => $a['titulo'],
    'content'   => $a['contenido'] ?? '',
    'type'      => $a['tipo'],
    'startDate' => $a['fecha_inicio'],
    'endDate'   => $a['fecha_fin'],
], $filas));
