-- =====================================================================
-- POLIMAP — Migración: "A mí también me pasa" (apoyos a reportes)
-- Archivo: sql/migracion-apoyos.sql        Responsable: Alexis
--
-- Para la base que YA tiene datos (InfinityFree), DESPUÉS de migracion-login.sql.
-- No borra nada. Se importa UNA sola vez:
--   phpMyAdmin → elige la base (if0_..._polimap) → Importar → este archivo.
-- En tu compu (XAMPP) basta con volver a importar sql/polimap.sql.
-- =====================================================================
SET NAMES utf8mb4;

-- Un alumno se suma a un reporte existente (uno por alumno y reporte).
CREATE TABLE IF NOT EXISTS reportes_apoyos (
  reporte_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reporte_id, usuario_id),
  KEY idx_apoyos_usuario (usuario_id),
  CONSTRAINT fk_apoyos_reporte FOREIGN KEY (reporte_id)
    REFERENCES reportes(id) ON DELETE CASCADE,
  CONSTRAINT fk_apoyos_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El historial ahora también anota cuando alguien se suma.
ALTER TABLE reportes_historial
  MODIFY accion ENUM('creado','estado','prioridad','comentario','apoyo') NOT NULL;

-- Listo. Revisa que exista la tabla reportes_apoyos.
