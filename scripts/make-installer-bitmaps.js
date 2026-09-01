const fs = require('fs');
const path = require('path');

function create24BitBMP(width, height, pixelShader) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = Buffer.alloc(fileSize);

  // BMP Header (14 bytes)
  buffer.write('BM', 0); // Signature
  buffer.writeUInt32LE(fileSize, 2); // File size
  buffer.writeUInt32LE(0, 6); // Reserved
  buffer.writeUInt32LE(54, 10); // Offset to pixel data

  // DIB Header (40 bytes)
  buffer.writeUInt32LE(40, 14); // Header size
  buffer.writeInt32LE(width, 18); // Width
  buffer.writeInt32LE(height, 22); // Height (positive for bottom-up)
  buffer.writeUInt16LE(1, 26); // Planes
  buffer.writeUInt16LE(24, 28); // 24-bit RGB
  buffer.writeUInt32LE(0, 30); // No compression (BI_RGB)
  buffer.writeUInt32LE(pixelArraySize, 34); // Image size
  buffer.writeInt32LE(2835, 38); // 72 DPI X
  buffer.writeInt32LE(2835, 42); // 72 DPI Y
  buffer.writeUInt32LE(0, 46); // Color palette colors
  buffer.writeUInt32LE(0, 50); // Important colors

  // Write pixel rows from bottom to top
  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + y * rowSize;
    // Normalized Y coordinate (0 = top, 1 = bottom)
    const normY = (height - 1 - y) / height;

    for (let x = 0; x < width; x++) {
      const normX = x / width;
      const { r, g, b } = pixelShader(normX, normY, x, y, width, height);

      const pOffset = rowOffset + x * 3;
      buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(b))), pOffset);     // Blue
      buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(g))), pOffset + 1); // Green
      buffer.writeUInt8(Math.max(0, Math.min(255, Math.floor(r))), pOffset + 2); // Red
    }
  }

  return buffer;
}

// 1. Installer Sidebar (164 x 314): Sleek Dark Navy & Crimson Gradient with subtle glow
const sidebarBuffer = create24BitBMP(164, 314, (normX, normY) => {
  // Base dark navy #0b1322
  let r = 11 + normY * 18 + normX * 8;
  let g = 19 + normY * 12 + normX * 6;
  let b = 34 + normY * 20 + normX * 10;

  // Crimson accent glow in top-left and bottom-right
  const distToTop = Math.sqrt((normX - 0.2) ** 2 + (normY - 0.15) ** 2);
  if (distToTop < 0.6) {
    const glow = (1 - distToTop / 0.6) ** 2;
    r += glow * 180;
    g += glow * 25;
    b += glow * 45;
  }

  // Accent vertical stripe along right border (160 to 164)
  if (normX > 0.96) {
    r = 225;
    g = 29;
    b = 72; // Crimson #e11d48
  }

  return { r, g, b };
});

// 2. Installer Header (150 x 57): Sleek dark navy bar with crimson accent
const headerBuffer = create24BitBMP(150, 57, (normX, normY) => {
  let r = 11 + normY * 8;
  let g = 19 + normY * 6;
  let b = 34 + normY * 10;

  // Bottom accent line
  if (normY > 0.94) {
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

fs.writeFileSync(path.join(buildDir, 'installerSidebar.bmp'), sidebarBuffer);
fs.writeFileSync(path.join(buildDir, 'uninstallerSidebar.bmp'), sidebarBuffer);
fs.writeFileSync(path.join(buildDir, 'installerHeader.bmp'), headerBuffer);

console.log('[BMP] Generated modern NSIS installerSidebar.bmp and installerHeader.bmp successfully!');
