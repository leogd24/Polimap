# POLIMAP — Publicar en InfinityFree con aviso por correo

Responsable: Alexis. Resultado: `https://TU-SUBDOMINIO.ct.ws` abre POLIMAP desde cualquier
celular, guarda los reportes en MySQL y manda un aviso a polimap505@gmail.com.

## 1. Contraseña de aplicación de Gmail (una sola vez)

1. Entra a la cuenta polimap505@gmail.com → https://myaccount.google.com/security
2. Activa **Verificación en 2 pasos** (con el celular de alguien del equipo).
3. Busca **Contraseñas de aplicaciones** (https://myaccount.google.com/apppasswords).
4. Nombre: `POLIMAP` → **Crear**. Google muestra 16 letras (`abcd efgh ijkl mnop`).
5. Cópialas: van solo en `api/config.php` del servidor. **Nunca** en GitHub ni en el chat.

Tu contraseña normal de Gmail no se usa en ningún lado.

## 2. Cuenta y sitio en InfinityFree

1. Regístrate en https://www.infinityfree.com (con el correo de POLIMAP).
2. **Create Account** → elige un subdominio gratis, por ejemplo `polimap.ct.ws`
   (sin `www` y sin sub-subdominio: esos no tienen HTTPS).
3. Espera a que el sitio quede activo (a veces tarda unos minutos).

## 3. Base de datos

1. Panel → **MySQL Databases** → crea una llamada `polimap`.
   Anota: *MySQL Host* (`sqlXXX.infinityfree.com`), *Database name* (`if0_XXXX_polimap`),
   *Username* (`if0_XXXX`) y la contraseña de la cuenta de hosting.
2. Abre **phpMyAdmin** de esa base.
3. Abre `sql/polimap.sql` en VS Code y **borra estas 3 líneas del principio** (en el
   hosting la base ya existe y no te deja crearla ni borrarla):
   ```sql
   DROP DATABASE IF EXISTS polimap;
   CREATE DATABASE polimap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE polimap;
   ```
   Guarda esa copia como `polimap-hosting.sql` (no la subas a GitHub).
4. phpMyAdmin → **Importar** → `polimap-hosting.sql`.

## 4. Construir la app

En tu compu, dentro de `Polimap`:
```
npm run build
```
Se crea la carpeta `dist/` (la app lista para publicar).

## 5. Subir archivos

Panel → **File Manager** (o FileZilla con los datos FTP del panel). Todo va dentro de `htdocs/`:

```
htdocs/
├── index.html, assets/, icons/, img/, sw.js, manifest.webmanifest, favicon.png   ← el CONTENIDO de dist/
└── api/                                                                           ← tu carpeta api/ completa
    ├── lib/PHPMailer/ ...
    ├── uploads/.htaccess
    ├── config.php        ← créalo aquí (paso 6)
    └── *.php
```
Borra el `index2.html` (o archivo de bienvenida) que InfinityFree pone al crear el sitio.

## 6. `api/config.php` del servidor

Copia `config.example.php` → `config.php` **dentro del servidor** y cambia:

```php
'db_host' => 'sqlXXX.infinityfree.com',
'db_name' => 'if0_XXXX_polimap',
'db_user' => 'if0_XXXX',
'db_pass' => 'contraseña-de-la-cuenta-de-hosting',
'cors_origins' => ['https://polimap.ct.ws'],
'admin_token' => 'una-clave-larga-solo-del-equipo',
'correo' => [
    'activo'    => true,
    'host'      => 'smtp.gmail.com',
    'puerto'    => 587,
    'usuario'   => 'polimap505@gmail.com',
    'clave_app' => 'las 16 letras de Google',
    'para'      => ['polimap505@gmail.com'],
],
```

## 7. Probar (siempre desde el navegador)

| Abre | Debe salir |
|---|---|
| `https://polimap.ct.ws` | La app con el candado de HTTPS |
| `https://polimap.ct.ws/api/edificios.php` | Los 10 edificios en JSON |
| Reporte desde la app (o la consola, F12) | `{ok: true, folio: ..., avisoEnviado: true}` |
| Bandeja de polimap505@gmail.com | Correo "[POLIMAP] POLI-2026-000X · categoría" con la foto |

**No uses Postman ni cURL** para probar: el filtro de seguridad de InfinityFree los bloquea
(al navegador no).

## 8. Si algo falla

| Síntoma | Causa probable |
|---|---|
| `avisoEnviado: false`, pero el reporte sí se guardó | Clave de aplicación mal copiada, `activo` en false, o prueba `puerto => 465` |
| "No se pudo conectar a la base de datos" | Datos de MySQL del paso 3 mal copiados en `config.php` |
| La app carga pero sale "usando datos locales" en la consola | `api/` no está dentro de `htdocs/`, o la app y la API están en dominios distintos |
| Sin candado / no pide ubicación | Entraste con `http://` o con `www.`; usa `https://` sin `www` |
| El correo llega a Spam | Márcalo como "No es spam" una vez |

Plan B el día de la presentación: XAMPP en la laptop con la misma base + video de respaldo.
