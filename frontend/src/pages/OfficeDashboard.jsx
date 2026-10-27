import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllCertificateRequests, 
  updateCertificateStatus, 
  subscribeToCertificates 
} from '../services/outpassService';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  User, 
  Building, 
  GraduationCap, 
  Printer, 
  RefreshCw, 
  ArrowRight,
  Send,
  PackageCheck,
  Check,
  X
} from 'lucide-react';

const OfficeDashboard = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'READY' | 'ISSUED' | 'REJECTED'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Selected request for certificate slip / preview modal
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Status update modal / reject modal
  const [updatingRequest, setUpdatingRequest] = useState(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  const loadRequests = () => {
    setRequests(getAllCertificateRequests());
  };

  useEffect(() => {
    loadRequests();
    const unsub = subscribeToCertificates(setRequests);
    return () => unsub();
  }, []);

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const inProgressRequests = requests.filter(r => r.status === 'IN_PROGRESS' || r.status === 'APPROVED');
  const readyRequests = requests.filter(r => r.status === 'READY');
  const issuedRequests = requests.filter(r => r.status === 'ISSUED');

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'PENDING' && r.status !== 'PENDING') return false;
    if (activeTab === 'IN_PROGRESS' && (r.status !== 'IN_PROGRESS' && r.status !== 'APPROVED')) return false;
    if (activeTab === 'READY' && r.status !== 'READY') return false;
    if (activeTab === 'ISSUED' && r.status !== 'ISSUED') return false;
    if (activeTab === 'REJECTED' && r.status !== 'REJECTED') return false;

    const q = searchQuery.toLowerCase();
    const roll = (r.rollNumber || '').toLowerCase();
    const name = (r.studentName || '').toLowerCase();
    const cert = (r.certificateName || '').toLowerCase();
    const sec = (r.section || '').toLowerCase();
    const id = (r.id || '').toLowerCase();

    return roll.includes(q) || name.includes(q) || cert.includes(q) || sec.includes(q) || id.includes(q);
  });

  const handleQuickStatusUpdate = async (req, newStatus, defaultRemarks) => {
    try {
      setActionError('');
      await updateCertificateStatus(req.id, {
        status: newStatus,
        remarks: defaultRemarks,
        processedBy: user?.name || 'Administrative Office'
      });
      loadRequests();
      setActionSuccess(`Certificate request for ${req.studentName} updated to "${newStatus}".`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to update certificate status');
    }
  };

  const handleCustomStatusSubmit = async (e) => {
    e.preventDefault();
    if (!updatingRequest || !targetStatus) return;

    try {
      setActionError('');
      await updateCertificateStatus(updatingRequest.id, {
        status: targetStatus,
        remarks: statusRemarks.trim(),
        processedBy: user?.name || 'Administrative Office'
      });
      loadRequests();
      setActionSuccess(`Certificate request ${updatingRequest.id} updated successfully.`);
      setUpdatingRequest(null);
      setTargetStatus('');
      setStatusRemarks('');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs border border-amber-500/20 flex items-center gap-1.5">
            <Clock size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
            Pending Office Review
          </span>
        );
      case 'APPROVED':
      case 'IN_PROGRESS':
        return (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs border border-blue-500/20 flex items-center gap-1.5">
            <FileText size={12} />
            Under Preparation / Signed
          </span>
        );
      case 'READY':
        return (
          <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-xs border border-purple-500/20 flex items-center gap-1.5">
            <PackageCheck size={12} />
            Ready for Collection at Counter
          </span>
        );
      case 'ISSUED':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            Issued & Handed Over
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs border border-rose-500/20 flex items-center gap-1.5">
            <XCircle size={12} />
            Request Rejected
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
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                <FileText size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-customText dark:text-customText-dark tracking-tight">
                  Administrative Office • Student Certificate Portal
                </h1>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Manage student requests for Bonafide, Study, Custodian, Transfer Certificates (TC), and Official NOCs
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadRequests}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
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
              New / Pending Review
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {pendingRequests.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
              Under Preparation
            </span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {inProgressRequests.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-1">
              Ready at Counter
            </span>
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {readyRequests.length}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
              Issued / Completed
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {issuedRequests.length}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
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

      {/* Tabs and Search */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: `All Requests (${requests.length})` },
            { id: 'PENDING', label: `Pending (${pendingRequests.length})` },
            { id: 'IN_PROGRESS', label: `Preparing (${inProgressRequests.length})` },
            { id: 'READY', label: `Ready for Collection (${readyRequests.length})` },
            { id: 'ISSUED', label: `Issued (${issuedRequests.length})` },
            { id: 'REJECTED', label: 'Rejected' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
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
            placeholder="Search Roll No, Name, Cert Type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Certificate Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-customText-muted">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-black text-customText dark:text-customText-dark">
              No certificate requests found
            </h3>
            <p className="text-xs text-customText-muted max-w-md mx-auto">
              Students can request any certificate from the main landing page, and they will appear here instantly.
            </p>
          </div>
        ) : (
          filteredRequests.map(req => {
            const isPending = req.status === 'PENDING';
            const isInProgress = req.status === 'IN_PROGRESS' || req.status === 'APPROVED';
            const isReady = req.status === 'READY';
            const isIssued = req.status === 'ISSUED';

            return (
              <div
                key={req.id}
                className={`glass-card p-5 rounded-2xl border transition-all ${
                  isPending 
                    ? 'border-amber-500/40 shadow-lg shadow-amber-500/5 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent' 
                    : isReady
                      ? 'border-purple-500/40 shadow-md shadow-purple-500/5 bg-gradient-to-r from-purple-500/5 via-transparent to-transparent'
                      : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Certificate Name & Student particulars */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                        {req.id}
                      </span>

                      {/* Certificate Name Tag */}
                      <span className="px-3 py-0.5 rounded-md text-xs font-black bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                        📜 {req.certificateName}
                      </span>

                      {getStatusBadge(req.status)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                      <div className="flex items-center gap-2">
                        <GraduationCap size={16} className="text-customText-muted shrink-0" />
                        <div>
                          <span className="text-[10px] text-customText-muted uppercase font-bold block">Student</span>
                          <span className="font-black text-customText dark:text-customText-dark">
                            {req.studentName}
                          </span>
                          <span className="text-primary font-mono font-bold block text-[11px]">
                            {req.rollNumber}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Building size={16} className="text-customText-muted shrink-0" />
                        <div>
                          <span className="text-[10px] text-customText-muted uppercase font-bold block">Section / Class</span>
                          <span className="font-bold text-customText dark:text-customText-dark">
                            {req.section || 'General'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-customText-muted shrink-0" />
                        <div>
                          <span className="text-[10px] text-customText-muted uppercase font-bold block">Applied On</span>
                          <span className="font-bold text-customText dark:text-customText-dark">
                            {req.appliedDate} {req.appliedTime}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stated Purpose */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                      <span className="font-bold text-customText-muted mr-1.5 uppercase text-[10px]">Purpose / Reason:</span>
                      <span className="font-semibold text-customText dark:text-customText-dark">
                        {req.reason || 'Official academic requirement'}
                      </span>
                    </div>

                    {/* Office Action Trail */}
                    {req.officeAction && (
                      <div className="text-[11px] text-customText-muted flex items-center gap-2 pt-0.5">
                        <span className="font-bold">Office Remarks:</span>
                        <span>{req.officeAction.remarks || req.officeAction.status} ({req.officeAction.displayDate} {req.officeAction.displayTime})</span>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    {isPending && (
                      <button
                        onClick={() => handleQuickStatusUpdate(req, 'IN_PROGRESS', 'Certificate approved and currently under verification / signature.')}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Accept & Process</span>
                      </button>
                    )}

                    {isInProgress && (
                      <button
                        onClick={() => handleQuickStatusUpdate(req, 'READY', 'Certificate signed and ready for pickup at administrative office counter.')}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <PackageCheck size={14} />
                        <span>Mark Ready for Pickup</span>
                      </button>
                    )}

                    {isReady && (
                      <button
                        onClick={() => handleQuickStatusUpdate(req, 'ISSUED', 'Certificate handed over to student at office counter.')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Issued to Student</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-customText flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Print Certificate Slip"
                      >
                        <Printer size={13} />
                        <span>Print Slip</span>
                      </button>

                      <button
                        onClick={() => {
                          setUpdatingRequest(req);
                          setTargetStatus(req.status === 'PENDING' ? 'REJECTED' : 'READY');
                          setStatusRemarks('');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-customText-muted hover:text-customText transition-colors cursor-pointer"
                      >
                        <span>Change Status</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Status Modification Modal */}
      {updatingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-customText dark:text-customText-dark">
                Update Certificate Request Status
              </h3>
              <button 
                onClick={() => setUpdatingRequest(null)}
                className="p-1 rounded-lg text-customText-muted hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-customText-muted">
              Updating for <strong className="text-customText dark:text-customText-dark">{updatingRequest.studentName}</strong> ({updatingRequest.rollNumber})
              <br />Certificate: <strong className="text-primary">{updatingRequest.certificateName}</strong>
            </div>

            <form onSubmit={handleCustomStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  New Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full glass-input text-xs py-2.5"
                >
                  <option value="PENDING">Pending Office Review</option>
                  <option value="IN_PROGRESS">Under Preparation / Verification</option>
                  <option value="READY">Ready for Collection at Counter</option>
                  <option value="ISSUED">Issued to Student (Closed)</option>
                  <option value="REJECTED">Reject Request</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Office Notes / Remarks
                </label>
                <textarea
                  rows={3}
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="Optional remarks visible to student (e.g. Please collect with ID card from Counter 2...)"
                  className="w-full glass-input text-xs py-2.5 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setUpdatingRequest(null)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-5 text-xs font-black shadow-md cursor-pointer"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Certificate Request Slip Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-xl p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-6">
            <div className="text-center border-b pb-4 border-slate-200 dark:border-slate-800 space-y-1">
              <h2 className="text-xl font-black text-primary uppercase tracking-tight">
                Narasaraopeta Engineering College
              </h2>
              <p className="text-xs font-bold text-customText-muted uppercase tracking-wider">
                Kotappakonda Road, Yellamanda (P.O), Narasaraopet - 522601
              </p>
              <p className="text-[11px] font-black text-slate-500 uppercase pt-1">
                Administrative Office • Student Certificate Request Slip
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-customText-muted uppercase text-[10px]">Reference Number:</span>
                <span className="font-mono font-black text-primary text-sm">{selectedRequest.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-customText-muted uppercase block font-bold">Student Name</span>
                  <span className="font-black text-sm text-customText dark:text-customText-dark">{selectedRequest.studentName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-customText-muted uppercase block font-bold">Roll Number</span>
                  <span className="font-mono font-black text-sm text-primary">{selectedRequest.rollNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-customText-muted uppercase block font-bold">Department / Section</span>
                  <span className="font-semibold text-customText dark:text-customText-dark">{selectedRequest.section || 'General'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-customText-muted uppercase block font-bold">Date of Request</span>
                  <span className="font-semibold text-customText dark:text-customText-dark">{selectedRequest.appliedDate} {selectedRequest.appliedTime}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-customText-muted uppercase block font-bold">Certificate Requested</span>
                <span className="font-black text-base text-indigo-600 dark:text-indigo-400">
                  {selectedRequest.certificateName}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-customText-muted uppercase block font-bold">Stated Purpose</span>
                <span className="font-medium text-customText dark:text-customText-dark">{selectedRequest.reason || 'Academic requirement'}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-[10px] text-customText-muted uppercase font-bold">Current Processing State</span>
                <span>{getStatusBadge(selectedRequest.status)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-customText-muted">Verified by Office Staff</span>
              <span className="text-xs font-bold text-customText dark:text-customText-dark underline">
                Authorised Signatory
              </span>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={() => window.print()}
                className="btn-primary flex-1 py-3 text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Printer size={16} />
                <span>Print Document Slip</span>
              </button>
              <button
                onClick={() => setSelectedRequest(null)}
                className="btn-secondary py-3 px-6 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeDashboard;
