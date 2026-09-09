import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../models/campus_building.dart';
import '../screens/building_detail_screen.dart';

class BuildingCard extends StatelessWidget {
  const BuildingCard({super.key, required this.building});

  final CampusBuilding building;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => BuildingDetailScreen(building: building),
          ),
        ),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Hero(
                    tag: 'building-${building.number}',
                    child: Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: building.color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(building.icon, color: building.color),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.blueTint,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${building.number}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Text(
                building.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, height: 1.12),
              ),
              const SizedBox(height: 6),
              Text(
                building.summary.isEmpty ? 'Sin información' : building.summary,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.25,
                  color: building.summary.isEmpty
                      ? AppColors.textMuted
                      : AppColors.textSecondary,
                  fontStyle:
                      building.summary.isEmpty ? FontStyle.italic : FontStyle.normal,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text(
                    'Ver detalles',
                    style: TextStyle(color: building.color, fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                  const Spacer(),
                  Icon(Icons.arrow_forward_rounded, color: building.color, size: 18),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
