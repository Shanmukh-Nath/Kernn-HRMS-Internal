const fs = require('fs');
const path = require('path');

/**
 * Creates uncompressed 24-bit BMP/PNG for DMG Background
 */
function create24BitBMP(width, height, pixelShader) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = Buffer.alloc(fileSize);

  // BMP Header (14 bytes)
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(54, 10);

  // DIB Header (40 bytes)
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelArraySize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + y * rowSize;
    const normY = (height - 1 - y) / height;

    for (let x = 0; x < width; x++) {
      const normX = x / width;
      const { r, g, b } = pixelShader(normX, normY, x, y, width, height);

      const pOffset = rowOffset + x * 3;
      buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(b))), pOffset);
      buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(g))), pOffset + 1);
      buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(r))), pOffset + 2);
    }
  }

  return buffer;
}

// 600 x 420 DMG Background
const dmgBuffer = create24BitBMP(600, 420, (normX, normY, x, y) => {
  // Base dark navy #0b1322
  let r = 11 + (1 - normY) * 16 + normX * 6;
  let g = 19 + (1 - normY) * 12 + normX * 5;
  let b = 34 + (1 - normY) * 22 + normX * 8;

  // Center subtle arrow glow between x:250 to x:350, y:180 to y:240
  const arrowDist = Math.sqrt(((x - 300) / 70) ** 2 + ((y - 210) / 25) ** 2);
  if (arrowDist < 1.0) {
    const glow = (1 - arrowDist) ** 2;
    r += glow * 190;
    g += glow * 30;
    b += glow * 55;
  }

  // Top header accent banner
  if (y < 4) {
    r = 225;
    g = 29;
    b = 72; // Crimson #e11d48
  }

  // Bottom footer accent line
  if (y > 416) {
    r = 225;
    g = 29;
    b = 72;
  }

  return { r, g, b };
});

const buildDir = path.join(__dirname, '..', 'desktop-bridge', 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Write background.png / background.bmp
fs.writeFileSync(path.join(buildDir, 'background.bmp'), dmgBuffer);
fs.writeFileSync(path.join(buildDir, 'background.png'), dmgBuffer);

console.log('[Mac] Generated macOS DMG background graphics (600x420)');
