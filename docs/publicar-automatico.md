# POLIMAP — Publicación automática en InfinityFree

Responsable: Alexis. Archivo: `.github/workflows/publicar-infinityfree.yml`.

## Qué hace
Cada vez que se hace **Merge** de un Pull Request a `main`, GitHub:
1. instala las dependencias y revisa que los `.php` no tengan errores,
2. construye la app (`npm run build`),
3. sube el contenido de `dist/` a `htdocs/` y la carpeta `api/` a `htdocs/api/` por FTP.

Se acabó subir archivos a mano en el File Manager.

**Nunca sube ni borra:** `api/config.php` (contraseñas), `api/uploads/` (fotos de reportes) ni los certificados de Google en `api/cache/`.

**Lo que sigue siendo a mano:** los cambios de base de datos (`sql/migracion-*.sql`) se importan en phpMyAdmin, y `config.php` del servidor se edita en el File Manager.

## Configurarlo (una sola vez, lo hace quien es admin del repo: Leo)

1. En InfinityFree: **Client Area → tu cuenta → FTP Details**. Ahí salen:
   - **FTP Hostname:** `ftpupload.net`
   - **FTP Username:** `if0_43027495`
   - **FTP Password:** la contraseña de la cuenta de hosting (botón "Show").
2. En GitHub: **Polimap → Settings → Secrets and variables → Actions → New repository secret**. Crear 3:

   | Name | Secret |
   |---|---|
   | `FTP_SERVER` | `ftpupload.net` |
   | `FTP_USERNAME` | `if0_43027495` |
   | `FTP_PASSWORD` | la contraseña de FTP (nadie más la ve; ni en los registros aparece) |

3. Listo. La contraseña **no** va en ningún archivo ni en el chat.

## Probarlo
- **GitHub → Actions → "Publicar en InfinityFree" → Run workflow** (rama `main`).
- Debe terminar en verde ✅ (2–5 minutos; la primera vez tarda más porque sube todo).
- Abre https://polimap.ct.ws en incógnito y revisa que se vea lo nuevo.

## Si falla
| Paso en rojo | Qué revisar |
|---|---|
| Instalar dependencias | `package-lock.json` desactualizado: corre `npm install` en tu compu y súbelo |
| Revisar los PHP | El mensaje dice el archivo y la línea con el error |
| Construir la app | Mismo error que te saldría con `npm run build` en tu compu |
| Subir… (FTP) | Usuario o contraseña mal en los secretos, o InfinityFree tardó: vuelve a darle **Re-run jobs** |

Cada publicación queda en la pestaña **Actions** con quién la hizo y qué commit subió.
