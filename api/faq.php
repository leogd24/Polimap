<?php
/**
 * POLIMAP — GET /api/faq.php → preguntas frecuentes activas (asistente de Gabo)
 *
 * Campos del JSON: id, question, answer, keywords (arreglo), category,
 * buildingNumber (número o null), icon.
 * En la BD las palabras clave se guardan como "kardex,kárdex,historial";
 * aquí se convierten en arreglo.
 */
require __DIR__ . '/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

$filas = db()->query(
    'SELECT id, pregunta, respuesta, palabras_clave, categoria, edificio_number, icon
       FROM faq
      WHERE activo = 1
      ORDER BY id'
)->fetchAll();

$faq = array_map(function ($f) {
    // "a, b ,c" → ["a","b","c"] (sin espacios sobrantes ni vacíos)
    $palabras = array_values(array_filter(array_map('trim', explode(',', $f['palabras_clave']))));
    return [
        'id'             => (int) $f['id'],
        'question'       => $f['pregunta'],
        'answer'         => $f['respuesta'],
        'keywords'       => $palabras,
        'category'       => $f['categoria'],
        'buildingNumber' => int_o_null($f['edificio_number']),
        'icon'           => $f['icon'],
    ];
}, $filas);

responder($faq);
