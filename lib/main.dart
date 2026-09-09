import 'dart:async';

import 'package:flutter/material.dart';

void main() {
  runApp(const PolimapApp());
}

class PolimapApp extends StatelessWidget {
  const PolimapApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF075A63);
    final colorScheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.light,
      surface: const Color(0xFFF7F9F8),
    );

    return MaterialApp(
      title: 'POLIMAP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: colorScheme,
        scaffoldBackgroundColor: const Color(0xFFF4F7F6),
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          elevation: 0,
          centerTitle: false,
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
            side: const BorderSide(color: Color(0xFFE4EBE8)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFE0E8E5)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFE0E8E5)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: seed, width: 1.5),
          ),
        ),
      ),
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _scale = CurvedAnimation(parent: _controller, curve: Curves.easeOutBack);
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _controller.forward();
    Timer(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder<void>(
          pageBuilder: (_, animation, __) => const MainShell(),
          transitionsBuilder: (_, animation, __, child) => FadeTransition(
            opacity: animation,
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 450),
        ),
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF063F46),
      body: SafeArea(
        child: Center(
          child: FadeTransition(
            opacity: _fade,
            child: ScaleTransition(
              scale: _scale,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const PolimapLogo(size: 104, dark: true),
                  const SizedBox(height: 24),
                  Text(
                    'POLIMAP',
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 3,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tu campus en la palma de tu mano',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.82),
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PolimapLogo extends StatelessWidget {
  const PolimapLogo({super.key, this.size = 48, this.dark = false});

  final double size;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final foreground = dark ? const Color(0xFF063F46) : Colors.white;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: dark ? Colors.white : const Color(0xFF075A63),
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
                color: Color(0xFFF2A93B),
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

class CampusBuilding {
  const CampusBuilding({
    required this.number,
    required this.name,
    required this.summary,
    required this.description,
    required this.services,
    required this.spaces,
    required this.hours,
    required this.accessibility,
    required this.icon,
    required this.color,
    required this.mapPosition,
  });

  final int number;
  final String name;
  final String summary;
  final String description;
  final List<String> services;
  final List<String> spaces;
  final String hours;
  final String accessibility;
  final IconData icon;
  final Color color;
  final Offset mapPosition;
}

const campusBuildings = <CampusBuilding>[
  CampusBuilding(
    number: 1,
    name: 'Aulas de sexo',
    summary: 'Salones y áreas de estudio',
    description:
        'Espacio académico con aulas de uso general y zonas para trabajo colaborativo.',
    services: ['Clases', 'Asesorías', 'Área de estudio'],
    spaces: ['Planta baja: aulas 1–6', 'Planta alta: aulas 7–12', 'Baños'],
    hours: 'Lunes a viernes · 7:00–20:00',
    accessibility: 'Acceso por rampa en la entrada principal.',
    icon: Icons.school_rounded,
    color: Color(0xFF246B8E),
    mapPosition: Offset(0.12, 0.16)
  ),
  CampusBuilding(
    number: 2,
    name: 'Cómputo',
    summary: 'Laboratorios y soporte tecnológico',
    description:
        'Laboratorios equipados para prácticas, programación y actividades digitales.',
    services: ['Laboratorios', 'Prácticas', 'Soporte'],
    spaces: ['Laboratorio A', 'Laboratorio B', 'Área de soporte'],
    hours: 'Lunes a viernes · 7:00–19:00',
    accessibility: 'Entrada accesible en el costado norte.',
    icon: Icons.computer_rounded,
    color: Color(0xFF5665A8),
    mapPosition: Offset(0.40, 0.11),
  ),
  CampusBuilding(
    number: 3,
    name: 'Talleres técnicos',
    summary: 'Prácticas y formación técnica',
    description:
        'Área destinada a prácticas técnicas y trabajo con equipo especializado.',
    services: ['Talleres', 'Prácticas técnicas', 'Almacén'],
    spaces: ['Taller 1', 'Taller 2', 'Área de seguridad'],
    hours: 'Según horario de clase',
    accessibility: 'Acceso amplio a nivel de piso.',
    icon: Icons.handyman_rounded,
    color: Color(0xFF9B5C3C),
    mapPosition: Offset(0.70, 0.16),
  ),
  CampusBuilding(
    number: 4,
    name: 'Biblioteca',
    summary: 'Consulta, lectura y recursos',
    description:
        'Zona tranquila para consultar materiales, estudiar y realizar trabajos.',
    services: ['Préstamo', 'Consulta', 'Área de lectura'],
    spaces: ['Recepción', 'Acervo', 'Mesas de estudio'],
    hours: 'Lunes a viernes · 8:00–19:00',
    accessibility: 'Ruta accesible desde la explanada.',
    icon: Icons.local_library_rounded,
    color: Color(0xFF367B5B),
    mapPosition: Offset(0.15, 0.43),
  ),
  CampusBuilding(
    number: 5,
    name: 'Psicología',
    summary: 'Orientación y acompañamiento',
    description:
        'Atención psicológica y orientación para el bienestar de la comunidad estudiantil.',
    services: ['Psicología', 'Orientación', 'Canalización'],
    spaces: ['Recepción', 'Consultorios', 'Sala de espera', 'Baños'],
    hours: 'Lunes a viernes · 8:00–16:00',
    accessibility: 'Acceso por rampa desde el pasillo central.',
    icon: Icons.psychology_alt_rounded,
    color: Color(0xFF8A5A94),
    mapPosition: Offset(0.43, 0.39),
  ),
  CampusBuilding(
    number: 6,
    name: 'Control Escolar',
    summary: 'Documentos y trámites escolares',
    description:
        'Atención para constancias, kardex, credenciales y seguimiento de trámites.',
    services: ['Kardex', 'Constancias', 'Credencial'],
    spaces: ['Ventanillas', 'Sala de espera', 'Archivo'],
    hours: 'Lunes a viernes · 9:00–15:00',
    accessibility: 'Ventanilla accesible en planta baja.',
    icon: Icons.badge_rounded,
    color: Color(0xFFB66A32),
    mapPosition: Offset(0.72, 0.42),
  ),
  CampusBuilding(
    number: 7,
    name: 'Coordinaciones',
    summary: 'Atención académica',
    description:
        'Oficinas de coordinación para orientación sobre programas y asuntos académicos.',
    services: ['Coordinación', 'Tutorías', 'Información'],
    spaces: ['Recepción', 'Coordinaciones', 'Sala de juntas'],
    hours: 'Lunes a viernes · 8:00–16:00',
    accessibility: 'Planta baja con acceso sin escalones.',
    icon: Icons.groups_rounded,
    color: Color(0xFF2E7782),
    mapPosition: Offset(0.10, 0.70),
  ),
  CampusBuilding(
    number: 8,
    name: 'Servicios estudiantiles',
    summary: 'PLEX y apoyo al estudiante',
    description:
        'Información y apoyo sobre actividades, programas y servicios complementarios.',
    services: ['PLEX', 'Becas', 'Actividades'],
    spaces: ['Módulo de atención', 'Sala multiusos', 'Oficinas'],
    hours: 'Lunes a viernes · 8:00–17:00',
    accessibility: 'Acceso frontal con rampa.',
    icon: Icons.diversity_3_rounded,
    color: Color(0xFF4D6C9D),
    mapPosition: Offset(0.37, 0.69),
  ),
  CampusBuilding(
    number: 9,
    name: 'Cafetería',
    summary: 'Alimentos y descanso',
    description:
        'Área de alimentos con mesas y espacios para descansar entre clases.',
    services: ['Alimentos', 'Bebidas', 'Área de descanso'],
    spaces: ['Mostrador', 'Comedor', 'Lavabos'],
    hours: 'Lunes a viernes · 7:00–18:00',
    accessibility: 'Ingreso a nivel de explanada.',
    icon: Icons.restaurant_rounded,
    color: Color(0xFFAF7344),
    mapPosition: Offset(0.68, 0.70),
  ),
  CampusBuilding(
    number: 10,
    name: 'Auditorio',
    summary: 'Eventos y actividades',
    description:
        'Espacio para eventos académicos, culturales y reuniones de la comunidad.',
    services: ['Eventos', 'Conferencias', 'Presentaciones'],
    spaces: ['Vestíbulo', 'Auditorio', 'Escenario'],
    hours: 'Según programación',
    accessibility: 'Lugares reservados y entrada accesible.',
    icon: Icons.theater_comedy_rounded,
    color: Color(0xFF7E596C),
    mapPosition: Offset(0.43, 0.86),
  ),
];

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
              colors: [Color(0xFF075A63), Color(0xFF0C7A72)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF075A63).withValues(alpha: 0.24),
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
                  foregroundColor: const Color(0xFF075A63),
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
              color: const Color(0xFF246B8E),
              onTap: () => onNavigate(1),
            ),
            QuickActionCard(
              icon: Icons.apartment_rounded,
              title: 'Edificios',
              color: const Color(0xFF367B5B),
              onTap: () => onNavigate(2),
            ),
            QuickActionCard(
              icon: Icons.badge_rounded,
              title: 'Control Escolar',
              color: const Color(0xFFB66A32),
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
              color: const Color(0xFF8A5A94),
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
          color: Color(0xFF246B8E),
        ),
        const SizedBox(height: 10),
        const NoticeCard(
          icon: Icons.accessible_forward_rounded,
          title: 'Rutas accesibles',
          body: 'Consulta en cada edificio sus accesos y rutas recomendadas.',
          color: Color(0xFF367B5B),
        ),
      ],
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w900,
              ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF687873),
              ),
        ),
      ],
    );
  }
}

class QuickActionCard extends StatelessWidget {
  const QuickActionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE3EAE7)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800, height: 1.15),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class NoticeCard extends StatelessWidget {
  const NoticeCard({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(
                    body,
                    style: const TextStyle(color: Color(0xFF65746F), height: 1.35),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

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

class BuildingsScreen extends StatefulWidget {
  const BuildingsScreen({super.key});

  @override
  State<BuildingsScreen> createState() => _BuildingsScreenState();
}

class _BuildingsScreenState extends State<BuildingsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final normalized = _query.toLowerCase().trim();
    final results = campusBuildings.where((building) {
      return normalized.isEmpty ||
          building.name.toLowerCase().contains(normalized) ||
          building.services.any((service) => service.toLowerCase().contains(normalized));
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
          child: TextField(
            onChanged: (value) => setState(() => _query = value),
            decoration: const InputDecoration(
              hintText: 'Buscar edificio o servicio',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
        ),
        Expanded(
          child: results.isEmpty
              ? const EmptyState(
                  icon: Icons.search_off_rounded,
                  title: 'Sin resultados',
                  body: 'Prueba con “kardex”, “psicología” o “biblioteca”.',
                )
              : GridView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 28),
                  itemCount: results.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: .78,
                  ),
                  itemBuilder: (context, index) {
                    final building = results[index];
                    return BuildingCard(building: building);
                  },
                ),
        ),
      ],
    );
  }
}

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
            border: Border.all(color: const Color(0xFFE2EAE7)),
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
                      color: const Color(0xFFF0F4F2),
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
                building.summary,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Color(0xFF687873), height: 1.25),
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

class DetailTitle extends StatelessWidget {
  const DetailTitle({super.key, required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 21, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
      ],
    );
  }
}

class InfoTile extends StatelessWidget {
  const InfoTile({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(15),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 3),
                  Text(body, style: const TextStyle(color: Color(0xFF65746F))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FaqEntry {
  const FaqEntry(this.question, this.answer, this.icon);

  final String question;
  final String answer;
  final IconData icon;
}

const faqEntries = [
  FaqEntry(
    '¿Dónde saco mi kardex?',
    'Dirígete a Control Escolar, en el edificio 6. Ahí puedes solicitar kardex y constancias.',
    Icons.description_rounded,
  ),
  FaqEntry(
    '¿Dónde está Control Escolar?',
    'Está en el edificio 6. Consulta el mapa para ver la ruta desde la entrada principal.',
    Icons.badge_rounded,
  ),
  FaqEntry(
    '¿Dónde está PLEX?',
    'El módulo de PLEX se encuentra en Servicios Estudiantiles, edificio 8.',
    Icons.diversity_3_rounded,
  ),
  FaqEntry(
    '¿Dónde está Psicología?',
    'Psicología se encuentra en el edificio 5 y brinda orientación y acompañamiento.',
    Icons.psychology_alt_rounded,
  ),
  FaqEntry(
    '¿Cómo reporto una incidencia?',
    'Abre la sección Reportar, selecciona una categoría, agrega ubicación y describe el problema.',
    Icons.add_alert_rounded,
  ),
  FaqEntry(
    '¿Hay rutas accesibles?',
    'Sí. Activa “Mostrar rutas accesibles” dentro del mapa y consulta el acceso de cada edificio.',
    Icons.accessible_forward_rounded,
  ),
];

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final normalized = _query.toLowerCase().trim();
    final results = faqEntries.where((entry) {
      return normalized.isEmpty ||
          entry.question.toLowerCase().contains(normalized) ||
          entry.answer.toLowerCase().contains(normalized);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Asistente POLIMAP')),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(18, 8, 18, 16),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFF075A63),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Row(
              children: [
                PolimapLogo(size: 50, dark: true),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hola, ¿qué estás buscando?',
                        style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Escribe un trámite, servicio o lugar.',
                        style: TextStyle(color: Color(0xFFD4E7E6)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: TextField(
              controller: _controller,
              autofocus: false,
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: 'Ej. ¿Dónde saco mi kardex?',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _controller.clear();
                          setState(() => _query = '');
                        },
                        icon: const Icon(Icons.close_rounded),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: results.isEmpty
                ? const EmptyState(
                    icon: Icons.question_answer_outlined,
                    title: 'Aún no tengo esa respuesta',
                    body: 'Intenta escribir el nombre del servicio o edificio.',
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(18, 6, 18, 28),
                    itemCount: results.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final entry = results[index];
                      return Card(
                        child: ExpansionTile(
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFFE0EFEC),
                            foregroundColor: const Color(0xFF075A63),
                            child: Icon(entry.icon, size: 21),
                          ),
                          title: Text(entry.question, style: const TextStyle(fontWeight: FontWeight.w800)),
                          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          children: [
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                entry.answer,
                                style: const TextStyle(color: Color(0xFF566660), height: 1.45),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  String? _category;
  String? _location;
  bool _anonymous = true;
  bool _photoAdded = false;

  static const categories = [
    'Basura',
    'Mobiliario dañado',
    'Baños en mal estado',
    'Fuga de agua',
    'Iluminación',
    'Otro',
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(Icons.check_circle_rounded, color: Color(0xFF168A63), size: 52),
        title: const Text('Reporte preparado'),
        content: const Text(
          'La interfaz está lista. Al integrar la base de datos, el reporte se enviará a las autoridades escolares.',
          textAlign: TextAlign.center,
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              _formKey.currentState?.reset();
              setState(() {
                _category = null;
                _location = null;
                _anonymous = true;
                _photoAdded = false;
                _descriptionController.clear();
              });
            },
            child: const Text('Entendido'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 30),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF2DD),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFF0D3A0)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.campaign_rounded, color: Color(0xFFA35D17)),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Ayúdanos a mejorar el campus. No utilices este formulario para emergencias.',
                    style: TextStyle(color: Color(0xFF754515), height: 1.35, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const FormLabel(number: '1', label: '¿Qué ocurrió?'),
          const SizedBox(height: 9),
          DropdownButtonFormField<String>(
            initialValue: _category,
            isExpanded: true,
            decoration: const InputDecoration(
              hintText: 'Selecciona una categoría',
              prefixIcon: Icon(Icons.category_outlined),
            ),
            items: categories
                .map((category) => DropdownMenuItem(value: category, child: Text(category)))
                .toList(),
            onChanged: (value) => setState(() => _category = value),
            validator: (value) => value == null ? 'Selecciona una categoría' : null,
          ),
          const SizedBox(height: 18),
          const FormLabel(number: '2', label: 'Ubicación'),
          const SizedBox(height: 9),
          DropdownButtonFormField<String>(
            initialValue: _location,
            isExpanded: true,
            decoration: const InputDecoration(
              hintText: 'Selecciona el edificio o zona',
              prefixIcon: Icon(Icons.location_on_outlined),
            ),
            items: [
              ...campusBuildings.map(
                (building) => DropdownMenuItem(
                  value: 'Edificio ${building.number}',
                  child: Text('Edificio ${building.number} · ${building.name}'),
                ),
              ),
              const DropdownMenuItem(value: 'Explanada', child: Text('Explanada')),
              const DropdownMenuItem(value: 'Otra zona', child: Text('Otra zona')),
            ],
            onChanged: (value) => setState(() => _location = value),
            validator: (value) => value == null ? 'Indica la ubicación' : null,
          ),
          const SizedBox(height: 18),
          const FormLabel(number: '3', label: 'Fotografía'),
          const SizedBox(height: 9),
          Material(
            color: _photoAdded ? const Color(0xFFE5F3ED) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => setState(() => _photoAdded = !_photoAdded),
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: _photoAdded ? const Color(0xFF5BAE8E) : const Color(0xFFD9E3DF),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _photoAdded ? Icons.check_circle_rounded : Icons.add_a_photo_outlined,
                      color: _photoAdded ? const Color(0xFF168A63) : const Color(0xFF60716B),
                      size: 34,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _photoAdded ? 'Fotografía agregada' : 'Toca para agregar una fotografía',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Demostración de la interfaz',
                      style: TextStyle(fontSize: 12, color: Color(0xFF71807B)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const FormLabel(number: '4', label: 'Descripción'),
          const SizedBox(height: 9),
          TextFormField(
            controller: _descriptionController,
            minLines: 4,
            maxLines: 6,
            maxLength: 300,
            decoration: const InputDecoration(
              hintText: 'Describe brevemente el problema y alguna referencia para encontrarlo.',
              alignLabelWithHint: true,
            ),
            validator: (value) {
              if (value == null || value.trim().length < 10) {
                return 'Escribe una descripción de al menos 10 caracteres';
              }
              return null;
            },
          ),
          Card(
            child: SwitchListTile(
              value: _anonymous,
              onChanged: (value) => setState(() => _anonymous = value),
              secondary: const Icon(Icons.visibility_off_outlined),
              title: const Text('Enviar de forma anónima'),
              subtitle: const Text('No se mostrará información personal.'),
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 56,
            child: FilledButton.icon(
              onPressed: _submit,
              icon: const Icon(Icons.send_rounded),
              label: const Text('Enviar reporte'),
            ),
          ),
        ],
      ),
    );
  }
}

class FormLabel extends StatelessWidget {
  const FormLabel({super.key, required this.number, required this.label});

  final String number;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: Theme.of(context).colorScheme.primary,
          foregroundColor: Colors.white,
          child: Text(number, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
        ),
        const SizedBox(width: 9),
        Text(label, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
      ],
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 62, color: const Color(0xFF94A49E)),
            const SizedBox(height: 14),
            Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(
              body,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF687873), height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
