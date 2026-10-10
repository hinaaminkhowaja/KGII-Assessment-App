
import sharp from 'sharp';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512"
     xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#083d35"/>
  <circle cx="256" cy="142" r="44" fill="#b8e6d2"/>
  <path d="M170 125 Q132 95 108 130 L108 238 Q145 210 184 244 Z"
        fill="#ffffff"/>
  <path d="M342 125 Q380 95 404 130 L404 238 Q367 210 328 244 Z"
        fill="#ffffff"/>
  <path d="M184 244 Q256 218 256 258 Q256 218 328 244
           L328 355 Q256 325 256 365 Q256 325 184 355 Z"
        fill="#b8e6d2"/>
  <path d="M220 292 L246 318 L300 263"
        fill="none" stroke="#083d35" stroke-width="18"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M150 390 H362" stroke="#ffffff"
        stroke-width="18" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(svg))
  .resize(192, 192)
  .png()
  .toFile('public/pwa-192x192.png');

await sharp(Buffer.from(svg))
  .resize(512, 512)
  .png()
  .toFile('public/pwa-512x512.png');

console.log('Both PWA icons created successfully.');
