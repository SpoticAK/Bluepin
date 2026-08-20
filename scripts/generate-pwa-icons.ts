import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, "../public");
const pwaSourceIcon = path.join(publicDir, "Bluepin PWA logo 512 x 512.png");

async function generatePwaIcons() {
  if (!fs.existsSync(pwaSourceIcon)) {
    console.error("PWA source icon not found:", pwaSourceIcon);
    process.exit(1);
  }

  console.log("Generating PWA icons from:", pwaSourceIcon);

  // 1. 192x192 Standard PWA Icon
  await sharp(pwaSourceIcon)
    .resize(192, 192, {
      fit: "contain",
      background: { r: 15, g: 23, b: 42, alpha: 0 },
    })
    .toFile(path.join(publicDir, "pwa-192x192.png"));
  console.log("✓ Created pwa-192x192.png");

  // 2. 512x512 Standard PWA Icon
  await sharp(pwaSourceIcon)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 15, g: 23, b: 42, alpha: 0 },
    })
    .toFile(path.join(publicDir, "pwa-512x512.png"));
  console.log("✓ Created pwa-512x512.png");

  // 3. 180x180 Apple Touch Icon (iOS Home Screen)
  await sharp(pwaSourceIcon)
    .resize(180, 180, {
      fit: "contain",
      background: { r: 15, g: 23, b: 42, alpha: 0 },
    })
    .toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("✓ Created apple-touch-icon.png");

  // 4. 512x512 Maskable Icon with 20% safe-zone padding and dark slate background (#0f172a)
  const innerSize = Math.round(512 * 0.8);
  const padding = Math.round((512 - innerSize) / 2);
  const resizedInner = await sharp(pwaSourceIcon)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resizedInner, top: padding, left: padding }])
    .toFile(path.join(publicDir, "maskable-icon-512x512.png"));
  console.log("✓ Created maskable-icon-512x512.png");

  console.log(
    "All PWA icons generated successfully from Bluepin PWA logo 512 x 512.png!",
  );
}

generatePwaIcons().catch((err) => {
  console.error("Error generating PWA icons:", err);
  process.exit(1);
});
