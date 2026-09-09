import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// Marca un dato que todavía no ha sido confirmado por el plantel.
class MissingInfo extends StatelessWidget {
  const MissingInfo({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Icon(Icons.info_outline_rounded, size: 16, color: AppColors.textMuted),
        SizedBox(width: 6),
        Text(
          'Sin información',
          style: TextStyle(
            color: AppColors.textMuted,
            fontStyle: FontStyle.italic,
          ),
        ),
      ],
    );
  }
}
