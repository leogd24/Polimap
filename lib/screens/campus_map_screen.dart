import 'package:flutter/material.dart';

import '../data/campus_buildings.dart';
import '../models/campus_building.dart';
import 'building_detail_screen.dart';

class CampusMapScreen extends StatefulWidget {
  const CampusMapScreen({super.key});

  @override
  State<CampusMapScreen> createState() => _CampusMapScreenState();
}

class _CampusMapScreenState extends State<CampusMapScreen> {
  bool _accessibleRoutes = false;

  void _showBuilding(CampusBuilding building) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          4,
          20,
          20 + MediaQuery.paddingOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: building.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(building.icon, color: building.color),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Edificio ${building.number}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        building.name,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(building.summary, style: const TextStyle(color: Color(0xFF5E6F69))),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.of(this.context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => BuildingDetailScreen(building: building),
                    ),
                  );
                },
                icon: const Icon(Icons.arrow_forward_rounded),
                label: const Text('Ver información completa'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mapa interactivo',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  const Text(
                    'Toca un número para explorar el edificio',
                    style: TextStyle(color: Color(0xFF687873)),
                  ),
                ],
              ),
            ),
            IconButton.filledTonal(
              tooltip: 'Centrar mapa',
              onPressed: () {},
              icon: const Icon(Icons.my_location_rounded),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          height: 500,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: const Color(0xFFE8F0ED),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: const Color(0xFFD7E2DE)),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                children: [
                  Positioned.fill(
                    child: CustomPaint(
                      painter: CampusMapPainter(
                        showAccessibleRoute: _accessibleRoutes,
                      ),
                    ),
                  ),
                  ...campusBuildings.map((building) {
                    const markerSize = 42.0;
                    return Positioned(
                      left: building.mapPosition.dx * (constraints.maxWidth - markerSize),
                      top: building.mapPosition.dy * (constraints.maxHeight - markerSize),
                      child: Tooltip(
                        message: building.name,
                        child: Material(
                          color: building.color,
                          elevation: 3,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => _showBuilding(building),
                            child: SizedBox(
                              width: markerSize,
                              height: markerSize,
                              child: Center(
                                child: Text(
                                  '${building.number}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                  Positioned(
                    left: 14,
                    bottom: 14,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.94),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.circle, color: Color(0xFF0C7A72), size: 12),
                          SizedBox(width: 7),
                          Text('Entrada principal', style: TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: SwitchListTile(
            value: _accessibleRoutes,
            onChanged: (value) => setState(() => _accessibleRoutes = value),
            secondary: const Icon(Icons.accessible_forward_rounded),
            title: const Text('Mostrar rutas accesibles'),
            subtitle: const Text('Resalta el recorrido recomendado sin escalones.'),
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          'Mapa esquemático de demostración. El equipo sustituirá las posiciones con el levantamiento oficial del plantel.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Color(0xFF71807B)),
        ),
      ],
    );
  }
}

class CampusMapPainter extends CustomPainter {
  const CampusMapPainter({required this.showAccessibleRoute});

  final bool showAccessibleRoute;

  @override
  void paint(Canvas canvas, Size size) {
    final grass = Paint()..color = const Color(0xFFDDEAE1);
    final path = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 28
      ..strokeCap = StrokeCap.round;
    final border = Paint()
      ..color = const Color(0xFFD0DDD7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawRect(Offset.zero & size, grass);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .06, size.height * .06, size.width * .88, size.height * .88),
        const Radius.circular(24),
      ),
      border,
    );

    final route = Path()
      ..moveTo(size.width * .5, size.height)
      ..lineTo(size.width * .5, size.height * .1)
      ..moveTo(size.width * .08, size.height * .32)
      ..lineTo(size.width * .9, size.height * .32)
      ..moveTo(size.width * .1, size.height * .62)
      ..lineTo(size.width * .88, size.height * .62);
    canvas.drawPath(route, path);

    final plaza = Paint()..color = const Color(0xFFF2E9D7);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width * .5, size.height * .49),
        width: size.width * .28,
        height: size.height * .17,
      ),
      plaza,
    );

    if (showAccessibleRoute) {
      final accessible = Paint()
        ..color = const Color(0xFF17A673)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round;
      final accessiblePath = Path()
        ..moveTo(size.width * .5, size.height)
        ..lineTo(size.width * .5, size.height * .62)
        ..lineTo(size.width * .18, size.height * .62)
        ..lineTo(size.width * .18, size.height * .31)
        ..lineTo(size.width * .8, size.height * .31);
      canvas.drawPath(accessiblePath, accessible);
    }
  }

  @override
  bool shouldRepaint(covariant CampusMapPainter oldDelegate) {
    return oldDelegate.showAccessibleRoute != showAccessibleRoute;
  }
}
