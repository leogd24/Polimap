import 'package:flutter/material.dart';

import '../widgets/polimap_logo.dart';
import 'assistant_screen.dart';
import 'buildings_screen.dart';
import 'campus_map_screen.dart';
import 'home_screen.dart';
import 'report_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  static const _titles = ['Inicio', 'Mapa del campus', 'Edificios', 'Reportar'];

  void _openAssistant() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const AssistantScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(
        onNavigate: (index) => setState(() => _currentIndex = index),
        onOpenAssistant: _openAssistant,
      ),
      const CampusMapScreen(),
      const BuildingsScreen(),
      const ReportScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: Row(
          children: [
            const PolimapLogo(size: 38),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _titles[_currentIndex],
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
                ),
                const Text(
                  'Escuela Politécnica',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton.filledTonal(
            tooltip: 'Asistente de consultas',
            onPressed: _openAssistant,
            icon: const Icon(Icons.chat_bubble_outline_rounded),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: IndexedStack(index: _currentIndex, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Inicio',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map_rounded),
            label: 'Mapa',
          ),
          NavigationDestination(
            icon: Icon(Icons.apartment_outlined),
            selectedIcon: Icon(Icons.apartment_rounded),
            label: 'Edificios',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_alert_outlined),
            selectedIcon: Icon(Icons.add_alert_rounded),
            label: 'Reportar',
          ),
        ],
      ),
    );
  }
}
