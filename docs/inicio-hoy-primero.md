# Inicio estilo "Google" con los colores del Poli

Responsable: Alexis (sobre el diseño de Leo). Se eligió la propuesta C de las mismas
maquetas, con "Tu día" agregado y los colores del Poli.

## Qué hay en Inicio (de arriba a abajo)

1. **Saludo** (`src/components/SaludoInicio.jsx`):
   - fecha y clima, y "Buenos días, Ana" grande;
   - la **tarjeta de tu clase**: noche del Poli con la franja de 5 colores. Muestra la clase
     de ahora (con barra de avance) o la siguiente, la hora y el salón;
   - chips en la tarjeta: "Cómo llegar" (abre el edificio con el salón resaltado) y el examen
     próximo (lleva a Horario → Fechas);
   - "Lleva paraguas" solo si va a llover.
2. **Buscador grande** "Busca un salón, profe o aviso" (abre el asistente).
3. **Accesos en chips** que se deslizan, cada uno con el color de su sección como en la
   barra de abajo: Mapa, Horario, Reportar, Edificios, Perdidos, Fechas, Mis notas y
   Control Escolar.
4. **Tu día** (`src/components/TuDia.jsx`): línea del tiempo con tus clases, los exámenes
   y entregas del grupo y los avisos urgentes de hoy, en orden de hora.
   - La clase de ahora sale en noche.
   - Si ya terminaste, muestra "Mañana" (o "El lunes").
5. **Avisos del Poli** estilo Google Discover (`src/components/AvisosInicio.jsx`):
   - filtros;
   - los urgentes en rojo suave;
   - un destacado con foto, fuente ("Evento · Avisos del Poli · 7 min"), título, texto y
     acciones (me gusta, comentarios, Votar);
   - el resto como tarjetas con miniatura;
   - al tocar cualquiera se abre completo en una hoja.
6. **Avisos en tu celular** (franja chica).

La barra de arriba y la de abajo no cambian. Funciona en claro, oscuro, alto contraste y
letra muy grande.

## Cómo probar

`npm run dev` → Inicio. Para ver todo, elige tu grupo en Horario, publica una fecha desde
una cuenta de consejal y desde el panel un aviso urgente y uno fijado con foto.
