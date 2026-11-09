const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function run() {
  const logoPath = path.resolve('public/logo-transparent.png');
  const publicDir = path.resolve('public');

  console.log('Generating PWA icons from', logoPath);

  // 1. Generate 512x512 standard icon (purpose: "any")
  // Elegant circular/square brand badge with #0A6C74 gradient background and crisp white icon/inner
  const logo512Buffer = await sharp(logoPath)
    .resize(420, 420, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 10, g: 108, b: 116, alpha: 1 } // #0A6C74
    }
  })
  .composite([
    { input: logo512Buffer, gravity: 'center' }
  ])
  .png()
  .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // 2. Generate 192x192 standard icon (purpose: "any")
  const logo192Buffer = await sharp(logoPath)
    .resize(156, 156, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 10, g: 108, b: 116, alpha: 1 }
    }
  })
  .composite([
    { input: logo192Buffer, gravity: 'center' }
  ])
  .png()
  .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // 3. Generate 512x512 maskable icon (purpose: "maskable")
  // Safe zone rule: essential logo kept within central 80% circle (safe zone with 15% margin on all sides)
  // Inner size: 512 * 0.70 = ~358px
  const logoMaskableBuffer = await sharp(logoPath)
    .resize(350, 350, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 10, g: 108, b: 116, alpha: 1 }
    }
  })
  .composite([
    { input: logoMaskableBuffer, gravity: 'center' }
  ])
  .png()
  .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // 4. Generate 180x180 Apple Touch Icon (iOS Safari compliant PNG)
  const logoAppleBuffer = await sharp(logoPath)
    .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 10, g: 108, b: 116, alpha: 1 }
    }
  })
  .composite([
    { input: logoAppleBuffer, gravity: 'center' }
  ])
  .png()
  .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 5. Generate public/icon.svg vector icon
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A6C74"/>
      <stop offset="100%" stop-color="#053C41"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E2C992"/>
      <stop offset="100%" stop-color="#C29D55"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="190" fill="none" stroke="url(#gold)" stroke-width="8" stroke-dasharray="8 6"/>
  <circle cx="256" cy="256" r="160" fill="none" stroke="#FAF8F5" stroke-width="3" opacity="0.3"/>
  <!-- Compass Star -->
  <polygon points="256,120 278,236 392,256 278,276 256,392 234,276 120,256 234,236" fill="url(#gold)"/>
  <polygon points="256,120 256,256 234,236" fill="#D3AE64"/>
  <polygon points="256,392 256,256 278,276" fill="#B38D40"/>
  <polygon points="392,256 256,256 278,236" fill="#D3AE64"/>
  <polygon points="120,256 256,256 234,276" fill="#B38D40"/>
  <!-- Central Ring -->
  <circle cx="256" cy="256" r="28" fill="#0A6C74" stroke="#FAF8F5" stroke-width="4"/>
  <circle cx="256" cy="256" r="10" fill="url(#gold)"/>
  <!-- Waves at base -->
  <path d="M150 400 Q 200 380, 256 400 T 362 400" fill="none" stroke="#FAF8F5" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
  <path d="M170 422 Q 215 408, 256 422 T 342 422" fill="none" stroke="url(#gold)" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf8');

  console.log('Successfully generated all PWA icons:');
  console.log('- pwa-512x512.png');
  console.log('- pwa-192x192.png');
  console.log('- pwa-maskable-512x512.png');
  console.log('- apple-touch-icon.png');
  console.log('- icon.svg');
}

run().catch(console.error);
