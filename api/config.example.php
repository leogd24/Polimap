<?php
/**
 * POLIMAP — Configuración de ejemplo.
 *
 * CÓMO USARLO:
 *   1. Copia este archivo y renómbralo a "config.php" (en la misma carpeta api/).
 *   2. Pon tus datos reales en config.php.
 *   3. config.php NO se sube a GitHub (está en .gitignore) porque tiene contraseñas.
 *
 * Con XAMPP recién instalado el usuario es "root" y la contraseña va vacía.
 */
return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'polimap',
    'db_user' => 'root',
    'db_pass' => '',

    // Orígenes que pueden llamar a la API desde el navegador (CORS).
    // Con el proxy de Vite no hace falta, pero sirve si abres la app en otro puerto.
    'cors_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],

    // Clave para cambiar el estado de los reportes (PATCH). Cámbiala por una larga.
    // En el Avance 2 se reemplaza por el inicio de sesión con usuarios_admin.
    'admin_token' => 'cambia-esta-clave',

    // Fotos de reportes
    'upload_dir'    => __DIR__ . '/uploads',
    'upload_url'    => '/api/uploads',   // ruta pública con la que React pide la foto
    'upload_max_mb' => 2,
];
