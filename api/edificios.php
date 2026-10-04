<?php
/**
 * POLIMAP — GET /api/edificios.php          → todos los edificios
 *           GET /api/edificios.php?number=1 → un solo edificio
 *
 * Regresa los MISMOS campos que src/data/campusBuildings.js
 * (number, name, summary, description, services, spaces, hours,
 *  accessibility, icon, color, procedures) + lat, lng, entrance, photo.
 *
 * Paso a paso:
 *   1. Lee los edificios.
 *   2. Lee espacios, servicios y trámites de una vez (3 consultas, no 30).
 *   3. Los acomoda dentro de cada edificio como arreglos.
 */
require __DIR__ . '/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

$pdo = db();

// 1) Edificios (todos o uno) ---------------------------------------------
if (isset($_GET['number'])) {
    $numero = filter_var($_GET['number'], FILTER_VALIDATE_INT);
    if ($numero === false) error_json('El número de edificio no es válido');
    $stmt = $pdo->prepare('SELECT * FROM edificios WHERE number = ?');
    $stmt->execute([$numero]);
} else {
    $stmt = $pdo->query('SELECT * FROM edificios ORDER BY number');
}
$filas = $stmt->fetchAll();

if (isset($_GET['number']) && !$filas) {
    error_json('No existe ese edificio', 404);
}

// 2) Listas hijas, agrupadas por número de edificio -----------------------
$espacios  = [];
$servicios = [];
$tramites  = [];

foreach ($pdo->query('SELECT edificio_number, nombre FROM espacios ORDER BY edificio_number, orden, id') as $f) {
    $espacios[$f['edificio_number']][] = $f['nombre'];
}
foreach ($pdo->query('SELECT edificio_number, nombre FROM servicios ORDER BY edificio_number, orden, id') as $f) {
    $servicios[$f['edificio_number']][] = $f['nombre'];
}
foreach ($pdo->query('SELECT edificio_number, nombre, detalles FROM tramites ORDER BY edificio_number, orden, id') as $f) {
    $tramites[$f['edificio_number']][] = ['name' => $f['nombre'], 'details' => $f['detalles'] ?? ''];
}

// 3) Armar cada edificio con los nombres de campusBuildings.js -------------
$edificios = array_map(function ($e) use ($espacios, $servicios, $tramites) {
    $n = (int) $e['number'];
    return [
        'number'        => $n,
        'name'          => $e['name'],
        'summary'       => $e['summary'],
        'description'   => $e['description'] ?? '',
        'services'      => $servicios[$n] ?? [],
        'spaces'        => $espacios[$n] ?? [],
        'hours'         => $e['hours'],
        'accessibility' => $e['accessibility'],
        'icon'          => $e['icon'],
        'color'         => $e['color'],            // clave de theme.js; api.js la convierte
        'lat'           => num_o_null($e['lat']),
        'lng'           => num_o_null($e['lng']),
        'entrance'      => $e['entrance_lat'] === null ? null : [
            'lat' => (float) $e['entrance_lat'],
            'lng' => (float) $e['entrance_lng'],
        ],
        'photo'         => $e['foto'],
        'procedures'    => $tramites[$n] ?? [],
    ];
}, $filas);

responder(isset($_GET['number']) ? $edificios[0] : $edificios);
