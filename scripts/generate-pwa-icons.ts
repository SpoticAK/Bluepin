import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const sourceIcon = path.join(publicDir, 'Bluepin.png');

async function generateIcons() {
  if (!fs.existsSync(sourceIcon)) {
    console.error('Source icon not found:', sourceIcon);
    process.exit(1);
  }

  console.log('Generating PWA icons from:', sourceIcon);

  // 192x192 icon
  await sharp(sourceIcon)
    .resize(192, 192, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 512x512 icon
  await sharp(sourceIcon)
    .resize(512, 512, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // 180x180 Apple Touch Icon
  await sharp(sourceIcon)
    .resize(180, 180, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 512x512 Maskable Icon with padding
  const innerSize = Math.round(512 * 0.8);
  const padding = Math.round((512 - innerSize) / 2);
  const resizedInner = await sharp(sourceIcon)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // #0f172a
    }
  })
    .composite([{ input: resizedInner, top: padding, left: padding }])
    .toFile(path.join(publicDir, 'maskable-icon-512x512.png'));
  console.log('Created maskable-icon-512x512.png');

  // Favicons
  await sharp(sourceIcon)
    .resize(32, 32)
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Created favicon-32x32.png');

  await sharp(sourceIcon)
    .resize(16, 16)
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('Created favicon-16x16.png');

  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
