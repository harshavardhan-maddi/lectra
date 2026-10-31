const getCleanTimeZone = () => {
  let tz = process.env.TZ || 'Asia/Kolkata';
  if (tz.startsWith(':')) {
    tz = tz.slice(1);
  }
  // Vercel serverless default is :UTC/UTC. Fallback to Asia/Kolkata unless explicitly set to a specific timezone.
  if (tz === 'UTC' || tz === 'utc') {
    return 'Asia/Kolkata';
  }
  return tz;
};

const getLocalTimeParts = () => {
  const tz = getCleanTimeZone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = {};
  parts.forEach(p => {
    partMap[p.type] = p.value;
  });
  return partMap;
};

const getTodayDay = () => {
  const parts = getLocalTimeParts();
  return parts.weekday; // e.g. "Friday"
};


const getTodayDateKey = () => {
  const parts = getLocalTimeParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const isAfter410PM = () => {
  const parts = getLocalTimeParts();
  const mins = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  return mins >= (16 * 60 + 10);
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridiem = match[3] ? match[3].toUpperCase() : null;
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

const isPastTimeToday = (timeStr, targetDateStr = null) => {
  const parts = getLocalTimeParts();
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  if (targetDateStr && targetDateStr !== todayKey) {
    if (targetDateStr < todayKey) return true;
    if (targetDateStr > todayKey) return false;
  }
  const parsed = parseTimeToMinutes(timeStr);
  if (parsed === null) return false;
  const currentMinutes = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  return parsed < currentMinutes;
};

const getCurrentTimeInHHMM = () => {
  const parts = getLocalTimeParts();
  return `${parts.hour}:${parts.minute}`; // e.g. "11:19"
};

const getLocalDayBounds = (dateStr) => {
  const tz = getCleanTimeZone();
  let year, month, day;
  if (!dateStr) {
    const parts = getLocalTimeParts();
    year = parts.year;
    month = parts.month;
    day = parts.day;
  } else {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      const d = new Date(dateStr);
      year = d.getFullYear();
      month = String(d.getMonth() + 1).padStart(2, '0');
      day = String(d.getDate()).padStart(2, '0');
    }
  }

  // Find timezone offset string (e.g. "+05:30")
  const tempDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
  const tzString = tempDate.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
  const match = tzString.match(/GMT([+-]\d+):?(\d+)?/);
  let offsetFormatted = '+00:00';
  if (match) {
    const offsetSign = match[1][0];
    const offsetHours = parseInt(match[1].slice(1));
    const offsetMinutes = match[2] ? parseInt(match[2]) : 0;
    offsetFormatted = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  }

  const startIso = `${year}-${month}-${day}T00:00:00.000${offsetFormatted}`;
  const endIso = `${year}-${month}-${day}T23:59:59.999${offsetFormatted}`;

  return {
    start: new Date(startIso),
    end: new Date(endIso)
  };
};

const getWeekdayForDate = (date) => {
  const tz = getCleanTimeZone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
  });
  return formatter.format(new Date(date));
};

const STANDARD_PERIODS = [
  { periodNo: 1, startTime: '09:10', endTime: '10:00' },
  { periodNo: 2, startTime: '10:00', endTime: '10:50' },
  { periodNo: 3, startTime: '11:00', endTime: '11:50' },
  { periodNo: 4, startTime: '11:50', endTime: '12:40' },
  { periodNo: 5, startTime: '13:30', endTime: '14:20' },
  { periodNo: 6, startTime: '14:20', endTime: '15:10' },
  { periodNo: 7, startTime: '15:10', endTime: '16:00' },
];

module.exports = {
  getTodayDateKey,
  isAfter410PM,
  parseTimeToMinutes,
  isPastTimeToday,
  getTodayDay,
  getCurrentTimeInHHMM,
  getLocalDayBounds,
  getWeekdayForDate,
  STANDARD_PERIODS,
};
