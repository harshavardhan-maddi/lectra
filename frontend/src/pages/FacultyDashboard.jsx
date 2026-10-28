import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Calendar,
  AlertCircle,
  PhoneCall,
  X,
  Save,
  UserCheck,
  UserX,
  ChevronDown,
  FileText,
  History,
  Plus,
  ArrowRight,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  GraduationCap,
  Lock,
  CheckCircle,
  Send,
  Briefcase
} from 'lucide-react';
import Loading from '../components/Loading';
import OutpassTicketModal from '../components/OutpassTicketModal';
import { 
  applyFacultyLeave, 
  applyHodLeave,
  getFacultyMonthlyLeaveUsage, 
  getFacultyLeaveHistory, 
  subscribeToOutpasses,
  getAllOutpasses,
  getFacultyAssignedSection,
  assignFacultyMentorByFaculty,
  subscribeToMentors,
  confirmParentAndForwardToHOD,
  rejectByAbsentController
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

const FacultyDashboard = () => {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();

  // Navigation & Dropdown States
  const [classrooms, setClassrooms] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');

  // Non-teaching faculty detection: Unable to take attendance to students, just apply permissions
  const isNonTeaching = React.useMemo(() => {
    if (user?.facultyType === 'NON_TEACHING') return true;
    try {
      const metaList = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const meta = metaList.find(m => 
        (m.empid && String(m.empid).toLowerCase() === String(user?.userId).toLowerCase()) ||
        (m.name && String(m.name).trim().toLowerCase() === String(user?.name).trim().toLowerCase())
      );
      return meta?.facultyType === 'NON_TEACHING';
    } catch (e) {
      return false;
    }
  }, [user]);

  // HOD user detection: HOD applies permissions here with routing to AO -> Security
  const isHodUser = user?.role === 'HOD' || user?.role === 'SUB_ADMIN';

  const [activeTab, setActiveTab] = useState(
    (isNonTeaching || isHodUser) ? 'leaves' : (searchParams.get('tab') || 'attendance')
  );

  useEffect(() => {
    if (isNonTeaching || isHodUser) {
      setActiveTab('leaves');
      return;
    }
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('attendance');
    }
  }, [searchParams, isNonTeaching, isHodUser]);
  
  // Data States
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // studentId -> 'Present' | 'Absent' | 'Late'
  const [absentees, setAbsentees] = useState([]); // Today's absentees fetched from DB
  
  // Loading & Feedback States
  const [loadingClassrooms, setLoadingClassrooms] = useState(!(isNonTeaching || isHodUser));
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAbsentees, setLoadingAbsentees] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Call Log Modal States
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [answeredCall, setAnsweredCall] = useState(true); // default to Yes (true)
  const [callType, setCallType] = useState('ABSENT'); // 'ABSENT' or 'INFO'
  const [callRecipient, setCallRecipient] = useState('PARENT'); // 'PARENT' or 'STUDENT'
  const [selectedCategory, setSelectedCategory] = useState('Medical');
  const [selectedReason, setSelectedReason] = useState('Fever');
  const [customReason, setCustomReason] = useState('');
  const [savingCallLog, setSavingCallLog] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDate = getTodayDateString();

  // Faculty Leaves & Early Out States
  const [facultyTickets, setFacultyTickets] = useState([]);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState('FACULTY_ONE_HOUR'); // 'FACULTY_ONE_HOUR' or 'FACULTY_4PM'
  const [leaveDate, setLeaveDate] = useState(todayDate);
  const [leaveTime, setLeaveTime] = useState('11:00');
  const [leavePurpose, setLeavePurpose] = useState('');
  const [applyingLeave, setApplyingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');

  // Subscribe to live outpasses and filter for this faculty user
  useEffect(() => {
    const updateTickets = () => {
      if (user) {
        setFacultyTickets(getFacultyLeaveHistory(user.userId || user.name || user.id));
      }
    };
    updateTickets();
    const unsub = subscribeToOutpasses(updateTickets);
    return () => unsub();
  }, [user]);

  // Mentorship States
  const [mentorAssignment, setMentorAssignment] = useState(() => getFacultyAssignedSection(user));
  const [selectedSectionToAssign, setSelectedSectionToAssign] = useState('');
  const [assigningMentor, setAssigningMentor] = useState(false);
  const [mentorAssignError, setMentorAssignError] = useState('');
  const [mentorAssignSuccess, setMentorAssignSuccess] = useState('');

  // Student Outpasses for Mentored Section
  const [allOutpassTickets, setAllOutpassTickets] = useState([]);
  const [mentorActionSuccess, setMentorActionSuccess] = useState('');
  const [mentorActionError, setMentorActionError] = useState('');
  const [rejectingStudentTicket, setRejectingStudentTicket] = useState(null);
  const [customRejectReason, setCustomRejectReason] = useState('Parent refused permission during phone call.');

  // Sync and listen to mentorship registry updates
  useEffect(() => {
    if (user) {
      setMentorAssignment(getFacultyAssignedSection(user));
    }
    const unsubMentors = subscribeToMentors(() => {
      if (user) {
        setMentorAssignment(getFacultyAssignedSection(user));
      }
    });
    return () => unsubMentors();
  }, [user]);

  // Load and subscribe to live outpass tickets (for student outpass applications in this mentor's section)
  useEffect(() => {
    const updateAllTickets = () => {
      setAllOutpassTickets(getAllOutpasses());
    };
    updateAllTickets();
    const unsubAll = subscribeToOutpasses(updateAllTickets);
    return () => unsubAll();
  }, []);

  // Default section selection for assignment
  useEffect(() => {
    if (classrooms.length > 0 && !selectedSectionToAssign) {
      const deptClass = classrooms.find(c => !user?.department || user.department === 'General' || c.department === user.department);
      setSelectedSectionToAssign(deptClass ? deptClass.className : classrooms[0].className);
    }
  }, [classrooms, user, selectedSectionToAssign]);

  // Self-assign mentor (Only once, locked afterwards)
  const handleAssignSelfAsMentor = async () => {
    setMentorAssignError('');
    setMentorAssignSuccess('');
    if (isNonTeaching) {
      setMentorAssignError('Non-teaching staff cannot be assigned as class mentors.');
      return;
    }
    if (!selectedSectionToAssign) {
      setMentorAssignError('Please select a valid section.');
      return;
    }
    try {
      setAssigningMentor(true);
      const assignment = await assignFacultyMentorByFaculty(user, selectedSectionToAssign);
      setMentorAssignment(assignment);
      setMentorAssignSuccess(`Mentorship confirmed for Section ${assignment.section}!`);
      setTimeout(() => setMentorAssignSuccess(''), 4500);
    } catch (err) {
      setMentorAssignError(err.message || 'Failed to assign mentorship.');
    } finally {
      setAssigningMentor(false);
    }
  };

  // Mentor parent confirmation & forward to HOD
  const handleMentorConfirmAndForward = async (ticket) => {
    try {
      setMentorActionError('');
      await confirmParentAndForwardToHOD(ticket.id, {
        controllerName: user?.name || 'Faculty Mentor',
        role: 'Mentor',
        section: mentorAssignment?.section || ticket.section,
        remarks: 'Parent confirmed permission over phone call with Faculty Mentor.'
      });
      setMentorActionSuccess(`Parent confirmed! Outpass for ${ticket.studentName} (${ticket.rollNumber}) has been forwarded to HOD.`);
      setTimeout(() => setMentorActionSuccess(''), 4500);
    } catch (err) {
      setMentorActionError(err.message || 'Failed to forward outpass to HOD.');
    }
  };

  // Mentor reject outpass
  const handleMentorReject = async (ticket, reason) => {
    try {
      setMentorActionError('');
      await rejectByAbsentController(ticket.id, {
        controllerName: user?.name || 'Faculty Mentor',
        role: 'Mentor',
        section: mentorAssignment?.section || ticket.section,
        reason: reason || 'Parent did not grant permission during phone call with Faculty Mentor.'
      });
      setRejectingStudentTicket(null);
      setMentorActionSuccess(`Outpass for ${ticket.studentName} rejected.`);
      setTimeout(() => setMentorActionSuccess(''), 4500);
    } catch (err) {
      setMentorActionError(err.message || 'Failed to reject outpass.');
    }
  };

  const pendingMentorCallsCount = mentorAssignment?.section
    ? allOutpassTickets.filter(t => t.applicantType !== 'FACULTY' && t.section === mentorAssignment.section && t.status === 'PENDING_PARENT_CALL').length
    : 0;

  // Current month quota check
  const facultyMonthlyQuota = getFacultyMonthlyLeaveUsage(
    user?.userId || user?.name || user?.id,
    leaveDate || todayDate
  );

  const handleApplyLeave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLeaveError('');
    setLeaveSuccess('');

    // Pre-check monthly quota: only regular permissions (1-Hour & 4PM) are capped at 2
    // OD does NOT cut regular permissions count
    const currentQuota = getFacultyMonthlyLeaveUsage(
      user?.userId || user?.name || user?.id,
      leaveDate || todayDate
    );

    if (leaveType !== 'FACULTY_OD') {
      if (currentQuota.isLimitExceeded || currentQuota.remaining <= 0) {
        setLeaveError("your limit for leaves has been completed , consult principal.");
        return;
      }
    }

    if (!leavePurpose || !leavePurpose.trim()) {
      setLeaveError('Please specify a valid and proper purpose for your request.');
      return;
    }

    if (leaveType === 'FACULTY_ONE_HOUR' && (!leaveTime || !leaveTime.trim())) {
      setLeaveError('Please specify what time you need to be out for the 1-hour permission.');
      return;
    }

    try {
      setApplyingLeave(true);
      const facultyDept = user?.department || 'Department of CSE(emerging Technologies)';
      
      let ticket;
      if (isHodUser) {
        ticket = await applyHodLeave({
          hodUserId: user?.userId || user?.name || 'HOD',
          hodName: user?.name || 'Head of Department (HOD)',
          department: facultyDept,
          type: leaveType,
          date: leaveDate || todayDate,
          leaveTime: leaveType === 'FACULTY_4PM' ? '04:00 PM' : leaveType === 'FACULTY_OD' ? (leaveTime || 'On Duty (Full Day)') : leaveTime,
          purpose: leavePurpose
        });
        setLeaveSuccess(`HOD permission request submitted! Ref ID: ${ticket.id}. Forwarded to Administrative Officer (AO) for approval.`);
      } else {
        ticket = await applyFacultyLeave({
          facultyId: user?.id,
          facultyUserId: user?.userId,
          facultyName: user?.name,
          department: facultyDept,
          type: leaveType,
          date: leaveDate || todayDate,
          leaveTime: leaveType === 'FACULTY_4PM' ? '04:00 PM' : leaveType === 'FACULTY_OD' ? (leaveTime || 'On Duty (Full Day)') : leaveTime,
          purpose: leavePurpose
        });
        setLeaveSuccess(`Permission request submitted successfully! Ref ID: ${ticket.id}. Forwarded to HOD for approval.`);
      }

      setShowApplyModal(false);
      setLeavePurpose('');
      setTimeout(() => setLeaveSuccess(''), 5000);
    } catch (err) {
      setLeaveError(err.message || 'Failed to submit application.');
    } finally {
      setApplyingLeave(false);
    }
  };

  // 1. Fetch all classrooms on mount (only for teaching faculty)
  useEffect(() => {
    if (isNonTeaching || isHodUser) {
      setLoadingClassrooms(false);
      return;
    }

    const fetchClassrooms = async () => {
      try {
        setLoadingClassrooms(true);
        setError('');
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
          // If token error on background fetch, ignore silently
          if (data.message && !data.message.toLowerCase().includes('token')) {
            setError(data.message);
          }
        }
      } catch (err) {
        // Quiet network fallback
      } finally {
        setLoadingClassrooms(false);
      }
    };

    fetchClassrooms();
  }, [token, isNonTeaching, isHodUser]);

  // 2. Fetch students and today's attendance for the selected classroom
  const loadClassroomData = async () => {
    if (isNonTeaching || isHodUser) {
      setLoadingStudents(false);
      return;
    }
    if (!selectedSection) return;

    try {
      setLoadingStudents(true);
      setError('');
      setSuccess('');

      // Fetch students in this section
      const studRes = await fetch(`/api/student-attendance/students?section=${encodeURIComponent(selectedSection)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const studData = await studRes.json();
      if (!studRes.ok) {
        throw new Error(studData.message || 'Failed to fetch students.');
      }

      setStudents(studData);

      // Fetch today's absentees to populate current attendance
      const absRes = await fetch(`/api/student-attendance/absentees?section=${encodeURIComponent(selectedSection)}&date=${todayDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const absData = await absRes.json();
      
      const newMap = {};
      // Default all to Present
      studData.forEach(s => {
        newMap[s.id] = 'Present';
      });

      // Override from database records if they are Absent or Late
      if (absRes.ok && Array.isArray(absData)) {
        setAbsentees(absData);
        absData.forEach(abs => {
          if (newMap[abs.id] !== undefined) {
            newMap[abs.id] = abs.status;
          }
        });
      } else {
        setAbsentees([]);
      }

      setAttendanceMap(newMap);
    } catch (err) {
      if (err.message && !err.message.toLowerCase().includes('token')) {
        setError(err.message);
      }
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadClassroomData();
  }, [selectedSection, token, isNonTeaching, isHodUser]);

  // Reload absentees when switching to calls tab or after submission
  const loadAbsenteesOnly = async () => {
    if (isNonTeaching || isHodUser) {
      setLoadingAbsentees(false);
      return;
    }
    if (!selectedSection) return;
    try {
      setLoadingAbsentees(true);
      const absRes = await fetch(`/api/student-attendance/absentees?section=${encodeURIComponent(selectedSection)}&date=${todayDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const absData = await absRes.json();
      if (absRes.ok && Array.isArray(absData)) {
        setAbsentees(absData);
      }
    } catch (err) {
      console.error('Failed to reload absentees:', err);
    } finally {
      setLoadingAbsentees(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'calls') {
      loadAbsenteesOnly();
    }
  }, [activeTab]);

  // Attendance Mutators
  const setSingleAttendance = (studentId, status) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: status
    }));
    setSuccess('');
  };

  const handleAllPresent = () => {
    const newMap = { ...attendanceMap };
    students.forEach(s => {
      newMap[s.id] = 'Present';
    });
    setAttendanceMap(newMap);
    setSuccess('All students set to Present. Remember to submit to save changes.');
  };

  const handleAllAbsent = () => {
    const newMap = { ...attendanceMap };
    students.forEach(s => {
      newMap[s.id] = 'Absent';
    });
    setAttendanceMap(newMap);
    setSuccess('All students set to Absent. Remember to submit to save changes.');
  };

  // Submit Bulk Attendance
  const handleSaveAttendance = async () => {
    if (isNonTeaching) {
      setError('Non-teaching staff cannot submit student attendance.');
      return;
    }
    setSavingAttendance(true);
    setError('');
    setSuccess('');

    const attendanceData = Object.entries(attendanceMap).map(([id, status]) => ({
      studentId: Number(id),
      status
    }));

    try {
      const res = await fetch('/api/student-attendance/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          section: selectedSection,
          date: todayDate,
          attendanceData
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess('Attendance registry submitted successfully.');
        loadAbsenteesOnly();
      } else {
        setError(data.message || 'Failed to submit attendance.');
      }
    } catch (err) {
      setError('Error connecting to attendance API.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Call History Loader
  const loadStudentCallHistory = async (studentId) => {
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const res = await fetch(`/api/student-attendance/student/${studentId}/call-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setCallHistory(data);
      } else {
        setHistoryError(data.message || 'Failed to load call history.');
      }
    } catch (err) {
      setHistoryError('Error fetching student logs.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Call Log Modal
  const openCallModal = (student) => {
    if (isNonTeaching) {
      setError('Non-teaching staff cannot access parent calling desk.');
      return;
    }
    setSelectedStudent(student);
    setAnsweredCall(true);
    setSelectedCategory('Medical');
    setSelectedReason('Fever');
    setCustomReason('');
    setCallHistory([]);
    const status = attendanceMap[student.id] || 'Present';
    setCallType(status === 'Absent' ? 'ABSENT' : 'INFO');
    setCallRecipient('PARENT'); // Default to calling parent
    loadStudentCallHistory(student.id);
  };

  // Submit Call Log
  const handleSaveCallLog = async (e) => {
    e.preventDefault();
    if (isNonTeaching) {
      setHistoryError('Non-teaching staff cannot log parent calls.');
      return;
    }
    if (!selectedStudent) return;

    setSavingCallLog(true);
    setHistoryError('');

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
          studentId: selectedStudent.id,
          date: todayDate,
          answered: answeredCall,
          reason: finalReason,
          callType: callType,
          recipient: callRecipient
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedCategory('Medical');
        setSelectedReason('Fever');
        setCustomReason('');
        // Reload history & update absentees log display
        loadStudentCallHistory(selectedStudent.id);
        loadAbsenteesOnly();
      } else {
        setHistoryError(data.message || 'Failed to submit call log.');
      }
    } catch (err) {
      setHistoryError('Error saving call log.');
    } finally {
      setSavingCallLog(false);
    }
  };

  if (loadingClassrooms) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loading fullPage={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-black text-customText dark:text-customText-dark tracking-tight">
            {isHodUser ? 'HOD Permissions & Gate Pass' : isNonTeaching ? 'Non-Teaching Permissions Portal' : 'Faculty Attendance Portal'}
          </h2>
          <p className="text-sm text-customText-muted dark:text-customText-mutedDark">
            {isHodUser 
              ? 'Apply for official permissions, track AO approvals, and download gate departure passes.' 
              : isNonTeaching 
              ? 'Apply for permissions, track approvals, and view official departure slips.' 
              : 'Manage attendance lists, view absentees, and document communication logs.'}
          </p>
        </div>

        {/* Section Selector Dropdown (only for teaching faculty) */}
        {!isNonTeaching && !isHodUser && (
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <label className="text-xs font-bold uppercase tracking-wider text-customText-muted dark:text-customText-mutedDark whitespace-nowrap">
              Selected Section:
            </label>
            <div className="relative flex-1 md:flex-initial">
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="glass-input pr-10 text-sm font-semibold py-2.5"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.className}>
                    {c.className} ({c.roomNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Non-Teaching Faculty notice, HOD notice, or Standard Sub-Nav Tabs */}
      {isNonTeaching ? (
        <div className="space-y-3 mb-3 no-print">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-300 flex items-center justify-between gap-3 text-xs font-bold animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <span>Non-Teaching Staff Portal • Attendance, Call Desk, and Class Mentorship access are disabled. You can apply for permissions and gate departure passes below.</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase tracking-wider shrink-0 border border-amber-500/30">
              Non-Teaching
            </span>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-primary text-white shadow-md shadow-primary/20"
            >
              <Calendar size={15} />
              <span>Faculty Permissions</span>
            </button>
          </div>
        </div>
      ) : isHodUser ? (
        <div className="space-y-3 mb-3 no-print">
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-900 dark:text-indigo-300 flex items-center justify-between gap-3 text-xs font-bold animate-fade-in">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-indigo-600 shrink-0" />
              <span>Head of Department (HOD) Permissions Portal • Apply for your official leaves & permissions here. Approvals route directly to the Administrative Officer (AO) and pass to Security.</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 text-[10px] font-black uppercase tracking-wider shrink-0 border border-indigo-500/30">
              HOD Login
            </span>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-primary text-white shadow-md shadow-primary/20"
            >
              <Calendar size={15} />
              <span>Faculty Permissions (HOD)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 pb-2 overflow-x-auto sm:flex-wrap no-print -mx-1 px-1">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'attendance'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white/60 dark:bg-slate-800/60 text-customText-muted hover:text-customText border border-slate-200/50 dark:border-slate-800/50'
            }`}
          >
            <Users size={15} />
            <span>Attendance Registry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'calls'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white/60 dark:bg-slate-800/60 text-customText-muted hover:text-customText border border-slate-200/50 dark:border-slate-800/50'
            }`}
          >
            <PhoneCall size={15} />
            <span>Parent Call Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaves')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'leaves'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white/60 dark:bg-slate-800/60 text-customText-muted hover:text-customText border border-slate-200/50 dark:border-slate-800/50'
            }`}
          >
            <Calendar size={15} />
            <span>Faculty Permissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mentor')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 relative ${
              activeTab === 'mentor'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white/60 dark:bg-slate-800/60 text-customText-muted hover:text-customText border border-slate-200/50 dark:border-slate-800/50'
            }`}
          >
            <GraduationCap size={15} />
            <span>Class Mentorship</span>
            {pendingMentorCallsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                {pendingMentorCallsCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Active Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-3 no-print">
        <div className="flex items-center gap-3">
          {activeTab === 'attendance' && (
            <>
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary-dark dark:text-primary">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">Student Attendance Registry</h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">Mark student presence, absentees, and late arrivals for your assigned classes</p>
              </div>
            </>
          )}
          {activeTab === 'calls' && (
            <>
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary-dark dark:text-primary">
                <PhoneCall size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">Parent Call Logs & Calling Desk</h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">Follow up with parents of absent students and log reason feedback</p>
              </div>
            </>
          )}
          {activeTab === 'leaves' && (
            <>
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary-dark dark:text-primary">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">Faculty Permissions & Gate Pass</h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">Apply for leaves, same-day early out permissions, and download official departure slips</p>
              </div>
            </>
          )}
          {activeTab === 'mentor' && (
            <>
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <GraduationCap size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">Class Mentorship & Student Outpasses</h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  {mentorAssignment 
                    ? `Assigned Mentor for Section ${mentorAssignment.section} • Verify and forward student outpasses to HOD`
                    : 'Assign yourself to your mentored section to enable student permission approvals'}
                </p>
              </div>
            </>
          )}
        </div>

        {activeTab === 'leaves' && (
          <button
            onClick={() => setShowApplyModal(true)}
            className="btn-primary py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 shrink-0"
          >
            <Plus size={16} />
            <span>Apply Faculty Permission</span>
          </button>
        )}
      </div>

      {/* Direct Call Registry Portal */}

      {/* Feedback Alerts */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-450 text-sm font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-450 text-sm font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <span>{success}</span>
        </div>
      )}

      {/* TAB 1: Attendance Registry */}
      {activeTab === 'attendance' && !isNonTeaching && !isHodUser && (
        <div className="space-y-6">
          {loadingStudents ? (
            <div className="flex items-center justify-center py-20">
              <Loading fullPage={false} size="sm" />
            </div>
          ) : (
            <>
              {/* Quick Actions Panel */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/10 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider block mr-2">
                    Quick Mark:
                  </span>
                  <button
                    onClick={handleAllPresent}
                    className="flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-440 border-emerald-500/10 hover:border-emerald-500/35"
                  >
                    <UserCheck size={14} />
                    <span>All Present</span>
                  </button>
                  <button
                    onClick={handleAllAbsent}
                    className="flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-all bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-440 border-red-500/10 hover:border-red-500/35"
                  >
                    <UserX size={14} />
                    <span>All Absent</span>
                  </button>
                </div>
                <p className="text-[10px] text-customText-muted dark:text-customText-mutedDark font-semibold">
                  Today's Date: {new Date(todayDate).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>

              {/* Student Cards Grid */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                    Student Registry ({students.length} students)
                  </h3>
                  <p className="text-[10px] text-customText-muted dark:text-customText-mutedDark font-semibold">
                    Set Present (P), Absent (A), or Late (L) for each student.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {students.map((student) => {
                    const status = attendanceMap[student.id] || 'Present';
                    const isActiveCall = selectedStudent?.id === student.id;

                    // Cards style overrides
                    let borderClass = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';
                    if (status === 'Absent') borderClass = 'border-red-500 bg-red-500/5 dark:bg-red-950/20';
                    if (status === 'Late') borderClass = 'border-amber-500 bg-amber-500/5 dark:bg-amber-950/20';

                    return (
                      <div
                        key={student.id}
                        className={`flex flex-col justify-between p-4 rounded-2xl border-2 shadow-sm transition-all duration-300 ${
                          isActiveCall
                            ? 'col-span-1 sm:col-span-2 md:col-span-3 border-primary bg-primary/5 shadow-md'
                            : status === 'Absent'
                              ? 'border-red-500 bg-red-500/5 dark:bg-red-950/20'
                              : status === 'Late'
                                ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-950/20'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {isActiveCall ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
                            {/* Left Column: Student Details & Contacts & History */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <h4 className="text-xs font-extrabold text-customText dark:text-customText-dark uppercase tracking-wide">
                                    {student.rollNumber}
                                  </h4>
                                  <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold">
                                    {student.name}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudent(null)}
                                  className="text-slate-450 hover:text-slate-600 p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-2 bg-slate-50 dark:bg-slate-800/10 p-3 rounded-xl border border-slate-200/45 dark:border-slate-800/40 text-xs">
                                <a
                                  href={`tel:${student.studentMobile}`}
                                  onClick={() => setCallRecipient('STUDENT')}
                                  className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border hover:border-primary active:scale-[0.99] transition-all"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <PhoneCall size={12} className="text-primary" />
                                    <div className="truncate">
                                      <p className="text-[8px] font-bold text-slate-400 uppercase">Student Mobile</p>
                                      <p className="text-[10px] font-bold truncate">{student.studentMobile || 'N/A'}</p>
                                    </div>
                                  </div>
                                  <span className="text-[8px] text-primary font-bold whitespace-nowrap ml-1">Call Student</span>
                                </a>
                                <a
                                  href={`tel:${student.parentMobile}`}
                                  onClick={() => setCallRecipient('PARENT')}
                                  className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border hover:border-primary active:scale-[0.99] transition-all"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <PhoneCall size={12} className="text-green-500" />
                                    <div className="truncate">
                                      <p className="text-[8px] font-bold text-slate-400 uppercase">Parent Mobile</p>
                                      <p className="text-[10px] font-bold truncate">{student.parentMobile || 'N/A'}</p>
                                    </div>
                                  </div>
                                  <span className="text-[8px] text-green-500 font-bold whitespace-nowrap ml-1">Call Parent</span>
                                </a>
                              </div>

                              {/* Historical Logs List */}
                              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                                <h5 className="font-extrabold text-[10px] text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                                  History
                                </h5>
                                {loadingHistory ? (
                                  <div className="text-[10px] text-slate-400">Loading history...</div>
                                ) : (
                                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                    {callHistory.length === 0 ? (
                                      <p className="text-[10px] text-slate-450 italic">No logs recorded.</p>
                                    ) : (
                                      callHistory.map((log) => (
                                        <div key={log.id} className="p-2 rounded-lg border bg-white/20 text-[10px] space-y-1">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold">{new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                            <div className="flex gap-1">
                                              <span className="text-[8px] font-semibold bg-slate-100 dark:bg-slate-800 px-1 rounded">{log.recipient === 'STUDENT' ? 'Student' : 'Parent'}</span>
                                              <span className="text-[8px] font-semibold bg-slate-100 dark:bg-slate-800 px-1 rounded">{log.callType === 'INFO' ? 'Info' : 'Absent'}</span>
                                            </div>
                                          </div>
                                          <p className="text-[9px] text-slate-500"><span className="font-medium text-slate-400">Remark:</span> {log.reason || 'None'}</p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Column: Call Logging Form */}
                            <form onSubmit={handleSaveCallLog} className="space-y-3">
                              <h5 className="font-bold text-xs text-primary-dark dark:text-primary uppercase tracking-wider">
                                Record Response
                              </h5>

                              {/* Recipient */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-450">Recipient</label>
                                <div className="flex gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => setCallRecipient('PARENT')}
                                    className={`flex-1 text-[9px] font-bold py-1 rounded-md transition-all ${callRecipient === 'PARENT' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                                  >
                                    Parent
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCallRecipient('STUDENT')}
                                    className={`flex-1 text-[9px] font-bold py-1 rounded-md transition-all ${callRecipient === 'STUDENT' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                                  >
                                    Student
                                  </button>
                                </div>
                              </div>

                              {/* Call Purpose */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-450">Purpose</label>
                                <div className="flex gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => setCallType('INFO')}
                                    className={`flex-1 text-[9px] font-bold py-1 rounded-md transition-all ${callType === 'INFO' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                                  >
                                    Info Pass
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCallType('ABSENT')}
                                    className={`flex-1 text-[9px] font-bold py-1 rounded-md transition-all ${callType === 'ABSENT' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                                  >
                                    Absent Call
                                  </button>
                                </div>
                              </div>

                              {/* Answered Selector Toggle */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-450">Answered?</label>
                                <div className="flex gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => setAnsweredCall(true)}
                                    className={`flex-1 text-[9px] font-bold py-1 rounded-md transition-all ${answeredCall ? 'bg-green-500 text-white shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAnsweredCall(false)}
                                    className={`flex-1 text-[9px] font-bold py-1 rounded-md transition-all ${!answeredCall ? 'bg-red-500 text-white shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                                  >
                                    No
                                  </button>
                                </div>
                              </div>

                              {/* Category and Reason */}
                              {answeredCall && (
                                <>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-450">Category</label>
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
                                    <label className="block text-[10px] font-bold text-slate-450">Reason</label>
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
                                      <label className="block text-[10px] font-bold text-slate-450">Custom Reason</label>
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
                                </>
                              )}

                              <div className="flex justify-end gap-2 pt-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudent(null)}
                                  className="btn-secondary py-1 px-3 text-[10px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={savingCallLog}
                                  className="btn-primary py-1 px-3 text-[10px] bg-primary cursor-pointer"
                                >
                                  {savingCallLog ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start">
                              <div className="space-y-1 min-w-0 flex-1">
                                <h4 className="text-xs font-extrabold text-customText dark:text-customText-dark uppercase tracking-wide truncate">
                                  {student.rollNumber}
                                </h4>
                                <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold truncate">
                                  {student.name}
                                </p>
                              </div>
                              {status === 'Late' ? (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0 ml-2">
                                  Late - Call Restricted
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openCallModal(student)}
                                  className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary-dark dark:text-primary transition-colors ml-2 shrink-0 active:scale-[0.93]"
                                  title="Call parent or student to pass information"
                                >
                                  <PhoneCall size={14} />
                                </button>
                              )}
                            </div>

                            {/* Call Logs Detail if any */}
                            {(() => {
                              const absenteeInfo = absentees.find(a => a.id === student.id);
                              const callLog = absenteeInfo?.callLog;
                              if (!callLog) return null;
                              return (
                                <div className={`mt-2 p-2 rounded-xl text-[10px] ${
                                  callLog.isPreExcused
                                    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-450 border border-sky-500/20'
                                    : callLog.answered 
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-450 border border-emerald-500/20' 
                                      : 'bg-red-500/10 text-red-700 dark:text-red-450 border border-red-500/20'
                                }`}>
                                  <p className="font-bold flex items-center gap-1.5">
                                    {callLog.isPreExcused ? <Calendar size={10} /> : callLog.answered ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                    <span>
                                      {callLog.isPreExcused 
                                        ? 'Pre-informed' 
                                        : callLog.answered ? 'Parent Called' : 'Not Answered'}
                                    </span>
                                  </p>
                                  {callLog.reason && (
                                    <p className="mt-0.5 font-medium italic text-[9px] opacity-90 truncate">
                                      "{callLog.reason}"
                                    </p>
                                  )}
                                  {callLog.caller && (
                                    <p className="mt-0.5 text-[8px] opacity-75 font-semibold">
                                      By: {callLog.caller.name} ({callLog.caller.role})
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Segmented P/A/L Buttons */}
                            <div className="flex items-center gap-1 mt-4 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                              <button
                                type="button"
                                onClick={() => setSingleAttendance(student.id, 'Present')}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                                  status === 'Present'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                              >
                                P
                              </button>
                              <button
                                type="button"
                                onClick={() => setSingleAttendance(student.id, 'Absent')}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                                  status === 'Absent'
                                    ? 'bg-red-500 text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                              >
                                A
                              </button>
                              <button
                                type="button"
                                onClick={() => setSingleAttendance(student.id, 'Late')}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                                  status === 'Late'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                              >
                                L
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {students.length === 0 && (
                    <div className="col-span-full py-16 text-center text-sm text-customText-muted dark:text-customText-mutedDark bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed">
                      No students registered for section "{selectedSection}". Please request HOD or Sub-Admin to import students.
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Action Block */}
              {students.length > 0 && (
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="flex items-center justify-center gap-2 btn-primary px-8 py-3.5 font-extrabold shadow-md hover:shadow-lg transition-all active:scale-[0.98] bg-gradient-to-r from-primary-dark to-primary text-white shadow-primary-dark/10"
                  >
                    <Save size={18} />
                    <span>{savingAttendance ? 'Submitting Attendance...' : 'Submit Attendance Registry'}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: Parent Call Logs */}
      {activeTab === 'calls' && !isNonTeaching && !isHodUser && (
        <div className="space-y-6">
          <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/45">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-base text-customText dark:text-customText-dark flex items-center gap-2">
                <AlertCircle className="text-red-500" size={20} />
                <span>Today's Absentees Call Status ({absentees.length})</span>
              </h3>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-customText-muted dark:text-customText-mutedDark px-2.5 py-1 rounded-md font-semibold">
                Date: {todayDate}
              </span>
            </div>

            {loadingAbsentees ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : absentees.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-customText-muted dark:text-customText-mutedDark">
                🎉 No absentees logged for {selectedSection} today!
              </div>
            ) : (
              <div className="space-y-8">
                {/* Morning Session Absentees */}
                <div>
                  <h4 className="font-extrabold text-xs text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Morning Session Absentees ({absentees.filter(a => a.attendanceSession === 'morning').length})</span>
                  </h4>
                  {absentees.filter(a => a.attendanceSession === 'morning').length === 0 ? (
                    <div className="text-center py-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-customText-muted dark:text-customText-mutedDark">
                      No morning absentees.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {absentees.filter(a => a.attendanceSession === 'morning').map((student) => {
                        const hasCallLog = !!student.callLog;
                        const isAnswered = student.callLog?.answered;
                        const timing = student.callLog?.createdAt ? new Date(student.callLog.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                        const callerName = student.callLog?.caller?.name || (student.callLog?.isPreExcused ? 'System' : 'Unknown');
                        const callerRole = student.callLog?.caller?.role || '';
                        
                        return (
                          <div 
                            key={student.id} 
                            className={`p-5 rounded-2xl border transition-all duration-300 ${
                              hasCallLog 
                                ? isAnswered 
                                  ? 'bg-emerald-500/5 border-emerald-500/20' 
                                  : 'bg-red-500/5 border-red-500/20'
                                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                  {student.rollNumber}
                                </h4>
                                <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold">
                                  {student.name}
                                </span>
                              </div>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                student.status === 'Late'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800'
                                  : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                              }`}>
                                {student.status}
                              </span>
                            </div>

                            <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/20 space-y-2">
                              {hasCallLog ? (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-customText-muted dark:text-customText-mutedDark">Call Status:</span>
                                    <span className={`font-bold ${isAnswered ? 'text-emerald-600 dark:text-emerald-440' : 'text-red-650 dark:text-red-450'}`}>
                                      {isAnswered ? 'Answered' : 'Not Answered'}
                                    </span>
                                  </div>
                                  {student.callLog.reason && (
                                    <div className="flex justify-between text-xs gap-4">
                                      <span className="text-customText-muted dark:text-customText-mutedDark shrink-0">Reason:</span>
                                      <span className="font-semibold text-right text-customText dark:text-customText-dark italic">
                                        "{student.callLog.reason}"
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-xs">
                                    <span className="text-customText-muted dark:text-customText-mutedDark">Called By:</span>
                                    <span className="font-semibold text-customText dark:text-customText-dark">
                                      {callerName} {callerRole && `(${callerRole})`}
                                    </span>
                                  </div>
                                  {timing && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-customText-muted dark:text-customText-mutedDark">Timing:</span>
                                      <span className="font-semibold text-customText dark:text-customText-dark">
                                        {timing}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-2 text-xs text-customText-muted dark:text-customText-mutedDark italic">
                                  Parent not called yet today.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Afternoon Session Absentees */}
                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/10">
                  <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Afternoon Session Absentees ({absentees.filter(a => a.attendanceSession === 'afternoon').length})</span>
                  </h4>
                  {absentees.filter(a => a.attendanceSession === 'afternoon').length === 0 ? (
                    <div className="text-center py-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-customText-muted dark:text-customText-mutedDark">
                      No afternoon absentees.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {absentees.filter(a => a.attendanceSession === 'afternoon').map((student) => {
                        const hasCallLog = !!student.callLog;
                        const isAnswered = student.callLog?.answered;
                        const timing = student.callLog?.createdAt ? new Date(student.callLog.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                        const callerName = student.callLog?.caller?.name || (student.callLog?.isPreExcused ? 'System' : 'Unknown');
                        const callerRole = student.callLog?.caller?.role || '';
                        
                        return (
                          <div 
                            key={student.id} 
                            className={`p-5 rounded-2xl border transition-all duration-300 ${
                              hasCallLog 
                                ? isAnswered 
                                  ? 'bg-emerald-500/5 border-emerald-500/20' 
                                  : 'bg-red-500/5 border-red-500/20'
                                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="text-sm font-bold text-customText dark:text-customText-dark uppercase">
                                  {student.rollNumber}
                                </h4>
                                <span className="text-[11px] text-customText-muted dark:text-customText-mutedDark font-semibold">
                                  {student.name}
                                </span>
                              </div>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                student.status === 'Late'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-250 dark:border-amber-800'
                                  : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 border border-red-250 dark:border-red-800'
                              }`}>
                                {student.status}
                              </span>
                            </div>

                            <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/20 space-y-2">
                              {hasCallLog ? (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-customText-muted dark:text-customText-mutedDark">Call Status:</span>
                                    <span className={`font-bold ${isAnswered ? 'text-emerald-600 dark:text-emerald-440' : 'text-red-650 dark:text-red-450'}`}>
                                      {isAnswered ? 'Answered' : 'Not Answered'}
                                    </span>
                                  </div>
                                  {student.callLog.reason && (
                                    <div className="flex justify-between text-xs gap-4">
                                      <span className="text-customText-muted dark:text-customText-mutedDark shrink-0">Reason:</span>
                                      <span className="font-semibold text-right text-customText dark:text-customText-dark italic">
                                        "{student.callLog.reason}"
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-xs">
                                    <span className="text-customText-muted dark:text-customText-mutedDark">Called By:</span>
                                    <span className="font-semibold text-customText dark:text-customText-dark">
                                      {callerName} {callerRole && `(${callerRole})`}
                                    </span>
                                  </div>
                                  {timing && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-customText-muted dark:text-customText-mutedDark">Timing:</span>
                                      <span className="font-semibold text-customText dark:text-customText-dark">
                                        {timing}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-2 text-xs text-customText-muted dark:text-customText-mutedDark italic">
                                  Parent not called yet today.
                                </div>
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
      )}

      {/* TAB 3: Faculty Leave & Early Out Gate Pass */}
      {activeTab === 'leaves' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Notifications */}
          {leaveSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{leaveSuccess}</span>
            </div>
          )}

          {leaveError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{leaveError}</span>
            </div>
          )}

          {/* Quota Exhaustion Warning Banner */}
          {facultyMonthlyQuota.isLimitExceeded && (
            <div className="p-5 rounded-3xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="text-base font-black tracking-tight uppercase text-rose-700 dark:text-rose-400">
                    your limit for permissions has been completed , consult principal.
                  </h4>
                  <p className="text-xs text-rose-800 dark:text-rose-300 font-medium mt-0.5">
                    You have utilized your maximum allowance of 2 permissions for {facultyMonthlyQuota.monthName}. Monthly quotas reset every calendar month and do not accumulate.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Quota & Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            
            {/* Metric 1: Monthly Usage */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-customText-muted">
                  Regular Used
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  facultyMonthlyQuota.count >= 2 
                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30' 
                    : 'bg-primary/10 text-primary-dark dark:text-primary'
                }`}>
                  {facultyMonthlyQuota.monthName}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-customText dark:text-customText-dark">
                  {facultyMonthlyQuota.count}
                </span>
                <span className="text-sm font-bold text-customText-muted">/ 2 Permissions</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${facultyMonthlyQuota.count >= 2 ? 'bg-rose-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, (facultyMonthlyQuota.count / 2) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-customText-muted">
                Strict limit: 2 permissions per month.
              </p>
            </div>

            {/* Metric 2: Remaining Leaves */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-customText-muted">
                Regular Remaining
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black ${
                  facultyMonthlyQuota.remaining === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {facultyMonthlyQuota.remaining}
                </span>
                <span className="text-sm font-bold text-customText-muted">Available</span>
              </div>
              <p className="text-[10px] text-customText-muted">
                {facultyMonthlyQuota.remaining === 0 
                  ? 'Limit reached for this month. Consult principal.' 
                  : 'Valid only for current calendar month.'}
              </p>
            </div>

            {/* Metric 3: OD (On Duty) Permissions */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-customText-muted">
                  OD (On Duty) Permissions
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 border border-amber-500/30">
                  Separate Quota
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
                  {facultyMonthlyQuota.odCount || 0}
                </span>
                <span className="text-sm font-bold text-customText-muted">Taken this month</span>
              </div>
              <p className="text-[10px] text-customText-muted">
                OD permissions do not cut your 2 monthly permission count.
              </p>
            </div>

            {/* Metric 4: Approved / Passes */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-customText-muted">
                Approved Gate Passes
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-purple-600 dark:text-purple-400">
                  {facultyTickets.filter(t => t.status === 'PERMISSION_GRANTED' || t.status === 'SENT_OUT').length}
                </span>
                <span className="text-sm font-bold text-customText-muted">Total</span>
              </div>
              <p className="text-[10px] text-customText-muted">
                {facultyTickets.filter(t => t.status === 'PERMISSION_GRANTED').length} active at gate now
              </p>
            </div>

            {/* Action Card: Apply Button */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-black uppercase text-primary-dark dark:text-primary tracking-wider block">
                  Quick Application
                </span>
                <p className="text-[11px] text-customText-muted mt-0.5">
                  Apply for a full-day leave or same-day early departure pass.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLeaveError('');
                  setShowApplyModal(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-primary/20 transition-all cursor-pointer active:scale-95"
              >
                <Plus size={16} />
                <span>Apply Leave / Early Out</span>
              </button>
            </div>

          </div>

          {/* Requests History & Gate Pass Slips Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-black text-customText dark:text-customText-dark">
                  My Faculty Permissions & Applications
                </h3>
                <p className="text-xs text-customText-muted">
                  Live status of your requested permissions, HOD approvals, and Security Head gate departure slips
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLeaveError('');
                  setShowApplyModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary-dark dark:text-primary font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>New Request</span>
              </button>
            </div>

            {facultyTickets.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Calendar size={28} />
                </div>
                <h4 className="font-bold text-customText dark:text-customText-dark">
                  No Applications Found
                </h4>
                <p className="text-xs text-customText-muted max-w-sm mx-auto">
                  You haven't submitted any leave or early out requests yet. Click the button above to apply.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {facultyTickets.map((ticket) => {
                  return (
                    <div 
                      key={ticket.id}
                      className="p-5 sm:p-6 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {ticket.id}
                          </span>

                          {ticket.type === 'FACULTY_4PM' ? (
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[11px] font-black border border-blue-500/30">
                              4:00 PM Permission
                            </span>
                          ) : ticket.type === 'FACULTY_ONE_HOUR' ? (
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] font-black border border-amber-500/30">
                              1-Hour Permission (Out: {ticket.leaveTime})
                            </span>
                          ) : ticket.type === 'FACULTY_EARLY_OUT' ? (
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] font-black border border-amber-500/30">
                              Early Out at {ticket.leaveTime}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[11px] font-black border border-blue-500/30">
                              Full-Day Leave
                            </span>
                          )}

                          {ticket.status === 'FORWARDED_TO_HOD' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-extrabold">
                              Awaiting HOD Approval
                            </span>
                          )}

                          {ticket.status === 'PERMISSION_GRANTED' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                              Accepted by HOD • Forwarded to Security Head
                            </span>
                          )}

                          {ticket.status === 'FACULTY_OUT' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-black border border-amber-500/30 animate-pulse">
                              Outside Campus (Out: {ticket.watchmanAction?.displayTime || ticket.leaveTime}) • Return Pending
                            </span>
                          )}

                          {ticket.status === 'SENT_OUT' && (
                            ticket.returned || ticket.inTime ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                                Returned to College ({ticket.inTime}) • Closed
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 text-[10px] font-black border border-purple-500/30">
                                Departed • Closed ({ticket.watchmanAction?.displayTime || 'Out'})
                              </span>
                            )
                          )}

                          {ticket.status === 'REJECTED' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black">
                              Rejected by HOD
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-customText-muted">
                          <span><strong>Date:</strong> {ticket.date || ticket.appliedDate}</span>
                          <span><strong>Applied:</strong> {ticket.appliedDate} {ticket.appliedTime}</span>
                          {ticket.hodAction?.hodName && (
                            <span><strong>HOD:</strong> {ticket.hodAction.hodName}</span>
                          )}
                        </div>

                        <p className="text-xs font-medium text-customText dark:text-customText-dark italic mt-1">
                          "{ticket.purpose || ticket.reason}"
                        </p>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedTicketForModal(ticket)}
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary transition-colors text-customText text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <FileText size={15} />
                          <span>View Official Slip</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: CLASS MENTORSHIP & STUDENT OUTPASSES */}
      {activeTab === 'mentor' && !isNonTeaching && !isHodUser && (
        <div className="space-y-6 animate-fade-in">

          {/* Feedback Alerts for Mentor Actions */}
          {mentorActionSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold rounded-2xl flex items-center gap-2">
              <CheckCircle size={18} className="shrink-0" />
              <span>{mentorActionSuccess}</span>
            </div>
          )}

          {mentorActionError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-2xl flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{mentorActionError}</span>
            </div>
          )}

          {/* CASE 1: FACULTY HAS NOT YET ASSIGNED THEMSELVES */}
          {!mentorAssignment ? (
            <div className="glass-card p-6 sm:p-8 border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/15 rounded-3xl space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/20">
                  <GraduationCap size={26} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-customText dark:text-customText-dark tracking-tight">
                    Class Mentorship Assignment
                  </h3>
                  <p className="text-sm text-customText-muted dark:text-customText-mutedDark">
                    Assign yourself as the mentor to a section in your department ({user?.department || 'Department'}). Once assigned, you will be able to review and forward student leave applications to the HOD.
                  </p>
                </div>
              </div>

              {mentorAssignError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{mentorAssignError}</span>
                </div>
              )}

              {mentorAssignSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle size={16} className="shrink-0" />
                  <span>{mentorAssignSuccess}</span>
                </div>
              )}

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-customText-muted dark:text-customText-mutedDark block mb-2">
                    Select Your Mentored Section:
                  </label>
                  <select
                    value={selectedSectionToAssign}
                    onChange={(e) => setSelectedSectionToAssign(e.target.value)}
                    className="glass-input w-full max-w-md text-sm font-bold py-2.5 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-customText dark:text-customText-dark"
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.className}>
                        {c.className} ({c.department || user?.department || 'Department'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                  <Lock size={15} className="shrink-0" />
                  <span>Important: You can assign yourself as mentor only once. Please ensure you pick the correct section.</span>
                </div>

                <button
                  type="button"
                  onClick={handleAssignSelfAsMentor}
                  disabled={assigningMentor || !selectedSectionToAssign}
                  className="btn-primary py-3 px-6 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  <span>{assigningMentor ? 'Confirming Mentorship...' : 'Confirm Mentorship Assignment'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* CASE 2: FACULTY IS ALREADY ASSIGNED AS MENTOR */
            <div className="space-y-6">
              {/* Mentorship Status Card */}
              <div className="glass-card p-6 border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/25">
                    <GraduationCap size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-600 text-white font-mono text-xs font-black uppercase">
                        Section {mentorAssignment.section}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/30 flex items-center gap-1">
                        <Lock size={11} />
                        Assigned & Active
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-customText dark:text-customText-dark mt-1">
                      Faculty Class Mentor — {mentorAssignment.section}
                    </h3>
                    <p className="text-xs text-customText-muted">
                      You are the designated mentor for Section {mentorAssignment.section}. You have authority to call parents and forward student outpasses to the HOD.
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-customText-muted uppercase block">Awaiting Parent Verification</span>
                  <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                    {pendingMentorCallsCount}
                  </span>
                </div>
              </div>

              {/* Pending Student Applications for this Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-customText dark:text-customText-dark tracking-tight">
                      Student Leave Applications Awaiting Parent Call ({mentorAssignment.section})
                    </h3>
                    <p className="text-xs text-customText-muted">
                      Verify leave reason by calling the parent, then confirm and forward directly to the Head of Department (HOD).
                    </p>
                  </div>
                </div>

                {allOutpassTickets.filter(t => t.applicantType !== 'FACULTY' && t.section === mentorAssignment.section && t.status === 'PENDING_PARENT_CALL').length === 0 ? (
                  <div className="p-10 text-center rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                    <CheckCircle size={32} className="mx-auto text-emerald-500" />
                    <h4 className="font-bold text-customText dark:text-customText-dark">
                      No Pending Student Applications
                    </h4>
                    <p className="text-xs text-customText-muted max-w-sm mx-auto">
                      All student leave requests for Section {mentorAssignment.section} have been verified and forwarded.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {allOutpassTickets
                      .filter(t => t.applicantType !== 'FACULTY' && t.section === mentorAssignment.section && t.status === 'PENDING_PARENT_CALL')
                      .map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-purple-500/20 dark:border-purple-500/30 shadow-sm space-y-4 relative overflow-hidden"
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
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                  Section {ticket.section}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedTicketForModal(ticket)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-xs font-bold text-customText-muted flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="View Official Ticket"
                            >
                              <FileText size={15} />
                              <span>Slip</span>
                            </button>
                          </div>

                          {/* Reason */}
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

                          {/* Parent Contact & Call Desk */}
                          <div className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">
                                  Auto-Fetched Parent Mobile
                                </span>
                                <p className="text-sm font-mono font-black text-customText dark:text-customText-dark">
                                  +91 {ticket.parentMobile}
                                </p>
                              </div>

                              <a
                                href={`tel:${ticket.parentMobile}`}
                                className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                              >
                                <PhoneCall size={14} />
                                <span>Call Parent</span>
                              </a>
                            </div>

                            {/* Actions */}
                            <div className="pt-2 border-t border-purple-500/20 flex flex-col sm:flex-row gap-2">
                              <button
                                type="button"
                                onClick={() => handleMentorConfirmAndForward(ticket)}
                                className="flex-1 py-2.5 px-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition-all cursor-pointer active:scale-95"
                              >
                                <CheckCircle size={15} />
                                <span>Parent Confirmed (OK) & Forward to HOD</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setRejectingStudentTicket(ticket)}
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

              {/* Section Outpasses History */}
              <div className="glass-card rounded-3xl border border-slate-200/50 dark:border-slate-800/40 overflow-hidden space-y-0">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-customText dark:text-customText-dark">
                      Outpass History for Section {mentorAssignment.section}
                    </h3>
                    <p className="text-[11px] text-customText-muted">
                      Track approvals, security gate clearances, and return status for your section
                    </p>
                  </div>
                  <span className="text-xs font-bold text-customText-muted font-mono">
                    {allOutpassTickets.filter(t => t.applicantType !== 'FACULTY' && t.section === mentorAssignment.section).length} Total Slips
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {allOutpassTickets
                    .filter(t => t.applicantType !== 'FACULTY' && t.section === mentorAssignment.section)
                    .map((item) => (
                      <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary">{item.id}</span>
                            <span className="font-black text-customText dark:text-customText-dark">{item.studentName}</span>
                            <span className="font-mono text-slate-400">({item.rollNumber})</span>
                          </div>
                          <p className="text-[11px] text-customText-muted italic">"{item.reason}"</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'PENDING_PARENT_CALL' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                              Awaiting Parent Call
                            </span>
                          )}
                          {item.status === 'FORWARDED_TO_HOD' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold text-[10px]">
                              Forwarded to HOD
                            </span>
                          )}
                          {item.status === 'PERMISSION_GRANTED' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                              Approved by HOD (Gate Ready)
                            </span>
                          )}
                          {item.status === 'SENT_OUT' && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 font-bold text-[10px]">
                              Sent Out at Gate
                            </span>
                          )}
                          {item.status === 'REJECTED' && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
                              Rejected
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedTicketForModal(item)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary cursor-pointer"
                          >
                            <FileText size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

            </div>
          )}

          {/* Modal: Custom Reject Reason */}
          {rejectingStudentTicket && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-sm text-customText dark:text-customText-dark">
                    Reject Outpass Application
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRejectingStudentTicket(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs text-customText-muted">
                  State the reason for rejecting {rejectingStudentTicket.studentName}'s leave application (e.g. parent denied permission):
                </p>
                <textarea
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  className="glass-input w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800"
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setRejectingStudentTicket(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMentorReject(rejectingStudentTicket, customRejectReason)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Modal: Apply Leave or Early Out */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-customText dark:text-customText-dark">
                    {isHodUser ? 'Apply HOD Permission / Leave' : 'Apply Faculty Permission / Early Out'}
                  </h3>
                  <p className="text-xs text-customText-muted">
                    {isHodUser 
                      ? 'Routes directly to Administrative Officer (AO) • Once granted, passes to Security' 
                      : 'Narasaraopeta Engineering College • Faculty Portal'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleApplyLeave} className="p-6 space-y-4">
              
              {/* Quota Notice inside Modal */}
              {leaveType === 'FACULTY_OD' ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between">
                  <span className="text-amber-800 dark:text-amber-300 font-bold">On Duty (OD) Permission:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300">
                    Does not deduct from your 2 regular monthly permissions
                  </span>
                </div>
              ) : (
                (facultyMonthlyQuota.isLimitExceeded || facultyMonthlyQuota.remaining <= 0) ? (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-black space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                      <span>your limit for permissions has been completed , consult principal.</span>
                    </div>
                    <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                      You have already used {facultyMonthlyQuota.count} / 2 permissions for this calendar month. Unused permissions do not carry forward.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs flex items-center justify-between">
                    <span className="text-customText-muted font-bold">Regular Permissions Quota:</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      {facultyMonthlyQuota.count} / 2 used ({facultyMonthlyQuota.remaining} left)
                    </span>
                  </div>
                )
              )}

              {/* Leave Type Toggle: 1-Hour Permission, 4:00 PM Permission, or OD */}
              <div>
                <label className="text-xs font-bold uppercase text-customText-muted block mb-2">
                  Permission Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('FACULTY_ONE_HOUR')}
                    className={`py-3 px-3 rounded-xl font-bold text-xs border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      leaveType === 'FACULTY_ONE_HOUR'
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                        : 'bg-slate-50 dark:bg-slate-800 text-customText-muted border-slate-200 dark:border-slate-700 hover:text-customText'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock size={15} />
                      <span className="font-black">1-Hour Permission</span>
                    </div>
                    <span className={`text-[10px] ${leaveType === 'FACULTY_ONE_HOUR' ? 'text-white/80' : 'text-slate-400'}`}>
                      Return in 1 hr (Timing)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLeaveType('FACULTY_4PM');
                      setLeaveTime('04:00 PM');
                    }}
                    className={`py-3 px-3 rounded-xl font-bold text-xs border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      leaveType === 'FACULTY_4PM'
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                        : 'bg-slate-50 dark:bg-slate-800 text-customText-muted border-slate-200 dark:border-slate-700 hover:text-customText'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <LogOut size={15} />
                      <span className="font-black">4:00 PM Permission</span>
                    </div>
                    <span className={`text-[10px] ${leaveType === 'FACULTY_4PM' ? 'text-white/80' : 'text-slate-400'}`}>
                      Departure at 4 PM (Closed)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLeaveType('FACULTY_OD');
                      if (!leaveTime || leaveTime === '04:00 PM') {
                        setLeaveTime('10:00 AM');
                      }
                    }}
                    className={`py-3 px-3 rounded-xl font-bold text-xs border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      leaveType === 'FACULTY_OD'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 text-customText-muted border-slate-200 dark:border-slate-700 hover:text-customText'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Briefcase size={15} />
                      <span className="font-black">On Duty (OD)</span>
                    </div>
                    <span className={`text-[10px] ${leaveType === 'FACULTY_OD' ? 'text-white/80' : 'text-slate-400'}`}>
                      Official Duty (No count cut)
                    </span>
                  </button>
                </div>
              </div>

              {/* Date & Out-Time Section */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase text-customText-muted block mb-1">
                      Permission Date
                    </label>
                    <input
                      type="date"
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      className="glass-input text-xs w-full font-semibold"
                      required
                    />
                  </div>

                  {leaveType === 'FACULTY_ONE_HOUR' ? (
                    <div>
                      <label className="text-xs font-bold uppercase text-customText-muted block mb-1">
                        What time do you need to be out? <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={leaveTime}
                        onChange={(e) => setLeaveTime(e.target.value)}
                        className="glass-input text-xs w-full font-semibold"
                        required
                      />
                    </div>
                  ) : leaveType === 'FACULTY_4PM' ? (
                    <div>
                      <label className="text-xs font-bold uppercase text-customText-muted block mb-1">
                        Scheduled Departure Time
                      </label>
                      <div className="glass-input text-xs w-full font-bold text-primary flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 py-2.5">
                        <Clock size={14} className="text-primary" />
                        <span>04:00 PM (Fixed)</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-bold uppercase text-customText-muted block mb-1">
                        Departure Time for OD <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={leaveTime}
                        onChange={(e) => setLeaveTime(e.target.value)}
                        className="glass-input text-xs w-full font-semibold"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Helpful Guidance Notice based on type */}
                {leaveType === 'FACULTY_ONE_HOUR' ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                    <strong>1-Hour Permission:</strong> Specify what time you need to leave. When you enter back into college after some time, Security will record your In-Time and the permission will be notified to HOD and closed.
                  </div>
                ) : leaveType === 'FACULTY_4PM' ? (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
                    <strong>4:00 PM Permission:</strong> Scheduled departure is 4:00 PM itself. No in-time entry or return is required. The permission closes automatically when Security sends you out.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                    <strong>On Duty (OD):</strong> Does not deduct from your 2 regular monthly permissions. Gate clearance is granted by Security upon approval.
                  </div>
                )}
              </div>

              {/* Proper Purpose / Reason */}
              <div>
                <label className="text-xs font-bold uppercase text-customText-muted block mb-1">
                  Proper Purpose / Reason for Leave <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={leavePurpose}
                  onChange={(e) => setLeavePurpose(e.target.value)}
                  placeholder="State the proper and specific purpose for your absence / early out..."
                  rows={3}
                  className="glass-input text-xs w-full resize-none font-medium"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="btn-secondary py-2.5 px-4 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    applyingLeave ||
                    (leaveType !== 'FACULTY_OD' && (facultyMonthlyQuota.isLimitExceeded || facultyMonthlyQuota.remaining <= 0))
                  }
                  className={`py-2.5 px-5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    (leaveType !== 'FACULTY_OD' && (facultyMonthlyQuota.isLimitExceeded || facultyMonthlyQuota.remaining <= 0))
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary-dark text-white shadow-md shadow-primary/20 active:scale-95'
                  }`}
                >
                  {applyingLeave ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <span>{isHodUser ? 'Submit to AO' : 'Submit to HOD'}</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Official Leave & Gate Pass Ticket Modal */}
      {selectedTicketForModal && (
        <OutpassTicketModal
          ticket={selectedTicketForModal}
          onClose={() => setSelectedTicketForModal(null)}
        />
      )}





    </div>
  );
};

export default FacultyDashboard;
