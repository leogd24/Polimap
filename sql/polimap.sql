-- =====================================================================
-- POLIMAP — Base de datos COMPLETA en UN SOLO ARCHIVO
-- (MySQL / MariaDB de XAMPP, utf8mb4)
-- Archivo: sql/polimap.sql        Responsable: Alexis
--
-- Trae TODO:
--   - las 24 tablas con sus llaves primarias y foráneas,
--   - los datos iniciales (edificios, preguntas del asistente, aviso de
--     bienvenida y cuenta maestra),
--   - el acomodo de las tablas en el Diseñador de phpMyAdmin (al final).
--
-- Cómo usarlo (localhost/phpmyadmin):
--   Página principal de phpMyAdmin (sin elegir base) → pestaña "Importar" →
--   este archivo → "Importar". Listo.
--   Para ver las relaciones: base "polimap" → Diseñador → Abrir página → POLIMAP.
--
-- ⚠️ BORRA todas las tablas de "polimap" y las crea de nuevo (se pierden los datos).
--    (No usa DROP DATABASE porque phpMyAdmin lo tiene desactivado.)
--
-- Optimizado (sin cambiar lo que hace la app):
--   - espacios + servicios + trámites  → edificio_info (columna "tipo")
--   - avisos_fotos + avisos_archivos   → avisos_adjuntos (columna "tipo")
--   - avisos_encuestas                 → columnas encuesta* dentro de avisos
--   - comentarios_silenciados          → columnas silenciado_* dentro de usuarios
--   - comentarios_reportes + perdidos_reportes → denuncias
--   De 31 tablas a 24, y todas las relaciones con su llave foránea.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS polimap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER DATABASE polimap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE polimap;

SET NAMES utf8mb4;

-- Borrar las tablas que ya hubiera (las de ahora y las de versiones viejas).
-- Sin revisar llaves foráneas mientras tanto, para poder borrarlas en cualquier orden.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS
  accesos, avisos, avisos_adjuntos, avisos_archivos, avisos_comentarios,
  avisos_encuestas, avisos_fotos, avisos_likes, avisos_opciones, avisos_votos,
  bitacora, codigos_acceso, comentarios_reportes, comentarios_silenciados, denuncias,
  edificio_info, edificios, espacios, faq, grupo_consejales,
  grupo_encuadres, grupo_fechas, moderacion_log, perdidos, perdidos_reportes,
  push_suscripciones, reportes, reportes_apoyos, reportes_historial, servicios,
  sesiones, tramites, usuarios, usuarios_admin;

-- =====================================================================
-- 1) CAMPUS
-- =====================================================================

-- 1a) EDIFICIOS. Su llave es el número (1–10), igual que "number" en
--     src/data/campusBuildings.js.
CREATE TABLE edificios (
  number         TINYINT UNSIGNED NOT NULL,
  name           VARCHAR(100)     NOT NULL,
  summary        VARCHAR(200)     NOT NULL DEFAULT '',
  description    TEXT,
  hours          VARCHAR(150)     NOT NULL DEFAULT '',   -- vacío = "Sin información"
  accessibility  VARCHAR(255)     NOT NULL DEFAULT '',
  icon           VARCHAR(50)      NOT NULL DEFAULT 'apartment', -- Material Symbols
  color          VARCHAR(30)      NOT NULL DEFAULT 'blue',      -- clave de theme.js, no hex
  lat            DECIMAL(9,6)     NULL,
  lng            DECIMAL(9,6)     NULL,
  entrance_lat   DECIMAL(9,6)     NULL,                  -- puerta principal (opcional)
  entrance_lng   DECIMAL(9,6)     NULL,
  foto           VARCHAR(255)     NULL,                  -- ej. img/edificios/1.jpg
  PRIMARY KEY (number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1b) LO QUE HAY EN CADA EDIFICIO (antes 3 tablas: espacios, servicios y trámites).
--     tipo 'espacio'  → "spaces"     de la app
--     tipo 'servicio' → "services"
--     tipo 'tramite'  → "procedures" (con "detalles")
CREATE TABLE edificio_info (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  edificio_number TINYINT UNSIGNED NOT NULL,
  tipo            ENUM('espacio','servicio','tramite') NOT NULL,
  nombre          VARCHAR(150)     NOT NULL,
  detalles        TEXT             NULL,                 -- solo trámites
  orden           SMALLINT         NOT NULL DEFAULT 0,   -- orden en que salen en la app
  PRIMARY KEY (id),
  KEY idx_info_edificio (edificio_number, tipo, orden),
  CONSTRAINT fk_info_edificio FOREIGN KEY (edificio_number)
    REFERENCES edificios(number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1c) PREGUNTAS DEL ASISTENTE (Gabo). El edificio es opcional.
CREATE TABLE faq (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  pregunta        VARCHAR(255)     NOT NULL,
  respuesta       TEXT             NOT NULL,
  palabras_clave  VARCHAR(500)     NOT NULL DEFAULT '',  -- separadas por coma
  categoria       ENUM('tramites','ubicaciones','servicios','horarios') NOT NULL DEFAULT 'ubicaciones',
  edificio_number TINYINT UNSIGNED NULL,
  icon            VARCHAR(50)      NOT NULL DEFAULT 'help',
  activo          TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT fk_faq_edificio FOREIGN KEY (edificio_number)
    REFERENCES edificios(number) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2) CUENTAS Y SESIONES
-- =====================================================================

-- 2a) USUARIOS: se crean solos la primera vez que alguien entra (api/auth.php).
--     Los permisos NO se guardan aquí: salen del correo y de la tabla accesos.
--     silenciado_*: un admin le pausó los comentarios y publicaciones (antes
--     tabla comentarios_silenciados).
CREATE TABLE usuarios (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  correo            VARCHAR(190)  NOT NULL,
  nombre            VARCHAR(120)  NOT NULL DEFAULT '',
  foto              VARCHAR(500)  NULL,                  -- foto de perfil de Google
  google_sub        VARCHAR(64)   NULL,                  -- id de la cuenta de Google
  creado_en         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso     DATETIME      NULL,
  silenciado_hasta  DATETIME      NULL,                  -- no puede comentar ni publicar hasta esta fecha
  silenciado_motivo VARCHAR(120)  NULL,
  silenciado_por    VARCHAR(190)  NULL,                  -- correo del admin
  silenciado_en     DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo),
  UNIQUE KEY uq_usuarios_sub (google_sub),
  KEY idx_usuarios_silenciado (silenciado_hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2b) SESIONES: una fila por dispositivo. Se guarda el HASH del token.
CREATE TABLE sesiones (
  token_hash  CHAR(64)     NOT NULL,                     -- sha256 del token de la cookie
  usuario_id  INT UNSIGNED NOT NULL,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en   DATETIME     NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sesiones_expira (expira_en),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2c) ACCESOS: correos DESIGNADOS a mano.
--     'maestro' = cuenta maestra · 'admin' = profesor del panel · 'prueba' = reporta como alumno.
--     La contraseña nunca se escribe a mano: cada quien la crea desde el panel con un código.
CREATE TABLE accesos (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo            VARCHAR(190) NOT NULL,
  rol               ENUM('maestro','admin','prueba') NOT NULL,
  nota              VARCHAR(120) NOT NULL DEFAULT '',
  clave_hash        VARCHAR(255) NULL,                    -- password_hash() de PHP
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME     NULL,                    -- 5 fallos = 15 min
  agregado_por      VARCHAR(190) NOT NULL DEFAULT '',
  creado_en         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accesos_correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2d) CÓDIGOS POR CORREO (6 dígitos; se guarda el hash, duran 10 min, 5 intentos).
CREATE TABLE codigos_acceso (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo      VARCHAR(190) NOT NULL,
  proposito   ENUM('entrar','clave') NOT NULL,
  codigo_hash CHAR(64)     NOT NULL,
  intentos    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ip          VARCHAR(45)  NOT NULL DEFAULT '',
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en   DATETIME     NOT NULL,
  usado_en    DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_codigos_correo (correo, proposito),
  KEY idx_codigos_creado (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3) REPORTES (Katia)
-- =====================================================================

-- 3a) REPORTES. El folio lo genera la API. Debe tener edificio o zona.
CREATE TABLE reportes (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  folio            VARCHAR(20)      NULL,                -- POLI-2026-0001
  categoria        ENUM('basura','mobiliario','banos','fuga','iluminacion','riesgo','otro') NOT NULL,
  edificio_number  TINYINT UNSIGNED NULL,
  zona             VARCHAR(100)     NULL,
  aula             VARCHAR(20)      NULL,                -- salón del esquema ('A05', 'L07'…)
  descripcion      VARCHAR(500)     NOT NULL,
  foto             VARCHAR(255)     NULL,                -- archivo en api/uploads/
  lat              DECIMAL(9,6)     NULL,
  lng              DECIMAL(9,6)     NULL,
  precision_m      SMALLINT UNSIGNED NULL,
  anonimo          TINYINT(1)       NOT NULL DEFAULT 1,
  estado           ENUM('recibido','revision','proceso','resuelto') NOT NULL DEFAULT 'recibido',
  comentario_admin VARCHAR(500)     NULL,
  prioridad        ENUM('baja','media','alta') NOT NULL DEFAULT 'media',
  usuario_id       INT UNSIGNED     NULL,
  creado_en        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME         NULL ON UPDATE CURRENT_TIMESTAMP,
  resuelto_en      DATETIME         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reportes_folio (folio),
  KEY idx_reportes_estado (estado),
  CONSTRAINT fk_reportes_edificio FOREIGN KEY (edificio_number)
    REFERENCES edificios(number) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3b) HISTORIAL de cada reporte (creación y cambios del panel).
CREATE TABLE reportes_historial (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporte_id     INT UNSIGNED NOT NULL,
  usuario_id     INT UNSIGNED NULL,
  accion         ENUM('creado','estado','prioridad','comentario','apoyo') NOT NULL,
  valor_anterior VARCHAR(500) NULL,
  valor_nuevo    VARCHAR(500) NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_historial_fecha (creado_en),
  CONSTRAINT fk_historial_reporte FOREIGN KEY (reporte_id)
    REFERENCES reportes(id) ON DELETE CASCADE,
  CONSTRAINT fk_historial_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3c) APOYOS ("A mí también me pasa"): uno por alumno y por reporte.
CREATE TABLE reportes_apoyos (
  reporte_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reporte_id, usuario_id),
  CONSTRAINT fk_apoyos_reporte FOREIGN KEY (reporte_id)
    REFERENCES reportes(id) ON DELETE CASCADE,
  CONSTRAINT fk_apoyos_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 4) AVISOS como posts (Leo y Alexis)
-- =====================================================================

-- 4a) AVISOS. La encuesta (si tiene) vive aquí mismo (antes tabla avisos_encuestas):
--     encuesta = la pregunta (NULL = sin encuesta).
--     audiencia: todos | consejales (y subconsejales) | solo_consejales.
CREATE TABLE avisos (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo               VARCHAR(150) NOT NULL,
  contenido            TEXT,
  tipo                 ENUM('general','urgente','evento') NOT NULL DEFAULT 'general',
  fijado               TINYINT(1)   NOT NULL DEFAULT 0,
  comentarios_abiertos TINYINT(1)   NOT NULL DEFAULT 1,
  audiencia            ENUM('todos','consejales','solo_consejales','grupo') NOT NULL DEFAULT 'todos',
  grupo                VARCHAR(12)  NULL,                -- audiencia 'grupo': solo ese grupo (ej. 1AM TIN)
  autor_id             INT UNSIGNED NULL,                -- admin o consejal que lo publicó
  creado_en            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_inicio         DATE         NOT NULL,
  fecha_fin            DATE         NOT NULL,
  notificado_en        DATETIME     NULL,                -- cuándo se mandó como notificación
  encuesta             VARCHAR(200) NULL,                -- pregunta de la encuesta
  encuesta_multiple    TINYINT(1)   NOT NULL DEFAULT 0,  -- 1 = varias respuestas
  encuesta_cierra      DATETIME     NULL,                -- NULL = mientras el aviso esté vigente
  PRIMARY KEY (id),
  KEY idx_avisos_vigencia (fecha_inicio, fecha_fin),
  KEY idx_avisos_grupo (grupo),
  CONSTRAINT fk_avisos_autor FOREIGN KEY (autor_id)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4b) FOTOS Y ARCHIVOS de cada aviso (antes avisos_fotos y avisos_archivos).
--     tipo 'foto'    → api/uploads/avisos/<archivo>          (hasta 5)
--     tipo 'archivo' → api/uploads/avisos/archivos/<archivo> (hasta 5; nombre = el original)
CREATE TABLE avisos_adjuntos (
  id        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  aviso_id  INT UNSIGNED     NOT NULL,
  tipo      ENUM('foto','archivo') NOT NULL,
  archivo   VARCHAR(255)     NOT NULL,                   -- nombre al azar en el servidor
  nombre    VARCHAR(150)     NULL,                       -- archivo: nombre original para descargar
  tamano    INT UNSIGNED     NOT NULL DEFAULT 0,         -- archivo: bytes
  orden     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_adjuntos_aviso (aviso_id, tipo, orden),
  KEY idx_adjuntos_archivo (archivo),
  CONSTRAINT fk_adjuntos_aviso FOREIGN KEY (aviso_id)
    REFERENCES avisos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4c) ME GUSTA (uno por persona).
CREATE TABLE avisos_likes (
  aviso_id   INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (aviso_id, usuario_id),
  CONSTRAINT fk_likes_aviso   FOREIGN KEY (aviso_id)   REFERENCES avisos(id)   ON DELETE CASCADE,
  CONSTRAINT fk_likes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4d) COMENTARIOS. padre_id = a qué comentario responde (un nivel).
CREATE TABLE avisos_comentarios (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  aviso_id    INT UNSIGNED      NOT NULL,
  usuario_id  INT UNSIGNED      NOT NULL,
  padre_id    INT UNSIGNED      NULL,
  texto       VARCHAR(500)      NOT NULL,
  estado      ENUM('visible','oculto','borrado') NOT NULL DEFAULT 'visible',
  motivo      VARCHAR(120)      NULL,                   -- por qué se ocultó o borró
  reportes    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  creado_en   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_com_aviso (aviso_id, estado),
  KEY idx_com_usuario (usuario_id, creado_en),
  CONSTRAINT fk_com_aviso   FOREIGN KEY (aviso_id)   REFERENCES avisos(id)             ON DELETE CASCADE,
  CONSTRAINT fk_com_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)           ON DELETE CASCADE,
  CONSTRAINT fk_com_padre   FOREIGN KEY (padre_id)   REFERENCES avisos_comentarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4e) OPCIONES DE LA ENCUESTA (2 a 6 por aviso) y 4f) VOTOS.
CREATE TABLE avisos_opciones (
  id        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  aviso_id  INT UNSIGNED     NOT NULL,
  texto     VARCHAR(100)     NOT NULL,
  orden     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_opciones_aviso (aviso_id, orden),
  CONSTRAINT fk_opcion_aviso FOREIGN KEY (aviso_id) REFERENCES avisos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE avisos_votos (
  opcion_id  INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  aviso_id   INT UNSIGNED NOT NULL,                     -- para contar votantes rápido
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (opcion_id, usuario_id),
  KEY idx_votos_aviso (aviso_id, usuario_id),
  CONSTRAINT fk_voto_opcion  FOREIGN KEY (opcion_id)  REFERENCES avisos_opciones(id) ON DELETE CASCADE,
  CONSTRAINT fk_voto_aviso   FOREIGN KEY (aviso_id)   REFERENCES avisos(id)          ON DELETE CASCADE,
  CONSTRAINT fk_voto_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4g) LO QUE BLOQUEÓ EL FILTRO (groserías, teléfonos…). aviso_id NULL = objetos perdidos.
CREATE TABLE moderacion_log (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  aviso_id   INT UNSIGNED NULL,
  texto      VARCHAR(500) NOT NULL,
  motivo     VARCHAR(40)  NOT NULL,                     -- groseria | amenaza | datos | enlace | spam
  origen     ENUM('comentario','perdido','fecha','aviso') NOT NULL DEFAULT 'comentario', -- dónde lo escribió
  veredicto  ENUM('correcto','error') NULL,             -- lo revisó un admin: bien bloqueado / error del filtro
  revisado_por VARCHAR(190) NULL,
  revisado_en  DATETIME   NULL,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mod_usuario (usuario_id, creado_en),
  KEY idx_mod_revision (veredicto, creado_en),
  CONSTRAINT fk_mod_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_mod_aviso   FOREIGN KEY (aviso_id)   REFERENCES avisos(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 5) OBJETOS PERDIDOS (se borran solos 30 días después de vencer)
-- =====================================================================
CREATE TABLE perdidos (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo            ENUM('perdido','encontrado') NOT NULL,
  titulo          VARCHAR(80)  NOT NULL,
  descripcion     VARCHAR(500) NULL,
  categoria       ENUM('electronica','credencial','ropa','utiles','llaves','botella','dinero','otro') NOT NULL DEFAULT 'otro',
  edificio_number TINYINT UNSIGNED NULL,
  lugar           VARCHAR(100) NULL,
  entrega         VARCHAR(120) NULL,                    -- encontrado: dónde recogerlo
  fecha           DATE         NOT NULL,
  foto            VARCHAR(40)  NULL,                    -- api/uploads/perdidos/<archivo>
  mostrar_correo  TINYINT(1)   NOT NULL DEFAULT 1,
  usuario_id      INT UNSIGNED NOT NULL,
  estado          ENUM('activo','resuelto','oculto') NOT NULL DEFAULT 'activo',
  reportes        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vence_en        DATETIME     NOT NULL,                -- creado + 30 días
  resuelto_en     DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_perdidos_lista (estado, vence_en),
  CONSTRAINT fk_perdido_usuario  FOREIGN KEY (usuario_id)      REFERENCES usuarios(id)      ON DELETE CASCADE,
  CONSTRAINT fk_perdido_edificio FOREIGN KEY (edificio_number) REFERENCES edificios(number) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5b) DENUNCIAS de la comunidad (antes comentarios_reportes y perdidos_reportes):
--     un alumno reporta UN comentario o UNA publicación de perdidos, una sola vez.
--     Con 3 se oculta solo (lo hace la API).
CREATE TABLE denuncias (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  comentario_id INT UNSIGNED NULL,
  perdido_id    INT UNSIGNED NULL,
  usuario_id    INT UNSIGNED NOT NULL,
  motivo        VARCHAR(40)  NOT NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_denuncia_comentario (comentario_id, usuario_id),
  UNIQUE KEY uq_denuncia_perdido (perdido_id, usuario_id),
  CONSTRAINT fk_denuncia_comentario FOREIGN KEY (comentario_id) REFERENCES avisos_comentarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_denuncia_perdido    FOREIGN KEY (perdido_id)    REFERENCES perdidos(id)           ON DELETE CASCADE,
  CONSTRAINT fk_denuncia_usuario    FOREIGN KEY (usuario_id)    REFERENCES usuarios(id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 6) PANEL Y NOTIFICACIONES
-- =====================================================================

-- 6a) BITÁCORA del panel (avisos, comentarios, accesos, entradas y perdidos).
--     Los cambios de reportes van en reportes_historial.
CREATE TABLE bitacora (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NULL,                         -- NULL = alguien sin cuenta
  correo     VARCHAR(190) NULL,
  tipo       ENUM('aviso','comentario','acceso','sesion','perdido') NOT NULL,
  accion     VARCHAR(40)  NOT NULL,                     -- crear, editar, ocultar, entrar…
  objeto     VARCHAR(190) NULL,
  detalle    VARCHAR(255) NULL,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bitacora_fecha (creado_en),
  KEY idx_bitacora_tipo (tipo, creado_en),
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6b) NOTIFICACIONES PUSH: un renglón por celular que tocó "Activar".
CREATE TABLE push_suscripciones (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  endpoint      VARCHAR(600)     NOT NULL,
  endpoint_hash CHAR(64)         NOT NULL,              -- sha256 del endpoint
  p256dh        VARCHAR(120)     NOT NULL,
  auth          VARCHAR(40)      NOT NULL,
  usuario_id    INT UNSIGNED     NULL,                  -- invitados = NULL
  grupo         VARCHAR(20)      NULL,                  -- grupo de Horario (fechas de exámenes)
  creado_en     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_envio  DATETIME         NULL,
  fallos        TINYINT UNSIGNED NOT NULL DEFAULT 0,    -- con 5 fallos seguidos se borra
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_endpoint (endpoint_hash),
  KEY idx_push_grupo (grupo),
  CONSTRAINT fk_push_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 7) GRUPOS: consejales, fechas de exámenes y encuadres
-- =====================================================================

-- 7a) DUETO de cada grupo (consejal + subconsejal), por correo: puede que aún
--     no haya entrado a la app. Un alumno solo tiene un lugar.
CREATE TABLE grupo_consejales (
  grupo        VARCHAR(20)  NOT NULL,                   -- ej. '1AM TIN'
  correo       VARCHAR(190) NOT NULL,                   -- @alumnos.udg.mx
  rol          ENUM('consejal','subconsejal') NOT NULL DEFAULT 'consejal',
  asignado_por INT UNSIGNED NULL,                       -- admin que lo designó
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (grupo, correo),
  KEY idx_consejal_correo (correo),
  CONSTRAINT fk_consejal_admin FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7b) FECHAS del grupo (exámenes, entregas, exposiciones…).
CREATE TABLE grupo_fechas (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  grupo       VARCHAR(20)  NOT NULL,
  tipo        ENUM('examen','entrega','exposicion','practica','otro') NOT NULL DEFAULT 'examen',
  materia     VARCHAR(120) NULL,
  titulo      VARCHAR(120) NOT NULL,
  detalle     VARCHAR(500) NULL,
  fecha       DATE         NOT NULL,
  hora        CHAR(5)      NULL,                        -- 'HH:MM'
  usuario_id  INT UNSIGNED NULL,                        -- quién la publicó
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  editado_en  DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_fechas_grupo (grupo, fecha),
  CONSTRAINT fk_fecha_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7c) ENCUADRE de cada materia (lo sube el consejal; la calculadora lo importa).
CREATE TABLE grupo_encuadres (
  grupo          VARCHAR(20)  NOT NULL,
  materia        VARCHAR(120) NOT NULL,
  criterios      TEXT         NOT NULL,                 -- JSON: [{"nombre":"Examen","porcentaje":40}, …]
  asistencia_min TINYINT UNSIGNED NOT NULL DEFAULT 80,
  usuario_id     INT UNSIGNED NULL,
  actualizado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (grupo, materia),
  CONSTRAINT fk_encuadre_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- DATOS INICIALES
-- =====================================================================
-- Edificios, lo que hay en cada uno y las preguntas del asistente (los mismos
-- que src/data/campusBuildings.js y src/data/faqEntries.js), el aviso de
-- bienvenida y la CUENTA MAESTRA (va sin contraseña: la primera vez entra a
-- admin.html → "Crear o recuperar contraseña" y le llega un código a su correo).

INSERT INTO edificios (number, name, summary, description, hours, accessibility, icon, color, lat, lng, entrance_lat, entrance_lng, foto) VALUES
  (1, 'Atención a alumnos', 'Trámites escolares, PLEX y Coordinación', 'Aquí se atiende a los alumnos para sus trámites escolares. También están las oficinas de PLEX y de Coordinación.', '', '', 'support_agent', 'blue', NULL, NULL, NULL, NULL, NULL),
  (2, 'Edificio 2', 'Biblioteca y auditorio', 'Aquí está la biblioteca. En la planta de arriba está el auditorio.', '', '', 'apartment', 'blueLight', NULL, NULL, NULL, NULL, NULL),
  (3, 'Edificio 3', 'Préstamo de equipo: cable HDMI, computadoras y balones', 'En el segundo piso, del lado derecho, se prestan cables HDMI, computadoras y balones para jugar.', '', '', 'cable', 'goldDark', NULL, NULL, NULL, NULL, NULL),
  (4, 'Edificio 4', 'Aulas y bodega', 'Edificio de aulas. Aquí también está la bodega del plantel.', '', '', 'apartment', 'blueDeep', NULL, NULL, NULL, NULL, NULL),
  (5, 'Edificio 5', 'Psicología, Servicio y Prácticas Profesionales y Oficialía Mayor', '', '', '', 'psychology_alt', 'blueSteel', NULL, NULL, NULL, NULL, NULL),
  (6, 'Edificio 6', 'Aulas y laboratorios', 'Edificio de aulas y laboratorios.', '', '', 'apartment', 'crimson', NULL, NULL, NULL, NULL, NULL),
  (7, 'Edificio 7', 'Aulas, laboratorios y sistema de internet del plantel', 'Edificio de aulas y laboratorios. En el segundo piso está el sistema de internet del Poli.', '', '', 'wifi', 'blue', NULL, NULL, NULL, NULL, NULL),
  (8, 'Edificio 8', 'Estudio de audio y video, laboratorios y oficinas de departamento', 'Aquí están el estudio de audio y video, el laboratorio de sistemas híbridos, el taller de energía eólica y las oficinas de los departamentos de Computación y de Telecomunicaciones y Energías Alternas.', '', '', 'apartment', 'blueLight', NULL, NULL, NULL, NULL, NULL),
  (9, 'Edificio 9', 'Talleres de manufactura y laboratorio de producción', 'Aquí están los talleres de soldadura, máquinas y herramientas y metrología, y el laboratorio de sistemas de producción y control de calidad.', '', '', 'apartment', 'goldDeep', NULL, NULL, NULL, NULL, NULL),
  (10, 'Edificio 10', 'Laboratorios de biotecnología y alimentos', 'Aquí están los laboratorios de biorremediación, fermentación, in vitro y alimentos.', '', '', 'apartment', 'crimsonDark', NULL, NULL, NULL, NULL, NULL);

INSERT INTO edificio_info (edificio_number, tipo, nombre, detalles, orden) VALUES
  (1, 'espacio', 'Atención a alumnos', NULL, 0),
  (1, 'espacio', 'Oficinas de PLEX', NULL, 1),
  (1, 'espacio', 'Coordinación', NULL, 2),
  (1, 'servicio', 'Constancias', NULL, 0),
  (1, 'servicio', 'Kardex', NULL, 1),
  (1, 'servicio', 'Certificados parciales', NULL, 2),
  (1, 'servicio', 'Condonaciones', NULL, 3),
  (1, 'servicio', 'Bajas voluntarias', NULL, 4),
  (1, 'servicio', 'PLEX', NULL, 5),
  (1, 'servicio', 'Coordinación', NULL, 6),
  (1, 'servicio', 'Asesorías', NULL, 7),
  (1, 'tramite', 'Constancias', 'Presenta tu código de alumno.', 0),
  (1, 'tramite', 'Kardex', 'Presenta tu código de alumno.', 1),
  (1, 'tramite', 'Certificados parciales', 'Se te entrega una ficha de pago. Tienes que llevar el recibo de que ya pagaste y fotos para la credencial.', 2),
  (1, 'tramite', 'Condonaciones de orden de pago', 'Lleva tu orden de pago. Ahí te dan una nota y tienes que explicar por qué solicitas la condonación.', 3),
  (1, 'tramite', 'Bajas voluntarias', 'Tiene que venir el alumno; si es menor de edad, acompañado de un tutor. Lleva documentos de identificación, la orden de pago pagada y el formato de pago, y llena el formato indicando el motivo de la baja.', 4),
  (1, 'tramite', 'Consulta de materias', 'Los alumnos pueden revisar sus materias aquí.', 5),
  (1, 'tramite', 'PLEX', 'En las oficinas de PLEX puedes inscribirte y consultar tus calificaciones de PLEX.', 6),
  (1, 'tramite', 'Recuperación de contraseña del correo institucional', 'En Coordinación. Necesitas llevar tu correo institucional, número de teléfono con WhatsApp, código y nombre completo.', 7),
  (1, 'tramite', 'Asesorías de materias irregulares', 'Regístrate en condonación con el formato que te van a dar. También atienden dudas sobre asesorías.', 8),
  (1, 'tramite', 'Atención a alumnos irregulares y honoríficos', 'Los atiende Coordinación.', 9),
  (1, 'tramite', 'Plataforma de Classroom', 'Coordinación le da mantenimiento a la plataforma.', 10),
  (1, 'tramite', 'Desempeño docente', 'Coordinación evalúa el desempeño docente, capacita al personal docente y genera las constancias de desempeño docente.', 11),
  (2, 'espacio', 'Biblioteca', NULL, 0),
  (2, 'espacio', 'Planta alta: auditorio', NULL, 1),
  (2, 'servicio', 'Biblioteca', NULL, 0),
  (2, 'servicio', 'Auditorio', NULL, 1),
  (2, 'tramite', 'Entrar a la biblioteca', 'Te piden tu credencial de la UdeG para ingresar.', 0),
  (3, 'espacio', 'Segundo piso, lado derecho: préstamo de equipo', NULL, 0),
  (3, 'servicio', 'Préstamo de cable HDMI', NULL, 0),
  (3, 'servicio', 'Préstamo de computadoras', NULL, 1),
  (3, 'servicio', 'Préstamo de balones', NULL, 2),
  (3, 'tramite', 'Préstamo de cable HDMI', 'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 0),
  (3, 'tramite', 'Préstamo de computadoras', 'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 1),
  (3, 'tramite', 'Préstamo de balones', 'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 2),
  (4, 'espacio', 'Aulas', NULL, 0),
  (4, 'espacio', 'Bodega', NULL, 1),
  (5, 'espacio', 'Coordinación de Servicio y Prácticas Profesionales', NULL, 0),
  (5, 'espacio', 'Oficina del Oficial Mayor', NULL, 1),
  (5, 'servicio', 'Psicología', NULL, 0),
  (5, 'servicio', 'Servicio y prácticas profesionales', NULL, 1),
  (5, 'servicio', 'Titulación', NULL, 2),
  (5, 'servicio', 'Oficialía Mayor', NULL, 3),
  (5, 'tramite', 'Servicio y prácticas profesionales', 'Aquí está la coordinadora de Servicio y Prácticas Profesionales.', 0),
  (5, 'tramite', 'Titulación', 'Lo atiende la misma coordinación de Servicio y Prácticas Profesionales.', 1),
  (5, 'tramite', 'Oficialía Mayor', 'En este edificio está la oficina del Oficial Mayor.', 2),
  (6, 'espacio', 'Aulas', NULL, 0),
  (6, 'espacio', 'Laboratorios', NULL, 1),
  (7, 'espacio', 'Aulas', NULL, 0),
  (7, 'espacio', 'Laboratorios', NULL, 1),
  (7, 'espacio', 'Segundo piso: sistema de internet del plantel', NULL, 2),
  (7, 'espacio', 'Oficina del maestro a cargo del internet', NULL, 3),
  (7, 'servicio', 'Sistema de internet', NULL, 0),
  (7, 'tramite', 'Sistema de internet del plantel', 'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.', 0),
  (8, 'espacio', 'Estudio de audio y video', NULL, 0),
  (8, 'espacio', 'Laboratorio de sistemas híbridos', NULL, 1),
  (8, 'espacio', 'Taller de energía eólica', NULL, 2),
  (8, 'espacio', 'Oficina del Departamento de Computación', NULL, 3),
  (8, 'espacio', 'Oficina del Departamento de Telecomunicaciones y Energías Alternas', NULL, 4),
  (8, 'servicio', 'Estudio de audio y video', NULL, 0),
  (9, 'espacio', 'Taller de soldadura', NULL, 0),
  (9, 'espacio', 'Taller de máquinas y herramientas', NULL, 1),
  (9, 'espacio', 'Taller de metrología', NULL, 2),
  (9, 'espacio', 'Laboratorio de sistemas de producción y control de calidad', NULL, 3),
  (10, 'espacio', 'Laboratorio de biorremediación', NULL, 0),
  (10, 'espacio', 'Laboratorio de fermentación', NULL, 1),
  (10, 'espacio', 'Laboratorio de in vitro', NULL, 2),
  (10, 'espacio', 'Laboratorio de alimentos', NULL, 3);

INSERT INTO faq (id, pregunta, respuesta, palabras_clave, categoria, edificio_number, icon, activo) VALUES
  (1, '¿Dónde saco mi kardex?', 'En Atención a alumnos (Control Escolar). Solo presenta tu código de alumno.', 'kardex,kardes,cardex,historial,historial academico,calificaciones,boleta', 'tramites', 1, 'description', 1),
  (2, '¿Cómo pido una constancia de estudios?', 'En Atención a alumnos (Control Escolar). Solo presenta tu código de alumno.', 'constancia,constancias,constancia de estudios,comprobante de estudios', 'tramites', 1, 'verified', 1),
  (3, '¿Dónde está Control Escolar?', 'Control Escolar es Atención a alumnos. Ahí se tramitan constancias, kardex, certificados parciales, condonaciones y bajas voluntarias.', 'control escolar,escolar,atencion a alumnos,servicios escolares,tramites,ventanilla', 'ubicaciones', 1, 'badge', 1),
  (4, '¿Cómo saco un certificado parcial?', 'En Atención a alumnos te dan una ficha de pago. Después llevas el recibo de que ya pagaste y fotos para credencial.', 'certificado,certificado parcial,certificados', 'tramites', 1, 'workspace_premium', 1),
  (5, '¿Cómo pido una condonación de mi orden de pago?', 'Lleva tu orden de pago a Atención a alumnos. Ahí te dan una nota en la que explicas por qué solicitas la condonación.', 'condonacion,condonar,orden de pago,no puedo pagar', 'tramites', 1, 'payments', 1),
  (6, '¿Cómo me doy de baja voluntaria?', 'Tienes que ir tú en persona (si eres menor de edad, con tu tutor) a Atención a alumnos. Lleva identificación, la orden de pago ya pagada y el formato de pago, y llena el formato donde explicas el motivo de la baja.', 'baja,baja voluntaria,darme de baja,dejar la escuela,salirme', 'tramites', 1, 'logout', 1),
  (7, '¿Dónde reviso mis materias?', 'En Atención a alumnos puedes revisar tus materias.', 'materias,mis materias,revisar materias,carga academica', 'tramites', 1, 'menu_book', 1),
  (8, '¿Dónde está PLEX?', 'En las oficinas de PLEX puedes inscribirte y consultar tus calificaciones de PLEX.', 'plex,pleks,inscripcion plex,calificaciones plex,ingles,idiomas,lenguas', 'ubicaciones', 1, 'diversity_3', 1),
  (9, 'Olvidé la contraseña de mi correo institucional', 'La recupera Coordinación. Lleva tu correo institucional, un número de teléfono con WhatsApp, tu código y tu nombre completo.', 'contraseña,contrasena,password,correo,correo institucional,olvide,recuperar,no puedo entrar', 'tramites', 1, 'lock_reset', 1),
  (10, '¿Cómo pido asesorías de materias irregulares?', 'Regístrate en condonación con el formato que te van a dar. Las dudas sobre asesorías también las atiende Coordinación.', 'asesoria,asesorias,irregular,materia reprobada,reprobe,extraordinario,regularizar', 'tramites', 1, 'school', 1),
  (11, 'Soy alumno irregular u honorífico, ¿quién me atiende?', 'Te atiende Coordinación.', 'irregular,irregulares,honorifico,honorificos,coordinacion,coordinador', 'servicios', 1, 'support_agent', 1),
  (12, 'Tengo un problema con Classroom', 'Coordinación es quien le da mantenimiento a la plataforma de Classroom.', 'classroom,clasroom,plataforma,google classroom', 'servicios', 1, 'cast_for_education', 1),
  (13, '¿Dónde está Coordinación?', 'Coordinación atiende a alumnos irregulares y honoríficos, recupera contraseñas del correo institucional, da mantenimiento a Classroom y evalúa el desempeño docente.', 'coordinacion,coordinador,coordinadora,desempeño docente,evaluacion docente', 'ubicaciones', 1, 'groups', 1),
  (14, '¿Dónde está Psicología?', 'Psicología brinda orientación y acompañamiento a los alumnos.', 'psicologia,sicologia,psicologo,psicologa,orientacion,apoyo emocional,ansiedad,estres', 'servicios', 5, 'psychology_alt', 1),
  (15, '¿Dónde hago mi servicio social o prácticas profesionales?', 'Ahí está la coordinadora de Servicio y Prácticas Profesionales.', 'servicio social,servicio,practicas,practicas profesionales,liberar servicio', 'tramites', 5, 'work', 1),
  (16, '¿Dónde hago mi trámite de titulación?', 'La titulación la atiende la coordinación de Servicio y Prácticas Profesionales.', 'titulacion,titularme,titulo,egresar', 'tramites', 5, 'school', 1),
  (17, '¿Dónde está Oficialía Mayor?', 'Ahí está la oficina del Oficial Mayor.', 'oficialia,oficialia mayor,oficial mayor', 'ubicaciones', 5, 'account_balance', 1),
  (18, '¿Dónde está la biblioteca?', 'Para entrar a la biblioteca te piden tu credencial de la UdeG.', 'biblioteca,libros,prestamo de libros', 'ubicaciones', 2, 'local_library', 1),
  (19, '¿Dónde está el auditorio?', 'El auditorio está en la planta de arriba, en el mismo edificio que la biblioteca.', 'auditorio,conferencia,ceremonia', 'ubicaciones', 2, 'theater_comedy', 1),
  (20, '¿Dónde pido prestado un cable HDMI?', 'Los cables HDMI se piden en el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 'hdmi,cable,cable hdmi,proyector', 'servicios', 3, 'cable', 1),
  (21, '¿Dónde me prestan una computadora?', 'Las computadoras se piden en el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 'computadora,computadoras,compu,laptop', 'servicios', 3, 'laptop', 1),
  (22, '¿Dónde piden balones para jugar?', 'Los balones se piden en el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 'balon,balones,pelota,prestamo de balon', 'servicios', 3, 'sports_soccer', 1),
  (23, '¿Dónde está la bodega?', 'Ahí está la bodega del plantel.', 'bodega,almacen', 'ubicaciones', 4, 'inventory_2', 1),
  (24, '¿Quién se encarga del internet del Poli?', 'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.', 'internet,wifi,wi fi,sin internet,internet del poli', 'servicios', 7, 'wifi', 1),
  (25, '¿Dónde está el estudio de audio y video?', 'Ahí también están el laboratorio de sistemas híbridos y el taller de energía eólica.', 'estudio,audio,video,grabar,grabacion,sistemas hibridos,eolica,energia eolica', 'ubicaciones', 8, 'videocam', 1),
  (26, '¿Dónde está el Departamento de Computación?', 'Ahí están la oficina del Departamento de Computación y la del Departamento de Telecomunicaciones y Energías Alternas.', 'departamento,computacion,telecomunicaciones,energias alternas,jefe de departamento', 'ubicaciones', 8, 'corporate_fare', 1),
  (27, '¿Dónde están los talleres de soldadura y máquinas?', 'Ahí están los talleres de soldadura, de máquinas y herramientas y de metrología, y el laboratorio de sistemas de producción y control de calidad.', 'taller,talleres,soldadura,maquinas,herramientas,metrologia,control de calidad,manufactura', 'ubicaciones', 9, 'precision_manufacturing', 1),
  (28, '¿Dónde están los laboratorios de biotecnología?', 'Ahí están los laboratorios de biorremediación, fermentación, in vitro y alimentos.', 'biotecnologia,biorremediacion,fermentacion,in vitro,alimentos,laboratorio de alimentos', 'ubicaciones', 10, 'biotech', 1),
  (29, '¿Cómo reporto una incidencia?', 'Abre la sección Reportar, selecciona una categoría, agrega la ubicación y describe el problema.', 'reporte,reportar,incidencia,queja,falla,descompuesto,roto,fuga,basura', 'servicios', NULL, 'add_alert', 1),
  (30, '¿Cómo veo mi horario?', 'En la sección Mi horario eliges tu carrera y tu grupo, y ves tus clases con su salón.', 'horario,horarios,mi horario,clases,mis clases,grupo', 'horarios', NULL, 'calendar_month', 1),
  (31, '¿Cómo encuentro mi salón?', 'Escríbeme la clave del salón tal como aparece en tu horario, por ejemplo "E6-A05" o "Lab E8-L07", y te digo en qué edificio está.', 'salon,salones,aula,mi salon,donde es mi clase,clave del salon', 'horarios', NULL, 'meeting_room', 1),
  (32, '¿Hay rutas accesibles?', 'Todavía estamos registrando la información de accesibilidad de cada edificio. Cuando esté lista aparecerá en la ficha de cada edificio.', 'accesible,accesibilidad,silla de ruedas,rampa,discapacidad,elevador', 'ubicaciones', NULL, 'accessible_forward', 1),
  (33, '¿Qué me prestan en el Poli?', 'En el segundo piso, del lado derecho, prestan cables HDMI, computadoras y balones para jugar. Preséntate con tu credencial del Poli.', 'prestamo,prestamos,prestan,prestar,prestamo de equipo,pedir prestado', 'servicios', 3, 'handshake', 1);

INSERT INTO avisos (titulo, contenido, tipo, fecha_inicio, fecha_fin) VALUES
  ('Bienvenido a POLIMAP', 'Esta es una versión de prueba. Tu campus en la palma de tu mano.', 'general', '2026-09-01', '2026-12-31');

INSERT INTO accesos (correo, rol, nota, agregado_por) VALUES
  ('polimap505@gmail.com', 'maestro', 'Cuenta maestra del equipo (pruebas y exposición)', 'sql');

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- ACOMODO EN EL DISEÑADOR de phpMyAdmin
-- Acomoda las 24 tablas en 6 columnas (Campus, Cuentas, Reportes, Avisos,
-- Comunidad, Panel y grupos) en la página "POLIMAP" del Diseñador.
-- Las líneas de relación salen solas por las FOREIGN KEY de arriba.
-- (Si tu phpMyAdmin no tiene la base "phpmyadmin", esta parte marca error
--  pero las tablas y los datos ya quedaron creados.)
-- =====================================================================
DELETE c FROM phpmyadmin.pma__table_coords c
  JOIN phpmyadmin.pma__pdf_pages p ON p.page_nr = c.pdf_page_number
 WHERE p.db_name = 'polimap' AND p.page_descr = 'POLIMAP';
DELETE FROM phpmyadmin.pma__pdf_pages WHERE db_name = 'polimap' AND page_descr = 'POLIMAP';

INSERT INTO phpmyadmin.pma__pdf_pages (db_name, page_descr) VALUES ('polimap', 'POLIMAP');
SET @pagina = LAST_INSERT_ID();

INSERT INTO phpmyadmin.pma__table_coords (db_name, table_name, pdf_page_number, x, y) VALUES
  ('polimap', 'edificios', @pagina, 30, 30),
  ('polimap', 'edificio_info', @pagina, 30, 361),
  ('polimap', 'faq', @pagina, 30, 572),
  ('polimap', 'usuarios', @pagina, 530, 30),
  ('polimap', 'sesiones', @pagina, 530, 321),
  ('polimap', 'accesos', @pagina, 530, 492),
  ('polimap', 'codigos_acceso', @pagina, 530, 743),
  ('polimap', 'reportes', @pagina, 868, 30),
  ('polimap', 'reportes_historial', @pagina, 868, 521),
  ('polimap', 'reportes_apoyos', @pagina, 868, 772),
  ('polimap', 'avisos', @pagina, 1482, 30),
  ('polimap', 'avisos_adjuntos', @pagina, 1482, 421),
  ('polimap', 'avisos_opciones', @pagina, 1482, 652),
  ('polimap', 'avisos_votos', @pagina, 1482, 803),
  ('polimap', 'avisos_likes', @pagina, 1482, 954),
  ('polimap', 'avisos_comentarios', @pagina, 1928, 30),
  ('polimap', 'denuncias', @pagina, 1928, 281),
  ('polimap', 'moderacion_log', @pagina, 1928, 472),
  ('polimap', 'perdidos', @pagina, 1928, 663),
  ('polimap', 'bitacora', @pagina, 2608, 30),
  ('polimap', 'push_suscripciones', @pagina, 2608, 261),
  ('polimap', 'grupo_consejales', @pagina, 2608, 532),
  ('polimap', 'grupo_fechas', @pagina, 2608, 703),
  ('polimap', 'grupo_encuadres', @pagina, 2608, 994);
