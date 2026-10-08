// src/components/UserAvatar.jsx — Responsable: Alexis
// Foto de perfil de Google en círculo. Si no hay foto (o no carga),
// muestra las iniciales del nombre.
//
// Props: user ({ nombre, correo, foto }), size (px), ring (color del borde)
import { useState } from 'react';
import { colors } from '../styles/theme.js';

function initials(user) {
  const base = (user?.nombre || user?.correo || '?').trim();
  const words = base.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

export default function UserAvatar({ user, size = 36, ring = colors.white }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = user?.foto && !broken;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: colors.cyanDark,
        color: colors.white,
        border: `2px solid ${ring}`,
      }}
    >
      {showPhoto ? (
        <img
          src={user.foto}
          alt=""
          width={size}
          height={size}
          // Las fotos de Google a veces no cargan si mandamos de qué página venimos.
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(user)
      )}
    </span>
  );
}
