/**
 * Standalone LCD Screen Title / Company Name Configurator
 *
 * Usage:
 *   node scripts/change-lcd.js "KERNN TECHNOLOGIES"
 *   node scripts/change-lcd.js "KERNN AUTOMATIONS" 192.168.29.83 5005
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const newName = process.argv[2] || 'KERNN TECHNOLOGIES';
const deviceIp = process.argv[3] || '192.168.29.83';
const devicePort = parseInt(process.argv[4] || '5005', 10);
const machineId = parseInt(process.argv[5] || '1', 10);

console.log('====================================================');
console.log('   KERNN BIOMETRIC LCD CUSTOMIZER (S-FB3K TEST)     ');
console.log('====================================================');
console.log(`Target Hardware IP: ${deviceIp}:${devicePort}`);
console.log(`Target Machine ID : ${machineId}`);
console.log(`New LCD Branding  : "${newName}"\n`);

const psScriptPath = path.resolve(__dirname, 'test-lcd.ps1');
const ps32Path = 'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe';

const args = [
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', psScriptPath,
  '-DeviceIp', deviceIp,
  '-DevicePort', devicePort,
  '-MachineId', machineId,
  '-NewCompanyName', newName,
];

console.log(`[EXEC] Invoking 32-bit P/Invoke bridge for SBXPCDLL.dll...`);
const proc = spawn(ps32Path, args, { stdio: 'inherit' });

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n[SUCCESS] Hardware LCD screen branding updated successfully!');
    console.log('Please look at the physical LCD display of your Secureye terminal.');
  } else {
    console.error(`\n[FAILED] Script exited with code ${code}`);
  }
});
