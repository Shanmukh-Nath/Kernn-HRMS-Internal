'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  ShieldAlert,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle,
  HelpCircle,
  Zap,
  Sliders,
  ChevronRight,
  Coffee,
  SunMedium,
  Timer,
  Check,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AttendanceRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: 'General Office Shift',
    shiftStartTime: '09:00',
    shiftEndTime: '18:00',
    gracePeriodMinutes: 15,
    earlyCheckInBuffer: 60,
    lateCheckInBuffer: 120,
    halfDayAfterMinutes: 180,
    halfDayMinimumHours: 4.0,
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    weeklyOffDays: ['Saturday', 'Sunday'],
    autoCalculatePresent: true,
    autoCalculateHalfDay: true,
    autoCalculateOvertime: false,
    overtimeAfterHours: 8.0,
    overtimeRate: 1.5,
    breakDurationMinutes: 60,
    breakStartTime: '13:00',
    breakEndTime: '14:00',
  });

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/attendance-rules');
      const json = await res.json();
      if (json.success && json.data) {
        setForm((prev) => ({
          ...prev,
          ...json.data,
          shiftStartTime: json.data.shiftStartTime?.substring(0, 5) || '09:00',
          shiftEndTime: json.data.shiftEndTime?.substring(0, 5) || '18:00',
        }));
      }
    } catch {
      setError('Failed to fetch attendance rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/settings/attendance-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        setError(json.error?.message || 'Failed to save rules');
      }
    } catch {
      setError('Network error saving shift settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingDay = (day: string) => {
    const isWork = form.workingDays.includes(day);
    if (isWork) {
      setForm({
        ...form,
        workingDays: form.workingDays.filter((d) => d !== day),
        weeklyOffDays: form.weeklyOffDays.includes(day) ? form.weeklyOffDays : [...form.weeklyOffDays, day],
      });
    } else {
      setForm({
        ...form,
        workingDays: [...form.workingDays, day],
        weeklyOffDays: form.weeklyOffDays.filter((d) => d !== day),
      });
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <Clock className="w-5 h-5 animate-spin text-[#a92427]" />
        <span>Loading dynamic shift settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              Shift Policy & Timing Buffers
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Database Configuration
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-[#a92427]" />
            Shift Schedules & Attendance Buffers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Zero-hardcoding shift timings, grace minutes, late check-in cutoff buffers, half-day triggers, and overtime rates.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-xs transition shadow-[#a92427]/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving Rules...' : 'Save Shift Settings'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Shift timing policies and calculation buffers updated successfully! Punches are now evaluated dynamically against these settings.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Section 1: Shift Times & Grace Windows */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b pb-2">
            <SunMedium className="w-4 h-4 text-[#a92427]" />
            <span>Shift Timings & Grace Buffer Limits</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Shift Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Shift Start Time</label>
              <input
                type="time"
                value={form.shiftStartTime}
                onChange={(e) => setForm({ ...form, shiftStartTime: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Shift End Time</label>
              <input
                type="time"
                value={form.shiftEndTime}
                onChange={(e) => setForm({ ...form, shiftEndTime: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-800">Grace Period Buffer</span>
                <span className="font-mono font-bold text-[#a92427]">{form.gracePeriodMinutes} mins</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={form.gracePeriodMinutes}
                onChange={(e) => setForm({ ...form, gracePeriodMinutes: Number(e.target.value) })}
                className="w-full accent-[#a92427]"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Punches within {form.gracePeriodMinutes}m past shift start count as Present.</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block font-bold text-slate-800 mb-1">Early Check-In Window (Mins)</label>
              <input
                type="number"
                value={form.earlyCheckInBuffer}
                onChange={(e) => setForm({ ...form, earlyCheckInBuffer: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Accepts punches up to {form.earlyCheckInBuffer}m before shift start.</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block font-bold text-slate-800 mb-1">Late Cutoff Buffer (Mins)</label>
              <input
                type="number"
                value={form.lateCheckInBuffer}
                onChange={(e) => setForm({ ...form, lateCheckInBuffer: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Punches after {form.lateCheckInBuffer}m are rejected or marked Absent.</span>
            </div>
          </div>
        </div>

        {/* Section 2: Half-Day Triggers & Break Window */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b pb-2">
            <Coffee className="w-4 h-4 text-amber-600" />
            <span>Half-Day Triggers & Break Schedules</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Half-Day After (Mins Late)</label>
              <input
                type="number"
                value={form.halfDayAfterMinutes}
                onChange={(e) => setForm({ ...form, halfDayAfterMinutes: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400">e.g. 180m (3 hours) late converts to Half-Day</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Min Physical Hours for Half-Day</label>
              <input
                type="number"
                step="0.5"
                value={form.halfDayMinimumHours}
                onChange={(e) => setForm({ ...form, halfDayMinimumHours: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400">Must log at least {form.halfDayMinimumHours}h to earn credit</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Break Duration (Mins)</label>
              <input
                type="number"
                value={form.breakDurationMinutes}
                onChange={(e) => setForm({ ...form, breakDurationMinutes: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400">Deducted from gross hours (e.g. lunch)</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Break Window</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.breakStartTime}
                  onChange={(e) => setForm({ ...form, breakStartTime: e.target.value })}
                  className="w-1/2 px-2 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
                <input
                  type="time"
                  value={form.breakEndTime}
                  onChange={(e) => setForm({ ...form, breakEndTime: e.target.value })}
                  className="w-1/2 px-2 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Working Days & Weekly Off Schedules */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b pb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Scheduled Working Days & Designated Off-Days</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isWorking = form.workingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWorkingDay(day)}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                    isWorking
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-bold text-xs">{day.substring(0, 3)}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-extrabold ${isWorking ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {isWorking ? 'WORKING' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4: Overtime Multipliers */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b pb-2">
            <Timer className="w-4 h-4 text-emerald-600" />
            <span>Overtime Multiplier & Computation</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoCalculateOvertime}
                onChange={(e) => setForm({ ...form, autoCalculateOvertime: e.target.checked })}
                className="rounded text-[#a92427]"
              />
              <span>Automatically compute Overtime on daily check-outs exceeding standard hours</span>
            </label>

            {form.autoCalculateOvertime && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Overtime Starts After (Hours Worked)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.overtimeAfterHours}
                    onChange={(e) => setForm({ ...form, overtimeAfterHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Hours worked past this threshold count as Overtime</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Overtime Hourly Rate Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.overtimeRate}
                    onChange={(e) => setForm({ ...form, overtimeRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">e.g. 1.5x of standard base hourly pay</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Enforce Shift Policy'}
          </button>
        </div>
      </form>
    </div>
  );
}
