# POLIMAP — Notificaciones push de avisos

Responsable: Alexis (la tarjeta en Inicio va en la sección de Avisos de Leo).

Cuando un admin publica un aviso con **"Mandar notificación a los celulares"**, les llega una notificación a quienes tocaron **Activar** en Inicio → "Avisos en tu celular". Llega aunque la app esté cerrada. Al tocarla se abre la app en ese aviso (`/?aviso=ID`).

## Dónde funciona
| Dispositivo | ¿Funciona? |
|---|---|
| Android (Chrome, Edge, Samsung Internet, Firefox) | Sí |
| Computadora (Chrome, Edge, Firefox, Safari) | Sí |
| iPhone / iPad | Solo con iOS 16.4 o más nuevo, con la app **instalada** (Safari → Compartir → "Agregar a inicio") y abierta desde ese ícono |

Solo funciona en HTTPS (polimap.ct.ws) o en `localhost`.

## Archivos
| Archivo | Para qué |
|---|---|
| `api/webpush.php` | Cifra y firma los mensajes (RFC 8291 y 8292) **sin librerías**: solo openssl y curl de PHP |
| `api/push.php` | Activar/desactivar en el celular, estado y prueba del panel |
| `api/avisos.php` | Con `"notify": true` manda el aviso a todos los celulares |
| `public/sw.js` | Muestra la notificación y abre la app al tocarla |
| `src/lib/push.js` | Pide permiso y se suscribe (parte del navegador) |
| `src/components/PushCard.jsx` | La tarjeta "Avisos en tu celular" de Inicio |
| `src/admin/NoticesSection.jsx` | Interruptor "Mandar notificación", reenviar y "Enviar prueba a mi celular" |
| `sql/migracion-esquemas-push.sql` | Tabla `push_suscripciones` y columna `avisos.notificado_en` |

## Llaves (VAPID)
- Se crean **solas** la primera vez que alguien toca "Activar", y se guardan en `api/cache/vapid-keys.php`.
- Esa carpeta no se ve desde el navegador (`.htaccess`), no se sube a GitHub y la publicación automática no la toca.
- **No la borres.** Si se borra, se crean llaves nuevas y cada celular tiene que volver a tocar "Activar".
- No hay que poner nada en `config.php`. Opcional: sección `'push'` (ver `config.example.php`).

## Cómo probar
1. Corre `sql/migracion-esquemas-push.sql` en phpMyAdmin (en tu XAMPP y en InfinityFree).
2. Abre `https://polimap.ct.ws/api/auth.php?diagnostico=1`: deben salir `"tablasPush": true` y `"llavesPush": true`.
3. En tu celular Android abre la app, inicia sesión con la cuenta del panel → Inicio → **Activar** → Permitir.
4. En el panel → Avisos de la app → **Enviar prueba a mi celular**. Debe llegarte "POLIMAP · Prueba".
5. Crea un aviso **Urgente** (el interruptor se prende solo) → Publicar. Llega a todos los celulares activados.

En tu compu también se puede probar con `npm run dev` en Chrome (http://localhost:5173): la notificación sale en Windows.

## Si no llega
| Síntoma | Qué revisar |
|---|---|
| La tarjeta dice "Notificaciones bloqueadas" | Candado de la barra de direcciones → Notificaciones → Permitir, y recarga |
| En iPhone no sale el botón "Activar" | La app tiene que estar instalada y abierta desde el ícono |
| El panel dice "0 celulares" | Falta tocar Activar, o falta la migración |
| `llavesPush` con ERROR | El hosting no tiene openssl o no puede escribir en `api/cache` |
| El panel dice "N no se pudieron entregar" | Revisa el log de errores de PHP (InfinityFree → Error logs) |
| Android en ahorro de batería | Puede tardar unos minutos en llegar |
