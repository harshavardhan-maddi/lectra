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
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `••••••${last4}`;
};

// Lookup and match student by Roll Number AND Full Name against HOD registry (Live DB + Cache Fallback)
export const lookupStudentByRollAndName = async (rollNumber, fullName) => {
  if (!rollNumber || !fullName) {
    return { success: false, error: 'Please enter both your Roll Number and Full Name.' };
  }

  const cleanRoll = rollNumber.trim().toUpperCase();

  // 1. Try Live Backend Database lookup (checks prisma.student registry added by HOD)
  try {
    const res = await fetch('/api/student-attendance/verify-outpass-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber: cleanRoll, name: fullName.trim() })
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
      // Backend returned explicit validation message (e.g., student not found in HOD registry or name mismatch)
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

  // Normalize registered student name
  const registeredCleanName = (studentByRoll.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const inputCleanName = fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const inputWords = fullName.trim().toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 1);
  const registeredWords = (studentByRoll.name || '').toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 1);

  // Flexible match: exact, contains, or word overlap
  const wordOverlap = inputWords.length > 0 && inputWords.some(w => registeredWords.some(rw => rw.includes(w) || w.includes(rw)));
  const isMatch = registeredCleanName === inputCleanName ||
                  registeredCleanName.includes(inputCleanName) ||
                  inputCleanName.includes(registeredCleanName) ||
                  wordOverlap;

  if (!isMatch) {
    return {
      success: false,
      error: `Name does not match the registered record for Roll Number ${cleanRoll}. Please enter your full registered name.`
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

// Get all outpasses from storage
export const getAllOutpasses = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return list.map(t => {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  // Dispatch custom event for same-tab updates
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: tickets }));

  // Send to backend database so other devices (Absent Controller, HOD, Watchman) receive it instantly
  try {
    const res = await fetch(`/api/student-attendance/outpass/tickets?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ tickets })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets }));
        return data.tickets;
      }
    }
  } catch (e) {
    console.warn('Sync outpass network note:', e);
  }
  return tickets;
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
        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets }));
        return data.tickets;
      }
    }
  } catch (e) {
    // silent fallback to local storage
  }
  return getAllOutpasses();
};

// Delete an individual outpass ticket (HOD feature)
export const deleteOutpassTicket = async (ticketId) => {
  const current = getAllOutpasses().filter(t => t.id !== ticketId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: current }));

  try {
    const res = await fetch(`/api/student-attendance/outpass/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets }));
        return data.tickets;
      }
    }
  } catch (err) {
    console.warn('Delete outpass network note:', err);
  }
  return current;
};

// Clear completed (SENT_OUT) and rejected tickets (HOD feature)
export const clearOldOutpasses = async () => {
  const activeOnly = getAllOutpasses().filter(t => t.status !== 'SENT_OUT' && t.status !== 'REJECTED');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activeOnly));
  window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: activeOnly }));

  try {
    const res = await fetch('/api/student-attendance/outpass/tickets/clear-old', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.tickets));
        window.dispatchEvent(new CustomEvent('lectra_outpass_updated', { detail: data.tickets }));
        return data.tickets;
      }
    }
  } catch (err) {
    console.warn('Clear old outpasses network note:', err);
  }
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

// Absent Controller makes call to parent & takes confirmation
export const confirmParentAndForwardToHOD = (ticketId, { controllerName = 'Absent Controller', remarks = 'Parent confirmed permission over phone call.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Outpass application not found');

  const now = new Date();
  ticket.status = 'FORWARDED_TO_HOD';
  ticket.absentControllerAction = {
    confirmed: true,
    calledAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks,
    controllerName
  };

  saveOutpasses(tickets);
  return ticket;
};

// Absent Controller marks parent denied permission
export const rejectByAbsentController = (ticketId, { controllerName = 'Absent Controller', reason = 'Parent did not grant permission during call.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Outpass application not found');

  const now = new Date();
  ticket.status = 'REJECTED';
  ticket.rejectionStage = 'ABSENT_CONTROLLER';
  ticket.rejectionReason = reason;
  ticket.absentControllerAction = {
    confirmed: false,
    calledAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    remarks: reason,
    controllerName
  };

  saveOutpasses(tickets);
  return ticket;
};

// HOD grants permission
export const hodGrantOutpass = (ticketId, { hodName = 'Dr. Rajesh Sharma (HOD CSE)', remarks = 'Permission Approved.' } = {}) => {
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
export const hodRejectOutpass = (ticketId, { hodName = 'Dr. Rajesh Sharma (HOD)', reason = 'Permission Denied by HOD.' } = {}) => {
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

// Watchman verifies physical student ID and marks student Sent Out
export const watchmanReleaseStudent = (ticketId, { watchmanName = 'Main Gate Security Officer', remarks = 'Physical College ID card verified. Student exited campus.' } = {}) => {
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
export const getFacultyMonthlyLeaveUsage = (facultyIdentifier, targetDateStr = null) => {
  if (!facultyIdentifier) {
    return { count: 0, limit: 2, remaining: 2, isLimitExceeded: false, monthKey: '' };
  }

  const cleanId = String(facultyIdentifier).trim().toLowerCase();
  const d = targetDateStr ? new Date(targetDateStr) : new Date();
  const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  const month = isNaN(d.getMonth()) ? String(new Date().getMonth() + 1).padStart(2, '0') : String(d.getMonth() + 1).padStart(2, '0');
  const targetMonthKey = `${year}-${month}`; // e.g. "2026-09"

  const all = getAllOutpasses();
  const facultyMonthTickets = all.filter(t => {
    if (t.applicantType !== 'FACULTY') return false;
    
    const matchesUser = 
      (t.facultyUserId && String(t.facultyUserId).trim().toLowerCase() === cleanId) ||
      (t.facultyName && String(t.facultyName).trim().toLowerCase() === cleanId) ||
      (t.facultyId && String(t.facultyId) === cleanId) ||
      (t.rollNumber && String(t.rollNumber).trim().toLowerCase() === cleanId);
    
    if (!matchesUser) return false;
    if (t.status === 'REJECTED') return false; // Rejected leaves do not consume the quota

    // Determine the ticket's month (strictly based on leave date or applied date)
    const ticketDateStr = t.date || (t.appliedAt ? t.appliedAt.slice(0, 10) : '');
    const ticketMonthKey = ticketDateStr.slice(0, 7);

    return ticketMonthKey === targetMonthKey;
  });

  const count = facultyMonthTickets.length;
  const limit = 2;
  const remaining = Math.max(0, limit - count);
  const isLimitExceeded = count >= limit;

  return {
    count,
    limit,
    remaining,
    isLimitExceeded,
    monthKey: targetMonthKey,
    monthName: new Date(year, parseInt(month, 10) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
    tickets: facultyMonthTickets,
    message: isLimitExceeded ? "your limit for leaves has been completed , consult principal." : ""
  };
};

// Apply for Faculty Full-Day Leave or Early Out Permission
export const applyFacultyLeave = async ({
  facultyId,
  facultyUserId,
  facultyName,
  department = 'Department of CSE(emerging Technologies)',
  type = 'FACULTY_LEAVE', // 'FACULTY_LEAVE' or 'FACULTY_EARLY_OUT'
  date,
  leaveTime,
  purpose
}) => {
  if (!purpose || !purpose.trim()) {
    throw new Error('Please specify a valid and proper purpose for your request.');
  }

  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const cleanDepartment = (department && department !== 'General') ? department : 'Department of CSE(emerging Technologies)';

  if (type === 'FACULTY_EARLY_OUT' && (!leaveTime || !leaveTime.trim())) {
    throw new Error('Please specify the time you need to leave early.');
  }

  // 1. Strict Monthly Limit Check (2 leaves per month, resets every month, no carryover)
  const quota = getFacultyMonthlyLeaveUsage(facultyUserId || facultyName || facultyId, selectedDate);
  if (quota.isLimitExceeded) {
    throw new Error("your limit for leaves has been completed , consult principal.");
  }

  const now = new Date();
  const dateCompact = selectedDate.replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const prefix = type === 'FACULTY_EARLY_OUT' ? 'NEC-FAC-EARLY' : 'NEC-FAC-LEAVE';
  const ticketId = `${prefix}-${dateCompact}-${randomNum}`;

  const newTicket = {
    id: ticketId,
    applicantType: 'FACULTY',
    type, // 'FACULTY_LEAVE' | 'FACULTY_EARLY_OUT'
    facultyId,
    facultyUserId: facultyUserId || '',
    facultyName: facultyName || 'Faculty Member',
    department: cleanDepartment,
    date: selectedDate,
    leaveTime: type === 'FACULTY_EARLY_OUT' ? leaveTime : 'Full Day',
    purpose: purpose.trim(),
    reason: purpose.trim(), // for unified compatibility
    destination: 'Personal / Official Duty',
    rollNumber: facultyUserId || 'FACULTY',
    studentName: facultyName || 'Faculty Member',
    section: cleanDepartment,
    appliedAt: now.toISOString(),
    appliedDate: now.toLocaleDateString('en-GB'),
    appliedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    
    // Status Flow for Faculty:
    // 1. FORWARDED_TO_HOD: Faculty submitted -> Goes directly to HOD (no parent call needed)
    // 2. PERMISSION_GRANTED: HOD accepted & forwarded to watchman -> Watchman sees at gate
    // 3. SENT_OUT: Watchman generated final slip & allowed gate departure
    // 4. REJECTED: HOD rejected the request
    status: 'FORWARDED_TO_HOD',
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

// HOD accepts Faculty Leave / Early Out & forwards to Watchman role login
export const hodApproveFacultyLeave = (ticketId, { hodName = 'Dr. Rajesh Sharma (HOD)', remarks = 'Accepted and forwarded to watchman login.', timeToLeave = null } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Leave application not found');

  const now = new Date();
  ticket.status = 'PERMISSION_GRANTED';
  if (timeToLeave) {
    ticket.leaveTime = timeToLeave;
  }

  ticket.hodAction = {
    granted: true,
    approvedAt: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks: remarks || `Permission accepted for ${ticket.type === 'FACULTY_EARLY_OUT' ? `early out at ${ticket.leaveTime}` : 'full day leave'}. Forwarded to watchman login.`,
    hodName,
    timeToLeave: ticket.leaveTime
  };

  saveOutpasses(tickets);
  return ticket;
};

// Watchman generates final slip and marks faculty departed (NO ID check needed for faculty)
export const watchmanReleaseFaculty = (ticketId, { watchmanName = 'Main Gate Security Officer', remarks = 'Final slip generated. Faculty departure permitted.' } = {}) => {
  const tickets = getAllOutpasses();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) throw new Error('Faculty gate pass not found');

  const now = new Date();
  ticket.status = 'SENT_OUT';
  ticket.watchmanAction = {
    sentOut: true,
    physicalIdVerified: false, // Bypassed for faculty as requested
    finalSlipGenerated: true,
    exitTime: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    displayDate: now.toLocaleDateString('en-GB'),
    remarks,
    watchmanName
  };

  saveOutpasses(tickets);
  return ticket;
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

