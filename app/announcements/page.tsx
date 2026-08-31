'use client';

import { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  Calendar,
  User,
  Sparkles,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Pin,
  Check,
  Building,
  ShieldCheck,
  Layers,
  Trash2,
  X,
  FileText,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [category, setCategory] = useState('POLICY_UPDATE');
  const [targetDept, setTargetDept] = useState('ALL');
  const [isPinned, setIsPinned] = useState(false);
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const [meRes, annRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/announcements?category=${selectedCategory}`),
      ]);
      const meJson = await meRes.json();
      const annJson = await annRes.json();
      if (meJson.success) setCurrentUser(meJson.data.user);
      if (annJson.success) {
        setAnnouncements(annJson.data || []);
        setMeta(annJson.meta || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [selectedCategory]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          priority,
          category,
          targetDept,
          isPinned,
          requiresAcknowledgement,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setTitle('');
        setContent('');
        fetchAnnouncements();
      } else {
        alert(json.error?.message || 'Failed to publish bulletin');
      }
    } catch {
      alert('Error creating announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async (announcementId: string) => {
    try {
      const res = await fetch('/api/announcements/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId }),
      });
      const json = await res.json();
      if (json.success) {
        fetchAnnouncements();
      } else {
        alert(json.error || 'Failed to acknowledge');
      }
    } catch {
      alert('Error recording acknowledgement');
    }
  };

  const handleDelete = async (id: string, aTitle: string) => {
    if (!confirm(`Delete bulletin '${aTitle}'?`)) return;
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchAnnouncements();
      } else {
        alert(json.error?.message || 'Failed to delete');
      }
    } catch {
      alert('Error deleting announcement');
    }
  };

  const canManage = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN' || currentUser?.role === 'MANAGER';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              Corporate Communications
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Employee Read-Tracking Active
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Megaphone className="w-7 h-7 text-[#a92427]" />
            Enterprise Notice Board & Policy Bulletins
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Company townhalls, compliance updates, targeted departmental bulletins, and employee acknowledgement tracking.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-xs transition shadow-[#a92427]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Publish New Bulletin</span>
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'ALL', label: 'All Bulletins' },
          { id: 'POLICY_UPDATE', label: 'Policy & Compliance' },
          { id: 'URGENT_ALERT', label: 'Urgent Alerts' },
          { id: 'TOWNHALL', label: 'Townhall & Events' },
          { id: 'HOLIDAY_NOTICE', label: 'Holiday Notices' },
          { id: 'CELEBRATION', label: 'Milestones & Cheers' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedCategory === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulletins Feed */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200">
          Loading company notice board...
        </div>
      ) : announcements.length === 0 ? (
        <div className="p-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <Bell className="w-10 h-10 text-slate-400 mx-auto" />
          <div className="text-sm font-bold text-slate-700">No Bulletins in this Category</div>
          <p className="text-xs text-slate-400">All caught up! Check back later for announcements.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {announcements.map((a) => {
            const isUrgent = a.priority === 'URGENT';
            const totalStaff = meta.totalStaff || 7;
            const ackPercent = Math.round(((a.ackCount || 0) / totalStaff) * 100);

            return (
              <div
                key={a.id}
                className={`p-6 rounded-3xl bg-white border transition shadow-xs flex flex-col justify-between relative overflow-hidden ${
                  a.isPinned
                    ? 'border-amber-400 ring-2 ring-amber-400/20'
                    : isUrgent
                    ? 'border-rose-400'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header & Badges */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.isPinned && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                          <Pin className="w-3 h-3 fill-amber-700" />
                          Pinned to Top
                        </span>
                      )}

                      {isUrgent ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Urgent Priority
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {a.category?.replace('_', ' ') || 'Notice'}
                        </span>
                      )}

                      {a.targetDept && a.targetDept !== 'ALL' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          Target: {a.targetDept}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{a.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right text-[11px] text-slate-400 font-mono">
                      <div>{format(new Date(a.publishedAt), 'dd MMM yyyy')}</div>
                      <div className="text-[10px] text-slate-500 font-sans">by {a.authorName}</div>
                    </div>

                    {canManage && (
                      <button
                        onClick={() => handleDelete(a.id, a.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line py-2 border-t border-slate-100">
                  {a.content}
                </div>

                {/* Footer: Acknowledgement Actions & Metric */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Left: Tracker for HR / Admins */}
                  {a.requiresAcknowledgement ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Staff Read Receipts:</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, ackPercent)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          {a.ackCount || 0}/{totalStaff} ({ackPercent}%)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">Informational Bulletin</span>
                  )}

                  {/* Right: Employee Acknowledgement Button */}
                  {a.requiresAcknowledgement && (
                    <div>
                      {a.isAcknowledged ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3.5 h-3.5" />
                          <span>Acknowledged & Understood</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>I Have Read & Acknowledge</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post Bulletin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-5 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Publish Notice Bulletin</h3>
                <p className="text-xs text-slate-500">Broadcast official policies, announcements, and alerts.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notice Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mandatory Update: Q3 Shift Timings & Code of Conduct"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none"
                  >
                    <option value="POLICY_UPDATE">Policy & Compliance</option>
                    <option value="URGENT_ALERT">Urgent Operational Alert</option>
                    <option value="TOWNHALL">Townhall Meeting</option>
                    <option value="HOLIDAY_NOTICE">Holiday & Festival</option>
                    <option value="CELEBRATION">Celebration / Achievement</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Department</label>
                  <select
                    value={targetDept}
                    onChange={(e) => setTargetDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none"
                  >
                    <option value="ALL">All Company Employees</option>
                    <option value="Engineering">Engineering Department</option>
                    <option value="Operations">Operations Department</option>
                    <option value="Sales">Sales & Marketing</option>
                    <option value="MANAGERS">Managers Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Broadcast Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="NORMAL">Standard Priority</option>
                    <option value="URGENT">Urgent (High Visibility)</option>
                  </select>
                </div>

                <div className="space-y-2 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="rounded text-[#a92427]"
                    />
                    <span>Pin to Top of Board</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={requiresAcknowledgement}
                      onChange={(e) => setRequiresAcknowledgement(e.target.checked)}
                      className="rounded text-[#a92427]"
                    />
                    <span>Require Read Receipt</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bulletin Content</label>
                <textarea
                  placeholder="Detailed guidelines, policy explanation, or schedule notes..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {submitting ? 'Broadcasting...' : 'Publish Bulletin to Board'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
