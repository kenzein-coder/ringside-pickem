import React, { useState } from 'react';

const brandColors = {
  wwe: { bg: 'bg-gradient-to-br from-red-600 to-red-800', text: 'text-white' },
  aew: { bg: 'bg-gradient-to-br from-yellow-500 to-amber-600', text: 'text-black' },
  njpw: { bg: 'bg-gradient-to-br from-red-700 to-red-900', text: 'text-white' },
  tna: { bg: 'bg-gradient-to-br from-green-500 to-green-700', text: 'text-white' },
  roh: { bg: 'bg-gradient-to-br from-red-600 to-black', text: 'text-white' },
  stardom: { bg: 'bg-gradient-to-br from-pink-500 to-pink-700', text: 'text-white' },
  cmll: { bg: 'bg-gradient-to-br from-blue-600 to-blue-800', text: 'text-yellow-400' },
  aaa: { bg: 'bg-gradient-to-br from-red-600 to-orange-600', text: 'text-white' },
  gcw: { bg: 'bg-gradient-to-br from-stone-700 to-stone-900', text: 'text-white' },
  mlw: { bg: 'bg-gradient-to-br from-slate-700 to-slate-900', text: 'text-yellow-400' },
};

/**
 * Promotion logo: shows image from /images/promotions/{id}.png or fallback colored badge.
 */
function BrandLogo({ id, className = 'w-full h-full object-contain', logoUrl }) {
  const [imgError, setImgError] = useState(false);
  const safeId = id ?? '';
  const normalizedId = safeId.toLowerCase();
  const colors = brandColors[normalizedId] || { bg: 'bg-gradient-to-br from-slate-700 to-slate-900', text: 'text-white' };

  const localSrc = normalizedId ? `/images/promotions/${normalizedId}.png` : null;
  const src = logoUrl && !logoUrl.includes('cagematch.net') ? logoUrl : localSrc;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={`${id} logo`}
        className={`object-contain ${className}`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${colors.bg} ${colors.text} font-black text-xs uppercase rounded tracking-tight shadow-inner ${className}`}
    >
      {(safeId || '?').toUpperCase()}
    </div>
  );
}

export default BrandLogo;
