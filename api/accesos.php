<?php
/**
 * POLIMAP — Lista de accesos (solo el administrador maestro)
 *
 *   GET    /api/accesos.php   → { accesos, usuarios }
 *   POST   /api/accesos.php   { "correo": "...", "rol": "admin" | "prueba", "nota": "..." }
 *   DELETE /api/accesos.php   { "id": 3 }   (se manda como POST ?_method=DELETE)
 *
 * rol 'admin'  → profesor que podrá entrar al panel. Debe ser @academicos.udg.mx.
 *                Su contraseña la crea él mismo con un código que le llega al correo.
 * rol 'prueba' → cualquier correo que podrá reportar en la app como alumno
 *                (evaluadores, compañeros que prueban con Gmail).
 *
 * Las cuentas con rol 'maestro' NO se agregan ni se quitan desde aquí: solo
 * con SQL en phpMyAdmin (así nadie deja el panel sin dueño por accidente).
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';

$maestro = exigir_maestro();

switch (metodo_http()) {
    case 'GET':    listar_accesos(); break;
    case 'POST':   agregar_acceso($maestro); break;
    case 'DELETE': quitar_acceso(); break;
    default:       error_json('Método no permitido', 405);
}

function listar_accesos(): void
{
    global $CONFIG;
    $pdo = db();

    $accesos = $pdo->query(
        "SELECT a.id, a.correo, a.rol, a.nota, a.agregado_por, a.creado_en,
                (a.clave_hash IS NOT NULL) AS tiene_clave, u.nombre, u.ultimo_acceso
           FROM accesos a LEFT JOIN usuarios u ON u.correo = a.correo
          ORDER BY FIELD(a.rol, 'maestro', 'admin', 'prueba'), a.correo"
    )->fetchAll();

    // Resumen de quién ha entrado (para la tarjeta de usuarios del panel).
    $usuarios = $pdo->query(
        'SELECT correo, nombre, ultimo_acceso FROM usuarios ORDER BY ultimo_acceso DESC LIMIT 50'
    )->fetchAll();
    $total = (int) $pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();

    responder([
        'accesos'  => array_map(fn ($a) => [
            'id'          => (int) $a['id'],
            'correo'      => $a['correo'],
            'rol'         => $a['rol'],
            'nota'        => $a['nota'],
            'tieneClave'  => (bool) $a['tiene_clave'],   // ya creó su contraseña del panel
            'agregadoPor' => $a['agregado_por'],
            'createdAt'   => iso($a['creado_en']),
            'nombre'      => $a['nombre'],            // null si todavía no entra
            'lastLogin'   => iso($a['ultimo_acceso']),
        ], $accesos),
        'usuarios' => [
            'total'    => $total,
            'recientes' => array_map(fn ($u) => [
                'correo'    => $u['correo'],
                'nombre'    => $u['nombre'],
                'tipo'      => permisos_de($u['correo'])['tipo'],
                'lastLogin' => iso($u['ultimo_acceso']),
            ], $usuarios),
        ],
    ]);
}

function agregar_acceso(array $maestro): void
{
    global $CONFIG;
    $d      = leer_json();
    $correo = strtolower(trim((string) ($d['correo'] ?? '')));
    $rol    = (string) ($d['rol'] ?? '');
    $nota   = mb_substr(trim((string) ($d['nota'] ?? '')), 0, 120);
    $academicos = strtolower($CONFIG['dominio_academicos'] ?? 'academicos.udg.mx');

    if (!filter_var($correo, FILTER_VALIDATE_EMAIL) || mb_strlen($correo) > 190) {
        error_json('Escribe un correo válido');
    }
    if (!in_array($rol, ['admin', 'prueba'], true)) {
        error_json('Rol no válido (admin o prueba)');
    }
    if ($rol === 'admin' && dominio_de($correo) !== $academicos) {
        error_json("Los administradores deben tener correo @$academicos");
    }
    $existe = db()->prepare('SELECT 1 FROM accesos WHERE correo = ?');
    $existe->execute([$correo]);
    if ($existe->fetchColumn()) error_json('Ese correo ya está en la lista', 409);

    db()->prepare('INSERT INTO accesos (correo, rol, nota, agregado_por, creado_en) VALUES (?, ?, ?, ?, ?)')
        ->execute([$correo, $rol, $nota, $maestro['correo'], ahora()]);
    responder(['ok' => true, 'id' => (int) db()->lastInsertId()], 201);
}

function quitar_acceso(): void
{
    $id = (int) (leer_json()['id'] ?? 0);
    // La cuenta maestra no se quita desde el panel (solo con SQL).
    $stmt = db()->prepare("DELETE FROM accesos WHERE id = ? AND rol <> 'maestro'");
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) error_json('No existe ese acceso o es la cuenta maestra', 404);
    responder(['ok' => true]);
}
