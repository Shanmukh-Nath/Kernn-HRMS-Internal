'use client';

import { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Users,
  UserCheck,
  UserX,
  Clock,
  Palmtree,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatAppTime12, formatAppDate } from '@/lib/timezone';

export default function DailyAttendancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [activeListTab, setActiveListTab] = useState<'PRESENT' | 'ON_LEAVE' | 'ABSENT'>('PRESENT');

  const fetchDailyData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/today');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyData();
  }, []);

  const departments = Array.from(
    new Set([
      ...(data?.todayCheckIns?.map((e: any) => e.department) || []),
      ...(data?.todayOnLeave?.map((e: any) => e.department) || []),
      ...(data?.notYetArrived?.map((e: any) => e.department) || []),
    ])
  ).filter(Boolean);

  const filterList = (list: any[]) => {
    return (list || []).filter((item: any) => {
      const matchesSearch =
        !search ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.employeeCode?.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === 'ALL' || item.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  };

  const filteredCheckIns = filterList(data?.todayCheckIns || []);
  const filteredOnLeave = filterList(data?.todayOnLeave || []);
  const filteredNotArrived = filterList(data?.notYetArrived || []);

  const todayFormatted = format(new Date(), 'EEEE, dd MMMM yyyy');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Presence Feed
            </span>
            <span className="text-xs text-slate-400 font-mono">{todayFormatted}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarCheck className="w-7 h-7 text-[#a92427]" />
            Today&apos;s Attendance & Daily Roll Call
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Current date operational view: real-time check-ins, punctuality metrics, and staff on approved leave.
          </p>
        </div>

        <button
          onClick={fetchDailyData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* KPI Stats Grid with Skeleton States */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Headcount</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-slate-100 rounded-lg animate-pulse my-1" />
          ) : (
            <div className="text-2xl font-black text-slate-900 font-mono">{data?.stats?.totalEmployees || 0}</div>
          )}
          <span className="text-[10px] text-slate-500 font-medium">Scheduled active roster</span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Present On Duty</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-emerald-50 rounded-lg animate-pulse my-1" />
          ) : (
            <div className="text-2xl font-black text-emerald-700 font-mono">{data?.stats?.presentCount || 0}</div>
          )}
          <span className="text-[10px] text-emerald-600 font-medium">
            {loading ? '...' : `${data?.stats?.onTimeCount || 0} on time, ${data?.stats?.lateCount || 0} late`}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Approved Leaves</span>
            <Palmtree className="w-4 h-4 text-blue-600" />
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-blue-50 rounded-lg animate-pulse my-1" />
          ) : (
            <div className="text-2xl font-black text-blue-700 font-mono">{data?.stats?.onLeaveCount || 0}</div>
          )}
          <span className="text-[10px] text-blue-600 font-medium">Authorized absence</span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Punch</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-rose-50 rounded-lg animate-pulse my-1" />
          ) : (
            <div className="text-2xl font-black text-rose-700 font-mono">{data?.stats?.absentCount || 0}</div>
          )}
          <span className="text-[10px] text-rose-600 font-medium">No check-in detected</span>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveListTab('PRESENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeListTab === 'PRESENT'
                ? 'bg-[#a92427] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Present Staff</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeListTab === 'PRESENT' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {data?.todayCheckIns?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveListTab('ON_LEAVE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeListTab === 'ON_LEAVE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palmtree className="w-3.5 h-3.5" />
            <span>On Leave</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeListTab === 'ON_LEAVE' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {data?.todayOnLeave?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveListTab('ABSENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeListTab === 'ABSENT'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserX className="w-3.5 h-3.5 text-rose-400" />
            <span>Awaiting Check-in</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeListTab === 'ABSENT' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {data?.notYetArrived?.length || 0}
            </span>
          </button>
        </div>

        {/* Search & Department Selector */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d: any) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-[#a92427]" />
              <span>Loading real-time attendance roll call...</span>
            </div>
            <div className="space-y-2 max-w-4xl mx-auto">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: PRESENT STAFF */}
            {activeListTab === 'PRESENT' && (
              <div>
                {filteredCheckIns.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 text-xs space-y-2">
                    <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700">No Check-in Punches Recorded Today</p>
                    <p className="text-slate-400">Punches will appear in real time as employees scan their terminal biometric.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          <th className="py-4 px-6">Employee</th>
                          <th className="py-4 px-6">Department & Role</th>
                          <th className="py-4 px-6 font-mono">First Check-In (IST)</th>
                          <th className="py-4 px-6 font-mono">Latest Check-Out (IST)</th>
                          <th className="py-4 px-6 text-center">Status</th>
                          <th className="py-4 px-6">Terminal Device</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredCheckIns.map((emp: any) => (
                          <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition">
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{emp.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="text-slate-700 font-medium">{emp.department}</div>
                              <div className="text-[11px] text-slate-400">{emp.designation}</div>
                            </td>
                            <td className="py-4 px-6 font-mono font-bold text-slate-900">
                              {emp.checkInTime ? formatAppTime12(emp.checkInTime) : '--'}
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-600">
                              {emp.checkOutTime ? formatAppTime12(emp.checkOutTime) : '--'}
                            </td>
                            <td className="py-4 px-6 text-center whitespace-nowrap">
                              {emp.status === 'ON_TIME' ? (
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  On Time
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Late Arrival
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                              {emp.deviceName || 'Secureye S-FB3K'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ON LEAVE TODAY */}
            {activeListTab === 'ON_LEAVE' && (
              <div>
                {filteredOnLeave.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 text-xs space-y-2">
                    <Palmtree className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700">No Staff on Leave Today</p>
                    <p className="text-slate-400">All active staff are scheduled for on-duty service today.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          <th className="py-4 px-6">Employee</th>
                          <th className="py-4 px-6">Department</th>
                          <th className="py-4 px-6">Leave Category</th>
                          <th className="py-4 px-6">Leave Duration</th>
                          <th className="py-4 px-6">Reason for Leave</th>
                          <th className="py-4 px-6 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredOnLeave.map((emp: any) => (
                          <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition">
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{emp.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                            </td>
                            <td className="py-4 px-6 text-slate-700 font-medium">{emp.department}</td>
                            <td className="py-4 px-6">
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                {emp.leaveTypeName} ({emp.leaveTypeCode})
                              </span>
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-700">
                              {emp.startDate ? format(new Date(emp.startDate), 'dd MMM') : ''} -{' '}
                              {emp.endDate ? format(new Date(emp.endDate), 'dd MMM yyyy') : ''}
                            </td>
                            <td className="py-4 px-6 text-slate-600 max-w-sm truncate">{emp.reason || 'Approved leave'}</td>
                            <td className="py-4 px-6 text-center whitespace-nowrap">
                              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Approved Leave
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: AWAITING CHECK-IN */}
            {activeListTab === 'ABSENT' && (
              <div>
                {filteredNotArrived.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 text-xs space-y-2">
                    <UserCheck className="w-10 h-10 text-emerald-400 mx-auto" />
                    <p className="font-bold text-slate-700">All Scheduled Staff Have Checked In!</p>
                    <p className="text-slate-400">100% presence achieved for all non-leave active staff today.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          <th className="py-4 px-6">Employee</th>
                          <th className="py-4 px-6">Department</th>
                          <th className="py-4 px-6">Designation</th>
                          <th className="py-4 px-6 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredNotArrived.map((emp: any) => (
                          <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition">
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{emp.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                            </td>
                            <td className="py-4 px-6 text-slate-700">{emp.department}</td>
                            <td className="py-4 px-6 text-slate-500">{emp.designation}</td>
                            <td className="py-4 px-6 text-center whitespace-nowrap">
                              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Awaiting Terminal Punch
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
