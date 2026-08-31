using System;
using System.Runtime.InteropServices;
using System.Threading;

public class TestSLog
{
    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_ConnectTcpip", CharSet = CharSet.Unicode)]
    public static extern bool ConnectTcpip(int dwMachineNumber, [MarshalAs(UnmanagedType.BStr)] ref string lpszIPAddress, int dwPortNumber, int dwPassWord);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_ReadAllSLogData")]
    public static extern bool ReadAllSLogData(int dwMachineNumber);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_GetAllSLogData")]
    public static extern bool GetAllSLogData(int mId, out int tMach, out int enr, out int manip, out int bkp, out int yr, out int mo, out int dy, out int hr, out int mi, out int se);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_EnableDevice")]
    public static extern bool EnableDevice(int dwMachineNumber, bool bFlag);

    [DllImport(@"C:\Program Files (x86)\ONtime\SBXPCDLL64.dll", EntryPoint = "_Disconnect")]
    public static extern void Disconnect(int mId);

    static void Main()
    {
        string ip = "192.168.29.83";
        if (ConnectTcpip(1, ref ip, 5005, 0))
        {
            Console.WriteLine("Connected! Locking device and reading SLog...");
            EnableDevice(1, false);
            Thread.Sleep(200);

            if (ReadAllSLogData(1))
            {
                int tMach, enr, manip, bkp, yr, mo, dy, hr, mi, se;
                int count = 0;
                while (GetAllSLogData(1, out tMach, out enr, out manip, out bkp, out yr, out mo, out dy, out hr, out mi, out se))
                {
                    if (yr > 2000)
                    {
                        Console.WriteLine(string.Format("Admin ID: {0} | Action: {1} | Backup: {2} | Time: {3:D4}-{4:D2}-{5:D2} {6:D2}:{7:D2}:{8:D2}", enr, manip, bkp, yr, mo, dy, hr, mi, se));
                        count++;
                    }
                }
                Console.WriteLine("Total SLog Records: " + count);
            }
            else
            {
                Console.WriteLine("ReadAllSLogData returned 0 records");
            }

            EnableDevice(1, true);
            Disconnect(1);
        }
        else
        {
            Console.WriteLine("Could not connect to device");
        }
    }
}
