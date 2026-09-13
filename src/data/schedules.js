import { bachilleratoTecnologicoContableEmpresarial } from './schedules/bachillerato_tecnologico_contable_empresarial.js';
import { bachilleratoTecnologicoEnAdministracion } from './schedules/bachillerato_tecnologico_en_administracion.js';
import { bachilleratoTecnologicoEnGestionAduanalYOperacionesEmpresariales } from './schedules/bachillerato_tecnologico_en_gestion_aduanal_y_operaciones_empresariales.js';
import { tecnologoProfesionalEnBiotecnologia } from './schedules/tecnologo_profesional_en_biotecnologia.js';
import { tecnologoProfesionalEnEnergiasAlternas } from './schedules/tecnologo_profesional_en_energias_alternas.js';
import { tecnologoProfesionalEnInformatica } from './schedules/tecnologo_profesional_en_informatica.js';
import { tecnologoProfesionalEnProcesosDeManufacturaCompetitiva } from './schedules/tecnologo_profesional_en_procesos_de_manufactura_competitiva.js';
import { tecnologoProfesionalEnTelecomunicaciones } from './schedules/tecnologo_profesional_en_telecomunicaciones.js';

/// Fuente única de horarios, extraída del PDF oficial del calendario 2026B.
/// Los archivos de `schedules/` están generados: no se editan a mano.
export const allSchedules = [
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
export const scheduleCareers = [...new Set(allSchedules.map((s) => s.career))].sort();

/// Grupos de una carrera: primero los matutinos y luego los vespertinos,
/// cada bloque ordenado por clave.
export function groupsForCareer(career) {
  return allSchedules
    .filter((s) => s.career === career)
    .sort((a, b) => {
      const byShift = a.shift.localeCompare(b.shift);
      if (byShift !== 0) return byShift;
      return a.code.localeCompare(b.code);
    });
}

/// Etiqueta del grupo, equivalente al getter `label` de Dart.
export function scheduleLabel(group) {
  return `${group.code} · ${group.group}`;
}

/// Días de la semana en orden, para recorrer un horario.
export const scheduleDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
