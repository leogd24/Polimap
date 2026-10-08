<?php
/**
 * POLIMAP — Verificación del "Iniciar sesión con Google".
 *
 * Cómo funciona, paso a paso:
 *   1. En la app, el botón de Google le entrega a React un "ID token" (un JWT):
 *      un texto firmado por Google que dice "esta persona es fulano@alumnos.udg.mx".
 *   2. React lo manda a api/auth.php.
 *   3. Aquí revisamos que la FIRMA sea de Google (con sus certificados públicos),
 *      que el token sea para NUESTRA app (aud = google_client_id), que no haya
 *      caducado y que Google ya verificó el correo.
 *   4. Si todo está bien, regresamos los datos (correo, nombre, foto).
 *
 * Nadie puede inventar un token: sin la llave privada de Google la firma no cuadra.
 * No necesita librerías: usa openssl, que ya viene en PHP.
 */

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const GOOGLE_EMISORES  = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Revisa el ID token y regresa sus datos (payload).
 * Lanza RuntimeException con un mensaje en español si algo no cuadra.
 */
function verificar_token_google(string $jwt, string $clientId): array
{
    if ($clientId === '') {
        throw new RuntimeException('Falta google_client_id en api/config.php');
    }

    // 1) Un JWT son 3 partes separadas por puntos: encabezado.datos.firma
    $partes = explode('.', $jwt);
    if (count($partes) !== 3) {
        throw new RuntimeException('Token de Google con formato incorrecto');
    }
    [$h64, $p64, $f64] = $partes;
    $encabezado = json_decode(base64url_decode($h64), true);
    $datos      = json_decode(base64url_decode($p64), true);
    $firma      = base64url_decode($f64);
    if (!is_array($encabezado) || !is_array($datos) || $firma === '') {
        throw new RuntimeException('Token de Google ilegible');
    }
    if (($encabezado['alg'] ?? '') !== 'RS256' || empty($encabezado['kid'])) {
        throw new RuntimeException('Token de Google con firma no soportada');
    }

    // 2) Buscar el certificado con el que Google lo firmó (kid). Google los
    //    cambia cada tantos días: si no lo tenemos, bajamos la lista otra vez.
    $certs = certificados_google();
    if (!isset($certs[$encabezado['kid']])) {
        $certs = certificados_google(true);
    }
    $cert = $certs[$encabezado['kid']] ?? null;
    if ($cert === null) {
        throw new RuntimeException('No se encontró el certificado de Google');
    }

    // 3) Verificar la firma
    if (openssl_verify("$h64.$p64", $firma, $cert, OPENSSL_ALGO_SHA256) !== 1) {
        throw new RuntimeException('La firma del token no es de Google');
    }

    // 4) Revisar los datos
    if (!in_array($datos['iss'] ?? '', GOOGLE_EMISORES, true)) {
        throw new RuntimeException('El token no lo emitió Google');
    }
    if (($datos['aud'] ?? '') !== $clientId) {
        throw new RuntimeException('El token es de otra aplicación');
    }
    $ahora = time();
    if (($datos['exp'] ?? 0) < $ahora - 60) {          // 1 minuto de tolerancia de reloj
        throw new RuntimeException('El inicio de sesión caducó, vuelve a intentarlo');
    }
    if (($datos['iat'] ?? 0) > $ahora + 300) {
        throw new RuntimeException('Revisa la fecha y hora del servidor');
    }
    $verificado = $datos['email_verified'] ?? false;
    if (empty($datos['email']) || !($verificado === true || $verificado === 'true')) {
        throw new RuntimeException('Google no ha verificado ese correo');
    }

    return $datos;
}

/**
 * Certificados públicos de Google: { kid: "-----BEGIN CERTIFICATE-----..." }.
 * Se guardan en api/cache/google-certs.json el tiempo que Google indique
 * (normalmente unas horas) para no pedirlos en cada inicio de sesión.
 */
function certificados_google(bool $forzar = false): array
{
    global $CONFIG;
    $dir     = $CONFIG['cache_dir'] ?? (__DIR__ . '/cache');
    $archivo = $dir . '/google-certs.json';

    if (!$forzar && is_file($archivo)) {
        $guardado = json_decode((string) file_get_contents($archivo), true);
        if (is_array($guardado) && ($guardado['expira'] ?? 0) > time() && !empty($guardado['certs'])) {
            return $guardado['certs'];
        }
    }

    [$cuerpo, $maxAge] = descargar(GOOGLE_CERTS_URL);
    $certs = json_decode((string) $cuerpo, true);
    if (!is_array($certs) || !$certs) {
        // Si no se pudo bajar, usamos la copia vieja (mejor que nada).
        $viejo = is_file($archivo) ? json_decode((string) file_get_contents($archivo), true) : null;
        if (!empty($viejo['certs'])) return $viejo['certs'];
        throw new RuntimeException('El servidor no pudo contactar a Google');
    }

    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($archivo, json_encode([
        'expira' => time() + max(600, min($maxAge ?: 21600, 86400)),
        'certs'  => $certs,
    ]));
    return $certs;
}

/** GET simple con tiempo límite. Regresa [cuerpo, max-age en segundos]. */
function descargar(string $url): array
{
    $maxAge = 0;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_HEADERFUNCTION => function ($ch, $linea) use (&$maxAge) {
                if (preg_match('/max-age=(\d+)/i', $linea, $m)) $maxAge = (int) $m[1];
                return strlen($linea);
            },
        ]);
        $cuerpo = curl_exec($ch);
        $codigo = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($cuerpo !== false && $codigo === 200) return [$cuerpo, $maxAge];
        error_log("POLIMAP google: no se pudo descargar $url (HTTP $codigo)");
        return [null, 0];
    }

    $contexto = stream_context_create(['http' => ['timeout' => 8]]);
    $cuerpo = @file_get_contents($url, false, $contexto);
    foreach ($http_response_header ?? [] as $linea) {
        if (preg_match('/max-age=(\d+)/i', $linea, $m)) $maxAge = (int) $m[1];
    }
    return [$cuerpo === false ? null : $cuerpo, $maxAge];
}

/** Base64 "para URL" (la que usan los JWT): cambia -_ por +/ y repone el relleno. */
function base64url_decode(string $texto): string
{
    $texto = strtr($texto, '-_', '+/');
    $resto = strlen($texto) % 4;
    if ($resto) $texto .= str_repeat('=', 4 - $resto);
    return (string) base64_decode($texto, true);
}
