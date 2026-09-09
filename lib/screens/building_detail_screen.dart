import 'package:flutter/material.dart';

import '../models/campus_building.dart';
import '../widgets/detail_title.dart';
import '../widgets/info_tile.dart';

class BuildingDetailScreen extends StatelessWidget {
  const BuildingDetailScreen({super.key, required this.building});

  final CampusBuilding building;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(
            expandedHeight: 245,
            pinned: true,
            foregroundColor: Colors.white,
            backgroundColor: building.color,
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                building.name,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [building.color, building.color.withValues(alpha: .72)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: -25,
                      bottom: -20,
                      child: Icon(
                        building.icon,
                        color: Colors.white.withValues(alpha: .12),
                        size: 210,
                      ),
                    ),
                    Positioned(
                      left: 24,
                      top: 95,
                      child: Hero(
                        tag: 'building-${building.number}',
                        child: Container(
                          width: 68,
                          height: 68,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(21),
                          ),
                          child: Icon(building.icon, color: building.color, size: 34),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
            sliver: SliverList.list(
              children: [
                Text(
                  'Edificio ${building.number}',
                  style: TextStyle(color: building.color, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                Text(
                  building.description,
                  style: const TextStyle(fontSize: 16, height: 1.45, color: Color(0xFF45534F)),
                ),
                const SizedBox(height: 22),
                const DetailTitle(icon: Icons.room_service_rounded, title: 'Servicios'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: building.services
                      .map(
                        (service) => Chip(
                          avatar: Icon(Icons.check_circle_rounded, size: 17, color: building.color),
                          label: Text(service),
                          side: BorderSide(color: building.color.withValues(alpha: .18)),
                          backgroundColor: building.color.withValues(alpha: .07),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 22),
                const DetailTitle(icon: Icons.layers_rounded, title: 'Espacios'),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < building.spaces.length; i++) ...[
                        ListTile(
                          leading: CircleAvatar(
                            backgroundColor: building.color.withValues(alpha: .1),
                            foregroundColor: building.color,
                            child: Text('${i + 1}'),
                          ),
                          title: Text(building.spaces[i]),
                        ),
                        if (i < building.spaces.length - 1)
                          const Divider(height: 1, indent: 72),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                InfoTile(
                  icon: Icons.schedule_rounded,
                  title: 'Horario de atención',
                  body: building.hours,
                  color: building.color,
                ),
                const SizedBox(height: 10),
                InfoTile(
                  icon: Icons.accessible_forward_rounded,
                  title: 'Accesibilidad',
                  body: building.accessibility,
                  color: building.color,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 54,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: building.color),
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Ruta preparada. Se conectará al mapa oficial del campus.'),
                      ),
                    ),
                    icon: const Icon(Icons.directions_walk_rounded),
                    label: const Text('Cómo llegar'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
