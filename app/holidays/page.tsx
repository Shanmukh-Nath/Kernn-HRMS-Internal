'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Clock,
  Check,
  Filter,
  ShieldCheck,
  Building,
  Star,
  Info,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [year, setYear] = useState(2026);
  const [activeCategory, setActiveCategory] = useState('ALL');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [type, setType] = useState('GAZETTED');
  const [applicableDept, setApplicableDept] = useState('ALL');
  const [submitting, setSubmitting] = useState(false);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const [meRes, holRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/holidays?year=${year}&category=${activeCategory}`),
      ]);
      const meJson = await meRes.json();
      const holJson = await holRes.json();
      if (meJson.success) setCurrentUser(meJson.data.user);
      if (holJson.success) {
        setHolidays(holJson.data || []);
        setMeta(holJson.meta || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [year, activeCategory]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          date,
          description,
          type,
          applicableDept,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setName('');
        setDescription('');
        fetchHolidays();
      } else {
        alert(json.error?.message || 'Failed to add holiday');
      }
    } catch {
      alert('Error adding holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleClaim = async (holidayId: string) => {
    try {
      const res = await fetch('/api/holidays/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holidayId }),
      });
      const json = await res.json();
      if (json.success) {
        fetchHolidays();
      } else {
        alert(json.error || 'Failed to claim floating holiday');
      }
    } catch {
      alert('Error claiming holiday');
    }
  };

  const handleDelete = async (id: string, hName: string) => {
    if (!confirm(`Are you sure you want to remove '${hName}' from the calendar?`)) return;
    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchHolidays();
      } else {
        alert(json.error?.message || 'Failed to delete');
      }
    } catch {
      alert('Error deleting holiday');
    }
  };

  const canManage = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              Corporate Calendar & Time Off
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Gazetted & Floating Policies
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-[#a92427]" />
            Enterprise Public Holidays & Floating Leave Desk
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Official mandatory gazetted paid holidays, optional floating holidays selection, and branch applicability rules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none"
          >
            <option value={2026}>Calendar Year 2026</option>
            <option value={2025}>Calendar Year 2025</option>
          </select>

          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-xs transition shadow-[#a92427]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Holiday / Setting</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Holiday Quota Tracker Card for Employees */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Floating / Optional Holiday Quota
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Employees are entitled to <strong>2 Floating Holidays</strong> per calendar year. You can choose which religious or cultural days you wish to observe from the optional list below.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
          <div className="text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Claimed</span>
            <span className="text-xl font-black font-mono text-emerald-400">{meta.claimedCount || 0}</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Annual Limit</span>
            <span className="text-xl font-black font-mono text-white">2</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Available</span>
            <span className="text-xl font-black font-mono text-amber-300">
              {Math.max(0, 2 - (meta.claimedCount || 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'ALL', label: 'All Holidays', count: holidays.length },
          { id: 'GAZETTED', label: 'Mandatory Gazetted', count: meta.gazettedCount || 0 },
          { id: 'RESTRICTED_OPTIONAL', label: 'Restricted / Floating (Optional)', count: meta.optionalCount || 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeCategory === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                activeCategory === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Holidays Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200">
          Loading calendar holidays...
        </div>
      ) : holidays.length === 0 ? (
        <div className="p-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <CalendarDays className="w-10 h-10 text-slate-400 mx-auto" />
          <div className="text-sm font-bold text-slate-700">No Holidays Registered in Category</div>
          <p className="text-xs text-slate-400">Add official public or regional holidays using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {holidays.map((h) => {
            const parsed = new Date(h.date);
            const isGazetted = h.type === 'GAZETTED';
            const isOptional = h.type === 'RESTRICTED_OPTIONAL' || h.isOptional;
            const dayOfWeek = format(parsed, 'EEEE');
            const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

            return (
              <div
                key={h.id}
                className={`p-5 rounded-3xl bg-white border transition shadow-xs flex flex-col justify-between relative overflow-hidden ${
                  h.isClaimed
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Date & Type Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center font-mono">
                        <span className="text-[10px] font-extrabold uppercase text-[#a92427]">
                          {format(parsed, 'MMM')}
                        </span>
                        <span className="text-base font-black text-slate-900 leading-none">
                          {format(parsed, 'dd')}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{h.name}</h4>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {dayOfWeek} {isWeekend && <span className="text-amber-600 font-semibold">(Weekend)</span>}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <button
                        onClick={() => handleDelete(h.id, h.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Remove holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {h.description || (isGazetted ? 'Mandatory official gazetted holiday.' : 'Floating cultural / religious holiday.')}
                  </p>
                </div>

                {/* Bottom Badges & Claim Button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {isGazetted ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Gazetted (Mandatory)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Restricted / Floating
                      </span>
                    )}

                    {h.applicableDept && h.applicableDept !== 'ALL' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                        {h.applicableDept}
                      </span>
                    )}
                  </div>

                  {/* Floating Claim Action for Employees */}
                  {isOptional && (
                    <button
                      onClick={() => handleToggleClaim(h.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                        h.isClaimed
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {h.isClaimed ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Claimed</span>
                        </>
                      ) : (
                        <span>Claim Day</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Holiday Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-5 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add Holiday to Calendar</h3>
                <p className="text-xs text-slate-500">Configure public or floating company holidays.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Holiday Name</label>
                <input
                  type="text"
                  placeholder="e.g. Maha Shivratri / Good Friday / Diwali"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                  >
                    <option value="GAZETTED">Mandatory Gazetted</option>
                    <option value="RESTRICTED_OPTIONAL">Restricted / Floating (Optional)</option>
                    <option value="REGIONAL">Regional / State</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department / Branch Applicability</label>
                <select
                  value={applicableDept}
                  onChange={(e) => setApplicableDept(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none"
                >
                  <option value="ALL">All Departments & Branches</option>
                  <option value="Engineering">Engineering Branch Only</option>
                  <option value="Operations">Operations Branch Only</option>
                  <option value="Sales">Sales Branch Only</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  placeholder="Optional context about observance or carry-over rules..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {submitting ? 'Registering...' : 'Register Holiday'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
