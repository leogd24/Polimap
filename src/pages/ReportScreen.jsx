import { useState } from 'react';
import { colors } from '../styles/theme.js';
import { campusBuildings } from '../data/campusBuildings.js';
import Icon from '../components/Icon.jsx';
import Card from '../components/Card.jsx';
import FormLabel from '../components/FormLabel.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Dialog from '../components/Dialog.jsx';
import { SelectField, TextArea, Switch } from '../components/Inputs.jsx';

const categories = [
  'Basura',
  'Mobiliario dañado',
  'Baños en mal estado',
  'Fuga de agua',
  'Iluminación',
  'Otro',
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
export default function ReportScreen() {
  const [category, setCategory] = useState(null);
  const [location, setLocation] = useState(null);
  const [anonymous, setAnonymous] = useState(true);
  const [photoAdded, setPhotoAdded] = useState(false);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [dialog, setDialog] = useState(false);

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

  const submit = () => {
    if (!validate()) return;
    setDialog(true);
  };

  const reset = () => {
    setDialog(false);
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
          options={categories.map((item) => ({ value: item, label: item }))}
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
        <FilledButton onClick={submit} icon="send" className="w-full" style={{ height: 56 }}>
          Enviar reporte
        </FilledButton>
      </div>

      {dialog && (
        <Dialog
          icon="check_circle"
          title="Reporte preparado"
          content="La interfaz está lista. Al integrar la base de datos, el reporte se enviará a las autoridades escolares."
          actionLabel="Entendido"
          onAction={reset}
        />
      )}
    </div>
  );
}
