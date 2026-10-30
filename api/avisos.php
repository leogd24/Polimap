<?php
/**
 * POLIMAP — Avisos de la app, como "posts" (sección de Leo; API de Alexis)
 *
 *   GET    /api/avisos.php            → avisos vigentes hoy (público, lo usa Inicio)
 *   GET    /api/avisos.php?id=12      → un aviso (aunque ya no esté vigente)
 *   GET    /api/avisos.php?todos=1    → todos, también los vencidos (admin)
 *   POST   /api/avisos.php            → crear aviso (admin)
 *   PATCH  /api/avisos.php            → editar aviso (admin)  (POST ?_method=PATCH)
 *   DELETE /api/avisos.php            → borrar aviso (admin)  (POST ?_method=DELETE)
 *   POST   /api/avisos.php?accion=foto     (multipart, campo "foto")    → sube una foto (admin)
 *   POST   /api/avisos.php?accion=archivo  (multipart, campo "archivo") → sube un PDF, Word,
 *                                            Excel o PowerPoint (admin, hasta 10 MB)
 *   GET    /api/avisos.php?descargar=ab12….pdf → descarga una foto o archivo con su
 *                                            nombre bonito (público)
 *   POST   /api/avisos.php  { accion: 'like', id }  → me gusta / ya no (con sesión)
 *   POST   /api/avisos.php  { accion: 'votar', id, opciones: [ids] } → votar en la encuesta
 *                                            (con sesión de alumno; se puede cambiar el voto)
 *
 * JSON de cada aviso:
 *   id, title, content, type (general|urgente|evento), startDate, endDate,
 *   photos: ["/api/uploads/avisos/ab12….jpg", …],
 *   files:  [{ name, ext, size, url, download }, …]  (adjuntos; url = el archivo
 *           tal cual, para previsualizar el PDF; download = para descargarlo),
 *   pinned, allowComments, audience ('todos' | 'consejales' | 'solo_consejales'),
 *   likes, liked (si la persona con sesión le dio me gusta), comments, createdAt,
 *   poll: null | { question, multiple, closesAt, closed, voters, myVotes: [ids],
 *                  showResults, options: [{ id, text, votes (null si aún no votas) }] }
 *   (+ vigente y notifiedAt en ?todos)
 *
 * Al crear/editar se manda:
 *   { title, content, type, startDate, endDate, pinned, allowComments, audience,
 *     photos: ["ab12….jpg", …]  (los nombres que regresó ?accion=foto),
 *     files: [{ archivo: "cd34….pdf", nombre: "Convocatoria.pdf" }, …]  (?accion=archivo),
 *     poll: null | { question, multiple, closesAt: 'AAAA-MM-DDTHH:MM' | null,
 *                    options: [{ id?, text }] }   (2 a 6 opciones; null = sin encuesta),
 *     notify }
 *
 * Avisos de GRUPO (los publica el consejal o subconsejal desde su panel en la app):
 *   GET  /api/avisos.php?grupo=1AM%20TIN        → la app manda el grupo elegido en Horario
 *                                                 para incluir los avisos de ese grupo
 *   GET  /api/avisos.php?grupo_panel=1AM%20TIN  → avisos de ese grupo, también vencidos,
 *                                                 con resultados de encuesta (consejales)
 *   POST { accion: 'grupo_publicar', grupo, title, content, type, endDate, allowComments,
 *          poll?, notify }   → pasa por el filtro; la notificación va solo a ese grupo
 *   POST { accion: 'grupo_borrar', id }
 *   JSON: audience = 'grupo' y group = '1AM TIN'.
 *
 * Notificación push: con "notify": true el aviso llega a los celulares que la
 * activaron (api/webpush.php). La respuesta trae "push": { enviadas, … }.
 */
require __DIR__ . '/database.php';
require __DIR__ . '/sesion.php';
require __DIR__ . '/webpush.php';
require __DIR__ . '/bitacora.php';
require __DIR__ . '/audiencia.php';
require __DIR__ . '/moderacion.php';

const TIPOS_AVISO = ['general', 'urgente', 'evento'];
const AVISOS_GRUPO_POR_DIA = 10;     // avisos de grupo por consejal al día
const DIAS_MAX_AVISO_GRUPO = 60;     // un aviso de grupo dura como máximo 60 días
const MAX_FOTOS = 5;
const MAX_ARCHIVOS = 5;
const MIN_OPCIONES = 2;
const MAX_OPCIONES = 6;
const MAX_MB_ARCHIVO = 10;          // InfinityFree acepta archivos de hasta 10 MB
// Extensión → tipo con el que se descarga.
const TIPOS_ARCHIVO = [
    'pdf'  => 'application/pdf',
    'doc'  => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls'  => 'application/vnd.ms-excel',
    'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt'  => 'application/vnd.ms-powerpoint',
    'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

switch (metodo_http()) {
    case 'GET':
        if (isset($_GET['descargar'])) descargar((string) $_GET['descargar']);
        if (!empty($_GET['todos'])) avisos_todos();
        elseif (isset($_GET['grupo_panel'])) avisos_del_grupo((string) $_GET['grupo_panel']);
        elseif (isset($_GET['id'])) un_aviso((int) $_GET['id']);
        else avisos_vigentes();
        break;
    case 'POST':
        if (($_GET['accion'] ?? '') === 'foto') subir_foto();
        if (($_GET['accion'] ?? '') === 'archivo') subir_archivo();
        $d = leer_json();
        if (($d['accion'] ?? '') === 'like') dar_like((int) ($d['id'] ?? 0));
        if (($d['accion'] ?? '') === 'votar') votar($d);
        if (($d['accion'] ?? '') === 'grupo_publicar') publicar_de_grupo($d);
        if (($d['accion'] ?? '') === 'grupo_borrar') borrar_de_grupo($d);
        guardar_aviso(null, $d);
        break;
    case 'PATCH':  $d = leer_json(); guardar_aviso((int) ($d['id'] ?? 0), $d); break;
    case 'DELETE': borrar_aviso(); break;
    default:       error_json('Método no permitido', 405);
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** SELECT común: el aviso + cuántos me gusta y comentarios visibles tiene. */
function sql_avisos(string $donde, string $orden): string
{
    return "SELECT a.id, a.titulo, a.contenido, a.tipo, a.fecha_inicio, a.fecha_fin, a.fijado,
                   a.comentarios_abiertos, a.creado_en, a.notificado_en, a.audiencia, a.grupo, a.autor_id,
                   (SELECT COUNT(*) FROM avisos_likes l WHERE l.aviso_id = a.id) AS likes,
                   (SELECT COUNT(*) FROM avisos_comentarios c WHERE c.aviso_id = a.id AND c.estado = 'visible') AS comentarios
              FROM avisos a
             WHERE $donde
             ORDER BY $orden";
}

/** Consulta avisos respetando la audiencia (solo consejales, etc.; api/audiencia.php). */
function consultar_avisos(string $donde, string $orden, array $params = [], bool $filtrar = true, $grupo = false): array
{
    [$cond, $extra] = $filtrar ? filtro_audiencia(usuario_actual(), 'a', $grupo) : ['1 = 1', []];
    $stmt = db()->prepare(sql_avisos("($donde) AND $cond", $orden));
    $stmt->execute(array_merge($params, $extra));
    return $stmt->fetchAll();
}

function avisos_vigentes(): void
{
    // Primero los fijados, luego los urgentes y luego del más nuevo al más viejo.
    $filas = consultar_avisos(
        '? BETWEEN a.fecha_inicio AND a.fecha_fin',
        "a.fijado DESC, (a.tipo = 'urgente') DESC, a.fecha_inicio DESC, a.id DESC",
        [date('Y-m-d')],
        true,
        grupo_o_null($_GET['grupo'] ?? '')   // los avisos del grupo que eligió en Horario
    );
    responder(con_extras($filas));
}

function un_aviso(int $id): void
{
    $filas = con_extras(consultar_avisos('a.id = ?', 'a.id', [$id]));
    if (!$filas) error_json('No existe ese aviso', 404);
    responder($filas[0]);
}

function avisos_todos(): void
{
    exigir_admin();
    $filas = consultar_avisos('1 = 1', 'a.fijado DESC, a.fecha_fin DESC, a.id DESC', [], false);
    $hoy = date('Y-m-d');
    $lista = con_extras($filas, true);
    // Para el panel: cuántos comentarios están reportados u ocultos en cada aviso.
    $rep = db()->query(
        "SELECT aviso_id, COUNT(*) AS n FROM avisos_comentarios WHERE estado = 'oculto' OR (estado = 'visible' AND reportes > 0) GROUP BY aviso_id"
    )->fetchAll();
    $porAviso = array_column($rep, 'n', 'aviso_id');
    foreach ($lista as $i => $a) {
        $lista[$i]['vigente'] = $filas[$i]['fecha_inicio'] <= $hoy && $hoy <= $filas[$i]['fecha_fin'];
        $lista[$i]['notifiedAt'] = iso($filas[$i]['notificado_en']);
        $lista[$i]['flagged'] = (int) ($porAviso[$a['id']] ?? 0);
    }
    responder($lista);
}

/** Agrega las fotos y si la persona con sesión ya le dio me gusta. */
function con_extras(array $filas, bool $admin = false): array
{
    global $CONFIG;
    if (!$filas) return [];
    $ids = array_map(fn ($a) => (int) $a['id'], $filas);
    $marcas = implode(',', array_fill(0, count($ids), '?'));

    // Fotos y archivos adjuntos: una sola tabla (avisos_adjuntos, columna "tipo").
    $fotos = [];
    $archivos = [];
    $stmt = db()->prepare("SELECT aviso_id, tipo, archivo, nombre, tamano FROM avisos_adjuntos WHERE aviso_id IN ($marcas) ORDER BY aviso_id, orden, id");
    $stmt->execute($ids);
    foreach ($stmt->fetchAll() as $f) {
        if ($f['tipo'] === 'foto') $fotos[(int) $f['aviso_id']][] = $CONFIG['upload_url'] . '/avisos/' . $f['archivo'];
        else $archivos[(int) $f['aviso_id']][] = archivo_json($f);
    }

    $u = usuario_actual();
    $encuestas = encuestas_de($filas, $u, $admin);

    $mios = [];
    if ($u) {
        $stmt = db()->prepare("SELECT aviso_id FROM avisos_likes WHERE usuario_id = ? AND aviso_id IN ($marcas)");
        $stmt->execute(array_merge([$u['id']], $ids));
        $mios = array_flip(array_map('intval', array_column($stmt->fetchAll(), 'aviso_id')));
    }

    return array_map(fn ($a) => [
        'id'            => (int) $a['id'],
        'title'         => $a['titulo'],
        'content'       => $a['contenido'] ?? '',
        'type'          => $a['tipo'],
        'startDate'     => $a['fecha_inicio'],
        'endDate'       => $a['fecha_fin'],
        'photos'        => $fotos[(int) $a['id']] ?? [],
        'files'         => $archivos[(int) $a['id']] ?? [],
        'pinned'        => (bool) $a['fijado'],
        'allowComments' => (bool) $a['comentarios_abiertos'],
        'audience'      => $a['audiencia'] ?? 'todos',
        'group'         => $a['grupo'] ?? null,
        'likes'         => (int) $a['likes'],
        'liked'         => isset($mios[(int) $a['id']]),
        'comments'      => (int) $a['comentarios'],
        'createdAt'     => iso($a['creado_en']),
        'poll'          => $encuestas[(int) $a['id']] ?? null,
    ], $filas);
}

// ---------------------------------------------------------------------------
// Encuestas
// ---------------------------------------------------------------------------

/**
 * Encuestas de varios avisos → [aviso_id => poll]. Los votos de cada opción
 * solo se mandan si la persona ya votó, si la encuesta cerró o si es el panel
 * (así nadie vota "por lo que va ganando").
 */
function encuestas_de(array $filas, ?array $u, bool $admin): array
{
    if (!$filas) return [];
    $ids = array_map(fn ($a) => (int) $a['id'], $filas);
    $finDe = array_column($filas, 'fecha_fin', 'id');
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $pdo = db();
    // La encuesta vive en el mismo aviso (columnas encuesta*); NULL = sin encuesta.
    $e = $pdo->prepare("SELECT id AS aviso_id, encuesta AS pregunta, encuesta_multiple AS multiple, encuesta_cierra AS cierra_en
                          FROM avisos WHERE encuesta IS NOT NULL AND id IN ($marcas)");
    $e->execute($ids);
    $lista = $e->fetchAll();
    if (!$lista) return [];
    $conEncuesta = array_map(fn ($x) => (int) $x['aviso_id'], $lista);
    $m2 = implode(',', array_fill(0, count($conEncuesta), '?'));

    $o = $pdo->prepare(
        "SELECT o.id, o.aviso_id, o.texto, (SELECT COUNT(*) FROM avisos_votos v WHERE v.opcion_id = o.id) AS votos
           FROM avisos_opciones o WHERE o.aviso_id IN ($m2) ORDER BY o.aviso_id, o.orden, o.id"
    );
    $o->execute($conEncuesta);
    $opciones = [];
    foreach ($o->fetchAll() as $f) $opciones[(int) $f['aviso_id']][] = $f;

    $votantes = [];
    $v = $pdo->prepare("SELECT aviso_id, COUNT(DISTINCT usuario_id) AS n FROM avisos_votos WHERE aviso_id IN ($m2) GROUP BY aviso_id");
    $v->execute($conEncuesta);
    foreach ($v->fetchAll() as $f) $votantes[(int) $f['aviso_id']] = (int) $f['n'];

    $mis = [];
    if ($u) {
        $mv = $pdo->prepare("SELECT aviso_id, opcion_id FROM avisos_votos WHERE usuario_id = ? AND aviso_id IN ($m2)");
        $mv->execute(array_merge([$u['id']], $conEncuesta));
        foreach ($mv->fetchAll() as $f) $mis[(int) $f['aviso_id']][] = (int) $f['opcion_id'];
    }

    $salida = [];
    $hoy = date('Y-m-d');
    foreach ($lista as $x) {
        $id = (int) $x['aviso_id'];
        $cerrada = ($x['cierra_en'] && $x['cierra_en'] <= ahora()) || (($finDe[$id] ?? $hoy) < $hoy);
        $misVotos = $mis[$id] ?? [];
        $ver = $admin || $cerrada || $misVotos;
        $salida[$id] = [
            'question'    => $x['pregunta'],
            'multiple'    => (bool) $x['multiple'],
            'closesAt'    => iso($x['cierra_en']),
            'closed'      => $cerrada,
            'voters'      => $votantes[$id] ?? 0,
            'myVotes'     => $misVotos,
            'showResults' => (bool) $ver,
            'options'     => array_map(fn ($op) => [
                'id'    => (int) $op['id'],
                'text'  => $op['texto'],
                'votes' => $ver ? (int) $op['votos'] : null,
            ], $opciones[$id] ?? []),
        ];
    }
    return $salida;
}

/** Votar (o cambiar el voto). { id, opciones: [ids] }; [] = quitar mi voto. */
function votar(array $d): void
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión con tu correo @alumnos.udg.mx para votar', 401);
    if (!$u['permisos']['app']) error_json('Solo las cuentas de alumno pueden votar', 403);
    $id = (int) ($d['id'] ?? 0);
    $pdo = db();
    $s = $pdo->prepare('SELECT id, fecha_fin, encuesta_multiple AS multiple, encuesta_cierra AS cierra_en FROM avisos WHERE id = ? AND encuesta IS NOT NULL');
    $s->execute([$id]);
    $e = $s->fetch();
    if (!$e) error_json('Este aviso no tiene encuesta', 404);
    if (($e['cierra_en'] && $e['cierra_en'] <= ahora()) || $e['fecha_fin'] < date('Y-m-d')) error_json('La encuesta ya cerró', 409);

    $elegidas = array_values(array_unique(array_map('intval', is_array($d['opciones'] ?? null) ? $d['opciones'] : [])));
    if (!$e['multiple'] && count($elegidas) > 1) error_json('En esta encuesta solo se elige una opción');
    if ($elegidas) {
        $marcas = implode(',', array_fill(0, count($elegidas), '?'));
        $ok = $pdo->prepare("SELECT COUNT(*) FROM avisos_opciones WHERE aviso_id = ? AND id IN ($marcas)");
        $ok->execute(array_merge([$id], $elegidas));
        if ((int) $ok->fetchColumn() !== count($elegidas)) error_json('Una de las opciones no es de esta encuesta');
    }

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM avisos_votos WHERE aviso_id = ? AND usuario_id = ?')->execute([$id, $u['id']]);
    $ins = $pdo->prepare('INSERT INTO avisos_votos (opcion_id, usuario_id, aviso_id, creado_en) VALUES (?, ?, ?, ?)');
    foreach ($elegidas as $op) $ins->execute([$op, $u['id'], $id, ahora()]);
    $pdo->commit();

    $f = $pdo->prepare('SELECT id, fecha_fin FROM avisos WHERE id = ?');
    $f->execute([$id]);
    responder(['ok' => true, 'poll' => encuestas_de([$f->fetch()], $u, false)[$id] ?? null]);
}

/** Valida la encuesta que manda el panel. null = sin encuesta. */
function encuesta_del_aviso($p): ?array
{
    if ($p === null || $p === false) return null;
    if (!is_array($p)) error_json('La encuesta no es válida');
    $pregunta = trim((string) ($p['question'] ?? ''));
    if (mb_strlen($pregunta) < 3 || mb_strlen($pregunta) > 200) error_json('La pregunta de la encuesta debe tener de 3 a 200 caracteres');
    $opciones = [];
    $vistas = [];
    foreach ((array) ($p['options'] ?? []) as $o) {
        $texto = trim((string) (is_array($o) ? ($o['text'] ?? '') : $o));
        if ($texto === '') continue;
        if (mb_strlen($texto) > 100) error_json('Cada opción puede tener hasta 100 caracteres');
        $llave = mb_strtolower($texto);
        if (isset($vistas[$llave])) error_json("La opción \"$texto\" está repetida");
        $vistas[$llave] = true;
        $opciones[] = ['id' => is_array($o) && !empty($o['id']) ? (int) $o['id'] : null, 'texto' => $texto];
    }
    if (count($opciones) < MIN_OPCIONES || count($opciones) > MAX_OPCIONES) error_json('La encuesta debe tener de ' . MIN_OPCIONES . ' a ' . MAX_OPCIONES . ' opciones');
    $cierra = null;
    if (!empty($p['closesAt'])) {
        $t = DateTime::createFromFormat('Y-m-d\\TH:i', substr((string) $p['closesAt'], 0, 16));
        if (!$t) error_json('La fecha de cierre de la encuesta no es válida');
        $cierra = $t->format('Y-m-d H:i:00');
    }
    return ['pregunta' => $pregunta, 'multiple' => !empty($p['multiple']) ? 1 : 0, 'cierra' => $cierra, 'opciones' => $opciones];
}

/** Guarda la encuesta de un aviso: conserva las opciones que ya existían (y sus votos). */
function guardar_encuesta(PDO $pdo, int $avisoId, ?array $enc): void
{
    if ($enc === null) {
        // Sin encuesta: se borran sus opciones y votos.
        $pdo->prepare('UPDATE avisos SET encuesta = NULL, encuesta_multiple = 0, encuesta_cierra = NULL WHERE id = ?')->execute([$avisoId]);
        $pdo->prepare('DELETE FROM avisos_votos WHERE aviso_id = ?')->execute([$avisoId]);
        $pdo->prepare('DELETE FROM avisos_opciones WHERE aviso_id = ?')->execute([$avisoId]);
        return;
    }
    $pdo->prepare('UPDATE avisos SET encuesta = ?, encuesta_multiple = ?, encuesta_cierra = ? WHERE id = ?')->execute([$enc['pregunta'], $enc['multiple'], $enc['cierra'], $avisoId]);
    $antes = $pdo->prepare('SELECT id FROM avisos_opciones WHERE aviso_id = ?');
    $antes->execute([$avisoId]);
    $previas = array_map('intval', array_column($antes->fetchAll(), 'id'));
    $quedan = [];
    foreach ($enc['opciones'] as $i => $o) {
        if ($o['id'] && in_array($o['id'], $previas, true)) {
            $pdo->prepare('UPDATE avisos_opciones SET texto = ?, orden = ? WHERE id = ?')->execute([$o['texto'], $i, $o['id']]);
            $quedan[] = $o['id'];
        } else {
            $pdo->prepare('INSERT INTO avisos_opciones (aviso_id, texto, orden) VALUES (?, ?, ?)')->execute([$avisoId, $o['texto'], $i]);
        }
    }
    // Opciones quitadas: se borran con sus votos.
    foreach (array_diff($previas, $quedan) as $quitar) {
        $pdo->prepare('DELETE FROM avisos_votos WHERE opcion_id = ?')->execute([$quitar]);
        $pdo->prepare('DELETE FROM avisos_opciones WHERE id = ?')->execute([$quitar]);
    }
}

// ---------------------------------------------------------------------------
// Me gusta
// ---------------------------------------------------------------------------
function dar_like(int $id): void
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión para dar me gusta', 401);
    $pdo = db();
    $existe = $pdo->prepare('SELECT 1 FROM avisos WHERE id = ?');
    $existe->execute([$id]);
    if (!$existe->fetchColumn()) error_json('No existe ese aviso', 404);

    $ya = $pdo->prepare('SELECT 1 FROM avisos_likes WHERE aviso_id = ? AND usuario_id = ?');
    $ya->execute([$id, $u['id']]);
    if ($ya->fetchColumn()) {
        $pdo->prepare('DELETE FROM avisos_likes WHERE aviso_id = ? AND usuario_id = ?')->execute([$id, $u['id']]);
        $liked = false;
    } else {
        $pdo->prepare('INSERT INTO avisos_likes (aviso_id, usuario_id, creado_en) VALUES (?, ?, ?)')->execute([$id, $u['id'], ahora()]);
        $liked = true;
    }
    $n = $pdo->prepare('SELECT COUNT(*) FROM avisos_likes WHERE aviso_id = ?');
    $n->execute([$id]);
    responder(['ok' => true, 'liked' => $liked, 'likes' => (int) $n->fetchColumn()]);
}

// ---------------------------------------------------------------------------
// Fotos (admin): se suben una por una ANTES de guardar el aviso
// ---------------------------------------------------------------------------
function carpeta_fotos(): string
{
    global $CONFIG;
    $dir = $CONFIG['upload_dir'] . '/avisos';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}

function subir_foto(): void
{
    global $CONFIG;
    exigir_admin();
    $f = $_FILES['foto'] ?? null;
    if (!$f || $f['error'] === UPLOAD_ERR_NO_FILE) error_json('Falta la foto');
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['size'] > $CONFIG['upload_max_mb'] * 1024 * 1024) {
        error_json('La foto pesa más de ' . $CONFIG['upload_max_mb'] . ' MB');
    }
    if ($f['error'] !== UPLOAD_ERR_OK) error_json('No se pudo subir la foto');
    // Se revisa el contenido real del archivo, no la extensión.
    $tipos = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!isset($tipos[$mime])) error_json('La foto debe ser JPG, PNG o WEBP');

    $nombre = bin2hex(random_bytes(12)) . '.' . $tipos[$mime];
    if (!move_uploaded_file($f['tmp_name'], carpeta_fotos() . '/' . $nombre)) error_json('No se pudo guardar la foto', 500);
    responder(['ok' => true, 'archivo' => $nombre, 'url' => $CONFIG['upload_url'] . '/avisos/' . $nombre], 201);
}

/** "/api/uploads/avisos/ab12….jpg" o "ab12….jpg" → "ab12….jpg" (o null si no es válido). */
function nombre_foto($valor): ?string
{
    $base = basename((string) $valor);
    if (!preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $base)) return null;
    return is_file(carpeta_fotos() . '/' . $base) ? $base : null;
}

// ---------------------------------------------------------------------------
// Archivos adjuntos (admin): PDF, Word, Excel y PowerPoint, uno por uno
// ANTES de guardar el aviso (igual que las fotos).
// ---------------------------------------------------------------------------
function carpeta_archivos(): string
{
    $dir = carpeta_fotos() . '/archivos';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}

/** Lo que regresa la API de cada adjunto. */
function archivo_json(array $f): array
{
    global $CONFIG;
    return [
        'name'     => $f['nombre'],
        'ext'      => pathinfo($f['archivo'], PATHINFO_EXTENSION),
        'size'     => (int) $f['tamano'],
        'url'      => $CONFIG['upload_url'] . '/avisos/archivos/' . $f['archivo'],
        'download' => '/api/avisos.php?descargar=' . rawurlencode($f['archivo']),
        'archivo'  => $f['archivo'], // para volver a mandarlo al editar
    ];
}

function subir_archivo(): void
{
    exigir_admin();
    $max = MAX_MB_ARCHIVO * 1024 * 1024;
    $f = $_FILES['archivo'] ?? null;
    // Si el archivo pasa el límite del servidor, PHP deja $_FILES vacío.
    if (!$f && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) error_json('El archivo es demasiado grande para el servidor (máximo ' . MAX_MB_ARCHIVO . ' MB)');
    if (!$f || $f['error'] === UPLOAD_ERR_NO_FILE) error_json('Falta el archivo');
    if (in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $f['size'] > $max) {
        error_json('El archivo pesa más de ' . MAX_MB_ARCHIVO . ' MB');
    }
    if ($f['error'] !== UPLOAD_ERR_OK) error_json('No se pudo subir el archivo');

    // Se revisa el CONTENIDO real (los primeros bytes), no solo la extensión.
    $pedida = strtolower(pathinfo((string) $f['name'], PATHINFO_EXTENSION));
    $ext = tipo_real($f['tmp_name'], $pedida);
    if (!$ext) error_json('Solo se aceptan PDF, Word (.doc, .docx), Excel (.xls, .xlsx) y PowerPoint (.ppt, .pptx)');

    $guardado = bin2hex(random_bytes(12)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], carpeta_archivos() . '/' . $guardado)) error_json('No se pudo guardar el archivo', 500);
    $nombre = nombre_limpio((string) $f['name'], $ext);
    responder(['ok' => true] + archivo_json(['archivo' => $guardado, 'nombre' => $nombre, 'tamano' => (int) $f['size']]), 201);
}

/**
 * Tipo real del archivo según sus primeros bytes:
 *   %PDF-            → pdf
 *   D0 CF 11 E0 …    → Office viejo (doc / xls / ppt): se respeta la extensión pedida
 *   PK + [Content_Types].xml → Office nuevo (docx / xlsx / pptx), según sus carpetas
 * Regresa la extensión o null si no es un tipo permitido.
 */
function tipo_real(string $ruta, string $pedida): ?string
{
    $inicio = (string) file_get_contents($ruta, false, null, 0, 8);
    if (str_starts_with($inicio, '%PDF-')) return 'pdf';
    if ($inicio === "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1") {
        return in_array($pedida, ['doc', 'xls', 'ppt'], true) ? $pedida : null;
    }
    if (str_starts_with($inicio, "PK\x03\x04")) {
        if (class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($ruta) !== true) return null;
            $tipos = $zip->locateName('[Content_Types].xml') !== false;
            $carpeta = $zip->locateName('word/document.xml') !== false ? 'docx'
                : ($zip->locateName('xl/workbook.xml') !== false ? 'xlsx'
                : ($zip->locateName('ppt/presentation.xml') !== false ? 'pptx' : null));
            $macros = $zip->locateName('word/vbaProject.bin') !== false || $zip->locateName('xl/vbaProject.bin') !== false || $zip->locateName('ppt/vbaProject.bin') !== false;
            $zip->close();
            return $tipos && $carpeta && !$macros ? $carpeta : null;
        }
        // Sin ZipArchive: basta con que se vea como Office nuevo y la extensión cuadre.
        $cabeza = (string) file_get_contents($ruta, false, null, 0, 65536);
        return str_contains($cabeza, '[Content_Types].xml') && in_array($pedida, ['docx', 'xlsx', 'pptx'], true) ? $pedida : null;
    }
    return null;
}

/** "C:\\Users\\…\\Convocatoria 2026B.PDF" → "Convocatoria 2026B.pdf" (sin caracteres raros). */
function nombre_limpio(string $original, string $ext, bool $esRuta = true): string
{
    // Algunos navegadores mandan la ruta completa: se queda solo el nombre.
    if ($esRuta) $original = basename(str_replace('\\', '/', $original));
    $base = preg_replace('/\.[A-Za-z0-9]{1,5}$/', '', $original) ?? $original; // sin extensión
    $base = preg_replace('/[\x00-\x1F\x7F"<>:\/\\\\|?*]+/u', ' ', $base) ?? '';
    $base = trim(preg_replace('/\s+/u', ' ', $base) ?? '', ' .');
    if ($base === '') $base = 'archivo';
    return mb_substr($base, 0, 120) . '.' . $ext;
}

/** Valida lo que manda el panel en "files" y regresa [[archivo, nombre, tamano], …]. */
function archivos_del_aviso($lista): array
{
    if (!is_array($lista)) error_json('Los archivos deben ser una lista');
    if (count($lista) > MAX_ARCHIVOS) error_json('Máximo ' . MAX_ARCHIVOS . ' archivos por aviso');
    $salida = [];
    foreach ($lista as $a) {
        $guardado = basename((string) (is_array($a) ? ($a['archivo'] ?? $a['url'] ?? '') : $a));
        if (!preg_match('/^[a-f0-9]{24}\.(' . implode('|', array_keys(TIPOS_ARCHIVO)) . ')$/', $guardado) || !is_file(carpeta_archivos() . '/' . $guardado)) {
            error_json('Uno de los archivos no es válido; vuelve a subirlo');
        }
        $ext = pathinfo($guardado, PATHINFO_EXTENSION);
        $nombre = nombre_limpio((string) (is_array($a) ? ($a['nombre'] ?? $a['name'] ?? '') : ''), $ext, false);
        $salida[] = [$guardado, $nombre, (int) filesize(carpeta_archivos() . '/' . $guardado)];
    }
    return $salida;
}

/**
 * Descarga una foto o archivo de un aviso con un nombre entendible:
 *   archivo → su nombre original ("Convocatoria.pdf")
 *   foto    → "Aviso - Feria de ciencias (1).jpg"
 * "attachment" hace que el celular lo guarde en Descargas en vez de abrirlo.
 */
function descargar(string $valor): void
{
    $base = basename($valor);
    $pdo = db();
    $ruta = null;
    $nombre = null;
    if (preg_match('/^[a-f0-9]{24}\.(' . implode('|', array_keys(TIPOS_ARCHIVO)) . ')$/', $base, $m)) {
        $s = $pdo->prepare("SELECT nombre FROM avisos_adjuntos WHERE tipo = 'archivo' AND archivo = ?");
        $s->execute([$base]);
        $nombre = $s->fetchColumn() ?: null;
        $ruta = carpeta_archivos() . '/' . $base;
        $tipo = TIPOS_ARCHIVO[$m[1]];
    } elseif (preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $base, $m)) {
        $s = $pdo->prepare("SELECT a.titulo, f.orden FROM avisos_adjuntos f JOIN avisos a ON a.id = f.aviso_id WHERE f.tipo = 'foto' AND f.archivo = ?");
        $s->execute([$base]);
        if ($fila = $s->fetch()) {
            $titulo = trim(preg_replace('/[\x00-\x1F\x7F"<>:\/\\\\|?*]+/u', ' ', $fila['titulo']) ?? 'Aviso');
            $nombre = 'Aviso - ' . mb_substr($titulo, 0, 80) . ' (' . ((int) $fila['orden'] + 1) . ').' . $m[1];
        }
        $ruta = carpeta_fotos() . '/' . $base;
        $tipo = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$m[1]];
    }
    if (!$nombre || !$ruta || !is_file($ruta)) error_json('Ese archivo ya no existe', 404);

    // filename = versión sin acentos (navegadores viejos); filename* = el nombre real.
    $ascii = preg_replace('/[^A-Za-z0-9 ._()-]/', '_', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nombre) ?: 'archivo');
    header_remove('Content-Type');
    header('Content-Type: ' . $tipo);
    header('Content-Length: ' . filesize($ruta));
    header('Content-Disposition: attachment; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($nombre));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=86400');
    readfile($ruta);
    exit;
}

// ---------------------------------------------------------------------------
// Crear / editar / borrar (admin)
// ---------------------------------------------------------------------------

/** Crea (id null) o edita un aviso. Ver los campos al inicio del archivo. */
function guardar_aviso(?int $id, array $d): void
{
    $admin = exigir_admin();

    $titulo    = trim((string) ($d['title'] ?? ''));
    $contenido = trim((string) ($d['content'] ?? ''));
    $tipo      = (string) ($d['type'] ?? 'general');
    $inicio    = (string) ($d['startDate'] ?? '');
    $fin       = (string) ($d['endDate'] ?? '');
    $fijado    = !empty($d['pinned']) ? 1 : 0;
    $abiertos  = array_key_exists('allowComments', $d) ? (!empty($d['allowComments']) ? 1 : 0) : 1;
    // Para quién es: todos, consejales y subconsejales, o solo consejales (api/audiencia.php).
    $audiencia = in_array($d['audience'] ?? 'todos', AUDIENCIAS, true) ? ($d['audience'] ?? 'todos') : 'todos';
    // Un aviso de grupo (de un consejal) que edita un admin sigue siendo de ese grupo.
    if ($id !== null && ($d['audience'] ?? '') === 'grupo') {
        $g = db()->prepare("SELECT 1 FROM avisos WHERE id = ? AND audiencia = 'grupo'");
        $g->execute([$id]);
        if ($g->fetchColumn()) $audiencia = 'grupo';
    }

    if (mb_strlen($titulo) < 3 || mb_strlen($titulo) > 150) error_json('El título debe tener de 3 a 150 caracteres');
    if (mb_strlen($contenido) > 2000) error_json('El contenido no puede pasar de 2000 caracteres');
    if (!in_array($tipo, TIPOS_AVISO, true)) error_json('Tipo no válido (general, urgente, evento)');
    if (!fecha_valida($inicio) || !fecha_valida($fin)) error_json('Las fechas deben ser AAAA-MM-DD');
    if ($fin < $inicio) error_json('La fecha final no puede ser antes de la inicial');

    // Fotos: solo nombres que de verdad se subieron con ?accion=foto.
    $fotos = null; // null = no tocar las fotos (edición sin el campo photos)
    if (array_key_exists('photos', $d)) {
        if (!is_array($d['photos'])) error_json('Las fotos deben ser una lista');
        if (count($d['photos']) > MAX_FOTOS) error_json('Máximo ' . MAX_FOTOS . ' fotos por aviso');
        $fotos = [];
        foreach ($d['photos'] as $p) {
            $n = nombre_foto($p);
            if (!$n) error_json('Una de las fotos no es válida; vuelve a subirla');
            $fotos[] = $n;
        }
    }

    // Archivos adjuntos: igual, solo los que de verdad se subieron con ?accion=archivo.
    $archivos = array_key_exists('files', $d) ? archivos_del_aviso($d['files']) : null;
    // Encuesta: solo se toca si viene el campo (null = quitarla).
    $tocaEncuesta = array_key_exists('poll', $d);
    $encuesta = $tocaEncuesta ? encuesta_del_aviso($d['poll']) : null;

    $pdo = db();
    $pdo->beginTransaction();
    if ($id === null) {
        $pdo->prepare(
            'INSERT INTO avisos (titulo, contenido, tipo, fijado, comentarios_abiertos, autor_id, creado_en, fecha_inicio, fecha_fin)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$titulo, $contenido, $tipo, $fijado, $abiertos, $admin['id'], ahora(), $inicio, $fin]);
        $id = (int) $pdo->lastInsertId();
        $codigo = 201;
    } else {
        $existe = $pdo->prepare('SELECT 1 FROM avisos WHERE id = ?');
        $existe->execute([$id]);
        if (!$existe->fetchColumn()) {
            $pdo->rollBack();
            error_json('No existe ese aviso', 404);
        }
        $pdo->prepare(
            'UPDATE avisos SET titulo = ?, contenido = ?, tipo = ?, fijado = ?, comentarios_abiertos = ?, fecha_inicio = ?, fecha_fin = ? WHERE id = ?'
        )->execute([$titulo, $contenido, $tipo, $fijado, $abiertos, $inicio, $fin, $id]);
        $codigo = 200;
    }
    if ($fotos !== null) {
        // Fotos que se quitaron: se borra el archivo también.
        $antes = $pdo->prepare("SELECT archivo FROM avisos_adjuntos WHERE aviso_id = ? AND tipo = 'foto'");
        $antes->execute([$id]);
        $quitadas = array_diff(array_column($antes->fetchAll(), 'archivo'), $fotos);
        $pdo->prepare("DELETE FROM avisos_adjuntos WHERE aviso_id = ? AND tipo = 'foto'")->execute([$id]);
        $ins = $pdo->prepare("INSERT INTO avisos_adjuntos (aviso_id, tipo, archivo, orden) VALUES (?, 'foto', ?, ?)");
        foreach ($fotos as $i => $n) $ins->execute([$id, $n, $i]);
    }
    if ($archivos !== null) {
        $antes = $pdo->prepare("SELECT archivo FROM avisos_adjuntos WHERE aviso_id = ? AND tipo = 'archivo'");
        $antes->execute([$id]);
        $archivosQuitados = array_diff(array_column($antes->fetchAll(), 'archivo'), array_column($archivos, 0));
        $pdo->prepare("DELETE FROM avisos_adjuntos WHERE aviso_id = ? AND tipo = 'archivo'")->execute([$id]);
        $ins = $pdo->prepare("INSERT INTO avisos_adjuntos (aviso_id, tipo, archivo, nombre, tamano, orden) VALUES (?, 'archivo', ?, ?, ?, ?)");
        foreach ($archivos as $i => [$guardado, $nombre, $tamano]) $ins->execute([$id, $guardado, $nombre, $tamano, $i]);
    }
    $pdo->prepare('UPDATE avisos SET audiencia = ? WHERE id = ?')->execute([$audiencia, $id]);
    if ($tocaEncuesta) guardar_encuesta($pdo, $id, $encuesta);
    $pdo->commit();
    if (!empty($quitadas)) foreach ($quitadas as $n) @unlink(carpeta_fotos() . '/' . $n);
    if (!empty($archivosQuitados)) foreach ($archivosQuitados as $n) @unlink(carpeta_archivos() . '/' . $n);

    // Bitácora: qué se hizo con el aviso.
    $detalles = array_filter([
        $tipo !== 'general' ? ucfirst($tipo) : null,
        $fotos ? count($fotos) . ' foto(s)' : null,
        $archivos ? count($archivos) . ' archivo(s)' : null,
        $encuesta ? 'encuesta: ' . mb_strimwidth($encuesta['pregunta'], 0, 50, '…') : null,
        $fijado ? 'fijado' : null,
        $audiencia === 'consejales' ? 'solo consejales y subconsejales' : ($audiencia === 'solo_consejales' ? 'solo consejales' : ($audiencia === 'grupo' ? 'de grupo' : null)),
        $abiertos ? null : 'comentarios cerrados',
        "del $inicio al $fin",
    ]);
    bitacora('aviso', $codigo === 201 ? 'crear' : 'editar', $titulo, implode(' · ', $detalles), $admin['id'], $admin['correo']);

    // Notificación push (opcional): solo si el aviso ya está vigente.
    $push = null;
    if (!empty($d['notify'])) {
        $hoy = date('Y-m-d');
        if ($inicio > $hoy || $fin < $hoy) {
            $push = ['error' => 'El aviso no está vigente hoy: no se mandó la notificación'];
        } else {
            try {
                $push = push_a_suscritos([
                    'title' => ($tipo === 'urgente' ? 'Urgente · ' : '') . $titulo,
                    'body'  => mb_strimwidth($contenido !== '' ? $contenido : 'Toca para ver el aviso en POLIMAP.', 0, 180, '…'),
                    'url'   => '/?aviso=' . $id,
                    'tag'   => 'aviso-' . $id,       // si se reenvía, reemplaza al anterior en el cel
                    'tipo'  => $tipo,
                ], null, $audiencia === 'grupo' ? grupo_del_aviso($id) : null, $audiencia === 'grupo' ? null : usuarios_de_audiencia($audiencia));
                $pdo->prepare('UPDATE avisos SET notificado_en = ? WHERE id = ?')->execute([ahora(), $id]);
                bitacora('aviso', 'notificar', $titulo, 'Enviada a ' . ($push['enviadas'] ?? 0) . ' celular(es)', $admin['id'], $admin['correo']);
            } catch (Throwable $e) {
                error_log('POLIMAP push: ' . $e->getMessage());
                $push = ['error' => 'El aviso se guardó, pero la notificación falló: ' . $e->getMessage()];
            }
        }
    }
    responder(['ok' => true, 'id' => $id, 'push' => $push], $codigo);
}

function borrar_aviso(): void
{
    $admin = exigir_admin();
    $id = (int) (leer_json()['id'] ?? 0);
    $pdo = db();
    $t = $pdo->prepare('SELECT titulo FROM avisos WHERE id = ?');
    $t->execute([$id]);
    $titulo = (string) $t->fetchColumn();
    $s = $pdo->prepare('SELECT tipo, archivo FROM avisos_adjuntos WHERE aviso_id = ?');
    $s->execute([$id]);
    $archivos = [];  // fotos
    $adjuntos = [];  // PDF, Word…
    foreach ($s->fetchAll() as $f) {
        if ($f['tipo'] === 'foto') $archivos[] = $f['archivo'];
        else $adjuntos[] = $f['archivo'];
    }
    // Los comentarios, me gusta, fotos y adjuntos se borran solos (ON DELETE CASCADE).
    $stmt = $pdo->prepare('DELETE FROM avisos WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) error_json('No existe ese aviso', 404);
    foreach ($archivos as $n) @unlink(carpeta_fotos() . '/' . $n);
    foreach ($adjuntos as $n) @unlink(carpeta_archivos() . '/' . $n);
    bitacora('aviso', 'borrar', $titulo, '', $admin['id'], $admin['correo']);
    responder(['ok' => true]);
}

function fecha_valida(string $f): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $f);
    return $d && $d->format('Y-m-d') === $f;
}

// ---------------------------------------------------------------------------
// Avisos de GRUPO (consejal y subconsejal, desde su panel en la app)
// ---------------------------------------------------------------------------
function grupo_del_aviso(int $id): ?string
{
    $s = db()->prepare('SELECT grupo FROM avisos WHERE id = ?');
    $s->execute([$id]);
    return $s->fetchColumn() ?: null;
}

/** Consejal/subconsejal de ese grupo (o admin); si no, corta con 403. */
function exigir_consejal_de(string $grupo): array
{
    $u = usuario_actual();
    if (!$u) error_json('Inicia sesión para publicar en tu grupo', 401);
    if ($u['permisos']['admin'] || rol_en_grupo($u, $grupo)) return $u;
    error_json("Solo el consejal y el subconsejal de $grupo pueden publicar avisos para el grupo.", 403);
}

/** GET ?grupo_panel=1AM TIN → avisos del grupo (también vencidos) para el panel del consejal. */
function avisos_del_grupo(string $valor): void
{
    $grupo = grupo_o_null($valor);
    if (!$grupo) error_json('Grupo no válido (ej. 1AM TIN)');
    exigir_consejal_de($grupo);
    $filas = consultar_avisos("a.audiencia = 'grupo' AND a.grupo = ?", 'a.fecha_inicio DESC, a.id DESC', [$grupo], false);
    $filas = array_slice($filas, 0, 50);
    $lista = con_extras($filas, true); // el consejal ve los resultados de sus encuestas
    $hoy = date('Y-m-d');
    $s = db()->prepare('SELECT COUNT(*) FROM push_suscripciones WHERE grupo = ?');
    $s->execute([$grupo]);
    $autores = [];
    $ids = array_filter(array_map(fn ($f) => $f['autor_id'] ? (int) $f['autor_id'] : null, $filas));
    if ($ids) {
        $m = implode(',', array_fill(0, count($ids), '?'));
        $q = db()->prepare("SELECT id, nombre FROM usuarios WHERE id IN ($m)");
        $q->execute(array_values($ids));
        $autores = array_column($q->fetchAll(), 'nombre', 'id');
    }
    foreach ($lista as $i => $a) {
        $lista[$i]['vigente'] = $filas[$i]['fecha_inicio'] <= $hoy && $hoy <= $filas[$i]['fecha_fin'];
        $lista[$i]['notifiedAt'] = iso($filas[$i]['notificado_en']);
        $lista[$i]['por'] = $autores[(int) $filas[$i]['autor_id']] ?? null;
    }
    responder(['avisos' => $lista, 'suscritos' => (int) $s->fetchColumn()]);
}

/** El consejal publica un aviso solo para su grupo. Pasa por el filtro como todo lo público. */
function publicar_de_grupo(array $d): void
{
    $grupo = grupo_o_null($d['grupo'] ?? '');
    if (!$grupo) error_json('Grupo no válido (ej. 1AM TIN)');
    $u = exigir_consejal_de($grupo);
    if (!$u['permisos']['admin'] && ($pausa = pausa_de($u['id'], 'publicaciones'))) error_json($pausa, 403);

    $titulo    = trim(preg_replace('/\s+/u', ' ', (string) ($d['title'] ?? '')));
    $contenido = trim((string) ($d['content'] ?? ''));
    $tipo      = in_array($d['type'] ?? 'general', TIPOS_AVISO, true) ? ($d['type'] ?? 'general') : 'general';
    $hoy       = date('Y-m-d');
    $fin       = (string) ($d['endDate'] ?? $hoy);
    $abiertos  = array_key_exists('allowComments', $d) ? (!empty($d['allowComments']) ? 1 : 0) : 1;
    if (mb_strlen($titulo) < 3 || mb_strlen($titulo) > 150) error_json('El título debe tener de 3 a 150 caracteres');
    if (mb_strlen($contenido) > 1000) error_json('El texto no puede pasar de 1000 caracteres');
    if (!fecha_valida($fin)) error_json('La fecha final debe ser AAAA-MM-DD');
    if ($fin < $hoy) error_json('La fecha final no puede ser antes de hoy');
    if ($fin > date('Y-m-d', time() + DIAS_MAX_AVISO_GRUPO * 86400)) error_json('Un aviso de grupo dura como máximo ' . DIAS_MAX_AVISO_GRUPO . ' días');
    $encuesta = encuesta_del_aviso($d['poll'] ?? null);

    // Mismo filtro que comentarios y objetos perdidos (también la encuesta).
    $texto = implode(' · ', array_filter(array_merge([$titulo, $contenido], $encuesta ? array_merge([$encuesta['pregunta']], array_column($encuesta['opciones'], 'texto')) : [])));
    $revision = moderar_texto($texto);
    if (!$revision['ok']) {
        $extra = registrar_bloqueo($u['id'], null, 'aviso', "[$grupo] $texto", $revision['motivo']);
        responder(['ok' => false, 'bloqueado' => true, 'motivo' => $revision['motivo'], 'error' => mensaje_moderacion_general($revision['mensaje']) . $extra], 422);
    }

    $pdo = db();
    $c = $pdo->prepare("SELECT COUNT(*) FROM avisos WHERE autor_id = ? AND audiencia = 'grupo' AND creado_en > ?");
    $c->execute([$u['id'], ahora(-86400)]);
    if ((int) $c->fetchColumn() >= AVISOS_GRUPO_POR_DIA) error_json('Llegaste al máximo de ' . AVISOS_GRUPO_POR_DIA . ' avisos por día.', 429);

    $pdo->beginTransaction();
    $pdo->prepare(
        "INSERT INTO avisos (titulo, contenido, tipo, fijado, comentarios_abiertos, audiencia, grupo, autor_id, creado_en, fecha_inicio, fecha_fin)
         VALUES (?, ?, ?, 0, ?, 'grupo', ?, ?, ?, ?, ?)"
    )->execute([$titulo, $contenido, $tipo, $abiertos, $grupo, $u['id'], ahora(), $hoy, $fin]);
    $id = (int) $pdo->lastInsertId();
    if ($encuesta) guardar_encuesta($pdo, $id, $encuesta);
    $pdo->commit();
    bitacora('aviso', 'crear', $titulo, "Para $grupo · lo publicó " . (rol_en_grupo($u, $grupo) ?? 'admin') . ($encuesta ? ' · con encuesta' : ''), $u['id'], $u['correo']);

    $push = null;
    if (!empty($d['notify'])) {
        try {
            $push = push_a_suscritos([
                'title' => "$grupo · " . ($tipo === 'urgente' ? 'Urgente · ' : '') . $titulo,
                'body'  => mb_strimwidth($contenido !== '' ? $contenido : 'Toca para ver el aviso de tu grupo.', 0, 180, '…'),
                'url'   => '/?aviso=' . $id,
                'tag'   => 'aviso-' . $id,
                'tipo'  => $tipo,
            ], null, $grupo);
            $pdo->prepare('UPDATE avisos SET notificado_en = ? WHERE id = ?')->execute([ahora(), $id]);
        } catch (Throwable $e) {
            error_log('POLIMAP push grupo: ' . $e->getMessage());
            $push = ['error' => 'El aviso se publicó, pero la notificación falló'];
        }
    }
    $filas = consultar_avisos('a.id = ?', 'a.id', [$id], false);
    responder(['ok' => true, 'id' => $id, 'aviso' => con_extras($filas, true)[0] ?? null, 'push' => $push], 201);
}

/** El consejal o subconsejal (o un admin) borra un aviso de su grupo. */
function borrar_de_grupo(array $d): void
{
    $id = (int) ($d['id'] ?? 0);
    $s = db()->prepare("SELECT titulo, grupo FROM avisos WHERE id = ? AND audiencia = 'grupo'");
    $s->execute([$id]);
    $a = $s->fetch();
    if (!$a) error_json('Ese aviso ya no existe', 404);
    $u = exigir_consejal_de((string) $a['grupo']);
    db()->prepare('DELETE FROM avisos WHERE id = ?')->execute([$id]);
    bitacora('aviso', 'borrar', $a['titulo'], 'Aviso de ' . $a['grupo'], $u['id'], $u['correo']);
    responder(['ok' => true]);
}
