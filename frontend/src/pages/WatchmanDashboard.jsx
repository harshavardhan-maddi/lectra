import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllOutpasses, 
  watchmanReleaseStudent, 
  watchmanReleaseFaculty,
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
  Printer
} from 'lucide-react';

const WatchmanDashboard = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activeTab, setActiveTab] = useState('pendingExit'); // 'pendingExit' | 'exitHistory'
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

  // Filter tickets
  const pendingExitTickets = tickets.filter(t => t.status === 'PERMISSION_GRANTED');
  const exitedTickets = tickets.filter(t => t.status === 'SENT_OUT');

  const filteredTickets = (activeTab === 'pendingExit' ? pendingExitTickets : exitedTickets).filter(t => {
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
        watchmanName: user?.name || 'Main Gate Security Officer',
        remarks: 'Physical Student ID card verified at main gate. Sent out.'
      });
      setActionSuccess(`Gate exit approved! Student ${ticket.studentName} (${ticket.rollNumber}) has been marked as SENT OUT.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to update ticket status');
    }
  };

  // Release faculty member without requiring physical ID check
  const handleReleaseFaculty = (ticket) => {
    try {
      setActionError('');
      watchmanReleaseFaculty(ticket.id, {
        watchmanName: user?.name || 'Main Gate Security Officer',
        remarks: 'Final slip generated. Faculty departure permitted.'
      });
      setActionSuccess(`Gate departure cleared! Faculty ${ticket.facultyName || ticket.studentName} has been marked as DEPARTED.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to record faculty departure');
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
                Gate Security Outpass Control
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                Main Campus Gate
              </span>
            </div>
            <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-0.5">
              Verify student physical college ID cards and authorize approved campus departures
            </p>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-wider block">Awaiting Gate Exit</span>
            <span className="text-xl font-black">{pendingExitTickets.length}</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400">
            <span className="text-[10px] font-bold uppercase tracking-wider block">Total Sent Out</span>
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

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pendingExit')}
            className={`flex items-center gap-2 py-2.5 px-5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'pendingExit'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-slate-100 dark:bg-slate-800 text-customText-muted hover:text-customText'
            }`}
          >
            <DoorOpen size={16} />
            <span>Ready for Exit ({pendingExitTickets.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('exitHistory')}
            className={`flex items-center gap-2 py-2.5 px-5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'exitHistory'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-slate-100 dark:bg-slate-800 text-customText-muted hover:text-customText'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Passed & Departed ({exitedTickets.length})</span>
          </button>
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
          All ({activeTab === 'pendingExit' ? pendingExitTickets.length : exitedTickets.length})
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
            {(activeTab === 'pendingExit' ? pendingExitTickets : exitedTickets).filter(t => t.applicantType === 'FACULTY').length}
          </span>
        </button>
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
            {(activeTab === 'pendingExit' ? pendingExitTickets : exitedTickets).filter(t => t.applicantType !== 'FACULTY').length}
          </span>
        </button>
      </div>

      {/* Tickets List View */}
      {filteredTickets.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <ShieldCheck size={24} />
          </div>
          <h4 className="font-bold text-customText dark:text-customText-dark">
            {activeTab === 'pendingExit' ? 'No Gate Passes Awaiting Clearance' : 'No Exit History Found'}
          </h4>
          <p className="text-xs text-customText-muted dark:text-customText-mutedDark max-w-sm mx-auto">
            {activeTab === 'pendingExit'
              ? 'When HOD grants permission to student outpasses or faculty leave/early out requests, they appear here.'
              : 'Individuals who have physically departed through the gate today will be listed here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => {
            const isIdChecked = !!verifyingIdMap[ticket.id];
            const isFaculty = ticket.applicantType === 'FACULTY';

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
                        ticket.type === 'FACULTY_EARLY_OUT' ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-[11px] border border-amber-500/30">
                            Faculty Early Out ({ticket.leaveTime})
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
                      {isFaculty ? 'Purpose Stated for Absence / Early Out:' : 'Reason for Going Out:'}
                    </span>
                    <p className="font-medium text-customText dark:text-customText-dark mt-0.5 italic">
                      "{ticket.purpose || ticket.reason}"
                    </p>
                  </div>

                  {isFaculty ? (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                      <div>
                        <span className="text-[9px] font-bold text-customText-muted uppercase block">
                          Scheduled Date & Time:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ticket.date || ticket.appliedDate} • {ticket.leaveTime || 'Full Day'}
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

                {/* Watchman Action Area */}
                {ticket.status === 'PERMISSION_GRANTED' ? (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    
                    {isFaculty ? (
                      /* Faculty Workflow: NO ID Check Required. Direct Final Slip & Departure */
                      <div className="space-y-2.5">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300 text-xs font-semibold flex items-center gap-2">
                          <ShieldCheck size={16} className="text-purple-600 shrink-0" />
                          <span>Faculty Gate Pass: No ID card verification required. Generate final slip and permit departure.</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Button 1: Generate Final Slip */}
                          <button
                            type="button"
                            onClick={() => setSelectedTicket(ticket)}
                            className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-customText font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Printer size={15} className="text-primary" />
                            <span>Generate Final Slip</span>
                          </button>

                          {/* Button 2: Mark Departed */}
                          <button
                            type="button"
                            onClick={() => handleReleaseFaculty(ticket)}
                            className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 transition-all cursor-pointer active:scale-95"
                          >
                            <DoorOpen size={16} />
                            <span>Allow Gate Exit (Departed)</span>
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
                ) : (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-extrabold">
                      <CheckCircle2 size={16} />
                      <span>{isFaculty ? 'Faculty Departed' : 'Student Sent Out'} ({ticket.watchmanAction?.displayTime})</span>
                    </div>
                    <span className="text-[10px] text-customText-muted">
                      Gate Officer: {ticket.watchmanAction?.watchmanName || 'Security'}
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
