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

    // --- Inicio de sesión con Google --------------------------------------
    // "ID de cliente" de Google Cloud Console (termina en .apps.googleusercontent.com).
    // NO es secreto (va dentro de la página), pero cada proyecto tiene el suyo.
    // Ver docs/login.md para crearlo.
    'google_client_id' => '',

    // Los administradores y la cuenta maestra NO van aquí: están en la tabla
    // "accesos" de la base de datos (ver docs/login.md). Las contraseñas del
    // panel se guardan cifradas en esa tabla y cada quien crea la suya.

    // Dominios institucionales.
    'dominio_alumnos'    => 'alumnos.udg.mx',     // pueden usar la app
    'dominio_academicos' => 'academicos.udg.mx',  // pueden ser admins (si están en la lista)

    // Cuántos días dura la sesión antes de pedir entrar otra vez.
    'sesion_dias' => 30,

    // SOLO EN TU COMPU: true deja entrar escribiendo un correo, sin Google,
    // y si el correo está apagado, el código de 6 dígitos sale en pantalla.
    // Aunque lo dejes en true, el servidor solo lo acepta desde 127.0.0.1.
    // En InfinityFree déjalo en false.
    'modo_dev_login' => false,

    // Carpeta donde se guardan los certificados públicos de Google.
    'cache_dir' => __DIR__ . '/cache',

    // --- Fotos de reportes ---------------------------------------------------
    'upload_dir'    => __DIR__ . '/uploads',
    'upload_url'    => '/api/uploads',   // ruta pública con la que React pide la foto
    'upload_max_mb' => 2,

    // --- Correo (api/notificar.php) ------------------------------------------
    // Se usa para el aviso de reportes nuevos Y para mandar los códigos de
    // 6 dígitos (entrar sin Google y crear/recuperar contraseña del panel).
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
