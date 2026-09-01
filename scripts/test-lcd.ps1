param(
    [string]$DeviceIp = "192.168.29.83",
    [int]$DevicePort = 5005,
    [int]$MachineId = 1,
    [string]$NewCompanyName = "KERNN"
)

$dllPath = "C:\Program Files (x86)\ONtime\SBXPCDLL.dll"

if (-not (Test-Path $dllPath)) {
    Write-Error "SBXPCDLL.dll not found at $dllPath"
    exit 1
}

$csharpCode = @"
using System;
using System.Runtime.InteropServices;

public class SBXPC
{
    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL.dll", EntryPoint = "_ConnectTcpip", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.StdCall)]
    public static extern int ConnectTcpip(int dwMachineNumber, [MarshalAs(UnmanagedType.BStr)] ref string lpszIPAddress, int dwPortNumber, int dwPassWord);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL.dll", EntryPoint = "_Disconnect", CallingConvention = CallingConvention.StdCall)]
    public static extern void Disconnect(int dwMachineNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL.dll", EntryPoint = "_GetCompanyName1", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetCompanyName1(int dwMachineNumber, [MarshalAs(UnmanagedType.BStr)] out string dwCompanyName);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL.dll", EntryPoint = "_SetCompanyName1", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetCompanyName1(int dwMachineNumber, int vKind, [MarshalAs(UnmanagedType.BStr)] ref string dwCompanyName);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL.dll", EntryPoint = "_GetSerialNumber", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetSerialNumber(int dwMachineNumber, [MarshalAs(UnmanagedType.BStr)] out string lpszSerialNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL.dll", EntryPoint = "_GetProductCode", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetProductCode(int dwMachineNumber, [MarshalAs(UnmanagedType.BStr)] out string lpszProductCode);
}
"@

try {
    Add-Type -TypeDefinition $csharpCode -Language CSharp
} catch {
    # Type might already be added
}

Write-Host "Connecting to terminal $DeviceIp`:$DevicePort (Machine ID: $MachineId)..." -ForegroundColor Cyan
$ipRef = $DeviceIp
$connResult = [SBXPC]::ConnectTcpip($MachineId, [ref]$ipRef, $DevicePort, 0)

Write-Host "ConnectTcpip Return Value: $connResult" -ForegroundColor Yellow

if ($connResult -ne 1) {
    Write-Error "Failed to connect to device $DeviceIp over SBXPCDLL."
    exit 1
}

Write-Host "Connected successfully to biometric device!" -ForegroundColor Green

# 1. Get current device info & Serial
$sn = ""
$snRes = [SBXPC]::GetSerialNumber($MachineId, [ref]$sn)
Write-Host "GetSerialNumber Res: $snRes, Serial: $sn"

$pc = ""
$pcRes = [SBXPC]::GetProductCode($MachineId, [ref]$pc)
Write-Host "GetProductCode Res: $pcRes, Product: $pc"

# 2. Get current company name on LCD
$currentName = ""
$getRes = [SBXPC]::GetCompanyName1($MachineId, [ref]$currentName)
Write-Host "Current LCD Company Name: '$currentName' (Get Result: $getRes)" -ForegroundColor Magenta

# 3. Try setting new company name
Write-Host "Setting LCD Company Name to '$NewCompanyName'..." -ForegroundColor Cyan
$newNameRef = $NewCompanyName
$setRes = [SBXPC]::SetCompanyName1($MachineId, 1, [ref]$newNameRef)
Write-Host "SetCompanyName1 (vKind=1) Result: $setRes" -ForegroundColor Yellow

if ($setRes -ne 1) {
    Write-Host "Trying vKind=0..."
    $setRes0 = [SBXPC]::SetCompanyName1($MachineId, 0, [ref]$newNameRef)
    Write-Host "SetCompanyName1 (vKind=0) Result: $setRes0" -ForegroundColor Yellow
}

# 4. Verify by reading back
Start-Sleep -Milliseconds 500
$verifyName = ""
$getRes2 = [SBXPC]::GetCompanyName1($MachineId, [ref]$verifyName)
Write-Host "Verified LCD Company Name after write: '$verifyName' (Get Result: $getRes2)" -ForegroundColor Green

# Disconnect
[SBXPC]::Disconnect($MachineId)
Write-Host "Disconnected." -ForegroundColor Gray
