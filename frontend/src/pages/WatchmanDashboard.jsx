import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getAllOutpasses, 
  watchmanReleaseStudent, 
  watchmanReleaseFaculty,
  watchmanRecordFacultyInTime,
  subscribeToOutpasses 
} from '../services/outpassService';
import OutpassTicketModal from '../components/OutpassTicketModal';
import { 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  UserCheck, 
  Clock, 
  ExternalLink, 
  AlertTriangle,
  FileText,
  BadgeCheck,
  DoorOpen,
  ArrowRight,
  Printer,
  LogIn
} from 'lucide-react';

const WatchmanDashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pendingExit'); // 'pendingExit' | 'awaitingReturn' | 'exitHistory'
  const [inTimeMap, setInTimeMap] = useState({});

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('pendingExit');
    }
  }, [searchParams]);
  const [applicantFilter, setApplicantFilter] = useState('ALL'); // 'ALL' | 'FACULTY' | 'STUDENT'
  const [verifyingIdMap, setVerifyingIdMap] = useState({});
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadTickets = () => {
    setTickets(getAllOutpasses());
  };

  useEffect(() => {
    loadTickets();
    const unsubscribe = subscribeToOutpasses(setTickets);
    return () => unsubscribe();
  }, []);

  // Filter tickets into 3 stages:
  // 1. Pending Gate Exit (Approved passes awaiting departure)
  const pendingExitTickets = tickets.filter(t => t.status === 'PERMISSION_GRANTED');
  // 2. Faculty Currently Outside Campus on 1-Hour Permission (Awaiting In-Time entry upon return)
  const facultyAwaitingReturnTickets = tickets.filter(t => t.applicantType === 'FACULTY' && t.status === 'FACULTY_OUT');
  // 3. Completed Gate Departures / Closed Records
  const exitedTickets = tickets.filter(t => t.status === 'SENT_OUT');

  const baseTickets = activeTab === 'pendingExit' 
    ? pendingExitTickets 
    : activeTab === 'awaitingReturn'
      ? facultyAwaitingReturnTickets
      : exitedTickets;

  const filteredTickets = baseTickets.filter(t => {
    // Role filter
    if (applicantFilter === 'FACULTY' && t.applicantType !== 'FACULTY') return false;
    if (applicantFilter === 'STUDENT' && t.applicantType === 'FACULTY') return false;

    // Search filter
    const q = searchQuery.toLowerCase();
    const name = (t.studentName || t.facultyName || '').toLowerCase();
    const id = (t.id || '').toLowerCase();
    const roll = (t.rollNumber || t.facultyUserId || '').toLowerCase();
    const sec = (t.section || t.department || '').toLowerCase();
    return name.includes(q) || id.includes(q) || roll.includes(q) || sec.includes(q);
  });

  const handleSendStudentOut = (ticket) => {
    const isIdChecked = verifyingIdMap[ticket.id];
    if (!isIdChecked) {
      setActionError(`Please check the box confirming you verified ${ticket.studentName}'s physical college ID card.`);
      return;
    }

    try {
      setActionError('');
      watchmanReleaseStudent(ticket.id, {
        watchmanName: user?.name || 'Campus Security Head',
        remarks: 'Physical Student ID card verified at main gate. Sent out.'
      });
      setActionSuccess(`Gate exit approved! Student ${ticket.studentName} (${ticket.rollNumber}) has been marked as SENT OUT.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to update ticket status');
    }
  };

  // Release faculty member at the gate
  const handleReleaseFaculty = (ticket) => {
    try {
      setActionError('');
      watchmanReleaseFaculty(ticket.id, {
        watchmanName: user?.name || 'Campus Security Head',
        remarks: ticket.type === 'FACULTY_ONE_HOUR'
          ? 'Faculty departed campus on 1-hour permission. Return to college pending.'
          : 'Faculty departed campus for 4 PM permission. Ticket closed.'
      });
      if (ticket.type === 'FACULTY_ONE_HOUR') {
        setActionSuccess(`Gate departure cleared! Faculty ${ticket.facultyName || ticket.studentName} is OUT on 1-Hour Permission. When they enter back, enter In-Time in "Faculty Return" tab.`);
      } else {
        setActionSuccess(`Gate departure cleared! Faculty ${ticket.facultyName || ticket.studentName} departed for 4 PM Permission. Ticket closed.`);
      }
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      setActionError(err.message || 'Failed to record faculty departure');
    }
  };

  // Security records the In-Time when faculty enters back into college (1-Hour permission)
  const handleRecordFacultyInTime = (ticket) => {
    const inputTime = inTimeMap[ticket.id];
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const finalInTime = inputTime && inputTime.trim() ? inputTime.trim() : currentTime;

    try {
      setActionError('');
      watchmanRecordFacultyInTime(ticket.id, {
        inTime: finalInTime,
        watchmanName: user?.name || 'Campus Security Head',
        remarks: 'Faculty returned to campus within permission time. In-time verified.'
      });
      setActionSuccess(`In-Time (${finalInTime}) successfully entered for Faculty ${ticket.facultyName || ticket.studentName}! Permission closed and HOD notified.`);
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      setActionError(err.message || 'Failed to record faculty in-time');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-purple-900/20 via-primary/10 to-transparent border border-purple-500/20 glass-card">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner border border-purple-500/30">
            <ShieldCheck size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-customText dark:text-customText-dark tracking-tight">
                Security Head Outpass Control
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                Security Head
              </span>
            </div>
            <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-0.5">
              Verify student physical college ID cards and authorize approved campus departures
            </p>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex flex-wrap items-center gap-3">
          <div 
            onClick={() => setActiveTab('pendingExit')}
            className={`px-4 py-2 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'pendingExit'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block">Awaiting Gate Exit</span>
            <span className="text-xl font-black">{pendingExitTickets.length}</span>
          </div>

          <div 
            onClick={() => setActiveTab('awaitingReturn')}
            className={`px-4 py-2 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'awaitingReturn'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Faculty Out (Return Pending)</span>
              {facultyAwaitingReturnTickets.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              )}
            </div>
            <span className="text-xl font-black">{facultyAwaitingReturnTickets.length}</span>
          </div>

          <div 
            onClick={() => setActiveTab('exitHistory')}
            className={`px-4 py-2 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'exitHistory'
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300'
                : 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block">Total Departed / Closed</span>
            <span className="text-xl font-black">{exitedTickets.length}</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Primary Tab Switcher Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab('pendingExit')}
          className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'pendingExit'
              ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
              : 'text-customText-muted hover:text-customText'
          }`}
        >
          <DoorOpen size={16} />
          <span>1. Gate Exit Clearance</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-black">
            {pendingExitTickets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('awaitingReturn')}
          className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'awaitingReturn'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-customText-muted hover:text-customText'
          }`}
        >
          <LogIn size={16} />
          <span>2. Faculty Return (Enter In-Time)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            facultyAwaitingReturnTickets.length > 0 
              ? 'bg-blue-500 text-white animate-pulse' 
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
          }`}>
            {facultyAwaitingReturnTickets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exitHistory')}
          className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'exitHistory'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-customText-muted hover:text-customText'
          }`}
        >
          <CheckCircle2 size={16} />
          <span>3. Gate Logs & Exit History</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-600 font-black">
            {exitedTickets.length}
          </span>
        </button>
      </div>

      {/* Reminder Banner if Faculty outside on 1-hour permission */}
      {activeTab === 'pendingExit' && facultyAwaitingReturnTickets.length > 0 && (
        <div 
          onClick={() => setActiveTab('awaitingReturn')}
          className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-between cursor-pointer hover:bg-blue-500/15 transition-all animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <LogIn size={16} className="text-blue-600 shrink-0" />
            <span>
              <strong>Faculty Return Notice:</strong> {facultyAwaitingReturnTickets.length} faculty member(s) currently outside on 1-Hour Permission. Click here to record their In-Time upon college entry.
            </span>
          </div>
          <span className="px-3 py-1 rounded-xl bg-blue-600 text-white text-[11px] font-black shrink-0">
            Open In-Time Entry →
          </span>
        </div>
      )}

      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          {activeTab === 'pendingExit' ? (
            <>
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary-dark dark:text-primary">
                <DoorOpen size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Gate Exit Clearance ({pendingExitTickets.length})
                </h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Verify approved student outpasses & faculty permissions (1-Hour or 4 PM) and authorize gate departure
                </p>
              </div>
            </>
          ) : activeTab === 'awaitingReturn' ? (
            <>
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <LogIn size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Faculty Campus Return — In-Time Entry ({facultyAwaitingReturnTickets.length})
                </h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  When faculty enters back into college after 1-hour permission, enter their In-Time to notify HOD and close ticket
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Gate Exit History & Clearance Logs ({exitedTickets.length})
                </h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Complete audit trail of students and faculty departed through campus gates with in-time records
                </p>
              </div>
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Name, ID, Roll No or Pass Ref..."
            className="glass-input pl-10 pr-4 py-2 text-xs w-full"
          />
        </div>
      </div>

      {/* Role Filter Category Pills */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setApplicantFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            applicantFilter === 'ALL'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-customText-muted hover:text-customText'
          }`}
        >
          All ({baseTickets.length})
        </button>
        <button
          onClick={() => setApplicantFilter('FACULTY')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            applicantFilter === 'FACULTY'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-customText-muted hover:text-customText'
          }`}
        >
          <span>Faculty Passes</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 font-black">
            {baseTickets.filter(t => t.applicantType === 'FACULTY').length}
          </span>
        </button>
        {activeTab !== 'awaitingReturn' && (
          <button
            onClick={() => setApplicantFilter('STUDENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              applicantFilter === 'STUDENT'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-customText-muted hover:text-customText'
            }`}
          >
            <span>Student Outpasses</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 font-black">
              {baseTickets.filter(t => t.applicantType !== 'FACULTY').length}
            </span>
          </button>
        )}
      </div>

      {/* Tickets List View */}
      {filteredTickets.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <ShieldCheck size={24} />
          </div>
          <h4 className="font-bold text-customText dark:text-customText-dark">
            {activeTab === 'pendingExit'
              ? 'No Gate Passes Awaiting Clearance'
              : activeTab === 'awaitingReturn'
                ? 'No Faculty Currently Outside Awaiting Return'
                : 'No Exit History Found'}
          </h4>
          <p className="text-xs text-customText-muted dark:text-customText-mutedDark max-w-sm mx-auto">
            {activeTab === 'pendingExit'
              ? 'When HOD grants permission to student outpasses or faculty 1-hour / 4 PM permission requests, they appear here.'
              : activeTab === 'awaitingReturn'
                ? 'When faculty departed on 1-hour permission, they appear here. When they return to college, enter their In-Time to close ticket and notify HOD.'
                : 'Individuals who have physically departed through the gate today will be listed here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => {
            const isIdChecked = !!verifyingIdMap[ticket.id];
            const isFaculty = ticket.applicantType === 'FACULTY';
            const is1Hour = ticket.type === 'FACULTY_ONE_HOUR';
            const is4PM = ticket.type === 'FACULTY_4PM';

            return (
              <div 
                key={ticket.id}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                {/* Top Status & Meta */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-primary-dark dark:text-primary block">
                      {ticket.id}
                    </span>
                    <h3 className="text-lg font-black text-customText dark:text-customText-dark mt-0.5">
                      {isFaculty ? (ticket.facultyName || ticket.studentName) : ticket.studentName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-extrabold text-customText">
                        {isFaculty ? (ticket.facultyUserId || 'FACULTY') : ticket.rollNumber}
                      </span>
                      <span className="text-xs text-customText-muted font-medium">
                        {isFaculty ? (ticket.department || ticket.section) : ticket.section}
                      </span>

                      {isFaculty ? (
                        is4PM ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 font-black text-[11px] border border-blue-500/30">
                            4:00 PM Permission
                          </span>
                        ) : is1Hour ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-[11px] border border-amber-500/30">
                            1-Hour Permission (Out: {ticket.leaveTime})
                          </span>
                        ) : ticket.type === 'FACULTY_EARLY_OUT' ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-[11px] border border-amber-500/30">
                            Early Out ({ticket.leaveTime})
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-400 font-black text-[11px] border border-purple-500/30">
                            Faculty Full-Day Leave
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold text-[10px]">
                          Student Outpass
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary transition-colors text-customText-muted text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                    title={isFaculty ? "View / Generate Official Faculty Slip" : "View Official Outpass Ticket"}
                  >
                    <FileText size={15} />
                    <span>{isFaculty ? 'Final Slip' : 'View Ticket'}</span>
                  </button>
                </div>

                {/* Reason & Approvals Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-customText-muted uppercase block">
                      {isFaculty ? 'Purpose Stated for Permission:' : 'Reason for Going Out:'}
                    </span>
                    <p className="font-medium text-customText dark:text-customText-dark mt-0.5 italic">
                      "{ticket.purpose || ticket.reason}"
                    </p>
                  </div>

                  {isFaculty ? (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                      <div>
                        <span className="text-[9px] font-bold text-customText-muted uppercase block">
                          Scheduled Out Time:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ticket.date || ticket.appliedDate} • {ticket.leaveTime || '04:00 PM'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-customText-muted uppercase block">
                          HOD Status:
                        </span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <BadgeCheck size={12} /> Accepted & Forwarded
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                      <div>
                        <span className="text-[9px] font-bold text-customText-muted uppercase block">
                          Parent Call:
                        </span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Confirmed OK
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-customText-muted uppercase block">
                          HOD Approval:
                        </span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <BadgeCheck size={12} /> Permission Granted
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Watchman Action Area based on Ticket Status */}
                {ticket.status === 'PERMISSION_GRANTED' ? (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    
                    {isFaculty ? (
                      /* Faculty Departure Workflow */
                      <div className="space-y-2.5">
                        <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                          is1Hour 
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300' 
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-300'
                        }`}>
                          <ShieldCheck size={16} className={is1Hour ? 'text-amber-600 shrink-0' : 'text-blue-600 shrink-0'} />
                          <span>
                            {is1Hour 
                              ? '1-Hour Permission: Faculty can leave campus now. Security will enter In-Time when they return.' 
                              : '4:00 PM Permission: Scheduled at 4 PM. Ticket will be closed upon departure (no in-time needed).'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Button 1: View / Print Slip */}
                          <button
                            type="button"
                            onClick={() => setSelectedTicket(ticket)}
                            className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-customText font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Printer size={15} className="text-primary" />
                            <span>Generate Slip</span>
                          </button>

                          {/* Button 2: Send Out */}
                          <button
                            type="button"
                            onClick={() => handleReleaseFaculty(ticket)}
                            className={`py-2.5 px-3 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 ${
                              is1Hour
                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                            }`}
                          >
                            <DoorOpen size={16} />
                            <span>{is1Hour ? 'Send Out (1-Hour Departure)' : 'Send Out & Close (4 PM)'}</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Student Workflow: Requires Physical ID verification */
                      <>
                        <label className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 cursor-pointer hover:bg-purple-500/10 transition-colors">
                          <input
                            type="checkbox"
                            checked={isIdChecked}
                            onChange={(e) => {
                              setVerifyingIdMap({
                                ...verifyingIdMap,
                                [ticket.id]: e.target.checked
                              });
                              if (actionError) setActionError('');
                            }}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                          />
                          <span className="text-xs font-bold text-customText dark:text-customText-dark">
                            I have verified student's Physical College ID Card
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleSendStudentOut(ticket)}
                          className={`w-full py-3 px-4 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                            isIdChecked
                              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20 active:scale-[0.98]'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <DoorOpen size={16} />
                          <span>Send Student Out (Sent)</span>
                          <ArrowRight size={14} />
                        </button>
                      </>
                    )}

                  </div>
                ) : ticket.status === 'FACULTY_OUT' ? (
                  /* Faculty Currently Outside Campus: Security can enter In-Time when they return */
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 text-xs font-bold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-blue-600 shrink-0" />
                        <span>Departed campus at {ticket.watchmanAction?.displayTime || ticket.leaveTime}. Awaiting return to college.</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase">
                        1-Hour In Progress
                      </span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-customText-muted block">
                        Enter College In-Time (When Faculty Enters College) <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={inTimeMap[ticket.id] || ''}
                          onChange={(e) => setInTimeMap({ ...inTimeMap, [ticket.id]: e.target.value })}
                          className="glass-input text-xs flex-1 font-bold"
                          placeholder="HH:MM"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            setInTimeMap({ ...inTimeMap, [ticket.id]: nowStr });
                          }}
                          className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                          title="Fill with current time"
                        >
                          Current Time
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRecordFacultyInTime(ticket)}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <LogIn size={16} />
                        <span>Enter In-Time & Close Permission (Notify HOD)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Completed / Sent Out Ticket Details */
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-extrabold">
                      <CheckCircle2 size={16} />
                      {isFaculty ? (
                        ticket.returned || ticket.inTime ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Returned to College ({ticket.inTime}) • Closed (Out: {ticket.watchmanAction?.displayTime})
                          </span>
                        ) : (
                          <span>Faculty Departed ({ticket.watchmanAction?.displayTime}) • Closed</span>
                        )
                      ) : (
                        <span>Student Sent Out ({ticket.watchmanAction?.displayTime})</span>
                      )}
                    </div>
                    <span className="text-[10px] text-customText-muted">
                      Officer: {ticket.watchmanAction?.watchmanName || 'Security Head'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Official Outpass / Final Slip Modal */}
      {selectedTicket && (
        <OutpassTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

    </div>
  );
};

export default WatchmanDashboard;
