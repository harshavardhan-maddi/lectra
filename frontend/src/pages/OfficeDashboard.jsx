import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../neclogo.png';
import { 
  getAllCertificateRequests, 
  updateCertificateStatus, 
  deleteCertificateRequest,
  addCertificateTicketByOffice,
  subscribeToCertificates,
  syncOutpassesFromBackend,
  getOfficeStaffFromSync,
  getAllOutpasses,
  subscribeToOutpasses,
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
  Eye
} from 'lucide-react';

const OfficeDashboard = () => {
  const { user, token } = useAuth();
  
  // Main view switcher: 'certificates' | 'staff' | 'facultyPermissions'
  const [mainView, setMainView] = useState('certificates');

  // Faculty Permissions Report State
  const [outpassTickets, setOutpassTickets] = useState([]);
  const [permFilterMode, setPermFilterMode] = useState('daily'); // 'daily' | 'range' | 'all'
  const [permSelectedDate, setPermSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [permStartDate, setPermStartDate] = useState('');
  const [permEndDate, setPermEndDate] = useState('');
  const [permSelectedDept, setPermSelectedDept] = useState('ALL');
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [selectedFacultyQuotaModal, setSelectedFacultyQuotaModal] = useState(null);

  // Certificate requests state
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'FORWARDED' | 'IN_PROGRESS' | 'READY' | 'ISSUED' | 'REJECTED'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Selected request for certificate slip / preview modal
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Status update modal / reject modal
  const [updatingRequest, setUpdatingRequest] = useState(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  // Office Staff Directory states (Added by AO)
  const [officeStaffList, setOfficeStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Add Ticket Modal states
  const [showAddTicketModal, setShowAddTicketModal] = useState(false);
  const [newRollNumber, setNewRollNumber] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newCertificateName, setNewCertificateName] = useState('Bonafide Certificate');
  const [newReason, setNewReason] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const loadRequests = () => {
    setRequests(getAllCertificateRequests());
  };

  const loadOfficeStaff = async () => {
    setStaffLoading(true);
    try {
      // 1. Fetch metadata from outpass sync store / backend database for multi-device sync
      let metadataList = [];

      const syncedStaff = getOfficeStaffFromSync();
      if (Array.isArray(syncedStaff) && syncedStaff.length > 0) {
        metadataList = [...syncedStaff];
      }

      if (token) {
        try {
          const metaRes = await fetch('/api/faculty/office-metadata', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (metaRes.ok) {
            const remoteMeta = await metaRes.json();
            if (Array.isArray(remoteMeta) && remoteMeta.length > 0) {
              const existingMap = new Map();
              metadataList.forEach(item => {
                const k = (item.empid || item.name || '').toLowerCase();
                if (k) existingMap.set(k, item);
              });
              remoteMeta.forEach(item => {
                const k = (item.empid || item.name || '').toLowerCase();
                if (k) existingMap.set(k, { ...existingMap.get(k), ...item });
              });
              metadataList = Array.from(existingMap.values());
              localStorage.setItem('lectra_faculty_metadata', JSON.stringify(metadataList));
            }
          }
        } catch (mErr) {
          console.warn('Backend office metadata fetch error in Office Dashboard:', mErr);
        }
      }

      if (metadataList.length === 0) {
        try {
          metadataList = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
        } catch (e) {
          metadataList = [];
        }
      }

      let backendList = [];
      if (token) {
        try {
          const res = await fetch('/api/faculty', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            backendList = await res.json();
          }
        } catch (e) {
          console.warn('Backend faculty fetch error in Office Dashboard:', e);
        }
      }

      const officeMetadata = metadataList.filter(m => 
        m.facultyType === 'OFFICE' || 
        (m.department && m.department.toLowerCase().includes('office'))
      );

      const mergedMap = new Map();

      officeMetadata.forEach(m => {
        const key = (m.empid || m.name || '').toLowerCase();
        mergedMap.set(key, {
          id: m.id || null,
          empid: m.empid || m.loginId || 'OFFICE',
          loginId: m.loginId || m.empid || 'OFFICE',
          name: m.name || 'Office Staff',
          phoneNumber: m.mobileNumber || m.phoneNumber || '',
          designation: m.designation || 'Office Assistant',
          facultyType: 'OFFICE',
          department: m.department || 'Administrative Office',
          password: m.password || 'nrtec@nec',
          updatedAt: m.updatedAt || new Date().toISOString()
        });
      });

      (backendList || []).forEach(f => {
        const isOfficeDept = f.department && f.department.toLowerCase().includes('office');
        const matchMeta = officeMetadata.find(m => 
          (m.name && m.name.toLowerCase() === f.facultyName?.toLowerCase()) ||
          (m.mobileNumber && f.phoneNumber && m.mobileNumber === f.phoneNumber)
        );

        if (isOfficeDept || matchMeta) {
          const key = (matchMeta?.empid || f.facultyName || '').toLowerCase();
          const existing = mergedMap.get(key) || {};
          mergedMap.set(key, {
            ...existing,
            id: f.id,
            name: f.facultyName,
            phoneNumber: f.phoneNumber || existing.phoneNumber || '',
            empid: existing.empid || matchMeta?.empid || `OFF${f.id || '101'}`,
            loginId: existing.loginId || matchMeta?.empid || `OFF${f.id || '101'}`,
            designation: existing.designation || matchMeta?.designation || 'Senior Assistant',
            department: f.department || existing.department || 'Administrative Office',
            facultyType: 'OFFICE',
            password: 'nrtec@nec',
          });
        }
      });

      setOfficeStaffList(Array.from(mergedMap.values()));
    } catch (err) {
      console.error('Failed to load office staff in OfficeDashboard:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    loadOfficeStaff();
    setOutpassTickets(getAllOutpasses());
    // Live multi-device sync on mount and auto-poll every 3.5 seconds
    const refreshData = () => {
      syncOutpassesFromBackend().then(() => {
        loadRequests();
        setOutpassTickets(getAllOutpasses());
      }).catch(() => {});
    };
    refreshData();
    const pollTimer = setInterval(refreshData, 3500);
    const unsub = subscribeToCertificates(setRequests);
    const unsubOutpasses = subscribeToOutpasses(setOutpassTickets);

    const handleOfficeStaffUpdate = () => {
      loadOfficeStaff();
    };
    window.addEventListener('lectra_office_staff_updated', handleOfficeStaffUpdate);

    return () => {
      clearInterval(pollTimer);
      unsub();
      unsubOutpasses();
      window.removeEventListener('lectra_office_staff_updated', handleOfficeStaffUpdate);
    };
  }, [token]);

  // Only requests where AO has clicked Accept come to Office login
  const aoApprovedRequests = useMemo(() => {
    return requests.filter(r => {
      if (!r) return false;
      // AO must have approved/accepted the request:
      const isAoAccepted = r.status === 'ACCEPTED' || (r.aoAction && r.aoAction.granted);
      // Or already processed/issued by Office
      const isOfficeIssued = r.status === 'ISSUED';
      const isOfficeActive = r.status === 'IN_PROGRESS' || r.status === 'READY';
      const isOfficeManual = r.status === 'FORWARDED_TO_OFFICE';
      return isAoAccepted || isOfficeIssued || isOfficeActive || isOfficeManual;
    });
  }, [requests]);

  // Certificate categories (Only after AO approval)
  const forwardedRequests = aoApprovedRequests.filter(r => 
    r.status === 'ACCEPTED' || r.status === 'FORWARDED_TO_OFFICE'
  );
  const inProgressRequests = aoApprovedRequests.filter(r => r.status === 'IN_PROGRESS' || r.status === 'APPROVED');
  const readyRequests = aoApprovedRequests.filter(r => r.status === 'READY');
  const issuedRequests = aoApprovedRequests.filter(r => r.status === 'ISSUED');

  const filteredRequests = aoApprovedRequests.filter(r => {
    if (activeTab === 'FORWARDED' && !(r.status === 'ACCEPTED' || r.status === 'FORWARDED_TO_OFFICE')) return false;
    if (activeTab === 'IN_PROGRESS' && (r.status !== 'IN_PROGRESS' && r.status !== 'APPROVED')) return false;
    if (activeTab === 'READY' && r.status !== 'READY') return false;
    if (activeTab === 'ISSUED' && r.status !== 'ISSUED') return false;

    const q = searchQuery.toLowerCase();
    const roll = (r.rollNumber || '').toLowerCase();
    const name = (r.studentName || '').toLowerCase();
    const cert = (r.certificateName || '').toLowerCase();
    const sec = (r.section || '').toLowerCase();
    const id = (r.id || '').toLowerCase();

    return roll.includes(q) || name.includes(q) || cert.includes(q) || sec.includes(q) || id.includes(q);
  });

  const filteredStaffList = officeStaffList.filter(s => {
    const q = staffSearchQuery.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const empid = (s.empid || '').toLowerCase();
    const designation = (s.designation || '').toLowerCase();
    const phone = (s.phoneNumber || '').toLowerCase();
    return name.includes(q) || empid.includes(q) || designation.includes(q) || phone.includes(q);
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

  // Faculty & Staff Permissions List Filter
  const facultyPermissionTickets = useMemo(() => {
    return outpassTickets.filter(t => {
      if (!t) return false;
      const isFaculty = t.applicantType === 'FACULTY' || t.applicantType === 'HOD' || t.applicantType === 'OFFICE' || t.facultyType === 'OFFICE' || t.facultyType === 'TEACHING' || t.facultyType === 'NON_TEACHING';
      const isPermissionType = t.type === 'FACULTY_ONE_HOUR' || t.type === 'FACULTY_4PM' || t.type === 'FACULTY_OD' || t.permissionType === 'FACULTY_ONE_HOUR' || t.permissionType === 'FACULTY_4PM' || t.permissionType === 'FACULTY_OD';
      return isFaculty || isPermissionType;
    });
  }, [outpassTickets]);

  const filteredFacultyPermissions = useMemo(() => {
    return facultyPermissionTickets.filter(t => {
      // 1. Department filter
      if (permSelectedDept !== 'ALL') {
        const ticketDept = (t.department || '').toLowerCase();
        const selDept = permSelectedDept.toLowerCase();
        if (!ticketDept.includes(selDept) && !selDept.includes(ticketDept)) {
          return false;
        }
      }

      // 2. Date filter mode
      const ticketDate = t.date || (t.appliedAt ? t.appliedAt.slice(0, 10) : '');
      if (permFilterMode === 'daily') {
        if (permSelectedDate && ticketDate !== permSelectedDate) return false;
      } else if (permFilterMode === 'range') {
        if (permStartDate && ticketDate < permStartDate) return false;
        if (permEndDate && ticketDate > permEndDate) return false;
      }

      // 3. Search query
      if (permSearchQuery.trim()) {
        const q = permSearchQuery.toLowerCase();
        const name = (t.facultyName || t.studentName || '').toLowerCase();
        const empId = (t.facultyUserId || t.rollNumber || '').toLowerCase();
        const dept = (t.department || '').toLowerCase();
        const type = (t.type || t.permissionType || '').toLowerCase();
        const purpose = (t.purpose || t.reason || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        return name.includes(q) || empId.includes(q) || dept.includes(q) || type.includes(q) || purpose.includes(q) || id.includes(q);
      }

      return true;
    });
  }, [facultyPermissionTickets, permFilterMode, permSelectedDate, permStartDate, permEndDate, permSelectedDept, permSearchQuery]);

  // Export Faculty Permissions to CSV/Excel
  const handleExportPermissionsExcel = () => {
    if (filteredFacultyPermissions.length === 0) {
      alert('No permission records found for the selected filter criteria.');
      return;
    }

    const headers = [
      'Sl No',
      'Pass ID',
      'Date',
      'Faculty/Staff Name',
      'Employee ID',
      'Department',
      'Permission Type',
      'Leave / Out Time',
      'In Time',
      'Purpose / Reason',
      'Approval Status',
      'Remaining Monthly Leaves'
    ];

    const rows = filteredFacultyPermissions.map((t, idx) => {
      const isOd = t.type === 'FACULTY_OD' || t.permissionType === 'FACULTY_OD';
      const isOneHour = t.type === 'FACULTY_ONE_HOUR' || t.permissionType === 'FACULTY_ONE_HOUR';
      const typeLabel = isOd ? 'On Duty (OD)' : isOneHour ? '1-Hour Permission' : '4:00 PM Permission';
      
      const facultyId = t.facultyUserId || t.facultyName || t.rollNumber;
      const quota = getFacultyMonthlyLeaveUsage(facultyId, t.date || t.appliedAt);

      const statusLabel = t.status === 'SENT_OUT'
        ? (t.inTime ? `Returned (In: ${t.inTime})` : 'Departed / Closed')
        : t.status === 'FACULTY_OUT'
        ? 'Outside (Pending Return)'
        : t.status === 'PERMISSION_GRANTED'
        ? 'Approved (At Security Gate)'
        : t.status === 'FORWARDED_TO_AO'
        ? 'Awaiting AO Approval'
        : t.status === 'FORWARDED_TO_HOD'
        ? 'Awaiting HOD Approval'
        : t.status === 'REJECTED'
        ? 'Rejected'
        : t.status || 'Pending';

      return [
        idx + 1,
        t.id,
        t.date || t.appliedDate || '',
        t.facultyName || t.studentName || 'Faculty',
        t.facultyUserId || t.rollNumber || 'N/A',
        t.department || 'N/A',
        typeLabel,
        t.leaveTime || t.outTime || 'N/A',
        t.inTime || 'N/A',
        (t.purpose || t.reason || '').replace(/"/g, '""'),
        statusLabel,
        quota.remaining
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateLabel = permFilterMode === 'daily'
      ? (permSelectedDate || 'daily')
      : permFilterMode === 'range'
      ? `${permStartDate || 'start'}_to_${permEndDate || 'end'}`
      : 'all_dates';
    link.href = blobUrl;
    link.setAttribute('download', `Faculty_Permissions_Report_${dateLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  // Printable HTML Window for PDF Download
  const handlePrintPermissionsPDF = () => {
    if (filteredFacultyPermissions.length === 0) {
      alert('No permission records found for the selected filter criteria to generate PDF.');
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to generate and print PDF reports.');
      return;
    }

    const filterDescription = permFilterMode === 'daily'
      ? `Date: ${permSelectedDate || new Date().toISOString().slice(0, 10)}`
      : permFilterMode === 'range'
      ? `Date Range: ${permStartDate || 'Start'} to ${permEndDate || 'End'}`
      : 'All Recorded Dates';

    const deptDescription = permSelectedDept === 'ALL' ? 'All Departments' : permSelectedDept;

    const tableRows = filteredFacultyPermissions.map((t, idx) => {
      const isOd = t.type === 'FACULTY_OD' || t.permissionType === 'FACULTY_OD';
      const isOneHour = t.type === 'FACULTY_ONE_HOUR' || t.permissionType === 'FACULTY_ONE_HOUR';
      const typeLabel = isOd ? 'On Duty (OD)' : isOneHour ? '1-Hour Timing' : '4:00 PM Permission';
      
      const facultyId = t.facultyUserId || t.facultyName || t.rollNumber;
      const quota = getFacultyMonthlyLeaveUsage(facultyId, t.date || t.appliedAt);

      const statusBadge = t.status === 'SENT_OUT'
        ? (t.inTime ? `Returned (${t.inTime})` : 'Departed / Closed')
        : t.status === 'FACULTY_OUT'
        ? 'Outside (Pending Return)'
        : t.status === 'PERMISSION_GRANTED'
        ? 'Approved (Gate Ready)'
        : t.status === 'REJECTED'
        ? 'Rejected'
        : 'Pending';

      return `
        <tr>
          <td style="text-align:center;font-weight:600;">${idx + 1}</td>
          <td style="font-family:monospace;font-weight:700;">${t.id}</td>
          <td>${t.date || t.appliedDate || ''}</td>
          <td>
            <strong>${t.facultyName || t.studentName || 'Faculty'}</strong><br/>
            <small style="color:#64748b;font-family:monospace;">ID: ${t.facultyUserId || t.rollNumber || 'N/A'}</small>
          </td>
          <td>${t.department || 'N/A'}</td>
          <td><span style="font-weight:600;color:#0f172a;">${typeLabel}</span></td>
          <td><strong>${t.leaveTime || t.outTime || 'N/A'}</strong></td>
          <td>${t.inTime || '-'}</td>
          <td style="max-width:200px;">${t.purpose || t.reason || '-'}</td>
          <td><strong>${statusBadge}</strong></td>
          <td style="text-align:center;font-weight:bold;color:${quota.remaining === 0 ? '#dc2626' : '#16a34a'};">${quota.remaining} / 2 left</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Faculty Permissions Official Report - Administrative Office</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 12mm 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 10px;
              font-size: 11px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0284c7;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              color: #0369a1;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #475569;
              margin: 3px 0;
              font-weight: 600;
            }
            .report-name {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 6px;
              text-transform: uppercase;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              background: #f1f5f9;
              padding: 8px 12px;
              border-radius: 6px;
              margin-bottom: 12px;
              font-size: 11px;
              font-weight: 600;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
            }
            th {
              background-color: #0f172a;
              color: #ffffff;
              font-size: 10px;
              text-transform: uppercase;
              padding: 7px 6px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 6px;
              border: 1px solid #e2e8f0;
              font-size: 10.5px;
              vertical-align: middle;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .footer {
              margin-top: 24px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding-top: 18px;
              font-size: 11px;
              font-weight: 600;
            }
            .sign-box {
              text-align: center;
              width: 180px;
              border-top: 1.5px solid #0f172a;
              padding-top: 6px;
            }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Narasaraopeta Engineering College (Autonomous)</h1>
            <p class="subtitle">Kotappakonda Road, Yellamanda (P.O), Narasaraopet - 522601, Andhra Pradesh</p>
            <div class="report-name">Administrative Office • Faculty & Staff Permissions Log & Quota Report</div>
          </div>

          <div class="meta-bar">
            <div><strong>Filter:</strong> ${filterDescription}</div>
            <div><strong>Department:</strong> ${deptDescription}</div>
            <div><strong>Total Records:</strong> ${filteredFacultyPermissions.length}</div>
            <div><strong>Generated At:</strong> ${new Date().toLocaleString('en-GB')}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:30px;text-align:center;">#</th>
                <th style="width:75px;">Pass ID</th>
                <th style="width:75px;">Date</th>
                <th>Faculty / Staff</th>
                <th>Department</th>
                <th>Permission Type</th>
                <th style="width:65px;">Out Time</th>
                <th style="width:60px;">In Time</th>
                <th>Stated Reason</th>
                <th style="width:85px;">Status</th>
                <th style="width:80px;text-align:center;">Remained</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            <div>
              <p style="margin:0;color:#64748b;font-size:10px;">Computer Generated Official Report • Administrative Office Portal</p>
              <p style="margin:2px 0 0 0;color:#64748b;font-size:10px;">Generated by: ${user?.name || 'Administrative Office'}</p>
            </div>
            <div class="sign-box">
              Verified by Administrative Officer (AO)
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
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

  // Delete certificate ticket
  const handleDeleteTicket = async (req) => {
    if (!window.confirm(`Are you sure you want to delete certificate request ticket "${req.id}" for ${req.studentName}?`)) {
      return;
    }
    try {
      setActionError('');
      await deleteCertificateRequest(req.id);
      loadRequests();
      setActionSuccess(`Ticket ${req.id} deleted successfully.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to delete ticket');
    }
  };

  // Add certificate ticket manually by Office
  const handleAddTicketSubmit = async (e) => {
    e.preventDefault();
    if (!newRollNumber.trim() || !newStudentName.trim() || !newCertificateName.trim()) {
      setActionError('Please provide Roll Number, Student Name, and Certificate Name.');
      return;
    }
    setIsSubmittingTicket(true);
    setActionError('');
    try {
      await addCertificateTicketByOffice({
        rollNumber: newRollNumber.trim().toUpperCase(),
        studentName: newStudentName.trim(),
        section: newSection.trim(),
        certificateName: newCertificateName.trim(),
        reason: newReason.trim() || 'Certificate requested directly at counter',
        status: 'FORWARDED_TO_OFFICE'
      });
      loadRequests();
      setShowAddTicketModal(false);
      setNewRollNumber('');
      setNewStudentName('');
      setNewSection('');
      setNewCertificateName('Bonafide Certificate');
      setNewReason('');
      setActionSuccess('New certificate request ticket registered successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to create certificate ticket');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const getStatusBadge = (status, req) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-black text-xs border border-teal-500/20 flex items-center gap-1.5">
            <BadgeCheck size={12} className="text-teal-600" />
            AO Approved • Ready to Issue
          </span>
        );
      case 'FORWARDED_TO_OFFICE':
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-black text-xs border border-amber-500/20 flex items-center gap-1.5">
            <Clock size={12} />
            Forwarded by HOD • Ready to Issue
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
            Certificate Issued (Closed)
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
                  Administrative Office Login Portal
                </h1>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Finalize certificate requests forwarded by HOD, manage tickets, and view office staff members added by AO
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadRequests();
                loadOfficeStaff();
              }}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Refresh Records</span>
            </button>
            <button
              onClick={() => setShowAddTicketModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Ticket</span>
            </button>
          </div>
        </div>

        {/* Counter KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6">
          <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 block mb-1">
              AO Approved • Ready to Issue
            </span>
            <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
              {forwardedRequests.length}
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
              Issued & Closed
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {issuedRequests.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main View Navigation Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMainView('certificates')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
            mainView === 'certificates'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]'
              : 'bg-white/80 dark:bg-slate-800/80 text-customText-muted hover:text-customText border border-slate-200 dark:border-slate-800'
          }`}
        >
          <FileText size={16} />
          <span>Certificate Tickets ({requests.length})</span>
        </button>

        <button
          onClick={() => setMainView('facultyPermissions')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
            mainView === 'facultyPermissions'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]'
              : 'bg-white/80 dark:bg-slate-800/80 text-customText-muted hover:text-customText border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Clock size={16} />
          <span>Faculty Permissions Report ({filteredFacultyPermissions.length})</span>
        </button>

        <button
          onClick={() => setMainView('staff')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
            mainView === 'staff'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]'
              : 'bg-white/80 dark:bg-slate-800/80 text-customText-muted hover:text-customText border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Users size={16} />
          <span>Office Staff Added by AO ({officeStaffList.length})</span>
        </button>
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

      {/* VIEW 1: CERTIFICATE TICKETS */}
      {mainView === 'certificates' && (
        <div className="space-y-4">
          {/* Tabs and Search */}
          <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full md:w-auto overflow-x-auto">
              {[
                { id: 'ALL', label: `All Requests (${aoApprovedRequests.length})` },
                { id: 'FORWARDED', label: `Ready to Issue (${forwardedRequests.length})` },
                { id: 'IN_PROGRESS', label: `In Progress (${inProgressRequests.length})` },
                { id: 'READY', label: `Ready for Counter (${readyRequests.length})` },
                { id: 'ISSUED', label: `Issued / Closed (${issuedRequests.length})` }
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
                  No certificate requests awaiting issue
                </h3>
                <p className="text-xs text-customText-muted max-w-md mx-auto">
                  When the Administrative Officer (AO) accepts forwarded student certificate requests, they will appear here live across devices ready for Office issuance.
                </p>
              </div>
            ) : (
              filteredRequests.map(req => {
                const isForwarded = req.status === 'FORWARDED_TO_OFFICE' || req.status === 'ACCEPTED';
                const isInProgress = req.status === 'IN_PROGRESS' || req.status === 'APPROVED';
                const isReady = req.status === 'READY';
                const isIssued = req.status === 'ISSUED';

                return (
                  <div
                    key={req.id}
                    className={`glass-card p-5 rounded-2xl border transition-all ${
                      isForwarded 
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
                              <span className="text-[10px] text-customText-muted uppercase font-bold block">Section / Department</span>
                              <span className="font-bold text-customText dark:text-customText-dark">
                                {req.section || req.department || 'General'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-customText-muted shrink-0" />
                            <div>
                              <span className="text-[10px] text-customText-muted uppercase font-bold block">Applied / Forwarded</span>
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

                        {/* HOD / AO / Office Action Trail */}
                        {req.hodAction && (
                          <div className="text-[11px] text-customText-muted flex items-center gap-2 pt-0.5">
                            <span className="font-bold text-primary">HOD Remarks:</span>
                            <span>{req.hodAction.remarks || req.hodAction.status} ({req.hodAction.displayDate || ''} {req.hodAction.displayTime || ''})</span>
                          </div>
                        )}
                        {req.aoAction && (
                          <div className="text-[11px] text-teal-800 dark:text-teal-300 flex items-center gap-2 pt-0.5 font-semibold">
                            <span className="font-bold text-teal-600 dark:text-teal-400">✓ AO Clearance:</span>
                            <span>{req.aoAction.remarks || 'Approved by AO'} ({req.aoAction.aoName || 'Administrative Officer'} • {req.aoAction.displayDate || ''} {req.aoAction.displayTime || ''})</span>
                          </div>
                        )}
                        {req.officeAction && (
                          <div className="text-[11px] text-customText-muted flex items-center gap-2 pt-0.5">
                            <span className="font-bold text-emerald-600">Office Remarks:</span>
                            <span>{req.officeAction.remarks || req.officeAction.status} ({req.officeAction.displayDate || ''} {req.officeAction.displayTime || ''})</span>
                          </div>
                        )}
                      </div>

                      {/* Right Actions */}
                      <div className="flex flex-wrap lg:flex-col items-center lg:items-end justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                        {/* Primary Quick Action for Office: Issued */}
                        {!isIssued && req.status !== 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusUpdate(req, 'ISSUED', 'Certificate issued to student by Administrative Office.')}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            title="Click to issue certificate to student and close this request"
                          >
                            <BadgeCheck size={16} />
                            <span>Issued</span>
                          </button>
                        )}

                        {isIssued && (
                          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-xs border border-emerald-500/30 flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            <span>Issued & Closed</span>
                          </span>
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
                              setTargetStatus(req.status === 'FORWARDED_TO_OFFICE' || req.status === 'ACCEPTED' ? 'ISSUED' : 'READY');
                              setStatusRemarks('');
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-customText-muted hover:text-customText transition-colors cursor-pointer"
                          >
                            <span>Change Status</span>
                          </button>

                          <button
                            onClick={() => handleDeleteTicket(req)}
                            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Delete certificate ticket"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: OFFICE STAFF ADDED BY AO */}
      {mainView === 'staff' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              <div>
                <h3 className="text-sm font-black text-customText dark:text-customText-dark">
                  Office Members & Staff Directory
                </h3>
                <p className="text-[11px] text-customText-muted">
                  Official office personnel added and assigned by the Administrative Officer (AO)
                </p>
              </div>
            </div>

            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-customText-muted" />
              <input
                type="text"
                placeholder="Search Staff Name, Emp ID, Role..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {staffLoading ? (
            <div className="p-12 text-center text-customText-muted text-xs">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
              Loading office staff members...
            </div>
          ) : filteredStaffList.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Users size={32} className="mx-auto text-customText-muted" />
              <h4 className="text-sm font-bold text-customText dark:text-customText-dark">
                No office staff found
              </h4>
              <p className="text-xs text-customText-muted max-w-md mx-auto">
                Office staff members added by the Administrative Officer (AO) in AO Login will be listed here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaffList.map((staff, idx) => (
                <div
                  key={staff.empid || idx}
                  className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black text-sm">
                        {staff.name ? staff.name.charAt(0).toUpperCase() : 'O'}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-customText dark:text-customText-dark">
                          {staff.name}
                        </h4>
                        <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          {staff.empid || 'OFFICE'}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-customText-muted">
                      AO Enrolled
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className="text-customText-muted shrink-0" />
                      <span className="font-medium text-customText dark:text-customText-dark">
                        {staff.designation || 'Office Assistant'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Building size={14} className="text-customText-muted shrink-0" />
                      <span className="text-customText-muted">
                        {staff.department || 'Administrative Office'}
                      </span>
                    </div>

                    {staff.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-customText-muted shrink-0" />
                        <span className="font-mono text-customText-muted">
                          {staff.phoneNumber}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: FACULTY PERMISSIONS & STAFF REPORT */}
      {mainView === 'facultyPermissions' && (
        <div className="space-y-4">
          {/* Filter & Export Card */}
          <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-customText dark:text-customText-dark flex items-center gap-2">
                  <Clock size={18} className="text-blue-600" />
                  <span>Faculty & Staff Permissions Report</span>
                </h3>
                <p className="text-xs text-customText-muted">
                  Audit daily permissions, filter by department or date range, check remained permission counts, and download official reports.
                </p>
              </div>

              {/* Download Buttons (Excel & PDF) */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={handleExportPermissionsExcel}
                  disabled={filteredFacultyPermissions.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Download Excel Spreadsheet (.CSV)"
                >
                  <FileSpreadsheet size={15} />
                  <span>Download Excel</span>
                </button>

                <button
                  onClick={handlePrintPermissionsPDF}
                  disabled={filteredFacultyPermissions.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Generate & Download PDF"
                >
                  <Printer size={15} />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {/* Date Filter Mode Selector */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-customText-muted mb-1.5">
                  Report Mode
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPermFilterMode('daily')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      permFilterMode === 'daily'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-customText-muted hover:text-customText'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermFilterMode('range')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      permFilterMode === 'range'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-customText-muted hover:text-customText'
                    }`}
                  >
                    Date Range
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermFilterMode('all')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      permFilterMode === 'all'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-customText-muted hover:text-customText'
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Date Selector based on mode */}
              {permFilterMode === 'daily' && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-customText-muted mb-1.5">
                    Selected Date
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-customText-muted" />
                    <input
                      type="date"
                      value={permSelectedDate}
                      onChange={(e) => setPermSelectedDate(e.target.value)}
                      className="w-full glass-input text-xs pl-8 py-2 font-medium"
                    />
                  </div>
                </div>
              )}

              {permFilterMode === 'range' && (
                <div className="sm:col-span-1 lg:col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-customText-muted mb-1.5">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={permStartDate}
                      onChange={(e) => setPermStartDate(e.target.value)}
                      className="w-full glass-input text-xs py-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-customText-muted mb-1.5">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={permEndDate}
                      onChange={(e) => setPermEndDate(e.target.value)}
                      className="w-full glass-input text-xs py-2 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Department Filter */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-customText-muted mb-1.5">
                  Filter Department
                </label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-customText-muted" />
                  <select
                    value={permSelectedDept}
                    onChange={(e) => setPermSelectedDept(e.target.value)}
                    className="w-full glass-input text-xs pl-8 py-2 font-medium truncate"
                  >
                    <option value="ALL">All College Departments</option>
                    <option value="Administrative Office">Administrative Office</option>
                    {COLLEGE_DEPARTMENTS.map(d => (
                      <option key={d.department} value={d.department}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search input */}
              <div className={permFilterMode === 'all' ? 'sm:col-span-2' : ''}>
                <label className="block text-[11px] font-black uppercase tracking-wider text-customText-muted mb-1.5">
                  Search Faculty / Staff
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-customText-muted" />
                  <input
                    type="text"
                    placeholder="Search name, ID, reason, type..."
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    className="w-full glass-input text-xs pl-8 py-2 font-medium"
                  />
                  {permSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPermSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-customText-muted hover:text-customText"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-customText-muted block mb-0.5">
                Total Permissions
              </span>
              <span className="text-xl font-black text-customText dark:text-customText-dark">
                {filteredFacultyPermissions.length}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-0.5">
                1-Hour Permissions
              </span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                {filteredFacultyPermissions.filter(t => t.type === 'FACULTY_ONE_HOUR' || t.permissionType === 'FACULTY_ONE_HOUR').length}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                4:00 PM Permissions
              </span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                {filteredFacultyPermissions.filter(t => t.type === 'FACULTY_4PM' || t.permissionType === 'FACULTY_4PM').length}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-0.5">
                On Duty (OD)
              </span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                {filteredFacultyPermissions.filter(t => t.type === 'FACULTY_OD' || t.permissionType === 'FACULTY_OD').length}
              </span>
            </div>
          </div>

          {/* Permissions Table List */}
          <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {filteredFacultyPermissions.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Clock size={36} className="mx-auto text-customText-muted opacity-40" />
                <h4 className="text-sm font-black text-customText dark:text-customText-dark">
                  No faculty permission records found
                </h4>
                <p className="text-xs text-customText-muted max-w-sm mx-auto">
                  Try adjusting your date selection, department filter, or search term above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-customText-muted">
                      <th className="py-3 px-3.5 text-center">#</th>
                      <th className="py-3 px-3.5">Date & ID</th>
                      <th className="py-3 px-3.5">Faculty / Staff Member</th>
                      <th className="py-3 px-3.5">Department</th>
                      <th className="py-3 px-3.5">Permission Type</th>
                      <th className="py-3 px-3.5">Timings (Out / In)</th>
                      <th className="py-3 px-3.5">Stated Purpose</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5 text-center">Remained Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredFacultyPermissions.map((t, idx) => {
                      const isOd = t.type === 'FACULTY_OD' || t.permissionType === 'FACULTY_OD';
                      const isOneHour = t.type === 'FACULTY_ONE_HOUR' || t.permissionType === 'FACULTY_ONE_HOUR';
                      const facultyId = t.facultyUserId || t.facultyName || t.rollNumber;
                      const quota = getFacultyMonthlyLeaveUsage(facultyId, t.date || t.appliedAt);

                      return (
                        <tr key={t.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3.5 text-center font-bold text-customText-muted text-[11px]">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-bold text-customText dark:text-customText-dark block">
                              {t.date || t.appliedDate || 'N/A'}
                            </span>
                            <span className="font-mono text-[10px] text-customText-muted">
                              {t.id}
                            </span>
                          </td>

                          <td className="py-3 px-3.5">
                            <span className="font-black text-customText dark:text-customText-dark block">
                              {t.facultyName || t.studentName || 'Faculty Member'}
                            </span>
                            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                              ID: {t.facultyUserId || t.rollNumber || 'N/A'}
                            </span>
                          </td>

                          <td className="py-3 px-3.5">
                            <span className="text-[11px] font-medium text-customText-muted block max-w-[160px] truncate" title={t.department}>
                              {t.department || 'Administrative Office'}
                            </span>
                          </td>

                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black inline-block ${
                              isOd 
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                                : isOneHour
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                              {isOd ? 'On Duty (OD)' : isOneHour ? '1-Hour Timing' : '4:00 PM Permission'}
                            </span>
                          </td>

                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="text-[11px]">
                              <span className="font-bold text-customText dark:text-customText-dark">
                                Out: {t.leaveTime || t.outTime || 'N/A'}
                              </span>
                              {t.inTime && (
                                <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  In: {t.inTime}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            <span className="text-[11px] text-customText dark:text-customText-dark block max-w-[180px] truncate" title={t.purpose || t.reason}>
                              {t.purpose || t.reason || 'Personal / Official work'}
                            </span>
                          </td>

                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {t.status === 'SENT_OUT' ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                                {t.inTime ? 'Returned' : 'Closed'}
                              </span>
                            ) : t.status === 'FACULTY_OUT' ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20">
                                Outside
                              </span>
                            ) : t.status === 'PERMISSION_GRANTED' ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold text-[10px] border border-blue-500/20">
                                Gate Ready
                              </span>
                            ) : t.status === 'REJECTED' ? (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold text-[10px] border border-rose-500/20">
                                Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-customText-muted font-bold text-[10px]">
                                {t.status || 'Pending'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedFacultyQuotaModal({ ticket: t, quota })}
                              className={`px-2 py-1 rounded-lg text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105 ${
                                quota.remaining === 0
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                              title="Click to view detailed quota breakdown"
                            >
                              <span>{quota.remaining} / 2 left</span>
                              <Eye size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: FACULTY MONTHLY REMAINED QUOTA DETAIL MODAL */}
      {selectedFacultyQuotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in modal-wrapper-fullscreen">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4 modal-card-fullscreen">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                <h3 className="text-base font-black text-customText dark:text-customText-dark">
                  Faculty Leave Quota Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedFacultyQuotaModal(null)}
                className="p-1 rounded-lg text-customText-muted hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-customText-muted uppercase block font-bold">Faculty Member</span>
                <span className="font-black text-sm text-customText dark:text-customText-dark">
                  {selectedFacultyQuotaModal.ticket.facultyName || selectedFacultyQuotaModal.ticket.studentName}
                </span>
                <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 block">
                  Employee ID: {selectedFacultyQuotaModal.ticket.facultyUserId || selectedFacultyQuotaModal.ticket.rollNumber || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-customText-muted uppercase block font-bold">Department</span>
                <span className="font-semibold text-customText dark:text-customText-dark">
                  {selectedFacultyQuotaModal.ticket.department || 'Administrative Office'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900">
                  <span className="text-[9px] uppercase font-bold text-customText-muted block mb-0.5">Used</span>
                  <span className="text-base font-black text-slate-800 dark:text-slate-200">
                    {selectedFacultyQuotaModal.quota.count}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[9px] uppercase font-bold text-blue-700 dark:text-blue-400 block mb-0.5">Monthly Limit</span>
                  <span className="text-base font-black text-blue-600 dark:text-blue-400">
                    2
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl ${
                  selectedFacultyQuotaModal.quota.remaining === 0
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <span className="text-[9px] uppercase font-bold block mb-0.5">Remained</span>
                  <span className="text-base font-black">
                    {selectedFacultyQuotaModal.quota.remaining}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-customText-muted uppercase block font-bold mb-1">
                  Month Cycle & Notes
                </span>
                <p className="text-[11px] text-customText-muted">
                  Quota cycle: <strong>{selectedFacultyQuotaModal.quota.monthName || selectedFacultyQuotaModal.quota.monthKey}</strong>.
                  Faculty members have a standard maximum allowance of 2 permissions (1-Hour / 4:00 PM) per calendar month. On Duty (OD) permissions do not consume this monthly quota.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedFacultyQuotaModal(null)}
              className="w-full btn-secondary py-2.5 text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD CERTIFICATE TICKET MANUALLY */}
      {showAddTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in modal-wrapper-fullscreen">
          <div className="glass-card w-full max-w-lg p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4 modal-card-fullscreen">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-blue-600" />
                <h3 className="text-base font-black text-customText dark:text-customText-dark">
                  Add / Register Certificate Ticket
                </h3>
              </div>
              <button 
                onClick={() => setShowAddTicketModal(false)}
                className="p-1 rounded-lg text-customText-muted hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-customText-muted">
              Add a certificate request directly into the Office workflow.
            </p>

            <form onSubmit={handleAddTicketSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Student Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 21471A0501"
                    value={newRollNumber}
                    onChange={(e) => setNewRollNumber(e.target.value)}
                    className="w-full glass-input text-xs py-2 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. R. Anusha"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full glass-input text-xs py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Section / Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CSE-A"
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full glass-input text-xs py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Certificate Type *
                  </label>
                  <select
                    value={newCertificateName}
                    onChange={(e) => setNewCertificateName(e.target.value)}
                    className="w-full glass-input text-xs py-2"
                  >
                    <option value="Bonafide Certificate">Bonafide Certificate</option>
                    <option value="Study & Conduct Certificate">Study & Conduct Certificate</option>
                    <option value="Custodian Certificate">Custodian Certificate</option>
                    <option value="Bus Pass Endorsement">Bus Pass Endorsement</option>
                    <option value="Medium of Instruction Certificate">Medium of Instruction Certificate</option>
                    <option value="Transfer Certificate (TC)">Transfer Certificate (TC)</option>
                    <option value="NOC for Internship / Project">NOC for Internship / Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Purpose / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Purpose of certificate application..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full glass-input text-xs py-2 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTicketModal(false)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="btn-primary py-2 px-5 text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTicket ? 'Adding...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STATUS MODIFICATION MODAL */}
      {updatingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in modal-wrapper-fullscreen">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4 modal-card-fullscreen">
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
                  <option value="FORWARDED_TO_OFFICE">Forwarded by HOD</option>
                  <option value="IN_PROGRESS">Under Preparation / Verification</option>
                  <option value="READY">Ready for Collection at Counter</option>
                  <option value="ISSUED">Issued & Finalized to Student</option>
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
                  placeholder="Optional remarks visible to student (e.g. Successfully provided certificate...)"
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

      {/* MODAL 3: PRINTABLE CERTIFICATE SLIP MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in modal-wrapper-fullscreen">
          <div className="relative glass-card w-full max-w-xl p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-6 modal-card-fullscreen overflow-hidden">
            {/* College Logo Watermark */}
            <div 
              aria-hidden="true" 
              className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 opacity-[0.06] select-none"
            >
              <img src={logo} alt="Watermark" className="w-80 h-80 object-contain -rotate-12 filter grayscale" />
            </div>
            <div className="relative z-10 text-center border-b pb-4 border-slate-200 dark:border-slate-800 space-y-1">
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
                  <span className="font-semibold text-customText dark:text-customText-dark">{selectedRequest.section || selectedRequest.department || 'General'}</span>
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
