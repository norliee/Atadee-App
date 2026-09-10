// A small set of hand-drawn-feel line icons: mannequin, measuring tape,
// needle & thread, spool, scissors. Single-color (currentColor) so they
// pick up whatever color context they're placed in.
const ICONS = {
  pempamsie: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pempamsieDark" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5C450F"/>
        <stop offset="35%" stop-color="#B08A2E"/>
        <stop offset="50%" stop-color="#F5DC8A"/>
        <stop offset="65%" stop-color="#B08A2E"/>
        <stop offset="100%" stop-color="#5C450F"/>
      </linearGradient>
      <linearGradient id="pempamsieLight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#D4A94A"/>
        <stop offset="45%" stop-color="#FFF3D0"/>
        <stop offset="55%" stop-color="#FFF3D0"/>
        <stop offset="100%" stop-color="#D4A94A"/>
      </linearGradient>
    </defs>
    <g transform="translate(24 24) scale(0.72) translate(-24 -24)">
      <path d="M23 8
               C 13 2, 3 6, 3 15
               C 3 22.5, 12.5 23.5, 15 18
               C 16.5 14.5, 13 11.5, 11 14
               C 13 14.5, 14 17, 12 19
               C 9 22, 4 20, 4 24
               C 4 28, 9 26, 12 29
               C 14 31, 13 33.5, 11 34
               C 13 36.5, 16.5 33.5, 15 30
               C 12.5 24.5, 3 25.5, 3 33
               C 3 42, 13 46, 23 40" fill="url(#pempamsieDark)"/>
      <path d="M25 8
               C 35 2, 45 6, 45 15
               C 45 22.5, 35.5 23.5, 33 18
               C 31.5 14.5, 35 11.5, 37 14
               C 35 14.5, 34 17, 36 19
               C 39 22, 44 20, 44 24
               C 44 28, 39 26, 36 29
               C 34 31, 35 33.5, 37 34
               C 35 36.5, 31.5 33.5, 33 30
               C 35.5 24.5, 45 25.5, 45 33
               C 45 42, 35 46, 25 40" fill="url(#pempamsieDark)"/>
      <path d="M24 7
               C 20 10, 20 13.5, 24 16
               C 28 13.5, 28 10, 24 7 Z
               M19.5 24 L 24 16 L 28.5 24 L 24 32 Z
               M24 32
               C 20 34.5, 20 38, 24 41
               C 28 38, 28 34.5, 24 32 Z" fill="url(#pempamsieLight)"/>
    </g>
  </svg>`,
  camera: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 16a3 3 0 013-3h4l2.5-4h9L27 13h4a3 3 0 013 3v18a3 3 0 01-3 3H9a3 3 0 01-3-3V16z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="24" r="6" stroke="currentColor" stroke-width="2"/>
  </svg>`,
  gear: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="6" stroke="currentColor" stroke-width="2.2"/>
    <path d="M24 6v5M24 37v5M42 24h-5M11 24H6M36.5 11.5l-3.5 3.5M15 29.5l-3.5 3.5M36.5 36.5l-3.5-3.5M15 18.5l-3.5-3.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
  leaf: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 38C6 24 14 10 34 8c2 20-8 30-24 30z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M11 37C18 28 24 20 32 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  mannequin: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="10" r="5" stroke="currentColor" stroke-width="2"/>
    <path d="M24 15v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 27c0-6.6 5.4-12 12-12s12 5.4 12 12v3c0 1.1-.9 2-2 2H14c-1.1 0-2-.9-2-2v-3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 32v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M17 42h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  tape: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2"/>
    <circle cx="24" cy="24" r="6" stroke="currentColor" stroke-width="2"/>
    <path d="M24 8v4M24 36v4M8 24h4M36 24h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M14 14l2.8 2.8M31.2 31.2L34 34M34 14l-2.8 2.8M16.8 31.2L14 34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  needle: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34 8l6 6-19 19-8 3 3-8L34 8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="35.5" cy="9.5" r="1.6" stroke="currentColor" stroke-width="1.6"/>
    <path d="M13 31c-3 3-5 6-6 9 3-1 6-3 9-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7 40c2-6 4-9 4-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="0.5 3.5"/>
  </svg>`,
  spool: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="8" width="20" height="6" rx="2" stroke="currentColor" stroke-width="2"/>
    <rect x="14" y="34" width="20" height="6" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M16 14c0 4 16 4 16 8s-16 4-16 8 16 4 16 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  scissors: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="36" r="4" stroke="currentColor" stroke-width="2"/>
    <path d="M15 14L40 38M15 34L40 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 20s-7-4.4-9.6-8.7C.7 8 2 4.3 5.6 3.6c2.1-.4 4 .6 6.4 3 2.4-2.4 4.3-3.4 6.4-3 3.6.7 4.9 4.4 3.2 7.7C19 15.6 12 20 12 20z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>`
};

function icon(name, size = 22) {
  return `<span class="icon" style="width:${size}px;height:${size}px;display:inline-flex;">${ICONS[name] || ''}</span>`;
}
