// outpassService.js
// Client-side persistent storage and lifecycle manager for Student Outpasses & Gate Permissions

const STORAGE_KEY = 'lectra_outpass_tickets';
const STUDENTS_CACHE_KEY = 'lectra_outpass_students_directory';

// Default initial student directory for matching roll numbers
const DEFAULT_STUDENTS = [
  {
    rollNumber: '21NE1A0501',
    name: 'A. Sai Krishna',
    section: 'CSE 3rd Year',
    studentMobile: '9876543210',
    parentMobile: '9123456780',
  },
  {
    rollNumber: '21NE1A0502',
    name: 'B. Meghana',
    section: 'CSE 3rd Year',
    studentMobile: '9876543211',
    parentMobile: '9123456781',
  },
  {
    rollNumber: '21NE1A0503',
    name: 'Ch. Venkat Reddy',
    section: 'CSE 3rd Year',
    studentMobile: '9876543212',
    parentMobile: '9123456782',
  },
  {
    rollNumber: '21NE1A0504',
    name: 'D. Harshavardhan',
    section: 'CSE 3rd Year',
    studentMobile: '9848022338',
    parentMobile: '9848033449',
  },
  {
    rollNumber: '21NE1A0505',
    name: 'E. Anusha',
    section: 'CSE 3rd Year',
    studentMobile: '9876543214',
    parentMobile: '9123456784',
  },
  {
    rollNumber: '20NE1A0512',
    name: 'G. Karthik',
    section: 'CSE 4th Year',
    studentMobile: '9700112233',
    parentMobile: '9700445566',
  },
  {
    rollNumber: '20NE1A0525',
    name: 'K. Sneha Latha',
    section: 'CSE 4th Year',
    studentMobile: '9700112244',
    parentMobile: '9700445577',
  },
  {
    rollNumber: '22NE1A0410',
    name: 'M. Pavan Kalyan',
    section: 'ECE 2nd Year',
    studentMobile: '9988776655',
    parentMobile: '9988776600',
  },
  {
    rollNumber: '22NE1A0420',
    name: 'N. Divya Teja',
    section: 'ECE 2nd Year',
    studentMobile: '9988776656',
    parentMobile: '9988776601',
  },
  {
    rollNumber: '21NE1A0301',
    name: 'P. Rahul Varma',
    section: 'MECH 3rd Year',
    studentMobile: '9440112233',
    parentMobile: '9440445566',
  }
];

// Initialize directory in localStorage if not already present
export const getStudentsDirectory = () => {
  try {
    const raw = localStorage.getItem(STUDENTS_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(STUDENTS_CACHE_KEY, JSON.stringify(DEFAULT_STUDENTS));
      return DEFAULT_STUDENTS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_STUDENTS;
  }
};

export const registerStudentInDirectory = (student) => {
  const dir = getStudentsDirectory();
  const index = dir.findIndex(s => s.rollNumber.toUpperCase() === student.rollNumber.toUpperCase());
  if (index >= 0) {
    dir[index] = { ...dir[index], ...student };
  } else {
    dir.push(student);
  }
  localStorage.setItem(STUDENTS_CACHE_KEY, JSON.stringify(dir));
  return student;
};

// Sync students fetched from HOD student registry
export const syncHODStudents = (studentList) => {
  if (!Array.isArray(studentList)) return;
  const dir = getStudentsDirectory();
  const dirMap = new Map(dir.map(s => [s.rollNumber.toUpperCase(), s]));
  
  studentList.forEach(s => {
    if (s.rollNumber) {
      dirMap.set(s.rollNumber.toUpperCase(), {
        rollNumber: s.rollNumber.toUpperCase(),
        name: s.name,
        section: s.section,
        studentMobile: s.studentMobile,
        parentMobile: s.parentMobile
      });
    }
  });

  const merged = Array.from(dirMap.values());
  localStorage.setItem(STUDENTS_CACHE_KEY, JSON.stringify(merged));
};

// Mask phone number showing only last 4 digits (e.g. ••••••7890)
export const maskPhoneNumber = (phone) => {
  if (!phone) return '••••••0000';
  const str = String(phone).trim();
  if (str.includes('•') || str.includes('*')) return str;
  const clean = str.replace(/\D/g, '');
  if (!clean) return '••••••0000';
  const last4 = clean.slice(-4);
  return `••••••${last4}`;
};

// Lookup and fetch student by Roll Number against HOD registry (Live DB + Cache Fallback)
export const lookupStudentByRollAndName = async (rollNumber) => {
  if (!rollNumber) {
    return { success: false, error: 'Please enter your College Roll Number.' };
  }

  const cleanRoll = rollNumber.trim().toUpperCase();

  // 1. Try Live Backend Database lookup (checks prisma.student registry added by HOD)
  try {
    const res = await fetch('/api/student-attendance/verify-outpass-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber: cleanRoll })
    });

    const data = await res.json();
    if (res.ok && data.success && data.student) {
      // Cache student in directory for future offline access
      registerStudentInDirectory({
        rollNumber: data.student.rollNumber,
        name: data.student.name,
        section: data.student.section,
        studentMobile: data.student.studentMobile,
        parentMobile: data.student.parentMobile
      });
      return { success: true, student: data.student };
    } else if (data && data.message) {
      // Backend returned explicit validation message (e.g., student not found in HOD registry)
      return { success: false, error: data.message };
    }
  } catch (netErr) {
    console.warn('Backend student verification network error, falling back to local cache:', netErr);
  }

  // 2. Fallback to Local Client Directory Cache
  const dir = getStudentsDirectory();
  const studentByRoll = dir.find(s => s.rollNumber.toUpperCase() === cleanRoll);
  if (!studentByRoll) {
    return { 
      success: false, 
      error: `Roll Number "${cleanRoll}" not found in the student registry added by HOD. Please verify your roll number.` 
    };
  }

  return {
    success: true,
    student: {
      ...studentByRoll,
      maskedStudentMobile: maskPhoneNumber(studentByRoll.studentMobile),
      maskedParentMobile: maskPhoneNumber(studentByRoll.parentMobile),
    }
  };
};

export const fetchStudentByRoll = lookupStudentByRollAndName;

// Fallback lookup by roll number
export const lookupStudentByRoll = (rollNumber) => {
  if (!rollNumber) return null;
  const cleanRoll = rollNumber.trim().toUpperCase();
  const dir = getStudentsDirectory();
  const found = dir.find(s => s.rollNumber.toUpperCase() === cleanRoll);
  if (found) {
    return {
      ...found,
      maskedStudentMobile: maskPhoneNumber(found.studentMobile),
      maskedParentMobile: maskPhoneNumber(found.parentMobile),
    };
  }
  return null;
};

// Get all outpasses from storage (filtering out internal system config records)
export const getAllOutpasses = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return list
      .filter(t => t && t.applicantType !== 'SYSTEM_CONFIG')
      .map(t => {
        if (t.applicantType === 'FACULTY' && (!t.department || t.department === 'General' || t.section === 'General' || t.section === 'Faculty')) {
          return {
            ...t,
            department: t.department && t.department !== 'General' ? t.department : 'Department of CSE(emerging Technologies)',
            section: t.section && t.section !== 'General' && t.section !== 'Faculty' ? t.section : 'Department of CSE(emerging Technologies)'
          };
        }
        return t;
      });
  } catch (e) {
    console.error('Failed to parse outpasses:', e);
    return [];
  }
};

// Save outpasses and notify listeners (both locally and to backend database)
export const saveOutpasses = async (tickets) => {
  // Preserve any SYSTEM_CONFIG tickets (e.g. mentor registry) currently in storage
  let toSave = Array.isArray(tickets) ? [...tickets] : [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const currentAll = raw ? JSON.parse(raw) : [];
    const systemConfigs = currentAll.filter(t => t && t.applicantType === 'SYSTEM_CONFIG');
    systemConfigs.forEach(sc => {
      if (!toSave.some(t => t.id === sc.id)) {
        toSave.push(sc);
      }
    });
  } catch (e) {}

  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  // Dispatch custom event for same-tab updates (filtered for normal consumers)
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: toSave.filter(t => t.applicantType !== 'SYSTEM_CONFIG') }));

  // Send to backend database so other devices (Absent Controller, HOD, Watchman, Mentors) receive it instantly
  try {
    const res = await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ tickets: toSave })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        
        // Sync mentor registry if present
        const sysMentor = data.tickets.find(t => t && t.id === 'SYS_FACULTY_MENTOR_REGISTRY' && t.applicantType === 'SYSTEM_CONFIG');
        if (sysMentor && sysMentor.data) {
          try {
            localStorage.setItem('lectra_faculty_mentors', JSON.stringify(sysMentor.data));
            window.dispatchEvent(new CustomEvent('lectra_mentors_updated', { detail: sysMentor.data }));
          } catch (e) {}
        }

        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets.filter(t => t.applicantType !== 'SYSTEM_CONFIG') }));
        return data.tickets.filter(t => t.applicantType !== 'SYSTEM_CONFIG');
      }
    }
  } catch (e) {
    console.warn('Sync outpass network note:', e);
  }
  return toSave.filter(t => t.applicantType !== 'SYSTEM_CONFIG');
};

// Sync live outpasses from backend database across campus devices (Anti-Cached)
export const syncOutpassesFromBackend = async () => {
  try {
    const res = await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        
        // Sync mentor registry if present
        const sysMentor = data.tickets.find(t => t && t.id === 'SYS_FACULTY_MENTOR_REGISTRY' && t.applicantType === 'SYSTEM_CONFIG');
        if (sysMentor && sysMentor.data) {
          try {
            localStorage.setItem('lectra_faculty_mentors', JSON.stringify(sysMentor.data));
            window.dispatchEvent(new CustomEvent('lectra_mentors_updated', { detail: sysMentor.data }));
          } catch (e) {}
        }

        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets.filter(t => t.applicantType !== 'SYSTEM_CONFIG') }));
        return data.tickets.filter(t => t.applicantType !== 'SYSTEM_CONFIG');
      }
    }
  } catch (e) {
    // silent fallback to local storage
  }
  return getAllOutpasses();
};

// Check if the scheduled permission/leave time has passed
export const hasPermissionTimePassed = (ticket) => {
  if (!ticket) return false;
  // If already departed / sent out at gate, time has passed
  if (ticket.status === 'SENT_OUT' || ticket.status === 'FACULTY_OUT' || ticket.watchmanAction?.sentOut) {
    return true;
  }
  
  const now = new Date();
  const dateStr = ticket.date || ticket.appliedDate;
  if (!dateStr) return false;

  let year, month, day;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  } else {
    return false;
  }

  let hours = 23;
  let minutes = 59;
  const leaveTime = (ticket.leaveTime || '').trim();
  if (leaveTime && leaveTime.toLowerCase() !== 'full day') {
    const timeMatch = leaveTime.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const meridiem = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
    }
  }

  const permissionDateTime = new Date(year, month, day, hours, minutes, 0);
  return now >= permissionDateTime;
};

// Check if a ticket is delete-locked for HOD / Sub Admin (Only Super Admin can delete)
export const isTicketDeleteLockedForHod = (ticket) => {
  if (!ticket) return false;

  const isFaculty = ticket.applicantType === 'FACULTY';
  const isHodAccepted = ticket.hodAction?.granted === true || 
                        ticket.status === 'PERMISSION_GRANTED' || 
                        ticket.status === 'FACULTY_OUT' ||
                        ticket.status === 'SENT_OUT';

  if (isFaculty) {
    // Faculty: HOD accepted and current time crosses faculty taken permission time or already departed
    if (isHodAccepted && (hasPermissionTimePassed(ticket) || ticket.status === 'FACULTY_OUT' || ticket.status === 'SENT_OUT')) {
      return true;
    }
  } else {
    // Student: HOD gave permission and student is sent out
    const isSentOut = ticket.status === 'SENT_OUT' || ticket.watchmanAction?.sentOut === true;
    if (isHodAccepted && isSentOut) {
      return true;
    }
  }

  return false;
};

// Delete an individual outpass ticket (Role restricted: Only Super Admin can delete time-passed faculty permission or sent-out student)
export const deleteOutpassTicket = async (ticketId, userRole = null) => {
  const allTickets = getAllOutpasses();
  const ticket = allTickets.find(t => t.id === ticketId);
  
  if (userRole && userRole !== 'SUPER_ADMIN' && isTicketDeleteLockedForHod(ticket)) {
    throw new Error(
      ticket?.applicantType === 'FACULTY'
        ? 'Cannot delete accepted faculty permission after the scheduled permission time has passed. Only Super Admin can delete.'
        : 'Cannot delete student outpass after permission granted and student departed. Only Super Admin can delete.'
    );
  }

  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/student-attendance/outpass/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'DELETE',
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to delete permission ticket');
  }

  const data = await res.json();
  const updated = (data.success && Array.isArray(data.tickets)) 
    ? data.tickets 
    : allTickets.filter(t => t.id !== ticketId);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: updated }));
  return updated;
};

// Clear completed (SENT_OUT) and rejected tickets (Super Admin restricted)
export const clearOldOutpasses = async (userRole = null) => {
  if (userRole && userRole !== 'SUPER_ADMIN') {
    throw new Error('Only Super Admin can bulk clear completed or departed tickets.');
  }

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/student-attendance/outpass/tickets/clear-old', {
    method: 'POST',
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to clear old tickets');
  }

  const data = await res.json();
  const activeOnly = (data.success && Array.isArray(data.tickets))
    ? data.tickets
    : getAllOutpasses().filter(t => t.status !== 'SENT_OUT' && t.status !== 'REJECTED');

  localStorage.setItem(STORAGE_KEY, JSON.stringify(activeOnly));
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: activeOnly }));
  return activeOnly;
};

// Generate unique ticket ID
const generateTicketId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `NEC-OUT-${dateStr}-${randomNum}`;
};

// Create a new outpass request (Submitted by Student)
export const submitOutpassApplication = async ({
  rollNumber,
  studentName,
  section,
  studentMobile,
  parentMobile,
  reason,
  destination
}) => {
  const now = new Date();
  
  const newTicket = {
    id: generateTicketId(),
    rollNumber: rollNumber.trim().toUpperCase(),
    studentName,
    section,
    studentMobile,
    parentMobile,
    maskedStudentMobile: maskPhoneNumber(studentMobile),
    maskedParentMobile: maskPhoneNumber(parentMobile),
    reason,
    destination: destination || 'Home / Medical Emergency',
    appliedAt: now.toISOString(),
    appliedDate: now.toLocaleDateString('en-GB'),
    appliedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    
    // Status Flow:
    // 1. PENDING_PARENT_CALL: Student submitted -> Absent Controller needs to call parent
    // 2. FORWARDED_TO_HOD: Absent Controller called parent & confirmed -> HOD needs to grant permission
    // 3. PERMISSION_GRANTED: HOD granted permission -> Watchman can verify and release
    // 4. SENT_OUT: Watchman verified physical ID & released student -> Completed exit
    // 5. REJECTED: Rejected by Parent or HOD
    status: 'PENDING_PARENT_CALL',
    
    // Stage 1: Absent Controller Verification Details
    absentControllerAction: null,
    
    // Stage 2: HOD Approval Details
    hodAction: null,
    
    // Stage 3: Watchman Gate Release Details
    watchmanAction: null,
  };

  // 1. Instantly save to local storage
  const currentTickets = getAllOutpasses();
  const updatedLocal = [newTicket, ...currentTickets.filter(t => t.id !== newTicket.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocal));
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: updatedLocal }));

  // 2. Directly sync to central database so Absent Controller, HOD, and Watchman devices receive it
  try {
    const res = await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ tickets: [newTicket] })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets }));
      }
    }
  } catch (e) {
    console.warn('Network sync note on submit:', e);
  }

  return newTicket;
};

// Absent Controller or Faculty Mentor makes call to parent & takes confirmation
export const confirmParentAndForwardToHOD = (ticketId, { controllerName = 'Absent Controller', remarks = 'Parent confirmed permission over phone call.', role = null, section = null } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Outpass application not found');

  const now = new Date();
  const determinedRole = role || (controllerName?.toLowerCase().includes('mentor') ? 'Mentor' : 'Absent Controller');
  ticket.status = 'FORWARDED_TO_HOD';
  ticket.forwardedByName = controllerName;
  ticket.forwardedByRole = determinedRole;
  ticket.forwardedSection = section || ticket.section;
  ticket.absentControllerAction = {
    confirmed: true,
    calledAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks,
    controllerName,
    role: determinedRole,
    section: ticket.forwardedSection
  };

  saveOutpasses(tickets);
  return ticket;
};

// Absent Controller or Faculty Mentor marks parent denied permission
export const rejectByAbsentController = (ticketId, { controllerName = 'Absent Controller', reason = 'Parent did not grant permission during call.', role = null, section = null } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Outpass application not found');

  const now = new Date();
  const determinedRole = role || (controllerName?.toLowerCase().includes('mentor') ? 'Mentor' : 'Absent Controller');
  ticket.status = 'REJECTED';
  ticket.rejectionStage = 'ABSENT_CONTROLLER';
  ticket.rejectionReason = reason;
  ticket.forwardedByName = controllerName;
  ticket.forwardedByRole = determinedRole;
  ticket.absentControllerAction = {
    confirmed: false,
    calledAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    remarks: reason,
    controllerName,
    role: determinedRole
  };

  saveOutpasses(tickets);
  return ticket;
};

// HOD grants permission
export const hodGrantOutpass = (ticketId, { hodName = 'Head of Department (HOD)', remarks = 'Permission Approved.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Outpass application not found');

  const now = new Date();
  ticket.status = 'PERMISSION_GRANTED';
  ticket.hodAction = {
    granted: true,
    approvedAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks,
    hodName
  };

  saveOutpasses(tickets);
  return ticket;
};

// HOD rejects outpass
export const hodRejectOutpass = (ticketId, { hodName = 'Head of Department (HOD)', reason = 'Permission Denied by HOD.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Outpass application not found');

  const now = new Date();
  ticket.status = 'REJECTED';
  ticket.rejectionStage = 'HOD';
  ticket.rejectionReason = reason;
  ticket.hodAction = {
    granted: false,
    approvedAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    remarks: reason,
    hodName
  };

  saveOutpasses(tickets);
  return ticket;
};

// Security Head verifies physical student ID and marks student Sent Out
export const watchmanReleaseStudent = (ticketId, { watchmanName = 'Campus Security Head', remarks = 'Physical College ID card verified. Student exited campus.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Outpass application not found');

  const now = new Date();
  ticket.status = 'SENT_OUT';
  ticket.watchmanAction = {
    sentOut: true,
    physicalIdVerified: true,
    exitTime: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks,
    watchmanName
  };

  saveOutpasses(tickets);
  return ticket;
};

// Find outpasses by roll number or ticket ID
export const searchOutpasses = (query) => {
  if (!query) return [];
  const clean = query.trim().toUpperCase();
  const tickets = getAllOutpasses();
  return tickets.filter(t => 
    t.id.toUpperCase().includes(clean) || 
    t.rollNumber.toUpperCase().includes(clean) ||
    t.studentName.toUpperCase().includes(clean)
  );
};

// Get all outpass history for a specific student by roll number
export const getStudentOutpassHistory = (rollNumber) => {
  if (!rollNumber) return [];
  const clean = rollNumber.trim().toUpperCase();
  const tickets = getAllOutpasses();
  return tickets.filter(t => t.rollNumber && t.rollNumber.trim().toUpperCase() === clean)
    .sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
};

// Subscribe to outpass store updates (with live cross-device backend polling)
export const subscribeToOutpasses = (callback) => {
  const handleCustom = (e) => callback(e.detail);
  const handleStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      callback(getAllOutpasses());
    }
  };

  window.addEventListener('lectra_outpass_updated', handleCustom);
  window.addEventListener('storage', handleStorage);

  // Sync initially
  syncOutpassesFromBackend().then(callback);

  // Poll backend every 1.5 seconds for instant cross-device updates (Student -> Controller -> HOD -> Watchman)
  const pollInterval = setInterval(() => {
    syncOutpassesFromBackend().then(callback);
  }, 1500);

  return () => {
    window.removeEventListener('lectra_outpass_updated', handleCustom);
    window.removeEventListener('storage', handleStorage);
    clearInterval(pollInterval);
  };
};

// ==========================================
// FACULTY LEAVE & EARLY OUT SERVICE METHODS
// ==========================================

// Calculate faculty monthly leaves usage (Strict limit: 2 leaves per calendar month, no rollover)
// OD Permission: Exactly 1 OD per month, does NOT cut regular permission count
export const getFacultyMonthlyLeaveUsage = (facultyIdentifier, targetDateStr = null) => {
  if (!facultyIdentifier) {
    return { 
      count: 0, 
      limit: 2, 
      remaining: 2, 
      isLimitExceeded: false, 
      odCount: 0,
      odLimit: 1,
      odRemaining: 1,
      isOdLimitExceeded: false,
      monthKey: '',
      message: '',
      odMessage: ''
    };
  }

  const cleanId = String(facultyIdentifier).trim().toLowerCase();
  const d = targetDateStr ? new Date(targetDateStr) : new Date();
  const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  const month = isNaN(d.getMonth()) ? String(new Date().getMonth() + 1).padStart(2, '0') : String(d.getMonth() + 1).padStart(2, '0');
  const targetMonthKey = `${year}-${month}`; // e.g. "2026-10"

  const all = getAllOutpasses();
  const facultyMonthTickets = all.filter(t => {
    if (t.applicantType !== 'FACULTY' && t.applicantType !== 'HOD') return false;
    
    const matchesUser = 
      (t.facultyUserId && String(t.facultyUserId).trim().toLowerCase() === cleanId) ||
      (t.facultyName && String(t.facultyName).trim().toLowerCase() === cleanId) ||
      (t.facultyId && String(t.facultyId) === cleanId) ||
      (t.rollNumber && String(t.rollNumber).trim().toLowerCase() === cleanId);
    
    if (!matchesUser) return false;
    if (t.status === 'REJECTED') return false; // Rejected leaves do not consume quota

    // Determine the ticket's month (strictly based on leave date or applied date)
    const ticketDateStr = t.date || (t.appliedAt ? t.appliedAt.slice(0, 10) : '');
    const ticketMonthKey = ticketDateStr.slice(0, 7);

    return ticketMonthKey === targetMonthKey;
  });

  // Regular permissions (1-Hour & 4PM) - Max 2 per month
  const regularTickets = facultyMonthTickets.filter(t => t.type !== 'FACULTY_OD' && t.permissionType !== 'FACULTY_OD');
  const count = regularTickets.length;
  const limit = 2;
  const remaining = Math.max(0, limit - count);
  const isLimitExceeded = count >= limit;

  // On Duty (OD) permissions - Max 1 per month, does not deduct from regular count
  const odTickets = facultyMonthTickets.filter(t => t.type === 'FACULTY_OD' || t.permissionType === 'FACULTY_OD');
  const odCount = odTickets.length;
  const odLimit = 1;
  const odRemaining = Math.max(0, odLimit - odCount);
  const isOdLimitExceeded = odCount >= odLimit;

  return {
    count,
    limit,
    remaining,
    isLimitExceeded,
    odCount,
    odLimit,
    odRemaining,
    isOdLimitExceeded,
    monthKey: targetMonthKey,
    monthName: new Date(year, parseInt(month, 10) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
    tickets: facultyMonthTickets,
    regularTickets,
    odTickets,
    message: isLimitExceeded ? "your limit for leaves has been completed , consult principal." : "",
    odMessage: isOdLimitExceeded ? "Your OD's for this month has been completed." : ""
  };
};

// Apply for Faculty Permission (One Hour, 4:00 PM, or OD Permission)
export const applyFacultyLeave = async ({
  facultyId,
  facultyUserId,
  facultyName,
  department = 'Department of CSE(emerging Technologies)',
  type = 'FACULTY_ONE_HOUR', // 'FACULTY_ONE_HOUR' | 'FACULTY_4PM' | 'FACULTY_OD'
  date,
  leaveTime,
  purpose
}) => {
  if (!purpose || !purpose.trim()) {
    throw new Error('Please specify a valid and proper purpose for your request.');
  }

  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const cleanDepartment = (department && department !== 'General') ? department : 'Department of CSE(emerging Technologies)';

  // Quota validation
  const quota = getFacultyMonthlyLeaveUsage(facultyUserId || facultyName || facultyId, selectedDate);
  if (type === 'FACULTY_OD') {
    if (quota.isOdLimitExceeded) {
      throw new Error("Your OD's for this month has been completed.");
    }
  } else {
    if (quota.isLimitExceeded) {
      throw new Error("your limit for leaves has been completed , consult principal.");
    }
  }

  // Determine final leave / out time
  let finalLeaveTime = leaveTime;
  if (type === 'FACULTY_4PM') {
    // 4 PM permission is fixed to 4:00 PM itself
    finalLeaveTime = '04:00 PM';
  } else if (type === 'FACULTY_OD') {
    finalLeaveTime = leaveTime && leaveTime.trim() ? leaveTime.trim() : 'On Duty (Full Day)';
  } else if (type === 'FACULTY_ONE_HOUR') {
    if (!leaveTime || !leaveTime.trim()) {
      throw new Error('Please specify what time you need to be out for the 1-hour permission.');
    }
    finalLeaveTime = leaveTime.trim();
  } else if (!finalLeaveTime || !finalLeaveTime.trim()) {
    finalLeaveTime = '04:00 PM';
  }

  const now = new Date();
  const dateCompact = selectedDate.replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const prefix = type === 'FACULTY_4PM' ? 'NEC-FAC-4PM' : type === 'FACULTY_OD' ? 'NEC-FAC-OD' : 'NEC-FAC-1HR';
  const ticketId = `${prefix}-${dateCompact}-${randomNum}`;

  const newTicket = {
    id: ticketId,
    applicantType: 'FACULTY',
    type,
    permissionType: type,
    facultyId,
    facultyUserId: facultyUserId || '',
    facultyName: facultyName || 'Faculty Member',
    department: cleanDepartment,
    date: selectedDate,
    leaveTime: finalLeaveTime,
    outTime: finalLeaveTime,
    purpose: purpose.trim(),
    reason: purpose.trim(),
    destination: type === 'FACULTY_4PM' ? 'Departure at 4:00 PM' : type === 'FACULTY_OD' ? 'On Duty (OD)' : '1-Hour Permission',
    rollNumber: facultyUserId || 'FACULTY',
    studentName: facultyName || 'Faculty Member',
    section: cleanDepartment,
    appliedAt: now.toISOString(),
    appliedDate: now.toLocaleDateString('en-GB'),
    appliedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    
    // Status Flow: Faculty submitted -> Goes directly to HOD
    status: 'FORWARDED_TO_HOD',
    pendingReturn: false,
    returned: false,
    closed: false,
    inTime: null,
    hodAction: null,
    watchmanAction: null
  };

  // Save locally and sync immediately to central database
  const currentTickets = getAllOutpasses();
  const updatedLocal = [newTicket, ...currentTickets.filter(t => t.id !== newTicket.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocal));
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: updatedLocal }));

  try {
    const res = await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ tickets: [newTicket] })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets }));
      }
    }
  } catch (e) {
    console.warn('Network sync note on faculty leave submit:', e);
  }

  return newTicket;
};

// HOD applies for Leave / Permission (One Hour, 4:00 PM, or OD Permission)
// Routes directly to AO (Administrative Officer)
export const applyHodLeave = async ({
  hodUserId,
  hodName,
  department = 'Department of CSE(emerging Technologies)',
  type = 'FACULTY_ONE_HOUR', // 'FACULTY_ONE_HOUR' | 'FACULTY_4PM' | 'FACULTY_OD'
  date,
  leaveTime,
  purpose
}) => {
  if (!purpose || !purpose.trim()) {
    throw new Error('Please specify a valid and proper purpose for your request.');
  }

  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const cleanDepartment = (department && department !== 'General') ? department : 'Department of CSE(emerging Technologies)';

  // Quota validation for HOD (same 2 permissions + 1 OD limit)
  const quota = getFacultyMonthlyLeaveUsage(hodUserId || hodName || 'HOD', selectedDate);
  if (type === 'FACULTY_OD') {
    if (quota.isOdLimitExceeded) {
      throw new Error("Your OD's for this month has been completed.");
    }
  } else {
    if (quota.isLimitExceeded) {
      throw new Error("your limit for leaves has been completed , consult principal.");
    }
  }

  let finalLeaveTime = leaveTime;
  if (type === 'FACULTY_4PM') {
    finalLeaveTime = '04:00 PM';
  } else if (type === 'FACULTY_OD') {
    finalLeaveTime = leaveTime && leaveTime.trim() ? leaveTime.trim() : 'On Duty (Full Day)';
  } else if (type === 'FACULTY_ONE_HOUR') {
    if (!leaveTime || !leaveTime.trim()) {
      throw new Error('Please specify what time you need to be out for the 1-hour permission.');
    }
    finalLeaveTime = leaveTime.trim();
  } else if (!finalLeaveTime || !finalLeaveTime.trim()) {
    finalLeaveTime = '04:00 PM';
  }

  const now = new Date();
  const dateCompact = selectedDate.replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const prefix = type === 'FACULTY_4PM' ? 'NEC-HOD-4PM' : type === 'FACULTY_OD' ? 'NEC-HOD-OD' : 'NEC-HOD-1HR';
  const ticketId = `${prefix}-${dateCompact}-${randomNum}`;

  const newTicket = {
    id: ticketId,
    applicantType: 'HOD',
    type,
    permissionType: type,
    facultyId: hodUserId || 'HOD',
    facultyUserId: hodUserId || 'HOD',
    facultyName: hodName || 'Head of Department (HOD)',
    department: cleanDepartment,
    date: selectedDate,
    leaveTime: finalLeaveTime,
    outTime: finalLeaveTime,
    purpose: purpose.trim(),
    reason: purpose.trim(),
    destination: type === 'FACULTY_4PM' ? 'Departure at 4:00 PM' : type === 'FACULTY_OD' ? 'On Duty (OD)' : '1-Hour Permission',
    rollNumber: hodUserId || 'HOD',
    studentName: hodName || 'Head of Department (HOD)',
    section: cleanDepartment,
    appliedAt: now.toISOString(),
    appliedDate: now.toLocaleDateString('en-GB'),
    appliedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    
    // Status Flow for HOD:
    // 1. FORWARDED_TO_AO: HOD submitted -> Routes to AO login
    // 2. PERMISSION_GRANTED: AO accepted & forwarded to Security/Watchman
    status: 'FORWARDED_TO_AO',
    pendingReturn: false,
    returned: false,
    closed: false,
    inTime: null,
    aoAction: null,
    watchmanAction: null
  };

  const currentTickets = getAllOutpasses();
  const updatedLocal = [newTicket, ...currentTickets.filter(t => t.id !== newTicket.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocal));
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: updatedLocal }));

  try {
    const res = await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ tickets: [newTicket] })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets }));
      }
    }
  } catch (e) {
    console.warn('Network sync note on HOD leave submit:', e);
  }

  return newTicket;
};

// AO (Administrative Officer) accepts HOD Leave & forwards to Security for gate clearance
export const aoApproveHodLeave = (ticketId, { aoName = 'Administrative Officer (AO)', remarks = 'Permission accepted by AO. Forwarded to campus security.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Leave application not found');

  const now = new Date();
  ticket.status = 'PERMISSION_GRANTED'; // Transferred to Security
  ticket.aoAction = {
    granted: true,
    approvedAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks,
    aoName
  };

  saveOutpasses(tickets);
  return ticket;
};

// AO rejects HOD Leave
export const aoRejectHodLeave = (ticketId, { aoName = 'Administrative Officer (AO)', reason = 'Permission denied by AO.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Leave application not found');

  const now = new Date();
  ticket.status = 'REJECTED';
  ticket.rejectionStage = 'AO';
  ticket.rejectionReason = reason;
  ticket.aoAction = {
    granted: false,
    approvedAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    remarks: reason,
    aoName
  };

  saveOutpasses(tickets);
  return ticket;
};

// HOD accepts Faculty Leave / Early Out & forwards to Watchman role login
export const hodApproveFacultyLeave = (ticketId, { hodName = 'Head of Department (HOD)', remarks = 'Accepted and forwarded to watchman login.', timeToLeave = null } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Leave application not found');

  const now = new Date();
  ticket.status = 'PERMISSION_GRANTED';
  if (timeToLeave) {
    ticket.leaveTime = timeToLeave;
    ticket.outTime = timeToLeave;
  }

  const isOneHour = ticket.type === 'FACULTY_ONE_HOUR';
  const typeDesc = isOneHour ? `1-hour permission (Out: ${ticket.leaveTime})` : '4:00 PM permission';

  ticket.hodAction = {
    granted: true,
    approvedAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks: remarks || `Permission accepted for ${typeDesc}. Forwarded to security.`,
    hodName,
    timeToLeave: ticket.leaveTime
  };

  saveOutpasses(tickets);
  return ticket;
};

// Security Head marks faculty or HOD departed at the gate
// - For 4 PM / OD: ticket is completed and closed immediately upon sending out
// - For 1-Hour: ticket is marked FACULTY_OUT (pending return to college)
export const watchmanReleaseFaculty = (ticketId, { watchmanName = 'Campus Security Head', remarks = '' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Gate pass not found');

  const now = new Date();
  const isOneHour = ticket.type === 'FACULTY_ONE_HOUR';
  const personRole = ticket.applicantType === 'HOD' ? 'HOD' : 'Faculty';

  if (isOneHour) {
    // 1-Hour Permission: Leaves campus, return is pending
    ticket.status = 'FACULTY_OUT';
    ticket.pendingReturn = true;
    ticket.returned = false;
    ticket.closed = false;
    ticket.watchmanAction = {
      sentOut: true,
      physicalIdVerified: false,
      finalSlipGenerated: true,
      exitTime: now.toISOString(),
      displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      displayDate: now.toLocaleDateString('en-GB'),
      remarks: remarks || `${personRole} departed campus on 1-hour permission. Return to college pending.`,
      watchmanName
    };
  } else {
    // 4 PM Permission or On Duty (OD): No return required, closed immediately upon departure
    ticket.status = 'SENT_OUT';
    ticket.pendingReturn = false;
    ticket.returned = false;
    ticket.closed = true;
    ticket.watchmanAction = {
      sentOut: true,
      physicalIdVerified: false,
      finalSlipGenerated: true,
      exitTime: now.toISOString(),
      displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      displayDate: now.toLocaleDateString('en-GB'),
      remarks: remarks || (ticket.type === 'FACULTY_OD' 
        ? `${personRole} departed campus for On Duty (OD). Ticket closed.`
        : `${personRole} departed campus for 4 PM permission. Ticket closed.`),
      watchmanName,
      closed: true
    };
  }

  saveOutpasses(tickets);
  return ticket;
};

// Security enters the In-Time when faculty returns to college on 1-Hour Permission
// Closes the ticket and notifies HOD
export const watchmanRecordFacultyInTime = (ticketId, { inTime = null, watchmanName = 'Campus Security Head', remarks = 'Faculty entered back into college within permission time.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Faculty permission ticket not found');

  const now = new Date();
  const formattedInTime = inTime && inTime.trim() 
    ? inTime.trim() 
    : now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  ticket.status = 'SENT_OUT';
  ticket.pendingReturn = false;
  ticket.returned = true;
  ticket.closed = true;
  ticket.inTime = formattedInTime;
  ticket.inTimeRecordedAt = now.toISOString();
  ticket.inTimeRecordedBy = watchmanName;
  ticket.hodNotified = true;
  ticket.hodNotification = {
    id: `notif-${ticket.id}-${Date.now()}`,
    ticketId: ticket.id,
    facultyName: ticket.facultyName || ticket.studentName,
    facultyUserId: ticket.facultyUserId,
    department: ticket.department,
    outTime: ticket.watchmanAction?.displayTime || ticket.leaveTime,
    inTime: formattedInTime,
    date: ticket.date || ticket.appliedDate,
    timestamp: now.toISOString(),
    message: `Faculty ${ticket.facultyName || ticket.studentName} has entered back into college at ${formattedInTime}. 1-Hour permission closed.`,
    unread: true
  };

  if (!ticket.watchmanAction) {
    ticket.watchmanAction = { sentOut: true };
  }
  ticket.watchmanAction.inTime = formattedInTime;
  ticket.watchmanAction.inTimeRecordedAt = now.toISOString();
  ticket.watchmanAction.inTimeRecordedBy = watchmanName;
  ticket.watchmanAction.returnRemarks = remarks;
  ticket.watchmanAction.closed = true;

  saveOutpasses(tickets);
  window.dispatchEvent(new CustomEvent('lectra_faculty_returned', { detail: ticket }));
  return ticket;
};

// Mark HOD return notification as read / dismissed
export const markHodNotificationRead = (ticketId) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (ticket && ticket.hodNotification) {
    ticket.hodNotification.unread = false;
    saveOutpasses(tickets);
  }
  return tickets;
};

// Clear / dismiss all HOD return notifications
export const clearAllHodReturnNotifications = () => {
  const tickets = getAllOutpasses();
  let changed = false;
  tickets.forEach(t => {
    if (t.hodNotification && t.hodNotification.unread) {
      t.hodNotification.unread = false;
      changed = true;
    }
  });
  if (changed) {
    saveOutpasses(tickets);
  }
  return tickets;
};

// Get faculty leave history for a specific faculty member
export const getFacultyLeaveHistory = (facultyIdentifier) => {
  if (!facultyIdentifier) return [];
  const cleanId = String(facultyIdentifier).trim().toLowerCase();
  const all = getAllOutpasses();
  return all.filter(t => {
    if (t.applicantType !== 'FACULTY') return false;
    return (
      (t.facultyUserId && String(t.facultyUserId).trim().toLowerCase() === cleanId) ||
      (t.facultyName && String(t.facultyName).trim().toLowerCase() === cleanId) ||
      (t.facultyId && String(t.facultyId) === cleanId) ||
      (t.rollNumber && String(t.rollNumber).trim().toLowerCase() === cleanId)
    );
  }).sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
};

// ==========================================
// FACULTY MENTORSHIP & SECTION ASSIGNMENT SYSTEM
// ==========================================

export const MENTOR_REGISTRY_KEY = 'lectra_faculty_mentors';
export const SYS_CONFIG_MENTOR_ID = 'SYS_FACULTY_MENTOR_REGISTRY';

// Get current faculty mentor registry
export const getFacultyMentorRegistry = () => {
  try {
    const raw = localStorage.getItem(MENTOR_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}

  // Fallback: check raw tickets in storage for SYS_CONFIG_MENTOR_ID
  try {
    const rawStorage = localStorage.getItem(STORAGE_KEY);
    if (rawStorage) {
      const all = JSON.parse(rawStorage);
      const sys = Array.isArray(all) && all.find(t => t && t.id === SYS_CONFIG_MENTOR_ID);
      if (sys && sys.data) return sys.data;
    }
  } catch (e) {}

  return { facultyAssignments: {}, sectionMentors: {} };
};

// Save faculty mentor registry and persist to backend system setting
export const saveFacultyMentorRegistry = async (registry) => {
  try {
    localStorage.setItem(MENTOR_REGISTRY_KEY, JSON.stringify(registry));
    window.dispatchEvent(new CustomEvent('lectra_mentors_updated', { detail: registry }));
  } catch (e) {}

  // Upsert into storage so it persists to database through /outpass/tickets
  try {
    const rawStorage = localStorage.getItem(STORAGE_KEY);
    let all = rawStorage ? JSON.parse(rawStorage) : [];
    if (!Array.isArray(all)) all = [];

    const sysIndex = all.findIndex(t => t && t.id === SYS_CONFIG_MENTOR_ID);
    const sysRecord = {
      id: SYS_CONFIG_MENTOR_ID,
      applicantType: 'SYSTEM_CONFIG',
      data: registry,
      updatedAt: new Date().toISOString()
    };

    if (sysIndex >= 0) {
      all[sysIndex] = sysRecord;
    } else {
      all.push(sysRecord);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    // Send to backend database
    await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ tickets: all })
    });
  } catch (e) {
    console.warn('Sync mentor registry note:', e);
  }

  return registry;
};

// Check if a faculty user already has an assigned section
export const getFacultyAssignedSection = (facultyUser) => {
  if (!facultyUser) return null;
  const registry = getFacultyMentorRegistry();
  const key1 = facultyUser.userId ? String(facultyUser.userId).trim().toLowerCase() : '';
  const key2 = facultyUser.id ? String(facultyUser.id).trim().toLowerCase() : '';
  const key3 = (facultyUser.name || '').trim().toLowerCase();

  const fa = registry.facultyAssignments || {};
  let found = null;

  for (const [key, assignment] of Object.entries(fa)) {
    if (!assignment) continue;
    const aKey = String(key).trim().toLowerCase();
    const aUserId = assignment.facultyUserId ? String(assignment.facultyUserId).trim().toLowerCase() : '';
    const aId = assignment.facultyId ? String(assignment.facultyId).trim().toLowerCase() : '';
    const aName = assignment.facultyName ? String(assignment.facultyName).trim().toLowerCase() : '';

    if (
      (key1 && (aKey === key1 || aUserId === key1)) ||
      (key2 && (aKey === key2 || aId === key2)) ||
      (key3 && (aKey === key3 || aName === key3))
    ) {
      found = assignment;
      break;
    }
  }

  if (found && found.section) {
    return found;
  }

  // Also check sectionMentors
  const sm = registry.sectionMentors || {};
  for (const [secName, mentorInfo] of Object.entries(sm)) {
    if (!mentorInfo) continue;
    const mUserId = mentorInfo.facultyUserId ? String(mentorInfo.facultyUserId).trim().toLowerCase() : '';
    const mId = mentorInfo.facultyId ? String(mentorInfo.facultyId).trim().toLowerCase() : '';
    const mName = mentorInfo.facultyName ? String(mentorInfo.facultyName).trim().toLowerCase() : '';

    if (
      (key1 && mUserId === key1) ||
      (key2 && mId === key2) ||
      (key3 && mName === key3)
    ) {
      return {
        section: secName,
        department: mentorInfo.department,
        facultyName: mentorInfo.facultyName,
        facultyUserId: mentorInfo.facultyUserId,
        facultyId: mentorInfo.facultyId,
        assignedBy: mentorInfo.assignedBy || 'FACULTY',
        lockedForFaculty: true
      };
    }
  }

  return null;
};

// Faculty by himself/herself can assign themselves ONLY ONCE. Cannot change once assigned!
export const assignFacultyMentorByFaculty = async (facultyUser, section) => {
  if (!facultyUser) throw new Error('Faculty details are required.');
  if (!section || !section.trim()) throw new Error('Please select a valid section.');

  const existing = getFacultyAssignedSection(facultyUser);
  if (existing && existing.section) {
    throw new Error(`You have already assigned yourself to Section ${existing.section}. Mentorship assignment is locked.`);
  }

  const registry = getFacultyMentorRegistry();
  if (!registry.facultyAssignments) registry.facultyAssignments = {};
  if (!registry.sectionMentors) registry.sectionMentors = {};

  const cleanSection = section.trim();
  const facultyKey = facultyUser.userId || facultyUser.id || facultyUser.name;

  const assignment = {
    facultyId: facultyUser.id || null,
    facultyUserId: facultyUser.userId || null,
    facultyName: facultyUser.name || '',
    department: facultyUser.department || '',
    section: cleanSection,
    assignedAt: new Date().toISOString(),
    assignedBy: 'FACULTY',
    lockedForFaculty: true
  };

  registry.facultyAssignments[facultyKey] = assignment;
  registry.sectionMentors[cleanSection] = assignment;

  await saveFacultyMentorRegistry(registry);
  return assignment;
};

// HOD can view and can change / override / re-assign mentorship for any section or faculty
export const assignFacultyMentorByHod = async ({ facultyId, facultyUserId, facultyName, department, section }) => {
  if (!section || !section.trim()) throw new Error('Section name is required.');
  if (!facultyName || !facultyName.trim()) throw new Error('Faculty name is required.');

  const registry = getFacultyMentorRegistry();
  if (!registry.facultyAssignments) registry.facultyAssignments = {};
  if (!registry.sectionMentors) registry.sectionMentors = {};

  const cleanSection = section.trim();
  const facultyKey = facultyUserId || facultyId || facultyName.trim();

  // If this faculty was previously assigned to another section, clean up old section mapping
  for (const [sec, info] of Object.entries(registry.sectionMentors)) {
    if (!info) continue;
    const matchUserId = facultyUserId && info.facultyUserId && String(info.facultyUserId).toLowerCase() === String(facultyUserId).toLowerCase();
    const matchId = facultyId && info.facultyId && String(info.facultyId) === String(facultyId);
    const matchName = info.facultyName && String(info.facultyName).trim().toLowerCase() === String(facultyName).trim().toLowerCase();
    if (matchUserId || matchId || matchName) {
      delete registry.sectionMentors[sec];
    }
  }

  const assignment = {
    facultyId: facultyId || null,
    facultyUserId: facultyUserId || null,
    facultyName: facultyName.trim(),
    department: department || '',
    section: cleanSection,
    assignedAt: new Date().toISOString(),
    assignedBy: 'HOD',
    lockedForFaculty: true // Locked for the faculty from their login
  };

  registry.facultyAssignments[facultyKey] = assignment;
  registry.sectionMentors[cleanSection] = assignment;

  await saveFacultyMentorRegistry(registry);
  return assignment;
};

// HOD can remove a mentor assignment from a section
export const removeFacultyMentorByHod = async (sectionName) => {
  const registry = getFacultyMentorRegistry();
  if (!registry.sectionMentors) registry.sectionMentors = {};
  if (!registry.facultyAssignments) registry.facultyAssignments = {};

  const cleanSec = (sectionName || '').trim();
  const existing = registry.sectionMentors[cleanSec];
  if (existing) {
    const key = existing.facultyUserId || existing.facultyId || existing.facultyName;
    if (key && registry.facultyAssignments[key]) {
      delete registry.facultyAssignments[key];
    }
    delete registry.sectionMentors[cleanSec];
  }

  await saveFacultyMentorRegistry(registry);
  return true;
};

// Subscribe to mentor registry updates across tabs/sync
export const subscribeToMentors = (callback) => {
  const handler = (e) => {
    callback(e.detail || getFacultyMentorRegistry());
  };
  window.addEventListener('lectra_mentors_updated', handler);
  return () => window.removeEventListener('lectra_mentors_updated', handler);
};

// ==========================================
// STUDENT CERTIFICATE REQUESTS SERVICE
// Routed to OFFICE login role
// ==========================================
const CERT_STORAGE_KEY = 'lectra_certificate_requests';
const SYS_CONFIG_CERT_ID = 'SYS_CONFIG_CERTIFICATES';

export const getAllCertificateRequests = () => {
  try {
    const cached = localStorage.getItem(CERT_STORAGE_KEY);
    let localCerts = cached ? JSON.parse(cached) : [];
    
    // Also check if synced from central tickets
    const tickets = getAllOutpasses();
    const syncTicket = tickets.find(t => t.id === SYS_CONFIG_CERT_ID);
    if (syncTicket && syncTicket.requests && Array.isArray(syncTicket.requests)) {
      if (syncTicket.requests.length >= localCerts.length) {
        localStorage.setItem(CERT_STORAGE_KEY, JSON.stringify(syncTicket.requests));
        return syncTicket.requests;
      }
    }
    return localCerts;
  } catch (e) {
    return [];
  }
};

export const saveCertificateRequests = async (requests) => {
  try {
    localStorage.setItem(CERT_STORAGE_KEY, JSON.stringify(requests));
    window.dispatchEvent(new CustomEvent('lectra_certificates_updated', { detail: requests }));

    // Sync to central backend tickets storage for cross-device visibility
    const syncTicket = {
      id: SYS_CONFIG_CERT_ID,
      applicantType: 'SYSTEM_CONFIG',
      type: 'CERTIFICATE_REGISTRY',
      requests,
      updatedAt: new Date().toISOString()
    };

    const currentTickets = getAllOutpasses();
    const updatedTickets = [syncTicket, ...currentTickets.filter(t => t.id !== SYS_CONFIG_CERT_ID)];
    saveOutpasses(updatedTickets);

    await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ tickets: [syncTicket] })
    });
  } catch (e) {
    console.warn('Certificate requests save/sync warning:', e);
  }
};

export const submitCertificateRequest = async ({
  rollNumber,
  studentName,
  section = '',
  department = '',
  studentMobile = '',
  parentMobile = '',
  certificateName,
  reason = ''
}) => {
  if (!certificateName || !certificateName.trim()) {
    throw new Error('Please enter the certificate name you need.');
  }
  if (!rollNumber || !studentName) {
    throw new Error('Student roll number and name are required.');
  }

  const requests = getAllCertificateRequests();
  const now = new Date();
  const dateCompact = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const reqId = `CERT-${dateCompact}-${randomNum}`;

  const newRequest = {
    id: reqId,
    rollNumber: rollNumber.trim().toUpperCase(),
    studentName: studentName.trim(),
    section: section || '',
    department: department || '',
    studentMobile: studentMobile || '',
    parentMobile: parentMobile || '',
    certificateName: certificateName.trim(),
    reason: (reason || '').trim(),
    status: 'PENDING', // 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'READY' | 'ISSUED' | 'REJECTED'
    appliedAt: now.toISOString(),
    appliedDate: now.toLocaleDateString('en-GB'),
    appliedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    officeAction: null
  };

  const updated = [newRequest, ...requests.filter(r => r.id !== reqId)];
  await saveCertificateRequests(updated);
  return newRequest;
};

export const updateCertificateStatus = async (requestId, { status, remarks = '', processedBy = 'Administrative Office' }) => {
  const requests = getAllCertificateRequests();
  const req = requests.find(r => r.id === requestId);
  if (!req) throw new Error('Certificate request not found');

  const now = new Date();
  req.status = status;
  req.officeAction = {
    status,
    updatedAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks,
    processedBy
  };

  await saveCertificateRequests(requests);
  return req;
};

export const getStudentCertificateRequests = (rollNumber) => {
  if (!rollNumber) return [];
  const clean = rollNumber.trim().toUpperCase();
  const requests = getAllCertificateRequests();
  return requests.filter(r => (r.rollNumber || '').toUpperCase() === clean);
};

export const subscribeToCertificates = (callback) => {
  const handler = (e) => {
    callback(e.detail || getAllCertificateRequests());
  };
  window.addEventListener('lectra_certificates_updated', handler);
  return () => window.removeEventListener('lectra_certificates_updated', handler);
};



