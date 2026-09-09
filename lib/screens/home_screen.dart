import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../data/campus_buildings.dart';
import '../widgets/notice_card.dart';
import '../widgets/quick_action_card.dart';
import '../widgets/section_header.dart';
import 'building_detail_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.onNavigate,
    required this.onOpenAssistant,
  });

  final ValueChanged<int> onNavigate;
  final VoidCallback onOpenAssistant;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const LinearGradient(
              colors: [AppColors.blue, AppColors.blueLight],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.blue.withValues(alpha: 0.24),
                blurRadius: 25,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'GUÍA DEL CAMPUS',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
              ),
              const SizedBox(height: 15),
              const Text(
                '¿A dónde necesitas ir?',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 27,
                  height: 1.1,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Encuentra edificios, servicios y respuestas sin perder tiempo.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.84),
                  fontSize: 15,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.blue,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                ),
                onPressed: onOpenAssistant,
                icon: const Icon(Icons.search_rounded),
                label: const Text('Pregúntale a POLIMAP'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const SectionHeader(
          title: 'Accesos rápidos',
          subtitle: 'Lo más utilizado por estudiantes',
        ),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.45,
          children: [
            QuickActionCard(
              icon: Icons.map_rounded,
              title: 'Ver mapa',
              color: AppColors.blue,
              onTap: () => onNavigate(1),
            ),
            QuickActionCard(
              icon: Icons.apartment_rounded,
              title: 'Edificios',
              color: AppColors.blue,
              onTap: () => onNavigate(2),
            ),
            QuickActionCard(
              icon: Icons.badge_rounded,
              title: 'Control Escolar',
              color: AppColors.crimson,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => BuildingDetailScreen(
                    building: campusBuildings[5],
                  ),
                ),
              ),
            ),
            QuickActionCard(
              icon: Icons.add_alert_rounded,
              title: 'Crear reporte',
              color: AppColors.gold,
              onTap: () => onNavigate(3),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const SectionHeader(
          title: 'Avisos importantes',
          subtitle: 'Información para la comunidad',
        ),
        const SizedBox(height: 12),
        const NoticeCard(
          icon: Icons.info_outline_rounded,
          title: 'Versión inicial de POLIMAP',
          body: 'Las ubicaciones y horarios se validarán con cada área del plantel.',
          color: AppColors.blue,
        ),
        const SizedBox(height: 10),
        const NoticeCard(
          icon: Icons.accessible_forward_rounded,
          title: 'Rutas accesibles',
          body: 'Consulta en cada edificio sus accesos y rutas recomendadas.',
          color: AppColors.gold,
        ),
      ],
    );
  }
}
