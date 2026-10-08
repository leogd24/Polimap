<?php
/**
 * POLIMAP — Conexión a MySQL y funciones comunes de la API.
 *
 * Todos los endpoints (edificios.php, faq.php, reportes.php, avisos.php,
 * auth.php, accesos.php) empiezan con:  require __DIR__ . '/database.php';
 *
 * Aquí vive lo que se repite:
 *   - leer config.php
 *   - encabezados JSON y CORS
 *   - conectar con PDO (consultas preparadas = protección contra inyección SQL)
 *   - responder JSON y errores con el mismo formato
 */

// 1) Configuración ------------------------------------------------------
if (!file_exists(__DIR__ . '/config.php')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Falta api/config.php (copia config.example.php)'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
$CONFIG = require __DIR__ . '/config.php';
date_default_timezone_set('America/Mexico_City'); // hora de Guadalajara

// 2) Encabezados: siempre respondemos JSON en UTF-8 -----------------------
header('Content-Type: application/json; charset=utf-8');

// CORS: solo dejamos pasar los orígenes de la lista en config.php.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $CONFIG['cors_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true'); // deja pasar la cookie de sesión
}
// El navegador manda un OPTIONS antes de PATCH/POST con JSON: se contesta vacío.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Protección extra (CSRF): si una petición que CAMBIA datos trae Origin,
// tiene que venir de este mismo sitio o de la lista de cors_origins.
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true) && $origin !== '') {
    $mismoSitio = parse_url($origin, PHP_URL_HOST) === parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
    if (!$mismoSitio && !in_array($origin, $CONFIG['cors_origins'], true)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Origen no permitido'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// 3) Respuestas -----------------------------------------------------------

/** Manda un JSON y termina el script. */
function responder($datos, int $codigo = 200): void
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Manda un error con el formato del contrato: { ok: false, error: "..." } */
function error_json(string $mensaje, int $codigo = 400): void
{
    responder(['ok' => false, 'error' => $mensaje], $codigo);
}

// 4) Conexión PDO ---------------------------------------------------------

/** Regresa la conexión (la crea una sola vez por petición). */
function db(): PDO
{
    global $CONFIG;
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $CONFIG['db_host'], $CONFIG['db_port'], $CONFIG['db_name']
    );
    try {
        $pdo = new PDO($dsn, $CONFIG['db_user'], $CONFIG['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // errores como excepciones
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // filas como arreglo asociativo
            PDO::ATTR_EMULATE_PREPARES   => false,                  // consultas preparadas reales
        ]);
        $pdo->exec("SET time_zone = '-06:00'"); // MySQL también en hora de Guadalajara
        
    } catch (PDOException $e) {
        // No mostramos el detalle al usuario (puede traer la contraseña o la ruta).
        error_log('POLIMAP DB: ' . $e->getMessage());
        error_json('No se pudo conectar a la base de datos', 500);
    }
    return $pdo;
}

// 5) Ayudantes para convertir tipos --------------------------------------
// MySQL regresa DECIMAL como texto; en el JSON queremos números o null.
function num_o_null($v): ?float { return $v === null ? null : (float) $v; }
function int_o_null($v): ?int   { return $v === null ? null : (int) $v; }

/** Convierte "2026-10-05 10:30:00" a ISO "2026-10-05T10:30:00". */
function iso($fecha): ?string { return $fecha === null ? null : str_replace(' ', 'T', $fecha); }

/** Fecha y hora actual de Guadalajara, lista para MySQL ("2026-10-07 13:05:00"). */
function ahora(int $sumarSegundos = 0): string { return date('Y-m-d H:i:s', time() + $sumarSegundos); }

// 6) Método HTTP ----------------------------------------------------------
// Algunos hostings gratuitos bloquean PATCH y DELETE. Por eso el frontend
// manda POST ?_method=PATCH (o DELETE) y aquí lo tratamos como el real.
function metodo_http(): string
{
    $metodo = $_SERVER['REQUEST_METHOD'];
    $forzado = strtoupper($_GET['_method'] ?? '');
    if ($metodo === 'POST' && in_array($forzado, ['PATCH', 'DELETE'], true)) {
        return $forzado;
    }
    return $metodo;
}

/** Lee el cuerpo JSON de la petición como arreglo (vacío si no hay). */
function leer_json(): array
{
    $datos = json_decode(file_get_contents('php://input'), true);
    return is_array($datos) ? $datos : [];
}

