import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Calendar,
  AlertCircle,
  Activity,
  History,
  PhoneCall,
  X,
  FileText,
  Send,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import OutpassTicketModal from '../components/OutpassTicketModal';
import { 
  getAllOutpasses, 
  confirmParentAndForwardToHOD, 
  rejectByAbsentController, 
  subscribeToOutpasses,
  syncOutpassesFromBackend
} from '../services/outpassService';

const ABSENCE_REASONS = {
  "Medical": ["Fever", "Hospital", "Injury", "Medical Check-up"],
  "Family": ["Marriage", "Emergency", "Death", "Sick Family Member"],
  "Academic": ["Exam", "Project", "Internship", "Workshop"],
  "Transport": ["Bus Missed", "Vehicle Breakdown", "Traffic"],
  "Personal": ["Personal Work", "Stress", "Overslept"],
  "Official": ["Bank", "Passport", "Government Work"],
  "College Activity": ["Sports", "NSS", "Cultural Event"],
  "Weather": ["Heavy Rain", "Flood", "Cyclone"],
  "Work": ["Part-time Job", "Family Business"],
  "Other": ["Travel", "Festival", "Miscellaneous"]
};

const AbsentControllerDashboard = () => {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [classrooms, setClassrooms] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [activeBoardTab, setActiveBoardTab] = useState(searchParams.get('tab') || 'sectionWise'); // 'sectionWise' | 'allSections' | 'outpassRequests'

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveBoardTab(tabParam);
    } else {
      setActiveBoardTab('sectionWise');
    }
  }, [searchParams]);
  const [students, setStudents] = useState([]);
  const [absentees, setAbsentees] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Call follow-up panel state
  const [activeCallStudent, setActiveCallStudent] = useState(null);
  const [answeredCall, setAnsweredCall] = useState(null); // true or false
  const [selectedCategory, setSelectedCategory] = useState('Medical');
  const [selectedReason, setSelectedReason] = useState('Fever');
  const [customReason, setCustomReason] = useState('');
  const [savingCall, setSavingCall] = useState(false);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [preExcusedStart, setPreExcusedStart] = useState('');
  const [preExcusedEnd, setPreExcusedEnd] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState('All'); // 'All' | 'morning' | 'afternoon'

  // Outpass Permissions state
  const [outpassTickets, setOutpassTickets] = useState([]);
  const [selectedOutpassModalTicket, setSelectedOutpassModalTicket] = useState(null);
  const [callingOutpassTicket, setCallingOutpassTicket] = useState(null);
  const [parentConfirmationRemarks, setParentConfirmationRemarks] = useState('Parent confirmed permission over phone call.');
  const [outpassActionSuccess, setOutpassActionSuccess] = useState('');
  const [outpassActionError, setOutpassActionError] = useState('');

  // Load and subscribe to live outpass tickets
  useEffect(() => {
    setOutpassTickets(getAllOutpasses());
    const unsub = subscribeToOutpasses(setOutpassTickets);
    return () => unsub();
  }, []);

  // Handlers for Absent Controller outpass actions
  const handleConfirmParentAndForward = (ticket) => {
    try {
      setOutpassActionError('');
      confirmParentAndForwardToHOD(ticket.id, {
        controllerName: user?.name || 'Absent Controller',
        remarks: parentConfirmationRemarks || 'Parent confirmed permission over phone call.'
      });
      setCallingOutpassTicket(null);
      setOutpassActionSuccess(`Confirmed with parent! Outpass for ${ticket.studentName} (${ticket.rollNumber}) has been submitted and forwarded to HOD.`);
      setTimeout(() => setOutpassActionSuccess(''), 4500);
    } catch (err) {
      setOutpassActionError(err.message || 'Failed to forward outpass');
    }
  };

  const handleRejectOutpass = (ticket, customReason) => {
    try {
      setOutpassActionError('');
      rejectByAbsentController(ticket.id, {
        controllerName: user?.name || 'Absent Controller',
        reason: customReason || 'Parent did not grant permission during phone call.'
      });
      setCallingOutpassTicket(null);
      setOutpassActionSuccess(`Outpass for ${ticket.studentName} was rejected as parent denied permission.`);
      setTimeout(() => setOutpassActionSuccess(''), 4500);
    } catch (err) {
      setOutpassActionError(err.message || 'Failed to reject outpass');
    }
  };

  const downloadReportFile = async (url, fallbackFilename) => {
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        let msg = 'Failed to download report';
        try {
          const errData = await res.json();
          if (errData.message) msg = errData.message;
        } catch (e) {}
        throw new Error(msg);
      }

      let filename = fallbackFilename;
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Report download error:', error);
      alert(error.message || 'Report download failed');
    }
  };

  const handleDownloadReport = (targetSession = sessionFilter) => {
    const params = new URLSearchParams();
    params.append('section', activeBoardTab === 'sectionWise' ? selectedSection : 'All');
    params.append('date', todayDate);
    if (targetSession && targetSession !== 'All') {
      params.append('session', targetSession);
    }
    params.append('format', 'excel');
    downloadReportFile(`/api/reports/absentees?${params.toString()}`, `Absentees_Report_${todayDate}.xlsx`);
  };

  const handleDownloadMonthlyReport = (format = 'excel') => {
    const sectionName = activeBoardTab === 'sectionWise' ? selectedSection : 'All';
    const monthStr = todayDate.slice(0, 7);
    if (format === 'excel') {
      const params = new URLSearchParams();
      params.append('section', sectionName);
      params.append('month', monthStr);
      params.append('format', 'excel');
      downloadReportFile(`/api/reports/monthly-section-attendance?${params.toString()}`, `Monthly_Attendance_${sectionName}_${monthStr}.xlsx`);
    } else {
      const params = new URLSearchParams();
      params.append('reportType', 'monthly');
      params.append('section', sectionName);
      params.append('month', monthStr);
      window.open(`/print-report?${params.toString()}`, '_blank');
    }
  };



  // Student history modal state
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState(null);
  const [absentHistory, setAbsentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDate = getTodayDateString();

  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const res = await fetch('/api/classrooms', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setClassrooms(data);
          if (data.length > 0) {
            setSelectedSection(data[0].className);
          }
        } else {
          setError(data.message || 'Failed to fetch classrooms');
        }
      } catch (err) {
        setError('Failed to connect to backend server');
      } finally {
        setLoading(false);
      }
    };
    
    fetchClassrooms();
  }, [token]);

  const loadSectionData = async () => {
    try {
      setError('');
      if (activeBoardTab === 'sectionWise') {
        if (!selectedSection) return;

        // 1. Fetch all students in section
        const studRes = await fetch(`/api/student-attendance/students?section=${encodeURIComponent(selectedSection)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const studData = await studRes.json();
        if (studRes.ok) {
          setStudents(studData);
        }

        // 2. Fetch absentees for section today
        const absRes = await fetch(`/api/student-attendance/absentees?section=${encodeURIComponent(selectedSection)}&date=${todayDate}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const absData = await absRes.json();
        if (absRes.ok) {
          setAbsentees(absData);
        }
      } else {
        // activeBoardTab === 'allSections'
        // Fetch absentees for all sections today
        const absRes = await fetch(`/api/student-attendance/absentees?section=All&date=${todayDate}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const absData = await absRes.json();
        if (absRes.ok) {
          setAbsentees(absData);
        }
        setStudents([]);
      }
    } catch (err) {
      setError('Error reloading dashboard data');
    }
  };

  useEffect(() => {
    loadSectionData();
  }, [activeBoardTab, selectedSection, token]);

  const handleMakeCall = (student) => {
    setActiveCallStudent(student);
    if (student.callLog) {
      setAnsweredCall(student.callLog.answered);
      const logReason = student.callLog.reason || '';
      setIsMultiDay(!!student.preExcusedStart);
      setPreExcusedStart(student.preExcusedStart || '');
      setPreExcusedEnd(student.preExcusedEnd || '');

      let matched = false;
      const parts = logReason.split(' - ');
      if (parts.length >= 2) {
        const cat = parts[0];
        const res = parts.slice(1).join(' - ');
        if (ABSENCE_REASONS[cat]) {
          setSelectedCategory(cat);
          if (ABSENCE_REASONS[cat].includes(res)) {
            setSelectedReason(res);
            setCustomReason('');
          } else {
            setSelectedReason('Others');
            setCustomReason(res);
          }
          matched = true;
        }
      }
      if (!matched) {
        setSelectedCategory('Other');
        setSelectedReason('Others');
        setCustomReason(logReason);
      }
    } else {
      setAnsweredCall(null);
      setSelectedCategory('Medical');
      setSelectedReason('Fever');
      setCustomReason('');
      setIsMultiDay(false);
      setPreExcusedStart('');
      setPreExcusedEnd('');
    }
    
    // Trigger standard tel call link simulation
    window.location.href = `tel:${student.parentMobile}`;
  };

  const handleSaveCallLog = async (e) => {
    e.preventDefault();
    if (!activeCallStudent || answeredCall === null) return;
    
    setSavingCall(true);
    setError('');
    setSuccess('');

    const finalReason = answeredCall
      ? (selectedReason === 'Others' ? `${selectedCategory} - ${customReason}` : `${selectedCategory} - ${selectedReason}`)
      : null;

    try {
      const res = await fetch('/api/student-attendance/call-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: activeCallStudent.id,
          date: todayDate,
          answered: answeredCall,
          reason: finalReason,
          preExcusedStart: (answeredCall && isMultiDay) ? preExcusedStart : null,
          preExcusedEnd: (answeredCall && isMultiDay) ? preExcusedEnd : null,
          preExcusedReason: (answeredCall && isMultiDay) ? finalReason : null
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`Call log saved successfully for ${activeCallStudent.name}.`);
        setActiveCallStudent(null);
        setAnsweredCall(null);
        setSelectedCategory('Medical');
        setSelectedReason('Fever');
        setCustomReason('');
        setIsMultiDay(false);
        setPreExcusedStart('');
        setPreExcusedEnd('');
        loadSectionData(); // Reload to show updated call log details
      } else {
        setError(data.message || 'Failed to save call log');
      }
    } catch (err) {
      setError('Network error saving call log');
    } finally {
      setSavingCall(false);
    }
  };

  const handleViewHistory = async (student) => {
    setSelectedHistoryStudent(student);
    setLoadingHistory(true);
    setAbsentHistory([]);
    try {
      const res = await fetch(`/api/student-attendance/student/${student.id}/absent-days`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAbsentHistory(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredAbsentees = absentees.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.section && s.section.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (sessionFilter === 'morning') return s.attendanceSession === 'morning';
    if (sessionFilter === 'afternoon') return s.attendanceSession === 'afternoon';
    return true;
  });

  const morningAbsentees = filteredAbsentees.filter(s => s.attendanceSession === 'morning');
  const afternoonAbsentees = filteredAbsentees.filter(s => s.attendanceSession === 'afternoon');
  const filteredStudentsList = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark tracking-tight">
            Absentee Control Board
          </h2>
          <p className="text-sm text-customText-muted dark:text-customText-mutedDark">
            Monitor absentees, place calls to parents, and log tracking feedback in real-time
          </p>
        </div>

        {activeBoardTab === 'sectionWise' && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
              Select Class
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="glass-input text-sm py-2"
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.className}>
                  {c.className}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Real-time Alert Banner for Incoming Outpasses */}
      {outpassTickets.filter(t => t.status === 'PENDING_PARENT_CALL').length > 0 && (
        <div 
          onClick={() => setActiveBoardTab('outpassRequests')}
          className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-amber-500/25 transition-all no-print shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-white font-black text-xs animate-bounce">
              ACTION REQUIRED
            </span>
            <div>
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                🔔 {outpassTickets.filter(t => t.status === 'PENDING_PARENT_CALL').length} Student Outpass Request(s) Awaiting Parent Call!
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Student submitted outpass on campus. Click here to verify parent phone & forward to HOD.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 shrink-0"
          >
            Review & Call Parent →
          </button>
        </div>
      )}

      {/* Active Section Header (Feature selection driven by Left Menu) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 no-print flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {activeBoardTab === 'sectionWise' && (
            <>
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary-dark dark:text-primary">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Section Wise Absentee Calling Board
                </h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Select a classroom section to monitor absentees, place calls to parents, and record feedback
                </p>
              </div>
            </>
          )}
          {activeBoardTab === 'allSections' && (
            <>
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  All Section Consolidated Absentees
                </h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Complete college-wide view of today's absent students with quick calling action
                </p>
              </div>
            </>
          )}
          {activeBoardTab === 'outpassRequests' && (
            <>
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary-dark dark:text-primary">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Student Outpass Clearance & Parent Verification
                </h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Verify student leave requests with parents over phone and forward approved requests to HOD
                </p>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            const tickets = await syncOutpassesFromBackend();
            setOutpassTickets(tickets);
          }}
          className="py-2 px-3 text-xs font-bold text-customText-muted hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Refresh live tickets from central server"
        >
          <RefreshCw size={13} />
          <span>Sync Outpasses</span>
        </button>
      </div>

      {/* Controls Bar: Search & Session Filter & Download Report */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search absentees & students by name, roll number, or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input pl-10 pr-4 py-2 w-full text-sm placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl bg-white/40 dark:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-customText dark:text-customText-dark"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Session Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase">Session:</span>
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="glass-input text-xs py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
            >
              <option value="All">All Sessions</option>
              <option value="morning">Morning Absentees</option>
              <option value="afternoon">Afternoon Absentees</option>
            </select>
          </div>

          {/* Download Report Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleDownloadReport(sessionFilter)}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all"
              title="Download Daily Absentees Excel"
            >
              <span>Excel Absentees</span>
              <span className="text-[10px] bg-emerald-800/40 px-1 py-0.5 rounded uppercase">
                {sessionFilter}
              </span>
            </button>

            <button
              onClick={() => handleDownloadMonthlyReport('excel')}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all"
              title="Download Section Monthly Attendance Excel"
            >
              <span>Monthly Excel</span>
            </button>

            <button
              onClick={() => handleDownloadMonthlyReport('pdf')}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white shadow-md active:scale-[0.98] transition-all"
              title="Download Section Monthly Attendance PDF"
            >
              <span>Monthly PDF</span>
            </button>
          </div>

        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-semibold rounded-xl">
          ✓ {success}
        </div>
      )}

      {/* SECTION 1: SECTION-WISE LAYOUT */}
      {activeBoardTab === 'sectionWise' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* Today's Absentees list (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">

            <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/45">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-base text-customText dark:text-customText-dark flex items-center gap-2">
                  <AlertCircle className="text-red-500" size={20} />
                  <span>Today's Absentees ({absentees.length})</span>
                </h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-customText-muted dark:text-customText-mutedDark px-2.5 py-1 rounded-md font-semibold">
                  Date: {todayDate}
                </span>
              </div>

              {absentees.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-customText-muted dark:text-customText-mutedDark">
                  🎉 No absentees logged for {selectedSection} today!
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Morning Session Absentees */}
                  <div>
                    <h4 className="font-extrabold text-xs text-primary dark:text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span>Morning Session Absentees ({morningAbsentees.length})</span>
                    </h4>
                    {morningAbsentees.length === 0 ? (
                      <div className="text-center py-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-customText-muted dark:text-customText-mutedDark">
                        No morning absentees.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {morningAbsentees.map((student) => {
                          const isLate = student.status === 'Late';
                          const hasCallLog = !!student.callLog;
                          const isActiveCall = activeCallStudent?.id === student.id;
                          
                          return (
                            <div 
                              key={student.id} 
                              className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 ${
                                isActiveCall
                                  ? 'col-span-1 sm:col-span-2 border-primary-dark/50 bg-primary-dark/5 shadow-lg'
                                  : isLate 
                                    ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5' 
                                    : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40 shadow-red-500/5'
                              } hover:shadow-md`}
                            >
                              {isActiveCall ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
                                  {/* Left Column: Student Details */}
                                  <div className="space-y-3">
                                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                      isLate 
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                                    }`}>
                                      {student.status}
                                    </span>

                                    <div className="space-y-1">
                                      <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                        {student.rollNumber}
                                      </h4>
                                      <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                                        {student.name} • {student.section}
                                      </span>
                                    </div>

                                    <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/20 flex flex-col gap-2">
                                      <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                        <span>Student's Mobile:</span>
                                        <span className="font-semibold text-customText dark:text-customText-dark">
                                          {student.studentMobile || 'N/A'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                        <span>Parent's Mobile:</span>
                                        <span className="font-semibold text-customText dark:text-customText-dark">
                                          {student.parentMobile}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Column: Inline Call Feedback form */}
                                  <div className="border-t md:border-t-0 md:border-l border-slate-200/50 dark:border-slate-800/30 pt-4 md:pt-0 md:pl-6">
                                    <div className="flex justify-between items-center mb-3">
                                      <h5 className="font-bold text-xs text-primary-dark dark:text-primary uppercase tracking-wider">
                                        Call Feedback Log
                                      </h5>
                                      <button 
                                        type="button"
                                        onClick={() => setActiveCallStudent(null)}
                                        className="text-slate-400 hover:text-slate-600"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>

                                    <form onSubmit={handleSaveCallLog} className="space-y-3">
                                      <div>
                                        <p className="text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                                          Did the parent answer?
                                        </p>
                                        <div className="flex items-center gap-4">
                                          <label className="flex items-center gap-1.5 text-xs font-semibold text-customText dark:text-customText-dark cursor-pointer">
                                            <input
                                              type="radio"
                                              name={`answered-${student.id}`}
                                              checked={answeredCall === true}
                                              onChange={() => setAnsweredCall(true)}
                                              className="h-3.5 w-3.5 text-primary"
                                              required
                                            />
                                            <span>Yes</span>
                                          </label>
                                          <label className="flex items-center gap-1.5 text-xs font-semibold text-customText dark:text-customText-dark cursor-pointer">
                                            <input
                                              type="radio"
                                              name={`answered-${student.id}`}
                                              checked={answeredCall === false}
                                              onChange={() => setAnsweredCall(false)}
                                              className="h-3.5 w-3.5 text-primary"
                                              required
                                            />
                                            <span>No</span>
                                          </label>
                                        </div>
                                      </div>

                                      {answeredCall === true && (
                                         <>
                                           <div className="space-y-2">
                                             <div className="space-y-1">
                                               <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                 Category
                                               </label>
                                               <select
                                                 value={selectedCategory}
                                                 onChange={(e) => {
                                                   const cat = e.target.value;
                                                   setSelectedCategory(cat);
                                                   setSelectedReason(ABSENCE_REASONS[cat][0] || 'Others');
                                                 }}
                                                 className="glass-input text-[11px] py-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-customText dark:text-customText-dark"
                                                 required
                                               >
                                                 {Object.keys(ABSENCE_REASONS).map(cat => (
                                                   <option key={cat} value={cat}>{cat}</option>
                                                 ))}
                                               </select>
                                             </div>

                                             <div className="space-y-1">
                                               <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                 Reason
                                               </label>
                                               <select
                                                 value={selectedReason}
                                                 onChange={(e) => setSelectedReason(e.target.value)}
                                                 className="glass-input text-[11px] py-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-customText dark:text-customText-dark"
                                                 required
                                               >
                                                 {(ABSENCE_REASONS[selectedCategory] || []).map(res => (
                                                   <option key={res} value={res}>{res}</option>
                                                 ))}
                                                 <option value="Others">Others</option>
                                               </select>
                                             </div>

                                             {selectedReason === 'Others' && (
                                               <div className="space-y-1">
                                                 <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                   Custom Reason
                                                 </label>
                                                 <input
                                                   type="text"
                                                   required
                                                   value={customReason}
                                                   onChange={(e) => setCustomReason(e.target.value)}
                                                   placeholder="Enter customized reason"
                                                   className="glass-input text-[11px] py-1.5"
                                                 />
                                               </div>
                                             )}
                                           </div>

                                          <div className="mt-2">
                                            <label className="flex items-center gap-2 text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={isMultiDay}
                                                onChange={(e) => setIsMultiDay(e.target.checked)}
                                                className="h-3.5 w-3.5 text-primary rounded"
                                              />
                                              <span>Absent for future dates</span>
                                            </label>
                                          </div>

                                          {isMultiDay && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                              <div className="space-y-1">
                                                <label className="block text-[9px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                  From
                                                </label>
                                                <input
                                                  type="date"
                                                  required={isMultiDay}
                                                  value={preExcusedStart}
                                                  onChange={(e) => setPreExcusedStart(e.target.value)}
                                                  className="glass-input text-[10px] py-1 px-2"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="block text-[9px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                  To
                                                </label>
                                                <input
                                                  type="date"
                                                  required={isMultiDay}
                                                  value={preExcusedEnd}
                                                  onChange={(e) => setPreExcusedEnd(e.target.value)}
                                                  className="glass-input text-[10px] py-1 px-2"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      <div className="flex justify-end gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setActiveCallStudent(null)}
                                          className="btn-secondary py-1 px-3 text-[10px]"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="submit"
                                          disabled={savingCall || answeredCall === null}
                                          className="btn-primary py-1 px-3 text-[10px] bg-primary-dark"
                                        >
                                          {savingCall ? 'Saving...' : 'Save'}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className={`absolute top-4 right-4 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    isLate 
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800' 
                                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                                  }`}>
                                    {student.status}
                                  </span>

                                  <div className="space-y-1 pr-14">
                                    <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                      {student.rollNumber}
                                    </h4>
                                    <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                                      {student.name} • {student.section}
                                    </span>
                                  </div>

                                  {/* Parent Phone Section */}
                                  <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/20 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                      <span>Student's Mobile:</span>
                                      <span className="font-semibold text-customText dark:text-customText-dark">
                                        {student.studentMobile || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                      <span>Parent's Mobile:</span>
                                      <span className="font-semibold text-customText dark:text-customText-dark">
                                        {student.parentMobile}
                                      </span>
                                    </div>

                                    {/* Call Logs Detail if any */}
                                    {hasCallLog && (
                                      <div className={`p-2.5 rounded-xl text-xs ${
                                        student.callLog.isPreExcused
                                          ? 'bg-sky-500/10 text-sky-700 dark:text-sky-450'
                                          : student.callLog.answered 
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-450' 
                                            : 'bg-red-500/10 text-red-700 dark:text-red-450'
                                      }`}>
                                        <p className="font-bold flex items-center gap-1.5">
                                          {student.callLog.isPreExcused ? <Calendar size={12} /> : student.callLog.answered ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                          <span>
                                            {student.callLog.isPreExcused 
                                              ? 'Pre-informed Absent' 
                                              : student.callLog.answered ? 'Answered' : 'Not Answered'}
                                          </span>
                                        </p>
                                        {student.callLog.reason && (
                                          <p className="mt-1 font-medium italic text-[11px] opacity-90">
                                            Reason: "{student.callLog.reason}"
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {isLate ? (
                                      <span className="mt-2 text-center text-xs font-bold text-amber-600 bg-amber-500/10 py-2 px-4 rounded-xl border border-amber-500/20">
                                        Late Entry - No Call Required
                                      </span>
                                    ) : student.callLog?.isPreExcused ? (
                                      <span className="mt-2 text-center text-xs font-bold text-sky-600 bg-sky-500/10 py-2 px-4 rounded-xl border border-sky-500/20">
                                        No Call Required (Pre-informed)
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => handleMakeCall(student)}
                                        className={`mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] ${
                                          hasCallLog 
                                            ? 'bg-slate-600 hover:bg-slate-700' 
                                            : 'bg-primary-dark hover:bg-primary text-white shadow-md shadow-primary-dark/10'
                                        }`}
                                      >
                                        <PhoneCall size={14} />
                                        <span>{hasCallLog ? 'Call Again / Update' : 'Call Parent'}</span>
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Afternoon Session Absentees */}
                  <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/10">
                    <h4 className="font-extrabold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <span>Afternoon Session Absentees ({afternoonAbsentees.length})</span>
                    </h4>
                    {afternoonAbsentees.length === 0 ? (
                      <div className="text-center py-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-customText-muted dark:text-customText-mutedDark">
                        No afternoon absentees.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {afternoonAbsentees.map((student) => {
                          const isLate = student.status === 'Late';
                          const hasCallLog = !!student.callLog;
                          
                          return (
                            <div 
                              key={student.id} 
                              className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 ${
                                isLate 
                                  ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5' 
                                  : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40 shadow-red-500/5'
                              } hover:shadow-md`}
                            >
                              <span className={`absolute top-4 right-4 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isLate 
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800' 
                                  : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                              }`}>
                                {student.status}
                              </span>

                              <div className="space-y-1 pr-14">
                                <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                  {student.rollNumber}
                                </h4>
                                <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                                  {student.name} • {student.section}
                                </span>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/20 flex flex-col gap-2">
                                <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                  <span>Student's Mobile:</span>
                                  <span className="font-semibold text-customText dark:text-customText-dark">
                                    {student.studentMobile || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                  <span>Parent's Mobile:</span>
                                  <span className="font-semibold text-customText dark:text-customText-dark">
                                    {student.parentMobile}
                                  </span>
                                </div>

                                {/* Call Logs Detail if any */}
                                {hasCallLog && (
                                  <div className={`p-2.5 rounded-xl text-xs ${
                                    student.callLog.isPreExcused
                                      ? 'bg-sky-500/10 text-sky-700 dark:text-sky-450'
                                      : student.callLog.answered 
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-450' 
                                        : 'bg-red-500/10 text-red-700 dark:text-red-450'
                                  }`}>
                                    <p className="font-bold flex items-center gap-1.5">
                                      {student.callLog.isPreExcused ? <Calendar size={12} /> : student.callLog.answered ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                      <span>
                                        {student.callLog.isPreExcused 
                                          ? 'Pre-informed Absent' 
                                          : student.callLog.answered ? 'Answered' : 'Not Answered'}
                                      </span>
                                    </p>
                                    {student.callLog.reason && (
                                      <p className="mt-1 font-medium italic text-[11px] opacity-90">
                                        Reason: "{student.callLog.reason}"
                                      </p>
                                    )}
                                  </div>
                                )}

                                {isLate ? (
                                  <span className="mt-2 text-center text-xs font-bold text-amber-600 bg-amber-500/10 py-2 px-4 rounded-xl border border-amber-500/20">
                                    Late Entry - Calling Restricted
                                  </span>
                                ) : student.callLog?.isPreExcused ? (
                                  <span className="mt-2 text-center text-xs font-bold text-sky-600 bg-sky-500/10 py-2 px-4 rounded-xl border border-sky-500/20">
                                    No Call Required (Pre-informed)
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleMakeCall(student)}
                                    className={`mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] ${
                                      hasCallLog 
                                        ? 'bg-slate-600 hover:bg-slate-700' 
                                        : 'bg-primary-dark hover:bg-primary text-white shadow-md shadow-primary-dark/10'
                                    }`}
                                  >
                                    <PhoneCall size={14} />
                                    <span>{hasCallLog ? 'Call Again / Update' : 'Call Parent'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: All Students Cards List (1/3 width) */}
          <div className="space-y-6">
            <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/45">
              <h3 className="font-bold text-base text-customText dark:text-customText-dark flex items-center gap-2 mb-6">
                <Users className="text-slate-500" size={20} />
                <span>All Students Registry ({filteredStudentsList.length})</span>
              </h3>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {filteredStudentsList.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/45 dark:border-slate-800/40 rounded-2xl flex flex-col gap-3 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                        {student.rollNumber}
                      </h4>
                      <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                        {student.name}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5 pt-2.5 border-t border-slate-200/40 dark:border-slate-800/20 text-customText-muted dark:text-customText-mutedDark">
                      <div className="flex justify-between items-center">
                        <span>Student Mobile:</span>
                        {student.studentMobile ? (
                          <a href={`tel:${student.studentMobile}`} className="font-bold text-primary dark:text-primary-dark hover:underline flex items-center gap-1">
                            <Phone size={10} />
                            <span>{student.studentMobile}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">N/A</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Parent Mobile:</span>
                        {student.parentMobile ? (
                          <a href={`tel:${student.parentMobile}`} className="font-bold text-primary dark:text-primary-dark hover:underline flex items-center gap-1">
                            <Phone size={10} />
                            <span>{student.parentMobile}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">N/A</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-slate-200/20 dark:border-slate-800/10">
                      <button
                        onClick={() => handleViewHistory(student)}
                        className="flex-1 py-1.5 px-3 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors flex items-center justify-center gap-1"
                      >
                        <History size={12} className="text-slate-400" />
                        <span>View History</span>
                      </button>
                    </div>
                  </div>
                ))}
                
                {students.length === 0 && (
                  <div className="text-center py-6 text-xs text-customText-muted dark:text-customText-mutedDark">
                    No students in this section.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* SECTION 2: ALL SECTIONS TAB LAYOUT */}
      {activeBoardTab === 'allSections' && (
        <div className="space-y-6">


          <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/45">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-base text-customText dark:text-customText-dark flex items-center gap-2">
                <AlertCircle className="text-red-500" size={20} />
                <span>Today's Absentees across All Sections ({absentees.length})</span>
              </h3>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-customText-muted dark:text-customText-mutedDark px-2.5 py-1 rounded-md font-semibold">
                Date: {todayDate}
              </span>
            </div>

            {absentees.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-customText-muted dark:text-customText-mutedDark">
                🎉 No absentees logged across any sections today!
              </div>
            ) : (
              <div className="space-y-8">
                {/* Morning Session Absentees */}
                <div>
                  <h4 className="font-extrabold text-xs text-primary dark:text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Morning Session Absentees ({morningAbsentees.length})</span>
                  </h4>
                  {morningAbsentees.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-customText-muted dark:text-customText-mutedDark">
                      No morning absentees.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {morningAbsentees.map((student) => {
                        const isLate = student.status === 'Late';
                        const hasCallLog = !!student.callLog;
                        const isActiveCall = activeCallStudent?.id === student.id;
                        
                        return (
                          <div 
                            key={student.id} 
                            className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 ${
                              isActiveCall
                                ? 'col-span-1 sm:col-span-2 md:col-span-3 border-primary-dark/50 bg-primary-dark/5 shadow-lg'
                                : isLate 
                                  ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5' 
                                  : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40 shadow-red-500/5'
                            } hover:shadow-md`}
                          >
                            {isActiveCall ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
                                {/* Left Column: Student Details */}
                                <div className="space-y-3">
                                  <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    isLate 
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800' 
                                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                                  }`}>
                                    {student.status}
                                  </span>

                                  <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                      {student.rollNumber}
                                    </h4>
                                    <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                                      {student.name} • {student.section}
                                    </span>
                                  </div>

                                  <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/20 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                      <span>Student's Mobile:</span>
                                      <span className="font-semibold text-customText dark:text-customText-dark">
                                        {student.studentMobile || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                      <span>Parent's Mobile:</span>
                                      <span className="font-semibold text-customText dark:text-customText-dark">
                                        {student.parentMobile}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Column: Inline Call Feedback form */}
                                <div className="border-t md:border-t-0 md:border-l border-slate-200/50 dark:border-slate-800/30 pt-4 md:pt-0 md:pl-6">
                                  <div className="flex justify-between items-center mb-3">
                                    <h5 className="font-bold text-xs text-primary-dark dark:text-primary uppercase tracking-wider">
                                      Call Feedback Log
                                    </h5>
                                    <button 
                                      type="button"
                                      onClick={() => setActiveCallStudent(null)}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>

                                  <form onSubmit={handleSaveCallLog} className="space-y-3">
                                    <div>
                                      <p className="text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                                        Did the parent answer?
                                      </p>
                                      <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-customText dark:text-customText-dark cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`answered-${student.id}`}
                                            checked={answeredCall === true}
                                            onChange={() => setAnsweredCall(true)}
                                            className="h-3.5 w-3.5 text-primary"
                                            required
                                          />
                                          <span>Yes</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-customText dark:text-customText-dark cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`answered-${student.id}`}
                                            checked={answeredCall === false}
                                            onChange={() => setAnsweredCall(false)}
                                            className="h-3.5 w-3.5 text-primary"
                                            required
                                          />
                                          <span>No</span>
                                        </label>
                                      </div>
                                    </div>

                                    {answeredCall === true && (
                                      <>
                                        <div className="space-y-2">
                                          <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                              Category
                                            </label>
                                            <select
                                              value={selectedCategory}
                                              onChange={(e) => {
                                                const cat = e.target.value;
                                                setSelectedCategory(cat);
                                                setSelectedReason(ABSENCE_REASONS[cat][0] || 'Others');
                                              }}
                                              className="glass-input text-[11px] py-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-customText dark:text-customText-dark"
                                              required
                                            >
                                              {Object.keys(ABSENCE_REASONS).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                              ))}
                                            </select>
                                          </div>

                                          <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                              Reason
                                            </label>
                                            <select
                                              value={selectedReason}
                                              onChange={(e) => setSelectedReason(e.target.value)}
                                              className="glass-input text-[11px] py-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-customText dark:text-customText-dark"
                                              required
                                            >
                                              {(ABSENCE_REASONS[selectedCategory] || []).map(res => (
                                                <option key={res} value={res}>{res}</option>
                                              ))}
                                              <option value="Others">Others</option>
                                            </select>
                                          </div>

                                          {selectedReason === 'Others' && (
                                            <div className="space-y-1">
                                              <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                Custom Reason
                                              </label>
                                              <input
                                                type="text"
                                                required
                                                value={customReason}
                                                onChange={(e) => setCustomReason(e.target.value)}
                                                placeholder="Enter customized reason"
                                                className="glass-input text-[11px] py-1.5"
                                              />
                                            </div>
                                          )}
                                        </div>

                                        <div className="mt-2">
                                          <label className="flex items-center gap-2 text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isMultiDay}
                                              onChange={(e) => setIsMultiDay(e.target.checked)}
                                              className="h-3.5 w-3.5 text-primary rounded"
                                            />
                                            <span>Absent for future dates</span>
                                          </label>
                                        </div>

                                        {isMultiDay && (
                                          <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div className="space-y-1">
                                              <label className="block text-[9px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                From
                                              </label>
                                              <input
                                                type="date"
                                                required={isMultiDay}
                                                value={preExcusedStart}
                                                onChange={(e) => setPreExcusedStart(e.target.value)}
                                                className="glass-input text-[10px] py-1 px-2"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="block text-[9px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                                To
                                              </label>
                                              <input
                                                type="date"
                                                required={isMultiDay}
                                                value={preExcusedEnd}
                                                onChange={(e) => setPreExcusedEnd(e.target.value)}
                                                className="glass-input text-[10px] py-1 px-2"
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setActiveCallStudent(null)}
                                        className="btn-secondary py-1 px-3 text-[10px]"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={savingCall || answeredCall === null}
                                        className="btn-primary py-1 px-3 text-[10px] bg-primary-dark"
                                      >
                                        {savingCall ? 'Saving...' : 'Save'}
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className={`absolute top-4 right-4 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  isLate 
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800' 
                                    : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                                }`}>
                                  {student.status}
                                </span>

                                <div className="space-y-1 pr-14">
                                  <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                    {student.rollNumber}
                                  </h4>
                                  <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                                    {student.name} • {student.section}
                                  </span>
                                </div>

                                {/* Parent Phone Section */}
                                <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/20 flex flex-col gap-2">
                                  <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                    <span>Student's Mobile:</span>
                                    <span className="font-semibold text-customText dark:text-customText-dark">
                                      {student.studentMobile || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                    <span>Parent's Mobile:</span>
                                    <span className="font-semibold text-customText dark:text-customText-dark">
                                      {student.parentMobile}
                                    </span>
                                  </div>

                                  {/* Call Logs Detail if any */}
                                  {hasCallLog && (
                                    <div className={`p-2.5 rounded-xl text-xs ${
                                      student.callLog.isPreExcused
                                        ? 'bg-sky-500/10 text-sky-700 dark:text-sky-450'
                                        : student.callLog.answered 
                                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-450' 
                                          : 'bg-red-500/10 text-red-700 dark:text-red-450'
                                    }`}>
                                      <p className="font-bold flex items-center gap-1.5">
                                        {student.callLog.isPreExcused ? <Calendar size={12} /> : student.callLog.answered ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                        <span>
                                          {student.callLog.isPreExcused 
                                            ? 'Pre-informed Absent' 
                                            : student.callLog.answered ? 'Answered' : 'Not Answered'}
                                        </span>
                                      </p>
                                      {student.callLog.reason && (
                                        <p className="mt-1 font-medium italic text-[11px] opacity-90">
                                          Reason: "{student.callLog.reason}"
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {isLate ? (
                                    <span className="mt-2 text-center text-xs font-bold text-amber-600 bg-amber-500/10 py-2 px-4 rounded-xl border border-amber-500/20">
                                      Late Entry - No Call Required
                                    </span>
                                  ) : student.callLog?.isPreExcused ? (
                                    <span className="mt-2 text-center text-xs font-bold text-sky-600 bg-sky-500/10 py-2 px-4 rounded-xl border border-sky-500/20">
                                      No Call Required (Pre-informed)
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleMakeCall(student)}
                                      className={`mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] ${
                                        hasCallLog 
                                          ? 'bg-slate-600 hover:bg-slate-700' 
                                          : 'bg-primary-dark hover:bg-primary text-white shadow-md shadow-primary-dark/10'
                                      }`}
                                    >
                                      <PhoneCall size={14} />
                                      <span>{hasCallLog ? 'Call Again / Update' : 'Call Parent'}</span>
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Afternoon Session Absentees */}
                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/10">
                  <h4 className="font-extrabold text-xs text-slate-500 dark:text-slate-400 tracking-wider mb-4 flex items-center gap-2 uppercase">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Afternoon Session Absentees ({afternoonAbsentees.length})</span>
                  </h4>
                  {afternoonAbsentees.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-customText-muted dark:text-customText-mutedDark">
                      No afternoon absentees.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {afternoonAbsentees.map((student) => {
                        const isLate = student.status === 'Late';
                        const hasCallLog = !!student.callLog;
                        
                        return (
                          <div 
                            key={student.id} 
                            className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 ${
                              isLate 
                                ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5' 
                                : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40 shadow-red-500/5'
                            } hover:shadow-md`}
                          >
                            <span className={`absolute top-4 right-4 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isLate 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800' 
                                : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                            }`}>
                              {student.status}
                            </span>

                            <div className="space-y-1 pr-14">
                              <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                {student.rollNumber}
                              </h4>
                              <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                                {student.name} • {student.section}
                              </span>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/20 flex flex-col gap-2">
                              <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                <span>Student's Mobile:</span>
                                <span className="font-semibold text-customText dark:text-customText-dark">
                                  {student.studentMobile || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs text-customText-muted dark:text-customText-mutedDark">
                                <span>Parent's Mobile:</span>
                                <span className="font-semibold text-customText dark:text-customText-dark">
                                  {student.parentMobile}
                                </span>
                              </div>

                              {/* Call Logs Detail if any */}
                              {hasCallLog && (
                                <div className={`p-2.5 rounded-xl text-xs ${
                                  student.callLog.isPreExcused
                                    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-450'
                                    : student.callLog.answered 
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-450' 
                                      : 'bg-red-500/10 text-red-700 dark:text-red-450'
                                }`}>
                                  <p className="font-bold flex items-center gap-1.5">
                                    {student.callLog.isPreExcused ? <Calendar size={12} /> : student.callLog.answered ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                    <span>
                                      {student.callLog.isPreExcused 
                                        ? 'Pre-informed Absent' 
                                        : student.callLog.answered ? 'Answered' : 'Not Answered'}
                                    </span>
                                  </p>
                                  {student.callLog.reason && (
                                    <p className="mt-1 font-medium italic text-[11px] opacity-90">
                                      Reason: "{student.callLog.reason}"
                                    </p>
                                  )}
                                </div>
                              )}

                              <span className="mt-2 text-center text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                Afternoon Entry - Calling Not Allowed
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. OUTPASS PERMISSIONS TAB CONTENT */}
      {activeBoardTab === 'outpassRequests' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Action Alerts */}
          {outpassActionSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
              <CheckCircle size={18} className="shrink-0" />
              <span>{outpassActionSuccess}</span>
            </div>
          )}

          {outpassActionError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{outpassActionError}</span>
            </div>
          )}

          {/* Metric Summary Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Awaiting Parent Call</span>
              <span className="text-2xl font-black">{outpassTickets.filter(t => t.status === 'PENDING_PARENT_CALL').length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Forwarded to HOD</span>
              <span className="text-2xl font-black">{outpassTickets.filter(t => t.status === 'FORWARDED_TO_HOD').length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <span className="text-[10px] font-bold uppercase tracking-wider block">HOD Granted (Gate Ready)</span>
              <span className="text-2xl font-black">{outpassTickets.filter(t => t.status === 'PERMISSION_GRANTED').length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Student Sent Out</span>
              <span className="text-2xl font-black">{outpassTickets.filter(t => t.status === 'SENT_OUT').length}</span>
            </div>
          </div>

          {/* Pending Applications Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-customText dark:text-customText-dark tracking-tight">
                  Student Outpass Applications Awaiting Parent Call
                </h3>
                <p className="text-xs text-customText-muted">
                  Call the student's parent to verify and take phone confirmation, then click okay and submit to forward to HOD.
                </p>
              </div>
            </div>

            {outpassTickets.filter(t => t.status === 'PENDING_PARENT_CALL').length === 0 ? (
              <div className="p-10 text-center rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                <CheckCircle size={32} className="mx-auto text-emerald-500" />
                <h4 className="font-bold text-customText dark:text-customText-dark">
                  No Pending Outpass Calls
                </h4>
                <p className="text-xs text-customText-muted max-w-sm mx-auto">
                  All student permission requests have been verified and forwarded to HOD.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {outpassTickets.filter(t => t.status === 'PENDING_PARENT_CALL').map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-primary block">
                          {ticket.id}
                        </span>
                        <h4 className="text-lg font-black text-customText dark:text-customText-dark mt-0.5">
                          {ticket.studentName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-customText">
                            {ticket.rollNumber}
                          </span>
                          <span className="text-xs text-customText-muted font-medium">
                            {ticket.section}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedOutpassModalTicket(ticket)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-xs font-bold text-customText-muted flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="View Official Ticket"
                      >
                        <FileText size={15} />
                        <span>Ticket</span>
                      </button>
                    </div>

                    {/* Stated Reason */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 space-y-1 text-xs">
                      <span className="text-[10px] font-bold text-customText-muted uppercase block">
                        Reason to Go Out:
                      </span>
                      <p className="font-semibold text-customText dark:text-customText-dark italic">
                        "{ticket.reason}"
                      </p>
                      <div className="flex flex-wrap gap-4 pt-1.5 text-[11px] text-customText-muted">
                        <span><strong>Destination:</strong> {ticket.destination}</span>
                        {ticket.expectedReturnTime && <span><strong>Expected Return:</strong> {ticket.expectedReturnTime}</span>}
                      </div>
                    </div>

                    {/* Auto-Fetched Parent Mobile Number & Phone Call Button */}
                    <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                            Auto-Fetched Parent Mobile
                          </span>
                          <p className="text-sm font-mono font-black text-customText dark:text-customText-dark">
                            +91 {ticket.parentMobile}
                          </p>
                        </div>
                        
                        {/* Native Click-to-Call Link */}
                        <a
                          href={`tel:${ticket.parentMobile}`}
                          className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                        >
                          <PhoneCall size={14} />
                          <span>Call Parent</span>
                        </a>
                      </div>

                      {/* Parent Confirmation & Submit to HOD Action */}
                      <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmParentAndForward(ticket)}
                          className="flex-1 py-2.5 px-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition-all cursor-pointer active:scale-95"
                        >
                          <CheckCircle size={15} />
                          <span>Parent Confirmed (OK) & Forward to HOD</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleRejectOutpass(ticket, 'Parent refused permission during phone call.')}
                          className="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outpass Clearance History Section */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-sm font-black text-customText dark:text-customText-dark uppercase tracking-wider">
              Outpass Processing Log ({outpassTickets.length} Total)
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-customText-muted uppercase">
                  <tr>
                    <th className="p-3">Ref ID</th>
                    <th className="p-3">Student</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Parent Contact</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {outpassTickets.slice(0, 10).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-3 font-mono font-bold text-primary">{t.id}</td>
                      <td className="p-3">
                        <span className="font-bold block">{t.studentName}</span>
                        <span className="text-[10px] text-customText-muted font-mono">{t.rollNumber} • {t.section}</span>
                      </td>
                      <td className="p-3 italic max-w-xs truncate">"{t.reason}"</td>
                      <td className="p-3 font-mono">{t.parentMobile}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          t.status === 'SENT_OUT' ? 'bg-purple-100 text-purple-700' :
                          t.status === 'PERMISSION_GRANTED' ? 'bg-emerald-100 text-emerald-700' :
                          t.status === 'FORWARDED_TO_HOD' ? 'bg-blue-100 text-blue-700' :
                          t.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {t.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setSelectedOutpassModalTicket(t)}
                          className="text-primary hover:underline font-bold text-[11px]"
                        >
                          View Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Official Outpass Ticket Modal */}
      {selectedOutpassModalTicket && (
        <OutpassTicketModal
          ticket={selectedOutpassModalTicket}
          onClose={() => setSelectedOutpassModalTicket(null)}
        />
      )}

      {/* STUDENT ABSENT HISTORY MODAL */}
      {selectedHistoryStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedHistoryStudent(null)} />
          
          <div className="relative glass-card border border-white/60 w-full max-w-md p-6 bg-white dark:bg-slate-900 shadow-2xl animate-fade-in z-10">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200/50 dark:border-slate-800/30">
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Absence History Log
                </h3>
                <p className="text-[11px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                  {selectedHistoryStudent.name} ({selectedHistoryStudent.rollNumber})
                </p>
              </div>
              <button 
                onClick={() => setSelectedHistoryStudent(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4">
              <div className="flex justify-between items-center p-3 bg-red-500/5 border border-red-500/10 rounded-xl mb-4 text-xs">
                <span className="text-customText-muted dark:text-customText-mutedDark font-medium">
                  Total Logged Absent Days:
                </span>
                <span className="font-extrabold text-red-600 dark:text-red-400 text-sm">
                  {absentHistory.length} Day(s)
                </span>
              </div>

              <h4 className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                Logged Absent Dates
              </h4>

              {loadingHistory ? (
                <div className="text-center py-6 text-xs text-customText-muted">Loading logs...</div>
              ) : absentHistory.length === 0 ? (
                <div className="text-center py-6 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  ✓ Perfect Attendance! No absent records found.
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {absentHistory.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/30 rounded-lg text-xs"
                    >
                      <span className="font-semibold text-customText dark:text-customText-dark">
                        {item.date}
                      </span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 rounded-full font-bold text-[10px] uppercase">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200/50 dark:border-slate-800/30">
              <button
                onClick={() => setSelectedHistoryStudent(null)}
                className="btn-secondary text-xs px-5 py-2"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AbsentControllerDashboard;
