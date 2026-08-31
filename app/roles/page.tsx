'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Users,
  Save,
  Check,
  Sliders,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function RolesMatrixPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/roles');
      const json = await res.json();
      if (json.success) {
        setRoles(json.data.roles || []);
        setAllPermissions(json.data.allPermissions || []);
        if (json.data.roles?.length > 0 && !selectedRole) {
          setSelectedRole(json.data.roles[0]);
          setRolePermissions(json.data.roles[0].permissions || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleSelectRole = (r: any) => {
    setSelectedRole(r);
    setRolePermissions(r.permissions || []);
  };

  const togglePermission = (slug: string) => {
    if (selectedRole?.name === 'SUPER_ADMIN') return; // Super admin has all
    setRolePermissions((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: selectedRole.id, permissions: rolePermissions }),
      });
      const json = await res.json();
      if (json.success) {
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 3000);
        fetchRoles();
      } else {
        alert(json.error?.message || 'Failed to update permissions');
      }
    } catch {
      alert('Error updating permissions');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const groupedPermissions: Record<string, any[]> = {};
  allPermissions.forEach((p) => {
    if (!groupedPermissions[p.module]) groupedPermissions[p.module] = [];
    groupedPermissions[p.module].push(p);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-[#a92427]" />
            Fine-Grained RBAC & Role Permission Matrix
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure granular CRUD & approval privileges across all enterprise HRMS modules.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || selectedRole?.name === 'SUPER_ADMIN'}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a92427] hover:bg-[#8e1d20] text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving Matrix...' : 'Save Permissions'}
        </button>
      </div>

      {savedMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Role permission matrix updated successfully!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role Selector Sidebar (1 Column) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Access Roles</h3>
          <div className="space-y-1">
            {roles.map((r) => {
              const active = selectedRole?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSelectRole(r)}
                  className={`w-full p-3.5 rounded-xl text-left transition flex items-center justify-between ${
                    active
                      ? 'bg-[#a92427] text-white shadow-md shadow-[#a92427]/20'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">{r.name.replace('_', ' ')}</div>
                    <div className={`text-[11px] ${active ? 'text-red-100' : 'text-slate-400'}`}>
                      {r.permissions?.length} Permissions Active
                    </div>
                  </div>
                  {r.name === 'SUPER_ADMIN' && <Lock className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Permissions Matrix (3 Columns) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#a92427]" />
                Permissions for <span className="text-[#a92427]">{selectedRole?.name.replace('_', ' ')}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedRole?.name === 'SUPER_ADMIN'
                  ? 'Super Admin inherently possesses full wildcard system privileges.'
                  : 'Toggle checkboxes to grant or revoke specific operational permissions.'}
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              {rolePermissions.length} / {allPermissions.length} Selected
            </span>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
              <div key={moduleName} className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  <Sliders className="w-3.5 h-3.5 text-[#a92427]" />
                  {moduleName} Module ({perms.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {perms.map((p) => {
                    const isChecked = selectedRole?.name === 'SUPER_ADMIN' || rolePermissions.includes(p.slug);
                    return (
                      <div
                        key={p.slug}
                        onClick={() => togglePermission(p.slug)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                          isChecked
                            ? 'bg-red-50/70 border-red-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 transition ${
                            isChecked
                              ? 'bg-[#a92427] border-[#a92427] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-900 font-mono">{p.slug}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{p.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
