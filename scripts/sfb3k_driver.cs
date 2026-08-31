using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

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
}

public class UserItem
{
    public string userId { get; set; }
    public string name { get; set; }
    public int privilege { get; set; }
    public bool enabled { get; set; }
    public List<int> backupNumbers { get; set; }
    public UserItem() { backupNumbers = new List<int>(); }
}

public class LogItem
{
    public string userId { get; set; }
    public int verifyMode { get; set; }
    public string timestamp { get; set; }
}

public class SyncResult
{
    public string serialNumber { get; set; }
    public List<UserItem> users { get; set; }
    public List<LogItem> logs { get; set; }
    public SyncResult()
    {
        users = new List<UserItem>();
        logs = new List<LogItem>();
    }
}

class Program
{
    static void Main(string[] args)
    {
        string ip = args.Length > 0 ? args[0] : "192.168.29.83";
        int port = args.Length > 1 ? int.Parse(args[1]) : 5005;
        int machineId = args.Length > 2 ? int.Parse(args[2]) : 1;
        int password = 0;

        string targetIp = ip;
        bool connected = SBXPC.ConnectTcpip(machineId, ref targetIp, port, password);

        if (!connected)
        {
            Console.Error.WriteLine("ConnectTcpip failed for " + ip + ":" + port);
            Environment.Exit(1);
        }

        var result = new SyncResult();

        // 1. Get Serial Number
        string serial = "";
        SBXPC.GetSerialNumber(machineId, out serial);
        result.serialNumber = serial;

        // 2. Lock device to prepare memory transfer (Lock symbol appears on terminal)
        SBXPC.EnableDevice(machineId, false);

        Thread.Sleep(200);

        // 3. Read All User IDs
        var usersMap = new Dictionary<string, UserItem>();
        if (SBXPC.ReadAllUserID(machineId))
        {
            int enrollNum, eMachNum, backupNum, privilege, enabled;
            while (SBXPC.GetAllUserID(machineId, out enrollNum, out eMachNum, out backupNum, out privilege, out enabled))
            {
                string uId = enrollNum.ToString();
                if (!usersMap.ContainsKey(uId))
                {
                    string uName = "";
                    SBXPC.GetUserName1(machineId, enrollNum, out uName);
                    usersMap[uId] = new UserItem
                    {
                        userId = uId,
                        name = string.IsNullOrWhiteSpace(uName) ? ("Employee " + uId) : uName,
                        privilege = privilege,
                        enabled = (enabled == 1)
                    };
                }
                usersMap[uId].backupNumbers.Add(backupNum);
            }
        }

        result.users.AddRange(usersMap.Values);

        Thread.Sleep(200);

        // 4. Read All Attendance Logs
        if (SBXPC.ReadAllGLogData(machineId))
        {
            int tMach, enr, eMach, vMode, yr, mo, dy, hr, mi, se;
            while (SBXPC.GetAllGLogData(machineId, out tMach, out enr, out eMach, out vMode, out yr, out mo, out dy, out hr, out mi, out se))
            {
                if (yr > 2000)
                {
                    result.logs.Add(new LogItem
                    {
                        userId = enr.ToString(),
                        verifyMode = vMode,
                        timestamp = string.Format("{0:D4}-{1:D2}-{2:D2} {3:D2}:{4:D2}:{5:D2}", yr, mo, dy, hr, mi, se)
                    });
                }
            }
        }

        // 5. Unlock device and disconnect cleanly
        SBXPC.EnableDevice(machineId, true);
        SBXPC.Disconnect(machineId);

        var serializer = new JavaScriptSerializer();
        serializer.MaxJsonLength = int.MaxValue;
        string json = serializer.Serialize(result);

        Console.WriteLine("___JSON_DATA_START___");
        Console.WriteLine(json);
        Console.WriteLine("___JSON_DATA_END___");
    }
}
