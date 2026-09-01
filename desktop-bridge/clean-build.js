const { execSync } = require('child_process');

if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM "Kernn Sync Bridge.exe" /T 2>nul', { stdio: 'ignore' });
  } catch (_) {}
  try {
    execSync('taskkill /F /IM electron.exe /T 2>nul', { stdio: 'ignore' });
  } catch (_) {}
}
console.log('[Clean] Process locks released for building.');
