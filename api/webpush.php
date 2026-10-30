<?php
/**
 * POLIMAP — Notificaciones push (Web Push) SIN librerías.   Responsable: Alexis
 *
 * Lo usan api/push.php (activar/desactivar en el celular) y api/avisos.php
 * (cuando un admin publica un aviso con "Mandar notificación").
 *
 * Cómo funciona, en corto:
 *   1. El celular, al tocar "Activar", le pide a su navegador una
 *      "suscripción": una dirección de Google (Android/Chrome), Apple (iPhone)
 *      o Mozilla (Firefox) + dos llaves. La guardamos en push_suscripciones.
 *   2. Para avisar, el servidor manda a esa dirección el mensaje CIFRADO
 *      (solo ese celular puede leerlo) y firmado con nuestra llave VAPID.
 *   3. Google/Apple/Mozilla lo entregan al celular y public/sw.js lo muestra.
 *
 * Estándares que sigue (por si alguien quiere revisarlo):
 *   - RFC 8291: cifrado del mensaje (aes128gcm con ECDH P-256 + HKDF).
 *   - RFC 8292: VAPID (firma ES256 del servidor).
 *
 * Las llaves VAPID se crean solas la primera vez y se guardan en
 * api/cache/vapid-keys.php (esa carpeta no se ve desde el navegador y no
 * se sube a GitHub). Si se borran, hay que volver a activar en cada celular.
 *
 * InfinityFree: necesita las extensiones openssl y curl de PHP (ya vienen).
 */

/** Configuración de push con valores por defecto (no hace falta tocar config.php). */
function push_config(): array
{
    global $CONFIG;
    $p = $CONFIG['push'] ?? [];
    return [
        'activo'   => $p['activo'] ?? true,
        'contacto' => $p['contacto'] ?? 'mailto:polimap505@gmail.com',
    ];
}

// ---------------------------------------------------------------------------
// 1) Base64 "url-safe" (el formato que usan las llaves de push)
// ---------------------------------------------------------------------------
function push_b64e(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function push_b64d(string $txt): string
{
    $txt = strtr($txt, '-_', '+/');
    return (string) base64_decode($txt . str_repeat('=', (4 - strlen($txt) % 4) % 4), true);
}

// ---------------------------------------------------------------------------
// 2) Llaves de curva elíptica P-256
// ---------------------------------------------------------------------------

/**
 * Crea una llave P-256 nueva. En Windows (XAMPP) PHP a veces necesita que le
 * digan dónde está openssl.cnf; probamos las rutas comunes.
 */
function push_nueva_llave()
{
    $opciones = ['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC];
    $llave = @openssl_pkey_new($opciones);
    if ($llave) return $llave;

    $candidatos = array_filter([
        getenv('OPENSSL_CONF') ?: null,
        dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf',
        dirname(PHP_BINARY) . '/extras/openssl/openssl.cnf',
        'C:/xampp/php/extras/ssl/openssl.cnf',
        'C:/xampp/php/extras/openssl/openssl.cnf',
        'C:/xampp/apache/conf/openssl.cnf',
        'C:/xampp/apache/bin/openssl.cnf',
    ]);
    foreach ($candidatos as $cnf) {
        if (!is_file($cnf)) continue;
        $llave = @openssl_pkey_new($opciones + ['config' => $cnf]);
        if ($llave) return $llave;
    }
    throw new RuntimeException('PHP no pudo crear llaves de cifrado (revisa la extensión openssl)');
}

/** Llave pública "cruda" de 65 bytes: 0x04 + X + Y. */
function push_publica_cruda($llave): string
{
    $d = openssl_pkey_get_details($llave);
    $x = str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT);
    $y = str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
    return "\x04" . $x . $y;
}

/** Convierte 65 bytes de llave pública a formato PEM (lo que entiende openssl). */
function push_publica_pem(string $cruda): string
{
    // Encabezado fijo de SubjectPublicKeyInfo para EC P-256 (RFC 5480).
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $cruda;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/**
 * Llaves VAPID del servidor: ['publica' => base64url (65 bytes), 'privada' => PEM].
 * La primera vez las crea y las guarda en api/cache/vapid-keys.php.
 */
function push_vapid(): array
{
    global $CONFIG;
    static $cache = null;
    if ($cache) return $cache;

    $dir = $CONFIG['cache_dir'] ?? (__DIR__ . '/cache');
    $archivo = $dir . '/vapid-keys.php';
    if (is_file($archivo)) {
        $guardadas = include $archivo;
        if (is_array($guardadas) && !empty($guardadas['privada']) && !empty($guardadas['publica'])) {
            return $cache = $guardadas;
        }
    }

    // Crear y guardar (con candado, por si dos personas entran al mismo tiempo).
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $candado = fopen($dir . '/vapid.lock', 'c');
    if ($candado) flock($candado, LOCK_EX);
    clearstatcache(true, $archivo);
    if (is_file($archivo)) {
        $guardadas = include $archivo;
        if (is_array($guardadas) && !empty($guardadas['privada'])) {
            if ($candado) fclose($candado);
            return $cache = $guardadas;
        }
    }

    $llave = push_nueva_llave();
    $pem = '';
    if (!openssl_pkey_export($llave, $pem, null, push_config_openssl())) {
        openssl_pkey_export($llave, $pem);
    }
    $nuevas = [
        'publica' => push_b64e(push_publica_cruda($llave)),
        'privada' => $pem,
        'creadas' => date('Y-m-d H:i:s'),
    ];
    $ok = @file_put_contents(
        $archivo,
        "<?php\n// Llaves VAPID de POLIMAP (notificaciones push). Se crearon solas.\n" .
        "// NO las subas a GitHub ni las borres: los celulares ya suscritos dejarían de recibir avisos.\n" .
        'return ' . var_export($nuevas, true) . ";\n"
    );
    if ($candado) fclose($candado);
    if ($ok === false) throw new RuntimeException('No se pudo guardar api/cache/vapid-keys.php (permisos de la carpeta cache)');
    return $cache = $nuevas;
}

/** En Windows openssl_pkey_export también puede pedir el openssl.cnf. */
function push_config_openssl(): array
{
    foreach ([getenv('OPENSSL_CONF') ?: '', 'C:/xampp/php/extras/ssl/openssl.cnf', 'C:/xampp/apache/conf/openssl.cnf'] as $cnf) {
        if ($cnf && is_file($cnf)) return ['config' => $cnf];
    }
    return [];
}

// ---------------------------------------------------------------------------
// 3) Firma VAPID (RFC 8292): un JWT ES256 por cada servicio (Google, Apple…)
// ---------------------------------------------------------------------------
function push_jwt(string $audiencia): string
{
    $vapid = push_vapid();
    $cabeza = push_b64e(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $datos  = push_b64e(json_encode([
        'aud' => $audiencia,
        'exp' => time() + 12 * 3600,
        'sub' => push_config()['contacto'],
    ], JSON_UNESCAPED_SLASHES));
    $entrada = "$cabeza.$datos";

    $der = '';
    if (!openssl_sign($entrada, $der, $vapid['privada'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('No se pudo firmar la notificación');
    }
    return $entrada . '.' . push_b64e(push_der_a_cruda($der));
}

/** openssl da la firma en DER (SEQUENCE{r, s}); JWT la quiere como r||s de 64 bytes. */
function push_der_a_cruda(string $der): string
{
    $pos = 2;                                   // 0x30 + largo
    if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $partes = [];
    for ($i = 0; $i < 2; $i++) {
        $largo = ord($der[$pos + 1]);           // 0x02 + largo + entero
        $entero = substr($der, $pos + 2, $largo);
        $pos += 2 + $largo;
        $entero = ltrim($entero, "\0");
        $partes[] = str_pad($entero, 32, "\0", STR_PAD_LEFT);
    }
    return $partes[0] . $partes[1];
}

// ---------------------------------------------------------------------------
// 4) Cifrado del mensaje (RFC 8291, "aes128gcm")
// ---------------------------------------------------------------------------
function push_cifrar(string $mensaje, string $p256dh, string $auth): string
{
    $publicaCel = push_b64d($p256dh);   // 65 bytes
    $secretoCel = push_b64d($auth);     // 16 bytes
    if (strlen($publicaCel) !== 65 || strlen($secretoCel) !== 16) {
        throw new InvalidArgumentException('Suscripción con llaves no válidas');
    }

    // Llave de un solo uso del servidor + secreto compartido (ECDH).
    $temporal = push_nueva_llave();
    $publicaServ = push_publica_cruda($temporal);
    $compartido = openssl_pkey_derive(openssl_pkey_get_public(push_publica_pem($publicaCel)), $temporal, 32);
    if ($compartido === false) throw new RuntimeException('No se pudo calcular el secreto compartido');

    // Derivar llaves (HKDF con SHA-256).
    $ikm   = hash_hkdf('sha256', $compartido, 32, "WebPush: info\0" . $publicaCel . $publicaServ, $secretoCel);
    $sal   = random_bytes(16);
    $llave = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $sal);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $sal);

    // Un solo bloque: mensaje + 0x02 (= "último bloque").
    $etiqueta = '';
    $cifrado = openssl_encrypt($mensaje . "\x02", 'aes-128-gcm', $llave, OPENSSL_RAW_DATA, $nonce, $etiqueta, '', 16);

    // Encabezado: sal (16) + tamaño de bloque (4) + largo de llave (1) + llave pública del servidor (65).
    return $sal . pack('N', 4096) . chr(65) . $publicaServ . $cifrado . $etiqueta;
}

// ---------------------------------------------------------------------------
// 5) ¿La dirección es de un servicio de push real? (para no mandar a cualquier lado)
// ---------------------------------------------------------------------------
function push_endpoint_valido(string $url): bool
{
    global $CONFIG;
    $p = parse_url($url);
    if (!$p || empty($p['host'])) return false;
    $host = strtolower($p['host']);

    // Solo en tu compu (modo_dev_login): deja probar con un servidor local.
    if (!empty($CONFIG['modo_dev_login']) && in_array($host, ['127.0.0.1', 'localhost'], true)) return true;

    if (($p['scheme'] ?? '') !== 'https') return false;
    foreach (['fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'] as $permitido) {
        if ($host === $permitido || str_ends_with($host, '.' . $permitido)) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// 6) Enviar a muchos celulares a la vez
// ---------------------------------------------------------------------------

/**
 * $suscripciones: filas con id, endpoint, p256dh, auth.
 * $mensaje: ['title' => …, 'body' => …, 'url' => …, 'tag' => …]
 * Regresa ['enviadas' => n, 'fallidas' => n, 'vencidas' => [ids], 'fallos' => [ids]].
 */
function push_enviar(array $suscripciones, array $mensaje): array
{
    $resultado = ['enviadas' => 0, 'fallidas' => 0, 'vencidas' => [], 'fallos' => []];
    if (!$suscripciones) return $resultado;
    if (!function_exists('curl_multi_init')) throw new RuntimeException('Falta la extensión curl de PHP');

    $json = json_encode($mensaje, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $publica = push_vapid()['publica'];
    $firmas = [];   // un JWT por servicio (https://fcm.googleapis.com, …)

    // De 50 en 50 para no saturar el hosting.
    foreach (array_chunk($suscripciones, 50) as $lote) {
        $multi = curl_multi_init();
        $handles = [];
        foreach ($lote as $s) {
            try {
                $p = parse_url($s['endpoint']);
                $aud = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
                $firmas[$aud] ??= push_jwt($aud);
                $cuerpo = push_cifrar($json, $s['p256dh'], $s['auth']);
            } catch (Throwable $e) {
                error_log('POLIMAP push: ' . $e->getMessage());
                $resultado['fallidas']++;
                $resultado['fallos'][] = (int) $s['id'];
                continue;
            }
            $ch = curl_init($s['endpoint']);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $cuerpo,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_HTTPHEADER     => [
                    'TTL: 86400',                       // si el cel está apagado, el aviso espera hasta 1 día
                    'Urgency: high',
                    'Content-Type: application/octet-stream',
                    'Content-Encoding: aes128gcm',
                    'Content-Length: ' . strlen($cuerpo),
                    'Authorization: vapid t=' . $firmas[$aud] . ', k=' . $publica,
                ],
            ]);
            curl_multi_add_handle($multi, $ch);
            $handles[(int) $s['id']] = $ch;
        }

        do {
            $estado = curl_multi_exec($multi, $activos);
            if ($activos) curl_multi_select($multi, 1.0);
        } while ($activos && $estado === CURLM_OK);

        foreach ($handles as $id => $ch) {
            $codigo = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            if ($codigo >= 200 && $codigo < 300) {
                $resultado['enviadas']++;
            } elseif ($codigo === 404 || $codigo === 410) {
                $resultado['vencidas'][] = $id;      // el celular desactivó o desinstaló: se borra
            } else {
                $resultado['fallidas']++;
                $resultado['fallos'][] = $id;
                error_log("POLIMAP push: código $codigo " . substr((string) curl_multi_getcontent($ch), 0, 200));
            }
            curl_multi_remove_handle($multi, $ch);
            curl_close($ch);
        }
        curl_multi_close($multi);
    }
    return $resultado;
}

/**
 * Manda un mensaje a las suscripciones de la base (todas, las de un usuario, las de un
 * grupo o las de una lista de usuarios)
 * y hace limpieza: borra las vencidas y las que fallan 5 veces seguidas.
 */
function push_a_suscritos(array $mensaje, ?int $soloUsuario = null, ?string $soloGrupo = null, ?array $soloUsuarios = null): array
{
    if (!push_config()['activo']) return ['enviadas' => 0, 'fallidas' => 0, 'apagado' => true];
    $pdo = db();
    if ($soloUsuarios !== null) {
        // Solo a ciertas cuentas (ej. avisos para consejales). Lista vacía = a nadie.
        if (!$soloUsuarios) return ['enviadas' => 0, 'fallidas' => 0, 'borradas' => 0, 'suscritos' => 0];
        $marcas = implode(',', array_fill(0, count($soloUsuarios), '?'));
        $stmt = $pdo->prepare("SELECT id, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id IN ($marcas)");
        $stmt->execute(array_values($soloUsuarios));
        $filas = $stmt->fetchAll();
    } elseif ($soloUsuario !== null) {
        $stmt = $pdo->prepare('SELECT id, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = ?');
        $stmt->execute([$soloUsuario]);
        $filas = $stmt->fetchAll();
    } elseif ($soloGrupo !== null) {
        // Solo los celulares que eligieron ese grupo en Horario (api/calendario.php).
        $stmt = $pdo->prepare('SELECT id, endpoint, p256dh, auth FROM push_suscripciones WHERE grupo = ?');
        $stmt->execute([$soloGrupo]);
        $filas = $stmt->fetchAll();
    } else {
        $filas = $pdo->query('SELECT id, endpoint, p256dh, auth FROM push_suscripciones')->fetchAll();
    }

    $r = push_enviar($filas, $mensaje);

    if ($r['vencidas']) {
        $marcas = implode(',', array_fill(0, count($r['vencidas']), '?'));
        $pdo->prepare("DELETE FROM push_suscripciones WHERE id IN ($marcas)")->execute($r['vencidas']);
    }
    $exitosas = array_diff(array_map(fn ($f) => (int) $f['id'], $filas), $r['vencidas'], $r['fallos']);
    if ($exitosas) {
        $marcas = implode(',', array_fill(0, count($exitosas), '?'));
        $pdo->prepare("UPDATE push_suscripciones SET ultimo_envio = ?, fallos = 0 WHERE id IN ($marcas)")
            ->execute(array_merge([ahora()], array_values($exitosas)));
    }
    if ($r['fallos']) {
        $marcas = implode(',', array_fill(0, count($r['fallos']), '?'));
        $pdo->prepare("UPDATE push_suscripciones SET fallos = fallos + 1 WHERE id IN ($marcas)")->execute($r['fallos']);
        $pdo->exec('DELETE FROM push_suscripciones WHERE fallos >= 5');
    }

    return [
        'enviadas'  => $r['enviadas'],
        'fallidas'  => $r['fallidas'],
        'borradas'  => count($r['vencidas']),
        'suscritos' => count($filas),
    ];
}
