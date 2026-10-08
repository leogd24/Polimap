-- =====================================================================
-- POLIMAP — Base de datos (MySQL 8 / MariaDB, utf8mb4)
-- Archivo: sql/polimap.sql        Responsable: Alexis
-- Contrato: docs/contrato-datos.md
--
-- Cómo usarlo:
--   phpMyAdmin → pestaña "Importar" → elegir este archivo → "Importar".
--   Crea la base "polimap" desde cero (BORRA la anterior si existe).
--
-- Los datos de edificios salen tal cual de src/data/campusBuildings.js.
-- =====================================================================

DROP DATABASE IF EXISTS polimap;
CREATE DATABASE polimap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE polimap;

-- ---------------------------------------------------------------------
-- 1) EDIFICIOS: la tabla principal. Su llave es el número (1–10),
--    igual que el campo "number" de campusBuildings.js.
-- ---------------------------------------------------------------------
CREATE TABLE edificios (
  number         TINYINT UNSIGNED NOT NULL,
  name           VARCHAR(100)     NOT NULL,
  summary        VARCHAR(200)     NOT NULL DEFAULT '',
  description    TEXT,
  hours          VARCHAR(150)     NOT NULL DEFAULT '',   -- vacío = "Sin información"
  accessibility  VARCHAR(255)     NOT NULL DEFAULT '',
  icon           VARCHAR(50)      NOT NULL DEFAULT 'apartment', -- Material Symbols
  color          VARCHAR(30)      NOT NULL DEFAULT 'blue',      -- clave de theme.js, no hex
  lat            DECIMAL(9,6)     NULL,                  -- las llena Marcos
  lng            DECIMAL(9,6)     NULL,
  entrance_lat   DECIMAL(9,6)     NULL,                  -- puerta principal (opcional)
  entrance_lng   DECIMAL(9,6)     NULL,
  foto           VARCHAR(255)     NULL,                  -- ej. img/edificios/1.jpg
  PRIMARY KEY (number)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2) ESPACIOS, SERVICIOS y TRÁMITES: listas que pertenecen a un edificio.
--    "edificio_number" es la llave foránea: si se borra el edificio,
--    se borran sus filas (ON DELETE CASCADE). "orden" respeta el orden
--    en que aparecen hoy en la app.
-- ---------------------------------------------------------------------
CREATE TABLE espacios (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  edificio_number TINYINT UNSIGNED NOT NULL,
  nombre          VARCHAR(120)     NOT NULL,
  orden           SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_espacios_edificio FOREIGN KEY (edificio_number)
    REFERENCES edificios(number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE servicios (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  edificio_number TINYINT UNSIGNED NOT NULL,
  nombre          VARCHAR(120)     NOT NULL,
  orden           SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_servicios_edificio FOREIGN KEY (edificio_number)
    REFERENCES edificios(number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tramites (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  edificio_number TINYINT UNSIGNED NOT NULL,
  nombre          VARCHAR(150)     NOT NULL,
  detalles        TEXT,
  orden           SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_tramites_edificio FOREIGN KEY (edificio_number)
    REFERENCES edificios(number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3) FAQ del asistente (Gabo). El edificio es opcional (NULL) y si se
--    borra el edificio la pregunta se queda, solo pierde el enlace.
-- ---------------------------------------------------------------------
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
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4a) USUARIOS: quien entra con su cuenta de Google de la UdG.
--     Se crea solo la primera vez que alguien inicia sesión (api/auth.php).
--     También se crea al entrar con código por correo o con contraseña.
--     Los permisos NO se guardan aquí: se calculan con el correo
--     (@alumnos.udg.mx, @academicos.udg.mx) y la tabla "accesos".
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  correo        VARCHAR(190)  NOT NULL,
  nombre        VARCHAR(120)  NOT NULL DEFAULT '',
  foto          VARCHAR(500)  NULL,                  -- foto de perfil de Google
  google_sub    VARCHAR(64)   NULL,                  -- id único de la cuenta de Google
  creado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo),
  UNIQUE KEY uq_usuarios_sub (google_sub)
) ENGINE=InnoDB;

-- 4b) SESIONES: una fila por dispositivo con sesión abierta.
--     Se guarda el HASH del token (nunca el token): si alguien ve la base,
--     no puede usar las sesiones.
CREATE TABLE sesiones (
  token_hash  CHAR(64)     NOT NULL,                 -- sha256 del token de la cookie
  usuario_id  INT UNSIGNED NOT NULL,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en   DATETIME     NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sesiones_expira (expira_en),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4c) ACCESOS: correos DESIGNADOS a mano (no se pueden registrar solos).
--     rol 'maestro' → cuenta maestra del equipo (pruebas y exposición).
--                     Puede ser de cualquier dominio. Maneja esta lista desde
--                     el panel. Solo se agrega o quita aquí, con SQL.
--     rol 'admin'   → profesor (@academicos.udg.mx) que puede usar el panel.
--     rol 'prueba'  → correo de cualquier dominio que puede reportar en la app
--                     como si fuera alumno (evaluadores, pruebas del equipo).
--     clave_hash    → contraseña del panel. NUNCA se escribe a mano: cada
--                     quien la crea desde admin.html → "Crear o recuperar
--                     contraseña" con un código que le llega a su correo.
CREATE TABLE accesos (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo            VARCHAR(190) NOT NULL,
  rol               ENUM('maestro','admin','prueba') NOT NULL,
  nota              VARCHAR(120) NOT NULL DEFAULT '',     -- ej. "Mtra. de Redes", "Evaluador"
  clave_hash        VARCHAR(255) NULL,                    -- password_hash() de PHP (bcrypt)
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- contraseña mal escrita seguida
  bloqueado_hasta   DATETIME     NULL,                    -- 5 fallos = 15 min sin poder entrar
  agregado_por      VARCHAR(190) NOT NULL DEFAULT '',
  creado_en         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accesos_correo (correo)
) ENGINE=InnoDB;

-- 4d) CÓDIGOS DE ACCESO: los 6 dígitos que se mandan por correo.
--     proposito 'entrar' → alumno que entra sin el botón de Google.
--     proposito 'clave'  → admin que crea o recupera su contraseña.
--     Se guarda el HASH del código, dura 10 minutos y aguanta 5 intentos.
CREATE TABLE codigos_acceso (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo     VARCHAR(190) NOT NULL,
  proposito  ENUM('entrar','clave') NOT NULL,
  codigo_hash CHAR(64)    NOT NULL,
  intentos   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ip         VARCHAR(45)  NOT NULL DEFAULT '',
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en  DATETIME     NOT NULL,
  usado_en   DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_codigos_correo (correo, proposito),
  KEY idx_codigos_creado (creado_en)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4) REPORTES comunitarios (Katia). El folio lo genera la API al guardar.
--    Debe tener edificio_number o zona (lo valida api/reportes.php).
-- ---------------------------------------------------------------------
CREATE TABLE reportes (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  folio            VARCHAR(20)      NULL,                -- POLI-2026-0001
  categoria        ENUM('basura','mobiliario','banos','fuga','iluminacion','riesgo','otro') NOT NULL,
  edificio_number  TINYINT UNSIGNED NULL,
  zona             VARCHAR(100)     NULL,                -- "Explanada", "Otra zona"...
  descripcion      VARCHAR(500)     NOT NULL,
  foto             VARCHAR(255)     NULL,                -- nombre del archivo en api/uploads/
  lat              DECIMAL(9,6)     NULL,
  lng              DECIMAL(9,6)     NULL,
  precision_m      SMALLINT UNSIGNED NULL,
  anonimo          TINYINT(1)       NOT NULL DEFAULT 1,
  estado           ENUM('recibido','revision','proceso','resuelto') NOT NULL DEFAULT 'recibido',
  comentario_admin VARCHAR(500)     NULL,
  prioridad        ENUM('baja','media','alta') NOT NULL DEFAULT 'media',  -- fuga y riesgo entran en 'alta'
  usuario_id       INT UNSIGNED     NULL,                -- quién lo envió (sesión de Google)
  creado_en        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME         NULL ON UPDATE CURRENT_TIMESTAMP,
  resuelto_en      DATETIME         NULL,                -- para el tiempo promedio de solución
  PRIMARY KEY (id),
  UNIQUE KEY uq_reportes_folio (folio),
  KEY idx_reportes_estado (estado),
  KEY idx_reportes_usuario (usuario_id),
  CONSTRAINT fk_reportes_edificio FOREIGN KEY (edificio_number)
    REFERENCES edificios(number) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4e) HISTORIAL: cada cambio que hace un administrador (y la creación).
CREATE TABLE reportes_historial (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporte_id     INT UNSIGNED NOT NULL,
  usuario_id     INT UNSIGNED NULL,                  -- quién hizo el cambio
  accion         ENUM('creado','estado','prioridad','comentario') NOT NULL,
  valor_anterior VARCHAR(500) NULL,
  valor_nuevo    VARCHAR(500) NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_historial_reporte (reporte_id),
  CONSTRAINT fk_historial_reporte FOREIGN KEY (reporte_id)
    REFERENCES reportes(id) ON DELETE CASCADE,
  CONSTRAINT fk_historial_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5) AVISOS (Leo). Se crean y editan desde el panel de administración.
-- ---------------------------------------------------------------------
CREATE TABLE avisos (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo       VARCHAR(150) NOT NULL,
  contenido    TEXT,
  tipo         ENUM('general','urgente','evento') NOT NULL DEFAULT 'general',
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- (La tabla usuarios_admin se quitó: ahora el panel usa la tabla accesos.)

-- =====================================================================
-- DATOS INICIALES (copiados de src/data/)
-- =====================================================================

INSERT INTO edificios (number, name, summary, description, hours, accessibility, icon, color) VALUES
  (1, 'Atención a alumnos', 'Trámites escolares, PLEX y Coordinación', 'Aquí se atiende a los alumnos para sus trámites escolares. También están las oficinas de PLEX y de Coordinación.', '', '', 'support_agent', 'blue'),
  (2, 'Edificio 2', '', '', '', '', 'apartment', 'blueLight'),
  (3, 'Edificio 3', 'Préstamo de cable HDMI', '', '', '', 'cable', 'goldDark'),
  (4, 'Edificio 4', '', '', '', '', 'apartment', 'blueDeep'),
  (5, 'Edificio 5', 'Psicología, Servicio y Prácticas Profesionales y Oficialía Mayor', '', '', '', 'psychology_alt', 'blueSteel'),
  (6, 'Edificio 6', '', '', '', '', 'apartment', 'crimson'),
  (7, 'Edificio 7', 'Sistema de internet del plantel', '', '', '', 'wifi', 'blue'),
  (8, 'Edificio 8', '', '', '', '', 'apartment', 'blueLight'),
  (9, 'Edificio 9', '', '', '', '', 'apartment', 'goldDeep'),
  (10, 'Edificio 10', '', '', '', '', 'apartment', 'crimsonDark');

INSERT INTO espacios (edificio_number, nombre, orden) VALUES
  (1, 'Atención a alumnos', 0),
  (1, 'Oficinas de PLEX', 1),
  (1, 'Coordinación', 2),
  (5, 'Coordinación de Servicio y Prácticas Profesionales', 0),
  (5, 'Oficina del Oficial Mayor', 1),
  (7, 'Segundo piso: sistema de internet del plantel', 0),
  (7, 'Oficina del maestro a cargo del internet', 1);

INSERT INTO servicios (edificio_number, nombre, orden) VALUES
  (1, 'Constancias', 0),
  (1, 'Kardex', 1),
  (1, 'Certificados parciales', 2),
  (1, 'Condonaciones', 3),
  (1, 'Bajas voluntarias', 4),
  (1, 'PLEX', 5),
  (1, 'Coordinación', 6),
  (1, 'Asesorías', 7),
  (3, 'Préstamo de cable HDMI', 0),
  (5, 'Psicología', 0),
  (5, 'Servicio y prácticas profesionales', 1),
  (5, 'Titulación', 2),
  (5, 'Oficialía Mayor', 3),
  (7, 'Sistema de internet', 0);

INSERT INTO tramites (edificio_number, nombre, detalles, orden) VALUES
  (1, 'Constancias', 'Presenta tu código de alumno.', 0),
  (1, 'Kardex', 'Presenta tu código de alumno.', 1),
  (1, 'Certificados parciales', 'Se te entrega una ficha de pago. Tienes que llevar el recibo de que ya pagaste y fotos para la credencial.', 2),
  (1, 'Condonaciones de orden de pago', 'Lleva tu orden de pago. Ahí te dan una nota y tienes que explicar por qué solicitas la condonación.', 3),
  (1, 'Bajas voluntarias', 'Tiene que venir el alumno; si es menor de edad, acompañado de un tutor. Lleva documentos de identificación, la orden de pago pagada y el formato de pago, y llena el formato indicando el motivo de la baja.', 4),
  (1, 'Consulta de materias', 'Los alumnos pueden revisar sus materias aquí.', 5),
  (1, 'PLEX', 'En las oficinas de PLEX puedes inscribirte y consultar tus calificaciones de PLEX.', 6),
  (1, 'Recuperación de contraseña del correo institucional', 'En Coordinación. Necesitas llevar tu correo institucional, número de teléfono con WhatsApp, código y nombre completo.', 7),
  (1, 'Asesorías de materias irregulares', 'Regístrate en condonación con el formato que te van a dar. También atienden dudas sobre asesorías.', 8),
  (1, 'Atención a alumnos irregulares y honoríficos', 'Los atiende Coordinación.', 9),
  (1, 'Plataforma de Classroom', 'Coordinación le da mantenimiento a la plataforma.', 10),
  (1, 'Desempeño docente', 'Coordinación evalúa el desempeño docente, capacita al personal docente y genera las constancias de desempeño docente.', 11),
  (3, 'Préstamo de cable HDMI', 'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 0),
  (5, 'Servicio y prácticas profesionales', 'Aquí está la coordinadora de Servicio y Prácticas Profesionales.', 0),
  (5, 'Titulación', 'Lo atiende la misma coordinación de Servicio y Prácticas Profesionales.', 1),
  (5, 'Oficialía Mayor', 'En este edificio está la oficina del Oficial Mayor.', 2),
  (7, 'Sistema de internet del plantel', 'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.', 0);

-- ⚠️ PENDIENTE (Gabo): las 3 primeras preguntas contradicen campusBuildings.js
--    (ahí el kardex y PLEX están en el edificio 1). Se dejan sin edificio (NULL)
--    y con el texto original hasta confirmarlo en persona.
INSERT INTO faq (pregunta, respuesta, palabras_clave, categoria, edificio_number, icon) VALUES
  ('¿Dónde saco mi kardex?', 'Dirígete a Control Escolar, en el edificio 6. Ahí puedes solicitar kardex y constancias.', 'kardex,kárdex,historial,calificaciones,constancia,control escolar', 'tramites', NULL, 'description'),
  ('¿Dónde está Control Escolar?', 'Está en el edificio 6. Consulta el mapa para ver la ruta desde la entrada principal.', 'control escolar,escolar,constancias,kardex,tramites', 'ubicaciones', NULL, 'badge'),
  ('¿Dónde está PLEX?', 'El módulo de PLEX se encuentra en Servicios Estudiantiles, edificio 8.', 'plex,ingles,inglés,idiomas,lenguas', 'ubicaciones', NULL, 'diversity_3'),
  ('¿Dónde está Psicología?', 'Psicología se encuentra en el edificio 5 y brinda orientación y acompañamiento.', 'psicologia,psicología,psicologo,orientacion,apoyo,acompañamiento', 'servicios', 5, 'psychology_alt'),
  ('¿Cómo reporto una incidencia?', 'Abre la sección Reportar, selecciona una categoría, agrega ubicación y describe el problema.', 'reporte,incidencia,queja,falla,descompuesto,reportar', 'servicios', NULL, 'add_alert'),
  ('¿Hay rutas accesibles?', 'Sí. Activa “Mostrar rutas accesibles” dentro del mapa y consulta el acceso de cada edificio.', 'accesible,accesibilidad,silla de ruedas,rampa,discapacidad,rutas', 'ubicaciones', NULL, 'accessible_forward');

-- Aviso de ejemplo para que Leo pueda probar (bórralo cuando haya reales).
INSERT INTO avisos (titulo, contenido, tipo, fecha_inicio, fecha_fin) VALUES
  ('Bienvenido a POLIMAP', 'Esta es una versión de prueba. Tu campus en la palma de tu mano.', 'general', '2026-09-01', '2026-12-31');

-- ---------------------------------------------------------------------
-- CUENTA MAESTRA (pruebas y exposición). Va SIN contraseña: la primera vez
-- entra a admin.html → "Crear o recuperar contraseña" y le llega un código
-- a este correo. Para agregar profesores, usa el panel (sección Accesos) o:
--   INSERT INTO accesos (correo, rol, nota) VALUES ('nombre@academicos.udg.mx', 'admin', 'Mtra. de Redes');
-- ---------------------------------------------------------------------
INSERT INTO accesos (correo, rol, nota, agregado_por) VALUES
  ('polimap505@gmail.com', 'maestro', 'Cuenta maestra del equipo (pruebas y exposición)', 'sql');
