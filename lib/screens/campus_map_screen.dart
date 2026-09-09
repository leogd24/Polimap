import 'package:flutter/material.dart';

import '../data/campus_buildings.dart';
import '../widgets/route_stop.dart';
import '../widgets/section_header.dart';
import 'building_detail_screen.dart';

class CampusMapScreen extends StatelessWidget {
  const CampusMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // El orden del recorrido lo marca el número del edificio, no el orden de
    // la lista: agregar edificios nuevos a los datos los acomoda solos.
    final route = [...campusBuildings]
      ..sort((a, b) => a.number.compareTo(b.number));

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
      itemCount: route.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: SectionHeader(
              title: 'Recorrido del campus',
              subtitle:
                  'Del edificio 1 al ${route.length}. Toca uno para ver su información.',
            ),
          );
        }

        final building = route[index - 1];
        return RouteStop(
          building: building,
          isFirst: index == 1,
          isLast: index == route.length,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => BuildingDetailScreen(building: building),
            ),
          ),
        );
      },
    );
  }
}
