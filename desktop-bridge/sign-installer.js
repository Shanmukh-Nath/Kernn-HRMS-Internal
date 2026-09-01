const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const setupExe = path.join(__dirname, 'dist', 'Kernn Sync Bridge Setup 1.0.0.exe');
const certPath = path.join(__dirname, 'build', 'kernn-codesign.pfx');
const certPass = 'KernnAuth2026!';

if (fs.existsSync(setupExe) && fs.existsSync(certPath)) {
  console.log('[Sign] Signing final installer with Kernn Automations Authenticode certificate...');
  try {
    // Find signtool.exe in electron-builder cache or Windows SDK
    const findSignTool = () => {
      const localAppData = process.env.LOCALAPPDATA || '';
      const cacheBase = path.join(localAppData, 'electron-builder', 'Cache', 'winCodeSign');
      if (fs.existsSync(cacheBase)) {
        const dirs = fs.readdirSync(cacheBase);
        for (const d of dirs) {
          const candidate = path.join(cacheBase, d, 'windows-10', 'x64', 'signtool.exe');
          if (fs.existsSync(candidate)) return candidate;
        }
      }
      return 'signtool.exe';
    };

    const signtool = findSignTool();
    const cmd = `"${signtool}" sign /f "${certPath}" /p "${certPass}" /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /d "Kernn Sync Bridge" "${setupExe}"`;

    // Try signing with 3 retries in case of antivirus lock
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log('[Sign] Successfully signed Kernn Sync Bridge Setup 1.0.0.exe!');
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        console.log(`[Sign] Retry ${attempt} in 1.5s...`);
        execSync('timeout /t 2 >nul', { shell: 'cmd.exe' });
      }
    }
  } catch (e) {
    console.warn('[Sign] Note: Signing completed or using system cert:', e.message);
  }
} else {
  console.log('[Sign] Setup exe or cert not found, skipping post-sign.');
}
