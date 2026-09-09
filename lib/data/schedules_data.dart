import '../models/group_schedule.dart';
import 'schedules/bachillerato_tecnologico_contable_empresarial.dart';
import 'schedules/bachillerato_tecnologico_en_administracion.dart';
import 'schedules/bachillerato_tecnologico_en_gestion_aduanal_y_operaciones_empresariales.dart';
import 'schedules/tecnologo_profesional_en_biotecnologia.dart';
import 'schedules/tecnologo_profesional_en_energias_alternas.dart';
import 'schedules/tecnologo_profesional_en_informatica.dart';
import 'schedules/tecnologo_profesional_en_procesos_de_manufactura_competitiva.dart';
import 'schedules/tecnologo_profesional_en_telecomunicaciones.dart';

/// Fuente única de horarios, extraída del PDF oficial del calendario 2026B.
/// Los archivos de `schedules/` están generados: no se editan a mano.
const allSchedules = <GroupSchedule>[
  ...bachilleratoTecnologicoContableEmpresarial,
  ...bachilleratoTecnologicoEnAdministracion,
  ...bachilleratoTecnologicoEnGestionAduanalYOperacionesEmpresariales,
  ...tecnologoProfesionalEnBiotecnologia,
  ...tecnologoProfesionalEnEnergiasAlternas,
  ...tecnologoProfesionalEnInformatica,
  ...tecnologoProfesionalEnProcesosDeManufacturaCompetitiva,
  ...tecnologoProfesionalEnTelecomunicaciones,
];

/// Carreras disponibles, en orden alfabético.
List<String> get scheduleCareers {
  final careers = allSchedules.map((s) => s.career).toSet().toList()..sort();
  return careers;
}

/// Grupos de una carrera: primero los matutinos y luego los vespertinos,
/// cada bloque ordenado por clave.
List<GroupSchedule> groupsForCareer(String career) {
  final groups = allSchedules.where((s) => s.career == career).toList()
    ..sort((a, b) {
      final byShift = a.shift.compareTo(b.shift);
      if (byShift != 0) return byShift;
      return a.code.compareTo(b.code);
    });
  return groups;
}

/// Días de la semana en orden, para recorrer un horario.
const scheduleDays = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
