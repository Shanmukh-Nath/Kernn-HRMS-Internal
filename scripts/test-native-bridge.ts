import { syncDeviceViaNativeDriver } from '../server/secureye/native-bridge';

async function test() {
  console.log('Testing syncDeviceViaNativeDriver...');
  try {
    const data = await syncDeviceViaNativeDriver('192.168.29.83', 5005, 1);
    console.log('Data received successfully:');
    console.log('Serial Number:', data.serialNumber);
    console.log('Users count:', data.users.length);
    console.log('Users:', JSON.stringify(data.users, null, 2));
    console.log('Logs count:', data.logs.length);
  } catch (err: any) {
    console.error('Error in syncDeviceViaNativeDriver:', err.message);
  }
  process.exit(0);
}

test();
