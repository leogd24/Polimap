# POLIMAP — Inicio de sesión, invitados y administradores

Responsable: Alexis. Rama: `alexis/login`.

## 1. Quién puede hacer qué

| Quién | Cómo entra | Qué puede hacer |
|---|---|---|
| **Invitado** (familias, visitantes) | Botón "Entrar como invitado" | Ver mapa, edificios, horarios, avisos y asistente. **No reporta.** |
| **Alumno** `@alumnos.udg.mx` | Google (principal) o código de 6 dígitos al correo (respaldo) | Todo lo anterior + **reportar** y ver sus reportes |
| **Correo de prueba** (cualquier dominio) | Igual que alumno | Igual que alumno. Sirve para evaluadores. Lo agrega la cuenta maestra |
| **Profesor admin** `@academicos.udg.mx` **designado** | Panel: correo + contraseña, o Google | Panel completo, menos "Accesos" |
| **Cuenta maestra** (`polimap505@gmail.com`) | Panel: correo + contraseña | Todo, incluida la sección "Accesos" (agregar/quitar profesores) |

Un profesor que **no** está en la tabla `accesos` no entra al panel aunque su correo sea `@academicos.udg.mx`.

## 2. Tablas nuevas (ver `sql/polimap.sql`)

- `usuarios`: quien ha iniciado sesión (correo, nombre, foto). Se llena sola.
- `sesiones`: una por dispositivo. Guarda el **hash** del token de la cookie.
- `accesos`: **correos designados**. Columnas importantes:
  - `rol`: `maestro`, `admin` o `prueba`.
  - `clave_hash`: contraseña del panel cifrada con bcrypt. **Nunca se escribe a mano.**
  - `intentos_fallidos`, `bloqueado_hasta`: 5 contraseñas malas seguidas = 15 min bloqueado.
- `codigos_acceso`: los códigos de 6 dígitos (solo su hash). Duran 10 min y aguantan 5 intentos.
- `reportes` ganó `prioridad`, `usuario_id` y `resuelto_en`; `reportes_historial` guarda cada cambio.

## 3. Cómo poner correos designados en la base de datos

**Opción A (recomendada): desde el panel.** Entra con la cuenta maestra → sección **Accesos** → escribe el correo, elige "Profesor administrador" y toca **Agregar**.

**Opción B: en phpMyAdmin.** Elige la base → pestaña **SQL** → pega y cambia el correo:

```sql
-- Profesor que podrá usar el panel (debe ser @academicos.udg.mx)
INSERT INTO accesos (correo, rol, nota, agregado_por)
VALUES ('ma.gutierrez3142@academicos.udg.mx', 'admin', 'Mtra. de Redes', 'phpMyAdmin');

-- Correo de prueba (puede reportar como alumno, cualquier dominio)
INSERT INTO accesos (correo, rol, nota, agregado_por)
VALUES ('evaluador@gmail.com', 'prueba', 'Evaluador del avance', 'phpMyAdmin');

-- Otra cuenta maestra (solo si de verdad hace falta)
INSERT INTO accesos (correo, rol, nota, agregado_por)
VALUES ('otro.correo@gmail.com', 'maestro', 'Respaldo del equipo', 'phpMyAdmin');

-- Ver quién está designado y si ya creó contraseña
SELECT correo, rol, nota, clave_hash IS NOT NULL AS tiene_clave FROM accesos;

-- Quitar a alguien
DELETE FROM accesos WHERE correo = 'evaluador@gmail.com';

-- Desbloquear a alguien que se equivocó 5 veces
UPDATE accesos SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE correo = 'polimap505@gmail.com';
```

Los correos se guardan **en minúsculas**.

## 4. Contraseñas del panel (cada admin crea la suya)

Nadie escribe contraseñas en el código ni en SQL. El flujo es:

1. Entrar a `https://polimap.ct.ws/admin.html`.
2. Tocar **"¿Primera vez u olvidaste tu contraseña? Créala aquí"**.
3. Escribir el correo designado → **Mandarme un código** (llega de `polimap505@gmail.com`; revisar spam).
4. Escribir el código y la contraseña nueva dos veces (mínimo 8 caracteres) → queda guardada y entra al panel.

Para olvidos se repite el mismo paso. También sirve para desbloquear una cuenta.

### Cuenta maestra para pruebas y la exposición
- Ya viene en la base: `polimap505@gmail.com`, rol `maestro`, **sin contraseña**.
- Alexis crea la contraseña una sola vez con el paso de arriba (el código llega a ese Gmail).
- Esa contraseña se comparte **solo en privado** con quien hará la demo (Raúl/Marcos), nunca en el grupo ni en el chat.
- La cuenta maestra también puede reportar en la app.

## 5. Login con Google (una sola vez, 10 minutos)

1. Entra a https://console.cloud.google.com con **polimap505@gmail.com**.
2. Crea un proyecto llamado `POLIMAP`.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo **Externo**, nombre "POLIMAP", correo de soporte `polimap505@gmail.com`. Alcances: solo los básicos (email, profile, openid). Publícala ("En producción"); con esos alcances no pide revisión de Google.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - Orígenes autorizados de JavaScript:
     - `https://polimap.ct.ws`
     - `http://localhost:5173`
     - `http://localhost`
   - (No hace falta URI de redirección.)
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pégalo en `google_client_id` de `api/config.php` del **servidor**. El ID de cliente no es secreto.

> Si al probar con un correo `@alumnos.udg.mx` Google dice que **la organización bloquea la app**, no hay que hacer nada más: el botón "¿No funciona Google? Recibe un código" funciona igual con el correo institucional.

## 6. Instalar en InfinityFree (paso a paso)

1. **Base de datos** (una sola vez): phpMyAdmin → elegir `if0_43027495_polimap` → **Importar** → `sql/migracion-login.sql`. No borra los reportes que ya existen.
2. **API**: sube a `htdocs/api/` los archivos nuevos o cambiados: `auth.php`, `sesion.php`, `google.php`, `accesos.php`, `avisos.php`, `reportes.php`, `database.php`, `notificar.php` y la carpeta `cache/` (con su `.htaccess`).
   **No subas** `config.php`: edita el del servidor a mano y agrega estas líneas (y borra `'admin_token'`, que ya no se usa):
   ```php
   'google_client_id'   => 'EL-ID-DE-CLIENTE.apps.googleusercontent.com',
   'dominio_alumnos'    => 'alumnos.udg.mx',
   'dominio_academicos' => 'academicos.udg.mx',
   'sesion_dias'        => 30,
   'modo_dev_login'     => false,
   'cache_dir'          => __DIR__ . '/cache',
   ```
   El correo (`'correo' => [... 'activo' => true ...]`) ya está configurado y ahora también manda los códigos.
3. **App**: `npm run build` → borra `htdocs/assets` → sube el **contenido** de `dist/`.
4. Revisión rápida: abre `https://polimap.ct.ws/api/auth.php?diagnostico=1`. Debe decir `tablasNuevas: true`, `cuentasMaestras: 1`, `correoActivo: true` y `certificadosGoogle` con un número.

## 7. Cómo probar

**App** (`https://polimap.ct.ws`, en incógnito):
1. Aparece la bienvenida → **Entrar como invitado** → navega Inicio, Mapa, Edificios y Horario.
2. Pestaña **Reportar** → dice "Inicia sesión para reportar" → **Iniciar sesión**.
3. **¿No funciona Google? Recibe un código** → tu correo `@alumnos.udg.mx` → escribe el código → ya aparece el formulario.
4. Envía un reporte → sale el folio. Debe llegar el aviso a `polimap505@gmail.com`.
5. Con un Gmail normal debe decir "Para reportar entra con tu correo institucional @alumnos.udg.mx".

**Panel** (`https://polimap.ct.ws/admin.html`):
1. Cuenta maestra → "Créala aquí" → código → contraseña → entra.
2. **Accesos** → agrega un profesor. Ese profesor crea su contraseña con su propio código.
3. Prueba 5 contraseñas malas → sale "Demasiados intentos" (se quita en 15 min o con "Créala aquí").

**Local (XAMPP)**: en tu `config.php` local pon `'modo_dev_login' => true`. Así el código sale en pantalla ("MODO PRUEBA LOCAL") sin mandar correos, y aparece "Entrar sin Google".

## 8. Seguridad (resumen para el reporte)
- La sesión es una cookie `HttpOnly` + `Secure` + `SameSite=Lax`; en la BD solo está su hash.
- Contraseñas con `password_hash()` (bcrypt). Códigos con hash SHA-256, 10 min, 5 intentos, 1 por minuto y 5 por hora.
- El token de Google se verifica en el servidor (firma, `aud`, `exp`, `email_verified`).
- Los permisos se recalculan en cada petición: si quitas un correo de `accesos`, pierde el acceso de inmediato.
