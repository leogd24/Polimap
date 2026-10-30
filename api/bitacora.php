<?php
/**
 * POLIMAP — Bitácora del panel.   Responsable: Alexis
 *
 * bitacora('aviso', 'crear', 'Feria de ciencias', 'Con 2 fotos · fijado');
 *
 * Guarda QUIÉN (la sesión actual, o el correo que se pase) hizo QUÉ y CUÁNDO.
 * La lee api/historial.php (sección "Historial de cambios" del panel).
 * Los cambios de reportes NO van aquí: siguen en reportes_historial.
 *
 * Si la tabla todavía no existe (falta importar sql/polimap.sql), no
 * truena nada: solo no se guarda.
 *
 * tipo:   aviso | comentario | acceso | sesion
 * accion: crear, editar, borrar, notificar, ocultar, mostrar, pausar,
 *         quitar_pausa, agregar, quitar, nota, reset_clave, desbloquear,
 *         invitar, entrar, clave_incorrecta, bloqueo, clave_creada
 */
function bitacora(string $tipo, string $accion, string $objeto = '', string $detalle = '', ?int $usuarioId = null, ?string $correo = null): void
{
    try {
        if ($usuarioId === null && function_exists('usuario_actual')) {
            $u = usuario_actual();
            if ($u) {
                $usuarioId = $u['id'];
                $correo ??= $u['correo'];
            }
        }
        db()->prepare(
            'INSERT INTO bitacora (usuario_id, correo, tipo, accion, objeto, detalle, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $usuarioId,
            $correo ? mb_substr($correo, 0, 190) : null,
            $tipo,
            mb_substr($accion, 0, 40),
            $objeto !== '' ? mb_substr($objeto, 0, 190) : null,
            $detalle !== '' ? mb_substr($detalle, 0, 255) : null,
            ahora(),
        ]);
    } catch (Throwable $e) {
        error_log('POLIMAP bitácora: ' . $e->getMessage());
    }
}
