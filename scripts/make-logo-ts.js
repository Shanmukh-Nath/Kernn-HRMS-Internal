const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, '..', 'kernn_landcape.png');
const b64 = fs.readFileSync(imgPath).toString('base64');
const targetPath = path.join(__dirname, '..', 'lib', 'logo-base64.ts');

fs.writeFileSync(
  targetPath,
  `export const KERNN_LANDSCAPE_LOGO_BASE64 = 'data:image/png;base64,${b64}';\n`
);

console.log('LOGO_BASE64_SAVED_SUCCESSFULLY');
