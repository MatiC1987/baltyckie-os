import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../client/public');

const SIZES = [72, 96, 128, 144, 192, 384, 512];

function buildSvg({ gradientTop, gradientBottom, symbol }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${gradientTop}"/>
      <stop offset="100%" stop-color="${gradientBottom}"/>
    </linearGradient>
    <clipPath id="rounded">
      <rect width="512" height="512" rx="112" ry="112"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="112" ry="112" fill="url(#bg)"/>

  <!-- Wave at bottom -->
  <g clip-path="url(#rounded)">
    <path d="M-20 400 Q128 360 256 400 Q384 440 532 400 L532 512 L-20 512 Z"
          fill="white" fill-opacity="0.12"/>
    <path d="M-20 440 Q128 400 256 440 Q384 480 532 440 L532 512 L-20 512 Z"
          fill="white" fill-opacity="0.08"/>
  </g>

  <!-- Symbol -->
  ${symbol}
</svg>`;
}

const BAR_CHART_SYMBOL = `
  <!-- Bar chart symbol for Finanse -->
  <g transform="translate(256,256)" fill="white">
    <!-- bars -->
    <rect x="-115" y="-60" width="55" height="130" rx="8" ry="8" opacity="0.95"/>
    <rect x="-30" y="-110" width="55" height="180" rx="8" ry="8" opacity="0.95"/>
    <rect x="55" y="-20" width="55" height="90" rx="8" ry="8" opacity="0.95"/>
    <!-- baseline -->
    <rect x="-125" y="80" width="250" height="12" rx="6" ry="6" opacity="0.7"/>
  </g>
`;

const KEY_SYMBOL = `
  <!-- Key symbol for Recepcja -->
  <g transform="translate(256,256) rotate(-35)" fill="white" opacity="0.95">
    <!-- key bow (ring) -->
    <circle cx="-60" cy="0" r="80" fill="none" stroke="white" stroke-width="40" opacity="0.95"/>
    <!-- key stem -->
    <rect x="10" y="-20" width="140" height="40" rx="20" ry="20"/>
    <!-- key teeth -->
    <rect x="90" y="20" width="28" height="45" rx="8" ry="8"/>
    <rect x="130" y="20" width="28" height="30" rx="8" ry="8"/>
  </g>
`;

const CLOCK_SYMBOL = `
  <!-- Clock face symbol for RCP -->
  <g transform="translate(256,256)" fill="white">
    <!-- outer ring -->
    <circle cx="0" cy="0" r="130" fill="none" stroke="white" stroke-width="30" opacity="0.95"/>
    <!-- center dot -->
    <circle cx="0" cy="0" r="14" fill="white" opacity="0.95"/>
    <!-- hour hand (pointing to ~10) -->
    <rect x="-10" y="-105" width="20" height="95" rx="10" ry="10"
          transform="rotate(-60,0,0)" opacity="0.95"/>
    <!-- minute hand (pointing to ~2) -->
    <rect x="-8" y="-80" width="16" height="78" rx="8" ry="8"
          transform="rotate(60,0,0)" opacity="0.95"/>
  </g>
`;

const APPS = [
  {
    name: 'finanse',
    gradientTop: '#1a1a2e',
    gradientBottom: '#1e40af',
    symbol: BAR_CHART_SYMBOL,
  },
  {
    name: 'recepcja',
    gradientTop: '#1a1a2e',
    gradientBottom: '#0d9488',
    symbol: KEY_SYMBOL,
  },
  {
    name: 'rcp',
    gradientTop: '#1a1a2e',
    gradientBottom: '#4f46e5',
    symbol: CLOCK_SYMBOL,
  },
];

async function generateIcons() {
  for (const app of APPS) {
    const svgString = buildSvg(app);
    const svgBuffer = Buffer.from(svgString);

    for (const size of SIZES) {
      const outputPath = path.join(outputDir, `icon-${app.name}-${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Generated: ${outputPath}`);
    }

    // Also generate apple-touch-icon size (180)
    const touchIconPath = path.join(outputDir, `apple-touch-icon-${app.name}.png`);
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(touchIconPath);
    console.log(`Generated: ${touchIconPath}`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
