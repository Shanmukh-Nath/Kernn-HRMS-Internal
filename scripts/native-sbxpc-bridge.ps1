Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class SBXPC
{
    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_SetMachineType", CharSet = CharSet.Ansi)]
    public static extern bool SetMachineType(int dwMachineNumber, string lpszMachineType);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_ConnectTcpip", CharSet = CharSet.Unicode)]
    public static extern bool ConnectTcpip(int dwMachineNumber, [MarshalAs(UnmanagedType.BStr)] ref string lpszIPAddress, int dwPortNumber, int dwPassWord);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_GetSerialNumber", CharSet = CharSet.Unicode)]
    public static extern bool GetSerialNumber(int dwMachineNumber, [MarshalAs(UnmanagedType.BStr)] out string lpszSerialNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_ReadAllUserID")]
    public static extern bool ReadAllUserID(int dwMachineNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_GetAllUserID")]
    public static extern bool GetAllUserID(int dwMachineNumber, out int dwEnrollNumber, out int dwEMachineNumber, out int dwBackupNumber, out int dwMachinePrivilege, out int dwEnable);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_GetUserName1", CharSet = CharSet.Unicode)]
    public static extern bool GetUserName1(int dwMachineNumber, int dwEnrollNumber, [MarshalAs(UnmanagedType.BStr)] out string lpszUserName);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_EnableDevice")]
    public static extern bool EnableDevice(int dwMachineNumber, bool bFlag);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_Disconnect")]
    public static extern void Disconnect(int dwMachineNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_GetLastError")]
    public static extern bool GetLastError(int dwMachineNumber, out int dwErrorCode);
}
"@

Write-Host "================================================================"
Write-Host "🎯 Connecting to S-FB3K via Native Ontime SBXPCDLL64.dll Driver"
Write-Host "================================================================"

$machineId = 1
$ip = "192.168.29.83"
$port = 5005
$password = 0

Write-Host "Target: $ip : $port (Machine ID: $machineId)"

# Try connecting
$connected = [SBXPC]::ConnectTcpip($machineId, [ref]$ip, $port, $password)

if (-not $connected) {
    [int]$err = 0
    [SBXPC]::GetLastError($machineId, [ref]$err)
    Write-Host "❌ ConnectTcpip failed with error code: $err"
    exit 1
}

Write-Host "✅ Connected successfully via SBXPCDLL64!"

# Read serial number
[string]$serial = ""
$gotSerial = [SBXPC]::GetSerialNumber($machineId, [ref]$serial)
Write-Host "Device Serial Number: $serial (Success: $gotSerial)"

# Read all user IDs
Write-Host "`nReading all User IDs from terminal..."
$readAll = [SBXPC]::ReadAllUserID($machineId)
Write-Host "ReadAllUserID status: $readAll"

if ($readAll) {
    Write-Host "`n--- Enrolled Users on S-FB3K ---"
    [int]$enrollNum = 0
    [int]$eMachNum = 0
    [int]$backupNum = 0
    [int]$privilege = 0
    [int]$enabled = 0

    while ([SBXPC]::GetAllUserID($machineId, [ref]$enrollNum, [ref]$eMachNum, [ref]$backupNum, [ref]$privilege, [ref]$enabled)) {
        [string]$userName = ""
        [SBXPC]::GetUserName1($machineId, $enrollNum, [ref]$userName)
        Write-Host "👤 User ID: $enrollNum | Name: $userName | Backup: $backupNum | Privilege: $privilege | Enabled: $enabled"
    }
}

[SBXPC]::EnableDevice($machineId, $true)
[SBXPC]::Disconnect($machineId)
Write-Host "`nDisconnected cleanly."
