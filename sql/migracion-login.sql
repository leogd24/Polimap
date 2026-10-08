-- =====================================================================
-- POLIMAP — Migración: login (Google, código por correo, contraseña de admin) + panel v2
-- Archivo: sql/migracion-login.sql        Responsable: Alexis
--
-- ¿Para qué es?
--   Para la base que YA tiene datos (InfinityFree). NO borra edificios,
--   FAQ, avisos ni reportes: solo agrega tablas y columnas nuevas.
--
-- Cómo usarlo (una sola vez):
--   phpMyAdmin → elige la base (if0_..._polimap) → pestaña "Importar"
--   → este archivo → "Importar".
--
-- En tu compu (XAMPP) es más fácil volver a importar sql/polimap.sql,
-- que ya trae todo esto (pero borra los reportes de prueba).
-- =====================================================================
SET NAMES utf8mb4;

-- 1) Usuarios que entran con Google ------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  correo        VARCHAR(190)  NOT NULL,
  nombre        VARCHAR(120)  NOT NULL DEFAULT '',
  foto          VARCHAR(500)  NULL,
  google_sub    VARCHAR(64)   NULL,
  creado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo),
  UNIQUE KEY uq_usuarios_sub (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Sesiones (solo se guarda el hash del token) ------------------------
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash  CHAR(64)     NOT NULL,
  usuario_id  INT UNSIGNED NOT NULL,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en   DATETIME     NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sesiones_expira (expira_en),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Correos designados: cuenta maestra, profesores admin y de prueba --
--    clave_hash = contraseña del panel (bcrypt). Nunca se escribe a mano:
--    se crea desde admin.html con un código que llega al correo.
CREATE TABLE IF NOT EXISTS accesos (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo            VARCHAR(190) NOT NULL,
  rol               ENUM('maestro','admin','prueba') NOT NULL,
  nota              VARCHAR(120) NOT NULL DEFAULT '',
  clave_hash        VARCHAR(255) NULL,
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME     NULL,
  agregado_por      VARCHAR(190) NOT NULL DEFAULT '',
  creado_en         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accesos_correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuenta maestra (pruebas y exposición). Entra sin contraseña la primera vez
-- con "Crear o recuperar contraseña" en admin.html.
INSERT IGNORE INTO accesos (correo, rol, nota, agregado_por) VALUES
  ('polimap505@gmail.com', 'maestro', 'Cuenta maestra del equipo (pruebas y exposición)', 'sql');

-- 3b) Códigos de 6 dígitos que se mandan por correo -----------------------
CREATE TABLE IF NOT EXISTS codigos_acceso (
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

-- 4) Columnas nuevas en reportes -----------------------------------------
ALTER TABLE reportes
  ADD COLUMN prioridad   ENUM('baja','media','alta') NOT NULL DEFAULT 'media' AFTER comentario_admin,
  ADD COLUMN usuario_id  INT UNSIGNED NULL AFTER prioridad,
  ADD COLUMN resuelto_en DATETIME NULL AFTER actualizado_en,
  ADD KEY idx_reportes_usuario (usuario_id),
  ADD CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL;

-- Los reportes que ya existían: fuga y riesgo pasan a prioridad alta,
-- y los resueltos toman su última actualización como fecha de solución.
UPDATE reportes SET prioridad = 'alta' WHERE categoria IN ('fuga', 'riesgo');
UPDATE reportes SET resuelto_en = COALESCE(actualizado_en, creado_en) WHERE estado = 'resuelto';

-- 5) Historial de cambios -------------------------------------------------
CREATE TABLE IF NOT EXISTS reportes_historial (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporte_id     INT UNSIGNED NOT NULL,
  usuario_id     INT UNSIGNED NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Los reportes viejos también aparecen en el historial como "creado".
INSERT INTO reportes_historial (reporte_id, accion, valor_nuevo, creado_en)
SELECT id, 'creado', estado, creado_en FROM reportes;

-- 6) La tabla vieja de usuario/contraseña ya no se usa --------------------
DROP TABLE IF EXISTS usuarios_admin;

-- Listo. Revisa: deben existir las tablas usuarios, sesiones, accesos,
-- codigos_acceso y reportes_historial; reportes debe tener prioridad,
-- usuario_id y resuelto_en; y en accesos debe estar polimap505@gmail.com.
