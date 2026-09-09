import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../models/building_procedure.dart';
import '../models/campus_building.dart';

/// Única fuente de información de los edificios.
///
/// Solo contiene datos confirmados por el plantel. Los campos vacíos se
/// muestran en la app como "Sin información" y están pendientes de llenar.
const campusBuildings = <CampusBuilding>[
  CampusBuilding(
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
    icon: Icons.support_agent_rounded,
    color: AppColors.blue,
    procedures: [
      BuildingProcedure(
        name: 'Constancias',
        details: 'Presenta tu código de alumno.',
      ),
      BuildingProcedure(
        name: 'Kardex',
        details: 'Presenta tu código de alumno.',
      ),
      BuildingProcedure(
        name: 'Certificados parciales',
        details:
            'Se te entrega una ficha de pago. Tienes que llevar el recibo de que ya pagaste y fotos para la credencial.',
      ),
      BuildingProcedure(
        name: 'Condonaciones de orden de pago',
        details:
            'Lleva tu orden de pago. Ahí te dan una nota y tienes que explicar por qué solicitas la condonación.',
      ),
      BuildingProcedure(
        name: 'Bajas voluntarias',
        details:
            'Tiene que venir el alumno; si es menor de edad, acompañado de un tutor. Lleva documentos de identificación, la orden de pago pagada y el formato de pago, y llena el formato indicando el motivo de la baja.',
      ),
      BuildingProcedure(
        name: 'Consulta de materias',
        details: 'Los alumnos pueden revisar sus materias aquí.',
      ),
      BuildingProcedure(
        name: 'PLEX',
        details:
            'En las oficinas de PLEX puedes inscribirte y consultar tus calificaciones de PLEX.',
      ),
      BuildingProcedure(
        name: 'Recuperación de contraseña del correo institucional',
        details:
            'En Coordinación. Necesitas llevar tu correo institucional, número de teléfono con WhatsApp, código y nombre completo.',
      ),
      BuildingProcedure(
        name: 'Asesorías de materias irregulares',
        details:
            'Regístrate en condonación con el formato que te van a dar. También atienden dudas sobre asesorías.',
      ),
      BuildingProcedure(
        name: 'Atención a alumnos irregulares y honoríficos',
        details: 'Los atiende Coordinación.',
      ),
      BuildingProcedure(
        name: 'Plataforma de Classroom',
        details: 'Coordinación le da mantenimiento a la plataforma.',
      ),
      BuildingProcedure(
        name: 'Desempeño docente',
        details:
            'Coordinación evalúa el desempeño docente, capacita al personal docente y genera las constancias de desempeño docente.',
      ),
    ],
  ),
  CampusBuilding(
    number: 2,
    name: 'Edificio 2',
    summary: '',
    description: '',
    services: [],
    spaces: [],
    hours: '',
    accessibility: '',
    icon: Icons.apartment_rounded,
    color: AppColors.blueLight,
  ),
  CampusBuilding(
    number: 3,
    name: 'Edificio 3',
    summary: 'Préstamo de cable HDMI',
    description: '',
    services: ['Préstamo de cable HDMI'],
    spaces: [],
    hours: '',
    accessibility: '',
    icon: Icons.cable_rounded,
    color: AppColors.goldDark,
    procedures: [
      BuildingProcedure(
        name: 'Préstamo de cable HDMI',
        details:
            'En el segundo piso, del lado derecho. Preséntate con tu credencial del Poli.',
      ),
    ],
  ),
  CampusBuilding(
    number: 4,
    name: 'Edificio 4',
    summary: '',
    description: '',
    services: [],
    spaces: [],
    hours: '',
    accessibility: '',
    icon: Icons.apartment_rounded,
    color: AppColors.blueDeep,
  ),
  CampusBuilding(
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
    icon: Icons.psychology_alt_rounded,
    color: AppColors.blueSteel,
    procedures: [
      BuildingProcedure(
        name: 'Servicio y prácticas profesionales',
        details:
            'Aquí está la coordinadora de Servicio y Prácticas Profesionales.',
      ),
      BuildingProcedure(
        name: 'Titulación',
        details:
            'Lo atiende la misma coordinación de Servicio y Prácticas Profesionales.',
      ),
      BuildingProcedure(
        name: 'Oficialía Mayor',
        details: 'En este edificio está la oficina del Oficial Mayor.',
      ),
    ],
  ),
  CampusBuilding(
    number: 6,
    name: 'Edificio 6',
    summary: '',
    description: '',
    services: [],
    spaces: [],
    hours: '',
    accessibility: '',
    icon: Icons.apartment_rounded,
    color: AppColors.crimson,
  ),
  CampusBuilding(
    number: 7,
    name: 'Edificio 7',
    summary: 'Sistema de internet del plantel',
    description: '',
    services: ['Sistema de internet'],
    spaces: [
      'Segundo piso: sistema de internet del plantel',
      'Oficina del maestro a cargo del internet',
    ],
    hours: '',
    accessibility: '',
    icon: Icons.wifi_rounded,
    color: AppColors.blue,
    procedures: [
      BuildingProcedure(
        name: 'Sistema de internet del plantel',
        details:
            'En el segundo piso está la mayor parte del sistema de internet del Poli, junto con la oficina del maestro a cargo.',
      ),
    ],
  ),
  CampusBuilding(
    number: 8,
    name: 'Edificio 8',
    summary: '',
    description: '',
    services: [],
    spaces: [],
    hours: '',
    accessibility: '',
    icon: Icons.apartment_rounded,
    color: AppColors.blueLight,
  ),
  CampusBuilding(
    number: 9,
    name: 'Edificio 9',
    summary: '',
    description: '',
    services: [],
    spaces: [],
    hours: '',
    accessibility: '',
    icon: Icons.apartment_rounded,
    color: AppColors.goldDeep,
  ),
  CampusBuilding(
    number: 10,
    name: 'Edificio 10',
    summary: '',
    description: '',
    services: [],
    spaces: [],
    hours: '',
    accessibility: '',
    icon: Icons.apartment_rounded,
    color: AppColors.crimsonDark,
  ),
];
