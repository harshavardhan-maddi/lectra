import React, { useRef } from 'react';
import logo from '../neclogo.png';
import { 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Printer, 
  X, 
  FileText, 
  AlertCircle, 
  Phone, 
  User, 
  Calendar, 
  Building2, 
  Check, 
  Download,
  Award
} from 'lucide-react';

const OutpassTicketModal = ({ ticket, onClose }) => {
  const printAreaRef = useRef(null);

  if (!ticket) return null;

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Official_Leave_Slip_${ticket.rollNumber}_${ticket.id}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const isFaculty = ticket.applicantType === 'FACULTY';
  const facultyDeptName = (ticket.department && ticket.department !== 'General')
    ? ticket.department
    : (ticket.section && ticket.section !== 'General' && ticket.section !== 'Faculty'
        ? ticket.section
        : 'Department of CSE(emerging Technologies)');

  const isApproved = ticket.hodAction?.granted === true || ticket.status === 'PERMISSION_GRANTED' || ticket.status === 'SENT_OUT';
  const isRejected = ticket.status === 'REJECTED' || ticket.hodAction?.granted === false;

  // Status visual mapping
  const getStatusBadge = (status) => {
    if (isFaculty) {
      switch (status) {
        case 'FORWARDED_TO_HOD':
          return {
            label: 'Awaiting HOD Approval',
            color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
            step: 1
          };
        case 'PERMISSION_GRANTED':
          return {
            label: 'PERMISSION ACCEPTED BY HOD • FORWARDED TO WATCHMAN',
            color: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-black',
            step: 2
          };
        case 'SENT_OUT':
          return {
            label: 'FINAL SLIP GENERATED • FACULTY DEPARTED',
            color: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/40 font-black',
            step: 3
          };
        case 'REJECTED':
          return {
            label: 'LEAVE REQUEST REJECTED BY HOD',
            color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-bold',
            step: -1
          };
        default:
          return {
            label: status,
            color: 'bg-slate-100 text-slate-700 border-slate-300',
            step: 1
          };
      }
    }

    switch (status) {
      case 'PENDING_PARENT_CALL':
        return {
          label: 'Awaiting Parent Call Confirmation',
          color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
          step: 1
        };
      case 'FORWARDED_TO_HOD':
        return {
          label: 'Parent Confirmed • Forwarded to HOD',
          color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
          step: 2
        };
      case 'PERMISSION_GRANTED':
        return {
          label: 'PERMISSION GRANTED BY HOD',
          color: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-black',
          step: 3
        };
      case 'SENT_OUT':
        return {
          label: 'STUDENT SENT OUT • EXITED CAMPUS',
          color: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/40 font-black',
          step: 4
        };
      case 'REJECTED':
        return {
          label: 'LEAVE APPLICATION REJECTED',
          color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-bold',
          step: -1
        };
      default:
        return {
          label: status,
          color: 'bg-slate-100 text-slate-700 border-slate-300',
          step: 1
        };
    }
  };

  const statusInfo = getStatusBadge(ticket.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-950/85 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
      
      {/* Backdrop for click away */}
      <div className="fixed inset-0 print:hidden" onClick={onClose} />

      {/* Main Ticket Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 overflow-hidden my-auto max-h-[95vh] flex flex-col print:max-w-none print:shadow-none print:border-0 print:rounded-none print:max-h-none print:overflow-visible print:static">
        
        {/* Top Action Bar (hidden on print) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-primary/10 text-primary-dark dark:text-primary">
              <FileText size={18} />
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-customText dark:text-customText-dark">
                {isFaculty 
                  ? (ticket.type === 'FACULTY_EARLY_OUT' 
                      ? (isApproved ? 'Faculty Early Out Departure Slip (Approved)' : 'Faculty Early Out Request (Pending HOD Approval)')
                      : (isApproved ? 'Faculty Official Leave Slip (Approved)' : 'Faculty Leave Application (Pending HOD Approval)'))
                  : (isApproved ? 'Official Leave Granted Slip (Approved)' : 'Student Leave Application (Pending HOD Approval)')}
              </h3>
              <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark">
                Ref ID: <span className="font-mono font-bold text-primary">{ticket.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark text-xs font-black shadow-md shadow-primary/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer size={15} />
              <span>Download PDF / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content (Becomes Single Page Official Slip on Print) */}
        <div className="p-4 sm:p-6 overflow-y-auto print:overflow-visible print:p-0">
          
          {/* Prominent Alert (hidden on print) */}
          <div className={`mb-4 p-3 rounded-2xl border-2 flex items-center gap-3 font-black text-xs shadow-sm print:hidden ${
            isApproved 
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' 
              : isRejected 
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
          }`}>
            {isApproved ? (
              <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : isRejected ? (
              <X size={20} className="text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div>
              <span className="uppercase tracking-wider block text-[10px] font-black">
                {isApproved 
                  ? 'Status: Approved by HOD • Forwarded to Watchman' 
                  : isRejected 
                    ? 'Status: Rejected by HOD' 
                    : 'Status: Pending HOD Approval'}
              </span>
              <span>
                {isApproved ? (
                  isFaculty 
                    ? 'Official Departure Slip. Approved by HOD and forwarded to Watchman login. No student ID verification required.'
                    : 'Official Gate Pass. Approved by HOD. Show this slip at the Main Security Gate for departure clearance.'
                ) : isRejected ? (
                  'This leave application has been rejected by the Head of Department.'
                ) : (
                  'Application submitted and awaiting HOD approval. Gate exit clearance is NOT authorized until approved by HOD.'
                )}
              </span>
            </div>
          </div>

          {/* THE OFFICIAL SINGLE-PAGE PRINTABLE SLIP */}
          <div 
            id="printable-slip" 
            ref={printAreaRef}
            className="bg-white text-slate-900 p-5 sm:p-7 rounded-2xl border-2 border-slate-900 shadow-sm print:border-2 print:border-black print:p-6 print:rounded-none print:shadow-none space-y-4"
          >
            
            {/* Header: College Logo, Name, Autonomous, Affiliations */}
            <div className="border-b-2 border-slate-900 pb-3.5 text-center">
              <div className="flex items-center justify-between gap-3">
                <img 
                  src={logo} 
                  alt="NEC Logo" 
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" 
                />
                <div className="flex-1 text-center">
                  <h1 className="text-base sm:text-lg font-black tracking-tight uppercase text-slate-950 leading-tight">
                    Narasaraopeta Engineering College
                  </h1>
                  <p className="text-[11px] font-extrabold text-primary-dark tracking-wide uppercase mt-0.5">
                    {isFaculty ? facultyDeptName : '(AUTONOMOUS)'}
                  </p>
                  <p className="text-[9px] text-slate-600 font-medium leading-tight mt-0.5">
                    Approved by AICTE, New Delhi & Permanently Affiliated to JNTUK, Kakinada<br />
                    Accredited by NAAC with 'A+' Grade • ISO 9001:2008 Certified Institution<br />
                    Kotappakonda Road, Yellamanda (P.O), Narasaraopet - 522601, Palnadu Dist., A.P.
                  </p>
                </div>
                <div className="w-16 sm:w-20 shrink-0 flex flex-col items-center justify-center">
                  <span className={`p-1.5 rounded-lg border text-[9px] font-mono font-black uppercase text-center block leading-tight ${
                    isApproved ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-slate-50 text-slate-700'
                  }`}>
                    {isFaculty ? (isApproved ? <>Faculty<br />Approved</> : <>Faculty<br />Pass</>) : (isApproved ? <>Official<br />Gate Pass</> : <>Leave<br />Request</>)}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between px-2 text-[11px] font-mono">
                <span><strong>PASS NO:</strong> <span className="font-black text-slate-900">{ticket.id}</span></span>
                <span className={`px-3 py-0.5 rounded-full font-extrabold uppercase text-[10px] tracking-wider border ${
                  isApproved 
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-900 font-black' 
                    : isRejected 
                      ? 'bg-rose-100 border-rose-500 text-rose-900 font-bold' 
                      : 'bg-amber-100 border-amber-500 text-amber-900 font-bold'
                }`}>
                  {isApproved 
                    ? 'APPROVED BY HOD • FORWARDED TO WATCHMAN' 
                    : isRejected 
                      ? 'REJECTED BY HOD' 
                      : 'PENDING HOD APPROVAL'}
                </span>
                <span><strong>DATE:</strong> {ticket.appliedDate} {ticket.appliedTime}</span>
              </div>
            </div>

            {/* Document Subtitle */}
            <div className={`text-center py-1.5 border rounded-lg ${
              isApproved 
                ? 'bg-emerald-50 border-emerald-300' 
                : isRejected 
                  ? 'bg-rose-50 border-rose-300' 
                  : 'bg-amber-50/70 border-amber-300'
            }`}>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">
                {isFaculty 
                  ? (ticket.type === 'FACULTY_EARLY_OUT' 
                      ? (isApproved ? 'Official Faculty Early Out Departure Slip (Approved)' : 'Faculty Early Out Application (Pending HOD Approval)')
                      : (isApproved ? 'Official Faculty Leave & Gate Clearance Slip (Approved)' : 'Faculty Leave Application (Pending HOD Approval)'))
                  : (isApproved ? 'Official Student Leave & Campus Gate Pass Slip (Approved)' : 'Student Leave Application (Pending HOD Approval)')}
              </h2>
            </div>

            {/* Particulars (Clean Table) */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                {isFaculty ? '1. Faculty Particulars' : '1. Student Particulars'}
              </h3>
              
              {isFaculty ? (
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Faculty Name
                      </td>
                      <td className="w-1/4 p-2 font-black text-slate-950 border-r border-slate-300">
                        {ticket.facultyName || ticket.studentName}
                      </td>
                      <td className="w-1/4 p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Faculty User ID
                      </td>
                      <td className="w-1/4 p-2 font-mono font-black text-slate-950">
                        {ticket.facultyUserId || ticket.rollNumber}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Department
                      </td>
                      <td className="p-2 font-black text-slate-950 border-r border-slate-300">
                        {facultyDeptName}
                      </td>
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Permission Type
                      </td>
                      <td className="p-2 font-bold text-primary-dark">
                        {ticket.type === 'FACULTY_EARLY_OUT' ? 'Early Out Permission (Same Day)' : 'Full-Day Leave'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Scheduled Date
                      </td>
                      <td className="p-2 font-semibold text-slate-900 border-r border-slate-300">
                        {ticket.date || ticket.appliedDate}
                      </td>
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Time to Leave / Departure
                      </td>
                      <td className="p-2 font-bold text-slate-900">
                        {ticket.leaveTime || 'Full Day'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Purpose Stated
                      </td>
                      <td colSpan={3} className="p-2 font-semibold italic text-slate-950">
                        "{ticket.purpose || ticket.reason}"
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="w-1/4 p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Student Full Name
                      </td>
                      <td className="w-1/4 p-2 font-black text-slate-950 border-r border-slate-300">
                        {ticket.studentName}
                      </td>
                      <td className="w-1/4 p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        College Roll Number
                      </td>
                      <td className="w-1/4 p-2 font-mono font-black text-slate-950">
                        {ticket.rollNumber}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Branch & Section
                      </td>
                      <td className="p-2 font-extrabold text-slate-950 border-r border-slate-300">
                        {ticket.section}
                      </td>
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Parent Contact No.
                      </td>
                      <td className="p-2 font-mono font-black text-slate-950">
                        +91 {ticket.parentMobile}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Destination / Place
                      </td>
                      <td colSpan={3} className="p-2 font-semibold text-slate-900">
                        {ticket.destination || 'Home / Medical Emergency'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 bg-slate-50 font-bold text-slate-600 border-r border-slate-300 text-[11px]">
                        Reason Stated for Leave
                      </td>
                      <td colSpan={3} className="p-2 font-semibold italic text-slate-950">
                        "{ticket.reason}"
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Official Verification & Audit Trail */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                2. Clearance & Approval Timeline
              </h3>
              
              {isFaculty ? (
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-slate-700 uppercase">
                      <th className="p-2 text-left border-r border-slate-300 w-1/4">Stage</th>
                      <th className="p-2 text-left border-r border-slate-300 w-1/4">Authorized Officer</th>
                      <th className="p-2 text-left border-r border-slate-300 w-1/4">Timestamp</th>
                      <th className="p-2 text-left w-1/4">Status & Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-[11px]">
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">1. Faculty Application</td>
                      <td className="p-2 border-r border-slate-300">{ticket.facultyName || ticket.studentName}</td>
                      <td className="p-2 font-mono border-r border-slate-300">{ticket.appliedDate} {ticket.appliedTime}</td>
                      <td className="p-2 font-semibold text-emerald-700">Applied Online</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">2. Department Head (HOD)</td>
                      <td className="p-2 border-r border-slate-300 font-bold">
                        {isApproved 
                          ? (ticket.hodAction?.hodName || 'Head of Department (HOD)') 
                          : isRejected 
                            ? (ticket.hodAction?.hodName || 'Head of Department (HOD)') 
                            : '— (Awaiting HOD Decision)'}
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">
                        {isApproved ? `${ticket.hodAction?.displayDate || ticket.appliedDate} ${ticket.hodAction?.displayTime || ''}` : '—'}
                      </td>
                      <td className="p-2 font-black">
                        {isApproved ? (
                          <span className="text-emerald-700">✓ ACCEPTED & FORWARDED TO WATCHMAN</span>
                        ) : isRejected ? (
                          <span className="text-rose-700">✕ REJECTED BY HOD</span>
                        ) : (
                          <span className="text-amber-700">⏳ Pending HOD Review & Decision</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">3. Main Gate Security</td>
                      <td className="p-2 border-r border-slate-300 font-bold">
                        {ticket.watchmanAction?.watchmanName || 'Campus Main Gate Security'}
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">
                        {ticket.watchmanAction?.displayTime || '—'}
                      </td>
                      <td className="p-2 font-semibold">
                        {ticket.watchmanAction?.sentOut ? (
                          <span className="text-purple-700 font-bold">✓ Final Slip Generated & Departed</span>
                        ) : isApproved ? (
                          <span className="text-emerald-700 font-bold">Gate Pass Approved • Forwarded to Watchman</span>
                        ) : (
                          <span className="text-slate-400">Awaiting HOD Approval First</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-slate-700 uppercase">
                      <th className="p-2 text-left border-r border-slate-300 w-1/4">Stage</th>
                      <th className="p-2 text-left border-r border-slate-300 w-1/4">Authorized Officer</th>
                      <th className="p-2 text-left border-r border-slate-300 w-1/4">Timestamp</th>
                      <th className="p-2 text-left w-1/4">Status & Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-[11px]">
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">1. Student Application</td>
                      <td className="p-2 border-r border-slate-300">{ticket.studentName}</td>
                      <td className="p-2 font-mono border-r border-slate-300">{ticket.appliedDate} {ticket.appliedTime}</td>
                      <td className="p-2 font-semibold text-emerald-700">Submitted Online</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">2. Parent Phone Call</td>
                      <td className="p-2 border-r border-slate-300 font-bold">
                        {ticket.absentControllerAction?.controllerName || 'Absent Controller'}
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">
                        {ticket.absentControllerAction?.displayDate || ticket.appliedDate} {ticket.absentControllerAction?.displayTime || '—'}
                      </td>
                      <td className="p-2 font-semibold text-emerald-700">
                        {ticket.absentControllerAction?.confirmed 
                          ? `✓ ${ticket.absentControllerAction.remarks || 'Parent Confirmed over Phone'}`
                          : (ticket.status === 'REJECTED' ? '✕ Parent Denied' : 'Pending Verification')}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">3. Department Head (HOD)</td>
                      <td className="p-2 border-r border-slate-300 font-bold">
                        {isApproved 
                          ? (ticket.hodAction?.hodName || 'Head of Department (HOD)') 
                          : isRejected 
                            ? (ticket.hodAction?.hodName || 'Head of Department (HOD)') 
                            : '— (Awaiting HOD Decision)'}
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">
                        {isApproved ? (ticket.hodAction?.approvedAt 
                          ? new Date(ticket.hodAction.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : (ticket.hodAction?.displayTime || '—')) : '—'}
                      </td>
                      <td className="p-2 font-black">
                        {isApproved ? (
                          <span className="text-emerald-700">✓ PERMISSION GRANTED BY HOD</span>
                        ) : isRejected ? (
                          <span className="text-rose-700">✕ DENIED BY HOD</span>
                        ) : (
                          <span className="text-amber-700">⏳ Pending HOD Review & Decision</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">4. Main Gate Exit</td>
                      <td className="p-2 border-r border-slate-300 font-bold">
                        {ticket.watchmanAction?.watchmanName || 'Campus Main Gate Security'}
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">
                        {ticket.watchmanAction?.displayTime || '—'}
                      </td>
                      <td className="p-2 font-semibold">
                        {ticket.watchmanAction?.sentOut ? (
                          <span className="text-purple-700 font-bold">✓ Student Exited Campus</span>
                        ) : isApproved ? (
                          <span className="text-emerald-700 font-bold">Approved by HOD • Ready at Gate (Physical ID req.)</span>
                        ) : (
                          <span className="text-slate-400">Awaiting HOD Approval First</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Official Signatures & Seal Block */}
            <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center">
              
              {/* Signature 1 */}
              <div className="flex flex-col justify-between h-20 border border-slate-300 rounded-xl p-2 bg-slate-50/60">
                <div className="text-[9px] font-bold text-slate-500 uppercase">
                  {isFaculty ? 'Applicant' : 'Parent Verification'}
                </div>
                <div className="font-serif italic font-bold text-slate-800 text-xs truncate">
                  {isFaculty 
                    ? (ticket.facultyName || ticket.studentName)
                    : (ticket.absentControllerAction?.controllerName || 'Absent Controller')}
                </div>
                <div className="border-t border-slate-400 pt-0.5 text-[8px] font-black uppercase text-slate-700">
                  {isFaculty ? 'Faculty Signature' : 'Signature of Absent Controller'}
                </div>
              </div>

              {/* Signature 2: Official College Stamp */}
              <div className="flex flex-col items-center justify-center h-20 border border-slate-300 rounded-xl p-1.5 bg-slate-50/60">
                <div className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center text-[6px] font-black uppercase text-center p-0.5 leading-none shadow-inner ${
                  isApproved 
                    ? 'border-emerald-600 text-emerald-800' 
                    : isRejected 
                      ? 'border-rose-500 text-rose-700' 
                      : 'border-dashed border-amber-500 text-amber-700'
                }`}>
                  <span>NARASARAOPETA</span>
                  <span className="font-extrabold text-[7px] my-0.5">AUTONOMOUS</span>
                  <span>{isApproved ? 'APPROVED SEAL' : isRejected ? 'REJECTED' : 'PENDING'}</span>
                </div>
              </div>

              {/* Signature 3: Head of Department */}
              <div className={`flex flex-col justify-between h-20 border rounded-xl p-2 ${
                isApproved 
                  ? 'border-emerald-300 bg-emerald-50/50' 
                  : isRejected 
                    ? 'border-rose-300 bg-rose-50/50' 
                    : 'border-dashed border-amber-300 bg-amber-50/30'
              }`}>
                <div className="text-[9px] font-bold uppercase">
                  {isApproved ? (
                    <span className="text-emerald-700 font-black">Approved By</span>
                  ) : isRejected ? (
                    <span className="text-rose-700 font-black">Review Status</span>
                  ) : (
                    <span className="text-amber-700 font-bold">Approval Status</span>
                  )}
                </div>
                <div className="text-xs truncate">
                  {isApproved ? (
                    <div className="font-serif italic font-bold text-slate-900 leading-tight">
                      {ticket.hodAction?.hodName || 'Head of Department (HOD)'}
                    </div>
                  ) : isRejected ? (
                    <div className="text-rose-600 font-sans font-black text-[11px]">
                      Application Rejected
                    </div>
                  ) : (
                    <div className="text-amber-600 font-sans font-extrabold text-[11px]">
                      Pending HOD Approval
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-400 pt-0.5 text-[8px] font-black uppercase text-slate-700">
                  {isApproved ? (
                    <span className="text-emerald-800">✓ Head of Department (HOD)</span>
                  ) : (
                    <span>Head of Department (HOD)</span>
                  )}
                </div>
              </div>

            </div>

            {/* Security Clearance Footer */}
            <div className={`p-2 border rounded-xl text-center text-[9px] font-medium leading-tight ${
              isApproved 
                ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950' 
                : isRejected 
                  ? 'border-rose-300 bg-rose-50/40 text-rose-950' 
                  : 'border-amber-300 bg-amber-50/40 text-amber-950'
            }`}>
              {isFaculty ? (
                isApproved ? (
                  <>
                    <span className="font-black text-emerald-800">MAIN GATE SECURITY INSTRUCTION:</span> Faculty Leave / Early Out has been APPROVED by HOD and forwarded to Watchman login. No student ID verification required. Gate departure authorized.
                  </>
                ) : (
                  <>
                    <span className="font-black text-amber-800">MAIN GATE SECURITY NOTICE:</span> Leave application is PENDING HOD APPROVAL. Gate exit clearance is NOT authorized until approved by the Head of Department.
                  </>
                )
              ) : (
                isApproved ? (
                  <>
                    <span className="font-black text-emerald-800">MAIN GATE SECURITY INSTRUCTION:</span> Approved by HOD. Verify student's Physical College ID Card with Roll Number <strong>{ticket.rollNumber}</strong> before gate release.
                  </>
                ) : (
                  <>
                    <span className="font-black text-amber-800">MAIN GATE SECURITY NOTICE:</span> Leave application is PENDING HOD APPROVAL. Gate exit clearance is NOT authorized until approved by the Head of Department.
                  </>
                )
              )}
            </div>

          </div>

        </div>

        {/* Footer actions for modal (hidden on print) */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex justify-between items-center print:hidden shrink-0">
          <span className="text-xs text-customText-muted dark:text-customText-mutedDark font-medium">
            Single-page A4 official leave pass format.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary py-2 px-4 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download size={14} />
              <span>Download PDF Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

export default OutpassTicketModal;
