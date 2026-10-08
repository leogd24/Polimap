import { useState } from 'react';
import { colors } from '../styles/theme.js';
import { campusBuildings } from '../data/campusBuildings.js';
import Icon from '../components/Icon.jsx';
import Card from '../components/Card.jsx';
import FormLabel from '../components/FormLabel.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Dialog from '../components/Dialog.jsx';
import { SelectField, TextArea, Switch } from '../components/Inputs.jsx';
import { createReport } from '../lib/api.js';

// value = clave de la base de datos (docs/contrato-datos.md), label = lo que se ve.
const categories = [
  { value: 'basura', label: 'Basura' },
  { value: 'mobiliario', label: 'Mobiliario dañado' },
  { value: 'banos', label: 'Baños en mal estado' },
  { value: 'fuga', label: 'Fuga de agua' },
  { value: 'iluminacion', label: 'Iluminación' },
  { value: 'riesgo', label: 'Riesgo o desperfecto' },
  { value: 'otro', label: 'Otro' },
];

const locationOptions = [
  ...campusBuildings.map((building) => ({
    value: `Edificio ${building.number}`,
    label: `Edificio ${building.number} · ${building.name}`,
  })),
  { value: 'Explanada', label: 'Explanada' },
  { value: 'Otra zona', label: 'Otra zona' },
];

/// Equivalente de screens/report_screen.dart
/// Login (Alexis): solo se muestra con sesión (MainShell). El reporte se envía
/// con createReport() de src/lib/api.js; la cookie de sesión dice quién lo manda.
/// La foto y el GPS reales los integra Katia.
export default function ReportScreen({ user }) {
  const [category, setCategory] = useState(null);
  const [location, setLocation] = useState(null);
  const [anonymous, setAnonymous] = useState(true);
  const [photoAdded, setPhotoAdded] = useState(false);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [dialog, setDialog] = useState(null); // { title, content } al terminar
  const [sending, setSending] = useState(false);

  const validate = () => {
    const next = {};
    if (category === null) next.category = 'Selecciona una categoría';
    if (location === null) next.location = 'Indica la ubicación';
    if (description.trim().length < 10) {
      next.description = 'Escribe una descripción de al menos 10 caracteres';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate() || sending) return;

    // FormData con los campos del contrato (api/reportes.php).
    const data = new FormData();
    data.append('categoria', category);
    data.append('descripcion', description.trim());
    if (location.startsWith('Edificio ')) data.append('edificio_number', location.replace('Edificio ', ''));
    else data.append('zona', location);
    data.append('anonimo', anonymous ? '1' : '0');

    setSending(true);
    try {
      const result = await createReport(data);
      setDialog(
        result.offline
          ? {
              title: 'Guardado sin conexión',
              content: `Tu reporte quedó en este celular con el folio ${result.folio}. Envíalo de nuevo cuando tengas internet.`,
            }
          : {
              title: 'Reporte enviado',
              content: `Tu folio es ${result.folio}. Quedó registrado y el equipo del Poli le dará seguimiento.`,
            }
      );
    } catch (error) {
      setDialog({ title: 'No se pudo enviar', content: error.message, failed: true });
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    const failed = dialog?.failed;
    setDialog(null);
    if (failed) return; // si falló, conservamos lo escrito para reintentar
    setCategory(null);
    setLocation(null);
    setAnonymous(true);
    setPhotoAdded(false);
    setDescription('');
    setErrors({});
  };

  return (
    <div className="app-scroll flex-1 px-[18px] pt-3 pb-[30px]">
      <div
        className="flex items-start p-[18px]"
        style={{
          backgroundColor: colors.goldTint,
          borderRadius: 'var(--radius-card)',
          border: `1px solid ${colors.gold}`,
        }}
      >
        <Icon name="campaign" color={colors.goldDark} />
        <p
          className="m-0 ml-3 font-bold"
          style={{ color: colors.goldDark, lineHeight: 1.35 }}
        >
          Ayúdanos a mejorar el campus. No utilices este formulario para emergencias.
        </p>
      </div>

      <div className="mt-[22px]">
        <FormLabel number="1" label="¿Qué ocurrió?" />
      </div>
      <div className="mt-[9px]">
        <SelectField
          value={category}
          onChange={setCategory}
          placeholder="Selecciona una categoría"
          prefixIcon="category"
          options={categories}
          error={errors.category}
        />
      </div>

      <div className="mt-[18px]">
        <FormLabel number="2" label="Ubicación" />
      </div>
      <div className="mt-[9px]">
        <SelectField
          value={location}
          onChange={setLocation}
          placeholder="Selecciona el edificio o zona"
          prefixIcon="location_on"
          options={locationOptions}
          error={errors.location}
        />
      </div>

      <div className="mt-[18px]">
        <FormLabel number="3" label="Fotografía" />
      </div>
      <div className="mt-[9px]">
        <button
          type="button"
          onClick={() => setPhotoAdded(!photoAdded)}
          className="tappable flex w-full flex-col items-center justify-center"
          style={{
            height: 120,
            backgroundColor: photoAdded ? colors.goldTint : colors.surface,
            borderRadius: 'var(--radius-tile)',
            border: `1px solid ${photoAdded ? colors.gold : colors.border}`,
          }}
        >
          <Icon
            name={photoAdded ? 'check_circle' : 'add_a_photo'}
            filled={photoAdded}
            size={34}
            color={photoAdded ? colors.goldDark : colors.textSecondary}
          />
          <span className="mt-2 font-extrabold">
            {photoAdded ? 'Fotografía agregada' : 'Toca para agregar una fotografía'}
          </span>
          <span className="mt-[3px] text-xs" style={{ color: colors.textMuted }}>
            Demostración de la interfaz
          </span>
        </button>
      </div>

      <div className="mt-[18px]">
        <FormLabel number="4" label="Descripción" />
      </div>
      <div className="mt-[9px]">
        <TextArea
          value={description}
          onChange={setDescription}
          placeholder="Describe brevemente el problema y alguna referencia para encontrarlo."
          minRows={4}
          maxLength={300}
          error={errors.description}
        />
      </div>

      <Card>
        <div className="flex items-center px-4 py-3">
          <Icon name="visibility_off" filled={false} color={colors.blue} />
          <div className="ml-4 min-w-0 flex-1">
            <div>Enviar de forma anónima</div>
            <div className="text-sm" style={{ color: colors.textSecondary }}>
              No se mostrará información personal.
            </div>
          </div>
          <Switch value={anonymous} onChange={setAnonymous} />
        </div>
      </Card>

      <div className="mt-[18px]">
        <FilledButton
          onClick={submit}
          icon={sending ? 'hourglass_top' : 'send'}
          className="w-full"
          style={{ height: 56, opacity: sending ? 0.7 : 1 }}
        >
          {sending ? 'Enviando…' : 'Enviar reporte'}
        </FilledButton>
        {user && (
          <p className="m-0 mt-2 text-center text-xs" style={{ color: colors.textMuted }}>
            Sesión: {user.correo}
            {anonymous ? ' · el equipo no verá tu nombre' : ''}
          </p>
        )}
      </div>

      {dialog && (
        <Dialog
          icon={dialog.failed ? 'error' : 'check_circle'}
          title={dialog.title}
          content={dialog.content}
          actionLabel="Entendido"
          onAction={reset}
        />
      )}
    </div>
  );
}
