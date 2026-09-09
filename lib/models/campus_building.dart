import 'package:flutter/material.dart';

import 'building_procedure.dart';

class CampusBuilding {
  const CampusBuilding({
    required this.number,
    required this.name,
    required this.summary,
    required this.description,
    required this.services,
    required this.spaces,
    required this.hours,
    required this.accessibility,
    required this.icon,
    required this.color,
    this.procedures = const [],
  });

  final int number;
  final String name;
  final String summary;
  final String description;
  final List<String> services;
  final List<String> spaces;
  final String hours;
  final String accessibility;
  final IconData icon;
  final Color color;

  /// Trámites con sus requisitos. Vacío mientras no haya información
  /// confirmada del edificio.
  final List<BuildingProcedure> procedures;
}
