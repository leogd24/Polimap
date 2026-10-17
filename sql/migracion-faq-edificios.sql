-- =====================================================================
-- POLIMAP — Migración: preguntas frecuentes y datos de edificios
-- Generado el 2026-10-17 desde src/data/faqEntries.js y src/data/campusBuildings.js
--
-- Para la base que YA tiene datos (local con XAMPP o InfinityFree).
-- Cómo usarlo: phpMyAdmin → base polimap → pestaña SQL → pegar todo → Continuar.
--
-- QUÉ HACE:
--   1. Reemplaza TODAS las preguntas de la tabla faq por las 33 nuevas
--      (las anteriores mandaban al edificio 6 y 8; lo correcto es el 1).
--   2. Actualiza resumen y descripción de los 10 edificios.
--   3. Reemplaza servicios, espacios y trámites de los 10 edificios.
-- QUÉ NO TOCA: reportes, usuarios, avisos, accesos ni las coordenadas.
-- Se puede correr más de una vez: siempre deja el mismo resultado.
-- =====================================================================

SET NAMES utf8mb4;
START TRANSACTION;

-- 1) Preguntas frecuentes
DELETE FROM faq;
ALTER TABLE faq AUTO_INCREMENT = 1;
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
  (33, '¿Qué me prestan en el Poli?', 'En el segundo piso, del lado derecho, prestan cables HDMI, computadoras y balones para jugar. Preséntate con tu credencial del Poli.', 'prestamo,prestamos,prestan,prestar,prestamo de equipo,pedir prestado', 'servicios', 3, 'handshake', 1),
  (23, '¿Dónde está la bodega?', 'Ahí está la bodega del plantel.', 'bodega,almacen', 'ubicaciones', 4, 'inventory_2', 1),
  (24, '¿Quién se encarga del internet del Poli?', 'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.', 'internet,wifi,wi fi,sin internet,internet del poli', 'servicios', 7, 'wifi', 1),
  (25, '¿Dónde está el estudio de audio y video?', 'Ahí también están el laboratorio de sistemas híbridos y el taller de energía eólica.', 'estudio,audio,video,grabar,grabacion,sistemas hibridos,eolica,energia eolica', 'ubicaciones', 8, 'videocam', 1),
  (26, '¿Dónde está el Departamento de Computación?', 'Ahí están la oficina del Departamento de Computación y la del Departamento de Telecomunicaciones y Energías Alternas.', 'departamento,computacion,telecomunicaciones,energias alternas,jefe de departamento', 'ubicaciones', 8, 'corporate_fare', 1),
  (27, '¿Dónde están los talleres de soldadura y máquinas?', 'Ahí están los talleres de soldadura, de máquinas y herramientas y de metrología, y el laboratorio de sistemas de producción y control de calidad.', 'taller,talleres,soldadura,maquinas,herramientas,metrologia,control de calidad,manufactura', 'ubicaciones', 9, 'precision_manufacturing', 1),
  (28, '¿Dónde están los laboratorios de biotecnología?', 'Ahí están los laboratorios de biorremediación, fermentación, in vitro y alimentos.', 'biotecnologia,biorremediacion,fermentacion,in vitro,alimentos,laboratorio de alimentos', 'ubicaciones', 10, 'biotech', 1),
  (29, '¿Cómo reporto una incidencia?', 'Abre la sección Reportar, selecciona una categoría, agrega la ubicación y describe el problema.', 'reporte,reportar,incidencia,queja,falla,descompuesto,roto,fuga,basura', 'servicios', NULL, 'add_alert', 1),
  (30, '¿Cómo veo mi horario?', 'En la sección Mi horario eliges tu carrera y tu grupo, y ves tus clases con su salón.', 'horario,horarios,mi horario,clases,mis clases,grupo', 'horarios', NULL, 'calendar_month', 1),
  (31, '¿Cómo encuentro mi salón?', 'Escríbeme la clave del salón tal como aparece en tu horario, por ejemplo "E6-A05" o "Lab E8-L07", y te digo en qué edificio está.', 'salon,salones,aula,mi salon,donde es mi clase,clave del salon', 'horarios', NULL, 'meeting_room', 1),
  (32, '¿Hay rutas accesibles?', 'Todavía estamos registrando la información de accesibilidad de cada edificio. Cuando esté lista aparecerá en la ficha de cada edificio.', 'accesible,accesibilidad,silla de ruedas,rampa,discapacidad,elevador', 'ubicaciones', NULL, 'accessible_forward', 1);

-- 2) Resumen y descripción de cada edificio (no cambia nombre, ícono, color ni coordenadas)
UPDATE edificios SET summary = 'Trámites escolares, PLEX y Coordinación', description = 'Aquí se atiende a los alumnos para sus trámites escolares. También están las oficinas de PLEX y de Coordinación.' WHERE number = 1;
UPDATE edificios SET summary = 'Biblioteca y auditorio', description = 'Aquí está la biblioteca. En la planta de arriba está el auditorio.' WHERE number = 2;
UPDATE edificios SET summary = 'Préstamo de equipo: cable HDMI, computadoras y balones', description = 'En el segundo piso, del lado derecho, se prestan cables HDMI, computadoras y balones para jugar.' WHERE number = 3;
UPDATE edificios SET summary = 'Aulas y bodega', description = 'Edificio de aulas. Aquí también está la bodega del plantel.' WHERE number = 4;
UPDATE edificios SET summary = 'Psicología, Servicio y Prácticas Profesionales y Oficialía Mayor', description = '' WHERE number = 5;
UPDATE edificios SET summary = 'Aulas y laboratorios', description = 'Edificio de aulas y laboratorios.' WHERE number = 6;
UPDATE edificios SET summary = 'Aulas, laboratorios y sistema de internet del plantel', description = 'Edificio de aulas y laboratorios. En el segundo piso está el sistema de internet del Poli.' WHERE number = 7;
UPDATE edificios SET summary = 'Estudio de audio y video, laboratorios y oficinas de departamento', description = 'Aquí están el estudio de audio y video, el laboratorio de sistemas híbridos, el taller de energía eólica y las oficinas de los departamentos de Computación y de Telecomunicaciones y Energías Alternas.' WHERE number = 8;
UPDATE edificios SET summary = 'Talleres de manufactura y laboratorio de producción', description = 'Aquí están los talleres de soldadura, máquinas y herramientas y metrología, y el laboratorio de sistemas de producción y control de calidad.' WHERE number = 9;
UPDATE edificios SET summary = 'Laboratorios de biotecnología y alimentos', description = 'Aquí están los laboratorios de biorremediación, fermentación, in vitro y alimentos.' WHERE number = 10;

-- 3) Servicios, espacios y trámites
DELETE FROM servicios WHERE edificio_number IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
DELETE FROM espacios  WHERE edificio_number IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
DELETE FROM tramites  WHERE edificio_number IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

INSERT INTO servicios (edificio_number, nombre, orden) VALUES
  (1, 'Constancias', 0),
  (1, 'Kardex', 1),
  (1, 'Certificados parciales', 2),
  (1, 'Condonaciones', 3),
  (1, 'Bajas voluntarias', 4),
  (1, 'PLEX', 5),
  (1, 'Coordinación', 6),
  (1, 'Asesorías', 7),
  (2, 'Biblioteca', 0),
  (2, 'Auditorio', 1),
  (3, 'Préstamo de cable HDMI', 0),
  (3, 'Préstamo de computadoras', 1),
  (3, 'Préstamo de balones', 2),
  (5, 'Psicología', 0),
  (5, 'Servicio y prácticas profesionales', 1),
  (5, 'Titulación', 2),
  (5, 'Oficialía Mayor', 3),
  (7, 'Sistema de internet', 0),
  (8, 'Estudio de audio y video', 0);

INSERT INTO espacios (edificio_number, nombre, orden) VALUES
  (1, 'Atención a alumnos', 0),
  (1, 'Oficinas de PLEX', 1),
  (1, 'Coordinación', 2),
  (2, 'Biblioteca', 0),
  (2, 'Planta alta: auditorio', 1),
  (3, 'Segundo piso, lado derecho: préstamo de equipo', 0),
  (4, 'Aulas', 0),
  (4, 'Bodega', 1),
  (5, 'Coordinación de Servicio y Prácticas Profesionales', 0),
  (5, 'Oficina del Oficial Mayor', 1),
  (6, 'Aulas', 0),
  (6, 'Laboratorios', 1),
  (7, 'Aulas', 0),
  (7, 'Laboratorios', 1),
  (7, 'Segundo piso: sistema de internet del plantel', 2),
  (7, 'Oficina del maestro a cargo del internet', 3),
  (8, 'Estudio de audio y video', 0),
  (8, 'Laboratorio de sistemas híbridos', 1),
  (8, 'Taller de energía eólica', 2),
  (8, 'Oficina del Departamento de Computación', 3),
  (8, 'Oficina del Departamento de Telecomunicaciones y Energías Alternas', 4),
  (9, 'Taller de soldadura', 0),
  (9, 'Taller de máquinas y herramientas', 1),
  (9, 'Taller de metrología', 2),
  (9, 'Laboratorio de sistemas de producción y control de calidad', 3),
  (10, 'Laboratorio de biorremediación', 0),
  (10, 'Laboratorio de fermentación', 1),
  (10, 'Laboratorio de in vitro', 2),
  (10, 'Laboratorio de alimentos', 3);

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
  (2, 'Entrar a la biblioteca', 'Te piden tu credencial de la UdeG para ingresar.', 0),
  (3, 'Préstamo de cable HDMI', 'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 0),
  (3, 'Préstamo de computadoras', 'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 1),
  (3, 'Préstamo de balones', 'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.', 2),
  (5, 'Servicio y prácticas profesionales', 'Aquí está la coordinadora de Servicio y Prácticas Profesionales.', 0),
  (5, 'Titulación', 'Lo atiende la misma coordinación de Servicio y Prácticas Profesionales.', 1),
  (5, 'Oficialía Mayor', 'En este edificio está la oficina del Oficial Mayor.', 2),
  (7, 'Sistema de internet del plantel', 'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.', 0);

COMMIT;
