<?php
/**
 * POLIMAP — ¿Quién puede ver un aviso?   Responsable: Alexis
 * La usan api/avisos.php y api/comentarios.php.
 *
 * Cada aviso tiene una "audiencia" (columna avisos.audiencia):
 *   'todos'            → cualquiera (también invitados)
 *   'consejales'       → consejales y subconsejales de cualquier grupo (y admins)
 *   'solo_consejales'  → solo los consejales titulares (y admins)
 *   'grupo'            → solo un grupo (columna avisos.grupo). Lo publica el consejal
 *                        o subconsejal de ese grupo desde su panel. Lo ve quien eligió
 *                        ese grupo en Horario (la app manda ?grupo=…), sus consejales y
 *                        los admins.
 * Los consejales salen de la tabla grupo_consejales (api/calendario.php).
 * Columnas avisos.audiencia y avisos.grupo (sql/polimap.sql).
 */

// Las que puede elegir un admin en el panel ('grupo' solo la publican los consejales).
const AUDIENCIAS = ['todos', 'consejales', 'solo_consejales'];

/** 'consejal' | 'subconsejal' | null: el rol del usuario en ese grupo. */
function rol_en_grupo(?array $u, string $grupo): ?string
{
    if (!$u) return null;
    $s = db()->prepare('SELECT rol FROM grupo_consejales WHERE grupo = ? AND correo = ?');
    $s->execute([$grupo, strtolower($u['correo'])]);
    return $s->fetchColumn() ?: null;
}

/**
 * Condición SQL para filtrar avisos según quién pregunta. Regresa [sql, params].
 * $alias = alias de la tabla avisos en la consulta (ej. 'a').
 */
/**
 * $grupo: el grupo que la persona eligió en Horario (o null si no eligió).
 *         false = no filtrar los avisos de grupo (para abrir un aviso por su id,
 *         ej. desde una notificación o los comentarios).
 */
function filtro_audiencia(?array $u, string $alias = 'a', $grupo = false): array
{
    if ($u && $u['permisos']['admin']) return ['1 = 1', []];
    $correo = $u ? strtolower($u['correo']) : '';
    if ($grupo === false) {
        $deGrupo = "$alias.audiencia = 'grupo'";
        $extra = [];
    } else {
        $deGrupo = "($alias.audiencia = 'grupo' AND ($alias.grupo = ? OR EXISTS (SELECT 1 FROM grupo_consejales gc WHERE gc.correo = ? AND gc.grupo = $alias.grupo)))";
        $extra = [(string) $grupo, $correo];
    }
    return [
        "($alias.audiencia = 'todos'
          OR ($alias.audiencia = 'consejales' AND EXISTS (SELECT 1 FROM grupo_consejales gc WHERE gc.correo = ?))
          OR ($alias.audiencia = 'solo_consejales' AND EXISTS (SELECT 1 FROM grupo_consejales gc WHERE gc.correo = ? AND gc.rol = 'consejal'))
          OR $deGrupo)",
        array_merge([$correo, $correo], $extra),
    ];
}

/** ¿Esta persona puede ver el aviso $id? (true si aún no existe la columna). */
function puede_ver_aviso(int $id, ?array $u): bool
{
    try {
        [$cond, $params] = filtro_audiencia($u, 'a');
        $s = db()->prepare("SELECT 1 FROM avisos a WHERE a.id = ? AND $cond");
        $s->execute(array_merge([$id], $params));
        return (bool) $s->fetchColumn();
    } catch (Throwable $e) {
        return true;
    }
}

/** Ids de usuario a quienes va dirigido (para la notificación). null = todos. */
function usuarios_de_audiencia(string $audiencia): ?array
{
    if ($audiencia === 'todos' || $audiencia === 'grupo') return null; // 'grupo': se manda por grupo
    $sql = 'SELECT DISTINCT u.id FROM usuarios u JOIN grupo_consejales gc ON gc.correo = u.correo';
    if ($audiencia === 'solo_consejales') $sql .= " WHERE gc.rol = 'consejal'";
    return array_map('intval', db()->query($sql)->fetchAll(PDO::FETCH_COLUMN));
}
