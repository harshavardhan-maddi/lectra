import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../neclogo.png';
import {
  getAllCertificateRequests,
  examCellUpdateCertificateStatus,
  subscribeToCertificates,
  syncOutpassesFromBackend,
  getExamCellStaffFromSync,
  saveExamCellStaffToSync,
  getAllOutpasses,
  subscribeToOutpasses,
  examCellApproveStaffLeave,
  examCellRejectStaffLeave,
  applyExamCellHeadLeave,
  getFacultyMonthlyLeaveUsage
} from '../services/outpassService';
import { COLLEGE_DEPARTMENTS } from './Login';
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
  X,
  Users,
  Trash2,
  Plus,
  BadgeCheck,
  Phone,
  Briefcase,
  Calendar,
  FileSpreadsheet,
  Download,
  Filter,
  Eye,
  Shield,
  BookOpen
} from 'lucide-react';

const ExamCellDashboard = () => {
  const { user, token } = useAuth();

  // Main view: 'certificates' | 'staffPermissions' | 'staffDirectory' | 'headLeave'
  const [mainView, setMainView] = useState('certificates');

  // === Certificate Requests (Marks Memos forwarded from HOD) ===
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [updatingRequest, setUpdatingRequest] = useState(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  // === Staff Permissions (Exam Cell Staff leaves) ===
  const [outpassTickets, setOutpassTickets] = useState([]);
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [rejectingTicket, setRejectingTicket] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // === Exam Cell Staff Directory ===
  const [examCellStaffList, setExamCellStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmpId, setNewStaffEmpId] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffDesignation, setNewStaffDesignation] = useState('Exam Cell Assistant');
  const [newStaffPassword, setNewStaffPassword] = useState('nrtec@nec');

  // === Head Leave Application ===
  const [showHeadLeaveModal, setShowHeadLeaveModal] = useState(false);
  const [headLeaveType, setHeadLeaveType] = useState('FACULTY_ONE_HOUR');
  const [headLeaveDate, setHeadLeaveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [headLeaveTime, setHeadLeaveTime] = useState('11:00');
  const [headLeavePurpose, setHeadLeavePurpose] = useState('');
  const [headLeaveSubmitting, setHeadLeaveSubmitting] = useState(false);
  const [headLeaveError, setHeadLeaveError] = useState('');
  const [headLeaveSuccess, setHeadLeaveSuccess] = useState('');

  // Load certificate requests
  const loadRequests = () => {
    setRequests(getAllCertificateRequests());
  };

  // Load exam cell staff from synced registry
  const loadExamCellStaff = () => {
    setStaffLoading(true);
    try {
      const staffList = getExamCellStaffFromSync();
      setExamCellStaffList(Array.isArray(staffList) ? staffList : []);
    } catch (err) {
      console.error('Failed to load exam cell staff:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    loadExamCellStaff();
    setOutpassTickets(getAllOutpasses());

    // Live sync
    const refreshData = () => {
      syncOutpassesFromBackend().then(() => {
        loadRequests();
        loadExamCellStaff();
        setOutpassTickets(getAllOutpasses());
      }).catch(() => {});
    };
    refreshData();
    const pollTimer = setInterval(refreshData, 3500);
    const unsubCerts = subscribeToCertificates(() => loadRequests());
    const unsubOutpasses = subscribeToOutpasses((tickets) => setOutpassTickets(tickets));

    const handleStaffUpdate = () => loadExamCellStaff();
    window.addEventListener('lectra_exam_cell_staff_updated', handleStaffUpdate);

    return () => {
      clearInterval(pollTimer);
      unsubCerts();
      unsubOutpasses();
      window.removeEventListener('lectra_exam_cell_staff_updated', handleStaffUpdate);
    };
  }, [token]);

  // ==========================================
  // CERTIFICATE REQUESTS (Marks Memos from HOD)
  // ==========================================
  const examCellRequests = useMemo(() => {
    return requests.filter(r => {
      if (!r) return false;
      return r.status === 'FORWARDED_TO_EXAM_CELL' ||
             (r.examCellAction && ['IN_PROGRESS', 'READY', 'ISSUED', 'REJECTED'].includes(r.status));
    });
  }, [requests]);

  const pendingCertRequests = examCellRequests.filter(r => r.status === 'FORWARDED_TO_EXAM_CELL');
  const inProgressCertRequests = examCellRequests.filter(r => r.status === 'IN_PROGRESS');
  const readyCertRequests = examCellRequests.filter(r => r.status === 'READY');
  const issuedCertRequests = examCellRequests.filter(r => r.status === 'ISSUED');

  const filteredCertRequests = examCellRequests.filter(r => {
    if (activeTab === 'PENDING' && r.status !== 'FORWARDED_TO_EXAM_CELL') return false;
    if (activeTab === 'IN_PROGRESS' && r.status !== 'IN_PROGRESS') return false;
    if (activeTab === 'READY' && r.status !== 'READY') return false;
    if (activeTab === 'ISSUED' && r.status !== 'ISSUED') return false;

    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const roll = (r.rollNumber || '').toLowerCase();
    const name = (r.studentName || '').toLowerCase();
    const cert = (r.certificateName || '').toLowerCase();
    const sec = (r.section || '').toLowerCase();
    const id = (r.id || '').toLowerCase();
    return roll.includes(q) || name.includes(q) || cert.includes(q) || sec.includes(q) || id.includes(q);
  });

  const handleCertStatusUpdate = async (req, newStatus, defaultRemarks) => {
    try {
      setActionError('');
      await examCellUpdateCertificateStatus(req.id, {
        status: newStatus,
        remarks: defaultRemarks,
        processedBy: user?.name || 'Examination Cell'
      });
      loadRequests();
      setActionSuccess(`Certificate request for ${req.studentName} updated to "${newStatus}".`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to update certificate status');
    }
  };

  const handleCustomCertStatusSubmit = async (e) => {
    e.preventDefault();
    if (!updatingRequest || !targetStatus) return;
    try {
      setActionError('');
      await examCellUpdateCertificateStatus(updatingRequest.id, {
        status: targetStatus,
        remarks: statusRemarks.trim(),
        processedBy: user?.name || 'Examination Cell'
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

  // ==========================================
  // STAFF PERMISSIONS (Exam Cell Staff leaves)
  // ==========================================
  const examCellStaffPermissions = useMemo(() => {
    return outpassTickets.filter(t => {
      if (!t) return false;
      return t.applicantType === 'EXAM_CELL_STAFF' && t.status === 'FORWARDED_TO_EXAM_CELL';
    });
  }, [outpassTickets]);

  const allExamCellPermissions = useMemo(() => {
    return outpassTickets.filter(t => {
      if (!t) return false;
      return t.applicantType === 'EXAM_CELL_STAFF' || t.applicantType === 'EXAM_CELL_HEAD' ||
             t.facultyType === 'EXAM_CELL' || t.role === 'EXAM_CELL' || t.role === 'EXAM_CELL_STAFF';
    });
  }, [outpassTickets]);

  const filteredStaffPermissions = useMemo(() => {
    const q = permSearchQuery.toLowerCase();
    return examCellStaffPermissions.filter(t => {
      if (!q) return true;
      const name = (t.facultyName || t.studentName || '').toLowerCase();
      const empId = (t.facultyUserId || t.rollNumber || '').toLowerCase();
      const id = (t.id || '').toLowerCase();
      return name.includes(q) || empId.includes(q) || id.includes(q);
    });
  }, [examCellStaffPermissions, permSearchQuery]);

  const handleApproveStaffLeave = async (ticket) => {
    try {
      setActionError('');
      await examCellApproveStaffLeave(ticket.id, {
        examCellHeadName: user?.name || 'Exam Cell Head'
      });
      setOutpassTickets(getAllOutpasses());
      setActionSuccess(`Permission approved for ${ticket.facultyName || ticket.studentName}. Forwarded to campus security.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to approve staff leave');
    }
  };

  const handleRejectStaffLeave = async () => {
    if (!rejectingTicket) return;
    try {
      setActionError('');
      await examCellRejectStaffLeave(rejectingTicket.id, {
        examCellHeadName: user?.name || 'Exam Cell Head',
        reason: rejectReason.trim() || 'Permission denied by Exam Cell Head.'
      });
      setOutpassTickets(getAllOutpasses());
      setActionSuccess(`Permission rejected for ${rejectingTicket.facultyName || rejectingTicket.studentName}.`);
      setRejectingTicket(null);
      setRejectReason('');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to reject staff leave');
    }
  };

  // ==========================================
  // EXAM CELL STAFF DIRECTORY
  // ==========================================
  const filteredStaffList = examCellStaffList.filter(s => {
    const q = staffSearchQuery.toLowerCase();
    if (!q) return true;
    const name = (s.name || '').toLowerCase();
    const empid = (s.empid || '').toLowerCase();
    const designation = (s.designation || '').toLowerCase();
    const phone = (s.phoneNumber || s.phone || '').toLowerCase();
    return name.includes(q) || empid.includes(q) || designation.includes(q) || phone.includes(q);
  });

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmpId.trim()) {
      setActionError('Staff Name and Employee ID are required.');
      return;
    }

    const existing = examCellStaffList.find(s =>
      s.empid && s.empid.toLowerCase() === newStaffEmpId.trim().toLowerCase()
    );
    if (existing) {
      setActionError('A staff member with this Employee ID already exists.');
      return;
    }

    const newStaff = {
      empid: newStaffEmpId.trim().toUpperCase(),
      loginId: newStaffEmpId.trim().toUpperCase(),
      name: newStaffName.trim(),
      phoneNumber: newStaffPhone.trim(),
      designation: newStaffDesignation.trim() || 'Exam Cell Assistant',
      facultyType: 'EXAM_CELL_STAFF',
      department: 'Examination Cell',
      password: newStaffPassword.trim() || 'nrtec@nec',
      addedAt: new Date().toISOString()
    };

    const updatedList = [...examCellStaffList, newStaff];
    await saveExamCellStaffToSync(updatedList);
    setExamCellStaffList(updatedList);

    // Also add to lectra_faculty_metadata for login purposes
    try {
      const metaList = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const alreadyExists = metaList.find(m =>
        m.empid && m.empid.toLowerCase() === newStaff.empid.toLowerCase()
      );
      if (!alreadyExists) {
        metaList.push({
          empid: newStaff.empid,
          loginId: newStaff.loginId,
          name: newStaff.name,
          mobileNumber: newStaff.phoneNumber,
          designation: newStaff.designation,
          facultyType: 'EXAM_CELL_STAFF',
          department: 'Examination Cell',
          password: newStaff.password
        });
        localStorage.setItem('lectra_faculty_metadata', JSON.stringify(metaList));
      }
    } catch (e) {}

    setShowAddStaffModal(false);
    setNewStaffName('');
    setNewStaffEmpId('');
    setNewStaffPhone('');
    setNewStaffDesignation('Exam Cell Assistant');
    setNewStaffPassword('nrtec@nec');
    setActionSuccess(`Staff member "${newStaff.name}" added to Exam Cell directory.`);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Remove "${staff.name}" (${staff.empid}) from Exam Cell directory?`)) return;
    const updatedList = examCellStaffList.filter(s => s.empid !== staff.empid);
    await saveExamCellStaffToSync(updatedList);
    setExamCellStaffList(updatedList);
    setActionSuccess(`Staff member "${staff.name}" removed.`);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  // ==========================================
  // HEAD LEAVE APPLICATION
  // ==========================================
  const headQuota = getFacultyMonthlyLeaveUsage(
    user?.userId || user?.name || 'EXAM_CELL_HEAD',
    headLeaveDate || new Date().toISOString().slice(0, 10)
  );

  const handleHeadLeaveSubmit = async (e) => {
    e.preventDefault();
    setHeadLeaveError('');
    setHeadLeaveSuccess('');

    if (headLeaveType !== 'FACULTY_OD') {
      if (headQuota.isLimitExceeded || headQuota.remaining <= 0) {
        setHeadLeaveError("Your limit for leaves has been completed, consult principal.");
        return;
      }
    }

    if (!headLeavePurpose.trim()) {
      setHeadLeaveError('Please specify a purpose for your request.');
      return;
    }

    if (headLeaveType === 'FACULTY_ONE_HOUR' && (!headLeaveTime || !headLeaveTime.trim())) {
      setHeadLeaveError('Please specify what time you need to be out for the 1-hour permission.');
      return;
    }

    try {
      setHeadLeaveSubmitting(true);
      const ticket = await applyExamCellHeadLeave({
        headUserId: user?.userId || user?.name || 'EXAM_CELL_HEAD',
        headName: user?.name || 'Exam Cell Head',
        department: 'Examination Cell',
        type: headLeaveType,
        date: headLeaveDate,
        leaveTime: headLeaveType === 'FACULTY_4PM' ? '04:00 PM' : headLeaveType === 'FACULTY_OD' ? (headLeaveTime || 'On Duty (Full Day)') : headLeaveTime,
        purpose: headLeavePurpose
      });
      setHeadLeaveSuccess(`Permission request submitted! Ref: ${ticket.id}. Forwarded to AO.`);
      setShowHeadLeaveModal(false);
      setHeadLeavePurpose('');
      setTimeout(() => setHeadLeaveSuccess(''), 5000);
    } catch (err) {
      setHeadLeaveError(err.message || 'Failed to submit permission request.');
    } finally {
      setHeadLeaveSubmitting(false);
    }
  };

  // Status badge helper
  const getStatusBadge = (status) => {
    const badges = {
      'FORWARDED_TO_EXAM_CELL': { bg: '#fef3c7', color: '#92400e', label: 'Pending Review' },
      'IN_PROGRESS': { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
      'READY': { bg: '#d1fae5', color: '#065f46', label: 'Ready for Collection' },
      'ISSUED': { bg: '#10b981', color: '#ffffff', label: 'Issued' },
      'REJECTED': { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
      'PERMISSION_GRANTED': { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
      'FORWARDED_TO_AO': { bg: '#e0e7ff', color: '#3730a3', label: 'Sent to AO' },
    };
    const b = badges[status] || { bg: '#f1f5f9', color: '#475569', label: status || 'Unknown' };
    return (
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
        fontSize: '11px', fontWeight: 700, background: b.bg, color: b.color,
        letterSpacing: '0.3px'
      }}>{b.label}</span>
    );
  };

  const getPermissionTypeLabel = (t) => {
    if (t.type === 'FACULTY_OD' || t.permissionType === 'FACULTY_OD') return 'On Duty (OD)';
    if (t.type === 'FACULTY_ONE_HOUR' || t.permissionType === 'FACULTY_ONE_HOUR') return '1-Hour Permission';
    return '4:00 PM Permission';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px'
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={logo} alt="NEC" style={{ height: 44, borderRadius: 10 }} />
            <div>
              <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: 0.5 }}>
                Examination Cell Portal
              </h1>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0, fontWeight: 600 }}>
                {user?.name || 'Exam Cell Head'} • Narasaraopeta Engineering College
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => {
              syncOutpassesFromBackend().then(() => {
                loadRequests();
                loadExamCellStaff();
                setOutpassTickets(getAllOutpasses());
              }).catch(() => {});
            }} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#e2e8f0', padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
            }}>
              <RefreshCw size={14} /> Sync
            </button>
          </div>
        </div>
      </div>

      {/* Success/Error Banners */}
      {actionSuccess && (
        <div style={{
          maxWidth: 1400, margin: '12px auto 0', padding: '10px 16px', borderRadius: 10,
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#34d399', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <CheckCircle2 size={16} /> {actionSuccess}
        </div>
      )}
      {actionError && (
        <div style={{
          maxWidth: 1400, margin: '12px auto 0', padding: '10px 16px', borderRadius: 10,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#f87171', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <AlertCircle size={16} /> {actionError}
          <button onClick={() => setActionError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}
      {headLeaveSuccess && (
        <div style={{
          maxWidth: 1400, margin: '12px auto 0', padding: '10px 16px', borderRadius: 10,
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#34d399', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <CheckCircle2 size={16} /> {headLeaveSuccess}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ maxWidth: 1400, margin: '16px auto 0', padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'certificates', icon: <BookOpen size={15} />, label: 'Marks Memos & Certificates', count: pendingCertRequests.length },
            { key: 'staffPermissions', icon: <Shield size={15} />, label: 'Staff Permissions', count: examCellStaffPermissions.length },
            { key: 'staffDirectory', icon: <Users size={15} />, label: 'Exam Cell Staff', count: examCellStaffList.length },
            { key: 'headLeave', icon: <Send size={15} />, label: 'My Permissions', count: null },
          ].map(tab => (
            <button key={tab.key} onClick={() => setMainView(tab.key)} style={{
              padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
              background: mainView === tab.key ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.08)',
              color: mainView === tab.key ? '#fff' : '#94a3b8',
              transition: 'all 0.2s'
            }}>
              {tab.icon} {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span style={{
                  background: mainView === tab.key ? 'rgba(255,255,255,0.25)' : '#ef4444',
                  color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1400, margin: '16px auto', padding: '0 20px 40px' }}>

        {/* ========== TAB 1: MARKS MEMOS & CERTIFICATES ========== */}
        {mainView === 'certificates' && (
          <div>
            {/* Sub-filter tabs */}
            <div style={{
              display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap'
            }}>
              {[
                { key: 'ALL', label: 'All', count: examCellRequests.length },
                { key: 'PENDING', label: 'Pending', count: pendingCertRequests.length },
                { key: 'IN_PROGRESS', label: 'In Progress', count: inProgressCertRequests.length },
                { key: 'READY', label: 'Ready', count: readyCertRequests.length },
                { key: 'ISSUED', label: 'Issued', count: issuedCertRequests.length },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  background: activeTab === tab.key ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                  color: activeTab === tab.key ? '#a5b4fc' : '#64748b'
                }}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 16, maxWidth: 400 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#64748b' }} />
              <input
                type="text" placeholder="Search by roll, name, certificate..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 36px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none'
                }}
              />
            </div>

            {filteredCertRequests.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 20px', color: '#64748b',
                background: 'rgba(255,255,255,0.03)', borderRadius: 16
              }}>
                <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 700 }}>No certificate requests found</p>
                <p style={{ fontSize: 12 }}>Marks memo and certificate requests forwarded by HOD will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredCertRequests.map(req => (
                  <div key={req.id} style={{
                    background: 'rgba(255,255,255,0.05)', borderRadius: 14,
                    padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{req.id}</span>
                          {getStatusBadge(req.status)}
                        </div>
                        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '4px 0' }}>
                          {req.studentName || 'Student'}
                        </h3>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                          <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <GraduationCap size={13} /> {req.rollNumber}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building size={13} /> {req.section || req.department || '-'}
                          </span>
                          <span style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={13} /> {req.certificateName}
                          </span>
                        </div>
                        {req.reason && (
                          <p style={{ color: '#64748b', fontSize: 12, margin: '6px 0 0', fontStyle: 'italic' }}>
                            Reason: {req.reason}
                          </p>
                        )}
                        {req.hodAction && (
                          <p style={{ color: '#64748b', fontSize: 11, margin: '4px 0 0' }}>
                            HOD: {req.hodAction.hodName} • {req.hodAction.displayDate} {req.hodAction.displayTime}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {req.status === 'FORWARDED_TO_EXAM_CELL' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => handleCertStatusUpdate(req, 'IN_PROGRESS', 'Certificate processing started by Examination Cell.')} style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <Clock size={13} /> Start Processing
                          </button>
                          <button onClick={() => handleCertStatusUpdate(req, 'ISSUED', 'Certificate issued directly by Examination Cell.')} style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <CheckCircle2 size={13} /> Issue Now
                          </button>
                        </div>
                      )}
                      {req.status === 'IN_PROGRESS' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => handleCertStatusUpdate(req, 'READY', 'Certificate ready for student collection.')} style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: '#8b5cf6', color: '#fff', fontSize: 12, fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <PackageCheck size={13} /> Mark Ready
                          </button>
                          <button onClick={() => handleCertStatusUpdate(req, 'ISSUED', 'Certificate issued by Examination Cell.')} style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <CheckCircle2 size={13} /> Issue
                          </button>
                        </div>
                      )}
                      {req.status === 'READY' && (
                        <button onClick={() => handleCertStatusUpdate(req, 'ISSUED', 'Certificate collected and issued to student.')} style={{
                          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <BadgeCheck size={13} /> Issue Certificate
                        </button>
                      )}
                      {req.status === 'ISSUED' && (
                        <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <BadgeCheck size={14} /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== TAB 2: STAFF PERMISSIONS ========== */}
        {mainView === 'staffPermissions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0 }}>
                Exam Cell Staff Permission Requests
              </h2>
              <div style={{ position: 'relative', minWidth: 240 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#64748b' }} />
                <input
                  type="text" placeholder="Search staff..."
                  value={permSearchQuery} onChange={e => setPermSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 36px', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
                    color: '#e2e8f0', fontSize: 13, outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Pending Requests */}
            {filteredStaffPermissions.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 20px', color: '#64748b',
                background: 'rgba(255,255,255,0.03)', borderRadius: 16
              }}>
                <Shield size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 700 }}>No pending staff permission requests</p>
                <p style={{ fontSize: 12 }}>Exam Cell staff permission requests will appear here when submitted.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredStaffPermissions.map(ticket => (
                  <div key={ticket.id} style={{
                    background: 'rgba(255,255,255,0.05)', borderRadius: 14,
                    padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{ticket.id}</span>
                          <span style={{
                            background: '#fef3c7', color: '#92400e', padding: '2px 10px',
                            borderRadius: 999, fontSize: 11, fontWeight: 700
                          }}>Pending Approval</span>
                        </div>
                        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '4px 0' }}>
                          {ticket.facultyName || ticket.studentName || 'Exam Cell Staff'}
                        </h3>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                          <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Briefcase size={13} /> {getPermissionTypeLabel(ticket)}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={13} /> {ticket.date}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={13} /> {ticket.leaveTime || ticket.outTime || '-'}
                          </span>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: 12, margin: '6px 0 0' }}>
                          <strong>Purpose:</strong> {ticket.purpose || ticket.reason || '-'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleApproveStaffLeave(ticket)} style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <Check size={14} /> Accept
                        </button>
                        <button onClick={() => { setRejectingTicket(ticket); setRejectReason(''); }} style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All exam cell permissions history */}
            {allExamCellPermissions.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                  All Exam Cell Permission History ({allExamCellPermissions.length})
                </h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {allExamCellPermissions.filter(t => t.status !== 'FORWARDED_TO_EXAM_CELL').slice(0, 20).map(ticket => (
                    <div key={ticket.id} style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                      padding: '10px 16px', border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
                    }}>
                      <div>
                        <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>
                          {ticket.facultyName || ticket.studentName || 'Staff'}
                        </span>
                        <span style={{ color: '#64748b', fontSize: 11, marginLeft: 8 }}>
                          {ticket.date} • {getPermissionTypeLabel(ticket)}
                        </span>
                      </div>
                      {getStatusBadge(ticket.status)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== TAB 3: EXAM CELL STAFF DIRECTORY ========== */}
        {mainView === 'staffDirectory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0 }}>
                Exam Cell Staff Directory ({examCellStaffList.length})
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', minWidth: 200 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#64748b' }} />
                  <input
                    type="text" placeholder="Search staff..."
                    value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px 8px 36px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0', fontSize: 13, outline: 'none'
                    }}
                  />
                </div>
                <button onClick={() => setShowAddStaffModal(true)} style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                  fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <Plus size={14} /> Add Staff
                </button>
              </div>
            </div>

            {filteredStaffList.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 20px', color: '#64748b',
                background: 'rgba(255,255,255,0.03)', borderRadius: 16
              }}>
                <Users size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 700 }}>No staff members found</p>
                <p style={{ fontSize: 12 }}>Click "Add Staff" to register Exam Cell staff members.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {filteredStaffList.map((staff, idx) => (
                  <div key={staff.empid || idx} style={{
                    background: 'rgba(255,255,255,0.05)', borderRadius: 14,
                    padding: '16px', border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
                          {staff.name}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <BadgeCheck size={12} /> {staff.empid || staff.loginId}
                        </p>
                        <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Briefcase size={11} /> {staff.designation || 'Exam Cell Staff'}
                        </p>
                        {(staff.phoneNumber || staff.phone) && (
                          <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={11} /> {staff.phoneNumber || staff.phone}
                          </p>
                        )}
                        <p style={{ color: '#475569', fontSize: 10, margin: '4px 0 0' }}>
                          Password: {staff.password || 'nrtec@nec'}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteStaff(staff)} style={{
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171', padding: '6px', borderRadius: 8, cursor: 'pointer'
                      }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== TAB 4: HEAD LEAVE (My Permissions) ========== */}
        {mainView === 'headLeave' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0 }}>
                My Permission Requests
              </h2>
              <button onClick={() => setShowHeadLeaveModal(true)} style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Send size={14} /> Apply for Permission
              </button>
            </div>

            {/* Head's own leave history */}
            {(() => {
              const headTickets = outpassTickets.filter(t =>
                t && (t.applicantType === 'EXAM_CELL_HEAD' ||
                (t.facultyType === 'EXAM_CELL' && t.role === 'EXAM_CELL' && (
                  (t.facultyUserId || '').toLowerCase() === (user?.userId || '').toLowerCase() ||
                  (t.facultyName || '').toLowerCase() === (user?.name || '').toLowerCase()
                )))
              );

              if (headTickets.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center', padding: '48px 20px', color: '#64748b',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 16
                  }}>
                    <Send size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: 15, fontWeight: 700 }}>No permission requests yet</p>
                    <p style={{ fontSize: 12 }}>Use "Apply for Permission" to request 1-Hour, 4PM, or OD permission. It goes directly to the AO.</p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gap: 10 }}>
                  {headTickets.map(ticket => (
                    <div key={ticket.id} style={{
                      background: 'rgba(255,255,255,0.05)', borderRadius: 14,
                      padding: '14px 20px', border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{ticket.id}</span>
                          {getStatusBadge(ticket.status)}
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                          <span style={{ color: '#e2e8f0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Briefcase size={13} /> {getPermissionTypeLabel(ticket)}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={13} /> {ticket.date}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={13} /> {ticket.leaveTime || ticket.outTime || '-'}
                          </span>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>
                          {ticket.purpose || ticket.reason || '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Monthly Quota Info */}
            <div style={{
              marginTop: 20, padding: '14px 20px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, margin: 0 }}>
                Monthly Leave Quota: <span style={{ color: headQuota.remaining > 0 ? '#34d399' : '#f87171', fontWeight: 800 }}>
                  {headQuota.remaining} / 2 remaining
                </span> (Used: {headQuota.used}) — OD permissions are unlimited
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ========== MODALS ========== */}

      {/* Reject Staff Leave Modal */}
      {rejectingTicket && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>
              Reject Permission
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 16px' }}>
              Rejecting permission for <strong style={{ color: '#f87171' }}>{rejectingTicket.facultyName || rejectingTicket.studentName}</strong>
            </p>
            <textarea
              placeholder="Reason for rejection (optional)..."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectingTicket(null)} style={{
                padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={handleRejectStaffLeave} style={{
                padding: '8px 20px', borderRadius: 10, border: 'none',
                background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>
              Add Exam Cell Staff
            </h3>
            <form onSubmit={handleAddStaff}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Full Name *</label>
                  <input
                    type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} required
                    placeholder="e.g. John Doe"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0', fontSize: 13, outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Employee ID (Login ID) *</label>
                  <input
                    type="text" value={newStaffEmpId} onChange={e => setNewStaffEmpId(e.target.value)} required
                    placeholder="e.g. EC001"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0', fontSize: 13, outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Phone Number</label>
                  <input
                    type="text" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0', fontSize: 13, outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Designation</label>
                  <input
                    type="text" value={newStaffDesignation} onChange={e => setNewStaffDesignation(e.target.value)}
                    placeholder="e.g. Exam Cell Assistant"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0', fontSize: 13, outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Password (for login)</label>
                  <input
                    type="text" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)}
                    placeholder="Default: nrtec@nec"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0', fontSize: 13, outline: 'none'
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} style={{
                  padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}>Cancel</button>
                <button type="submit" style={{
                  padding: '8px 20px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}>Add Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Head Leave Application Modal */}
      {showHeadLeaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>
              Apply for Permission
            </h3>
            <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 16px' }}>
              Exam Cell Head • Request goes directly to AO
            </p>

            {headLeaveError && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 12,
                fontWeight: 600, marginBottom: 12
              }}>{headLeaveError}</div>
            )}

            <form onSubmit={handleHeadLeaveSubmit}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Permission Type</label>
                  <select value={headLeaveType} onChange={e => setHeadLeaveType(e.target.value)} style={{
                    width: '100%', padding: '8px 12px', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a',
                    color: '#e2e8f0', fontSize: 13
                  }}>
                    <option value="FACULTY_ONE_HOUR">1-Hour Permission</option>
                    <option value="FACULTY_4PM">4:00 PM Permission</option>
                    <option value="FACULTY_OD">On Duty (OD) - Unlimited</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Date</label>
                  <input
                    type="date" value={headLeaveDate} onChange={e => setHeadLeaveDate(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a',
                      color: '#e2e8f0', fontSize: 13
                    }}
                  />
                </div>
                {headLeaveType === 'FACULTY_ONE_HOUR' && (
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Out Time</label>
                    <input
                      type="time" value={headLeaveTime} onChange={e => setHeadLeaveTime(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a',
                        color: '#e2e8f0', fontSize: 13
                      }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>Purpose *</label>
                  <textarea
                    value={headLeavePurpose} onChange={e => setHeadLeavePurpose(e.target.value)}
                    placeholder="Specify the purpose of your permission request..."
                    rows={3} required
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                color: '#a5b4fc', fontSize: 11, fontWeight: 600
              }}>
                Monthly Quota: {headQuota.remaining} / 2 remaining (OD is unlimited)
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowHeadLeaveModal(false); setHeadLeaveError(''); }} style={{
                  padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}>Cancel</button>
                <button type="submit" disabled={headLeaveSubmitting} style={{
                  padding: '8px 20px', borderRadius: 10, border: 'none',
                  background: headLeaveSubmitting ? '#475569' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: headLeaveSubmitting ? 'not-allowed' : 'pointer'
                }}>{headLeaveSubmitting ? 'Submitting...' : 'Submit to AO'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamCellDashboard;
