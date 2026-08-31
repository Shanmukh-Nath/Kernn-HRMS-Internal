param(
    [string]$ip = "192.168.29.83",
    [int]$port = 5005,
    [int]$machineId = 1,
    [int]$password = 0
)

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

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_ReadAllGLogData")]
    public static extern bool ReadAllGLogData(int dwMachineNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_GetAllGLogData")]
    public static extern bool GetAllGLogData(int dwMachineNumber, out int dwTMachineNumber, out int dwEnrollNumber, out int dwEMachineNumber, out int dwVerifyMode, out int dwYear, out int dwMonth, out int dwDay, out int dwHour, out int dwMinute, out int dwSecond);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_EnableDevice")]
    public static extern bool EnableDevice(int dwMachineNumber, bool bFlag);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_Disconnect")]
    public static extern void Disconnect(int dwMachineNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_GetLastError")]
    public static extern bool GetLastError(int dwMachineNumber, out int dwErrorCode);
}
"@

$connIp = "$ip"
$connected = [SBXPC]::ConnectTcpip($machineId, [ref]$connIp, $port, $password)

if (-not $connected) {
    [int]$err = 0
    [void][SBXPC]::GetLastError($machineId, [ref]$err)
    Write-Error "ConnectTcpip failed for $ip : $port (Error code: $err)"
    exit 1
}

# 1. Read Serial Number
[string]$serial = ""
$gotSerial = [SBXPC]::GetSerialNumber($machineId, [ref]$serial)

# 2. Read All Enrolled Users
$usersMap = @{}
$readAll = [SBXPC]::ReadAllUserID($machineId)

if ($readAll) {
    [int]$enrollNum = 0
    [int]$eMachNum = 0
    [int]$backupNum = 0
    [int]$privilege = 0
    [int]$enabled = 0

    while ([SBXPC]::GetAllUserID($machineId, [ref]$enrollNum, [ref]$eMachNum, [ref]$backupNum, [ref]$privilege, [ref]$enabled)) {
        $uIdStr = "$enrollNum"
        if (-not $usersMap.ContainsKey($uIdStr)) {
            [string]$name = ""
            $gotName = [SBXPC]::GetUserName1($machineId, $enrollNum, [ref]$name)
            $usersMap[$uIdStr] = @{
                userId = $uIdStr
                name = if ([string]::IsNullOrWhiteSpace($name)) { "Employee $uIdStr" } else { $name }
                privilege = $privilege
                enabled = ($enabled -eq 1)
                backupNumbers = @($backupNum)
            }
        } else {
            $usersMap[$uIdStr].backupNumbers += $backupNum
        }
    }
}

$userList = @($usersMap.Values)

# 3. Read Attendance Logs
$logList = @()
$readLogs = [SBXPC]::ReadAllGLogData($machineId)

if ($readLogs) {
    [int]$tMach = 0
    [int]$enr = 0
    [int]$eMach = 0
    [int]$vMode = 0
    [int]$yr = 0
    [int]$mo = 0
    [int]$dy = 0
    [int]$hr = 0
    [int]$mi = 0
    [int]$se = 0

    while ([SBXPC]::GetAllGLogData($machineId, [ref]$tMach, [ref]$enr, [ref]$eMach, [ref]$vMode, [ref]$yr, [ref]$mo, [ref]$dy, [ref]$hr, [ref]$mi, [ref]$se)) {
        if ($yr -gt 2000) {
            $tsStr = ("{0:D4}-{1:D2}-{2:D2} {3:D2}:{4:D2}:{5:D2}" -f $yr, $mo, $dy, $hr, $mi, $se)
            $logList += @{
                userId = "$enr"
                verifyMode = $vMode
                timestamp = $tsStr
            }
        }
    }
}

[void][SBXPC]::EnableDevice($machineId, $true)
[void][SBXPC]::Disconnect($machineId)

$result = @{
    serialNumber = $serial
    users = $userList
    logs = $logList
}

$jsonOutput = $result | ConvertTo-Json -Depth 5

Write-Output "___JSON_DATA_START___"
Write-Output $jsonOutput
Write-Output "___JSON_DATA_END___"
