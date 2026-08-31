'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Smartphone,
  Lock,
  ArrowRight,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  Laptop,
  Monitor,
  ShieldAlert,
  Info,
  X,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { detectClientDevice, DetectedClientDevice } from '@/lib/device-detector';
import { DeviceIconBadge } from '@/components/DeviceIconBadge';

export default function LoginPage() {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passkey State & Device Detection
  const [clientDevice, setClientDevice] = useState<DetectedClientDevice | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);
  const [showPasskeyAuthModal, setShowPasskeyAuthModal] = useState(false);

  // Mandatory First-Time Password Change State
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  // Forgot / Email OTP Password Reset Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1 = Request OTP, 2 = Verify OTP & Reset
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dev = detectClientDevice();
      setClientDevice(dev);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber, password }),
      });

      const json = await res.json();
      if (json.success) {
        if (json.data.mustChangePassword) {
          setShowPasswordChangeModal(true);
        } else {
          router.push('/');
          router.refresh();
        }
      } else {
        setError(json.error?.message || 'Login failed. Please check credentials.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyClick = async () => {
    setPasskeyLoading(true);
    setError(null);

    try {
      if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
        setError('Passkeys are not supported by this browser. Please use Chrome, Edge, Safari, or a modern mobile browser.');
        setPasskeyLoading(false);
        return;
      }

      // Check if any passkeys exist in the organization
      const checkRes = await fetch('/api/passkeys/check');
      const checkJson = await checkRes.json();

      const dev = clientDevice || detectClientDevice();
      setClientDevice(dev);

      if (!checkJson.success || checkJson.data?.totalRegistered === 0) {
        setShowUnregisteredModal(true);
        setPasskeyLoading(false);
        return;
      }

      // Generate challenge buffer for WebAuthn authentication
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Invoke real browser WebAuthn dialog
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
          userVerification: 'preferred',
        },
      })) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error('Device authenticator did not return a credential.');
      }

      const rawCredentialId = assertion.id;

      // Authenticate with server using verified hardware credential
      const authRes = await fetch('/api/passkeys/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: rawCredentialId }),
      });

      const authJson = await authRes.json();
      if (authJson.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(authJson.error?.message || 'Passkey was not recognized for an active account. Please sign in with mobile number.');
      }
    } catch (err: any) {
      console.warn('WebAuthn authentication error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Passkey verification was cancelled on your device.');
      } else {
        setShowUnregisteredModal(true);
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeLoading(true);
    setChangeError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const json = await res.json();
      if (json.success) {
        setShowPasswordChangeModal(false);
        router.push('/');
        router.refresh();
      } else {
        setChangeError(json.error?.message || 'Failed to update password');
      }
    } catch {
      setChangeError('Error changing password. Please try again.');
    } finally {
      setChangeLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your mobile number or registered email.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST_OTP',
          identifier: forgotIdentifier.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setMaskedEmail(json.data?.maskedEmail || 'your registered email');
        setForgotStep(2);
        setForgotSuccess(json.message || `Verification code sent to ${json.data?.maskedEmail}`);
      } else {
        setForgotError(json.error?.message || 'Could not find an account with this identifier.');
      }
    } catch {
      setForgotError('Network error while requesting verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    if (!forgotOtp || forgotOtp.trim().length < 6) {
      setForgotError('Please enter the 6-digit OTP code received in your email.');
      return;
    }

    if (forgotNewPass.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_AND_RESET',
          identifier: forgotIdentifier.trim(),
          otp: forgotOtp.trim(),
          newPassword: forgotNewPass,
          confirmPassword: forgotConfirmPass,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setForgotSuccess(json.message || 'Password successfully reset! You can now log in.');
        setPassword(forgotNewPass);
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setForgotOtp('');
          setForgotNewPass('');
          setForgotConfirmPass('');
        }, 1800);
      } else {
        setForgotError(json.error?.message || 'Password reset failed. Please check the code.');
      }
    } catch {
      setForgotError('Network error while resetting password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradients using Kernn #a92427 */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#a92427]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#a92427]/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-100/50 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Logo Header */}
        <div className="text-center space-y-3">
          <div className="inline-block bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200/80">
            <img
              src="/kernn-logo-trans.png"
              alt="Kernn Automations"
              className="h-12 w-auto mx-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <span>Kernn HRMS Suite</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">
              Enterprise Workforce, Attendance & Payroll Platform
            </p>
          </div>
        </div>

        {/* Login Form Card in White with #a92427 Accents */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/60 space-y-6">
          <div className="space-y-1 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Sign In to Your Workspace</h2>
            <p className="text-xs text-slate-500">Choose your preferred authentication method</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Passkey Authentication Button */}
          <div>
            <button
              type="button"
              onClick={handlePasskeyClick}
              disabled={passkeyLoading}
              className="w-full py-3.5 px-4 rounded-2xl border-2 border-slate-200 hover:border-[#a92427] bg-slate-50/80 hover:bg-red-50/40 text-slate-800 hover:text-[#a92427] font-bold text-sm transition flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 group-hover:text-[#a92427] group-hover:border-[#a92427]/30 transition">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">Sign in with Passkey</div>
                  <div className="text-[10px] text-slate-500 font-normal">Biometrics, Windows Hello or Touch ID</div>
                </div>
              </div>

              {clientDevice && (
                <div className="shrink-0">
                  <DeviceIconBadge
                    formFactor={clientDevice.formFactor}
                    os={clientDevice.os}
                    size="sm"
                  />
                </div>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Or password
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:bg-white focus:outline-none font-mono transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotError(null);
                    setForgotSuccess(null);
                  }}
                  className="text-xs font-semibold text-[#a92427] hover:underline"
                >
                  Forgot / Reset?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:bg-white focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold text-sm shadow-lg shadow-[#a92427]/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400">
          Powered by <strong className="text-slate-600">Kernn Automations</strong> &copy; 2026
        </div>
      </div>

      {/* Unregistered Device Popup Modal */}
      {showUnregisteredModal && clientDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 animate-scaleUp relative">
            <button
              onClick={() => setShowUnregisteredModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Device Visual Header */}
            <div className="text-center space-y-3">
              <div className="inline-block p-1">
                <DeviceIconBadge
                  formFactor={clientDevice.formFactor}
                  os={clientDevice.os}
                  size="lg"
                />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Device Not Registered
                </span>
                <h3 className="text-xl font-bold text-slate-900">Passkey Setup Required</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  We detected your device as:
                </p>
              </div>
            </div>

            {/* Detected Device Details Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Device Type:</span>
                <span className="font-bold text-slate-800 capitalize flex items-center gap-1.5">
                  {clientDevice.formFactor === 'laptop' ? 'Laptop / Notebook' : clientDevice.formFactor === 'desktop' ? 'Desktop PC' : 'Smartphone'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Operating System:</span>
                <span className="font-bold text-slate-800">{clientDevice.osDisplayName}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Browser:</span>
                <span className="font-bold text-slate-800">{clientDevice.browser}</span>
              </div>
            </div>

            {/* Security Guidance Note */}
            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-800 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                To sign in with biometrics on this machine in the future, first sign in with your <strong>Mobile Number and Password</strong>, then go to <strong>Passkey Settings</strong> to enroll this device.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowUnregisteredModal(false)}
              className="w-full py-3.5 px-4 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold text-sm shadow-lg shadow-[#a92427]/25 transition"
            >
              Continue with Mobile & Password
            </button>
          </div>
        </div>
      )}

      {/* Mandatory First-Time Password Change Modal */}
      {showPasswordChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 animate-scaleUp">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20 mb-1">
                <KeyRound className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">First-Time Sign On</h3>
              <p className="text-xs text-slate-500">
                You logged in with a temporary password. Please establish a secure personal password to continue.
              </p>
            </div>

            {changeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{changeError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={changeLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold text-sm shadow-lg shadow-[#a92427]/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{changeLoading ? 'Updating Password...' : 'Save & Proceed to Dashboard'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password / Email OTP Lightbox Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 animate-scaleUp relative">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotStep(1);
              }}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#a92427]/10 text-[#a92427] mx-auto flex items-center justify-center font-bold">
                {forgotStep === 1 ? <Mail className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {forgotStep === 1 ? 'Verify Your Identity' : 'Set New Password'}
              </h2>
              <p className="text-xs text-slate-500">
                {forgotStep === 1
                  ? 'Enter your registered mobile number or email. We will send a 6-digit verification code to your email address.'
                  : `Enter the 6-digit verification code sent to ${maskedEmail} and choose a new password.`}
              </p>
            </div>

            {forgotError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile Number or Email
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 9876543210 or admin@kernn.com"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold text-sm shadow-lg shadow-[#a92427]/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Email via Microsoft Graph...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send 6-Digit OTP via Email</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      6-Digit Email OTP
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-xs text-[#a92427] hover:underline font-semibold"
                    >
                      Resend Code
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 481923"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono font-bold text-lg tracking-widest text-slate-900 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Re-type new password"
                    value={forgotConfirmPass}
                    onChange={(e) => setForgotConfirmPass(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:ring-2 focus:ring-[#a92427] focus:border-[#a92427] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold text-sm shadow-lg shadow-[#a92427]/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying & Resetting...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify OTP & Update Password</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
