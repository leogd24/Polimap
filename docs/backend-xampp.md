# POLIMAP — Cómo levantar el backend en tu compu (XAMPP)

Responsable: Alexis. Contrato de datos: [contrato-datos.md](contrato-datos.md).

## 1. Una sola vez

1. Instala **XAMPP** (trae Apache, MySQL/MariaDB, PHP y phpMyAdmin).
2. Clona el repo **dentro de htdocs**, para que Apache vea la carpeta `api/`:
   ```
   cd C:\xampp\htdocs
   git clone https://github.com/leogd24/Polimap.git
   cd Polimap
   npm install
   ```
   (Si ya lo tenías en otra carpeta, muévelo aquí, o cambia `XAMPP_FOLDER` en `vite.config.js`.)
3. Abre el panel de XAMPP y da **Start** a **Apache** y **MySQL**.
4. Entra a http://localhost/phpmyadmin → pestaña **Importar** → elige `sql/polimap.sql` → **Importar**.
   Se crea la base `polimap` con los 10 edificios, trámites y el FAQ.
5. En la carpeta `api/`, copia `config.example.php` y renómbrala a `config.php`.
   Con XAMPP recién instalado no hay que cambiar nada (usuario `root`, sin contraseña).
   Cambia `admin_token` por una clave tuya.

## 2. Cada vez que trabajes

1. XAMPP: Apache y MySQL encendidos.
2. `npm run dev` y abre http://localhost:5173

## 3. Probar que la API funciona

Abre en el navegador (debe salir JSON, no una página):

| URL | Qué debe salir |
|---|---|
| http://localhost/Polimap/api/edificios.php | Los 10 edificios |
| http://localhost/Polimap/api/edificios.php?number=1 | Solo el edificio 1 con 12 trámites |
| http://localhost/Polimap/api/faq.php | 6 preguntas con `keywords` |
| http://localhost/Polimap/api/avisos.php | 1 aviso de prueba |
| http://localhost:5173/api/faq.php | Lo mismo, pero pasando por el proxy de Vite |

Crear un reporte de prueba (en la consola del navegador, F12, con la app abierta en localhost:5173):
```js
const fd = new FormData();
fd.set('categoria', 'banos');
fd.set('descripcion', 'Prueba: el lavabo gotea');
fd.set('edificio_number', '3');
fetch('/api/reportes.php', { method: 'POST', body: fd }).then(r => r.json()).then(console.log);
// → { ok: true, folio: "POLI-2026-0001", estado: "recibido", ... }
```

Ver "Mis reportes": http://localhost/Polimap/api/reportes.php?folios=POLI-2026-0001

Cambiar estado (panel admin), también en la consola:
```js
fetch('/api/reportes.php', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'TU-CLAVE-DE-config.php' },
  body: JSON.stringify({ folio: 'POLI-2026-0001', estado: 'proceso', comentarioAdmin: 'Ya se avisó' }),
}).then(r => r.json()).then(console.log);
```

## 4. Errores comunes

| Error | Causa |
|---|---|
| `Falta api/config.php` | No copiaste `config.example.php` a `config.php` |
| `No se pudo conectar a la base de datos` | MySQL apagado en XAMPP, o no importaste `polimap.sql` |
| 404 en `localhost/Polimap/api/...` | El repo no está en `C:\xampp\htdocs\Polimap` |
| La app funciona pero sale `[api] ... usando datos locales` en la consola | La API no responde; la app usa `src/data/` como respaldo (es normal si XAMPP está apagado) |
