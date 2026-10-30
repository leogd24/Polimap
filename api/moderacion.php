<?php
/**
 * POLIMAP — Filtro de comentarios (ámbito institucional).   Responsable: Alexis
 *
 * moderar_texto($texto) revisa un comentario ANTES de guardarlo y regresa:
 *   ['ok' => true]                                  → se publica
 *   ['ok' => false, 'motivo' => 'groseria', 'mensaje' => '…']  → se bloquea
 *
 * Qué bloquea:
 *   groseria → insultos y groserías (también escritos "p3nd3jo", "p.u.t.o",
 *              "puuuto", "p u t o" o abreviados "ptm", "alv").
 *   amenaza  → "te voy a matar", "te parto la madre"…
 *   datos    → teléfonos y correos (para cuidar a los alumnos).
 *   enlace   → links de fuera (sí deja los de udg.mx).
 *
 * Lo que NO hace: entender ironía o contexto. Por eso además hay:
 *   - botón "Reportar" (3 reportes = se oculta solo),
 *   - el panel de Moderación, donde un admin oculta, borra o silencia.
 *
 * Para AGREGAR una palabra: ponla en minúsculas y sin acentos en
 * PALABRAS_EXACTAS (palabra completa) o en RAICES_PROHIBIDAS (todo lo que
 * EMPIECE así: "pendej" bloquea pendejo, pendeja, pendejada…).
 * Ojo con las raíces cortas: "put" bloquearía "puta" pero también "putumayo";
 * por eso las cortas van como palabras exactas.
 */

// Palabras completas, escritas normal (sin acentos). También se atrapan con
// letras repetidas ("puuuto"); las que llevan letra doble ("zorra") solo se
// atrapan bien escritas, porque "pera" o "zora" sí existen.
const PALABRAS_EXACTAS = [
    'puto', 'puta', 'putos', 'putas', 'putazo', 'putiza', 'putisimo',
    'verga', 'vergas', 'vergazo', 'vrg', 'alv', 'ptm', 'pndj', 'ctm', 'hdp', 'hijueputa', 'jueputa',
    'pinche', 'pinches', 'cabron', 'cabrona', 'cabrones', 'cabronas',
    'culero', 'culera', 'culeros', 'culeras', 'culo',
    'joto', 'jotos', 'maricon', 'maricones', 'marica',
    'mierda', 'mierdas', 'cagada', 'cagadas', 'ojete', 'ojetes',
    'idiota', 'idiotas', 'imbecil', 'imbeciles', 'estupido', 'estupida', 'estupidos', 'estupidas',
    'zorra', 'zorras', 'perra', 'perras',
    'malparido', 'malparida', 'mongolo', 'mongola', 'subnormal',
    'naco', 'nacos', 'naca', 'nacas',
    'huevon', 'huevona', 'guevon', 'webon', 'webona',
    'coño', 'carajo', 'chingon', 'chingona',
    'baboso', 'babosa', 'tarado', 'tarada', 'menso', 'mensa',
];

// Raíces: todo lo que EMPIECE así se bloquea (pendejo, pendeja, pendejada…).
const RAICES_PROHIBIDAS = [
    'pendej', 'chingad', 'chingar', 'chingue', 'chinga', 'mamon', 'mamad', 'mames',
    'coger', 'cojer', 'follar', 'putaz', 'hijodeputa', 'hijueput', 'muerete', 'suicidat',
];

// Palabras normales que empiezan igual que una raíz y NO deben bloquearse.
const PERMITIDAS = [
    'mamadera', // biberón
];

// Frases de amenaza (sobre el texto ya normalizado).
const AMENAZAS = [
    '/\b(te|los|las|lo|la|les)\s+(voy|vamos)\s+a\s+(matar|golpear|madrear|partir|romper|pegar|quemar)\b/',
    '/\b(te|les)\s+(mato|madreo|parto|rompo)\b/',
    '/\bpartir\s+(la|su)\s+madre\b/',
    '/\b(romper|partir)\s+(la|el)\s+(cara|hocico|osico)\b/',
    '/\bte\s+espero\s+(afuera|a\s+la\s+salida)\b/',
];

/** Minúsculas y sin acentos (la ñ se queda). */
function mod_normalizar(string $texto): string
{
    $t = mb_strtolower($texto, 'UTF-8');
    $t = strtr($t, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u']);
    return $t;
}

/** "puuuto" → "puto" (letras repetidas juntas cuentan como una). */
function mod_sin_repetidas(string $palabra): string
{
    return preg_replace('/(.)\1+/u', '$1', $palabra);
}

/**
 * Palabras "limpias" del texto, ya con el truco de los números y símbolos
 * deshecho: "p3nd3j0" → "pendejo", "p.u.t.o" → "puto", "p u t o" → "puto".
 */
function mod_palabras(string $normal): array
{
    $leet = ['4' => 'a', '@' => 'a', '3' => 'e', '1' => 'i', '!' => 'i', '0' => 'o', '5' => 's', '$' => 's', '7' => 't', '8' => 'b'];
    $palabras = [];
    $sueltas = ''; // letras sueltas seguidas ("p u t o")
    foreach (preg_split('/\s+/u', $normal) as $token) {
        if ($token === '') continue;
        // Solo cambiamos números/símbolos si el pedazo también trae letras (así "2026" no cambia).
        if (preg_match('/\p{L}/u', $token)) $token = strtr($token, $leet);
        $limpio = preg_replace('/[^\p{L}]+/u', '', $token);
        if ($limpio === '') continue;
        if (mb_strlen($limpio) === 1) {
            $sueltas .= $limpio;
            continue;
        }
        if ($sueltas !== '') {
            $palabras[] = $sueltas;
            $sueltas = '';
        }
        // Si traía puntos o guiones en medio ("pen-de-jo"), también se juntan.
        $palabras[] = $limpio;
        foreach (preg_split('/[^\p{L}]+/u', $token, -1, PREG_SPLIT_NO_EMPTY) as $parte) {
            if ($parte !== $limpio) $palabras[] = $parte;
        }
    }
    if ($sueltas !== '') $palabras[] = $sueltas;
    return $palabras;
}

/** ¿Esta palabra es grosería? */
function mod_es_groseria(string $palabra): bool
{
    static $exactas = null, $colapsadas = null;
    if ($exactas === null) {
        $exactas = array_flip(PALABRAS_EXACTAS);
        // Solo las que NO llevan letra doble se buscan también "colapsadas".
        $colapsadas = array_flip(array_filter(PALABRAS_EXACTAS, fn ($w) => mod_sin_repetidas($w) === $w));
    }
    if (in_array($palabra, PERMITIDAS, true)) return false;
    $p = mod_sin_repetidas($palabra);
    if (isset($exactas[$palabra]) || isset($colapsadas[$p])) return true;
    foreach (RAICES_PROHIBIDAS as $raiz) {
        if (str_starts_with($palabra, $raiz) || str_starts_with($p, $raiz)) return true;
    }
    return false;
}

/** Revisa un comentario. Ver la explicación al inicio del archivo. */
function moderar_texto(string $texto): array
{
    $normal = mod_normalizar($texto);

    foreach (mod_palabras($normal) as $palabra) {
        if (mod_es_groseria($palabra)) {
            return [
                'ok'      => false,
                'motivo'  => 'groseria',
                'mensaje' => 'Tu comentario tiene palabras que no van con el ambiente del Poli. Cámbialo y vuelve a intentar.',
            ];
        }
    }
    foreach (AMENAZAS as $patron) {
        if (preg_match($patron . 'u', $normal)) {
            return [
                'ok'      => false,
                'motivo'  => 'amenaza',
                'mensaje' => 'Tu comentario parece una amenaza y no se publicó. Si tienes un problema con alguien, acércate a Orientación o a Coordinación.',
            ];
        }
    }
    // Teléfonos (10 dígitos, con o sin espacios/guiones) y correos.
    $digitos = preg_replace('/[\s\-\.\(\)]/', '', $texto);
    if (preg_match('/\d{10}/', $digitos) || preg_match('/[\w.+-]+@[\w-]+\.[\w.]+/u', $texto)) {
        return [
            'ok'      => false,
            'motivo'  => 'datos',
            'mensaje' => 'Por tu seguridad no se publican teléfonos ni correos en los comentarios.',
        ];
    }
    // Enlaces: solo de la UdeG.
    if (preg_match_all('/\b((?:https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(?:com|net|org|mx|io|ly|gg|tv|co)(?:\/[^\s]*)?)/i', $texto, $m)) {
        foreach ($m[1] as $url) {
            if (!preg_match('/(^|[\/.])udg\.mx(\/|$)/i', $url)) {
                return [
                    'ok'      => false,
                    'motivo'  => 'enlace',
                    'mensaje' => 'Solo se permiten enlaces de la UdeG (udg.mx).',
                ];
            }
        }
    }
    return ['ok' => true];
}

/** El mismo mensaje del filtro, pero para textos que no son comentarios (perdidos, fechas). */
function mensaje_moderacion_general(string $mensaje): string
{
    return str_replace(['Tu comentario', ' en los comentarios'], ['El texto', ''], $mensaje);
}

// ---------------------------------------------------------------------------
// Bloqueos y pausas (iguales para TODO lo público: comentarios, objetos
// perdidos, fechas y avisos de los consejales).
// ---------------------------------------------------------------------------

// 3 textos bloqueados en 24 h = la cuenta se pausa sola 24 h.
// (Los que un admin marcó como "error del filtro" no cuentan.)
const BLOQUEOS_PARA_PAUSA = 3;
// Pausa "permanente": no vence; solo la cuenta maestra la puede quitar.
const PAUSA_PERMANENTE = '2999-12-31 23:59:59';
const ORIGENES_BLOQUEO = ['comentario', 'perdido', 'fecha', 'aviso'];

/** ¿La pausa que vence en $hasta es permanente? */
function es_pausa_permanente(?string $hasta): bool
{
    return $hasta !== null && substr($hasta, 0, 4) >= '2900';
}

/**
 * Si la cuenta no puede publicar ahora, regresa el mensaje; si puede, null.
 * $que: 'comentarios' | 'publicaciones' (solo cambia el texto del mensaje).
 */
function pausa_de(int $usuarioId, string $que = 'comentarios'): ?string
{
    $pdo = db();
    $s = $pdo->prepare('SELECT silenciado_hasta FROM usuarios WHERE id = ? AND silenciado_hasta > ?');
    $s->execute([$usuarioId, ahora()]);
    if ($hasta = $s->fetchColumn()) {
        if (es_pausa_permanente($hasta)) return "Un administrador pausó tus $que de forma permanente. Si crees que es un error, acércate a Coordinación.";
        return "Un administrador pausó tus $que hasta el " . date('d/m/Y H:i', strtotime($hasta)) . '.';
    }
    if (bloqueos_recientes($usuarioId) >= BLOQUEOS_PARA_PAUSA) {
        return "Tus $que están en pausa 24 horas porque varios textos no pasaron el filtro. Gracias por cuidar el ambiente del Poli.";
    }
    return null;
}

/** Cuántos textos de esta cuenta bloqueó el filtro en las últimas 24 h. */
function bloqueos_recientes(int $usuarioId): int
{
    $b = db()->prepare("SELECT COUNT(*) FROM moderacion_log WHERE usuario_id = ? AND creado_en > ? AND (veredicto IS NULL OR veredicto <> 'error')");
    $b->execute([$usuarioId, ahora(-86400)]);
    return (int) $b->fetchColumn();
}

/**
 * Guarda lo que bloqueó el filtro (para que un admin lo revise en el panel,
 * sección Comentarios → Bloqueados) y regresa el aviso de cuántos faltan
 * para la pausa automática.
 */
function registrar_bloqueo(int $usuarioId, ?int $avisoId, string $origen, string $texto, string $motivo): string
{
    $origen = in_array($origen, ORIGENES_BLOQUEO, true) ? $origen : 'comentario';
    db()->prepare('INSERT INTO moderacion_log (usuario_id, aviso_id, texto, motivo, origen, creado_en) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$usuarioId, $avisoId, mb_substr($texto, 0, 500), $motivo, $origen, ahora()]);
    $restan = BLOQUEOS_PARA_PAUSA - bloqueos_recientes($usuarioId);
    return $restan > 0
        ? " (Si se bloquean $restan más hoy, tu cuenta se pausa 24 h.)"
        : ' Tu cuenta queda en pausa 24 horas.';
}
