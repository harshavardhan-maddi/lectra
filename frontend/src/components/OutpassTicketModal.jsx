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
                  ? (ticket.type === 'FACULTY_EARLY_OUT' ? 'Faculty Early Out Final Slip' : 'Faculty Official Leave Slip')
                  : 'Official Leave Granted Slip'}
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
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 flex items-center gap-3 font-black text-xs shadow-sm print:hidden">
            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="uppercase tracking-wider block text-[10px] font-black text-amber-700 dark:text-amber-400">Important Instruction</span>
              <span>
                {isFaculty 
                  ? 'Official Final Departure Slip. Watchman directly authorizes gate exit without student ID verification.'
                  : 'Note: do not close app till goes out. Show this slip at the Main Security Gate.'}
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
                  <span className="p-1.5 rounded-lg border border-slate-300 bg-slate-50 text-[9px] font-mono font-black uppercase text-center block leading-tight">
                    {isFaculty ? <>Faculty<br />Pass</> : <>Official<br />Gate Pass</>}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between px-2 text-[11px] font-mono">
                <span><strong>PASS NO:</strong> <span className="font-black text-slate-900">{ticket.id}</span></span>
                <span className="px-3 py-0.5 rounded-full bg-slate-100 border border-slate-400 font-extrabold uppercase text-[10px] tracking-wider text-slate-900">
                  {ticket.status.replace(/_/g, ' ')}
                </span>
                <span><strong>DATE:</strong> {ticket.appliedDate} {ticket.appliedTime}</span>
              </div>
            </div>

            {/* Document Subtitle */}
            <div className="text-center py-1 bg-slate-100 border border-slate-300 rounded-lg">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">
                {isFaculty 
                  ? (ticket.type === 'FACULTY_EARLY_OUT' ? 'Official Faculty Early Out Departure Slip' : 'Official Faculty Leave & Gate Clearance Slip')
                  : 'Official Student Leave & Campus Gate Pass Slip'}
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
                        {ticket.hodAction?.hodName || 'Dr. Rajesh Sharma (HOD)'}
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">
                        {ticket.hodAction?.displayDate || ticket.appliedDate} {ticket.hodAction?.displayTime || '—'}
                      </td>
                      <td className="p-2 font-black text-emerald-700">
                        {ticket.hodAction?.granted 
                          ? '✓ ACCEPTED & FORWARDED TO WATCHMAN' 
                          : (ticket.status === 'REJECTED' ? '✕ REJECTED BY HOD' : 'Pending HOD Approval')}
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
                      <td className="p-2 font-semibold text-purple-700">
                        {ticket.watchmanAction?.sentOut ? '✓ Final Slip Generated & Departed' : (ticket.status === 'PERMISSION_GRANTED' ? 'Gate Pass Approved • Final Slip Issued' : 'Awaiting Gate Clearance')}
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
                      <td className="p-2 font-bold border-r border-slate-300 bg-slate-50">3. Department Head</td>
                      <td className="p-2 border-r border-slate-300 font-bold">
                        {ticket.hodAction?.hodName || 'Dr. Rajesh Sharma (HOD CSE)'}
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">
                        {ticket.hodAction?.approvedAt 
                          ? new Date(ticket.hodAction.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : (ticket.hodAction?.displayTime || '—')}
                      </td>
                      <td className="p-2 font-black text-emerald-700">
                        {ticket.hodAction?.granted 
                          ? '✓ PERMISSION GRANTED' 
                          : (ticket.status === 'REJECTED' ? '✕ DENIED BY HOD' : 'Pending HOD Approval')}
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
                      <td className="p-2 font-semibold text-purple-700">
                        {ticket.watchmanAction?.sentOut ? '✓ Student Exited Campus' : 'Ready at Gate (Physical ID req.)'}
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
                <div className="font-serif italic font-bold text-slate-800 text-xs">
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
                <div className="w-14 h-14 rounded-full border-2 border-primary-dark/60 flex flex-col items-center justify-center text-[6px] font-black text-primary-dark uppercase text-center p-0.5 leading-none shadow-inner">
                  <span>NARASARAOPETA</span>
                  <span className="font-extrabold text-[7px] my-0.5">AUTONOMOUS</span>
                  <span>OFFICIAL SEAL</span>
                </div>
              </div>

              {/* Signature 3: Head of Department */}
              <div className="flex flex-col justify-between h-20 border border-slate-300 rounded-xl p-2 bg-slate-50/60">
                <div className="text-[9px] font-bold text-slate-500 uppercase">
                  Approved By
                </div>
                <div className="font-serif italic font-bold text-slate-800 text-xs">
                  {ticket.hodAction?.hodName || 'Dr. Rajesh Sharma (HOD)'}
                </div>
                <div className="border-t border-slate-400 pt-0.5 text-[8px] font-black uppercase text-slate-700">
                  Head of Department (HOD)
                </div>
              </div>

            </div>

            {/* Security Clearance Footer */}
            <div className="p-2 border border-slate-400 bg-slate-50 rounded-xl text-center text-[9px] text-slate-600 font-medium leading-tight">
              {isFaculty ? (
                <>
                  <span className="font-bold text-slate-900">MAIN GATE SECURITY INSTRUCTION:</span> Faculty Gate Pass & Departure Clearance. No ID card verification required per college administration policy. Slip verified and departure authorized.
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-900">MAIN GATE SECURITY INSTRUCTION:</span> Verify student's Physical College ID Card with Roll Number <strong>{ticket.rollNumber}</strong> before gate release. Authenticated under Lectra Campus Management System.
                </>
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
