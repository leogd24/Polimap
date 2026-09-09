import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../data/schedules_data.dart';
import '../models/class_session.dart';
import '../models/group_schedule.dart';
import '../widgets/empty_state.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  String? _career;
  GroupSchedule? _group;

  @override
  Widget build(BuildContext context) {
    final careers = scheduleCareers;
    final groups =
        _career == null ? <GroupSchedule>[] : groupsForCareer(_career!);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
      children: [
        DropdownButtonFormField<String>(
          initialValue: _career,
          isExpanded: true,
          decoration: const InputDecoration(
            hintText: 'Selecciona tu carrera',
            prefixIcon: Icon(Icons.school_outlined),
          ),
          items: careers
              .map(
                (career) => DropdownMenuItem(
                  value: career,
                  child: Text(
                    career,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, height: 1.2),
                  ),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() {
            _career = value;
            _group = null;
          }),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<GroupSchedule>(
          // Se reconstruye al cambiar de carrera para limpiar el grupo previo.
          key: ValueKey(_career),
          initialValue: _group,
          isExpanded: true,
          decoration: InputDecoration(
            hintText: _career == null
                ? 'Primero elige la carrera'
                : 'Selecciona tu grupo y turno',
            prefixIcon: const Icon(Icons.groups_outlined),
          ),
          items: groups
              .map(
                (group) => DropdownMenuItem(
                  value: group,
                  child: Text(
                    '${group.code} · ${group.group} · ${group.shift}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, height: 1.2),
                  ),
                ),
              )
              .toList(),
          onChanged: groups.isEmpty
              ? null
              : (value) => setState(() => _group = value),
        ),
        const SizedBox(height: 18),
        if (_group == null)
          const Padding(
            padding: EdgeInsets.only(top: 40),
            child: EmptyState(
              icon: Icons.calendar_month_outlined,
              title: 'Elige tu carrera y grupo',
              body: 'Aquí aparecerá tu horario de clases de la semana.',
            ),
          )
        else
          ..._schedule(_group!),
      ],
    );
  }

  List<Widget> _schedule(GroupSchedule group) {
    final widgets = <Widget>[
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.blue,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.code,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${group.group} · ${group.shift}',
                    style: const TextStyle(color: AppColors.blueTint, fontSize: 12),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${group.weeklyHours} h',
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text(
                  'a la semana',
                  style: TextStyle(color: AppColors.blueTint, fontSize: 11),
                ),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
    ];

    for (final day in scheduleDays) {
      final classes = group.sessions.where((s) => s.day == day).toList();
      if (classes.isEmpty) continue;

      widgets
        ..add(_DayCard(day: day, classes: classes))
        ..add(const SizedBox(height: 12));
    }

    widgets.add(
      const Padding(
        padding: EdgeInsets.only(top: 6),
        child: Text(
          'Horarios del calendario 2026B. Verifica cambios con tu coordinación.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11, color: AppColors.textMuted),
        ),
      ),
    );

    return widgets;
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({required this.day, required this.classes});

  final String day;
  final List<ClassSession> classes;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Text(
              day,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: AppColors.blue,
              ),
            ),
          ),
          for (var i = 0; i < classes.length; i++) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 54,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          classes[i].start,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          classes[i].end,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          classes[i].subject,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          classes[i].room,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.crimson,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          classes[i].teacher,
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.textSecondary,
                            height: 1.25,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
