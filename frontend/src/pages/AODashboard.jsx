import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllOutpasses, 
  subscribeToOutpasses, 
  aoApproveHodLeave, 
  aoRejectHodLeave 
} from '../services/outpassService';
import { 
  ShieldCheck, 
  Clock, 
  Calendar, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  User, 
  Building, 
  FileText, 
  Filter, 
  RefreshCw,
  DoorOpen,
  ArrowRight
} from 'lucide-react';
import OutpassTicketModal from '../components/OutpassTicketModal';

const AODashboard = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterTab, setFilterTab] = useState('PENDING'); // 'PENDING' | 'GRANTED' | 'COMPLETED' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  
  // Rejection modal
  const [rejectingTicket, setRejectingTicket] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadTickets = () => {
    setTickets(getAllOutpasses());
  };

  useEffect(() => {
    loadTickets();
    const unsub = subscribeToOutpasses(setTickets);
    return () => unsub();
  }, []);

  // Filter tickets for HOD and Office Staff applicants (routes to AO Login)
  const aoTickets = tickets.filter(t => 
    t.applicantType === 'HOD' || 
    t.applicantType === 'OFFICE' || 
    t.facultyType === 'OFFICE' || 
    t.status === 'FORWARDED_TO_AO'
  );

  const pendingTickets = aoTickets.filter(t => t.status === 'FORWARDED_TO_AO');
  const grantedTickets = aoTickets.filter(t => t.status === 'PERMISSION_GRANTED' || t.status === 'FACULTY_OUT');
  const completedTickets = aoTickets.filter(t => t.status === 'SENT_OUT');

  const filteredTickets = aoTickets.filter(t => {
    // Tab filter
    if (filterTab === 'PENDING' && t.status !== 'FORWARDED_TO_AO') return false;
    if (filterTab === 'GRANTED' && (t.status !== 'PERMISSION_GRANTED' && t.status !== 'FACULTY_OUT')) return false;
    if (filterTab === 'COMPLETED' && t.status !== 'SENT_OUT') return false;
    if (filterTab === 'REJECTED' && t.status !== 'REJECTED') return false;

    // Search query
    const q = searchQuery.toLowerCase();
    const name = (t.facultyName || t.studentName || '').toLowerCase();
    const id = (t.id || '').toLowerCase();
    const dept = (t.department || '').toLowerCase();
    const purpose = (t.purpose || t.reason || '').toLowerCase();

    return name.includes(q) || id.includes(q) || dept.includes(q) || purpose.includes(q);
  });

  const handleApprove = (ticket) => {
    try {
      setActionError('');
      const applicantRole = (ticket.applicantType === 'OFFICE' || ticket.facultyType === 'OFFICE') ? 'Office Staff' : 'HOD';
      aoApproveHodLeave(ticket.id, {
        aoName: user?.name || 'Administrative Officer (AO)',
        remarks: `Leave approved by AO for ${applicantRole}. Forwarded to Campus Security at main gate.`
      });
      setActionSuccess(`Permission granted for ${ticket.facultyName || applicantRole}! Forwarded to Campus Security.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to approve leave application');
    }
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectingTicket) return;
    if (!rejectReason.trim()) {
      setActionError('Please specify a rejection reason');
      return;
    }

    try {
      setActionError('');
      const applicantRole = (rejectingTicket.applicantType === 'OFFICE' || rejectingTicket.facultyType === 'OFFICE') ? 'Office Staff' : 'HOD';
      aoRejectHodLeave(rejectingTicket.id, {
        aoName: user?.name || 'Administrative Officer (AO)',
        reason: rejectReason.trim()
      });
      setActionSuccess(`Application for ${rejectingTicket.facultyName || applicantRole} rejected.`);
      setRejectingTicket(null);
      setRejectReason('');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to reject leave application');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'FORWARDED_TO_AO':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs border border-amber-500/20 flex items-center gap-1.5">
            <Clock size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
            Pending AO Approval
          </span>
        );
      case 'PERMISSION_GRANTED':
        return (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs border border-blue-500/20 flex items-center gap-1.5">
            <ShieldCheck size={12} />
            Approved • At Security Gate
          </span>
        );
      case 'FACULTY_OUT':
        return (
          <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-xs border border-purple-500/20 flex items-center gap-1.5">
            <DoorOpen size={12} />
            HOD Out • Return Pending
          </span>
        );
      case 'SENT_OUT':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            Completed & Cleared
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs border border-rose-500/20 flex items-center gap-1.5">
            <XCircle size={12} />
            Rejected by AO
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-customText dark:text-customText-dark tracking-tight">
                  Administrative Officer (AO) Portal
                </h1>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Authorizing & Granting HOD & Office Staff Leaves, Permissions & On Duty (OD) Applications
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTickets}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RefreshCw size={14} />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>

        {/* Counter KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
              Awaiting AO Action
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {pendingTickets.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
              Forwarded to Security
            </span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {grantedTickets.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
              Completed & Cleared
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {completedTickets.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-black uppercase tracking-wider text-customText-muted block mb-1">
              Total Applications
            </span>
            <span className="text-2xl font-black text-customText dark:text-customText-dark">
              {aoTickets.length}
            </span>
          </div>
        </div>
      </div>

      {/* Success / Error Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center gap-3">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-sm flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'PENDING', label: `Pending Action (${pendingTickets.length})` },
            { id: 'GRANTED', label: `At Security (${grantedTickets.length})` },
            { id: 'COMPLETED', label: `Completed (${completedTickets.length})` },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'ALL', label: `All Records (${hodTickets.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-customText-muted hover:text-customText'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-customText-muted" />
          <input
            type="text"
            placeholder="Search by Name, Dept, ID, Category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Main List of Applications */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-customText-muted">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-black text-customText dark:text-customText-dark">
              No applications in this category
            </h3>
            <p className="text-xs text-customText-muted max-w-md mx-auto">
              There are currently no HOD or Office Staff permissions or leave applications matching your selected filter.
            </p>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const isPending = ticket.status === 'FORWARDED_TO_AO';
            const isOd = ticket.type === 'FACULTY_OD' || ticket.permissionType === 'FACULTY_OD';
            const isOneHour = ticket.type === 'FACULTY_ONE_HOUR' || ticket.permissionType === 'FACULTY_ONE_HOUR';
            const is4Pm = ticket.type === 'FACULTY_4PM' || ticket.permissionType === 'FACULTY_4PM';
            const isOfficeStaff = ticket.applicantType === 'OFFICE' || ticket.facultyType === 'OFFICE';

            return (
              <div
                key={ticket.id}
                className={`glass-card p-5 rounded-2xl border transition-all ${
                  isPending 
                    ? 'border-amber-500/40 shadow-lg shadow-amber-500/5 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Applicant details & Type */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                        {ticket.id}
                      </span>

                      {/* Applicant Category Badge: HOD or Office Staff */}
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border flex items-center gap-1 ${
                        isOfficeStaff
                          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                      }`}>
                        {isOfficeStaff ? '🏢 Office Staff' : '🏛️ HOD'}
                      </span>

                      {/* Type Badge */}
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border ${
                        isOd 
                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                          : isOneHour
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }`}>
                        {isOd ? 'On Duty (OD)' : isOneHour ? '1-Hour Timing Permission' : '4:00 PM Permission'}
                      </span>

                      {/* Status Badge */}
                      {getStatusBadge(ticket.status)}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 pt-1">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-customText-muted shrink-0" />
                        <div>
                          <span className="text-[10px] text-customText-muted uppercase font-bold block">
                            {isOfficeStaff ? 'Applicant (Office Staff)' : 'Applicant (HOD)'}
                          </span>
                          <span className="text-sm font-black text-customText dark:text-customText-dark">
                            {ticket.facultyName || ticket.studentName || (isOfficeStaff ? 'Office Staff Member' : 'Head of Department')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Building size={16} className="text-customText-muted shrink-0" />
                        <div>
                          <span className="text-[10px] text-customText-muted uppercase font-bold block">Department</span>
                          <span className="text-xs font-bold text-customText dark:text-customText-dark">
                            {ticket.department}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-customText-muted shrink-0" />
                        <div>
                          <span className="text-[10px] text-customText-muted uppercase font-bold block">Leave Date & Time</span>
                          <span className="text-xs font-bold text-customText dark:text-customText-dark">
                            {ticket.date} • {ticket.leaveTime || '04:00 PM'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Purpose */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                      <span className="font-bold text-customText-muted mr-1.5 uppercase text-[10px]">Stated Reason:</span>
                      <span className="font-semibold text-customText dark:text-customText-dark">
                        {ticket.purpose || ticket.reason || 'No specific purpose mentioned.'}
                      </span>
                    </div>

                    {/* AO action info if approved or rejected */}
                    {ticket.aoAction && (
                      <div className="text-[11px] text-customText-muted flex items-center gap-2 pt-0.5">
                        <span className="font-bold">AO Action:</span>
                        <span>{ticket.aoAction.remarks} ({ticket.aoAction.displayDate} {ticket.aoAction.displayTime})</span>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleApprove(ticket)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                        >
                          <CheckCircle2 size={16} />
                          <span>Grant & Forward to Security</span>
                        </button>

                        <button
                          onClick={() => {
                            setRejectingTicket(ticket);
                            setRejectReason('');
                          }}
                          className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                        >
                          <span>Reject Application</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-customText flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText size={14} />
                        <span>View Pass Slip</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reject Modal */}
      {rejectingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 className="text-lg font-black text-customText dark:text-customText-dark">
                Reject HOD Leave Application
              </h3>
            </div>
            
            <p className="text-xs text-customText-muted">
              Are you sure you want to reject the leave application for <strong className="text-customText dark:text-customText-dark">{rejectingTicket.facultyName}</strong> ({rejectingTicket.id})?
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Rejection Reason / Remarks *
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="State reason for rejecting (e.g. Mandatory meeting scheduled, institutional requirements...)"
                  className="w-full glass-input text-xs py-2.5 resize-none"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingTicket(null)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 shadow-md transition-all cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Outpass Ticket Viewer Modal */}
      {selectedTicket && (
        <OutpassTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
};

export default AODashboard;
