/// Una clase dentro del horario de un grupo.
class ClassSession {
  const ClassSession(
    this.day,
    this.start,
    this.end,
    this.subject,
    this.teacher,
    this.room,
  );

  final String day;
  final String start;
  final String end;
  final String subject;
  final String teacher;

  /// Aula, laboratorio o taller. Vacío cuando el horario no lo indica.
  final String room;
}
