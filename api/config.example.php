<?php
/**
 * POLIMAP — Configuración de ejemplo.
 *
 * CÓMO USARLO:
 *   1. Copia este archivo y renómbralo a "config.php" (en la misma carpeta api/).
 *   2. Pon tus datos reales en config.php.
 *   3. config.php NO se sube a GitHub (está en .gitignore) porque tiene contraseñas.
 *
 * En tu compu (XAMPP): usuario "root", contraseña vacía, correo apagado.
 * En InfinityFree: los datos de MySQL salen en su panel ("MySQL Databases").
 */
return [
    // --- Base de datos -------------------------------------------------------
    'db_host' => '127.0.0.1',        // InfinityFree: algo como sql123.infinityfree.com
    'db_port' => 3306,
    'db_name' => 'polimap',          // InfinityFree: algo como if0_12345678_polimap
    'db_user' => 'root',             // InfinityFree: algo como if0_12345678
    'db_pass' => '',                 // InfinityFree: la contraseña de tu cuenta de hosting

    // Orígenes que pueden llamar a la API desde el navegador (CORS).
    // Con el proxy de Vite no hace falta, pero sirve si abres la app en otro puerto.
    'cors_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],

    // Clave para cambiar el estado de los reportes (PATCH). Cámbiala por una larga.
    // En el Avance 2 se reemplaza por el inicio de sesión con usuarios_admin.
    'admin_token' => 'cambia-esta-clave',

    // --- Fotos de reportes ---------------------------------------------------
    'upload_dir'    => __DIR__ . '/uploads',
    'upload_url'    => '/api/uploads',   // ruta pública con la que React pide la foto
    'upload_max_mb' => 2,

    // --- Aviso por correo (api/notificar.php) --------------------------------
    // La clave NO es la contraseña de Gmail: es una "contraseña de aplicación"
    // de 16 letras (Cuenta de Google → Seguridad → Verificación en 2 pasos →
    // Contraseñas de aplicaciones). Ver docs/publicar-infinityfree.md.
    'correo' => [
        'activo'    => false,                      // true en el servidor
        'host'      => 'smtp.gmail.com',
        'puerto'    => 587,                        // si falla, prueba 465
        'usuario'   => 'polimap505@gmail.com',     // la cuenta que envía
        'clave_app' => '',                         // contraseña de aplicación (16 letras)
        'para'      => ['polimap505@gmail.com'],   // quién recibe el aviso (puedes poner varios)
    ],
];
