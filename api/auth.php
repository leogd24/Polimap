<?php
/**
 * POLIMAP — Inicio de sesión (app de alumnos y panel admin)
 *
 * Tres formas de entrar:
 *   A) Botón "Iniciar sesión con Google"  (alumnos y profesores)      ← la principal
 *   B) Código de 6 dígitos al correo      (alumnos, si Google falla)   ← respaldo
 *   C) Correo + contraseña                (solo el panel: admins y cuenta maestra)
 *
 *   GET  /api/auth.php
 *        → { ok, usuario | null, googleClientId, dominios, codigoPorCorreo, modoDev }
 *          React lo llama al abrir para saber si ya hay sesión.
 *
 *   POST /api/auth.php  con JSON { "accion": ..., ... }
 *     google           { credential, destino: 'app' | 'panel' }   → A
 *     pedir_codigo     { correo, destino: 'app' | 'clave' }       → manda el código por correo
 *     verificar_codigo { correo, codigo }                         → B (entra a la app)
 *     crear_clave      { correo, codigo, clave }                  → crea/recupera la contraseña del panel
 *     entrar_clave     { correo, clave }                          → C (entra al panel)
 *     salir            {}                                         → cierra la sesión de este dispositivo
 *     dev              { correo, destino }  SOLO en tu compu con 'modo_dev_login' => true
 *
 *   GET  /api/auth.php?diagnostico=1  → revisa Google, tablas y correo (sin datos secretos)
 *
 * Seguridad (lo importante):
 *   - Los códigos y las contraseñas se guardan como HASH, nunca en texto.
 *   - Código: dura 10 minutos, 5 intentos, máximo 1 por minuto y 5 por hora.
 *   - Contraseña: 5 fallos seguidos = 15 minutos bloqueada.
 *   - Quién puede entrar lo decide permisos_de() en sesion.php.
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';
require __DIR__ . '/google.php';
require __DIR__ . '/notificar.php';   // enviar_correo() para los códigos

const CODIGO_MINUTOS  = 10;   // cuánto dura un código
const CODIGO_INTENTOS = 5;    // intentos por código
const CLAVE_MIN       = 8;    // largo mínimo de contraseña
const CLAVE_FALLOS    = 5;    // fallos antes de bloquear
const CLAVE_BLOQUEO   = 900;  // segundos de bloqueo (15 min)

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        isset($_GET['diagnostico']) ? diagnostico() : estado_sesion();
        break;
    case 'POST':
        $datos = leer_json();
        switch ($datos['accion'] ?? '') {
            case 'google':           entrar_con_google($datos); break;
            case 'pedir_codigo':     pedir_codigo($datos);      break;
            case 'verificar_codigo': verificar_codigo($datos);  break;
            case 'crear_clave':      crear_clave($datos);       break;
            case 'entrar_clave':     entrar_con_clave($datos);  break;
            case 'dev':              entrar_modo_dev($datos);   break;
            case 'salir':            cerrar_sesion(); responder(['ok' => true]); break;
            default:                 error_json('Acción no válida');
        }
        break;
    default:
        error_json('Método no permitido', 405);
}

// ---------------------------------------------------------------------------
// GET: ¿hay sesión?
// ---------------------------------------------------------------------------

function estado_sesion(): void
{
    global $CONFIG;
    $u = usuario_actual();
    responder([
        'ok'              => true,
        'usuario'         => $u ? usuario_publico($u) : null,
        // El ID de cliente NO es secreto (Google lo pone en la página); se manda
        // desde aquí para no tener que recompilar la app si cambia.
        'googleClientId'  => $CONFIG['google_client_id'] ?? '',
        'dominios'        => [
            'alumnos'    => $CONFIG['dominio_alumnos'] ?? 'alumnos.udg.mx',
            'academicos' => $CONFIG['dominio_academicos'] ?? 'academicos.udg.mx',
        ],
        // true si se pueden mandar códigos por correo (respaldo de Google).
        'codigoPorCorreo' => correo_activo() || modo_dev_activo(),
        'modoDev'         => modo_dev_activo(),
    ]);
}

// ---------------------------------------------------------------------------
// A) Google
// ---------------------------------------------------------------------------

function entrar_con_google(array $datos): void
{
    global $CONFIG;
    try {
        $g = verificar_token_google((string) ($datos['credential'] ?? ''), (string) ($CONFIG['google_client_id'] ?? ''));
    } catch (RuntimeException $e) {
        error_json($e->getMessage(), 401);
    }
    iniciar_sesion(
        strtolower($g['email']),
        (string) ($g['name'] ?? ''),
        $g['picture'] ?? null,
        (string) ($g['sub'] ?? ''),
        ($datos['destino'] ?? 'app') === 'panel' ? 'panel' : 'app'
    );
}

// ---------------------------------------------------------------------------
// B) Código de 6 dígitos por correo
// ---------------------------------------------------------------------------

/**
 * Manda un código al correo.
 *   destino 'app'   → para entrar a la app (alumnos y correos de prueba).
 *   destino 'clave' → para crear o recuperar la contraseña del panel.
 */
function pedir_codigo(array $datos): void
{
    $correo    = correo_limpio($datos['correo'] ?? '');
    $proposito = ($datos['destino'] ?? 'app') === 'clave' ? 'clave' : 'entrar';
    $permisos  = permisos_de($correo);

    // 1) ¿Ese correo puede pedir código?
    if ($proposito === 'entrar' && !$permisos['app']) {
        error_json(mensaje_sin_permiso_app($permisos), 403);
    }
    if ($proposito === 'clave' && !$permisos['admin']) {
        error_json('Ese correo no está designado como administrador. Pide al administrador maestro que te agregue.', 403);
    }

    // 2) Límites para que nadie llene de correos a otra persona
    $pdo = db();
    $ip  = substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 45);
    $q = $pdo->prepare('SELECT MAX(creado_en) FROM codigos_acceso WHERE correo = ? AND proposito = ?');
    $q->execute([$correo, $proposito]);
    $ultimo = $q->fetchColumn();
    if ($ultimo && $ultimo > ahora(-60)) {
        error_json('Ya te mandamos un código. Espera un minuto antes de pedir otro.', 429);
    }
    $q = $pdo->prepare('SELECT COUNT(*) FROM codigos_acceso WHERE correo = ? AND creado_en > ?');
    $q->execute([$correo, ahora(-3600)]);
    if ((int) $q->fetchColumn() >= 5) {
        error_json('Pediste demasiados códigos. Intenta en una hora o usa el botón de Google.', 429);
    }
    $q = $pdo->prepare('SELECT COUNT(*) FROM codigos_acceso WHERE ip = ? AND creado_en > ?');
    $q->execute([$ip, ahora(-3600)]);
    if ((int) $q->fetchColumn() >= 20) {
        error_json('Demasiadas solicitudes desde esta red. Intenta más tarde.', 429);
    }

    // 3) Crear el código (los anteriores dejan de servir)
    $codigo = sprintf('%06d', random_int(0, 999999));
    $pdo->prepare('UPDATE codigos_acceso SET usado_en = ? WHERE correo = ? AND proposito = ? AND usado_en IS NULL')
        ->execute([ahora(), $correo, $proposito]);
    $pdo->prepare('INSERT INTO codigos_acceso (correo, proposito, codigo_hash, ip, creado_en, expira_en) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$correo, $proposito, hash_codigo($correo, $codigo), $ip, ahora(), ahora(CODIGO_MINUTOS * 60)]);
    $id = (int) $pdo->lastInsertId();

    // De vez en cuando borramos códigos viejos (limpieza).
    if (random_int(1, 20) === 1) {
        $pdo->prepare('DELETE FROM codigos_acceso WHERE creado_en < ?')->execute([ahora(-86400)]);
    }

    $respuesta = ['ok' => true, 'enviadoA' => enmascarar($correo), 'minutos' => CODIGO_MINUTOS];

    // 4) Mandarlo por correo
    if (correo_activo()) {
        if (!enviar_correo([$correo], asunto_codigo($proposito, $codigo), html_codigo($proposito, $codigo), texto_codigo($proposito, $codigo))) {
            $pdo->prepare('DELETE FROM codigos_acceso WHERE id = ?')->execute([$id]);
            error_json('No se pudo enviar el correo. Intenta de nuevo en un momento.', 502);
        }
    } elseif (modo_dev_activo()) {
        // Solo en tu compu con XAMPP (sin Gmail): el código sale en la respuesta.
        $respuesta['codigoDev'] = $codigo;
    } else {
        $pdo->prepare('DELETE FROM codigos_acceso WHERE id = ?')->execute([$id]);
        error_json('El envío de códigos está apagado en el servidor (correo.activo en config.php).', 503);
    }
    responder($respuesta);
}

/** Entra a la app con el código que llegó al correo. */
function verificar_codigo(array $datos): void
{
    $correo = correo_limpio($datos['correo'] ?? '');
    comprobar_codigo($correo, 'entrar', (string) ($datos['codigo'] ?? ''));
    iniciar_sesion($correo, '', null, null, 'app');
}

/**
 * Revisa el código más reciente de ese correo. Si está bien, lo marca como
 * usado; si no, suma un intento y corta con el mensaje de error.
 */
function comprobar_codigo(string $correo, string $proposito, string $codigo): void
{
    $codigo = preg_replace('/\D/', '', $codigo);   // acepta "123 456"
    if (strlen($codigo) !== 6) {
        error_json('El código tiene 6 números.');
    }

    $pdo = db();
    $q = $pdo->prepare(
        'SELECT id, codigo_hash, intentos, expira_en FROM codigos_acceso
          WHERE correo = ? AND proposito = ? AND usado_en IS NULL
          ORDER BY id DESC LIMIT 1'
    );
    $q->execute([$correo, $proposito]);
    $fila = $q->fetch();

    if (!$fila || $fila['expira_en'] < ahora()) {
        error_json('El código venció o no existe. Pide uno nuevo.', 400);
    }
    if ((int) $fila['intentos'] >= CODIGO_INTENTOS) {
        error_json('Demasiados intentos con ese código. Pide uno nuevo.', 429);
    }
    if (!hash_equals($fila['codigo_hash'], hash_codigo($correo, $codigo))) {
        $pdo->prepare('UPDATE codigos_acceso SET intentos = intentos + 1 WHERE id = ?')->execute([$fila['id']]);
        $quedan = CODIGO_INTENTOS - (int) $fila['intentos'] - 1;
        error_json($quedan > 0 ? "Código incorrecto. Te quedan $quedan intentos." : 'Código incorrecto. Pide uno nuevo.', 400);
    }
    $pdo->prepare('UPDATE codigos_acceso SET usado_en = ? WHERE id = ?')->execute([ahora(), $fila['id']]);
}

// ---------------------------------------------------------------------------
// C) Contraseña del panel
// ---------------------------------------------------------------------------

/** Crea o cambia la contraseña con el código que llegó al correo, y entra al panel. */
function crear_clave(array $datos): void
{
    $correo = correo_limpio($datos['correo'] ?? '');
    $clave  = (string) ($datos['clave'] ?? '');
    validar_clave($clave);                               // antes de gastar el código

    if (!permisos_de($correo)['admin']) {
        error_json('Ese correo no está designado como administrador.', 403);
    }
    comprobar_codigo($correo, 'clave', (string) ($datos['codigo'] ?? ''));

    db()->prepare('UPDATE accesos SET clave_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE correo = ?')
        ->execute([password_hash($clave, PASSWORD_DEFAULT), $correo]);
    iniciar_sesion($correo, '', null, null, 'panel');
}

/** Entrada al panel con correo + contraseña. */
function entrar_con_clave(array $datos): void
{
    $correo = correo_limpio($datos['correo'] ?? '');
    $clave  = (string) ($datos['clave'] ?? '');
    $pdo    = db();

    $q = $pdo->prepare(
        "SELECT id, clave_hash, intentos_fallidos, bloqueado_hasta FROM accesos
          WHERE correo = ? AND rol IN ('maestro', 'admin')"
    );
    $q->execute([$correo]);
    $fila = $q->fetch();

    if (!$fila) {
        // Mismo tiempo de respuesta aunque el correo no exista.
        password_hash($clave, PASSWORD_DEFAULT);
        error_json('Correo o contraseña incorrectos.', 401);
    }
    if ($fila['bloqueado_hasta'] && $fila['bloqueado_hasta'] > ahora()) {
        error_json('Demasiados intentos. Espera 15 minutos o recupera tu contraseña con un código.', 429);
    }
    if (!$fila['clave_hash']) {
        error_json('Aún no tienes contraseña. Toca "Crear o recuperar contraseña".', 400);
    }
    if (!password_verify($clave, $fila['clave_hash'])) {
        $fallos = (int) $fila['intentos_fallidos'] + 1;
        if ($fallos >= CLAVE_FALLOS) {
            $pdo->prepare('UPDATE accesos SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id = ?')
                ->execute([ahora(CLAVE_BLOQUEO), $fila['id']]);
            error_json('Demasiados intentos. Espera 15 minutos o recupera tu contraseña con un código.', 429);
        }
        $pdo->prepare('UPDATE accesos SET intentos_fallidos = ? WHERE id = ?')->execute([$fallos, $fila['id']]);
        error_json('Correo o contraseña incorrectos.', 401);
    }

    // Bien: reiniciamos el contador (y actualizamos el hash si PHP mejoró el algoritmo).
    $nuevoHash = password_needs_rehash($fila['clave_hash'], PASSWORD_DEFAULT) ? password_hash($clave, PASSWORD_DEFAULT) : $fila['clave_hash'];
    $pdo->prepare('UPDATE accesos SET intentos_fallidos = 0, bloqueado_hasta = NULL, clave_hash = ? WHERE id = ?')
        ->execute([$nuevoHash, $fila['id']]);
    iniciar_sesion($correo, '', null, null, 'panel');
}

function validar_clave(string $clave): void
{
    if (mb_strlen($clave) < CLAVE_MIN) error_json('La contraseña debe tener al menos ' . CLAVE_MIN . ' caracteres.');
    if (strlen($clave) > 72) error_json('La contraseña es demasiado larga (máximo 72 caracteres).');
}

// ---------------------------------------------------------------------------
// Modo de prueba local
// ---------------------------------------------------------------------------

/** Entrada sin Google ni correo, solo para pruebas locales. */
function entrar_modo_dev(array $datos): void
{
    if (!modo_dev_activo()) error_json('El modo de prueba está apagado', 403);
    $correo = correo_limpio($datos['correo'] ?? '');
    iniciar_sesion($correo, (string) ($datos['nombre'] ?? ''), null, null, ($datos['destino'] ?? 'app') === 'panel' ? 'panel' : 'app');
}

/** Solo si config.php lo permite Y la petición viene de la misma compu. */
function modo_dev_activo(): bool
{
    global $CONFIG;
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return !empty($CONFIG['modo_dev_login']) && in_array($ip, ['127.0.0.1', '::1'], true);
}

// ---------------------------------------------------------------------------
// Común: revisar permisos y abrir la sesión
// ---------------------------------------------------------------------------

/**
 * Revisa permisos, crea o actualiza al usuario y abre la sesión.
 * destino: 'app' (alumnos) o 'panel' (administración).
 * $nombre vacío = conservar el que ya tenía (o sacarlo del correo).
 */
function iniciar_sesion(string $correo, string $nombre, ?string $foto, ?string $sub, string $destino): void
{
    $permisos = permisos_de($correo);

    if ($destino === 'panel' && !$permisos['admin']) {
        global $CONFIG;
        error_json(
            $permisos['tipo'] === 'academico'
                ? 'Tu correo de académico aún no está autorizado. Pide al administrador que te agregue.'
                : 'El panel es solo para profesores autorizados (@' . ($CONFIG['dominio_academicos'] ?? 'academicos.udg.mx') . ').',
            403
        );
    }
    if ($destino !== 'panel' && !$permisos['app']) {
        error_json(mensaje_sin_permiso_app($permisos), 403);
    }

    // Crear o actualizar al usuario (por correo).
    $pdo  = db();
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE correo = ?');
    $stmt->execute([$correo]);
    $id = $stmt->fetchColumn();
    $nombre = mb_substr(trim($nombre), 0, 120);
    $foto   = $foto ? mb_substr($foto, 0, 500) : null;

    if ($id) {
        $pdo->prepare("UPDATE usuarios SET nombre = COALESCE(NULLIF(?, ''), nombre), foto = COALESCE(?, foto),
                              google_sub = COALESCE(?, google_sub), ultimo_acceso = ? WHERE id = ?")
            ->execute([$nombre, $foto, $sub ?: null, ahora(), $id]);
    } else {
        $pdo->prepare('INSERT INTO usuarios (correo, nombre, foto, google_sub, creado_en, ultimo_acceso) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$correo, $nombre !== '' ? $nombre : nombre_de_correo($correo), $foto, $sub ?: null, ahora(), ahora()]);
        $id = $pdo->lastInsertId();
    }

    crear_sesion((int) $id);

    $stmt = $pdo->prepare('SELECT id, correo, nombre, foto FROM usuarios WHERE id = ?');
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    $u['permisos'] = $permisos;
    responder(['ok' => true, 'usuario' => usuario_publico($u)]);
}

function mensaje_sin_permiso_app(array $permisos): string
{
    global $CONFIG;
    return 'Para reportar entra con tu correo institucional @' . ($CONFIG['dominio_alumnos'] ?? 'alumnos.udg.mx') . '.';
}

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

/** Correo en minúsculas y sin espacios; corta con error si no es válido. */
function correo_limpio($valor): string
{
    $correo = strtolower(trim((string) $valor));
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL) || strlen($correo) > 190) {
        error_json('Escribe un correo válido.');
    }
    return $correo;
}

/** El código nunca se guarda tal cual: solo su huella (sha256 junto con el correo). */
function hash_codigo(string $correo, string $codigo): string
{
    return hash('sha256', $correo . '|' . $codigo);
}

/** "juan.perez@alumnos.udg.mx" → "ju•••@alumnos.udg.mx" */
function enmascarar(string $correo): string
{
    [$usuario, $dominio] = explode('@', $correo, 2);
    return mb_substr($usuario, 0, 2) . '•••@' . $dominio;
}

/** "juan.perez1234@alumnos.udg.mx" → "Juan Perez" (hasta que entre con Google). */
function nombre_de_correo(string $correo): string
{
    $usuario = explode('@', $correo)[0];
    $limpio  = trim(preg_replace('/[^a-záéíóúñü]+/iu', ' ', $usuario));
    return $limpio === '' ? $usuario : mb_convert_case($limpio, MB_CASE_TITLE, 'UTF-8');
}

function asunto_codigo(string $proposito, string $codigo): string
{
    return $proposito === 'clave'
        ? "$codigo es tu código para la contraseña del panel POLIMAP"
        : "$codigo es tu código para entrar a POLIMAP";
}

function texto_codigo(string $proposito, string $codigo): string
{
    $para = $proposito === 'clave' ? 'crear o recuperar tu contraseña del panel' : 'entrar a POLIMAP';
    return "Tu código para $para es: $codigo\n\nVence en " . CODIGO_MINUTOS . " minutos. "
         . "Si tú no lo pediste, ignora este correo: nadie puede entrar sin el código.";
}

function html_codigo(string $proposito, string $codigo): string
{
    $para = $proposito === 'clave' ? 'crear o recuperar tu contraseña del panel' : 'entrar a POLIMAP';
    $digitos = implode(' ', str_split($codigo, 3));
    return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;text-align:center">'
         . '<div style="background:#14203A;color:#fff;padding:18px;border-radius:14px 14px 0 0;font-size:20px;font-weight:bold">POLIMAP</div>'
         . '<div style="border:1px solid #dce3ed;border-top:0;padding:24px;border-radius:0 0 14px 14px">'
         . "<p style=\"margin:0 0 12px;color:#14203A\">Tu código para $para es:</p>"
         . "<p style=\"margin:0;font-size:34px;letter-spacing:6px;font-weight:bold;color:#E5233D\">$digitos</p>"
         . '<p style="margin:16px 0 0;color:#5d6980;font-size:13px">Vence en ' . CODIGO_MINUTOS . ' minutos. '
         . 'Si tú no lo pediste, ignora este correo: nadie puede entrar sin el código.</p></div></div>';
}

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------

/** Revisión rápida para cuando algo no funciona en el hosting. */
function diagnostico(): void
{
    global $CONFIG;
    $resultado = [
        'ok'                   => true,
        'googleClientIdPuesto' => !empty($CONFIG['google_client_id']),
        'correoActivo'         => correo_activo(),
        'opensslDisponible'    => function_exists('openssl_verify'),
        'curlDisponible'       => function_exists('curl_init'),
        'horaServidor'         => ahora(),
    ];
    try {
        db()->query('SELECT 1 FROM usuarios LIMIT 1');
        db()->query('SELECT 1 FROM codigos_acceso LIMIT 1');
        $resultado['cuentasMaestras'] = (int) db()->query("SELECT COUNT(*) FROM accesos WHERE rol = 'maestro'")->fetchColumn();
        $resultado['tablasNuevas'] = true;
    } catch (Throwable $e) {
        $resultado['tablasNuevas'] = false;   // falta importar sql/migracion-login.sql
    }
    try {
        $resultado['certificadosGoogle'] = count(certificados_google());
    } catch (Throwable $e) {
        $resultado['certificadosGoogle'] = 'ERROR: ' . $e->getMessage();
    }
    responder($resultado);
}
