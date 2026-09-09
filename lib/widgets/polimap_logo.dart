import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

class PolimapLogo extends StatelessWidget {
  const PolimapLogo({super.key, this.size = 48, this.dark = false});

  final double size;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final foreground = dark ? AppColors.blue : Colors.white;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: dark ? Colors.white : AppColors.blue,
        borderRadius: BorderRadius.circular(size * 0.28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Icon(Icons.map_rounded, color: foreground, size: size * 0.58),
          Positioned(
            right: size * 0.12,
            top: size * 0.08,
            child: Container(
              width: size * 0.28,
              height: size * 0.28,
              decoration: const BoxDecoration(
                color: AppColors.gold,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.location_on_rounded,
                color: Colors.white,
                size: size * 0.18,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
