import 'package:flutter/material.dart';

import '../data/campus_buildings.dart';
import '../widgets/building_card.dart';
import '../widgets/empty_state.dart';

class BuildingsScreen extends StatefulWidget {
  const BuildingsScreen({super.key});

  @override
  State<BuildingsScreen> createState() => _BuildingsScreenState();
}

class _BuildingsScreenState extends State<BuildingsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final normalized = _query.toLowerCase().trim();
    final results = campusBuildings.where((building) {
      return normalized.isEmpty ||
          building.name.toLowerCase().contains(normalized) ||
          building.services.any((service) => service.toLowerCase().contains(normalized));
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
          child: TextField(
            onChanged: (value) => setState(() => _query = value),
            decoration: const InputDecoration(
              hintText: 'Buscar edificio o servicio',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
        ),
        Expanded(
          child: results.isEmpty
              ? const EmptyState(
                  icon: Icons.search_off_rounded,
                  title: 'Sin resultados',
                  body: 'Prueba con “kardex”, “psicología” o “biblioteca”.',
                )
              : GridView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 28),
                  itemCount: results.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: .78,
                  ),
                  itemBuilder: (context, index) {
                    final building = results[index];
                    return BuildingCard(building: building);
                  },
                ),
        ),
      ],
    );
  }
}
