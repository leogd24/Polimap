<?php
/**
 * POLIMAP — Sesiones y permisos.
 *
 * Se incluye DESPUÉS de database.php:
 *   require __DIR__ . '/database.php';
 *   require __DIR__ . '/sesion.php';
 *
 * ¿Cómo sabe la API quién eres?
 *   Al iniciar sesión, auth.php crea un token al azar y lo manda en una
 *   cookie "polimap_sesion" (HttpOnly: JavaScript no la puede leer).
 *   En la tabla sesiones guardamos solo el HASH de ese token.
 *   En cada petición, el navegador manda la cookie solito y aquí buscamos
 *   a qué usuario pertenece.
 *
 * ¿Qué puede hacer cada quien? (se calcula con el correo en cada petición,
 * así que si quitas a alguien de la lista, pierde el acceso al instante)
 *   - Sin sesión (invitado): ver mapa, edificios, horarios, asistente, avisos.
 *   - app:     REPORTAR. Correo @alumnos.udg.mx, o correo en accesos con
 *              rol 'prueba', o cualquier administrador.
 *   - admin:   panel. Correo @academicos.udg.mx que esté en accesos con
 *              rol 'admin', o la cuenta maestra.
 *   - maestro: correo en accesos con rol 'maestro' (cuenta del equipo para
 *              pruebas y exposición). Además agrega y quita correos de la lista.
 */

const COOKIE_SESION = 'polimap_sesion';

/** Dominio de un correo en minúsculas: "ana@alumnos.udg.mx" → "alumnos.udg.mx". */
function dominio_de(string $correo): string
{
    $arroba = strrpos($correo, '@');
    return $arroba === false ? '' : strtolower(substr($correo, $arroba + 1));
}

/** Permisos de un correo: ['app' => bool, 'admin' => bool, 'maestro' => bool, 'tipo' => '...']. */
function permisos_de(string $correo): array
{
    global $CONFIG;
    $correo     = strtolower(trim($correo));
    $dominio    = dominio_de($correo);
    $alumnos    = strtolower($CONFIG['dominio_alumnos'] ?? 'alumnos.udg.mx');
    $academicos = strtolower($CONFIG['dominio_academicos'] ?? 'academicos.udg.mx');

    $stmt = db()->prepare('SELECT rol FROM accesos WHERE correo = ?');
    $stmt->execute([$correo]);
    $rolLista = $stmt->fetchColumn() ?: null;

    $maestro = $rolLista === 'maestro';
    $admin   = $maestro || ($rolLista === 'admin' && $dominio === $academicos);
    $app     = $admin || $dominio === $alumnos || $rolLista === 'prueba';

    $tipo = 'ninguno';
    if ($maestro) $tipo = 'maestro';
    elseif ($admin) $tipo = 'admin';
    elseif ($dominio === $alumnos) $tipo = 'alumno';
    elseif ($rolLista === 'prueba') $tipo = 'prueba';
    elseif ($dominio === $academicos) $tipo = 'academico';

    return ['app' => $app, 'admin' => $admin, 'maestro' => $maestro, 'tipo' => $tipo];
}

/** El usuario de la cookie (con 'permisos'), o null si no hay sesión válida. */
function usuario_actual(): ?array
{
    static $cache = false;
    if ($cache !== false) return $cache;

    $token = $_COOKIE[COOKIE_SESION] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return $cache = null;
    }
    $stmt = db()->prepare(
        'SELECT u.id, u.correo, u.nombre, u.foto
           FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.token_hash = ? AND s.expira_en > ?'
    );
    $stmt->execute([hash('sha256', $token), ahora()]);
    $usuario = $stmt->fetch();
    if (!$usuario) {
        return $cache = null;
    }
    $usuario['id'] = (int) $usuario['id'];
    $usuario['permisos'] = permisos_de($usuario['correo']);
    return $cache = $usuario;
}

/** Crea la sesión en la base y manda la cookie. */
function crear_sesion(int $usuarioId): void
{
    global $CONFIG;
    $dias  = (int) ($CONFIG['sesion_dias'] ?? 30);
    $token = bin2hex(random_bytes(32));   // 64 caracteres al azar
    db()->prepare('INSERT INTO sesiones (token_hash, usuario_id, creado_en, expira_en) VALUES (?, ?, ?, ?)')
        ->execute([hash('sha256', $token), $usuarioId, ahora(), ahora($dias * 86400)]);
    poner_cookie($token, time() + $dias * 86400);

    // De vez en cuando borramos las sesiones vencidas (limpieza).
    if (random_int(1, 20) === 1) {
        db()->prepare('DELETE FROM sesiones WHERE expira_en < ?')->execute([ahora()]);
    }
}

/** Borra la sesión actual (cerrar sesión). */
function cerrar_sesion(): void
{
    $token = $_COOKIE[COOKIE_SESION] ?? '';
    if (preg_match('/^[a-f0-9]{64}$/', $token)) {
        db()->prepare('DELETE FROM sesiones WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
    poner_cookie('', time() - 3600);
}

function poner_cookie(string $valor, int $expira): void
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie(COOKIE_SESION, $valor, [
        'expires'  => $expira,
        'path'     => '/',
        'secure'   => $https,   // en InfinityFree (HTTPS) solo viaja cifrada
        'httponly' => true,     // JavaScript no la puede leer
        'samesite' => 'Lax',    // otros sitios no la pueden usar para mandar formularios
    ]);
}

// ---------------------------------------------------------------------------
// Candados para los endpoints
// ---------------------------------------------------------------------------

/** Alumno (o prueba/admin): lo que se pide para REPORTAR. Corta con 401/403 si no. */
function exigir_app(): array
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión con tu correo @alumnos.udg.mx para reportar', 401);
    if (!$u['permisos']['app']) error_json('Tu cuenta no tiene acceso a POLIMAP', 403);
    return $u;
}

/** Administrador del panel. */
function exigir_admin(): array
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión', 401);
    if (!$u['permisos']['admin']) error_json('Tu cuenta no está autorizada para el panel', 403);
    return $u;
}

/** Administrador maestro (maneja la lista de accesos). */
function exigir_maestro(): array
{
    $u = exigir_admin();
    if (!$u['permisos']['maestro']) error_json('Solo el administrador maestro puede hacer esto', 403);
    return $u;
}

/** Lo que el frontend puede ver de un usuario. */
function usuario_publico(array $u): array
{
    return [
        'id'       => (int) $u['id'],
        'correo'   => $u['correo'],
        'nombre'   => $u['nombre'],
        'foto'     => $u['foto'],
        'tipo'     => $u['permisos']['tipo'],
        'permisos' => [
            'app'     => $u['permisos']['app'],
            'admin'   => $u['permisos']['admin'],
            'maestro' => $u['permisos']['maestro'],
        ],
    ];
}
