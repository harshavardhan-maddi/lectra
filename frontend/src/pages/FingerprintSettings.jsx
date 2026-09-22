import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startRegistration } from '@simplewebauthn/browser';
import {
  Fingerprint,
  Trash2,
  ShieldCheck,
  Calendar,
  Lock,
  Check,
  X,
  Info,
  KeyRound,
  AlertTriangle
} from 'lucide-react';

const FingerprintSettings = () => {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Tabs State (driven by menu or default)
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || (user?.role === 'ABSENT_CONTROLLER' ? 'overrides' : 'security')
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    } else {
      setActiveTab(user?.role === 'ABSENT_CONTROLLER' ? 'overrides' : 'security');
    }
  }, [searchParams, user]);

  // Fingerprint Settings state
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(user?.role !== 'ABSENT_CONTROLLER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Security Verification Modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'register' | 'remove'

  // Attendance Overrides state
  const [overrides, setOverrides] = useState([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [overrideError, setOverrideError] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState('');
  const [overrideToggling, setOverrideToggling] = useState(null); // className

  const fetchSettings = async () => {
    if (user?.role === 'ABSENT_CONTROLLER') return;
    try {
      const res = await fetch('/api/auth/fingerprint/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch fingerprint settings');
      setSettings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverrides = async () => {
    setLoadingOverrides(true);
    setOverrideError('');
    try {
      const res = await fetch('/api/settings/cr-overrides', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOverrides(data);
      } else {
        setOverrideError(data.message || 'Failed to fetch CR overrides');
      }
    } catch (err) {
      setOverrideError('Failed to fetch overrides from backend');
    } finally {
      setLoadingOverrides(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'overrides') {
      fetchOverrides();
    }
  }, [activeTab]);

  const handleToggleFingerprint = async (newValue) => {
    try {
      const res = await fetch('/api/auth/fingerprint/toggle', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: newValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to toggle status');
      setSuccess(data.message);
      fetchSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleToggleOverride = async (className, currentGranted) => {
    setOverrideToggling(className);
    setOverrideError('');
    setOverrideSuccess('');
    try {
      const res = await fetch('/api/settings/cr-overrides/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          className,
          granted: !currentGranted
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOverrideSuccess(`Access ${!currentGranted ? 'granted' : 'revoked'} successfully for ${className}.`);
        fetchOverrides();
        setTimeout(() => setOverrideSuccess(''), 3000);
      } else {
        setOverrideError(data.message || 'Failed to toggle override status');
      }
    } catch (err) {
      setOverrideError('Network error toggling override');
    } finally {
      setOverrideToggling(null);
    }
  };

  const triggerVerify = async (action) => {
    if (action === 'register') {
      if (!window.PublicKeyCredential) {
        setError('Biometric authentication is not supported by your browser.');
        setTimeout(() => setError(''), 4000);
        return;
      }
      try {
        const isBiometricAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!isBiometricAvailable) {
          setError('Your device does not have a fingerprint sensor or platform biometric hardware. Registration cannot be performed on this device.');
          setTimeout(() => setError(''), 5000);
          return;
        }
      } catch (e) {
        setError('Failed to verify biometric hardware configuration.');
        setTimeout(() => setError(''), 4000);
        return;
      }
    }

    setVerifyPassword('');
    setVerifyError('');
    setPendingAction(action);
    setShowVerifyModal(true);
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setVerifyError('');
    setVerifySubmitting(true);

    try {
      if (pendingAction === 'remove') {
        const res = await fetch('/api/auth/fingerprint/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ password: verifyPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to remove fingerprint credentials');
        
        setSuccess(data.message);
        setShowVerifyModal(false);
        fetchSettings();
        setTimeout(() => setSuccess(''), 3000);
      } else if (pendingAction === 'register') {
        // Step 1: Request registration options from backend
        const resOptions = await fetch('/api/auth/fingerprint/register-options', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ password: verifyPassword })
        });
        const optionsData = await resOptions.json();
        if (!resOptions.ok) throw new Error(optionsData.message || 'Failed to generate registration options');

        // Step 2: Trigger WebAuthn biometrics prompt in browser
        let attestationResponse;
        try {
          attestationResponse = await startRegistration(optionsData);
        } catch (webauthnError) {
          console.error(webauthnError);
          if (webauthnError.name === 'NotAllowedError') {
            throw new Error('Biometric registration was cancelled or timed out. Please try again.');
          }
          throw new Error(`Device biometrics registration failed: ${webauthnError.message}`);
        }

        // Step 3: Verify registration response on backend
        const resVerify = await fetch('/api/auth/fingerprint/register-verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ response: attestationResponse })
        });
        const verifyData = await resVerify.json();
        if (!resVerify.ok) throw new Error(verifyData.message || 'Failed to verify fingerprint signature');

        setSuccess(verifyData.message);
        setShowVerifyModal(false);
        fetchSettings();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifySubmitting(false);
    }
  };

  if (loading && activeTab === 'security') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
        <p className="text-xs text-customText-muted">Loading fingerprint settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark tracking-tight">
          System Settings
        </h2>
        <p className="text-sm text-customText-muted dark:text-customText-mutedDark">
          Configure security credentials and temporary class attendance overrides
        </p>
      </div>

      {/* Active Section Header */}
      {user?.role !== 'ABSENT_CONTROLLER' && (
        <div className="flex items-center gap-3 py-2 no-print">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary-dark dark:text-primary font-bold text-sm border border-primary/20">
            {activeTab === 'security' ? <Fingerprint size={16} /> : <ShieldCheck size={16} />}
            <span>{activeTab === 'security' ? 'Fingerprint Security Module' : 'CR Attendance Overrides'}</span>
          </div>
        </div>
      )}

      {/* PANEL 1: FINGERPRINT SECURITY */}
      {activeTab === 'security' && (
        <>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl">
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-semibold rounded-xl">
              ✅ {success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Side: Status and Control panel */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40 space-y-6">
                <div>
                  <h3 className="font-extrabold text-base text-customText dark:text-customText-dark flex items-center gap-2">
                    <Fingerprint className="text-primary" size={20} />
                    <span>Fingerprint Settings</span>
                  </h3>
                  <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-0.5">
                    Set up device biometrics as your secure login method
                  </p>
                </div>

                {/* Status card */}
                <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/40 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                      Device Biometrics
                    </span>
                    {settings?.hasFingerprint ? (
                      <span className="text-[10px] font-extrabold uppercase bg-green-500/10 border border-green-500/20 text-green-600 px-2 py-0.5 rounded">
                        Registered
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-600 px-2 py-0.5 rounded">
                        Not Setup
                      </span>
                    )}
                  </div>

                  {/* Toggler */}
                  <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-3">
                    <span className="text-xs font-bold text-customText">
                      Enable Fingerprint Sign-In
                    </span>
                    <button
                      type="button"
                      disabled={!settings?.hasFingerprint}
                      onClick={() => handleToggleFingerprint(!settings?.fingerprintEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        settings?.fingerprintEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                      } ${!settings?.hasFingerprint ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings?.fingerprintEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Actions panel */}
                <div className="space-y-3">
                  {!settings?.hasFingerprint ? (
                    <button
                      onClick={() => triggerVerify('register')}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl shadow transition-all active:scale-[0.98]"
                    >
                      <Fingerprint size={16} />
                      <span>Register Fingerprint</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => triggerVerify('register')}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-primary/20 hover:bg-primary/5 text-primary text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                      >
                        <Fingerprint size={16} />
                        <span>Register New Fingerprint</span>
                      </button>
                      <button
                        onClick={() => triggerVerify('remove')}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-red-500/20 hover:bg-red-500/5 text-red-500 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                      >
                        <Trash2 size={16} />
                        <span>Remove Fingerprint</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Privacy Policy Box */}
              <div className="glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 space-y-3 bg-blue-500/5 border-blue-500/10 text-xs">
                <h4 className="font-bold text-customText flex items-center gap-1.5">
                  <Info size={14} className="text-primary-dark" />
                  <span>Security & Privacy Policy</span>
                </h4>
                <ul className="space-y-2 text-customText-muted dark:text-customText-mutedDark leading-relaxed pl-1.5 list-disc list-inside">
                  <li>WebAuthn uses standard browser-native device biometrics.</li>
                  <li>Your fingerprint image never leaves your local device.</li>
                  <li>Verification happens directly in the secure enclave of your processor.</li>
                  <li>The server only receives a cryptographic public key and signature.</li>
                </ul>
              </div>
            </div>

            {/* Right Side: Log audits and information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Metadata Card */}
              {settings?.hasFingerprint && (
                <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40 space-y-4">
                  <h3 className="font-extrabold text-sm text-customText dark:text-customText-dark uppercase tracking-wider border-b pb-2">
                    Credential Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-customText-muted dark:text-customText-mutedDark font-medium flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        <span>Registered Date</span>
                      </span>
                      <span className="font-bold text-customText">
                        {settings?.fingerprintRegisteredAt ? new Date(settings.fingerprintRegisteredAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-customText-muted dark:text-customText-mutedDark font-medium flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-slate-400" />
                        <span>Security Standard</span>
                      </span>
                      <span className="font-bold text-green-600 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                        FIDO2 / WebAuthn
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Logs Table */}
              <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40">
                <h3 className="font-extrabold text-sm text-customText dark:text-customText-dark uppercase tracking-wider mb-4">
                  Biometric Audit Logs
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs leading-normal">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-customText-muted dark:text-customText-mutedDark font-bold uppercase tracking-wider">
                        <th className="pb-3 pl-1">Action</th>
                        <th className="pb-3">Details</th>
                        <th className="pb-3">IP Address</th>
                        <th className="pb-3 text-right pr-1">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {settings?.auditLogs?.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-6 text-customText-muted dark:text-customText-mutedDark">
                            No biometric operations logged.
                          </td>
                        </tr>
                      ) : (
                        settings?.auditLogs?.map((log) => (
                          <tr key={log.id} className="text-customText dark:text-customText-dark font-medium">
                            <td className="py-3 pl-1">
                              <span className={`inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-extrabold uppercase ${
                                log.action === 'REGISTRATION' || log.action === 'LOGIN_SUCCESS' || log.action === 'TOGGLE_ON'
                                  ? 'bg-green-500/10 text-green-600'
                                  : log.action === 'REMOVAL' || log.action === 'LOGIN_FAILURE' || log.action === 'TOGGLE_OFF'
                                    ? 'bg-red-500/10 text-red-500'
                                    : 'bg-blue-500/10 text-blue-500'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 text-customText-muted dark:text-customText-mutedDark max-w-[250px] truncate" title={log.details}>
                              {log.details}
                            </td>
                            <td className="py-3 text-slate-400 dark:text-slate-500">
                              {log.ipAddress}
                            </td>
                            <td className="py-3 text-right text-slate-500 pr-1">
                              {new Date(log.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* PANEL 2: CR ATTENDANCE OVERRIDES */}
      {activeTab === 'overrides' && (
        <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40 space-y-6 animate-fade-in">
          <div>
            <h3 className="font-extrabold text-base text-customText dark:text-customText-dark flex items-center gap-2">
              <ShieldCheck className="text-primary" size={20} />
              <span>CR Attendance Overrides</span>
            </h3>
            <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-0.5">
              Grant single-day attendance submission bypass to specific CRs outside regular hours
            </p>
          </div>

          {overrideError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl">
              ⚠️ {overrideError}
            </div>
          )}
          {overrideSuccess && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-semibold rounded-xl">
              ✅ {overrideSuccess}
            </div>
          )}

          {loadingOverrides ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
              <p className="text-xs text-slate-500">Loading overrides registry...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
              {overrides.map((override) => (
                <div
                  key={override.className}
                  className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-40 ${
                    override.granted
                      ? 'bg-emerald-500/5 border-emerald-500/25 shadow-emerald-500/5'
                      : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/40 dark:border-slate-800/40'
                  }`}
                >
                  <div>
                    <h4 className="font-extrabold text-sm text-customText dark:text-customText-dark">
                      {override.className}
                    </h4>
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold">
                      {override.granted ? (
                        <span className="text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check size={10} />
                          ACCESS GRANTED (TODAY)
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded flex items-center gap-1">
                          <X size={10} />
                          NO ACTIVE OVERRIDE
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleOverride(override.className, override.granted)}
                    disabled={overrideToggling === override.className}
                    className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                      override.granted
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/10'
                        : 'bg-primary-dark hover:bg-primary text-white shadow-md shadow-primary-dark/10'
                    }`}
                  >
                    {overrideToggling === override.className
                      ? 'Updating access...'
                      : override.granted
                      ? 'Revoke Access'
                      : 'Grant Daily Access'}
                  </button>
                </div>
              ))}

              {overrides.length === 0 && (
                <div className="col-span-full text-center py-12 text-xs text-customText-muted">
                  No classrooms or CR classes registered.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Security Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowVerifyModal(false)} />
          
          <form 
            onSubmit={handleVerifySubmit}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-sm p-6 shadow-2xl z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark flex items-center gap-1.5">
                <KeyRound size={18} className="text-primary-dark" />
                <span>Security Verification</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowVerifyModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-customText-muted leading-relaxed">
              Please verify your account password before modifying your biometric credentials.
            </p>

            {verifyError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                ⚠️ {verifyError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                Account Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-customText-muted dark:text-customText-mutedDark">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={verifyPassword}
                  onChange={(e) => setVerifyPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="glass-input pl-9 text-xs"
                  disabled={verifySubmitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowVerifyModal(false)} 
                className="btn-secondary text-xs px-4 py-2"
                disabled={verifySubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary text-xs px-4 py-2"
                disabled={verifySubmitting}
              >
                {verifySubmitting ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default FingerprintSettings;
