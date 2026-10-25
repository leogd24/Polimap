/// Preguntas frecuentes del asistente (Gabo).
///
/// Mismos campos que regresa GET /api/faq.php (ver docs/contrato-datos.md):
///   id             número único (no se repite)
///   question       la pregunta como la vería el alumno
///   answer         la respuesta. NO escribas aquí el número de edificio:
///                  el asistente lo agrega solo a partir de buildingNumber
///                  y muestra el botón "Ver en el mapa".
///   keywords       palabras que el alumno podría escribir. Pon variantes y
///                  faltas comunes ("kardes", "sicologia"). Acentos y
///                  mayúsculas no importan: el buscador los quita.
///   category       'tramites' | 'ubicaciones' | 'servicios' | 'horarios'
///   buildingNumber número del edificio (1–10) o null si no aplica
///   icon           nombre de Material Symbols
///
/// Toda la información está confirmada por el equipo (datos de Marcos,
/// 16 oct 2026). Si algo no se sabe, NO se inventa: mejor no ponerlo.
export const faqEntries = [
  // ---------------------------------------------------------------
  // Edificio 1 — Atención a alumnos (Control Escolar), PLEX y Coordinación
  // ---------------------------------------------------------------
  {
    id: 1,
    question: '¿Dónde saco mi kardex?',
    answer: 'En Atención a alumnos (Control Escolar). Solo presenta tu código de alumno.',
    keywords: ['kardex', 'kardes', 'cardex', 'historial', 'historial academico', 'calificaciones', 'boleta'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'description',
  },
  {
    id: 2,
    question: '¿Cómo pido una constancia de estudios?',
    answer: 'En Atención a alumnos (Control Escolar). Solo presenta tu código de alumno.',
    keywords: ['constancia', 'constancias', 'constancia de estudios', 'comprobante de estudios'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'verified',
  },
  {
    id: 3,
    question: '¿Dónde está Control Escolar?',
    answer:
      'Control Escolar es Atención a alumnos. Ahí se tramitan constancias, kardex, certificados parciales, condonaciones y bajas voluntarias.',
    keywords: ['control escolar', 'escolar', 'atencion a alumnos', 'servicios escolares', 'tramites', 'ventanilla'],
    category: 'ubicaciones',
    buildingNumber: 1,
    icon: 'badge',
  },
  {
    id: 4,
    question: '¿Cómo saco un certificado parcial?',
    answer:
      'En Atención a alumnos te dan una ficha de pago. Después llevas el recibo de que ya pagaste y fotos para credencial.',
    keywords: ['certificado', 'certificado parcial', 'certificados'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'workspace_premium',
  },
  {
    id: 5,
    question: '¿Cómo pido una condonación de mi orden de pago?',
    answer:
      'Lleva tu orden de pago a Atención a alumnos. Ahí te dan una nota en la que explicas por qué solicitas la condonación.',
    keywords: ['condonacion', 'condonar', 'orden de pago', 'no puedo pagar'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'payments',
  },
  {
    id: 6,
    question: '¿Cómo me doy de baja voluntaria?',
    answer:
      'Tienes que ir tú en persona (si eres menor de edad, con tu tutor) a Atención a alumnos. Lleva identificación, la orden de pago ya pagada y el formato de pago, y llena el formato donde explicas el motivo de la baja.',
    keywords: ['baja', 'baja voluntaria', 'darme de baja', 'dejar la escuela', 'salirme'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'logout',
  },
  {
    id: 7,
    question: '¿Dónde reviso mis materias?',
    answer: 'En Atención a alumnos puedes revisar tus materias.',
    keywords: ['materias', 'mis materias', 'revisar materias', 'carga academica'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'menu_book',
  },
  {
    id: 8,
    question: '¿Dónde está PLEX?',
    answer:
      'En las oficinas de PLEX puedes inscribirte y consultar tus calificaciones de PLEX.',
    keywords: ['plex', 'pleks', 'inscripcion plex', 'calificaciones plex', 'ingles', 'idiomas', 'lenguas'],
    category: 'ubicaciones',
    buildingNumber: 1,
    icon: 'diversity_3',
  },
  {
    id: 9,
    question: 'Olvidé la contraseña de mi correo institucional',
    answer:
      'La recupera Coordinación. Lleva tu correo institucional, un número de teléfono con WhatsApp, tu código y tu nombre completo.',
    keywords: ['contraseña', 'contrasena', 'password', 'correo', 'correo institucional', 'olvide', 'recuperar', 'no puedo entrar'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'lock_reset',
  },
  {
    id: 10,
    question: '¿Cómo pido asesorías de materias irregulares?',
    answer:
      'Regístrate en condonación con el formato que te van a dar. Las dudas sobre asesorías también las atiende Coordinación.',
    keywords: ['asesoria', 'asesorias', 'irregular', 'materia reprobada', 'reprobe', 'extraordinario', 'regularizar'],
    category: 'tramites',
    buildingNumber: 1,
    icon: 'school',
  },
  {
    id: 11,
    question: 'Soy alumno irregular u honorífico, ¿quién me atiende?',
    answer: 'Te atiende Coordinación.',
    keywords: ['irregular', 'irregulares', 'honorifico', 'honorificos', 'coordinacion', 'coordinador'],
    category: 'servicios',
    buildingNumber: 1,
    icon: 'support_agent',
  },
  {
    id: 12,
    question: 'Tengo un problema con Classroom',
    answer: 'Coordinación es quien le da mantenimiento a la plataforma de Classroom.',
    keywords: ['classroom', 'clasroom', 'plataforma', 'google classroom'],
    category: 'servicios',
    buildingNumber: 1,
    icon: 'cast_for_education',
  },
  {
    id: 13,
    question: '¿Dónde está Coordinación?',
    answer:
      'Coordinación atiende a alumnos irregulares y honoríficos, recupera contraseñas del correo institucional, da mantenimiento a Classroom y evalúa el desempeño docente.',
    keywords: ['coordinacion', 'coordinador', 'coordinadora', 'desempeño docente', 'evaluacion docente'],
    category: 'ubicaciones',
    buildingNumber: 1,
    icon: 'groups',
  },

  // ---------------------------------------------------------------
  // Edificio 5 — Psicología, Servicio y Prácticas, Titulación, Oficialía Mayor
  // ---------------------------------------------------------------
  {
    id: 14,
    question: '¿Dónde está Psicología?',
    answer: 'Psicología brinda orientación y acompañamiento a los alumnos.',
    keywords: ['psicologia', 'sicologia', 'psicologo', 'psicologa', 'orientacion', 'apoyo emocional', 'ansiedad', 'estres'],
    category: 'servicios',
    buildingNumber: 5,
    icon: 'psychology_alt',
  },
  {
    id: 15,
    question: '¿Dónde hago mi servicio social o prácticas profesionales?',
    answer: 'Ahí está la coordinadora de Servicio y Prácticas Profesionales.',
    keywords: ['servicio social', 'servicio', 'practicas', 'practicas profesionales', 'liberar servicio'],
    category: 'tramites',
    buildingNumber: 5,
    icon: 'work',
  },
  {
    id: 16,
    question: '¿Dónde hago mi trámite de titulación?',
    answer: 'La titulación la atiende la coordinación de Servicio y Prácticas Profesionales.',
    keywords: ['titulacion', 'titularme', 'titulo', 'egresar'],
    category: 'tramites',
    buildingNumber: 5,
    icon: 'school',
  },
  {
    id: 17,
    question: '¿Dónde está Oficialía Mayor?',
    answer: 'Ahí está la oficina del Oficial Mayor.',
    keywords: ['oficialia', 'oficialia mayor', 'oficial mayor'],
    category: 'ubicaciones',
    buildingNumber: 5,
    icon: 'account_balance',
  },

  // ---------------------------------------------------------------
  // Edificio 2 — Biblioteca y auditorio
  // ---------------------------------------------------------------
  {
    id: 18,
    question: '¿Dónde está la biblioteca?',
    answer: 'Para entrar a la biblioteca te piden tu credencial de la UdeG.',
    keywords: ['biblioteca', 'libros', 'prestamo de libros'],
    category: 'ubicaciones',
    buildingNumber: 2,
    icon: 'local_library',
  },
  {
    id: 19,
    question: '¿Dónde está el auditorio?',
    answer: 'El auditorio está en la planta de arriba, en el mismo edificio que la biblioteca.',
    keywords: ['auditorio', 'conferencia', 'ceremonia'],
    category: 'ubicaciones',
    buildingNumber: 2,
    icon: 'theater_comedy',
  },

  // ---------------------------------------------------------------
  // Edificio 3 — Préstamo de equipo
  // ---------------------------------------------------------------
  {
    id: 20,
    question: '¿Dónde pido prestado un cable HDMI?',
    answer: 'Los cables HDMI se piden en el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.',
    keywords: ['hdmi', 'cable', 'cable hdmi', 'proyector'],
    category: 'servicios',
    buildingNumber: 3,
    icon: 'cable',
  },
  {
    id: 21,
    question: '¿Dónde me prestan una computadora?',
    answer: 'Las computadoras se piden en el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.',
    keywords: ['computadora', 'computadoras', 'compu', 'laptop'],
    category: 'servicios',
    buildingNumber: 3,
    icon: 'laptop',
  },
  {
    id: 22,
    question: '¿Dónde piden balones para jugar?',
    answer: 'Los balones se piden en el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.',
    keywords: ['balon', 'balones', 'pelota', 'prestamo de balon'],
    category: 'servicios',
    buildingNumber: 3,
    icon: 'sports_soccer',
  },

  {
    id: 33,
    question: '¿Qué me prestan en el Poli?',
    answer:
      'En el segundo piso, del lado derecho, prestan cables HDMI, computadoras y balones para jugar. Preséntate con tu credencial del Poli.',
    keywords: ['prestamo', 'prestamos', 'prestan', 'prestar', 'prestamo de equipo', 'pedir prestado'],
    category: 'servicios',
    buildingNumber: 3,
    icon: 'handshake',
  },

  // ---------------------------------------------------------------
  // Edificios 4, 7, 8, 9 y 10
  // ---------------------------------------------------------------
  {
    id: 23,
    question: '¿Dónde está la bodega?',
    answer: 'Ahí está la bodega del plantel.',
    keywords: ['bodega', 'almacen'],
    category: 'ubicaciones',
    buildingNumber: 4,
    icon: 'inventory_2',
  },
  {
    id: 24,
    question: '¿Quién se encarga del internet del Poli?',
    answer:
      'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.',
    keywords: ['internet', 'wifi', 'wi fi', 'sin internet', 'internet del poli'],
    category: 'servicios',
    buildingNumber: 7,
    icon: 'wifi',
  },
  {
    id: 25,
    question: '¿Dónde está el estudio de audio y video?',
    answer:
      'Ahí también están el laboratorio de sistemas híbridos y el taller de energía eólica.',
    keywords: ['estudio', 'audio', 'video', 'grabar', 'grabacion', 'sistemas hibridos', 'eolica', 'energia eolica'],
    category: 'ubicaciones',
    buildingNumber: 8,
    icon: 'videocam',
  },
  {
    id: 26,
    question: '¿Dónde está el Departamento de Computación?',
    answer:
      'Ahí están la oficina del Departamento de Computación y la del Departamento de Telecomunicaciones y Energías Alternas.',
    keywords: ['departamento', 'computacion', 'telecomunicaciones', 'energias alternas', 'jefe de departamento'],
    category: 'ubicaciones',
    buildingNumber: 8,
    icon: 'corporate_fare',
  },
  {
    id: 27,
    question: '¿Dónde están los talleres de soldadura y máquinas?',
    answer:
      'Ahí están los talleres de soldadura, de máquinas y herramientas y de metrología, y el laboratorio de sistemas de producción y control de calidad.',
    keywords: ['taller', 'talleres', 'soldadura', 'maquinas', 'herramientas', 'metrologia', 'control de calidad', 'manufactura'],
    category: 'ubicaciones',
    buildingNumber: 9,
    icon: 'precision_manufacturing',
  },
  {
    id: 28,
    question: '¿Dónde están los laboratorios de biotecnología?',
    answer:
      'Ahí están los laboratorios de biorremediación, fermentación, in vitro y alimentos.',
    keywords: ['biotecnologia', 'biorremediacion', 'fermentacion', 'in vitro', 'alimentos', 'laboratorio de alimentos'],
    category: 'ubicaciones',
    buildingNumber: 10,
    icon: 'biotech',
  },

  // ---------------------------------------------------------------
  // Uso de la app
  // ---------------------------------------------------------------
  {
    id: 29,
    question: '¿Cómo reporto una incidencia?',
    answer:
      'Abre la sección Reportar, selecciona una categoría, agrega la ubicación y describe el problema.',
    keywords: ['reporte', 'reportar', 'incidencia', 'queja', 'falla', 'descompuesto', 'roto', 'fuga', 'basura'],
    category: 'servicios',
    buildingNumber: null,
    icon: 'add_alert',
  },
  {
    id: 30,
    question: '¿Cómo veo mi horario?',
    answer: 'En la sección Mi horario eliges tu carrera y tu grupo, y ves tus clases con su salón.',
    keywords: ['horario', 'horarios', 'mi horario', 'clases', 'mis clases', 'grupo'],
    category: 'horarios',
    buildingNumber: null,
    icon: 'calendar_month',
  },
  {
    id: 31,
    question: '¿Cómo encuentro mi salón?',
    answer:
      'Escríbeme la clave del salón tal como aparece en tu horario, por ejemplo "E6-A05" o "Lab E8-L07", y te digo en qué edificio está.',
    keywords: ['salon', 'salones', 'aula', 'mi salon', 'donde es mi clase', 'clave del salon'],
    category: 'horarios',
    buildingNumber: null,
    icon: 'meeting_room',
  },
  {
    id: 32,
    question: '¿Hay rutas accesibles?',
    answer:
      'Todavía estamos registrando la información de accesibilidad de cada edificio. Cuando esté lista aparecerá en la ficha de cada edificio.',
    keywords: ['accesible', 'accesibilidad', 'silla de ruedas', 'rampa', 'discapacidad', 'elevador'],
    category: 'ubicaciones',
    buildingNumber: null,
    icon: 'accessible_forward',
  },
];
