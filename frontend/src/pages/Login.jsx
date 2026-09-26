import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startAuthentication } from '@simplewebauthn/browser';
import { 
  Eye, 
  EyeOff, 
  User, 
  Lock, 
  Fingerprint, 
  AlertTriangle, 
  X,
  LogIn,
  ArrowRight,
  FileText,
  CheckCircle2,
  Phone,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  Download,
  AlertCircle,
  RotateCcw,
  Check,
  Search,
  History
} from 'lucide-react';
import logo from '../neclogo.png';
import Loading from '../components/Loading';
import OutpassTicketModal from '../components/OutpassTicketModal';
import { 
  lookupStudentByRollAndName, 
  submitOutpassApplication, 
  getAllOutpasses,
  getStudentOutpassHistory,
  syncOutpassesFromBackend
} from '../services/outpassService';

const Login = () => {
  const { login, authenticateWithBiometrics } = useAuth();
  const navigate = useNavigate();

  // Landing Page vs Login Card view toggle
  const [viewMode, setViewMode] = useState('landing'); // 'landing' | 'login'

  // Staff Login Form states
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Biometrics states
  const [biometricsLoading, setBiometricsLoading] = useState(false);
  const [biometricsStatus, setBiometricsStatus] = useState('');
  const [showBiometricsModal, setShowBiometricsModal] = useState(false);
  const [modalError, setModalError] = useState('');

  // Intro loader states
  const [introVisible, setIntroVisible] = useState(true);
  const [introFadeOut, setIntroFadeOut] = useState(false);
  const [progressWidth, setProgressWidth] = useState('0%');

  // Direct Student Leave Application Flow states
  // Step 1: Enter Roll No -> Step 2: Show Verified Details & Enter Reason -> Step 3: Submitted / Live Ticket
  const [applyStep, setApplyStep] = useState(1);
  const [rollInput, setRollInput] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [outpassReason, setOutpassReason] = useState('');
  const [outpassDestination, setOutpassDestination] = useState('Home');
  const [isSubmittingOutpass, setIsSubmittingOutpass] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  
  // Active ticket for Ticket Modal viewer
  const [activeTicket, setActiveTicket] = useState(null);

  // Student Live Application Status & History Viewer States
  const [statusRollInput, setStatusRollInput] = useState('');
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);
  const [hasSearchedStatus, setHasSearchedStatus] = useState(false);
  const [statusTickets, setStatusTickets] = useState([]);
  const [statusError, setStatusError] = useState('');

  // Intro Animation
  useEffect(() => {
    const progressTimer = setTimeout(() => {
      setProgressWidth('100%');
    }, 50);

    const fadeTimer = setTimeout(() => {
      setIntroFadeOut(true);
    }, 2500);

    const unmountTimer = setTimeout(() => {
      setIntroVisible(false);
    }, 3200);

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  // Navigation router based on user role
  const routeUserByRole = (userProfile) => {
    if (userProfile.role === 'CR') {
      navigate('/cr-dashboard');
    } else if (userProfile.role === 'ABSENT_CONTROLLER') {
      navigate('/absent-controller');
    } else if (userProfile.role === 'FACULTY') {
      navigate('/faculty-dashboard');
    } else if (userProfile.role === 'WATCHMAN') {
      navigate('/watchman-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const loggedUser = await login(userId, password);
      routeUserByRole(loggedUser);
    } catch (err) {
      setError(err.message || 'Invalid User ID or password');
    } finally {
      setLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError('Biometric authentication is not supported by your browser. Please login using your User ID and Password.');
      return;
    }

    try {
      const isBiometricAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isBiometricAvailable) {
        setError('Your device does not have a fingerprint sensor. Please login using your User ID and Password.');
        return;
      }
    } catch (e) {
      setError('Failed to check biometric availability. Please login using your User ID and Password.');
      return;
    }

    setModalError('');
    setShowBiometricsModal(true);
  };

  const handleBiometricAuth = async () => {
    if (!window.PublicKeyCredential) {
      setModalError('Biometrics are not supported by your browser. Please login using your User ID and Password.');
      return;
    }

    try {
      const isBiometricAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isBiometricAvailable) {
        setModalError('Your device does not have a fingerprint sensor. Please login using your User ID and Password.');
        return;
      }
    } catch (e) {
      setModalError('Biometric sensor check failed. Please login using your User ID and Password.');
      return;
    }

    setBiometricsLoading(true);
    setBiometricsStatus('Requesting biometric options...');
    setModalError('');

    try {
      const resOptions = await fetch('/api/auth/fingerprint/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const optionsData = await resOptions.json();
      if (!resOptions.ok) {
        throw new Error(optionsData.message || 'Fingerprint biometrics not enabled');
      }

      setBiometricsStatus('Scan your fingerprint...');
      
      let assertionResponse;
      try {
        assertionResponse = await startAuthentication(optionsData);
      } catch (authError) {
        console.error(authError);
        if (authError.name === 'NotAllowedError') {
          throw new Error('No registered fingerprint was found on this device for this site, or the scan was cancelled. Please log in with your User ID and Password first, then enroll your fingerprint in Settings.');
        }
        throw new Error(`Biometric scan failed: ${authError.message}. Please log in with User ID and Password.`);
      }

      setBiometricsStatus('Verifying security signature...');

      const resVerify = await fetch('/api/auth/fingerprint/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          response: assertionResponse, 
          challenge: optionsData.challenge 
        })
      });
      const verifyData = await resVerify.json();
      if (!resVerify.ok) {
        throw new Error(verifyData.message || 'Fingerprint authentication failed');
      }

      authenticateWithBiometrics(verifyData.token, verifyData.user);
      setShowBiometricsModal(false);
      routeUserByRole(verifyData.user);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setBiometricsLoading(false);
      setBiometricsStatus('');
    }
  };

  useEffect(() => {
    if (showBiometricsModal) {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showBiometricsModal]);

  const [isVerifying, setIsVerifying] = useState(false);

  // Step 1: Look up and Fetch Student by Roll Number against HOD student registry
  const handleVerifyStudent = async (e) => {
    e.preventDefault();
    setVerifyError('');

    if (!rollInput.trim()) {
      setVerifyError('Please enter your College Roll Number.');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await lookupStudentByRollAndName(rollInput);
      if (!result.success) {
        setVerifyError(result.error);
        return;
      }

      setMatchedStudent(result.student);
      setApplyStep(2); // Proceed to Step 2: Show details & enter reason
    } catch (err) {
      setVerifyError(err.message || 'Error verifying with HOD student registry.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Confirm & Submit Application
  const handleSubmitOutpass = async (e) => {
    e.preventDefault();
    if (!outpassReason.trim()) {
      setVerifyError('Please state your reason for going out.');
      return;
    }

    setIsSubmittingOutpass(true);
    try {
      const newTicket = await submitOutpassApplication({
        rollNumber: matchedStudent.rollNumber,
        studentName: matchedStudent.name,
        section: matchedStudent.section,
        studentMobile: matchedStudent.studentMobile,
        parentMobile: matchedStudent.parentMobile,
        reason: outpassReason.trim(),
        destination: outpassDestination,
      });

      setSubmittedTicket(newTicket);
      setApplyStep(3);
      
      // Automatically open the Outpass Ticket modal without closing website
      setActiveTicket(newTicket);
    } catch (err) {
      setVerifyError(err.message || 'Failed to submit application');
    } finally {
      setIsSubmittingOutpass(false);
    }
  };

  // Reset form for a new leave request
  const handleResetApplication = () => {
    setMatchedStudent(null);
    setRollInput('');
    setOutpassReason('');
    setVerifyError('');
    setApplyStep(1);
    setSubmittedTicket(null);
  };

  // Check live application status and view student leave history
  const handleCheckApplicationStatus = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = statusRollInput.trim().toUpperCase();
    if (!clean) {
      setStatusError('Please enter your College Roll Number to check status.');
      return;
    }
    setStatusError('');
    setIsSearchingStatus(true);
    try {
      await syncOutpassesFromBackend();
      const history = getStudentOutpassHistory(clean);
      setStatusTickets(history);
      setHasSearchedStatus(true);
      if (history.length === 0) {
        setStatusError(`No leave applications found for Roll Number "${clean}".`);
      }
    } catch (err) {
      setStatusError('Failed to fetch status. Please check your connection.');
    } finally {
      setIsSearchingStatus(false);
    }
  };

  return (
    <>
      {/* 1. Intro Splash Screen */}
      {introVisible && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-customText dark:text-customText-dark select-none transition-all duration-700 ${
            introFadeOut ? 'opacity-0 scale-98 pointer-events-none' : 'opacity-100 scale-100'
          }`}
        >
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 dark:bg-primary-dark/5 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-secondary/10 dark:bg-secondary-dark/5 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          
          <div className="flex flex-col items-center max-w-lg px-6 text-center z-10">
            <div className="relative w-32 h-32 flex items-center justify-center mb-6">
              <div 
                className="absolute inset-0 rounded-full border-[3px] border-t-primary border-r-transparent border-b-secondary border-l-transparent animate-spin"
                style={{ animationDuration: '1.2s' }}
              />
              <div 
                className="absolute -inset-2 rounded-full border border-t-transparent border-r-secondary/40 border-b-transparent border-l-primary/40 animate-spin"
                style={{ animationDuration: '2.5s', animationDirection: 'reverse' }}
              />
              <img 
                src={logo} 
                alt="NEC Logo" 
                className="w-24 h-24 rounded-full object-contain shadow-2xl animate-pulse bg-white dark:bg-slate-900 p-1 border border-slate-200/50 dark:border-slate-800/50" 
                style={{ animationDuration: '2s' }}
              />
            </div>

            <h1 className="text-xs font-extrabold tracking-[0.35em] text-primary-dark dark:text-primary uppercase mb-2 animate-fade-in">
              Narasaraopeta Engineering College
            </h1>
            <h2 className="text-2xl font-extrabold tracking-tight text-customText dark:text-customText-dark mb-2">
              Lectra
            </h2>
            <p className="text-[10px] text-customText-muted dark:text-customText-mutedDark font-bold tracking-widest uppercase mb-8">
              Campus Gate Permission & Attendance Portal
            </p>

            <div className="w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative border border-slate-300/30 dark:border-slate-700/30">
              <div 
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-[2450ms] ease-out"
                style={{ width: progressWidth }}
              />
            </div>
          </div>
        </div>
      )}

      {loading && <Loading />}

      <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
        
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 dark:bg-primary-dark/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/10 dark:bg-secondary-dark/5 blur-3xl pointer-events-none" />

        {/* 2. Top Navigation Bar with Logo and Prominent Staff Login Button */}
        <header className="w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
          
          {/* Left Brand */}
          <div 
            onClick={() => setViewMode('landing')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-11 h-11 rounded-full overflow-hidden shadow-md bg-white p-0.5 border border-slate-200">
              <img src={logo} alt="NEC Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-primary-dark dark:text-primary leading-tight uppercase">
                Narasaraopeta Engineering College
              </h1>
              <p className="text-[11px] font-extrabold text-customText-muted dark:text-customText-mutedDark">
                Lectra • <span className="text-primary font-bold">Student Leave & Gate Clearance</span>
              </p>
            </div>
          </div>

          {/* Top Right: Prominent "Staff Login" button (Larger as requested) */}
          <div className="flex items-center gap-3">
            {viewMode === 'login' ? (
              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-customText dark:text-customText-dark text-xs sm:text-sm font-black shadow-sm transition-all cursor-pointer active:scale-95 border border-slate-200 dark:border-slate-700"
              >
                <FileText size={18} className="text-primary" />
                <span>Student Leave Portal</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary-dark text-white hover:opacity-95 text-sm sm:text-base font-black shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-105 transition-all cursor-pointer border border-primary/30 active:scale-95"
              >
                <LogIn size={19} />
                <span>Staff Login</span>
              </button>
            )}
          </div>
        </header>

        {/* 3. Main Body: Switch between Landing Box and Staff Login Card */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 z-10 w-full max-w-4xl mx-auto my-auto">
          
          {viewMode === 'landing' ? (
            <div className="w-full max-w-2xl space-y-6 flex flex-col items-center">
              
              {/* DIRECT APPLY LEAVE BOX ON LANDING PAGE */}
              <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 animate-fade-in space-y-6 my-auto relative">
              
              {/* Box Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-customText dark:text-customText-dark tracking-tight">
                      Apply Leave / Permission to Go Out
                    </h2>
                    <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                      {applyStep === 1 && 'Enter your roll number to fetch student particulars.'}
                      {applyStep === 2 && 'Review verified details and provide your reason for leaving campus.'}
                      {applyStep === 3 && 'Outpass request submitted successfully.'}
                    </p>
                  </div>
                </div>

                {applyStep > 1 && (
                  <button
                    type="button"
                    onClick={handleResetApplication}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-customText-muted transition-colors cursor-pointer"
                    title="Start fresh"
                  >
                    <RotateCcw size={14} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Error banner */}
              {verifyError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-pulse">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* STEP 1: Enter Roll Number to Fetch Details */}
              {applyStep === 1 && (
                <form onSubmit={handleVerifyStudent} className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                        Student Roll Number *
                      </label>
                      <input
                        type="text"
                        value={rollInput}
                        onChange={(e) => {
                          setRollInput(e.target.value.toUpperCase());
                          if (verifyError) setVerifyError('');
                        }}
                        placeholder="e.g. 21NE1A0501"
                        className="glass-input text-sm font-mono uppercase tracking-wider py-3"
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full btn-primary py-3.5 text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    {isVerifying ? (
                      <div className="flex items-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                        <span>Fetching Student Details...</span>
                      </div>
                    ) : (
                      <>
                        <span>Fetch Student Details</span>
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: Show Matched Details (Last 4 Digits Only, Non-Modifiable) & Enter Reason */}
              {applyStep === 2 && matchedStudent && (
                <form onSubmit={handleSubmitOutpass} className="space-y-5">
                  
                  {/* Verified Student Details Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                        Matched Student Details (Verified Record)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20 flex items-center gap-1">
                        <Check size={12} />
                        <span>Verified by HOD Registry</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-customText-muted uppercase block mb-0.5">
                          Student Full Name
                        </span>
                        <p className="font-black text-sm text-customText dark:text-customText-dark">
                          {matchedStudent.name}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-customText-muted uppercase block mb-0.5">
                          Roll Number
                        </span>
                        <p className="font-mono font-black text-sm text-primary">
                          {matchedStudent.rollNumber}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-customText-muted uppercase block mb-0.5">
                          Section Name
                        </span>
                        <p className="font-extrabold text-customText dark:text-customText-dark">
                          {matchedStudent.section}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-customText-muted uppercase block mb-0.5">
                          Student Mobile Number (Last 4 Digits)
                        </span>
                        <p className="font-mono font-bold text-customText dark:text-customText-dark">
                          {matchedStudent.maskedStudentMobile}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-bold text-customText-muted uppercase block mb-0.5">
                          Parent Mobile Number (Last 4 Digits)
                        </span>
                        <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {matchedStudent.maskedParentMobile}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reason for Going Out */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                      Reason for Going Out *
                    </label>
                    <textarea
                      rows={3}
                      value={outpassReason}
                      onChange={(e) => setOutpassReason(e.target.value)}
                      placeholder="State reason for going out (e.g. Medical emergency, high fever, visiting doctor with prescription...)"
                      className="glass-input text-xs py-2.5 resize-none w-full"
                      required
                    />

                    {/* Quick Reason Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        'Medical Emergency / Clinic',
                        'Severe Fever / Headache',
                        'Urgent Family Matter',
                        'Official Bank Work',
                        'Special Event / Travel'
                      ].map((reasonChip) => (
                        <button
                          key={reasonChip}
                          type="button"
                          onClick={() => setOutpassReason(reasonChip)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-[11px] font-semibold text-customText-muted transition-colors cursor-pointer"
                        >
                          + {reasonChip}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-customText-muted uppercase mb-1">
                      Destination / Clinic / Home Address
                    </label>
                    <input
                      type="text"
                      value={outpassDestination}
                      onChange={(e) => setOutpassDestination(e.target.value)}
                      placeholder="e.g. Home / Hospital / Government Office"
                      className="glass-input text-xs py-2.5 w-full"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setApplyStep(1)}
                      className="btn-secondary py-3 px-5 text-xs font-bold cursor-pointer"
                      disabled={isSubmittingOutpass}
                    >
                      Change Details
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex-1 py-3 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/25 cursor-pointer"
                      disabled={isSubmittingOutpass}
                    >
                      {isSubmittingOutpass ? (
                        <span>Submitting Application...</span>
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          <span>Submit Application</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}

              {/* STEP 3: Automatically Generated Outpass Ticket Confirmation on Screen */}
              {applyStep === 3 && submittedTicket && (
                <div className="space-y-5 animate-fade-in text-center py-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 size={36} />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-customText dark:text-customText-dark">
                      Application Submitted Successfully!
                    </h3>
                    <p className="text-xs text-customText-muted mt-1">
                      Ticket Ref ID: <span className="font-mono font-bold text-primary">{submittedTicket.id}</span>
                    </p>
                  </div>

                  {/* MANDATORY PROMINENT NOTE: do not close app till goes out */}
                  <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 flex items-center justify-center gap-3 font-black text-sm shadow-sm text-left">
                    <AlertCircle size={22} className="text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                    <div>
                      <span className="uppercase tracking-wider block text-[10px] font-black text-amber-700 dark:text-amber-400">
                        Notice
                      </span>
                      <span>Note: do not close app till goes out.</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-customText-muted font-bold">Student:</span>
                      <span className="font-black">{submittedTicket.studentName} ({submittedTicket.rollNumber})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-customText-muted font-bold">Section:</span>
                      <span className="font-semibold">{submittedTicket.section}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-customText-muted font-bold">Live Status:</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20 text-[11px]">
                        Awaiting Parent Call Confirmation
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTicket(submittedTicket)}
                      className="btn-primary flex-1 py-3 text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <FileText size={16} />
                      <span>View / Download Outpass Slip (PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetApplication}
                      className="btn-secondary py-3 px-5 text-xs font-bold cursor-pointer"
                    >
                      Apply Another Leave
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* 2. VIEW APPLICATION STATUS & LEAVE HISTORY CARD */}
            <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 animate-fade-in space-y-5 relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm">
                    <Search size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-customText dark:text-customText-dark tracking-tight">
                      View Your Application Status & Leave History
                    </h3>
                    <p className="text-xs text-customText-muted">
                      Enter your roll number to track today's live outpass or download your official pass slip.
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleCheckApplicationStatus} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    value={statusRollInput}
                    onChange={(e) => setStatusRollInput(e.target.value)}
                    placeholder="Enter College Roll Number (e.g. 21NE1A0501)"
                    className="glass-input pl-10 py-3 text-xs sm:text-sm font-mono font-bold uppercase w-full tracking-wider"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingStatus}
                  className="btn-primary py-3 px-6 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md shrink-0 cursor-pointer"
                >
                  {isSearchingStatus ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  ) : (
                    <>
                      <Search size={16} />
                      <span>Check Status</span>
                    </>
                  )}
                </button>
              </form>

              {/* Error notification */}
              {statusError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold animate-fade-in">
                  ⚠️ {statusError}
                </div>
              )}

              {/* Status Results Display */}
              {hasSearchedStatus && statusTickets.length > 0 && (() => {
                const todayDateString = new Date().toLocaleDateString('en-GB');
                const todayISOString = new Date().toISOString().slice(0, 10);
                const todayTicket = statusTickets.find(t => {
                  if (t.appliedDate === todayDateString) return true;
                  if (t.appliedAt && t.appliedAt.startsWith(todayISOString)) return true;
                  return false;
                });
                const previousTickets = statusTickets.filter(t => t.id !== todayTicket?.id);

                return (
                  <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                    
                    {/* PRESENT DAY'S STATUS HIGHLIGHT CARD */}
                    {todayTicket ? (
                      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border-2 border-emerald-500/50 shadow-lg space-y-4 relative overflow-hidden">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-[10px] tracking-wider uppercase animate-pulse shadow-sm">
                              TODAY'S APPLICATION
                            </span>
                            <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-300">
                              {todayTicket.id}
                            </span>
                          </div>
                          <span className={`px-3 py-1 rounded-xl text-xs font-black border ${
                            todayTicket.status === 'PERMISSION_GRANTED'
                              ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                              : todayTicket.status === 'SENT_OUT'
                              ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40'
                              : todayTicket.status === 'FORWARDED_TO_HOD'
                              ? 'bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-500/40'
                              : todayTicket.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
                          }`}>
                            {todayTicket.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-customText-muted uppercase block">Student Name</span>
                            <p className="font-black text-customText dark:text-customText-dark truncate">{todayTicket.studentName}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-customText-muted uppercase block">Roll Number</span>
                            <p className="font-mono font-black text-primary">{todayTicket.rollNumber}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-customText-muted uppercase block">Section</span>
                            <p className="font-bold text-customText dark:text-customText-dark">{todayTicket.section}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-customText-muted uppercase block">Applied At</span>
                            <p className="font-medium text-customText-muted">{todayTicket.appliedTime}</p>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 text-xs space-y-1">
                          <span className="text-[10px] font-bold text-customText-muted uppercase block">Stated Reason:</span>
                          <p className="font-semibold italic text-slate-800 dark:text-slate-200">"{todayTicket.reason}"</p>
                          <span className="text-[11px] text-customText-muted block pt-1">
                            <strong>Destination:</strong> {todayTicket.destination}
                          </span>
                        </div>

                        {/* Approval Stage Progress */}
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div className={`p-2.5 rounded-xl border ${todayTicket.absentControllerAction?.confirmed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400'}`}>
                            <span className="block font-black">1. Parent Call</span>
                            <span>{todayTicket.absentControllerAction?.confirmed ? '✓ Confirmed' : (todayTicket.status === 'REJECTED' ? '✕ Denied' : 'Pending')}</span>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${todayTicket.hodAction?.granted ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400'}`}>
                            <span className="block font-black">2. HOD Permission</span>
                            <span>{todayTicket.hodAction?.granted ? '✓ Granted' : (todayTicket.status === 'REJECTED' ? '✕ Denied' : 'Pending')}</span>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${todayTicket.watchmanAction?.sentOut ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400'}`}>
                            <span className="block font-black">3. Gate Release</span>
                            <span>{todayTicket.watchmanAction?.sentOut ? '✓ Exited Campus' : 'At Campus'}</span>
                          </div>
                        </div>

                        {/* Download Official PDF Slip Button */}
                        <button
                          type="button"
                          onClick={() => setActiveTicket(todayTicket)}
                          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-98"
                        >
                          <Download size={17} />
                          <span>Download / Print Official Leave Granted Slip (PDF)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 text-center text-xs text-customText-muted">
                        No active leave application submitted for today ({todayDateString}). Previous applications are listed below.
                      </div>
                    )}

                    {/* PREVIOUS APPLICATIONS HISTORY */}
                    {previousTickets.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-customText-muted flex items-center gap-1.5">
                          <History size={13} />
                          <span>Previous Leave Applications ({previousTickets.length})</span>
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {previousTickets.map((t) => (
                            <div
                              key={t.id}
                              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-customText dark:text-customText-dark">
                                    {t.appliedDate}
                                  </span>
                                  <span className="font-mono text-[10px] text-customText-muted">
                                    {t.id}
                                  </span>
                                </div>
                                <p className="font-medium text-customText-muted truncate mt-0.5">
                                  "{t.reason}" • <span className="font-semibold text-customText">{t.destination}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                  t.status === 'PERMISSION_GRANTED'
                                    ? 'bg-emerald-500/10 text-emerald-700'
                                    : t.status === 'SENT_OUT'
                                    ? 'bg-purple-500/10 text-purple-700'
                                    : t.status === 'REJECTED'
                                    ? 'bg-rose-500/10 text-rose-700'
                                    : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {t.status.replace(/_/g, ' ')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTicket(t)}
                                  className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="View and download official leave slip"
                                >
                                  <FileText size={13} />
                                  <span>Slip (PDF)</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}
            </div>

          </div>

          ) : (

            /* STAFF LOGIN CARD (Cleaned up, no Quick Demo Accounts) */
            <div className="w-full max-w-md glass-card p-8 border border-white/60 dark:border-slate-800/65 relative z-10 animate-fade-in my-auto">
              
              {/* Back to Student Portal button */}
              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="absolute top-6 left-6 text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← Back to Portal
              </button>

              {/* Fingerprint Login Option */}
              <div className="absolute top-6 right-6 z-20">
                <button
                  type="button"
                  onClick={handleFingerprintLogin}
                  disabled={loading || biometricsLoading}
                  title="Sign in with Fingerprint"
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:border-primary/30 hover:text-primary hover:scale-105 transition-all duration-300 flex items-center justify-center cursor-pointer shadow-sm"
                >
                  <Fingerprint 
                    size={20} 
                    className={`${
                      biometricsLoading ? 'animate-bounce' : ''
                    } transition-transform duration-300`} 
                  />
                </button>
              </div>

              <div className="flex flex-col items-center mb-6 mt-4 text-center">
                <div className="relative w-16 h-16 flex items-center justify-center mb-3">
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary-dark border-r-transparent border-b-secondary border-l-transparent animate-spin" style={{ animationDuration: '3s' }}></div>
                  <img src={logo} alt="NEC Logo" className="w-14 h-14 rounded-full object-contain relative z-10 shadow-md" />
                </div>
                <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark tracking-tight">
                  Staff Login
                </h2>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-1">
                  Authorized personnel portal authentication
                </p>
              </div>

              {/* Form Errors */}
              {error && (
                <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Biometrics Loading Status */}
              {biometricsLoading && (
                <div className="mb-5 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 text-customText-muted text-xs font-semibold rounded-xl flex items-center justify-center gap-2.5">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent shrink-0"></span>
                  <span>{biometricsStatus}</span>
                </div>
              )}

              {/* Password login form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                    User ID
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-customText-muted dark:text-customText-mutedDark">
                      <User size={17} />
                    </span>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="Enter authorized User ID"
                      className="glass-input pl-10 text-xs"
                      disabled={loading || biometricsLoading}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-customText-muted dark:text-customText-mutedDark">
                      <Lock size={17} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="glass-input pl-10 pr-10 text-xs"
                      disabled={loading || biometricsLoading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-customText-muted hover:text-customText cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full btn-primary mt-2 py-3 text-xs font-bold cursor-pointer"
                  disabled={loading || biometricsLoading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

            </div>
          )}

        </main>

        {/* 4. Footer (Removed "NEC Narasaraopet Lectra Outpass System") */}
        <footer className="w-full text-center py-4 border-t border-slate-200/40 dark:border-slate-800/40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm z-10">
          <p className="text-xs text-customText-muted dark:text-customText-mutedDark font-medium">
            © {new Date().getFullYear()} Narasaraopeta Engineering College (Autonomous)
          </p>
        </footer>

      </div>

      {/* 5. Active Ticket Viewer & Download Modal */}
      {activeTicket && (
        <OutpassTicketModal
          ticket={activeTicket}
          onClose={() => setActiveTicket(null)}
        />
      )}

      {/* 6. Biometric Scan Modal */}
      {showBiometricsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300" 
            onClick={() => !biometricsLoading && setShowBiometricsModal(false)} 
          />
          
          <div className="relative w-full max-w-sm glass-card p-8 border border-white/20 dark:border-slate-800/40 shadow-2xl z-10 animate-fade-in space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
              <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark flex items-center gap-2">
                <Fingerprint className="text-primary" size={22} />
                <span>Biometric Login</span>
              </h3>
              <button 
                type="button" 
                onClick={() => !biometricsLoading && setShowBiometricsModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-customText-muted dark:text-customText-mutedDark transition-colors cursor-pointer"
                disabled={biometricsLoading}
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-customText-muted dark:text-customText-mutedDark text-center leading-relaxed">
              Scan your registered fingerprint to securely access your account.
            </p>

            <div className="flex flex-col items-center justify-center py-6 relative">
              <div className="relative w-32 h-32 flex items-center justify-center">
                {biometricsLoading && (
                  <>
                    <div className="absolute inset-0 rounded-full border border-primary/30 animate-ripple-ring" style={{ animationDelay: '0s' }} />
                    <div className="absolute inset-0 rounded-full border border-primary/20 animate-ripple-ring" style={{ animationDelay: '0.6s' }} />
                    <div className="absolute inset-0 rounded-full border border-primary/10 animate-ripple-ring" style={{ animationDelay: '1.2s' }} />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => !biometricsLoading && handleBiometricAuth()}
                  disabled={biometricsLoading}
                  className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-500 overflow-hidden relative ${
                    biometricsLoading 
                      ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(124,157,255,0.2)] cursor-default' 
                      : modalError 
                        ? 'border-danger bg-danger/5 cursor-pointer hover:bg-danger/10' 
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 cursor-pointer hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  <Fingerprint 
                    size={48} 
                    className={`transition-all duration-500 ${
                      biometricsLoading 
                        ? 'text-primary scale-110' 
                        : modalError 
                          ? 'text-danger' 
                          : 'text-slate-400 dark:text-slate-500 hover:text-primary'
                    }`} 
                  />

                  {biometricsLoading && (
                    <div className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(124,157,255,0.8)] animate-scan-line" />
                  )}
                </button>
              </div>

              <div className="mt-4 text-center">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  modalError ? 'text-danger' : 'text-primary'
                }`}>
                  {biometricsLoading ? biometricsStatus : modalError ? 'Authentication Failed' : 'Ready to Scan'}
                </span>
              </div>
            </div>

            {modalError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2 animate-pulse">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBiometricsModal(false)}
                className="flex-1 btn-secondary py-2.5 text-xs font-bold cursor-pointer"
                disabled={biometricsLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="flex-1 btn-primary py-2.5 text-xs font-bold cursor-pointer"
                disabled={biometricsLoading}
              >
                {biometricsLoading ? 'Scanning...' : 'Scan Fingerprint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;
