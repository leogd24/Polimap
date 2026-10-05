import { colors } from '../styles/theme.js';

/// Franja con los 5 colores oficiales del Politécnico, en el orden de la
/// paleta: Verde Matute, Rosa Magenta, Azul Ciano, Naranja y Rojo Central.
/// Úsala debajo de un encabezado o arriba de una tarjeta para identidad.
/// Props: height (px, por defecto 4).
export default function BrandStripe({ height = 4 }) {
  const stripe = [colors.green, colors.magenta, colors.cyan, colors.gold, colors.crimson];
  return (
    <div className="flex w-full" style={{ height }} aria-hidden="true">
      {stripe.map((color) => (
        <div key={color} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}
