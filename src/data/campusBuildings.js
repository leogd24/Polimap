import { colors } from '../styles/theme.js';

/// Única fuente de información de los edificios.
///
/// Solo contiene datos confirmados por el plantel. Los campos vacíos se
/// muestran en la app como "Sin información" y están pendientes de llenar.
export const campusBuildings = [
  {
    number: 1,
    name: 'Atención a alumnos',
    summary: 'Trámites escolares, PLEX y Coordinación',
    description:
      'Aquí se atiende a los alumnos para sus trámites escolares. También están las oficinas de PLEX y de Coordinación.',
    services: [
      'Constancias',
      'Kardex',
      'Certificados parciales',
      'Condonaciones',
      'Bajas voluntarias',
      'PLEX',
      'Coordinación',
      'Asesorías',
    ],
    spaces: ['Atención a alumnos', 'Oficinas de PLEX', 'Coordinación'],
    hours: '',
    accessibility: '',
    icon: 'support_agent',
    color: colors.blue,
    procedures: [
      {
        name: 'Constancias',
        details: 'Presenta tu código de alumno.',
      },
      {
        name: 'Kardex',
        details: 'Presenta tu código de alumno.',
      },
      {
        name: 'Certificados parciales',
        details:
          'Se te entrega una ficha de pago. Tienes que llevar el recibo de que ya pagaste y fotos para la credencial.',
      },
      {
        name: 'Condonaciones de orden de pago',
        details:
          'Lleva tu orden de pago. Ahí te dan una nota y tienes que explicar por qué solicitas la condonación.',
      },
      {
        name: 'Bajas voluntarias',
        details:
          'Tiene que venir el alumno; si es menor de edad, acompañado de un tutor. Lleva documentos de identificación, la orden de pago pagada y el formato de pago, y llena el formato indicando el motivo de la baja.',
      },
      {
        name: 'Consulta de materias',
        details: 'Los alumnos pueden revisar sus materias aquí.',
      },
      {
        name: 'PLEX',
        details:
          'En las oficinas de PLEX puedes inscribirte y consultar tus calificaciones de PLEX.',
      },
      {
        name: 'Recuperación de contraseña del correo institucional',
        details:
          'En Coordinación. Necesitas llevar tu correo institucional, número de teléfono con WhatsApp, código y nombre completo.',
      },
      {
        name: 'Asesorías de materias irregulares',
        details:
          'Regístrate en condonación con el formato que te van a dar. También atienden dudas sobre asesorías.',
      },
      {
        name: 'Atención a alumnos irregulares y honoríficos',
        details: 'Los atiende Coordinación.',
      },
      {
        name: 'Plataforma de Classroom',
        details: 'Coordinación le da mantenimiento a la plataforma.',
      },
      {
        name: 'Desempeño docente',
        details:
          'Coordinación evalúa el desempeño docente, capacita al personal docente y genera las constancias de desempeño docente.',
      },
    ],
  },
  {
    number: 2,
    name: 'Edificio 2',
    summary: 'Biblioteca y auditorio',
    description:
      'Aquí está la biblioteca. En la planta de arriba está el auditorio.',
    services: ['Biblioteca', 'Auditorio'],
    spaces: ['Biblioteca', 'Planta alta: auditorio'],
    hours: '',
    accessibility: '',
    icon: 'apartment',
    color: colors.blueLight,
    procedures: [
      {
        name: 'Entrar a la biblioteca',
        details: 'Te piden tu credencial de la UdeG para ingresar.',
      },
    ],
  },
  {
    number: 3,
    name: 'Edificio 3',
    summary: 'Préstamo de equipo: cable HDMI, computadoras y balones',
    description:
      'En el segundo piso, del lado derecho, se prestan cables HDMI, computadoras y balones para jugar.',
    services: ['Préstamo de cable HDMI', 'Préstamo de computadoras', 'Préstamo de balones'],
    spaces: ['Segundo piso, lado derecho: préstamo de equipo'],
    hours: '',
    accessibility: '',
    icon: 'cable',
    color: colors.goldDark,
    procedures: [
      {
        name: 'Préstamo de cable HDMI',
        details:
          'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.',
      },
      {
        name: 'Préstamo de computadoras',
        details:
          'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.',
      },
      {
        name: 'Préstamo de balones',
        details:
          'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.',
      },
    ],
  },
  {
    number: 4,
    name: 'Edificio 4',
    summary: 'Aulas y bodega',
    description: 'Edificio de aulas. Aquí también está la bodega del plantel.',
    services: [],
    spaces: ['Aulas', 'Bodega'],
    hours: '',
    accessibility: '',
    icon: 'apartment',
    color: colors.blueDeep,
    procedures: [],
  },
  {
    number: 5,
    name: 'Edificio 5',
    summary: 'Psicología, Servicio y Prácticas Profesionales y Oficialía Mayor',
    description: '',
    services: [
      'Psicología',
      'Servicio y prácticas profesionales',
      'Titulación',
      'Oficialía Mayor',
    ],
    spaces: [
      'Coordinación de Servicio y Prácticas Profesionales',
      'Oficina del Oficial Mayor',
    ],
    hours: '',
    accessibility: '',
    icon: 'psychology_alt',
    color: colors.blueSteel,
    procedures: [
      {
        name: 'Servicio y prácticas profesionales',
        details:
          'Aquí está la coordinadora de Servicio y Prácticas Profesionales.',
      },
      {
        name: 'Titulación',
        details:
          'Lo atiende la misma coordinación de Servicio y Prácticas Profesionales.',
      },
      {
        name: 'Oficialía Mayor',
        details: 'En este edificio está la oficina del Oficial Mayor.',
      },
    ],
  },
  {
    number: 6,
    name: 'Edificio 6',
    summary: 'Aulas y laboratorios',
    description: 'Edificio de aulas y laboratorios.',
    services: [],
    spaces: ['Aulas', 'Laboratorios'],
    hours: '',
    accessibility: '',
    icon: 'apartment',
    color: colors.crimson,
    procedures: [],
  },
  {
    number: 7,
    name: 'Edificio 7',
    summary: 'Aulas, laboratorios y sistema de internet del plantel',
    description:
      'Edificio de aulas y laboratorios. En el segundo piso está el sistema de internet del Poli.',
    services: ['Sistema de internet'],
    spaces: [
      'Aulas',
      'Laboratorios',
      'Segundo piso: sistema de internet del plantel',
      'Oficina del maestro a cargo del internet',
    ],
    hours: '',
    accessibility: '',
    icon: 'wifi',
    color: colors.blue,
    procedures: [
      {
        name: 'Sistema de internet del plantel',
        details:
          'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.',
      },
    ],
  },
  {
    number: 8,
    name: 'Edificio 8',
    summary: 'Estudio de audio y video, laboratorios y oficinas de departamento',
    description:
      'Aquí están el estudio de audio y video, el laboratorio de sistemas híbridos, el taller de energía eólica y las oficinas de los departamentos de Computación y de Telecomunicaciones y Energías Alternas.',
    services: ['Estudio de audio y video'],
    spaces: [
      'Estudio de audio y video',
      'Laboratorio de sistemas híbridos',
      'Taller de energía eólica',
      'Oficina del Departamento de Computación',
      'Oficina del Departamento de Telecomunicaciones y Energías Alternas',
    ],
    hours: '',
    accessibility: '',
    icon: 'apartment',
    color: colors.blueLight,
    procedures: [],
  },
  {
    number: 9,
    name: 'Edificio 9',
    summary: 'Talleres de manufactura y laboratorio de producción',
    description:
      'Aquí están los talleres de soldadura, máquinas y herramientas y metrología, y el laboratorio de sistemas de producción y control de calidad.',
    services: [],
    spaces: [
      'Taller de soldadura',
      'Taller de máquinas y herramientas',
      'Taller de metrología',
      'Laboratorio de sistemas de producción y control de calidad',
    ],
    hours: '',
    accessibility: '',
    icon: 'apartment',
    color: colors.goldDeep,
    procedures: [],
  },
  {
    number: 10,
    name: 'Edificio 10',
    summary: 'Laboratorios de biotecnología y alimentos',
    description:
      'Aquí están los laboratorios de biorremediación, fermentación, in vitro y alimentos.',
    services: [],
    spaces: [
      'Laboratorio de biorremediación',
      'Laboratorio de fermentación',
      'Laboratorio de in vitro',
      'Laboratorio de alimentos',
    ],
    hours: '',
    accessibility: '',
    icon: 'apartment',
    color: colors.crimsonDark,
    procedures: [],
  },
];
