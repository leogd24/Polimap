import { useEffect, useRef, useState } from 'react';
import { colors } from '../styles/theme.js';
import { campusBuildings } from '../data/campusBuildings.js';
import Icon from '../components/Icon.jsx';
import Card from '../components/Card.jsx';
import FormLabel from '../components/FormLabel.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Dialog from '../components/Dialog.jsx';
import { SelectField, TextArea, Switch } from '../components/Inputs.jsx';
import { createReport, getSimilarReports, supportReport } from '../lib/api.js';
import { compressImage, formatBytes } from '../lib/compressImage.js';
// Límites del campus que afinó Marcos (los mismos del mapa): así hay una sola fuente.
import { CAMPUS } from '../components/CampusMap.jsx';
import SimilarReports from '../components/SimilarReports.jsx';

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

// Mensajes del GPS: los mismos que usa el mapa (CampusMap.jsx), para que la app hable igual.
const gpsErrors = {
  1: 'Negaste el permiso de ubicación. Actívalo en el candado de la barra de direcciones y vuelve a intentar.',
  2: 'No se pudo obtener tu ubicación. Revisa que el GPS esté encendido.',
  3: 'El GPS está tardando. Intenta en un lugar abierto.',
};

/** ¿La coordenada cae dentro del rectángulo del campus? (solo para avisar, no bloquea) */
function insideCampus(lat, lng) {
  const [[south, west], [north, east]] = CAMPUS.limites;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

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
  // Foto elegida: { file, url }. `file` es lo que se enviará al servidor (paso 2)
  // y `url` es una dirección temporal para mostrar la miniatura.
  const [photo, setPhoto] = useState(null);
  // GPS (opcional). gps = { lat, lng, accuracy } cuando ya se obtuvo.
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  // true mientras se achica la foto (tarda menos de un segundo en la mayoría de celulares).
  const [compressing, setCompressing] = useState(false);
  // Dos <input type="file"> escondidos: uno abre directo la cámara y otro la galería.
  // (En Android reciente, un solo input se va directo a la galería sin ofrecer cámara.)
  const cameraInput = useRef(null);
  const galleryInput = useRef(null);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [dialog, setDialog] = useState(null); // { title, content } al terminar
  const [sending, setSending] = useState(false);
  // "A mí también me pasa": reportes parecidos del mismo lugar y categoría.
  const [similar, setSimilar] = useState([]);
  const [supporting, setSupporting] = useState(null); // folio que se está sumando

  // Cada vez que cambian la categoría o el lugar, buscamos si ya lo reportaron.
  useEffect(() => {
    if (!category || !location) {
      setSimilar([]);
      return undefined;
    }
    let cancelado = false;
    getSimilarReports(category, location).then((lista) => {
      if (!cancelado) setSimilar(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [category, location]);

  // Libera la miniatura anterior cuando cambia la foto o se cierra la pantalla
  // (cada URL.createObjectURL ocupa memoria hasta que se revoca).
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  // Se ejecuta cuando el alumno toma o elige una foto.
  // Paso 2: antes de guardarla, la achicamos con compressImage() (src/lib/compressImage.js).
  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    // Vaciamos el input para que, si vuelve a elegir la misma foto, también se detecte.
    event.target.value = '';
    if (!file) return; // canceló sin elegir nada

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: 'El archivo debe ser una imagen' }));
      return;
    }
    setErrors((prev) => ({ ...prev, photo: undefined }));

    setCompressing(true);
    try {
      const small = await compressImage(file);
      // Para probar: en la consola (F12) se ve cuánto pesaba y cuánto pesa ahora.
      console.info(`[foto] ${formatBytes(file.size)} → ${formatBytes(small.size)}`);
      setPhoto({ file: small, url: URL.createObjectURL(small) });
    } catch (error) {
      setErrors((prev) => ({ ...prev, photo: error.message }));
    } finally {
      setCompressing(false);
    }
  };

  // Pide la ubicación UNA vez, solo cuando el alumno toca el botón.
  // (El navegador muestra su propio aviso de permiso; nunca lo pedimos solos.)
  const requestGps = () => {
    setGpsError('');
    // Paso 1: el GPS solo existe en páginas seguras (https o localhost).
    if (!window.isSecureContext) {
      setGpsError('La ubicación solo funciona en https o en localhost.');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGpsError('Tu navegador no permite obtener la ubicación.');
      return;
    }
    // Paso 2: pedir la posición. Si el alumno dice que no, cae en el error 1.
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, // radio de error en metros
        });
        setGpsLoading(false);
      },
      (error) => {
        setGpsError(gpsErrors[error.code] ?? 'Error de ubicación.');
        setGpsLoading(false);
      },
      // Alta precisión (usa el GPS real), máximo 15 s de espera,
      // y acepta una posición de hasta 30 s de antigüedad.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const support = async (folio) => {
    setSupporting(folio);
    try {
      const result = await supportReport(folio);
      const personas = result.apoyos + 1;
      setDialog({
        title: result.yaEstaba ? 'Ya estabas sumado' : '¡Gracias por sumarte!',
        content:
          `${personas} personas reportaron ${folio}. ` +
          (result.prioridad === 'alta'
            ? 'Ya es urgente para el equipo del Poli.'
            : 'Mientras más se sumen, más rápido se atiende.') +
          ' Lo verás en "Mis reportes".',
      });
    } catch (error) {
      setDialog({ title: 'No se pudo sumar', content: error.message, failed: true });
    } finally {
      setSupporting(null);
    }
  };

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
    if (!validate() || sending || compressing) return;

    // FormData con los campos del contrato (api/reportes.php).
    const data = new FormData();
    data.append('categoria', category);
    data.append('descripcion', description.trim());
    if (location.startsWith('Edificio ')) data.append('edificio_number', location.replace('Edificio ', ''));
    else data.append('zona', location);
    data.append('anonimo', anonymous ? '1' : '0');
    // Foto (opcional): ya va comprimida. El servidor la guarda en api/uploads/.
    if (photo) data.append('foto', photo.file);
    // GPS (opcional): 6 decimales ≈ 10 cm, es lo que guarda la columna DECIMAL(9,6).
    if (gps) {
      data.append('lat', gps.lat.toFixed(6));
      data.append('lng', gps.lng.toFixed(6));
      data.append('precision_m', String(Math.round(gps.accuracy)));
    }

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
    setPhoto(null);
    setGps(null);
    setGpsError('');
    setDescription('');
    setErrors({});
    setSimilar([]);
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

      {/* GPS opcional: ayuda a ubicar el problema exacto dentro del edificio o zona */}
      <div className="mt-[9px]">
        {gps ? (
          // Ya hay ubicación: la mostramos con su precisión y opción de quitarla.
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{
              backgroundColor: colors.greenTint,
              borderRadius: 'var(--radius-tile)',
              border: `1px solid ${colors.green}`,
            }}
          >
            <span className="flex flex-col">
              <span className="flex items-center font-extrabold" style={{ color: colors.greenDark }}>
                <Icon name="my_location" size={20} color={colors.greenDark} />
                <span className="ml-1">Ubicación agregada · ±{Math.round(gps.accuracy)} m</span>
              </span>
              {!insideCampus(gps.lat, gps.lng) && (
                <span className="mt-[2px] text-xs" style={{ color: colors.textSecondary }}>
                  Parece que no estás en el campus. Se enviará de todos modos.
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setGps(null)}
              className="tappable flex items-center gap-1 px-2 py-1 font-bold"
              style={{ color: colors.crimson }}
            >
              <Icon name="delete" size={18} color={colors.crimson} />
              Quitar
            </button>
          </div>
        ) : (
          // Sin ubicación: botón para pedirla (o aviso mientras se obtiene).
          <button
            type="button"
            onClick={requestGps}
            disabled={gpsLoading}
            className="tappable flex w-full items-center justify-center gap-2 px-3 py-[10px] font-bold"
            style={{
              backgroundColor: colors.surface,
              color: colors.blue,
              borderRadius: 'var(--radius-tile)',
              border: `1px dashed ${gpsError ? colors.crimson : colors.border}`,
            }}
          >
            <Icon name={gpsLoading ? 'hourglass_top' : 'add_location_alt'} size={20} color={colors.blue} />
            {gpsLoading ? 'Obteniendo ubicación…' : 'Agregar mi ubicación GPS (opcional)'}
          </button>
        )}
        {gpsError && (
          <p className="m-0 mt-1 text-xs font-bold" style={{ color: colors.crimson }}>
            {gpsError}
          </p>
        )}
      </div>

      <SimilarReports reports={similar} onSupport={support} busy={supporting} />

      <div className="mt-[18px]">
        <FormLabel number="3" label="Fotografía" />
      </div>
      <div className="mt-[9px]">
        {/* Inputs nativos escondidos. No piden permisos ni necesitan HTTPS:
            la foto la toma la app de cámara del celular, no nuestro código.
            capture="environment" → abre directo la cámara trasera.
            Sin capture → abre la galería (en la compu, el explorador de archivos). */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pickPhoto}
          className="hidden"
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          onChange={pickPhoto}
          className="hidden"
        />

        {photo ? (
          // Ya hay foto: miniatura + botón para quitarla (y volver a elegir).
          <div
            className="overflow-hidden"
            style={{
              borderRadius: 'var(--radius-tile)',
              border: `1px solid ${colors.gold}`,
              backgroundColor: colors.goldTint,
            }}
          >
            <img
              src={photo.url}
              alt="Vista previa de la fotografía del reporte"
              className="block w-full object-cover"
              style={{ height: 180 }}
            />
            <div className="flex items-center justify-between px-3 py-2">
              <span className="flex items-center font-extrabold" style={{ color: colors.goldDark }}>
                <Icon name="check_circle" size={20} color={colors.goldDark} />
                {/* Mostramos el peso final para comprobar que sí se comprimió */}
                <span className="ml-1">Fotografía agregada · {formatBytes(photo.file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="tappable flex items-center gap-1 px-2 py-1 font-bold"
                style={{ color: colors.crimson }}
              >
                <Icon name="delete" size={18} color={colors.crimson} />
                Quitar
              </button>
            </div>
          </div>
        ) : (
          // Sin foto: dos botones, cámara o galería.
          <div
            className="flex flex-col items-center p-4"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 'var(--radius-tile)',
              border: `1px solid ${errors.photo ? colors.crimson : colors.border}`,
            }}
          >
            <Icon
              name={compressing ? 'hourglass_top' : 'add_a_photo'}
              filled={false}
              size={34}
              color={colors.textSecondary}
            />
            <span className="mt-2 text-xs" style={{ color: colors.textMuted }}>
              {compressing ? 'Preparando foto…' : 'Opcional · ayuda a encontrar el problema más rápido'}
            </span>
            {/* Mientras se comprime, escondemos los botones para no elegir dos fotos a la vez */}
            <div className={`mt-3 grid w-full grid-cols-2 gap-3 ${compressing ? 'invisible' : ''}`}>
              <FilledButton
                icon="photo_camera"
                background={colors.blue}
                className="w-full px-3"
                onClick={() => cameraInput.current?.click()}
              >
                Tomar foto
              </FilledButton>
              <FilledButton
                icon="photo_library"
                background={colors.blueTint}
                foreground={colors.blue}
                className="w-full px-3"
                onClick={() => galleryInput.current?.click()}
              >
                Galería
              </FilledButton>
            </div>
          </div>
        )}

        {errors.photo && (
          <p className="m-0 mt-1 text-xs font-bold" style={{ color: colors.crimson }}>
            {errors.photo}
          </p>
        )}
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
