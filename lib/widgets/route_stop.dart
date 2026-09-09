import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../models/campus_building.dart';
import 'missing_info.dart';

/// Un edificio como parada dentro de la línea de recorrido del campus.
class RouteStop extends StatelessWidget {
  const RouteStop({
    super.key,
    required this.building,
    required this.isFirst,
    required this.isLast,
    required this.onTap,
  });

  final CampusBuilding building;
  final bool isFirst;
  final bool isLast;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 46,
            child: Column(
              children: [
                Container(
                  width: 3,
                  height: 10,
                  color: isFirst ? Colors.transparent : AppColors.border,
                ),
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: building.color,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: building.color.withValues(alpha: 0.28),
                        blurRadius: 12,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      '${building.number}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 3,
                    color: isLast ? Colors.transparent : AppColors.border,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 14, bottom: 16),
              child: Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                child: InkWell(
                  onTap: onTap,
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Edificio ${building.number}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: building.color,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                building.name,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  height: 1.15,
                                ),
                              ),
                              const SizedBox(height: 5),
                              if (building.summary.isEmpty)
                                const MissingInfo()
                              else
                                Text(
                                  building.summary,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                    height: 1.3,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right_rounded, color: building.color),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
