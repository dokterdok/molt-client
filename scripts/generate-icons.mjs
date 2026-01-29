/**
 * Generate all app icons from the lobster SVG
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const iconsDir = join(rootDir, 'src-tauri', 'icons');
const svgPath = join(rootDir, 'lobster-twemoji.svg');

// Read SVG
const svgBuffer = readFileSync(svgPath);

// Icon sizes needed
const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '64x64.png', size: 64 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  // Windows Store logos
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

console.log('Generating icons from lobster SVG...');

for (const { name, size } of sizes) {
  const outputPath = join(iconsDir, name);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`✓ ${name} (${size}x${size})`);
}

// Generate ICO (multi-resolution)
// Sharp doesn't directly support ICO, so we'll generate the PNGs
// and use a separate tool or the existing ICO if already correct

console.log('\n✓ All PNG icons generated!');
console.log('\nNote: icon.ico needs to be regenerated manually or with ico-tools');
console.log('The PNG icons are used by Tauri for most platforms.');
