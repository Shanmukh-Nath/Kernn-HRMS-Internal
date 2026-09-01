const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'desktop-bridge', 'app-icon.png');
const icoPath = path.join(__dirname, '..', 'desktop-bridge', 'icon.ico');

const pngBuffer = fs.readFileSync(pngPath);
const pngSize = pngBuffer.length;

// Create 22-byte ICO header wrapping the 256x256 / hi-res PNG
const icoHeader = Buffer.alloc(22);

// ICONDIR structure (6 bytes)
icoHeader.writeUInt16LE(0, 0); // Reserved. Must always be 0.
icoHeader.writeUInt16LE(1, 2); // Specifies image type: 1 for icon (.ICO) image
icoHeader.writeUInt16LE(1, 4); // Specifies number of images in the file: 1

// ICONDIRENTRY structure (16 bytes)
icoHeader.writeUInt8(0, 6);   // Width: 0 means 256 pixels
icoHeader.writeUInt8(0, 7);   // Height: 0 means 256 pixels
icoHeader.writeUInt8(0, 8);   // Number of colors in the color palette: 0 = no palette
icoHeader.writeUInt8(0, 9);   // Reserved: 0
icoHeader.writeUInt16LE(1, 10);  // Color planes: 1
icoHeader.writeUInt16LE(32, 12); // Bits per pixel: 32 (RGBA)
icoHeader.writeUInt32LE(pngSize, 14); // Size of the image's data in bytes
icoHeader.writeUInt32LE(22, 18);      // Offset of BMP or PNG data from the beginning of the ICO/CUR file

const finalIcoBuffer = Buffer.concat([icoHeader, pngBuffer]);
fs.writeFileSync(icoPath, finalIcoBuffer);

console.log('Successfully generated Windows icon.ico (' + finalIcoBuffer.length + ' bytes)');
