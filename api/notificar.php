<?php
/**
 * POLIMAP — Correos: aviso de reportes nuevos y códigos de acceso.
 *
 * notificar_reporte() la usa api/reportes.php DESPUÉS de guardar el reporte.
 * enviar_correo() la usan también los códigos de 6 dígitos de api/auth.php.
 * Regla de oro: el correo solo AVISA. Si Gmail falla, el reporte ya quedó
 * guardado y la app responde normal; el error se anota en el log del servidor.
 *
 * Usa PHPMailer (api/lib/PHPMailer/), porque en InfinityFree la función
 * mail() de PHP está bloqueada y hay que mandar por SMTP de Gmail.
 *
 * Configuración: sección "correo" de api/config.php.
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailerException;

require_once __DIR__ . '/lib/PHPMailer/Exception.php';
require_once __DIR__ . '/lib/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/lib/PHPMailer/SMTP.php';

/** Nombre bonito de cada categoría (lo que ve el usuario en el formulario). */
const NOMBRES_CATEGORIA = [
    'basura'      => 'Basura',
    'mobiliario'  => 'Mobiliario dañado',
    'banos'       => 'Baños en mal estado',
    'fuga'        => 'Fuga de agua',
    'iluminacion' => 'Iluminación',
    'riesgo'      => 'Riesgo o desperfecto',
    'otro'        => 'Otro',
];

/**
 * Manda el aviso de un reporte nuevo.
 *
 * @param array       $reporte  folio, categoria, descripcion, ubicacion (texto ya armado),
 *                              lat, lng, anonimo, autor (null si es anónimo),
 *                              prioridad, creado_en
 * @param string|null $rutaFoto ruta en disco de la foto (se adjunta) o null
 * @return bool true si Gmail lo aceptó; false si está apagado o falló
 */
function notificar_reporte(array $reporte, ?string $rutaFoto = null): bool
{
    global $CONFIG;
    $c = $CONFIG['correo'] ?? null;

    // 1) ¿Está activado? (en tu compu con XAMPP puede ir apagado)
    if (!correo_activo() || empty($c['para'])) {
        return false;
    }

    // 2) Armar el contenido -------------------------------------------------
    $e = fn ($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');  // evita meter HTML ajeno
    $categoria = NOMBRES_CATEGORIA[$reporte['categoria']] ?? $reporte['categoria'];
    $mapa = ($reporte['lat'] !== null && $reporte['lng'] !== null)
        ? "https://www.openstreetmap.org/?mlat={$reporte['lat']}&mlon={$reporte['lng']}#map=19/{$reporte['lat']}/{$reporte['lng']}"
        : null;

    $filas = [
        'Folio'       => $reporte['folio'],
        'Categoría'   => $categoria,
        'Ubicación'   => $reporte['ubicacion'],
        'Descripción' => $reporte['descripcion'],
        'Prioridad'   => ($reporte['prioridad'] ?? 'media') === 'alta' ? 'ALTA (urgente)' : ucfirst($reporte['prioridad'] ?? 'media'),
        'Enviado por' => $reporte['anonimo'] ? 'Anónimo' : ($reporte['autor'] ?? 'Sin dato'),
        'Fecha'       => $reporte['creado_en'],
    ];

    $html = '<div style="font-family:Arial,sans-serif;max-width:560px">'
          . '<h2 style="color:#002D62;margin:0 0 12px">Nuevo reporte en POLIMAP</h2>'
          . '<table cellpadding="8" style="border-collapse:collapse;width:100%">';
    foreach ($filas as $k => $v) {
        $html .= '<tr><td style="border-bottom:1px solid #ddd;color:#555;width:120px"><b>' . $e($k) . '</b></td>'
               . '<td style="border-bottom:1px solid #ddd">' . nl2br($e($v)) . '</td></tr>';
    }
    $html .= '</table>';
    if ($mapa) {
        $html .= '<p><a href="' . $e($mapa) . '" style="color:#B32034">Ver ubicación GPS en el mapa</a></p>';
    }
    $html .= $rutaFoto ? '<p>La foto va adjunta.</p>' : '<p style="color:#777">Sin foto.</p>';
    $html .= '<p style="color:#777;font-size:12px">Aviso automático de POLIMAP. '
           . 'El reporte ya está guardado en la base de datos; no respondas a este correo.</p></div>';

    $texto = "Nuevo reporte en POLIMAP\n\n";
    foreach ($filas as $k => $v) {
        $texto .= "$k: $v\n";
    }
    if ($mapa) $texto .= "Mapa: $mapa\n";

    // 3) Enviar por Gmail (si falla, nunca rompe el reporte: solo se anota)
    $urgente = ($reporte['prioridad'] ?? '') === 'alta' ? 'URGENTE · ' : '';
    return enviar_correo(
        (array) $c['para'],
        "[POLIMAP] {$urgente}{$reporte['folio']} · $categoria",
        $html,
        $texto,
        ($rutaFoto && is_file($rutaFoto)) ? $rutaFoto : null,
        $reporte['folio'] . '.' . pathinfo((string) $rutaFoto, PATHINFO_EXTENSION),
        'POLIMAP Reportes'
    );
}

/**
 * Envía un correo con la cuenta de Gmail de config.php.
 * La usan el aviso de reportes (arriba) y los códigos de acceso (auth.php).
 *
 * @param string[]    $para          destinatarios
 * @param string|null $adjunto       ruta en disco de un archivo a adjuntar
 * @return bool true si Gmail lo aceptó; false si está apagado o falló
 */
function enviar_correo(array $para, string $asunto, string $html, string $texto,
                       ?string $adjunto = null, ?string $nombreAdjunto = null,
                       string $remitente = 'POLIMAP'): bool
{
    global $CONFIG;
    $c = $CONFIG['correo'] ?? null;
    if (!correo_activo()) {
        return false;
    }

    $mail = new PHPMailer(true);   // true = errores como excepciones
    try {
        $mail->isSMTP();
        $mail->Host       = $c['host'] ?? 'smtp.gmail.com';
        $mail->Port       = (int) ($c['puerto'] ?? 587);
        // 465 = SSL directo, 587 = STARTTLS (los dos funcionan con Gmail).
        $mail->SMTPSecure = ($c['puerto'] ?? 587) == 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        if (array_key_exists('seguridad', $c)) {      // solo para pruebas locales sin cifrado
            $mail->SMTPSecure = $c['seguridad'];
            $mail->SMTPAutoTLS = (bool) $c['seguridad'];
        }
        $mail->SMTPAuth   = true;
        $mail->Username   = $c['usuario'];
        $mail->Password   = str_replace(' ', '', $c['clave_app']);  // Google la muestra con espacios
        $mail->Timeout    = 10;        // no dejar esperando al usuario más de 10 s
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom($c['usuario'], $remitente);
        foreach ($para as $destino) {
            $mail->addAddress($destino);
        }

        $mail->Subject = $asunto;
        $mail->isHTML(true);
        $mail->Body    = $html;
        $mail->AltBody = $texto;

        if ($adjunto) {
            $mail->addAttachment($adjunto, $nombreAdjunto ?: basename($adjunto));
        }

        $mail->send();
        return true;
    } catch (MailerException $ex) {
        error_log('POLIMAP correo: ' . $mail->ErrorInfo);
        return false;
    }
}

/** ¿Está prendido el correo en config.php y con todos sus datos? */
function correo_activo(): bool
{
    global $CONFIG;
    $c = $CONFIG['correo'] ?? null;
    if (!$c || empty($c['activo'])) {
        return false;   // en tu compu con XAMPP puede ir apagado
    }
    if (empty($c['usuario']) || empty($c['clave_app'])) {
        error_log('POLIMAP correo: falta usuario o clave_app en config.php');
        return false;
    }
    return true;
}
