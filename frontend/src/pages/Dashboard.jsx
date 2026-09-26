import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import StatCard from '../components/StatCard';
import ClassroomCard from '../components/ClassroomCard';
import ActivityFeed from '../components/ActivityFeed';
import Loading from '../components/Loading';
import { 
  Building, 
  Users2, 
  UserSquare, 
  Percent, 
  Calendar, 
  Search, 
  X,
  History,
  Info,
  Edit,
  UserPlus,
  Users,
  AlertCircle,
  Phone,
  PhoneCall,
  CalendarDays,
  Plus,
  Save,
  CheckCircle2,
  Trash2,
  Lock,
  Settings,
  FileText,
  BadgeCheck,
  DoorOpen,
  RefreshCw,
  Database,
  Download,
  UploadCloud,
  Layers,
  FileArchive,
  HardDrive,
  ArrowDownToLine,
  ShieldCheck as ShieldIcon
} from 'lucide-react';
import OutpassTicketModal from '../components/OutpassTicketModal';
import { 
  getAllOutpasses, 
  hodGrantOutpass, 
  hodRejectOutpass, 
  hodApproveFacultyLeave,
  subscribeToOutpasses,
  syncHODStudents,
  deleteOutpassTicket,
  clearOldOutpasses,
  syncOutpassesFromBackend,
  getStudentOutpassHistory,
  isTicketDeleteLockedForHod
} from '../services/outpassService';
import {
  exportOverallData,
  validateBackupFile,
  executeImport,
  downloadMySQLDump,
  getMigrationHistory
} from '../services/backupService';

const Dashboard = ({ initialTab }) => {
  const { token, user, selectedDepartment } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const getResolvedTab = () => {
    if (initialTab) return initialTab;
    const qTab = searchParams.get('tab');
    if (qTab) return qTab;
    if (location.pathname === '/students') return 'students';
    if (location.pathname === '/absentees') return 'absentees';
    if (location.pathname === '/outpasses') return 'outpassApprovals';
    if (location.pathname === '/backup') return 'dataBackup';
    return 'faculty';
  };

  // Active Tab: 'faculty', 'students', 'absentees', 'settings', 'outpassApprovals', 'dataBackup'
  const [activeTab, setActiveTab] = useState(getResolvedTab);

  useEffect(() => {
    const target = getResolvedTab();
    if (target !== activeTab) {
      setActiveTab(target);
    }
  }, [location.pathname, searchParams, initialTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'students') navigate('/students');
    else if (newTab === 'absentees') navigate('/absentees');
    else if (newTab === 'outpassApprovals') navigate('/outpasses');
    else if (newTab === 'dataBackup') navigate('/backup');
    else if (newTab === 'faculty') navigate('/dashboard');
  };
  const [success, setSuccess] = useState('');

  // HOD Outpass Approvals state
  const [outpassTickets, setOutpassTickets] = useState([]);
  const [selectedOutpassModalTicket, setSelectedOutpassModalTicket] = useState(null);
  const [studentHistoryModalStudent, setStudentHistoryModalStudent] = useState(null);
  const [outpassActionSuccess, setOutpassActionSuccess] = useState('');
  const [outpassActionError, setOutpassActionError] = useState('');

  // Data Backup & Migration States (Admin-only)
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState('');
  const [exportErrorMessage, setExportErrorMessage] = useState('');

  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const [isValidatingBackup, setIsValidatingBackup] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [validationError, setValidationError] = useState('');

  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');

  const [isDownloadingSql, setIsDownloadingSql] = useState(false);
  const [migrationLogs, setMigrationLogs] = useState([]);
  const [loadingMigrationLogs, setLoadingMigrationLogs] = useState(false);

  const fetchMigrationLogs = async () => {
    try {
      setLoadingMigrationLogs(true);
      const logs = await getMigrationHistory();
      setMigrationLogs(logs);
    } catch (err) {
      console.error('Failed to load migration history', err);
    } finally {
      setLoadingMigrationLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dataBackup') {
      fetchMigrationLogs();
    }
  }, [activeTab]);

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setExportErrorMessage('');
      setExportSuccessMessage('');
      const res = await exportOverallData();
      setExportSuccessMessage(`Backup generated and downloaded successfully: ${res.filename} (${(res.size / 1024).toFixed(1)} KB)`);
      fetchMigrationLogs();
      setTimeout(() => setExportSuccessMessage(''), 8000);
    } catch (err) {
      setExportErrorMessage(err.message || 'Failed to export backup data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setValidationError('Please select an official .zip backup file.');
      return;
    }
    setSelectedBackupFile(file);
    setValidationReport(null);
    setValidationError('');
    setImportSummary(null);
    setImportError('');
  };

  const handleValidateBackup = async () => {
    if (!selectedBackupFile) return;
    try {
      setIsValidatingBackup(true);
      setValidationError('');
      const report = await validateBackupFile(selectedBackupFile);
      setValidationReport(report);
    } catch (err) {
      setValidationError(err.message || 'Validation failed.');
    } finally {
      setIsValidatingBackup(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedBackupFile) return;
    try {
      setIsImporting(true);
      setImportError('');
      const summary = await executeImport(selectedBackupFile);
      setImportSummary(summary);
      setShowImportConfirmModal(false);
      fetchMigrationLogs();
    } catch (err) {
      setImportError(err.message || 'Import execution failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSql = async () => {
    if (!selectedBackupFile) return;
    try {
      setIsDownloadingSql(true);
      await downloadMySQLDump(selectedBackupFile);
    } catch (err) {
      alert('Failed to generate SQL dump: ' + err.message);
    } finally {
      setIsDownloadingSql(false);
    }
  };

  // Load and subscribe to live outpasses
  useEffect(() => {
    setOutpassTickets(getAllOutpasses());
    const unsub = subscribeToOutpasses(setOutpassTickets);
    return () => unsub();
  }, []);

  const handleOpenStudentLeaveHistory = (rollNumber, studentName, section) => {
    setStudentHistoryModalStudent({
      rollNumber,
      name: studentName,
      section
    });
  };

  const handleGrantOutpass = (ticket) => {
    try {
      setOutpassActionError('');
      hodGrantOutpass(ticket.id, {
        hodName: user?.name || 'Head of Department (HOD)',
        remarks: 'Permission Granted by HOD.'
      });
      setOutpassActionSuccess(`Permission granted! Outpass for ${ticket.studentName} (${ticket.rollNumber}) has been sent to the Gate Watchman login.`);
      setTimeout(() => setOutpassActionSuccess(''), 4500);
    } catch (err) {
      setOutpassActionError(err.message || 'Failed to grant permission');
    }
  };

  const handleApproveFacultyLeaveHOD = (ticket, customTimeToLeave = null) => {
    try {
      setOutpassActionError('');
      hodApproveFacultyLeave(ticket.id, {
        hodName: user?.name || 'Head of Department (HOD)',
        remarks: 'Accepted and forwarded to watchman login.',
        timeToLeave: customTimeToLeave || ticket.leaveTime
      });
      setOutpassActionSuccess(`Permission accepted! ${ticket.facultyName || ticket.studentName}'s ${ticket.type === 'FACULTY_EARLY_OUT' ? 'early out pass' : 'leave application'} has been forwarded to the Watchman role login.`);
      setTimeout(() => setOutpassActionSuccess(''), 4500);
    } catch (err) {
      setOutpassActionError(err.message || 'Failed to approve faculty leave');
    }
  };

  const handleRejectOutpassHOD = (ticket, customReason) => {
    try {
      setOutpassActionError('');
      hodRejectOutpass(ticket.id, {
        hodName: user?.name || 'Head of Department (HOD)',
        reason: customReason || 'Permission Denied by HOD.'
      });
      setOutpassActionSuccess(`Outpass for ${ticket.studentName} was rejected.`);
      setTimeout(() => setOutpassActionSuccess(''), 4500);
    } catch (err) {
      setOutpassActionError(err.message || 'Failed to reject outpass');
    }
  };

  const canUserDeleteTicket = (ticket) => {
    if (user?.role === 'SUPER_ADMIN') return true;
    return !isTicketDeleteLockedForHod(ticket);
  };

  const handleDeleteOutpass = async (ticketId, applicantName) => {
    const ticket = outpassTickets.find(t => t.id === ticketId);
    if (!canUserDeleteTicket(ticket)) {
      setOutpassActionError(
        ticket?.applicantType === 'FACULTY'
          ? 'Cannot delete accepted faculty permission after the scheduled permission time has passed. Only Super Admin can delete.'
          : 'Cannot delete student outpass after permission granted and student departed campus. Only Super Admin can delete.'
      );
      return;
    }

    if (!window.confirm(`Permanently delete permission ticket ${ticketId}${applicantName ? ` for ${applicantName}` : ''}?`)) {
      return;
    }
    try {
      setOutpassActionError('');
      await deleteOutpassTicket(ticketId, user?.role);
      setOutpassActionSuccess(`Permission ticket ${ticketId} deleted successfully.`);
      setTimeout(() => setOutpassActionSuccess(''), 3500);
    } catch (err) {
      setOutpassActionError(err.message || 'Failed to delete permission ticket');
    }
  };

  const handleClearOldOutpasses = async () => {
    if (user?.role !== 'SUPER_ADMIN') {
      setOutpassActionError('Only Super Admin can bulk clear completed or departed tickets.');
      return;
    }
    if (!window.confirm('Delete all old completed (Sent Out) and rejected tickets from the database?')) {
      return;
    }
    try {
      setOutpassActionError('');
      await clearOldOutpasses(user?.role);
      setOutpassActionSuccess('All completed and rejected tickets were cleared.');
      setTimeout(() => setOutpassActionSuccess(''), 3500);
    } catch (err) {
      setOutpassActionError(err.message || 'Failed to clear old tickets');
    }
  };

  // HOD Timing settings states
  const [morningStart, setMorningStart] = useState('09:10');
  const [morningEnd, setMorningEnd] = useState('09:50');
  const [afternoonStart, setAfternoonStart] = useState('13:30');
  const [afternoonEnd, setAfternoonEnd] = useState('14:10');
  const [savingTimings, setSavingTimings] = useState(false);

  // Existing Faculty Tracker States
  const [classrooms, setClassrooms] = useState([]);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Detail Modal States
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [classroomDetails, setClassroomDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalDateFilter, setModalDateFilter] = useState('');

  // Edit Classroom States
  const [isEditing, setIsEditing] = useState(false);
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editClassName, setEditClassName] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Tracking control & Clear history states
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [loadingTracking, setLoadingTracking] = useState(true);
  const [toggleSubmitting, setToggleSubmitting] = useState(false);
  const [clearAction, setClearAction] = useState('');
  const [clearClassroomId, setClearClassroomId] = useState('');
  const [clearStartDate, setClearStartDate] = useState('');
  const [clearEndDate, setClearEndDate] = useState('');
  const [clearSubmitting, setClearSubmitting] = useState(false);
  const [clearSuccess, setClearSuccess] = useState('');
  const [clearError, setClearError] = useState('');

  // HOD Student Registry States
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [filterStudentSection, setFilterStudentSection] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  
  // Student form fields
  const [studentName, setStudentName] = useState('');
  const [studentRoll, setStudentRoll] = useState('');
  const [studentSection, setStudentSection] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [parentMobile, setParentMobile] = useState('');
  const [studentSubmitError, setStudentSubmitError] = useState('');
  const [studentSubmitSuccess, setStudentSubmitSuccess] = useState('');
  const [studentSubmitting, setStudentSubmitting] = useState(false);

  // Edit Student States
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentRoll, setEditStudentRoll] = useState('');
  const [editStudentSection, setEditStudentSection] = useState('');
  const [editStudentMobile, setEditStudentMobile] = useState('');
  const [editParentMobile, setEditParentMobile] = useState('');
  const [editStudentSubmitError, setEditStudentSubmitError] = useState('');
  const [editStudentSubmitSuccess, setEditStudentSubmitSuccess] = useState('');
  const [editStudentSubmitting, setEditStudentSubmitting] = useState(false);

  // HOD Student Registry - Bulk Upload States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSection, setBulkSection] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // HOD Absentees States
  const [absentees, setAbsentees] = useState([]);
  const [absenteesSection, setAbsenteesSection] = useState('All');
  const [absenteesDate, setAbsenteesDate] = useState('');
  const [loadingAbsentees, setLoadingAbsentees] = useState(false);
  const [absenteesError, setAbsenteesError] = useState('');

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDate = getTodayDateString();

  const fetchTrackingStatus = async () => {
    try {
      const res = await fetch('/api/settings/tracking', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTrackingEnabled(data.trackingEnabled);
      }
    } catch (err) {
      console.error('Failed to fetch tracking status:', err);
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleToggleTracking = async () => {
    if (toggleSubmitting) return;
    setToggleSubmitting(true);
    try {
      const newValue = !trackingEnabled;
      const res = await fetch('/api/settings/tracking', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ trackingEnabled: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update tracking status');
      setTrackingEnabled(data.trackingEnabled);
      fetchDashboardData(true);
    } catch (err) {
      console.error('Failed to toggle tracking:', err);
    } finally {
      setToggleSubmitting(false);
    }
  };

  const handleClearHistory = async (e) => {
    e.preventDefault();
    if (!clearAction) return;

    let confirmMsg = 'Are you sure you want to perform this clear logs action? This cannot be undone.';
    if (clearAction === 'all') {
      confirmMsg = '⚠️ WARNING: Are you sure you want to clear ALL entry logs history across all classrooms? This will permanently delete all records.';
    }
    if (!window.confirm(confirmMsg)) return;

    setClearSubmitting(true);
    setClearError('');
    setClearSuccess('');

    try {
      const res = await fetch('/api/settings/clear-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: clearAction,
          classroomId: clearClassroomId ? parseInt(clearClassroomId) : undefined,
          startDate: clearStartDate || undefined,
          endDate: clearEndDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to clear log history');

      setClearSuccess(data.message || 'Logs history cleared successfully.');
      setClearAction('');
      setClearClassroomId('');
      setClearStartDate('');
      setClearEndDate('');
      fetchDashboardData();
    } catch (err) {
      setClearError(err.message);
    } finally {
      setClearSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClassroom) return;
    setEditSubmitting(true);
    setEditError('');

    try {
      const res = await fetch(`/api/classrooms/${selectedClassroom.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomNumber: editRoomNumber, className: editClassName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update classroom');

      setSelectedClassroom(data);
      if (classroomDetails) {
        setClassroomDetails(prev => ({
          ...prev,
          roomNumber: data.roomNumber,
          className: data.className
        }));
      }

      setIsEditing(false);
      fetchDashboardData(true);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const fetchDashboardData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      
      let classUrl = '/api/classrooms';
      let statsUrl = '/api/reports/dashboard-stats';
      if (user?.role === 'SUPER_ADMIN' && selectedDepartment && selectedDepartment !== 'ALL') {
        const query = `?department=${encodeURIComponent(selectedDepartment)}`;
        classUrl += query;
        statsUrl += query;
      }

      const classRes = await fetch(classUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const classData = await classRes.json();
      if (!classRes.ok) {
        throw new Error(classData.message || 'Failed to fetch classrooms');
      }
      setClassrooms(classData);
      
      if (classData.length > 0 && !studentSection) {
        setStudentSection(classData[0].className);
        setFilterStudentSection('');
      }

      const statsRes = await fetch(statsUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const statsData = await statsRes.json();
      if (!statsRes.ok) {
        throw new Error(statsData.message || 'Failed to fetch stats');
      }
      setStats(statsData.stats);
      setActivity(statsData.recentActivity);
    } catch (err) {
      setError(err.message || 'Failed to load HOD metrics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch student directories
  const fetchStudents = async () => {
    try {
      setError('');
      // Always fetch all students so we can display section/overall counts and filter locally in React memory.
      let url = '/api/student-attendance/students';
      if (user?.role === 'SUPER_ADMIN' && selectedDepartment && selectedDepartment !== 'ALL') {
        url += `?department=${encodeURIComponent(selectedDepartment)}`;
      }
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(data);
        syncHODStudents(data);
      } else {
        setError(data.message || 'Failed to fetch students list');
      }
    } catch (err) {
      setError('Network error fetching students directory');
    }
  };

  const getSectionCount = (className) => {
    return students.filter(s => s.section === className).length;
  };

  // Fetch absentees today
  const fetchAbsentees = async () => {
    if (!absenteesSection) return;
    const targetDate = absenteesDate || todayDate;
    setLoadingAbsentees(true);
    setAbsenteesError('');
    try {
      const res = await fetch(
        `/api/student-attendance/absentees?section=${encodeURIComponent(absenteesSection)}&date=${targetDate}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) {
        setAbsentees(data);
      } else {
        setAbsenteesError(data.message || 'Failed to fetch absentees');
      }
    } catch (err) {
      setAbsenteesError('Error connecting to attendance server');
    } finally {
      setLoadingAbsentees(false);
    }
  };

  useEffect(() => {
    fetchTrackingStatus();
    fetchDashboardData();
    if (activeTab === 'students') {
      fetchStudents();
    }
  }, [token, selectedDepartment]);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
    }
  }, [activeTab, selectedDepartment]);

  useEffect(() => {
    if (activeTab === 'absentees') {
      fetchAbsentees();
    }
  }, [activeTab, absenteesSection, absenteesDate]);

  // Handle live WebSockets updates
  useEffect(() => {
    if (!socket) return;
    
    socket.on('log_added', (data) => {
      fetchDashboardData(true);
    });

    socket.on('logs_cleared', () => {
      fetchDashboardData(true);
    });

    return () => {
      socket.off('log_added');
      socket.off('logs_cleared');
    };
  }, [socket]);
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'settings' && token) {
      const fetchTimings = async () => {
        try {
          const res = await fetch('/api/student-attendance/settings/timings', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setMorningStart(data.morningStart);
            setMorningEnd(data.morningEnd);
            setAfternoonStart(data.afternoonStart);
            setAfternoonEnd(data.afternoonEnd);
          }
        } catch (error) {
          console.error('Failed to load timings settings:', error);
        }
      };
      fetchTimings();
    }
  }, [activeTab, token]);

  const handleSaveTimings = async (e) => {
    e.preventDefault();
    setSavingTimings(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/student-attendance/settings/timings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          morningStart,
          morningEnd,
          afternoonStart,
          afternoonEnd
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save settings');
      setSuccess('Attendance timings updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTimings(false);
    }
  };
  const fetchClassroomDetails = async (classroomId, dateStr = '') => {
    setLoadingDetails(true);
    try {
      const url = `/api/classrooms/${classroomId}${dateStr ? `?date=${dateStr}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setClassroomDetails(data);
    } catch (err) {
      console.error('Failed to load classroom details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCardClick = async (classroomItem) => {
    setSelectedClassroom(classroomItem);
    setModalDateFilter('');
    fetchClassroomDetails(classroomItem.id, '');
  };

  const handleModalDateChange = (newDate) => {
    setModalDateFilter(newDate);
    if (selectedClassroom) {
      fetchClassroomDetails(selectedClassroom.id, newDate);
    }
  };

  // Add Student Handler
  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studentName || !studentRoll || !studentSection || !studentMobile || !parentMobile) {
      setStudentSubmitError('All fields are required');
      return;
    }

    setStudentSubmitting(true);
    setStudentSubmitError('');
    setStudentSubmitSuccess('');

    try {
      const res = await fetch('/api/student-attendance/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rollNumber: studentRoll,
          name: studentName,
          section: studentSection,
          studentMobile,
          parentMobile
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStudentSubmitSuccess(`Student "${studentName}" added successfully.`);
        setStudentName('');
        setStudentRoll('');
        setStudentMobile('');
        setParentMobile('');
        fetchStudents();
        setTimeout(() => {
          setShowAddStudentModal(false);
          setStudentSubmitSuccess('');
        }, 1500);
      } else {
        setStudentSubmitError(data.message || 'Failed to add student');
      }
    } catch (err) {
      setStudentSubmitError('Network connection issue');
    } finally {
      setStudentSubmitting(false);
    }
  };

  const handleEditStudentClick = (student) => {
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentRoll(student.rollNumber);
    setEditStudentSection(student.section);
    setEditStudentMobile(student.studentMobile || '');
    setEditParentMobile(student.parentMobile || '');
    setEditStudentSubmitError('');
    setEditStudentSubmitSuccess('');
    setShowEditStudentModal(true);
  };

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    if (!editStudentName || !editStudentRoll || !editStudentSection || !editStudentMobile || !editParentMobile) {
      setEditStudentSubmitError('All fields are required');
      return;
    }

    setEditStudentSubmitting(true);
    setEditStudentSubmitError('');
    setEditStudentSubmitSuccess('');

    try {
      const res = await fetch(`/api/student-attendance/students/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editStudentName,
          rollNumber: editStudentRoll,
          section: editStudentSection,
          studentMobile: editStudentMobile,
          parentMobile: editParentMobile
        })
      });

      const data = await res.json();
      if (res.ok) {
        setEditStudentSubmitSuccess('Student details updated successfully.');
        fetchStudents();
        fetchDashboardData(true); // Silent update of classroom student counts
        setTimeout(() => {
          setShowEditStudentModal(false);
          setEditingStudent(null);
          setEditStudentSubmitSuccess('');
        }, 1500);
      } else {
        setEditStudentSubmitError(data.message || 'Failed to update student details');
      }
    } catch (err) {
      setEditStudentSubmitError('Network connection issue');
    } finally {
      setEditStudentSubmitting(false);
    }
  };

  const handleMakeCall = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`Are you sure you want to delete student ${student.name} (${student.rollNumber})?`)) return;
    
    setError('');
    try {
      const res = await fetch(`/api/student-attendance/students/${student.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchStudents();
      } else {
        setError(data.message || 'Failed to delete student');
      }
    } catch (err) {
      setError('Error deleting student');
    }
  };

  const handleBulkDeleteStudents = async (mode) => {
    let confirmMsg = '';
    let payload = {};

    if (mode === 'selected') {
      if (selectedStudentIds.length === 0) return;
      confirmMsg = `Are you sure you want to delete the ${selectedStudentIds.length} selected students? This action cannot be undone.`;
      payload = { studentIds: selectedStudentIds };
    } else if (mode === 'section') {
      if (!filterStudentSection) return;
      confirmMsg = `⚠️ WARNING: Are you sure you want to delete ALL students in the section "${filterStudentSection}"? This will permanently delete all student profiles and attendance records for this section.`;
      payload = { section: filterStudentSection };
    } else {
      return;
    }

    if (!window.confirm(confirmMsg)) return;

    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/student-attendance/students/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || 'Students deleted successfully.');
        setSelectedStudentIds([]);
        fetchStudents();
        fetchDashboardData(true);
      } else {
        setError(data.message || 'Failed to delete students');
      }
    } catch (err) {
      setError('Network connection issue during deletion');
    }
  };

  const parseCSVText = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const parts = line.split(/[,\t]/).map(p => p.trim());
      if (parts.length >= 4) {
        parsed.push({
          rollNumber: parts[0],
          name: parts[1],
          studentMobile: parts[2],
          parentMobile: parts[3]
        });
      }
    }
    return parsed;
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkText || !bulkSection) {
      setBulkError('Both CSV text and target section are required');
      return;
    }

    const studentsToUpload = parseCSVText(bulkText);
    if (studentsToUpload.length === 0) {
      setBulkError('Could not parse any valid student records. Check your format.');
      return;
    }

    setBulkSubmitting(true);
    setBulkError('');
    setBulkSuccess('');

    try {
      const res = await fetch('/api/student-attendance/students/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          section: bulkSection,
          students: studentsToUpload
        })
      });

      const data = await res.json();
      if (res.ok) {
        setBulkSuccess(data.message || 'Students imported successfully');
        setBulkText('');
        fetchStudents();
        setTimeout(() => {
          setShowBulkModal(false);
          setBulkSuccess('');
        }, 1500);
      } else {
        setBulkError(data.message || 'Failed to import students');
      }
    } catch (err) {
      setBulkError('Network connection issue');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Helper to determine status priority for classroom card sorting
  // Top: Not Entered (1), Pending (2)
  // Mid: No Active Period / College is on Holiday / others (3)
  // Bottom: Present (4)
  const getStatusPriority = (status) => {
    switch (status) {
      case 'Not Entered':
        return 1;
      case 'Pending':
        return 2;
      case 'No Active Period':
      case 'College is on Holiday':
      case 'Free Period':
      case 'No Class':
        return 3;
      case 'Present':
        return 4;
      default:
        return 5;
    }
  };

  // Filter classrooms by search query and sort by priority (Not Entered & Pending at top, Present at bottom)
  const filteredClassrooms = classrooms
    .filter((c) =>
      c.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));

  // Filter registered students list
  const filteredStudentsList = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchStudentQuery.toLowerCase()) ||
                          s.rollNumber.toLowerCase().includes(searchStudentQuery.toLowerCase());
    const matchesSection = filterStudentSection ? s.section === filterStudentSection : true;
    return matchesSearch && matchesSection;
  });

  const handleSelectStudentToggle = (studentId) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllFilteredStudents = () => {
    const allFilteredIds = filteredStudentsList.map(s => s.id);
    const allSelected = allFilteredIds.every(id => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedStudentIds(prev => {
        const uniqueNewIds = allFilteredIds.filter(id => !prev.includes(id));
        return [...prev, ...uniqueNewIds];
      });
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      


      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-semibold rounded-xl animate-fade-in">
          ✓ {success}
        </div>
      )}

      {/* VIEW 1: FACULTY MONITOR (Original Dashboard content) */}
      {activeTab === 'faculty' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-customText dark:text-customText-dark tracking-tight flex items-center gap-2">
                <span>
                  {user?.role === 'SUPER_ADMIN'
                    ? (selectedDepartment && selectedDepartment !== 'ALL' ? selectedDepartment : 'Campus-Wide Overview')
                    : (user?.department || 'Department Overview')}
                </span>
              </h2>
              <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                Live classroom counts, timetable tracking, and faculty activity feed
              </p>
            </div>
            {user?.department && user?.role !== 'SUPER_ADMIN' && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                🏛️ {user.department}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {stats && (
              <div className="lg:col-span-1 flex">
                <StatCard
                  title="Total Classrooms"
                  value={stats.classrooms}
                  icon={Building}
                  description={trackingEnabled ? "Monitoring live" : "Tracking is disabled"}
                />
              </div>
            )}

            {(user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <div className="lg:col-span-2 glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 flex flex-col justify-between space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-customText dark:text-customText-dark uppercase tracking-wider">
                      System Settings & Controls
                    </h3>
                    <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark mt-0.5">
                      Configure tracking status and manage database records
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-customText">
                      {trackingEnabled ? (
                        <span className="text-green-600 dark:text-green-400 font-extrabold uppercase bg-green-500/10 px-2 py-0.5 rounded border border-green-500/10">Classes Running</span>
                      ) : (
                        <span className="text-purple-600 dark:text-purple-400 font-extrabold uppercase bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/10">College on Holiday</span>
                      )}
                    </span>
                    
                    <button
                      type="button"
                      onClick={handleToggleTracking}
                      disabled={toggleSubmitting}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        trackingEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          trackingEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-850 pt-3">
                  <form onSubmit={handleClearHistory} className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="w-full sm:w-auto">
                        <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1">
                          Clear Log History Action
                        </label>
                        <select
                          value={clearAction}
                          onChange={(e) => {
                            setClearAction(e.target.value);
                            setClearClassroomId('');
                            setClearStartDate('');
                            setClearEndDate('');
                            setClearSuccess('');
                            setClearError('');
                          }}
                          className="glass-input text-xs py-1.5 min-w-[200px]"
                        >
                          <option value="">Select action...</option>
                          <option value="all">Clear All Log History</option>
                          <option value="classroom">Clear Logs by Classroom</option>
                          <option value="date_range">Clear Logs by Date Range</option>
                        </select>
                      </div>

                      {clearAction && (
                        <button
                          type="submit"
                          disabled={clearSubmitting}
                          className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-750 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-[0.98] shrink-0"
                        >
                          {clearSubmitting ? 'Clearing...' : 'Execute Clear'}
                        </button>
                      )}
                    </div>

                    {clearAction === 'classroom' && (
                      <div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-200/40 dark:border-slate-800/40 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                        <div>
                          <label className="block text-[9px] font-bold text-customText-muted uppercase mb-1">
                            Target Classroom
                          </label>
                          <select
                            required
                            value={clearClassroomId}
                            onChange={(e) => setClearClassroomId(e.target.value)}
                            className="glass-input text-xs py-1.5"
                          >
                            <option value="">Choose classroom...</option>
                            {classrooms.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.className} ({c.roomNumber})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {clearAction === 'date_range' && (
                      <div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-200/40 dark:border-slate-800/40 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                        <div>
                          <label className="block text-[9px] font-bold text-customText-muted uppercase mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            required
                            value={clearStartDate}
                            onChange={(e) => setClearStartDate(e.target.value)}
                            className="glass-input text-xs py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-customText-muted uppercase mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            required
                            value={clearEndDate}
                            onChange={(e) => setClearEndDate(e.target.value)}
                            className="glass-input text-xs py-1.5"
                          />
                        </div>
                      </div>
                    )}

                    {clearSuccess && (
                      <p className="text-[11px] text-green-600 dark:text-green-400 font-bold bg-green-500/10 px-2.5 py-1.5 rounded-lg border border-green-500/15">
                        ✅ {clearSuccess}
                      </p>
                    )}

                    {clearError && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-bold bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/15">
                        ⚠️ {clearError}
                      </p>
                    )}
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Classroom Live grid row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 backdrop-blur-md">
                <div>
                  <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark">
                    Live Classroom Monitor
                  </h3>
                  <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                    Classrooms color code dynamically based on current timetabled period status
                  </p>
                </div>
                
                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-customText-muted dark:text-customText-mutedDark">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search room or class..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredClassrooms.map((c) => (
                  <ClassroomCard
                    key={c.id}
                    roomNumber={c.roomNumber}
                    className={c.className}
                    status={c.status}
                    currentPeriod={c.currentPeriod}
                    studentCount={c.studentCount}
                    onClick={() => handleCardClick(c)}
                  />
                ))}

                {filteredClassrooms.length === 0 && (
                  <div className="col-span-2 text-center py-20 bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-customText-muted dark:text-customText-mutedDark text-sm">
                    No classrooms found matching selection.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1 h-full">
              <ActivityFeed activities={activity} />
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: STUDENT REGISTRY */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark">
                Registered Students Registry
              </h3>
              <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                Create new student profiles and assign them to specific section/classrooms
              </p>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setShowBulkModal(true);
                  setBulkText('');
                  setBulkSection(classrooms.length > 0 ? classrooms[0].className : '');
                  setBulkError('');
                  setBulkSuccess('');
                }}
                className="btn-secondary flex items-center gap-1.5 text-xs py-2"
              >
                <Plus size={14} />
                <span>Bulk Upload</span>
              </button>
              
              <button
                onClick={() => {
                  setShowAddStudentModal(true);
                  setStudentSubmitError('');
                  setStudentSubmitSuccess('');
                }}
                className="btn-primary flex items-center gap-1.5 text-xs py-2"
              >
                <UserPlus size={14} />
                <span>Register Student</span>
              </button>
            </div>
          </div>

          <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/45 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
              <div className="relative w-full sm:w-72">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search name or roll number..."
                  value={searchStudentQuery}
                  onChange={(e) => setSearchStudentQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 glass-input text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-customText-muted uppercase shrink-0">Class Section:</span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={filterStudentSection}
                    onChange={(e) => setFilterStudentSection(e.target.value)}
                    className="glass-input text-xs py-2 w-full sm:w-48"
                  >
                    <option value="">-- All Sections (Total: {students.length}) --</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.className}>
                        {c.className} ({getSectionCount(c.className)})
                      </option>
                    ))}
                  </select>
                  {filterStudentSection && (
                    <button
                      onClick={() => handleBulkDeleteStudents('section')}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs transition-colors shrink-0 cursor-pointer shadow-sm"
                      title={`Delete entire section "${filterStudentSection}"`}
                    >
                      <Trash2 size={13} />
                      <span>Delete Section</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk actions banner if students selected */}
            {selectedStudentIds.length > 0 && (
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-450">
                  Selected {selectedStudentIds.length} students
                </span>
                <button
                  onClick={() => handleBulkDeleteStudents('selected')}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete Selected</span>
                </button>
              </div>
            )}

            {/* Student Count Summary Banner */}
            <div className="flex flex-wrap gap-3 text-xs font-bold mt-2">
              <span className="bg-primary/10 text-primary-dark dark:text-primary px-3 py-1.5 rounded-xl border border-primary/20 flex items-center gap-1.5 shadow-sm">
                👥 Total Registered Students: {students.length}
              </span>
              {filterStudentSection && (
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-450 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                  📁 Section "{filterStudentSection}": {getSectionCount(filterStudentSection)} students
                </span>
              )}
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                    <th className="pb-3 w-8">
                      <input
                        type="checkbox"
                        checked={filteredStudentsList.length > 0 && filteredStudentsList.every(s => selectedStudentIds.includes(s.id))}
                        onChange={handleSelectAllFilteredStudents}
                        className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="pb-3">Roll Number</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Section/Class</th>
                    <th className="pb-3">Student Mobile</th>
                    <th className="pb-3">Parent's Mobile</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs text-customText dark:text-customText-dark">
                  {filteredStudentsList.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={() => handleSelectStudentToggle(s.id)}
                          className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 font-semibold text-primary">{s.rollNumber}</td>
                      <td className="py-3 font-bold">{s.name}</td>
                      <td className="py-3 font-semibold">{s.section}</td>
                      <td className="py-3">{s.studentMobile}</td>
                      <td className="py-3">
                        <button
                          onClick={() => handleMakeCall(s.parentMobile)}
                          className="flex items-center gap-1 text-primary-dark hover:underline font-semibold"
                        >
                          <PhoneCall size={12} />
                          <span>{s.parentMobile}</span>
                        </button>
                      </td>
                      <td className="py-3 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenStudentLeaveHistory(s.rollNumber, s.name, s.section)}
                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors cursor-pointer"
                          title="View Student's Leave Applications & History"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => handleEditStudentClick(s)}
                          className="p-1 text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit Student details / Transfer section"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                          title="Delete Student Profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStudentsList.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-customText-muted">
                        No students found registered under this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ABSENTEES TRACKING */}
      {activeTab === 'absentees' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark">
                CR Attendance hitting Monitor
              </h3>
              <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                View student absentees and late comers marked by Class Representatives today
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div>
                <select
                  value={absenteesSection}
                  onChange={(e) => setAbsenteesSection(e.target.value)}
                  className="glass-input text-xs py-2"
                >
                  <option value="All">All Sections</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.className}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={absenteesDate || todayDate}
                  onChange={(e) => setAbsenteesDate(e.target.value)}
                  className="glass-input text-xs py-2"
                />
              </div>
            </div>
          </div>

          {absenteesError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl">
              ⚠️ {absenteesError}
            </div>
          )}

          {loadingAbsentees ? (
            <div className="text-center py-12 text-xs text-customText-muted">Loading attendance data...</div>
          ) : (
            <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/45">
              <h4 className="font-bold text-sm text-customText-muted uppercase tracking-wider mb-6">
                Absentees List ({absentees.length})
              </h4>

              {absentees.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed text-customText-muted">
                  No absentees or late entries marked {absenteesSection === 'All' ? '' : `for ${absenteesSection}`} on selected date.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {absentees.map((item) => {
                    const isLate = item.status === 'Late';
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200 relative ${
                          isLate 
                            ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50' 
                            : 'bg-red-500/5 border-red-500/20 hover:border-red-500/35'
                        }`}
                      >
                        <span className={`absolute top-4 right-4 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                          isLate 
                            ? 'bg-amber-100 text-amber-700 border-amber-250 dark:bg-amber-950/40 dark:text-amber-450 dark:border-amber-800' 
                            : 'bg-red-100 text-red-700 border-red-250 dark:bg-red-950/40 dark:text-red-450 dark:border-red-800'
                        }`}>
                          {item.status}
                        </span>

                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                            {item.rollNumber}
                          </h4>
                          <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold block">
                            {item.name} • {item.section}
                          </span>
                        </div>

                        {/* Call Triggers */}
                        <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/10 space-y-2 text-xs">
                          <div className="flex justify-between items-center text-customText-muted">
                            <span>Student:</span>
                            <span className="font-bold text-customText dark:text-customText-dark">{item.studentMobile}</span>
                          </div>
                          
                          <div className="flex justify-between items-center text-customText-muted">
                            <span>Parent Mobile:</span>
                            <button
                              onClick={() => handleMakeCall(item.parentMobile)}
                              className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-primary-dark/10 hover:bg-primary-dark/20 text-primary-dark font-extrabold transition-all"
                              title="Click to Call Parent"
                            >
                              <PhoneCall size={12} />
                              <span>{item.parentMobile}</span>
                            </button>
                          </div>

                          {/* Call Log details if answered by absent controller */}
                          {item.callLog && (
                            <div className={`mt-2 p-2 rounded-lg text-[11px] ${
                              item.callLog.answered ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-450' : 'bg-red-500/10 text-red-700 dark:text-red-450'
                            }`}>
                              <p className="font-bold">
                                Call {item.callLog.answered ? 'Answered' : 'Not Answered'}
                              </p>
                              {item.callLog.reason && (
                                <p className="italic font-medium">Reason: "{item.callLog.reason}"</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: ATTENDANCE TIMINGS SETTINGS (HOD ONLY) */}
      {activeTab === 'settings' && (
        <div className="glass-card p-8 max-w-4xl mx-auto border border-slate-200/50 dark:border-slate-800/45 space-y-6">
          <div>
            <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark">
              CR Attendance Timing Settings
            </h3>
            <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-1">
              Configure the time ranges during which Class Representatives are allowed to submit attendance.
            </p>
          </div>

          <form onSubmit={handleSaveTimings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Morning Session Timings */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-900/35 border border-slate-200/40 dark:border-slate-800/30 rounded-2xl space-y-4">
                <h4 className="text-sm font-bold text-primary-dark dark:text-primary uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays size={16} />
                  <span>Morning Session</span>
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                      Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={morningStart}
                      onChange={(e) => setMorningStart(e.target.value)}
                      className="glass-input text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                      End Time
                    </label>
                    <input
                      type="time"
                      required
                      value={morningEnd}
                      onChange={(e) => setMorningEnd(e.target.value)}
                      className="glass-input text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Afternoon Session Timings */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-900/35 border border-slate-200/40 dark:border-slate-800/30 rounded-2xl space-y-4">
                <h4 className="text-sm font-bold text-primary-dark dark:text-primary uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays size={16} />
                  <span>Afternoon Session</span>
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                      Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={afternoonStart}
                      onChange={(e) => setAfternoonStart(e.target.value)}
                      className="glass-input text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                      End Time
                    </label>
                    <input
                      type="time"
                      required
                      value={afternoonEnd}
                      onChange={(e) => setAfternoonEnd(e.target.value)}
                      className="glass-input text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingTimings}
                className="btn-primary py-2.5 px-6 font-bold flex items-center gap-2 bg-primary-dark"
              >
                <Save size={16} />
                <span>{savingTimings ? 'Saving Settings...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 5: OUTPASS APPROVALS (HOD ONLY) */}
      {activeTab === 'outpassApprovals' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Action Alerts */}
          {outpassActionSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{outpassActionSuccess}</span>
            </div>
          )}

          {outpassActionError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{outpassActionError}</span>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary-dark dark:text-primary">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Pending HOD Grant</span>
              <span className="text-2xl font-black">{outpassTickets.filter(t => t.status === 'FORWARDED_TO_HOD').length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Granted (At Gate)</span>
              <span className="text-2xl font-black">{outpassTickets.filter(t => t.status === 'PERMISSION_GRANTED').length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Sent Out by Watchman</span>
              <span className="text-2xl font-black">{outpassTickets.filter(t => t.status === 'SENT_OUT').length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-customText-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider block">Total Applications</span>
              <span className="text-2xl font-black">{outpassTickets.length}</span>
            </div>
          </div>

          {/* Section 1: Faculty Leave & Early Out Applications */}
          {(() => {
            const pendingFacultyTickets = outpassTickets.filter(t => t.applicantType === 'FACULTY' && t.status === 'FORWARDED_TO_HOD');
            
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-customText dark:text-customText-dark tracking-tight flex items-center gap-2">
                      <span>Faculty Permissions & Early Out Applications</span>
                      {pendingFacultyTickets.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-400">
                          {pendingFacultyTickets.length} Pending
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-customText-muted">
                      Direct faculty applications for full-day leave or same-day early departures. Approving forwards the gate clearance directly to the Watchman login.
                    </p>
                  </div>
                </div>

                {pendingFacultyTickets.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                    <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                    <h4 className="font-bold text-sm text-customText dark:text-customText-dark">
                      No Pending Faculty Permission Requests
                    </h4>
                    <p className="text-xs text-customText-muted max-w-sm mx-auto">
                      All faculty permission and early out applications have been processed.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {pendingFacultyTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-primary block">
                              {ticket.id}
                            </span>
                            <h4 className="text-lg font-black text-customText dark:text-customText-dark mt-0.5">
                              {ticket.facultyName || ticket.studentName}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-customText">
                                ID: {ticket.facultyUserId || ticket.rollNumber}
                              </span>
                              <span className="text-xs text-customText-muted font-medium">
                                {ticket.department || ticket.section}
                              </span>
                              {ticket.type === 'FACULTY_EARLY_OUT' ? (
                                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-black border border-amber-500/30">
                                  Early Out at {ticket.leaveTime}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-black border border-blue-500/30">
                                  Full-Day Permission
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedOutpassModalTicket(ticket)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-xs font-bold text-customText-muted flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="View Official Pass Slip"
                            >
                              <FileText size={15} />
                              <span>Slip</span>
                            </button>
                            {canUserDeleteTicket(ticket) ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteOutpass(ticket.id, ticket.facultyName)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                title="Delete Request"
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60"
                                title="Locked: Scheduled permission time has passed. Only Super Admin can delete."
                              >
                                <Lock size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Stated Purpose & Timings */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                          <span className="text-[10px] font-bold text-customText-muted uppercase block">
                            Stated Purpose for Absence / Early Out:
                          </span>
                          <p className="font-semibold text-customText dark:text-customText-dark italic">
                            "{ticket.purpose || ticket.reason}"
                          </p>
                          <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-customText-muted border-t border-slate-200/50 dark:border-slate-800/50">
                            <span><strong>Date of Leave:</strong> {ticket.date || ticket.appliedDate}</span>
                            <span><strong>Departure Time:</strong> {ticket.leaveTime || 'Full Day'}</span>
                            <span><strong>Applied At:</strong> {ticket.appliedDate} {ticket.appliedTime}</span>
                          </div>
                        </div>

                        {/* HOD Action Buttons for Faculty */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveFacultyLeaveHOD(ticket)}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                          >
                            <BadgeCheck size={16} />
                            <span>Accept & Forward to Watchman</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRejectOutpassHOD(ticket, 'Permission denied by Head of Department.')}
                            className="py-2.5 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 2: Student Outpass Applications Forwarded by Absent Controller */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-black text-customText dark:text-customText-dark tracking-tight">
                Student Outpass Applications Forwarded by Absent Controller
              </h3>
              <p className="text-xs text-customText-muted">
                Parent phone confirmation has been verified. Granting permission will dispatch the ticket to the Main Gate Watchman login for physical ID verification.
              </p>
            </div>

            {outpassTickets.filter(t => t.applicantType !== 'FACULTY' && t.status === 'FORWARDED_TO_HOD').length === 0 ? (
              <div className="p-8 text-center rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                <h4 className="font-bold text-sm text-customText dark:text-customText-dark">
                  No Student Outpasses Pending HOD Grant
                </h4>
                <p className="text-xs text-customText-muted max-w-sm mx-auto">
                  All forwarded student outpass requests have been processed.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {outpassTickets.filter(t => t.applicantType !== 'FACULTY' && t.status === 'FORWARDED_TO_HOD').map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    {/* Header */}
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

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenStudentLeaveHistory(ticket.rollNumber, ticket.studentName, ticket.section)}
                          className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="View Student's Previous Leave Applications"
                        >
                          <History size={15} />
                          <span>Past Leaves ({outpassTickets.filter(t => t.rollNumber && t.rollNumber.trim().toUpperCase() === ticket.rollNumber.trim().toUpperCase()).length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedOutpassModalTicket(ticket)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-xs font-bold text-customText-muted flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="View Official Outpass Ticket"
                        >
                          <FileText size={15} />
                          <span>Ticket</span>
                        </button>
                        {canUserDeleteTicket(ticket) ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteOutpass(ticket.id, ticket.studentName)}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Ticket"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60"
                            title="Locked: Permission granted and student sent out. Only Super Admin can delete."
                          >
                            <Lock size={15} />
                          </button>
                        )}
                      </div>
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

                    {/* Parent Verification Stamp by Absent Controller */}
                    <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Parent Verification by Controller
                        </span>
                        <span className="text-[10px] text-customText-muted font-mono">
                          {ticket.absentControllerAction?.displayTime}
                        </span>
                      </div>
                      <p className="font-medium text-customText dark:text-customText-dark">
                        ✓ {ticket.absentControllerAction?.remarks || 'Parent confirmed permission over phone call.'}
                      </p>
                      <span className="text-[10px] text-customText-muted block">
                        Parent Mobile: +91 {ticket.parentMobile}
                      </span>
                    </div>

                    {/* HOD Action Buttons for Students */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleGrantOutpass(ticket)}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                      >
                        <BadgeCheck size={16} />
                        <span>Grant Permission (Send to Watchman)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectOutpassHOD(ticket, 'Permission denied by Head of Department.')}
                        className="py-2.5 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Outpass History for HOD */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-black text-customText dark:text-customText-dark uppercase tracking-wider">
                Department Outpass Log & Clearance Status
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const tickets = await syncOutpassesFromBackend();
                    setOutpassTickets(tickets);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-customText-muted flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Sync latest live tickets from database"
                >
                  <RefreshCw size={13} />
                  <span>Sync</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearOldOutpasses}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Clear all completed (Sent Out) and rejected tickets"
                >
                  <Trash2 size={13} />
                  <span>Clear Completed / Old Tickets</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-customText-muted uppercase">
                  <tr>
                    <th className="p-3">Ref ID</th>
                    <th className="p-3">Applicant / Type</th>
                    <th className="p-3">Stated Purpose</th>
                    <th className="p-3">Parent Call / Stage</th>
                    <th className="p-3">HOD Status</th>
                    <th className="p-3">Gate Exit</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {outpassTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-customText-muted text-xs">
                        No pass or leave tickets found in database.
                      </td>
                    </tr>
                  ) : (
                    outpassTickets.map((t) => {
                      const isFac = t.applicantType === 'FACULTY';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <td className="p-3 font-mono font-bold text-primary">{t.id}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold block">{isFac ? (t.facultyName || t.studentName) : t.studentName}</span>
                              {isFac && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-500/10 text-purple-600">
                                  Faculty
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-customText-muted font-mono">
                                {isFac ? (t.facultyUserId || 'Faculty') : t.rollNumber} • {t.department || t.section}
                              </span>
                              {!isFac && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentLeaveHistory(t.rollNumber, t.studentName, t.section)}
                                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  title="View Student's Previous Leave History"
                                >
                                  <History size={10} /> History
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 italic max-w-xs truncate">
                            <span className="font-semibold block not-italic text-[11px] text-primary-dark">
                              {t.type === 'FACULTY_EARLY_OUT' ? `Early Out (${t.leaveTime})` : (isFac ? 'Full-Day Leave' : 'Outpass')}
                            </span>
                            "{t.purpose || t.reason}"
                          </td>
                          <td className="p-3">
                            {isFac ? (
                              <span className="text-slate-500 text-[11px] font-semibold">Direct to HOD</span>
                            ) : t.absentControllerAction?.confirmed ? (
                              <span className="text-emerald-600 font-bold">✓ Confirmed</span>
                            ) : (
                              <span className="text-amber-500 font-medium">Pending Call</span>
                            )}
                          </td>
                          <td className="p-3">
                            {t.hodAction?.granted ? (
                            <span className="text-emerald-600 font-bold">✓ Granted</span>
                          ) : t.status === 'REJECTED' && t.rejectionStage === 'HOD' ? (
                            <span className="text-rose-600 font-bold">✕ Denied</span>
                          ) : (
                            <span className="text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="p-3">
                          {t.watchmanAction?.sentOut ? (
                            <span className="text-purple-600 font-extrabold flex items-center gap-1">
                              <DoorOpen size={13} /> Sent Out
                            </span>
                          ) : (
                            <span className="text-slate-400">At Campus</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedOutpassModalTicket(t)}
                              className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] transition-colors cursor-pointer"
                              title="View slip details"
                            >
                              Slip
                            </button>
                            {canUserDeleteTicket(t) ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteOutpass(t.id, t.studentName)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                title="Delete this ticket permanently"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60"
                                title={
                                  t.applicantType === 'FACULTY'
                                    ? "Locked: Scheduled permission time has passed. Only Super Admin can delete."
                                    : "Locked: Permission granted and student sent out. Only Super Admin can delete."
                                }
                              >
                                <Lock size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VIEW 5: DATA EXPORT & IMPORT (ADMIN MIGRATION UTILITY) */}
      {activeTab === 'dataBackup' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Security & Isolation Notice */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-primary/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <ShieldIcon size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-customText dark:text-customText-dark flex items-center gap-2">
                  <span>Secure Admin Data Management & Migration Utility</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Live Production Protected
                  </span>
                </h4>
                <p className="text-xs text-customText-muted">
                  Read-only export from current Supabase PostgreSQL. Import engine targets the new MySQL version while preserving all IDs and relationships.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-customText-muted dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              Target: MySQL 8.x / 5.7+
            </span>
          </div>

          {/* Export Alerts */}
          {exportSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{exportSuccessMessage}</span>
            </div>
          )}

          {exportErrorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertCircle size={18} className="shrink-0" />
              <span>{exportErrorMessage}</span>
            </div>
          )}

          {/* TWO MAIN ACTION CARDS: EXPORT & IMPORT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* CARD 1: EXPORT OVERALL DATA */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-customText dark:text-customText-dark">
                      Export Overall Data
                    </h3>
                    <p className="text-xs text-customText-muted">
                      Full read-only snapshot of all tables & relationships into a ZIP archive.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-customText-muted uppercase tracking-wider block">
                    Data Entities Included in Backup Archive:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-customText dark:text-customText-dark font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Users & Staff Accounts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Registered Students</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>Faculty Profiles</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>Classrooms & Sections</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Period Timetable</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>Student Attendance</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Outpass Gate Tickets</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      <span>Call & Classroom Logs</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 text-[11px] text-customText-muted space-y-1">
                  <p>• Preserves primary key IDs, foreign keys, and referential integrity.</p>
                  <p>• Includes <code>metadata.json</code> with versioning, timestamps, and row counts.</p>
                  <p>• Downloads as <code>attendance-system-backup-YYYY-MM-DD.zip</code>.</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary-dark text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Fetching & Compiling 64,000+ Records into ZIP...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Export Overall Data (.zip)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CARD 2: IMPORT PREVIOUS DATA (NEW MYSQL VERSION) */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-customText dark:text-customText-dark">
                      Import Previous Data (MySQL Version)
                    </h3>
                    <p className="text-xs text-customText-muted">
                      Upload ZIP backup to validate integrity and migrate into the new MySQL database.
                    </p>
                  </div>
                </div>

                {/* File Upload Box */}
                <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20 text-center space-y-3">
                  <FileArchive size={28} className="mx-auto text-customText-muted" />
                  <div>
                    <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
                      <span>Click to select backup ZIP file</span>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-customText-muted mt-0.5">
                      Accepts <code>attendance-system-backup-*.zip</code>
                    </p>
                  </div>

                  {selectedBackupFile && (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-between text-customText dark:text-customText-dark">
                      <span className="truncate max-w-[200px]">{selectedBackupFile.name}</span>
                      <span className="text-[10px] font-mono text-customText-muted">
                        {(selectedBackupFile.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  )}
                </div>

                {validationError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleValidateBackup}
                  disabled={!selectedBackupFile || isValidatingBackup}
                  className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isValidatingBackup ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Validating Archive & Checking Relationships...</span>
                    </>
                  ) : (
                    <>
                      <BadgeCheck size={16} />
                      <span>Validate & Preview Backup</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* INTERACTIVE PRE-IMPORT VALIDATION REPORT */}
          {validationReport && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-5 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-black text-customText dark:text-customText-dark flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <span>Backup Archive Validation & Integrity Preview</span>
                  </h3>
                  <p className="text-xs text-customText-muted">
                    Inspected all 10 required JSON files, verified foreign keys, and checked MySQL schema compatibility.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  Ready for MySQL Migration
                </span>
              </div>

              {/* Metadata Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-customText-muted block">Backup Version</span>
                  <span className="font-mono font-bold text-primary">{validationReport.backupVersion}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-customText-muted block">Source Database</span>
                  <span className="font-bold text-customText dark:text-customText-dark">{validationReport.sourceDatabase}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-customText-muted block">Duplicate Records</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {validationReport.duplicateSummary?.totalDuplicates === 0 ? '0 Duplicates' : `${validationReport.duplicateSummary?.totalDuplicates} found`}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-customText-muted block">Broken Relationships</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {validationReport.relationshipSummary?.brokenCount === 0 ? '100% Valid (0 Broken)' : `${validationReport.relationshipSummary?.brokenCount} Broken`}
                  </span>
                </div>
              </div>

              {/* Entity Counts Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-customText-muted">
                  Record Breakdown by Entity ({validationReport.totalRecords.toLocaleString()} total rows):
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  {Object.entries(validationReport.entityCounts || {}).map(([key, count]) => (
                    <div key={key} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="capitalize text-customText-muted font-medium">{key.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-black text-customText dark:text-customText-dark font-mono">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons for Confirmed Import & SQL Generator */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDownloadSql}
                  disabled={isDownloadingSql}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-customText-muted flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Download standalone MySQL script with complete DDL & INSERT statements"
                >
                  <ArrowDownToLine size={15} />
                  <span>{isDownloadingSql ? 'Generating SQL...' : 'Download MySQL Script (.sql)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportConfirmModal(true)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Layers size={15} />
                  <span>Confirm & Execute MySQL Import</span>
                </button>
              </div>
            </div>
          )}

          {/* CONFIRMATION MODAL BEFORE IMPORT */}
          {showImportConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <AlertCircle size={26} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-customText dark:text-customText-dark">
                    Confirm MySQL Data Import
                  </h3>
                  <p className="text-xs text-customText-muted mt-1">
                    You are about to import <strong className="text-customText dark:text-customText-dark">{validationReport?.totalRecords?.toLocaleString()} records</strong> into the new MySQL version.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-bold">✓ Existing PostgreSQL production database will remain untouched.</p>
                  <p>✓ All primary keys and foreign-key relationships will be preserved.</p>
                  <p>✓ This action will be logged in the admin audit history.</p>
                </div>

                {importError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
                    {importError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowImportConfirmModal(false)}
                    disabled={isImporting}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-customText-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Importing into MySQL...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Yes, Execute Import</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* IMPORT SUMMARY REPORT CARD */}
          {importSummary && (
            <div className="p-6 rounded-3xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 shadow-md space-y-4 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                    Data Import Completed Successfully
                  </h4>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white">
                  Status: {importSummary.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-customText-muted block">Records Processed</span>
                  <span className="font-black text-customText dark:text-customText-dark text-base">
                    {importSummary.recordsImported?.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-customText-muted block">Target Engine</span>
                  <span className="font-black text-customText dark:text-customText-dark text-base">
                    {importSummary.targetEngine}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-customText-muted block">Duplicates Handled</span>
                  <span className="font-black text-customText dark:text-customText-dark text-base">
                    {importSummary.duplicatesHandled}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-customText-muted block">Errors Encountered</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                    {importSummary.errors?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT & IMPORT HISTORY LOG TABLE */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-customText dark:text-customText-dark flex items-center gap-2">
                <History size={15} className="text-primary" />
                <span>Data Backup & Migration Audit History</span>
              </h4>
              <button
                type="button"
                onClick={fetchMigrationLogs}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-customText-muted flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={13} className={loadingMigrationLogs ? 'animate-spin' : ''} />
                <span>Refresh History</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-customText-muted uppercase">
                  <tr>
                    <th className="p-3">Action</th>
                    <th className="p-3">Admin</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Archive / Target</th>
                    <th className="p-3">Records Count</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {migrationLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-customText-muted text-xs">
                        No migration or export activities logged yet.
                      </td>
                    </tr>
                  ) : (
                    migrationLogs.map((log) => (
                      <tr key={log.id || log.timestamp} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            log.action === 'EXPORT'
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-customText dark:text-customText-dark">
                          {log.admin}
                        </td>
                        <td className="p-3 text-customText-muted font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 text-customText dark:text-customText-dark max-w-xs truncate font-mono text-[11px]">
                          {log.filename || 'attendance-system-backup.zip'}
                        </td>
                        <td className="p-3 font-black text-primary font-mono">
                          {log.recordsCount ? log.recordsCount.toLocaleString() : '—'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                            log.status === 'SUCCESS'
                              ? 'text-emerald-600 bg-emerald-500/10'
                              : 'text-amber-600 bg-amber-500/10'
                          }`}>
                            ✓ {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Official Outpass Ticket Modal for HOD */}
      {selectedOutpassModalTicket && (
        <OutpassTicketModal
          ticket={selectedOutpassModalTicket}
          onClose={() => setSelectedOutpassModalTicket(null)}
        />
      )}

      {/* HOD View: Student Leave History Modal */}
      {studentHistoryModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                  <History size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight leading-tight">
                    Student Leave Application History
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {studentHistoryModalStudent.name} • <span className="font-mono font-bold text-white">{studentHistoryModalStudent.rollNumber}</span> • {studentHistoryModalStudent.section || 'All Sections'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentHistoryModalStudent(null)}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Metrics & Content */}
            {(() => {
              const historyList = outpassTickets.filter(
                t => t.rollNumber && t.rollNumber.trim().toUpperCase() === studentHistoryModalStudent.rollNumber.trim().toUpperCase()
              ).sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));

              const todayStr = new Date().toLocaleDateString('en-GB');
              const todayCount = historyList.filter(t => t.appliedDate === todayStr).length;
              const grantedCount = historyList.filter(t => t.status === 'PERMISSION_GRANTED' || t.status === 'SENT_OUT').length;
              const sentOutCount = historyList.filter(t => t.status === 'SENT_OUT').length;
              const rejectedCount = historyList.filter(t => t.status === 'REJECTED').length;

              return (
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-customText-muted block">Total Leaves</span>
                      <span className="text-xl font-black text-customText dark:text-customText-dark">{historyList.length}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center text-amber-700 dark:text-amber-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider block">Today's Apps</span>
                      <span className="text-xl font-black">{todayCount}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-700 dark:text-emerald-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider block">Granted / Out</span>
                      <span className="text-xl font-black">{grantedCount} <span className="text-xs font-normal">({sentOutCount} exited)</span></span>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center text-rose-700 dark:text-rose-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider block">Rejected</span>
                      <span className="text-xl font-black">{rejectedCount}</span>
                    </div>
                  </div>

                  {historyList.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                      <CheckCircle2 size={32} className="mx-auto text-slate-400" />
                      <h4 className="font-bold text-sm text-customText dark:text-customText-dark">
                        No Leave Applications on Record
                      </h4>
                      <p className="text-xs text-customText-muted">
                        This student has not submitted any gate leave applications yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-customText-muted">
                        Chronological Applications ({historyList.length})
                      </h4>

                      {historyList.map((item) => {
                        const isToday = item.appliedDate === todayStr;
                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isToday
                                ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/40 shadow-sm'
                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-black text-primary">
                                  {item.id}
                                </span>
                                {isToday && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider">
                                    Today's Application
                                  </span>
                                )}
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                item.status === 'SENT_OUT'
                                  ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                  : item.status === 'PERMISSION_GRANTED'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : item.status === 'FORWARDED_TO_HOD'
                                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                  : item.status === 'REJECTED'
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              }`}>
                                {item.status.replace(/_/g, ' ')}
                              </span>
                            </div>

                            {/* Details & Reason */}
                            <div className="mt-2.5 text-xs space-y-1">
                              <p className="font-semibold text-customText dark:text-customText-dark">
                                <span className="text-customText-muted font-normal">Reason: </span>
                                "{item.reason}"
                              </p>
                              <div className="flex flex-wrap gap-4 text-[11px] text-customText-muted">
                                <span><strong>Applied:</strong> {item.appliedDate} at {item.appliedTime}</span>
                                <span><strong>Destination:</strong> {item.destination}</span>
                                {item.expectedReturnTime && <span><strong>Expected Return:</strong> {item.expectedReturnTime}</span>}
                              </div>
                            </div>

                            {/* Lifecycle Progression Checkpoints */}
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                              {/* Parent Call Verification */}
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                                <span className="text-[10px] font-bold text-customText-muted block uppercase">1. Parent Call</span>
                                {item.absentControllerAction?.confirmed ? (
                                  <div className="text-emerald-600 font-semibold mt-0.5">
                                    ✓ Confirmed ({item.absentControllerAction.displayTime || 'Verified'})
                                    <div className="text-[10px] text-customText-muted truncate font-normal">
                                      By: {item.absentControllerAction.controllerName || 'Controller'}
                                    </div>
                                  </div>
                                ) : item.status === 'REJECTED' && item.rejectionStage === 'ABSENT_CONTROLLER' ? (
                                  <span className="text-rose-600 font-semibold mt-0.5 block">✕ Rejected by Controller</span>
                                ) : (
                                  <span className="text-amber-500 font-medium mt-0.5 block">⏳ Pending Call</span>
                                )}
                              </div>

                              {/* HOD Clearance */}
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                                <span className="text-[10px] font-bold text-customText-muted block uppercase">2. HOD Decision</span>
                                {item.hodAction?.granted ? (
                                  <div className="text-emerald-600 font-semibold mt-0.5">
                                    ✓ Granted ({item.hodAction.displayTime || 'Approved'})
                                    <div className="text-[10px] text-customText-muted truncate font-normal">
                                      By: {item.hodAction.hodName || 'HOD'}
                                    </div>
                                  </div>
                                ) : item.status === 'REJECTED' && item.rejectionStage === 'HOD' ? (
                                  <span className="text-rose-600 font-semibold mt-0.5 block">✕ Denied by HOD</span>
                                ) : item.status === 'FORWARDED_TO_HOD' ? (
                                  <span className="text-blue-600 font-semibold mt-0.5 block">⚡ Awaiting Your Grant</span>
                                ) : (
                                  <span className="text-slate-400 font-normal mt-0.5 block">Awaiting Prior Steps</span>
                                )}
                              </div>

                              {/* Watchman Gate Exit */}
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                                <span className="text-[10px] font-bold text-customText-muted block uppercase">3. Gate Clearance</span>
                                {item.watchmanAction?.sentOut ? (
                                  <div className="text-purple-600 font-extrabold mt-0.5 flex items-center gap-1">
                                    <DoorOpen size={12} /> Exited ({item.watchmanAction.displayTime})
                                    <div className="text-[10px] text-customText-muted truncate font-normal block">
                                      Watchman: {item.watchmanAction.watchmanName || 'Main Gate'}
                                    </div>
                                  </div>
                                ) : item.status === 'PERMISSION_GRANTED' ? (
                                  <span className="text-emerald-600 font-semibold mt-0.5 block">At Gate (Pending Exit)</span>
                                ) : (
                                  <span className="text-slate-400 font-normal mt-0.5 block">Not cleared yet</span>
                                )}
                              </div>
                            </div>

                            {/* Actions on this ticket */}
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedOutpassModalTicket(item)}
                                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                              >
                                <FileText size={13} />
                                <span>View & Download Official Slip (PDF)</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setStudentHistoryModalStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-xs font-bold text-customText transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL FOR STUDENTS (HOD ONLY) */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddStudentModal(false)} />
          
          <div className="relative glass-card border border-white/60 w-full max-w-7xl p-6 bg-white dark:bg-slate-900 shadow-2xl animate-fade-in z-10 text-left">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                Add Student Profile
              </h3>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {studentSubmitError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-655 text-xs font-semibold rounded-lg mb-3">
                ⚠️ {studentSubmitError}
              </div>
            )}

            {studentSubmitSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-655 text-xs font-semibold rounded-lg mb-3">
                ✓ {studentSubmitSuccess}
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Roll / Register Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 22B81A0501"
                    value={studentRoll}
                    onChange={(e) => setStudentRoll(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Assigned Section / Class
                  </label>
                  <select
                    value={studentSection}
                    onChange={(e) => setStudentSection(e.target.value)}
                    className="glass-input text-xs"
                    required
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.className}>
                        {c.className} ({c.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Student Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543201"
                    value={studentMobile}
                    onChange={(e) => setStudentMobile(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Parent Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9123456701"
                    value={parentMobile}
                    onChange={(e) => setParentMobile(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="btn-secondary py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={studentSubmitting}
                  className="btn-primary py-2 text-xs bg-primary-dark"
                >
                  {studentSubmitting ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL FOR STUDENTS (HOD ONLY) */}
      {showEditStudentModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowEditStudentModal(false)} />
          
          <div className="relative glass-card border border-white/60 w-full max-w-7xl p-6 bg-white dark:bg-slate-900 shadow-2xl animate-fade-in z-10 text-left">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                Edit Student details / Transfer section
              </h3>
              <button onClick={() => setShowEditStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {editStudentSubmitError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-650 text-xs font-semibold rounded-lg mb-3 animate-shake">
                ⚠️ {editStudentSubmitError}
              </div>
            )}

            {editStudentSubmitSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-650 text-xs font-semibold rounded-lg mb-3">
                ✓ {editStudentSubmitSuccess}
              </div>
            )}

            <form onSubmit={handleEditStudentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={editStudentName}
                    onChange={(e) => setEditStudentName(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Roll / Register Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 22B81A0501"
                    value={editStudentRoll}
                    onChange={(e) => setEditStudentRoll(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Assigned Section / Class (Transfer Section)
                  </label>
                  <select
                    value={editStudentSection}
                    onChange={(e) => setEditStudentSection(e.target.value)}
                    className="glass-input text-xs"
                    required
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.className}>
                        {c.className} ({c.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Student Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543201"
                    value={editStudentMobile}
                    onChange={(e) => setEditStudentMobile(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Parent Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9123456701"
                    value={editParentMobile}
                    onChange={(e) => setEditParentMobile(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditStudentModal(false)}
                  className="btn-secondary py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editStudentSubmitting}
                  className="btn-primary py-2 text-xs bg-primary-dark"
                >
                  {editStudentSubmitting ? 'Saving changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL FOR STUDENTS (HOD ONLY) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowBulkModal(false)} />
          
          <div className="relative glass-card border border-white/60 w-full max-w-7xl p-6 bg-white dark:bg-slate-900 shadow-2xl animate-fade-in z-10 text-left">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                Bulk Student Import (CSV/Text)
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {bulkError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-655 text-xs font-semibold rounded-lg mb-3">
                ⚠️ {bulkError}
              </div>
            )}

            {bulkSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-655 text-xs font-semibold rounded-lg mb-3">
                ✓ {bulkSuccess}
              </div>
            )}

            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                      Target Section / Class
                    </label>
                    <select
                      value={bulkSection}
                      onChange={(e) => setBulkSection(e.target.value)}
                      className="glass-input text-xs"
                      required
                    >
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.className}>
                          {c.className} ({c.roomNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    <h4 className="text-xs font-extrabold text-customText dark:text-customText-dark mb-2">CSV Upload Guide</h4>
                    <p className="text-[10px] text-customText-muted leading-relaxed">
                      Please format your CSV data line-by-line as follows:
                    </p>
                    <code className="block p-2 bg-slate-100 dark:bg-slate-900/60 rounded text-[10px] font-mono text-primary dark:text-primary-light my-2 select-all leading-normal whitespace-pre">
                      RollNumber,Name,StudentMobile,ParentMobile
                    </code>
                    <p className="text-[10px] text-customText-muted leading-relaxed">
                      Example:
                    </p>
                    <code className="block p-2 bg-slate-100 dark:bg-slate-900/60 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 my-1 leading-normal whitespace-pre">
                      22B81A0501,Aarav Mehta,9876543201,9123456701{"\n"}
                      22B81A0502,Bhavya Sen,9876543202,9123456702
                    </code>
                  </div>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="block text-[10px] font-bold text-customText-muted uppercase tracking-wider mb-1">
                    Paste Student CSV Data
                  </label>
                  <textarea
                    rows="10"
                    required
                    placeholder="Format: RollNumber,Name,StudentMobile,ParentMobile"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="w-full glass-input text-xs font-mono p-3 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                  <p className="text-[10px] text-customText-muted mt-1 leading-snug">
                    * Note: Each line must contain four values separated by a comma (,) or a tab (\t). Upserts are supported, so re-importing existing roll numbers updates their details.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="btn-secondary py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSubmitting || classrooms.length === 0}
                  className="btn-primary py-2 text-xs bg-primary-dark"
                >
                  {bulkSubmitting ? 'Importing...' : 'Import Students'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLASSROOM DETAILS MODAL (TIMETABLE & HISTORY LOGS) */}
      {selectedClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setSelectedClassroom(null); setIsEditing(false); }} />
          
          <div className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl animate-fade-in z-10">
            <button
              onClick={() => { setSelectedClassroom(null); setIsEditing(false); }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>

            {/* Modal Title */}
            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="mb-6 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200/40 dark:border-slate-800/40 animate-fade-in space-y-3 mr-8">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h3 className="font-extrabold text-sm text-customText dark:text-customText-dark">Edit Classroom Info</h3>
                  {editError && <span className="text-[10px] text-red-500 font-bold">⚠️ {editError}</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1">
                      Room Number
                    </label>
                    <input
                      type="text"
                      required
                      value={editRoomNumber}
                      onChange={(e) => setEditRoomNumber(e.target.value)}
                      className="glass-input text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1">
                      Class Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editClassName}
                      onChange={(e) => setEditClassName(e.target.value)}
                      className="glass-input text-xs py-1.5"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t text-xs">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                    disabled={editSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold flex items-center gap-1"
                    disabled={editSubmitting}
                  >
                    {editSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mb-6 flex justify-between items-start mr-8">
                <div>
                  <span className="text-xs font-semibold text-primary tracking-wide uppercase">
                    {selectedClassroom.roomNumber} Detail Monitor
                  </span>
                  <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark">
                    {selectedClassroom.className}
                  </h2>
                </div>
                {(user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditRoomNumber(selectedClassroom.roomNumber);
                      setEditClassName(selectedClassroom.className);
                      setEditError('');
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-dark hover:underline"
                  >
                    <Edit size={14} />
                    <span>Edit Info</span>
                  </button>
                )}
              </div>
            )}

            {/* Modal Body: Timetable schedule list */}
            {loadingDetails ? (
              <div className="text-center py-20 text-slate-500">Loading schedule...</div>
            ) : classroomDetails ? (
              <div className="space-y-6">
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h3 className="font-bold text-sm text-customText dark:text-customText-dark uppercase tracking-wider flex items-center gap-2">
                      <History size={16} className="text-slate-500" />
                      <span>Class Schedule Period Log History</span>
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span>Filter Date:</span>
                      <input
                        type="date"
                        value={modalDateFilter}
                        onChange={(e) => handleModalDateChange(e.target.value)}
                        className="glass-input text-xs py-1 px-2.5 max-w-[150px]"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-2xl border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-850/40 border-b border-slate-200 dark:border-slate-850 text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                          <th className="py-3 px-4">Period</th>
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-4">Faculty Assigned</th>
                          <th className="py-3 px-4">Timings</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-customText dark:text-customText-dark">
                        {classroomDetails.schedule?.map((period) => (
                          <tr key={period.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-3 px-4 font-semibold">{period.periodNo}</td>
                            <td className="py-3 px-4 font-bold">{period.subjectName}</td>
                            <td className="py-3 px-4">{period.facultyName}</td>
                            <td className="py-3 px-4 text-customText-muted dark:text-customText-mutedDark">{period.startTime} - {period.endTime}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border ${
                                period.status === 'Present' 
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/10' 
                                  : 'bg-red-500/10 text-red-650 border-red-500/10'
                              }`}>
                                {period.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {classroomDetails.schedule?.length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center py-10 text-customText-muted">
                              No logs recorded or scheduled for this date.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
