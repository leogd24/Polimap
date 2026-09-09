import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'screens/splash_screen.dart';

class PolimapApp extends StatelessWidget {
  const PolimapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POLIMAP',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const SplashScreen(),
    );
  }
}
