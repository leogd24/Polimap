import 'package:flutter/material.dart';

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
    required this.mapPosition,
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
  final Offset mapPosition;
}
