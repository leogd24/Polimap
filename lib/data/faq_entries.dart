import 'package:flutter/material.dart';

import '../models/faq_entry.dart';

const faqEntries = [
  FaqEntry(
    '¿Dónde saco mi kardex?',
    'Dirígete a Control Escolar, en el edificio 6. Ahí puedes solicitar kardex y constancias.',
    Icons.description_rounded,
  ),
  FaqEntry(
    '¿Dónde está Control Escolar?',
    'Está en el edificio 6. Consulta el mapa para ver la ruta desde la entrada principal.',
    Icons.badge_rounded,
  ),
  FaqEntry(
    '¿Dónde está PLEX?',
    'El módulo de PLEX se encuentra en Servicios Estudiantiles, edificio 8.',
    Icons.diversity_3_rounded,
  ),
  FaqEntry(
    '¿Dónde está Psicología?',
    'Psicología se encuentra en el edificio 5 y brinda orientación y acompañamiento.',
    Icons.psychology_alt_rounded,
  ),
  FaqEntry(
    '¿Cómo reporto una incidencia?',
    'Abre la sección Reportar, selecciona una categoría, agrega ubicación y describe el problema.',
    Icons.add_alert_rounded,
  ),
  FaqEntry(
    '¿Hay rutas accesibles?',
    'Sí. Activa “Mostrar rutas accesibles” dentro del mapa y consulta el acceso de cada edificio.',
    Icons.accessible_forward_rounded,
  ),
];
