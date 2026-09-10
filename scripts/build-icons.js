const fs = require('fs');
const path = require('path');
const iu = require('@expo/image-utils');
const { PNG } = require('pngjs');

const srcJpg = 'C:\\Users\\rtkwi\\.gemini\\antigravity-ide\\brain\\fce41bb6-18a0-4774-aa0c-02741ab54f66\\.user_uploaded\\media_1788957825751.jpg';
const assetsDir = path.join(__dirname, '..', 'assets');

// High quality bilinear scaling
function scalePng(src, targetWidth, targetHeight) {
  const dst = new PNG({ width: targetWidth, height: targetHeight });
  const xRatio = src.width / targetWidth;
  const yRatio = src.height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const px = x * xRatio;
      const py = y * yRatio;
      const x1 = Math.floor(px);
      const y1 = Math.floor(py);
      const x2 = Math.min(x1 + 1, src.width - 1);
      const y2 = Math.min(y1 + 1, src.height - 1);

      const xWeight = px - x1;
      const yWeight = py - y1;

      const idxDst = (y * targetWidth + x) * 4;
      const idx11 = (y1 * src.width + x1) * 4;
      const idx12 = (y1 * src.width + x2) * 4;
      const idx21 = (y2 * src.width + x1) * 4;
      const idx22 = (y2 * src.width + x2) * 4;

      for (let c = 0; c < 4; c++) {
        const top = src.data[idx11 + c] * (1 - xWeight) + src.data[idx12 + c] * xWeight;
        const bottom = src.data[idx21 + c] * (1 - xWeight) + src.data[idx22 + c] * xWeight;
        dst.data[idxDst + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }
  return dst;
}

(async () => {
  console.log('Loading input image...');
  const pngBuf = await iu.jimpAsync({ input: srcJpg, format: 'image/png' });
  const srcPng = PNG.sync.read(pngBuf);

  // 1. Create transparent-corner 1024x1024 icon
  const isOuterBg = (r, g, b) => r > 230 && g > 230 && b > 230;
  const iconFull = new PNG({ width: 1024, height: 1024 });

  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const idx = (y * 1024 + x) * 4;
      const r = srcPng.data[idx];
      const g = srcPng.data[idx+1];
      const b = srcPng.data[idx+2];
      const distFromCenter = Math.hypot(x - 512, y - 512);

      // Outside the rounded squircle is transparent
      if (distFromCenter > 425 && isOuterBg(r, g, b)) {
        iconFull.data[idx] = 0;
        iconFull.data[idx+1] = 0;
        iconFull.data[idx+2] = 0;
        iconFull.data[idx+3] = 0;
      } else {
        iconFull.data[idx] = r;
        iconFull.data[idx+1] = g;
        iconFull.data[idx+2] = b;
        iconFull.data[idx+3] = 255;
      }
    }
  }

  // 2. Android Adaptive Icon:
  // Standard Android safe-zone diameter is 660px in 1024x1024.
  // Scale the icon to 680x680 and place it in the center of a 1024x1024 canvas.
  const scaledSize = 680;
  const scaledForAdaptive = scalePng(iconFull, scaledSize, scaledSize);
  const adaptiveIcon = new PNG({ width: 1024, height: 1024 });
  // Initialize transparent
  adaptiveIcon.data.fill(0);

  const offset = Math.round((1024 - scaledSize) / 2); // 172
  for (let y = 0; y < scaledSize; y++) {
    for (let x = 0; x < scaledSize; x++) {
      const srcIdx = (y * scaledSize + x) * 4;
      const dstIdx = ((y + offset) * 1024 + (x + offset)) * 4;
      adaptiveIcon.data[dstIdx] = scaledForAdaptive.data[srcIdx];
      adaptiveIcon.data[dstIdx + 1] = scaledForAdaptive.data[srcIdx + 1];
      adaptiveIcon.data[dstIdx + 2] = scaledForAdaptive.data[srcIdx + 2];
      adaptiveIcon.data[dstIdx + 3] = scaledForAdaptive.data[srcIdx + 3];
    }
  }

  // 3. Splash Icon (Centered icon ~420px for clean splash display)
  const splashSize = 480;
  const scaledForSplash = scalePng(iconFull, splashSize, splashSize);
  const splashIcon = new PNG({ width: 1024, height: 1024 });
  splashIcon.data.fill(0);
  const splashOffset = Math.round((1024 - splashSize) / 2);
  for (let y = 0; y < splashSize; y++) {
    for (let x = 0; x < splashSize; x++) {
      const srcIdx = (y * splashSize + x) * 4;
      const dstIdx = ((y + splashOffset) * 1024 + (x + splashOffset)) * 4;
      splashIcon.data[dstIdx] = scaledForSplash.data[srcIdx];
      splashIcon.data[dstIdx + 1] = scaledForSplash.data[srcIdx + 1];
      splashIcon.data[dstIdx + 2] = scaledForSplash.data[srcIdx + 2];
      splashIcon.data[dstIdx + 3] = scaledForSplash.data[srcIdx + 3];
    }
  }

  // 4. Favicon (48x48)
  const favicon = scalePng(iconFull, 48, 48);

  // Write all files
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), PNG.sync.write(iconFull));
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), PNG.sync.write(adaptiveIcon));
  fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), PNG.sync.write(splashIcon));
  fs.writeFileSync(path.join(assetsDir, 'chaticon.png'), PNG.sync.write(iconFull));
  fs.writeFileSync(path.join(assetsDir, 'favicon.png'), PNG.sync.write(favicon));

  console.log('Successfully generated all app icons in assets directory:');
  console.log(' - assets/icon.png (1024x1024 full res)');
  console.log(' - assets/adaptive-icon.png (1024x1024 centered for Android safe zone)');
  console.log(' - assets/splash-icon.png (1024x1024 splash screen)');
  console.log(' - assets/chaticon.png (1024x1024 legacy fallback)');
  console.log(' - assets/favicon.png (48x48 web favicon)');
})();
