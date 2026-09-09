import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:polimap/models/group_schedule.dart';
import 'package:polimap/screens/schedule_screen.dart';

void main() {
  testWidgets('el horario aparece al elegir carrera y grupo', (tester) async {
    // Tamaño de teléfono: es donde se usa la app y donde el texto largo de
    // materias y maestros puede desbordarse.
    tester.view.physicalSize = const Size(411, 915);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ScheduleScreen())),
    );

    expect(find.text('Elige tu carrera y grupo'), findsOneWidget);

    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('TECNOLOGO PROFESIONAL EN INFORMATICA').last);
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<GroupSchedule>));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('7AM TPIN').last);
    await tester.pumpAndSettle();

    expect(find.text('Elige tu carrera y grupo'), findsNothing);
    expect(find.text('Lunes'), findsOneWidget);
    expect(find.text('27 h'), findsOneWidget);
    expect(find.text('GESTION DE SISTEMAS Y BASES DE DATOS'), findsWidgets);
    expect(find.text('Lab. E7-L06'), findsWidgets);
  });
}
