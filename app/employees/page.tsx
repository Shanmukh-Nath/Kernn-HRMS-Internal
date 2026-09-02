'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building,
  Smartphone,
  Mail,
  CreditCard,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Shield,
  Briefcase,
  Layers,
  ChevronRight,
  User,
  GraduationCap,
  Sliders,
  DollarSign,
  Edit2,
  Trash2,
  X,
  Plus,
  Sparkles,
  HeartPulse,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Award,
  Eye,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import { generateCredentialPdf } from '@/lib/generate-credential-pdf';

const DEPARTMENTS = [
  'ALL',
  'Engineering',
  'Human Resources',
  'Operations',
  'Management',
  'Sales & Marketing',
  'Finance & Accounts',
  'Customer Support',
];

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
const WORK_SHIFTS = ['Day', 'Morning', 'Evening', 'Night', 'Flexible'];
const EMPLOYEE_STATUSES = ['ACTIVE', 'PROBATION', 'INACTIVE', 'SUSPENDED'];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [lookups, setLookups] = useState<{
    roles: any[];
    salaryStructures: any[];
    managers: any[];
  }>({ roles: [], salaryStructures: [], managers: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalTab, setModalTab] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [submitting, setSubmitting] = useState(false);

  // Created credentials modal
  const [createdCredentials, setCreatedCredentials] = useState<any | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Password Reset Modal States
  const [resettingEmployee, setResettingEmployee] = useState<any | null>(null);
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [resetForceChange, setResetForceChange] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<any | null>(null);
  const [copiedResetPass, setCopiedResetPass] = useState(false);

  // View Profile Modal
  const [viewingEmployee, setViewingEmployee] = useState<any | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  // Form State matching all 6 enterprise architecture modules
  const defaultEmployeeForm = {
    id: '',
    // Module 1: Primary Details
    name: '',
    employeeCode: '',
    department: 'Engineering',
    designation: 'Staff Member',
    status: 'ACTIVE',
    deviceUserId: '',

    // Module 2: Personal Details
    dateOfBirth: '',
    gender: 'Male',
    bloodGroup: '',
    maritalStatus: 'Single',
    aadhaarNumber: '',
    panNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',

    // Module 3: Professional Details
    dateOfJoining: '',
    mobileNumber: '',
    email: '',
    address: '',
    probationPeriod: 6,
    workShift: 'Day',
    expectedWorkHours: 8.0,
    managerId: '',

    // Module 4: Qualifications & Experience
    qualifications: [
      { degree: 'B.Tech / Bachelor', institute: '', year: 2022, score: '8.0 CGPA' },
    ],
    experience: [
      { company: '', designation: '', fromYear: 2022, toYear: 2024, description: '' },
    ],

    // Module 5: Role Assignment
    roleId: '',

    // Module 6: Payroll & Salary Structure
    salaryStructureId: '',
    baseSalary: '',
    ctcAmount: '',
    hra: '',
    allowances: '',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    accountHolderName: '',
  };

  const [form, setForm] = useState<any>(defaultEmployeeForm);

  // Live preview for selected salary structure
  const [salaryPreview, setSalaryPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);
      if (department) q.append('department', department);
      if (roleFilter) q.append('role', roleFilter);
      if (statusFilter) q.append('status', statusFilter);

      const res = await fetch(`/api/employees?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEmployees(json.data || []);
        if (json.lookups) {
          setLookups(json.lookups);
        }
      }

      // Fetch active session
      const meRes = await fetch('/api/auth/me');
      const meJson = await meRes.json();
      if (meJson.success) {
        const u = meJson.data?.user || meJson.data;
        setCurrentUser(u);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [department, roleFilter, statusFilter]);

  // Evaluate Salary Preview when Base Salary or Structure changes
  const runSalaryPreview = async (structureId: string, baseSalary: number) => {
    if (!structureId || !baseSalary) return;
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/payroll/structures/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structureId,
          baseSalary: Number(baseSalary),
          ctc: Number(baseSalary) * 12,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSalaryPreview(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (modalTab === 6 && form.salaryStructureId && form.baseSalary) {
      runSalaryPreview(form.salaryStructureId, form.baseSalary);
    }
  }, [modalTab, form.salaryStructureId, form.baseSalary]);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    const initialRoleId = lookups.roles.find((r: any) => r.name === 'EMPLOYEE')?.id || lookups.roles[0]?.id || '';

    setForm({
      ...defaultEmployeeForm,
      roleId: initialRoleId,
      salaryStructureId: '',
      baseSalary: '',
      ctcAmount: '',
      hra: '',
      allowances: '',
      deviceUserId: '',
    });
    setModalTab(1);
    setShowModal(true);
  };

  const handleOpenEditModal = (emp: any) => {
    setIsEditing(true);
    const matchedRole = lookups.roles.find((r: any) => r.id === emp.roleId || r.name === emp.roleName);
    setForm({
      ...defaultEmployeeForm,
      ...emp,
      deviceUserId: emp.deviceUserId || '',
      dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.split('T')[0] : '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      qualifications: emp.qualifications && emp.qualifications.length > 0 ? emp.qualifications : defaultEmployeeForm.qualifications,
      experience: emp.experience && emp.experience.length > 0 ? emp.experience : defaultEmployeeForm.experience,
      roleId: matchedRole?.id || emp.roleId || lookups.roles[0]?.id || '',
      salaryStructureId: emp.salaryStructureId || '',
    });
    setModalTab(1);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const endpoint = '/api/employees';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        if (!isEditing && json.data?.temporaryPassword) {
          setCreatedCredentials(json.data);
        }
        showToast(json.message || (isEditing ? 'Employee profile updated successfully!' : 'Employee onboarded successfully!'), 'success');
        fetchEmployees();
      } else {
        showToast(json.error?.message || 'Operation failed', 'error');
      }
    } catch {
      showToast('Network error saving employee details', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete employee '${name}'?`)) return;
    try {
      const res = await fetch(`/api/employees?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Employee removed successfully', 'success');
        fetchEmployees();
      } else {
        showToast(json.error?.message || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Network error deleting employee', 'error');
    }
  };

  const handleCopyPassword = () => {
    if (!createdCredentials?.temporaryPassword) return;
    navigator.clipboard.writeText(createdCredentials.temporaryPassword);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  // Generate and download an executive branded Kernn credential PDF
  const handleDownloadCredentialPDF = () => {
    if (!createdCredentials) return;
    const { name, mobileNumber, employeeCode, temporaryPassword } = createdCredentials;

    generateCredentialPdf({
      type: 'NEW_EMPLOYEE',
      employeeName: name,
      employeeCode: employeeCode || 'EMP-001',
      mobileNumber,
      temporaryPassword,
      portalUrl: 'https://hrms.kernn.ai',
    });
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingEmployee) return;

    setResetLoading(true);
    setResetResult(null);

    try {
      const res = await fetch('/api/auth/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: resettingEmployee.id,
          customPassword: resetCustomPassword,
          forceChangeOnLogin: resetForceChange,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setResetResult(json.data);
      } else {
        alert(json.error?.message || 'Failed to reset password');
      }
    } catch {
      alert('Network error while resetting password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCopyResetPassword = () => {
    if (!resetResult?.temporaryPassword) return;
    navigator.clipboard.writeText(resetResult.temporaryPassword);
    setCopiedResetPass(true);
    setTimeout(() => setCopiedResetPass(false), 2000);
  };

  // Download branded Kernn PDF for reset password — amber banner variant
  const handleDownloadResetPDF = () => {
    if (!resetResult) return;
    const { userName, mobileNumber, temporaryPassword } = resetResult;
    const employeeName = resettingEmployee?.name || userName || 'Employee';

    generateCredentialPdf({
      type: 'PASSWORD_RESET',
      employeeName,
      employeeCode: resettingEmployee?.employeeCode || 'EMP-001',
      mobileNumber,
      temporaryPassword,
      portalUrl: 'https://hrms.kernn.ai',
    });
  };

  // Qualification item modifiers
  const addQualification = () => {
    setForm({
      ...form,
      qualifications: [...form.qualifications, { degree: '', institution: '', year: '', score: '' }],
    });
  };

  const removeQualification = (idx: number) => {
    setForm({
      ...form,
      qualifications: form.qualifications.filter((_: any, i: number) => i !== idx),
    });
  };

  // Experience item modifiers
  const addExperience = () => {
    setForm({
      ...form,
      experience: [...form.experience, { company: '', designation: '', from: '', to: '', years: 1 }],
    });
  };

  const removeExperience = (idx: number) => {
    setForm({
      ...form,
      experience: form.experience.filter((_: any, i: number) => i !== idx),
    });
  };

  const activeCount = employees.filter((e) => e.status === 'ACTIVE').length;
  const probationCount = employees.filter((e) => e.status === 'PROBATION').length;
  const userRole = (currentUser?.role || currentUser?.user?.role || '').toUpperCase();
  const canManage = userRole === 'SUPER_ADMIN' || userRole === 'HR_ADMIN' || userRole === 'ADMIN' || currentUser?.permissions?.includes('employees:create') || currentUser?.permissions?.includes('all') || !currentUser;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-fadeIn">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-xs font-bold border ${
              toast.type === 'success'
                ? 'bg-emerald-900/95 text-emerald-100 border-emerald-500/30'
                : 'bg-rose-900/95 text-rose-100 border-rose-500/30'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              Workforce Directory
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              6-Module Enterprise Architecture
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-[#a92427]" />
            Employee Management & Profiles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Primary details, personal demographics, professional employment, qualifications, RBAC role assignment, and compensation structures.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-xs transition shadow-[#a92427]/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Onboard New Employee</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Headcount</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">{employees.length}</div>
            <span className="text-[10px] text-slate-500 font-medium">On-roll workforce</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Staff</span>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-1">{activeCount}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Confirmed employees</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">On Probation</span>
            <div className="text-2xl font-black font-mono text-amber-700 mt-1">{probationCount}</div>
            <span className="text-[10px] text-amber-600 font-medium">Under evaluation</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Salary Structures</span>
            <div className="text-2xl font-black font-mono text-purple-700 mt-1">{lookups.salaryStructures.length}</div>
            <span className="text-[10px] text-purple-600 font-medium">Configured CTC packages</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Sliders className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Filters Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-1 min-w-[260px] items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#a92427]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, employee code, mobile, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchEmployees()}
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:outline-none"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                Dept: {dept}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Role: All Roles</option>
            {lookups.roles.map((r) => (
              <option key={r.id} value={r.name}>
                Role: {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Status: All</option>
            {EMPLOYEE_STATUSES.map((st) => (
              <option key={st} value={st}>
                Status: {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Workforce Registry</h3>
            <p className="text-xs text-slate-500">
              Assigned system roles, biometric terminal user IDs, salary structures, and reporting hierarchy.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {employees.length} Records
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading employee registry...</div>
        ) : employees.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No Employees Found</div>
            <p className="text-xs text-slate-400">Try adjusting your filters or click &quot;Onboard New Employee&quot; above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">Employee Profile</th>
                  <th className="py-4 px-6">Department & Role</th>
                  <th className="py-4 px-6">Salary Structure & Base</th>
                  <th className="py-4 px-6">Shift & Supervisor</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#a92427]/10 text-[#a92427] font-black flex items-center justify-center text-sm uppercase">
                          {emp.name ? emp.name.charAt(0) : 'E'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{emp.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{emp.employeeCode || `EMP-${emp.deviceUserId}`}</span>
                            <span>•</span>
                            <span className="text-slate-600">{emp.mobileNumber}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800">{emp.department}</div>
                      <div className="text-[11px] text-slate-500">{emp.designation}</div>
                      <div className="mt-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {emp.roleName || 'EMPLOYEE'}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900">
                        {emp.salaryStructureName || 'Standard Full-Time (FTE)'}
                      </div>
                      <div className="font-mono text-slate-600 text-[11px] mt-0.5">
                        Base: <strong className="text-emerald-700">₹{(emp.baseSalary || 30000).toLocaleString('en-IN')}</strong> / mo
                      </div>
                      <div className="font-mono text-slate-400 text-[10px]">
                        CTC: ₹{(emp.ctcAmount || emp.baseSalary * 12 || 360000).toLocaleString('en-IN')} / yr
                      </div>
                    </td>

                    <td className="py-4 px-6 text-slate-600">
                      <div>
                        Shift: <span className="font-semibold text-slate-800">{emp.workShift || 'Day'}</span> ({emp.expectedWorkHours || 8}h)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Manager: <span className="text-slate-600">{emp.managerName || 'None (Direct Admin)'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      {emp.status === 'ACTIVE' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                      {emp.status === 'PROBATION' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Probation
                        </span>
                      )}
                      {emp.status === 'INACTIVE' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Inactive
                        </span>
                      )}
                      {emp.status === 'SUSPENDED' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Suspended
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1 transition"
                          title="View 6-module profile summary"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {canManage && (
                          <button
                            onClick={() => handleOpenEditModal(emp)}
                            className="px-2.5 py-1 rounded-lg text-[#a92427] hover:bg-[#a92427]/10 border border-[#a92427]/20 text-xs font-semibold flex items-center gap-1 transition"
                            title="Edit full 6-module profile"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}

                        {canManage && (
                          <button
                            onClick={() => {
                              setResettingEmployee(emp);
                              setResetCustomPassword('');
                              setResetResult(null);
                            }}
                            className="px-2.5 py-1 rounded-lg text-amber-700 hover:bg-amber-50 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition"
                            title="Reset employee login credentials"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset Key</span>
                          </button>
                        )}

                        {canManage && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6-MODULE ONBOARDING & EDIT MODAL */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-5 animate-scaleUp text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#a92427]" />
                  <span>{isEditing ? `Edit Profile: ${form.name}` : 'Onboard New Employee (6-Module Architecture)'}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Configure primary identity, demographics, employment details, qualifications, RBAC role, and compensation package.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 6-Tab Navigator */}
            <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
              {[
                { id: 1, label: '1. Primary Details', icon: User },
                { id: 2, label: '2. Personal Details', icon: HeartPulse },
                { id: 3, label: '3. Professional Details', icon: Briefcase },
                { id: 4, label: '4. Qualifications & Exp', icon: GraduationCap },
                { id: 5, label: '5. Role Assignment', icon: Shield },
                { id: 6, label: '6. Payroll & Salary', icon: DollarSign },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModalTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    modalTab === tab.id
                      ? 'bg-[#a92427] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ============================================================= */}
              {/* TAB 1: PRIMARY DETAILS */}
              {/* ============================================================= */}
              {modalTab === 1 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Ramesh Kumar"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Employee Code *</label>
                      <input
                        type="text"
                        value={form.employeeCode}
                        onChange={(e) => setForm({ ...form, employeeCode: e.target.value.toUpperCase() })}
                        placeholder="e.g. EMP-101"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Department</label>
                      <select
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                      >
                        {DEPARTMENTS.filter((d) => d !== 'ALL').map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Designation</label>
                      <input
                        type="text"
                        value={form.designation}
                        onChange={(e) => setForm({ ...form, designation: e.target.value })}
                        placeholder="e.g. Senior Software Engineer"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Employment Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                      >
                        {EMPLOYEE_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Biometric Terminal User ID</label>
                      <input
                        type="text"
                        value={form.deviceUserId}
                        onChange={(e) => setForm({ ...form, deviceUserId: e.target.value })}
                        placeholder="e.g. 101"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                        title="Unique hardware biometric slot identifier"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 2: PERSONAL DETAILS */}
              {/* ============================================================= */}
              {modalTab === 2 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Gender</label>
                      <select
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        {GENDERS.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Blood Group</label>
                      <select
                        value={form.bloodGroup}
                        onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      >
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Marital Status</label>
                      <select
                        value={form.maritalStatus}
                        onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        {MARITAL_STATUSES.map((ms) => (
                          <option key={ms} value={ms}>{ms}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Aadhaar Number</label>
                      <input
                        type="text"
                        value={form.aadhaarNumber}
                        onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })}
                        placeholder="12-digit UID"
                        maxLength={14}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">PAN Card Number</label>
                      <input
                        type="text"
                        value={form.panNumber}
                        onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                        placeholder="e.g. ABCDE1234F"
                        maxLength={10}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Residential Address</label>
                    <textarea
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Street, City, State, PIN Code"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                    />
                  </div>

                  {/* Emergency Contact */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 text-[11px] block">Emergency Contact Information</span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Contact Name</label>
                        <input
                          type="text"
                          value={form.emergencyContactName}
                          onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                          placeholder="Contact person"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={form.emergencyContactPhone}
                          onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                          placeholder="+91..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Relationship</label>
                        <input
                          type="text"
                          value={form.emergencyContactRelation}
                          onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                          placeholder="e.g. Spouse / Parent"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 3: PROFESSIONAL & EMPLOYMENT DETAILS */}
              {/* ============================================================= */}
              {modalTab === 3 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Date of Joining</label>
                      <input
                        type="date"
                        value={form.dateOfJoining}
                        onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Probation Period (Months)</label>
                      <input
                        type="number"
                        value={form.probationPeriod}
                        onChange={(e) => setForm({ ...form, probationPeriod: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Work Shift</label>
                      <select
                        value={form.workShift}
                        onChange={(e) => setForm({ ...form, workShift: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        {WORK_SHIFTS.map((s) => (
                          <option key={s} value={s}>{s} Shift</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Reporting Supervisor / Manager</label>
                      <select
                        value={form.managerId}
                        onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <option value="">None (Reports to HR Admin / Super Admin)</option>
                        {lookups.managers
                          .filter((m) => m.id !== form.id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.employeeCode}) - {m.designation}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Expected Daily Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        value={form.expectedWorkHours}
                        onChange={(e) => setForm({ ...form, expectedWorkHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Official Mobile Number * (Login)</label>
                      <input
                        type="tel"
                        value={form.mobileNumber}
                        onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
                        placeholder="10-digit mobile number"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Corporate Work Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="name@company.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 4: QUALIFICATIONS & EXPERIENCE */}
              {/* ============================================================= */}
              {modalTab === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Qualifications */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-[#a92427]" />
                        <span>Academic Qualifications & Degrees</span>
                      </span>
                      <button
                        type="button"
                        onClick={addQualification}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Degree</span>
                      </button>
                    </div>

                    {form.qualifications.map((q: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-4 gap-2 items-center">
                        <input
                          type="text"
                          value={q.degree}
                          onChange={(e) => {
                            const copy = [...form.qualifications];
                            copy[idx].degree = e.target.value;
                            setForm({ ...form, qualifications: copy });
                          }}
                          placeholder="Degree (e.g. B.Tech)"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-medium"
                        />
                        <input
                          type="text"
                          value={q.institution}
                          onChange={(e) => {
                            const copy = [...form.qualifications];
                            copy[idx].institution = e.target.value;
                            setForm({ ...form, qualifications: copy });
                          }}
                          placeholder="University / College"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200"
                        />
                        <input
                          type="text"
                          value={q.year}
                          onChange={(e) => {
                            const copy = [...form.qualifications];
                            copy[idx].year = e.target.value;
                            setForm({ ...form, qualifications: copy });
                          }}
                          placeholder="Year (e.g. 2023)"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={q.score}
                            onChange={(e) => {
                              const copy = [...form.qualifications];
                              copy[idx].score = e.target.value;
                              setForm({ ...form, qualifications: copy });
                            }}
                            placeholder="CGPA / %"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeQualification(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Experience */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-purple-600" />
                        <span>Prior Professional Experience</span>
                      </span>
                      <button
                        type="button"
                        onClick={addExperience}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Company</span>
                      </button>
                    </div>

                    {form.experience.map((exp: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-4 gap-2 items-center">
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => {
                            const copy = [...form.experience];
                            copy[idx].company = e.target.value;
                            setForm({ ...form, experience: copy });
                          }}
                          placeholder="Previous Company"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-medium"
                        />
                        <input
                          type="text"
                          value={exp.designation}
                          onChange={(e) => {
                            const copy = [...form.experience];
                            copy[idx].designation = e.target.value;
                            setForm({ ...form, experience: copy });
                          }}
                          placeholder="Role / Title"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200"
                        />
                        <input
                          type="text"
                          value={exp.from}
                          onChange={(e) => {
                            const copy = [...form.experience];
                            copy[idx].from = e.target.value;
                            setForm({ ...form, experience: copy });
                          }}
                          placeholder="Period (e.g. 2021-2023)"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={exp.years}
                            onChange={(e) => {
                              const copy = [...form.experience];
                              copy[idx].years = Number(e.target.value);
                              setForm({ ...form, experience: copy });
                            }}
                            placeholder="Years"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeExperience(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 5: ROLE ASSIGNMENT & RBAC */}
              {/* ============================================================= */}
              {modalTab === 5 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div>
                      <label className="block font-bold text-slate-900 mb-1">Assigned Security Role *</label>
                      <select
                        value={form.roleId}
                        onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                        required
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-900 focus:outline-none"
                      >
                        {lookups.roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} - {r.description || 'System Role'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-1">
                      <p>
                        Role dictates login privileges across Employee Directory, Attendance regularizations, Leave Approvals, and Payroll.
                      </p>
                      <div className="flex items-center gap-2 text-emerald-700 font-semibold pt-1">
                        <Shield className="w-4 h-4 shrink-0" />
                        <span>Passkey hardware biometric MFA is supported on all roles.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 6: PAYROLL DETAILS & SALARY STRUCTURE */}
              {/* ============================================================= */}
              {modalTab === 6 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block font-bold text-slate-700 mb-1">Salary Structure Package *</label>
                      <select
                        value={form.salaryStructureId}
                        onChange={(e) => {
                          setForm({ ...form, salaryStructureId: e.target.value });
                          runSalaryPreview(e.target.value, form.baseSalary);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
                      >
                        {lookups.salaryStructures.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code || 'CTC'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Monthly Base Salary (₹) *</label>
                      <input
                        type="number"
                        value={form.baseSalary}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setForm({ ...form, baseSalary: val, ctcAmount: val * 12 });
                          runSalaryPreview(form.salaryStructureId, val);
                        }}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Annual CTC (₹)</label>
                      <input
                        type="number"
                        value={form.ctcAmount}
                        onChange={(e) => setForm({ ...form, ctcAmount: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="font-bold text-slate-800 text-[11px] block">Direct Bank Disbursement Account</span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={form.bankName}
                          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                          placeholder="e.g. HDFC Bank"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={form.bankAccountNo}
                          onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                          placeholder="Account #"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">IFSC Code</label>
                        <input
                          type="text"
                          value={form.bankIfsc}
                          onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })}
                          placeholder="HDFC0001234"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Formula Preview Card */}
                  {salaryPreview && (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between font-bold text-emerald-950 text-xs border-b border-emerald-200 pb-1">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Live Mathematical Formula Evaluation for Assigned Structure</span>
                        </span>
                        <span className="font-mono text-emerald-800">
                          {previewLoading ? 'Evaluating...' : `Gross: ₹${salaryPreview.grossSalary.toLocaleString('en-IN')}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <span className="text-emerald-800 font-semibold block mb-0.5">Calculated Earnings:</span>
                          <div className="space-y-0.5 font-mono text-slate-700">
                            {salaryPreview.earnings?.map((e: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span>{e.name}:</span>
                                <strong>₹{(e.amount || 0).toLocaleString('en-IN')}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-rose-800 font-semibold block mb-0.5">Statutory Deductions:</span>
                          <div className="space-y-0.5 font-mono text-slate-700">
                            <div className="flex justify-between">
                              <span>PF (12% capped at ₹15k):</span>
                              <strong>-₹{(salaryPreview.statutoryDeductions?.pfEmployee || 0).toLocaleString('en-IN')}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>ESIC (0.75% ceiling ₹21k):</span>
                              <strong>-₹{(salaryPreview.statutoryDeductions?.esicEmployee || 0).toLocaleString('en-IN')}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Professional Tax (PT):</span>
                              <strong>-₹{(salaryPreview.statutoryDeductions?.professionalTax || 0).toLocaleString('en-IN')}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-200 flex justify-between items-center text-xs font-bold text-emerald-950">
                        <span>Net Take-Home Salary:</span>
                        <span className="font-mono text-base text-emerald-800">
                          ₹{salaryPreview.netSalary.toLocaleString('en-IN')} <span className="text-[10px] font-sans font-normal">/ month</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-slate-400 text-[11px]">
                  Configuring Module {modalTab} of 6
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold shadow-xs transition disabled:opacity-50"
                  >
                    {submitting ? 'Saving Profile...' : isEditing ? 'Update Employee Profile' : 'Complete Onboarding'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW PROFILE MODAL */}
      {/* ========================================================================= */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-8 shadow-2xl space-y-5 animate-scaleUp text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#a92427] text-white font-black flex items-center justify-center text-lg uppercase">
                  {viewingEmployee.name ? viewingEmployee.name.charAt(0) : 'E'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingEmployee.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {viewingEmployee.employeeCode} • {viewingEmployee.designation} ({viewingEmployee.department})
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingEmployee(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Grid */}
            <div className="space-y-4">
              {/* Primary & Professional */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs block border-b pb-1">Employment & Primary Info</span>
                <div className="grid grid-cols-3 gap-2 text-slate-600">
                  <div>Status: <strong className="text-slate-900">{viewingEmployee.status}</strong></div>
                  <div>Shift: <strong className="text-slate-900">{viewingEmployee.workShift || 'Day'} ({viewingEmployee.expectedWorkHours || 8}h)</strong></div>
                  <div>Joined: <strong className="font-mono text-slate-900">{viewingEmployee.dateOfJoining ? viewingEmployee.dateOfJoining.split('T')[0] : 'N/A'}</strong></div>
                  <div>Mobile: <strong className="font-mono text-slate-900">{viewingEmployee.mobileNumber}</strong></div>
                  <div>Email: <strong className="text-slate-900">{viewingEmployee.email}</strong></div>
                  <div>Terminal ID: <strong className="font-mono text-slate-900">{viewingEmployee.deviceUserId}</strong></div>
                </div>
              </div>

              {/* Personal */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs block border-b pb-1">Personal Demographics</span>
                <div className="grid grid-cols-3 gap-2 text-slate-600">
                  <div>Gender: <strong className="text-slate-900">{viewingEmployee.gender || 'N/A'}</strong></div>
                  <div>Blood Group: <strong className="text-slate-900">{viewingEmployee.bloodGroup || 'N/A'}</strong></div>
                  <div>Marital: <strong className="text-slate-900">{viewingEmployee.maritalStatus || 'Single'}</strong></div>
                  <div>DOB: <strong className="font-mono text-slate-900">{viewingEmployee.dateOfBirth ? viewingEmployee.dateOfBirth.split('T')[0] : 'N/A'}</strong></div>
                  <div>Aadhaar: <strong className="font-mono text-slate-900">{viewingEmployee.aadhaarNumber || 'N/A'}</strong></div>
                  <div>PAN: <strong className="font-mono text-slate-900">{viewingEmployee.panNumber || 'N/A'}</strong></div>
                </div>
                {viewingEmployee.address && (
                  <div className="text-[11px] text-slate-500 pt-1">
                    Address: <span className="text-slate-800">{viewingEmployee.address}</span>
                  </div>
                )}
              </div>

              {/* Compensation & Structure */}
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
                <span className="font-bold text-emerald-950 text-xs block border-b border-emerald-200 pb-1">
                  Salary Structure & Bank Details
                </span>
                <div className="grid grid-cols-2 gap-2 text-emerald-900">
                  <div>Structure: <strong>{viewingEmployee.salaryStructureName || 'Standard Full-Time (FTE)'}</strong></div>
                  <div>Base Pay: <strong className="font-mono">₹{(viewingEmployee.baseSalary || 30000).toLocaleString('en-IN')} / mo</strong></div>
                  <div>Annual CTC: <strong className="font-mono">₹{(viewingEmployee.ctcAmount || viewingEmployee.baseSalary * 12 || 360000).toLocaleString('en-IN')}</strong></div>
                  <div>Bank: <strong className="text-slate-800">{viewingEmployee.bankName || 'HDFC Bank'}</strong></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingEmployee(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN PASSWORD RESET LIGHTBOX MODAL */}
      {/* ========================================================================= */}
      {resettingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Reset Account Password</h3>
                  <p className="text-[11px] text-slate-400">Target: {resettingEmployee.name} ({resettingEmployee.mobileNumber})</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setResettingEmployee(null);
                  setResetResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!resetResult ? (
              <form onSubmit={handleExecuteResetPassword} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Custom Password (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty to auto-generate secure temp password"
                    value={resetCustomPassword}
                    onChange={(e) => setResetCustomPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    If left blank, system generates a random temporary password (e.g. <code>Temp@8492K</code>).
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chkForceChange"
                    checked={resetForceChange}
                    onChange={(e) => setResetForceChange(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="chkForceChange" className="font-semibold text-slate-700 cursor-pointer">
                    Force employee to change password on next sign-in
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setResettingEmployee(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold shadow-sm shadow-amber-600/30 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {resetLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                    {resetLoading ? 'Resetting...' : 'Confirm Reset Password'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Reset success banner */}
                <div className="rounded-xl overflow-hidden border border-amber-200">
                  <div className="bg-amber-500 px-3 py-1.5 flex items-center gap-2">
                    <span className="text-white font-bold text-[10px] uppercase tracking-widest">⚠ Password Reset Notice</span>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-800 text-[11px] leading-relaxed">
                    This replaces the employee&apos;s previous password. Download or copy and share directly with the employee.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Password Reset Successful!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Share these updated login credentials with <strong>{resetResult.userName}</strong>:
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Mobile (Login):</span>
                    <strong className="text-slate-900">{resetResult.mobileNumber}</strong>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px] items-center pt-1.5 border-t border-slate-200">
                    <span>New Password:</span>
                    <div className="flex items-center gap-2">
                      <strong className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs tracking-wider">
                        {resetResult.temporaryPassword}
                      </strong>
                      <button
                        onClick={handleCopyResetPassword}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition"
                      >
                        {copiedResetPass ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedResetPass ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleDownloadResetPDF}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    style={{background:'linear-gradient(135deg,#f59e0b,#b45309)',color:'#fff',boxShadow:'0 4px 14px rgba(245,158,11,0.35)'}}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                  <button
                    onClick={() => {
                      setResettingEmployee(null);
                      setResetResult(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATED CREDENTIALS MODAL */}
      {createdCredentials && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" style={{animation:'fadeIn 0.2s ease'}}>
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" style={{animation:'scaleUp 0.25s cubic-bezier(0.16,1,0.3,1)'}}>

            {/* Header */}
            <div className="bg-gradient-to-br from-[#0b1322] to-[#0d1c35] px-8 pt-8 pb-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#e11d48] opacity-10 translate-x-8 -translate-y-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-[#e11d48] opacity-5 -translate-x-4 translate-y-4" />
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center mb-3 relative">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Employee Onboarded!</h3>
              <p className="text-xs text-slate-400 mt-1">Temporary login credentials have been created.</p>
              <p className="text-xs text-red-400 mt-1 font-medium">Download or copy before closing — not retrievable later.</p>
            </div>

            {/* Credential details */}
            <div className="px-8 py-5 space-y-2 text-xs">
              {[
                { label: 'Employee Name', value: createdCredentials.name, mono: false },
                { label: 'Employee Code', value: createdCredentials.employeeCode, mono: true },
                { label: 'Mobile (Username)', value: createdCredentials.mobileNumber, mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between items-center py-1">
                  <span className="text-slate-400">{label}:</span>
                  <span className={`font-bold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
                </div>
              ))}
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Temporary Password</span>
                  <button
                    onClick={handleCopyPassword}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
                  >
                    {copiedPass ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPass ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono font-bold text-rose-600 text-lg tracking-wider mt-1">
                  {createdCredentials.temporaryPassword}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-8 pb-6 flex gap-3">
              <button
                onClick={handleDownloadCredentialPDF}
                className="flex-1 py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2"
                style={{background:'linear-gradient(135deg,#e11d48,#9f1239)',color:'#fff',boxShadow:'0 4px 16px rgba(225,29,72,0.35)'}}
              >
                <FileDown className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={() => setCreatedCredentials(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
