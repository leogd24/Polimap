<?php
/**
 * POLIMAP — Notificaciones push en el celular.   Responsable: Alexis
 *
 *   GET  /api/push.php?clave=1    → { publicKey }  llave pública VAPID (la pide la app al activar)
 *   GET  /api/push.php?estado=1   → { suscritos, misDispositivos, activo }  (admin)
 *   POST /api/push.php  { accion: 'suscribir', subscription: { endpoint, keys: { p256dh, auth } }, grupo }
 *                       grupo (opcional) = el de Horario: para avisarle las fechas de exámenes
 *                       de SU grupo (api/calendario.php).
 *   POST /api/push.php  { accion: 'cancelar',  endpoint }
 *   POST /api/push.php  { accion: 'probar' }   → manda una notificación de prueba a
 *                                               los celulares del admin que la pide
 *
 * Cualquiera puede activar las notificaciones (alumnos, invitados y familias):
 * los avisos de la app son públicos. Si hay sesión, se guarda de quién es
 * para poder mandarle la prueba.
 *
 * El envío de los avisos lo hace api/avisos.php (al guardar con "notificar").
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';
require __DIR__ . '/webpush.php';

switch (metodo_http()) {
    case 'GET':
        if (!empty($_GET['clave'])) llave_publica();
        elseif (!empty($_GET['estado'])) estado_push();
        else error_json('Falta ?clave=1 o ?estado=1');
        break;
    case 'POST':
        $d = leer_json();
        switch ($d['accion'] ?? '') {
            case 'suscribir': suscribir($d); break;
            case 'cancelar':  cancelar($d); break;
            case 'probar':    probar(); break;
            default:          error_json('Acción no válida');
        }
        break;
    default:
        error_json('Método no permitido', 405);
}

function llave_publica(): void
{
    if (!push_config()['activo']) error_json('Las notificaciones están apagadas en el servidor', 503);
    try {
        responder(['publicKey' => push_vapid()['publica']]);
    } catch (Throwable $e) {
        error_log('POLIMAP push: ' . $e->getMessage());
        error_json('El servidor no pudo preparar las notificaciones', 500);
    }
}

function estado_push(): void
{
    $admin = exigir_admin();
    $pdo = db();
    $total = (int) $pdo->query('SELECT COUNT(*) FROM push_suscripciones')->fetchColumn();
    $mios = $pdo->prepare('SELECT COUNT(*) FROM push_suscripciones WHERE usuario_id = ?');
    $mios->execute([$admin['id']]);
    responder([
        'activo'          => push_config()['activo'],
        'suscritos'       => $total,
        'misDispositivos' => (int) $mios->fetchColumn(),
    ]);
}

function suscribir(array $d): void
{
    $s = $d['subscription'] ?? [];
    $endpoint = trim((string) ($s['endpoint'] ?? ''));
    $p256dh   = trim((string) ($s['keys']['p256dh'] ?? ''));
    $auth     = trim((string) ($s['keys']['auth'] ?? ''));

    if ($endpoint === '' || strlen($endpoint) > 600 || !push_endpoint_valido($endpoint)) {
        error_json('La suscripción no es válida');
    }
    // Las llaves deben medir lo que dice el estándar (65 y 16 bytes).
    $llave = push_b64d($p256dh);
    if (strlen($llave) !== 65 || $llave[0] !== "\x04" || strlen(push_b64d($auth)) !== 16) {
        error_json('Las llaves de la suscripción no son válidas');
    }

    $usuario = usuario_actual();
    $hash = hash('sha256', $endpoint);
    $pdo = db();
    // Si ya existía (mismo celular), se reemplaza.
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?')->execute([$hash]);
    $pdo->prepare(
        'INSERT INTO push_suscripciones (endpoint, endpoint_hash, p256dh, auth, usuario_id, creado_en)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$endpoint, $hash, $p256dh, $auth, $usuario['id'] ?? null, ahora()]);
    // El grupo va aparte: si la base es vieja (sin la columna grupo), lo demás sigue funcionando.
    try {
        $pdo->prepare('UPDATE push_suscripciones SET grupo = ? WHERE endpoint_hash = ?')->execute([grupo_o_null($d['grupo'] ?? null), $hash]);
    } catch (Throwable $e) {
    }
    $pdo->commit();

    responder(['ok' => true], 201);
}

function cancelar(array $d): void
{
    $endpoint = trim((string) ($d['endpoint'] ?? ''));
    if ($endpoint === '') error_json('Falta el endpoint');
    db()->prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?')->execute([hash('sha256', $endpoint)]);
    responder(['ok' => true]);
}

function probar(): void
{
    $admin = exigir_admin();
    try {
        $r = push_a_suscritos([
            'title' => 'POLIMAP · Prueba',
            'body'  => 'Si ves esto, las notificaciones de avisos funcionan en este celular.',
            'url'   => '/',
            'tag'   => 'polimap-prueba',
        ], $admin['id']);
    } catch (Throwable $e) {
        error_log('POLIMAP push: ' . $e->getMessage());
        error_json('No se pudo enviar: ' . $e->getMessage(), 500);
    }
    if (($r['suscritos'] ?? 0) === 0) {
        error_json('Primero activa las notificaciones en la app (Inicio → "Avisos en tu celular") con esta misma cuenta.');
    }
    responder(['ok' => true] + $r);
}
