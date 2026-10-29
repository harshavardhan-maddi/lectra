/**
 * Activity Logger Service for Lectra Campus Administration System
 * Tracks logins, user operations, completed tasks, and logouts
 * Generates structured text reports for Super Admin audit trail.
 */

const STORAGE_KEY = 'lectra_activity_logs';
const MAX_LOGS = 3000;

const getStoredLogs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse activity logs from localStorage', e);
    return [];
  }
};

const saveLogs = (logs) => {
  try {
    // Keep within MAX_LOGS to prevent storage bloat
    const trimmed = logs.slice(0, MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    // Dispatch custom event for immediate reactive updates in open Super Admin views
    window.dispatchEvent(new CustomEvent('lectra_activity_logged', { detail: trimmed[0] }));
  } catch (e) {
    console.error('Failed to persist activity logs', e);
  }
};

/**
 * Log a user action
 */
export const logActivity = ({ action, details, category = 'SYSTEM', completed = true, user = null }) => {
  // If user not provided, attempt to get active user from localStorage
  let currentUser = user;
  if (!currentUser) {
    try {
      const stored = localStorage.getItem('user');
      if (stored) currentUser = JSON.parse(stored);
    } catch (e) {}
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: now.toISOString(),
    date: dateStr,
    time: timeStr,
    username: currentUser?.userId || currentUser?.username || currentUser?.empid || 'Anonymous',
    name: currentUser?.name || 'User',
    role: currentUser?.role || 'GUEST',
    department: currentUser?.department || 'General',
    action: action || 'GENERAL_ACTIVITY',
    details: details || '',
    category: category,
    completed: completed,
  };

  const logs = getStoredLogs();
  logs.unshift(entry);
  saveLogs(logs);
  return entry;
};

/**
 * Record User Login
 */
export const recordLogin = (user) => {
  // Save login start timestamp in sessionStorage for session duration calculation on logout
  try {
    sessionStorage.setItem('lectra_session_start', Date.now().toString());
  } catch (e) {}

  return logActivity({
    action: 'LOGIN',
    details: `User logged into the portal (${user?.name || user?.userId} - ${user?.role || 'User'})`,
    category: 'AUTH',
    completed: true,
    user
  });
};

/**
 * Record User Logout
 */
export const recordLogout = (user) => {
  let sessionMinutes = null;
  try {
    const startStr = sessionStorage.getItem('lectra_session_start');
    if (startStr) {
      const diffMs = Date.now() - parseInt(startStr, 10);
      sessionMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
      sessionStorage.removeItem('lectra_session_start');
    }
  } catch (e) {}

  const durationText = sessionMinutes ? ` (Active session duration: ~${sessionMinutes} min)` : '';

  return logActivity({
    action: 'LOGOUT',
    details: `User logged out of the portal${durationText}`,
    category: 'AUTH',
    completed: true,
    user
  });
};

/**
 * Retrieve activities matching filter criteria
 */
export const getActivities = ({ username = '', date = '', category = '', search = '', limit = 1000 } = {}) => {
  let logs = getStoredLogs();

  if (username && username !== 'ALL') {
    const qUser = username.toLowerCase();
    logs = logs.filter(l => 
      (l.username && l.username.toLowerCase() === qUser) ||
      (l.name && l.name.toLowerCase().includes(qUser))
    );
  }

  if (date && date !== 'ALL') {
    logs = logs.filter(l => l.date === date);
  }

  if (category && category !== 'ALL') {
    logs = logs.filter(l => l.category === category || l.action === category);
  }

  if (search) {
    const qSearch = search.toLowerCase();
    logs = logs.filter(l => 
      (l.details && l.details.toLowerCase().includes(qSearch)) ||
      (l.action && l.action.toLowerCase().includes(qSearch)) ||
      (l.name && l.name.toLowerCase().includes(qSearch)) ||
      (l.username && l.username.toLowerCase().includes(qSearch)) ||
      (l.department && l.department.toLowerCase().includes(qSearch))
    );
  }

  return logs.slice(0, limit);
};

/**
 * Get distinct users list from logs
 */
export const getDistinctUsers = () => {
  const logs = getStoredLogs();
  const map = new Map();

  logs.forEach(l => {
    if (l.username && !map.has(l.username)) {
      map.set(l.username, {
        username: l.username,
        name: l.name,
        role: l.role,
        department: l.department
      });
    }
  });

  return Array.from(map.values());
};

/**
 * Clear all activities
 */
export const clearActivities = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('lectra_activity_logged', { detail: null }));
};

/**
 * Generate Structured Text Report for Super Admin download
 */
export const generateTextReport = (activities, { filterDate = 'Overall', filterUser = 'All Users', generatedBy = 'Super Administrator' } = {}) => {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeFormatted = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const divider = '='.repeat(100);
  const subDivider = '-'.repeat(100);

  const loginsCount = activities.filter(a => a.action === 'LOGIN').length;
  const logoutsCount = activities.filter(a => a.action === 'LOGOUT').length;
  const completedOps = activities.filter(a => a.completed && a.action !== 'LOGIN' && a.action !== 'LOGOUT').length;
  const uniqueUsersCount = new Set(activities.map(a => a.username)).size;

  let report = '';
  report += `${divider}\n`;
  report += `         NARASARAOPETA ENGINEERING COLLEGE (AUTONOMOUS)\n`;
  report += `    Kotappakonda Road, Yellamanda (P.O), Narasaraopet - 522601, Palnadu Dist., A.P.\n`;
  report += `             CAMPUS ACCESS & USER ACTIVITY AUDIT TRAIL REPORT\n`;
  report += `${divider}\n\n`;

  report += `REPORT METADATA:\n`;
  report += `  Scope / Date Filter : ${filterDate === 'ALL' || !filterDate ? 'Overall (All Records)' : filterDate}\n`;
  report += `  Target User         : ${filterUser === 'ALL' || !filterUser ? 'All Campus Users' : filterUser}\n`;
  report += `  Generated On        : ${dateFormatted} at ${timeFormatted}\n`;
  report += `  Authorized By       : ${generatedBy}\n`;
  report += `  System Institution  : Narasaraopeta Engineering College • Lectra Campus Portal\n`;
  report += `\n${subDivider}\n`;

  report += `EXECUTIVE SUMMARY:\n`;
  report += `  Total Activity Logs Recorded  : ${activities.length}\n`;
  report += `  Unique Users Identified       : ${uniqueUsersCount}\n`;
  report += `  Total Login Events            : ${loginsCount}\n`;
  report += `  Total Logout Events           : ${logoutsCount}\n`;
  report += `  Total Administrative Tasks    : ${completedOps}\n`;
  report += `${subDivider}\n\n`;

  report += `CHRONOLOGICAL AUDIT LOG:\n`;
  report += `[Date & Time]         | [User Name (ID / Role)]           | [Action]              | [Details & Status]\n`;
  report += `${subDivider}\n`;

  if (activities.length === 0) {
    report += `  No activity records matched the selected query.\n`;
  } else {
    activities.forEach((act, idx) => {
      const dt = `${act.date} ${act.time}`;
      const userCol = `${act.name} (${act.username} • ${act.role})`.padEnd(33, ' ').substring(0, 33);
      const actionCol = (act.action || 'GENERAL').padEnd(21, ' ').substring(0, 21);
      const statusPrefix = act.completed ? '[DONE]' : '[IN-PROGRESS]';
      const details = `${statusPrefix} ${act.details}`;
      report += `${dt.padEnd(20, ' ')} | ${userCol} | ${actionCol} | ${details}\n`;
    });
  }

  report += `\n${divider}\n`;
  report += `End of Report • Verified by Super Admin • Official Campus Security & System Activity Record\n`;
  report += `${divider}\n`;

  return report;
};

/**
 * Trigger immediate browser download of the text report
 */
export const downloadTextReport = (activities, options = {}) => {
  const content = generateTextReport(activities, options);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const userSlug = options.filterUser && options.filterUser !== 'ALL' ? options.filterUser.replace(/\s+/g, '_') : 'All_Users';
  const dateSlug = options.filterDate && options.filterDate !== 'ALL' ? options.filterDate : 'Overall';
  const filename = `NEC_Activity_Report_${userSlug}_${dateSlug}_${Date.now()}.txt`;
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
