import 'class_session.dart';

/// El horario semanal de un grupo, tal como viene en el PDF oficial.
class GroupSchedule {
  const GroupSchedule({
    required this.code,
    required this.career,
    required this.shift,
    required this.group,
    required this.weeklyHours,
    required this.sourcePage,
    required this.sessions,
    this.needsReview = false,
  });

  /// Clave del grupo, por ejemplo "1AM BTCE".
  final String code;
  final String career;
  final String shift;

  /// Semestre y letra, por ejemplo "Primero \"A\"".
  final String group;

  /// Horas semanales que declara el PDF.
  final int weeklyHours;

  /// Página del PDF de la que salió, para poder cotejarla.
  final int sourcePage;

  final List<ClassSession> sessions;

  /// Las horas extraídas no cuadran con las que declara el PDF: hay que
  /// revisar esa página contra el original.
  final bool needsReview;

  String get label => '$code · $group';
}
