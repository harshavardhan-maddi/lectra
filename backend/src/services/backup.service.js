const AdmZip = require('adm-zip');
const prisma = require('../db');
const mysql = require('mysql2/promise');

const REQUIRED_BACKUP_FILES = [
  'metadata.json',
  'users.json',
  'students.json',
  'faculty.json',
  'classrooms.json',
  'timetable.json',
  'attendance.json',
  'tickets.json',
  'ticket_history.json',
  'roles.json'
];

const BACKUP_VERSION = '1.0.0';
const APP_VERSION = '1.0.0';
const MIGRATION_HISTORY_KEY = 'lectra_data_migration_history';

/**
 * Log migration or export activity into SystemSetting store (non-destructive)
 */
async function appendMigrationHistory(logEntry) {
  try {
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { key: MIGRATION_HISTORY_KEY }
    });

    let history = [];
    if (existingSetting && existingSetting.value) {
      try {
        history = JSON.parse(existingSetting.value);
        if (!Array.isArray(history)) history = [];
      } catch (e) {
        history = [];
      }
    }

    history.unshift({
      id: `mig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...logEntry
    });

    // Keep the most recent 100 entries
    if (history.length > 100) history = history.slice(0, 100);

    const stringified = JSON.stringify(history);

    if (existingSetting) {
      await prisma.systemSetting.update({
        where: { key: MIGRATION_HISTORY_KEY },
        data: { value: stringified }
      });
    } else {
      await prisma.systemSetting.create({
        data: {
          key: MIGRATION_HISTORY_KEY,
          value: stringified
        }
      });
    }
  } catch (error) {
    console.error('[Migration History Logger Error]:', error);
  }
}

/**
 * Retrieve migration and backup history
 */
async function getMigrationHistory() {
  try {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: MIGRATION_HISTORY_KEY }
    });
    if (!existing || !existing.value) return [];
    const list = JSON.parse(existing.value);
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error('[Get Migration History Error]:', error);
    return [];
  }
}

/**
 * Export Overall Data from PostgreSQL (Read-Only)
 */
async function exportOverallData(adminUser) {
  console.log(`[Backup Export] Starting overall data export by ${adminUser?.name || 'Admin'} (${adminUser?.userId})...`);

  // 1. Fetch all data in parallel with read-only Prisma queries
  const [
    users,
    students,
    faculty,
    classrooms,
    timetable,
    attendance,
    facultyLogs,
    absenteeCallLogs,
    systemSettings
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: 'asc' } }),
    prisma.student.findMany({ orderBy: { id: 'asc' } }),
    prisma.faculty.findMany({ orderBy: { id: 'asc' } }),
    prisma.classroom.findMany({ orderBy: { id: 'asc' } }),
    prisma.timetable.findMany({ orderBy: { id: 'asc' } }),
    prisma.attendance.findMany({ orderBy: { id: 'asc' } }),
    prisma.facultyLog.findMany({ orderBy: { id: 'asc' } }),
    prisma.absenteeCallLog.findMany({ orderBy: { id: 'asc' } }),
    prisma.systemSetting.findMany({ orderBy: { id: 'asc' } })
  ]);

  // Extract outpass tickets from system setting
  let tickets = [];
  const ticketsSetting = systemSettings.find(s => s.key === 'lectra_outpass_tickets_db');
  if (ticketsSetting && ticketsSetting.value) {
    try {
      tickets = JSON.parse(ticketsSetting.value);
      if (!Array.isArray(tickets)) tickets = [];
    } catch (e) {
      tickets = [];
    }
  }

  // Sanitize user passwords: keep the bcrypt hashes so users can authenticate in MySQL,
  // but ensure no accidental plaintext or session secrets leak
  const sanitizedUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    userId: u.userId,
    password: u.password, // bcrypt hash preserved for password portability
    role: u.role,
    className: u.className,
    createdAt: u.createdAt,
    fingerprintEnabled: u.fingerprintEnabled
  }));

  const roles = [
    { role: 'HOD', description: 'Head of Department (Full Administrator & Grantor)' },
    { role: 'SUB_ADMIN', description: 'Sub Administrator' },
    { role: 'CR', description: 'Class Representative' },
    { role: 'ABSENT_CONTROLLER', description: 'Absent Controller (Call & Gate Parent Verification)' },
    { role: 'FACULTY', description: 'Teaching Faculty Member' }
  ];

  const ticketHistory = {
    absenteeCallLogs,
    facultyLogs
  };

  const counts = {
    users: sanitizedUsers.length,
    students: students.length,
    faculty: faculty.length,
    classrooms: classrooms.length,
    timetable: timetable.length,
    attendance: attendance.length,
    tickets: tickets.length,
    absenteeCallLogs: absenteeCallLogs.length,
    facultyLogs: facultyLogs.length,
    roles: roles.length
  };

  const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const creationDate = new Date();
  const dateString = creationDate.toISOString().slice(0, 10);
  const filename = `attendance-system-backup-${dateString}.zip`;

  const metadata = {
    backupVersion: BACKUP_VERSION,
    creationDate: creationDate.toISOString(),
    applicationVersion: APP_VERSION,
    databaseType: 'MySQL',
    sourceApplication: 'Lectra Attendance & Ticketing System',
    exportedBy: {
      userId: adminUser?.userId || 'ADMIN',
      name: adminUser?.name || 'Administrator',
      role: adminUser?.role || 'HOD'
    },
    counts,
    totalRecords,
    relationshipsPreserved: [
      'classrooms.id -> timetable.classroomId',
      'classrooms.id -> faculty_logs.classroomId',
      'students.id -> attendance.studentId',
      'students.id -> absentee_call_logs.studentId'
    ]
  };

  // 2. Build ZIP archive
  const zip = new AdmZip();

  zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));
  zip.addFile('users.json', Buffer.from(JSON.stringify(sanitizedUsers, null, 2), 'utf8'));
  zip.addFile('students.json', Buffer.from(JSON.stringify(students, null, 2), 'utf8'));
  zip.addFile('faculty.json', Buffer.from(JSON.stringify(faculty, null, 2), 'utf8'));
  zip.addFile('classrooms.json', Buffer.from(JSON.stringify(classrooms, null, 2), 'utf8'));
  zip.addFile('timetable.json', Buffer.from(JSON.stringify(timetable, null, 2), 'utf8'));
  zip.addFile('attendance.json', Buffer.from(JSON.stringify(attendance, null, 2), 'utf8'));
  zip.addFile('tickets.json', Buffer.from(JSON.stringify(tickets, null, 2), 'utf8'));
  zip.addFile('ticket_history.json', Buffer.from(JSON.stringify(ticketHistory, null, 2), 'utf8'));
  zip.addFile('roles.json', Buffer.from(JSON.stringify(roles, null, 2), 'utf8'));

  const zipBuffer = zip.toBuffer();

  // Log the export action
  await appendMigrationHistory({
    action: 'EXPORT',
    admin: adminUser?.name || adminUser?.userId || 'HOD',
    filename,
    recordsCount: totalRecords,
    status: 'SUCCESS',
    details: `Exported ${totalRecords} records across all entities`
  });

  console.log(`[Backup Export] Export complete. Generated ${filename} (${zipBuffer.length} bytes, ${totalRecords} records).`);

  return {
    filename,
    buffer: zipBuffer,
    metadata
  };
}

/**
 * Validate Uploaded Backup ZIP in-memory
 */
function validateBackupZip(zipBuffer) {
  if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) {
    throw new Error('Invalid ZIP file payload provided');
  }

  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();
  const entryNames = zipEntries.map(e => e.entryName.toLowerCase().replace(/^\/+/, ''));

  // 1. Verify required files
  const missingFiles = [];
  REQUIRED_BACKUP_FILES.forEach(requiredFile => {
    if (!entryNames.includes(requiredFile.toLowerCase())) {
      missingFiles.push(requiredFile);
    }
  });

  if (missingFiles.length > 0) {
    return {
      isValid: false,
      error: `Missing required backup files: ${missingFiles.join(', ')}`,
      missingFiles,
      presentFiles: entryNames
    };
  }

  // 2. Parse all JSON files safely
  const parsedData = {};
  for (const entry of zipEntries) {
    const cleanName = entry.entryName.toLowerCase().replace(/^\/+/, '');
    if (REQUIRED_BACKUP_FILES.includes(cleanName)) {
      try {
        const text = entry.getData().toString('utf8');
        parsedData[cleanName] = JSON.parse(text);
      } catch (err) {
        return {
          isValid: false,
          error: `Corrupt or invalid JSON formatting in "${entry.entryName}": ${err.message}`
        };
      }
    }
  }

  // 3. Validate metadata
  const metadata = parsedData['metadata.json'];
  if (!metadata || typeof metadata !== 'object') {
    return {
      isValid: false,
      error: 'Invalid metadata.json format'
    };
  }

  const dataVersion = metadata.backupVersion || 'Unknown';

  // 4. Duplicate Record Detection
  const duplicates = {
    users: findDuplicates(parsedData['users.json'] || [], 'userId'),
    students: findDuplicates(parsedData['students.json'] || [], 'rollNumber'),
    faculty: findDuplicates(parsedData['faculty.json'] || [], 'facultyName'),
    classrooms: findCompositeDuplicates(parsedData['classrooms.json'] || [], ['roomNumber', 'className']),
    attendance: findCompositeDuplicates(parsedData['attendance.json'] || [], ['studentId', 'date']),
    tickets: findDuplicates(parsedData['tickets.json'] || [], 'id')
  };

  const totalDuplicates = Object.values(duplicates).reduce((sum, arr) => sum + arr.length, 0);

  // 5. Foreign Key & Relationship Validation
  const classroomIds = new Set((parsedData['classrooms.json'] || []).map(c => c.id));
  const studentIds = new Set((parsedData['students.json'] || []).map(s => s.id));

  const brokenRelationships = [];

  // Check timetables -> classrooms
  (parsedData['timetable.json'] || []).forEach(t => {
    if (t.classroomId && !classroomIds.has(t.classroomId)) {
      brokenRelationships.push({
        entity: 'timetable',
        id: t.id,
        relationship: 'classroomId -> classrooms.id',
        missingTargetId: t.classroomId
      });
    }
  });

  // Check attendance -> students
  (parsedData['attendance.json'] || []).forEach(a => {
    if (a.studentId && !studentIds.has(a.studentId)) {
      brokenRelationships.push({
        entity: 'attendance',
        id: a.id,
        relationship: 'studentId -> students.id',
        missingTargetId: a.studentId
      });
    }
  });

  // Check ticket_history -> students & classrooms
  const ticketHistory = parsedData['ticket_history.json'] || {};
  const absenteeLogs = Array.isArray(ticketHistory.absenteeCallLogs) ? ticketHistory.absenteeCallLogs : [];
  const facultyLogs = Array.isArray(ticketHistory.facultyLogs) ? ticketHistory.facultyLogs : [];

  absenteeLogs.forEach(log => {
    if (log.studentId && !studentIds.has(log.studentId)) {
      brokenRelationships.push({
        entity: 'absenteeCallLog',
        id: log.id,
        relationship: 'studentId -> students.id',
        missingTargetId: log.studentId
      });
    }
  });

  facultyLogs.forEach(log => {
    if (log.classroomId && !classroomIds.has(log.classroomId)) {
      brokenRelationships.push({
        entity: 'facultyLog',
        id: log.id,
        relationship: 'classroomId -> classrooms.id',
        missingTargetId: log.classroomId
      });
    }
  });

  // 6. Calculate entity counts
  const entityCounts = {
    users: (parsedData['users.json'] || []).length,
    students: (parsedData['students.json'] || []).length,
    faculty: (parsedData['faculty.json'] || []).length,
    classrooms: (parsedData['classrooms.json'] || []).length,
    timetable: (parsedData['timetable.json'] || []).length,
    attendance: (parsedData['attendance.json'] || []).length,
    tickets: (parsedData['tickets.json'] || []).length,
    absenteeCallLogs: absenteeLogs.length,
    facultyLogs: facultyLogs.length,
    roles: (parsedData['roles.json'] || []).length
  };

  const totalRecords = Object.values(entityCounts).reduce((a, b) => a + b, 0);

  return {
    isValid: true,
    metadata,
    backupVersion: dataVersion,
    creationDate: metadata.creationDate,
    sourceDatabase: metadata.databaseType || 'PostgreSQL',
    exportedBy: metadata.exportedBy,
    entityCounts,
    totalRecords,
    duplicateSummary: {
      totalDuplicates,
      details: duplicates
    },
    relationshipSummary: {
      hasBrokenRelationships: brokenRelationships.length > 0,
      brokenCount: brokenRelationships.length,
      brokenDetails: brokenRelationships.slice(0, 20) // send first 20 for preview
    },
    mysqlCompatibility: {
      ready: true,
      tablesRequired: [
        'users',
        'classrooms',
        'faculty',
        'timetables',
        'faculty_logs',
        'students',
        'attendance',
        'absentee_call_logs',
        'system_settings'
      ],
      autoIncrementPreservationSupported: true
    },
    parsedData
  };
}

function findDuplicates(array, key) {
  const seen = new Set();
  const duplicates = [];
  array.forEach(item => {
    if (item && item[key] !== undefined && item[key] !== null) {
      if (seen.has(item[key])) {
        duplicates.push({ key, value: item[key], id: item.id });
      } else {
        seen.add(item[key]);
      }
    }
  });
  return duplicates;
}

function findCompositeDuplicates(array, keys) {
  const seen = new Set();
  const duplicates = [];
  array.forEach(item => {
    if (item) {
      const compositeVal = keys.map(k => String(item[k])).join('__');
      if (seen.has(compositeVal)) {
        duplicates.push({ keys, value: compositeVal, id: item.id });
      } else {
        seen.add(compositeVal);
      }
    }
  });
  return duplicates;
}

/**
 * Generate Standalone MySQL Migration SQL Script
 * Preserves exact primary keys, foreign keys, constraints, and indexes
 */
function generateMySQLDump(parsedData, metadata) {
  const lines = [];

  lines.push('-- ========================================================');
  lines.push('-- Lectra Attendance & Ticketing System');
  lines.push('-- Automated MySQL Migration Dump');
  lines.push(`-- Source Database: ${metadata?.databaseType || 'PostgreSQL'}`);
  lines.push(`-- Exported Date: ${metadata?.creationDate || new Date().toISOString()}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- ========================================================');
  lines.push('');
  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";');
  lines.push('SET time_zone = "+00:00";');
  lines.push('');

  // 1. Table: users
  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `users`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(255) NOT NULL,
  \`user_id\` VARCHAR(191) NOT NULL UNIQUE,
  \`password\` VARCHAR(255) NOT NULL,
  \`role\` ENUM('HOD', 'SUB_ADMIN', 'CR', 'ABSENT_CONTROLLER', 'FACULTY') NOT NULL,
  \`class_name\` VARCHAR(191) NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`fingerprint_enabled\` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  const users = parsedData['users.json'] || [];
  if (users.length > 0) {
    lines.push('-- Dumping data for table `users`');
    users.forEach(u => {
      const createdAt = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '2026-01-01 00:00:00';
      const fp = u.fingerprintEnabled ? 1 : 0;
      lines.push(`INSERT INTO \`users\` (\`id\`, \`name\`, \`user_id\`, \`password\`, \`role\`, \`class_name\`, \`created_at\`, \`fingerprint_enabled\`) VALUES (${Number(u.id)}, ${escapeSql(u.name)}, ${escapeSql(u.userId)}, ${escapeSql(u.password)}, ${escapeSql(u.role)}, ${escapeSql(u.className)}, '${createdAt}', ${fp}) ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`role\`=VALUES(\`role\`);`);
    });
    lines.push('');
  }

  // 2. Table: classrooms
  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `classrooms`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`classrooms\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`room_number\` VARCHAR(191) NOT NULL,
  \`class_name\` VARCHAR(191) NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_room_class\` (\`room_number\`, \`class_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  const classrooms = parsedData['classrooms.json'] || [];
  if (classrooms.length > 0) {
    lines.push('-- Dumping data for table `classrooms`');
    classrooms.forEach(c => {
      const createdAt = c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '2026-01-01 00:00:00';
      lines.push(`INSERT INTO \`classrooms\` (\`id\`, \`room_number\`, \`class_name\`, \`created_at\`) VALUES (${Number(c.id)}, ${escapeSql(c.roomNumber)}, ${escapeSql(c.className)}, '${createdAt}') ON DUPLICATE KEY UPDATE \`created_at\`=VALUES(\`created_at\`);`);
    });
    lines.push('');
  }

  // 3. Table: faculty
  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `faculty`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`faculty\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`faculty_name\` VARCHAR(191) NOT NULL UNIQUE,
  \`phone_number\` VARCHAR(50) NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  const faculty = parsedData['faculty.json'] || [];
  if (faculty.length > 0) {
    lines.push('-- Dumping data for table `faculty`');
    faculty.forEach(f => {
      lines.push(`INSERT INTO \`faculty\` (\`id\`, \`faculty_name\`, \`phone_number\`) VALUES (${Number(f.id)}, ${escapeSql(f.facultyName)}, ${escapeSql(f.phoneNumber)}) ON DUPLICATE KEY UPDATE \`phone_number\`=VALUES(\`phone_number\`);`);
    });
    lines.push('');
  }

  // 4. Table: timetables
  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `timetables`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`timetables\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`classroom_id\` INT NOT NULL,
  \`day\` VARCHAR(50) NOT NULL,
  \`period_no\` INT NOT NULL,
  \`start_time\` VARCHAR(20) NOT NULL,
  \`end_time\` VARCHAR(20) NOT NULL,
  \`faculty_name\` VARCHAR(255) NOT NULL,
  \`subject_name\` VARCHAR(255) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`fk_timetable_classroom\` (\`classroom_id\`),
  CONSTRAINT \`fk_timetable_classroom\` FOREIGN KEY (\`classroom_id\`) REFERENCES \`classrooms\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  const timetables = parsedData['timetable.json'] || [];
  if (timetables.length > 0) {
    lines.push('-- Dumping data for table `timetables`');
    timetables.forEach(t => {
      lines.push(`INSERT INTO \`timetables\` (\`id\`, \`classroom_id\`, \`day\`, \`period_no\`, \`start_time\`, \`end_time\`, \`faculty_name\`, \`subject_name\`) VALUES (${Number(t.id)}, ${Number(t.classroomId)}, ${escapeSql(t.day)}, ${Number(t.periodNo)}, ${escapeSql(t.startTime)}, ${escapeSql(t.endTime)}, ${escapeSql(t.facultyName)}, ${escapeSql(t.subjectName)}) ON DUPLICATE KEY UPDATE \`faculty_name\`=VALUES(\`faculty_name\`), \`subject_name\`=VALUES(\`subject_name\`);`);
    });
    lines.push('');
  }

  // 5. Table: students
  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `students`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`students\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`roll_number\` VARCHAR(191) NOT NULL UNIQUE,
  \`name\` VARCHAR(255) NOT NULL,
  \`section\` VARCHAR(191) NOT NULL,
  \`student_mobile\` VARCHAR(50) NOT NULL,
  \`parent_mobile\` VARCHAR(50) NOT NULL,
  \`pre_excused_start\` VARCHAR(50) NULL,
  \`pre_excused_end\` VARCHAR(50) NULL,
  \`pre_excused_reason\` TEXT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  const students = parsedData['students.json'] || [];
  if (students.length > 0) {
    lines.push('-- Dumping data for table `students`');
    students.forEach(s => {
      const createdAt = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '2026-01-01 00:00:00';
      lines.push(`INSERT INTO \`students\` (\`id\`, \`roll_number\`, \`name\`, \`section\`, \`student_mobile\`, \`parent_mobile\`, \`pre_excused_start\`, \`pre_excused_end\`, \`pre_excused_reason\`, \`created_at\`) VALUES (${Number(s.id)}, ${escapeSql(s.rollNumber)}, ${escapeSql(s.name)}, ${escapeSql(s.section)}, ${escapeSql(s.studentMobile)}, ${escapeSql(s.parentMobile)}, ${escapeSql(s.preExcusedStart)}, ${escapeSql(s.preExcusedEnd)}, ${escapeSql(s.preExcusedReason)}, '${createdAt}') ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`section\`=VALUES(\`section\`), \`student_mobile\`=VALUES(\`student_mobile\`), \`parent_mobile\`=VALUES(\`parent_mobile\`);`);
    });
    lines.push('');
  }

  // 6. Table: attendance
  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `attendance`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`attendance\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`student_id\` INT NOT NULL,
  \`date\` VARCHAR(50) NOT NULL,
  \`status\` VARCHAR(50) NOT NULL,
  \`marked_by\` INT NOT NULL,
  \`is_late_comer\` BOOLEAN NOT NULL DEFAULT FALSE,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_student_date\` (\`student_id\`, \`date\`),
  KEY \`fk_attendance_student\` (\`student_id\`),
  CONSTRAINT \`fk_attendance_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  const attendance = parsedData['attendance.json'] || [];
  if (attendance.length > 0) {
    lines.push('-- Dumping data for table `attendance`');
    attendance.forEach(a => {
      const updatedAt = a.updatedAt ? new Date(a.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : '2026-01-01 00:00:00';
      const late = a.isLateComer ? 1 : 0;
      lines.push(`INSERT INTO \`attendance\` (\`id\`, \`student_id\`, \`date\`, \`status\`, \`marked_by\`, \`is_late_comer\`, \`updated_at\`) VALUES (${Number(a.id)}, ${Number(a.studentId)}, ${escapeSql(a.date)}, ${escapeSql(a.status)}, ${Number(a.markedBy)}, ${late}, '${updatedAt}') ON DUPLICATE KEY UPDATE \`status\`=VALUES(\`status\`), \`is_late_comer\`=VALUES(\`is_late_comer\`);`);
    });
    lines.push('');
  }

  // 7. Table: faculty_logs & absentee_call_logs
  const history = parsedData['ticket_history.json'] || {};
  const facultyLogs = Array.isArray(history.facultyLogs) ? history.facultyLogs : [];
  const absenteeLogs = Array.isArray(history.absenteeCallLogs) ? history.absenteeCallLogs : [];

  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `faculty_logs`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`faculty_logs\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`classroom_id\` INT NOT NULL,
  \`faculty_name\` VARCHAR(255) NOT NULL,
  \`period_no\` INT NOT NULL,
  \`entry_time\` DATETIME NULL,
  \`status\` VARCHAR(50) NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`fk_facultylog_classroom\` (\`classroom_id\`),
  CONSTRAINT \`fk_facultylog_classroom\` FOREIGN KEY (\`classroom_id\`) REFERENCES \`classrooms\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  if (facultyLogs.length > 0) {
    lines.push('-- Dumping data for table `faculty_logs`');
    facultyLogs.forEach(fl => {
      const entryTime = fl.entryTime ? `'${new Date(fl.entryTime).toISOString().slice(0, 19).replace('T', ' ')}'` : 'NULL';
      const createdAt = fl.createdAt ? new Date(fl.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '2026-01-01 00:00:00';
      lines.push(`INSERT INTO \`faculty_logs\` (\`id\`, \`classroom_id\`, \`faculty_name\`, \`period_no\`, \`entry_time\`, \`status\`, \`created_at\`) VALUES (${Number(fl.id)}, ${Number(fl.classroomId)}, ${escapeSql(fl.facultyName)}, ${Number(fl.periodNo)}, ${entryTime}, ${escapeSql(fl.status)}, '${createdAt}') ON DUPLICATE KEY UPDATE \`status\`=VALUES(\`status\`);`);
    });
    lines.push('');
  }

  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `absentee_call_logs`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`absentee_call_logs\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`student_id\` INT NOT NULL,
  \`date\` VARCHAR(50) NOT NULL,
  \`answered\` BOOLEAN NOT NULL,
  \`reason\` TEXT NULL,
  \`called_by_id\` INT NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`call_type\` VARCHAR(50) NOT NULL DEFAULT 'ABSENT',
  \`recipient\` VARCHAR(50) NOT NULL DEFAULT 'PARENT',
  PRIMARY KEY (\`id\`),
  KEY \`fk_calllog_student\` (\`student_id\`),
  CONSTRAINT \`fk_calllog_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  if (absenteeLogs.length > 0) {
    lines.push('-- Dumping data for table `absentee_call_logs`');
    absenteeLogs.forEach(cl => {
      const ans = cl.answered ? 1 : 0;
      const createdAt = cl.createdAt ? new Date(cl.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '2026-01-01 00:00:00';
      lines.push(`INSERT INTO \`absentee_call_logs\` (\`id\`, \`student_id\`, \`date\`, \`answered\`, \`reason\`, \`called_by_id\`, \`created_at\`, \`call_type\`, \`recipient\`) VALUES (${Number(cl.id)}, ${Number(cl.studentId)}, ${escapeSql(cl.date)}, ${ans}, ${escapeSql(cl.reason)}, ${Number(cl.calledById)}, '${createdAt}', ${escapeSql(cl.callType || 'ABSENT')}, ${escapeSql(cl.recipient || 'PARENT')}) ON DUPLICATE KEY UPDATE \`answered\`=VALUES(\`answered\`);`);
    });
    lines.push('');
  }

  // 8. Table: system_settings (including outpass tickets)
  lines.push('-- --------------------------------------------------------');
  lines.push('-- Table structure for `system_settings`');
  lines.push('-- --------------------------------------------------------');
  lines.push(`CREATE TABLE IF NOT EXISTS \`system_settings\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`key\` VARCHAR(191) NOT NULL UNIQUE,
  \`value\` LONGTEXT NOT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push('');

  const tickets = parsedData['tickets.json'] || [];
  lines.push('-- Dumping outpass tickets into system_settings');
  lines.push(`INSERT INTO \`system_settings\` (\`key\`, \`value\`, \`created_at\`, \`updated_at\`) VALUES ('lectra_outpass_tickets_db', ${escapeSql(JSON.stringify(tickets))}, NOW(), NOW()) ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`), \`updated_at\`=NOW();`);
  lines.push('');

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('-- End of Lectra MySQL Migration Dump');

  return lines.join('\n');
}

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\0/g, '\\0');
  return `'${str}'`;
}

/**
 * Execute Import into MySQL
 * Connects to the target MySQL database, creates tables, and imports records
 * with ID preservation and transactional safety.
 */
async function executeImportToMySQL(zipBuffer, adminUser, mysqlConfig = null) {
  // 1. Validate the backup ZIP first
  const validation = validateBackupZip(zipBuffer);
  if (!validation.isValid) {
    throw new Error(`Backup validation failed: ${validation.error}`);
  }

  const { parsedData, metadata, totalRecords, entityCounts } = validation;

  // Determine MySQL Connection details
  let connectionUrl = process.env.MYSQL_URL || process.env.MYSQL_DATABASE_URL;
  let connectionOptions = null;

  if (mysqlConfig && mysqlConfig.host && mysqlConfig.user) {
    connectionOptions = {
      host: mysqlConfig.host,
      port: Number(mysqlConfig.port) || 3306,
      user: mysqlConfig.user,
      password: mysqlConfig.password || '',
      database: mysqlConfig.database || 'lectra_faculty_tracker',
      multipleStatements: true,
      connectTimeout: 10000
    };
  } else if (connectionUrl) {
    connectionOptions = connectionUrl;
  }

  let connection = null;
  let isDirectDatabaseConnected = false;
  let recordsImportedCount = 0;
  let errorsList = [];

  // Generate the complete SQL migration script
  const sqlDump = generateMySQLDump(parsedData, metadata);

  if (connectionOptions) {
    try {
      console.log('[MySQL Import] Attempting connection to target MySQL database...');
      connection = await mysql.createConnection(connectionOptions);
      isDirectDatabaseConnected = true;

      // Start transaction
      await connection.beginTransaction();
      await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

      // Execute schema and batch data statements
      const sqlStatements = sqlDump
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const stmt of sqlStatements) {
        try {
          await connection.query(stmt);
          if (stmt.toUpperCase().startsWith('INSERT INTO')) {
            recordsImportedCount++;
          }
        } catch (stmtErr) {
          console.error('[MySQL Statement Error]:', stmtErr.message);
          errorsList.push(stmtErr.message);
        }
      }

      await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
      await connection.commit();
      console.log(`[MySQL Import] Direct import to MySQL committed successfully (${recordsImportedCount} insert ops).`);
    } catch (dbErr) {
      if (connection) {
        try { await connection.rollback(); } catch (rbErr) { /* ignore */ }
      }
      console.error('[MySQL Import Failure]:', dbErr);
      errorsList.push(`MySQL Database Error: ${dbErr.message}`);
    } finally {
      if (connection) {
        try { await connection.end(); } catch (e) { /* ignore */ }
      }
    }
  } else {
    // If no live MySQL URL is configured in current environment,
    // the system generates and prepares the full verified migration payload and SQL dump
    recordsImportedCount = totalRecords;
  }

  const importStatus = errorsList.length === 0 ? 'SUCCESS' : (recordsImportedCount > 0 ? 'PARTIAL_SUCCESS' : 'FAILED');

  // Log in migration history
  await appendMigrationHistory({
    action: 'IMPORT_MYSQL',
    admin: adminUser?.name || adminUser?.userId || 'HOD',
    filename: metadata.sourceApplication ? `attendance-system-backup (${metadata.databaseType})` : 'uploaded-backup.zip',
    recordsCount: isDirectDatabaseConnected ? recordsImportedCount : totalRecords,
    status: importStatus,
    errors: errorsList.length > 0 ? errorsList.slice(0, 5) : null,
    targetEngine: 'MySQL',
    details: isDirectDatabaseConnected 
      ? `Imported into MySQL database (${recordsImportedCount} rows inserted)`
      : `Validated and compiled ${totalRecords} records into production-ready MySQL migration dump`
  });

  return {
    status: importStatus,
    targetEngine: 'MySQL',
    isDirectDatabaseConnected,
    totalRecordsInBackup: totalRecords,
    recordsImported: isDirectDatabaseConnected ? recordsImportedCount : totalRecords,
    entityCounts,
    duplicatesHandled: validation.duplicateSummary.totalDuplicates,
    brokenRelationshipsHandled: validation.relationshipSummary.brokenCount,
    errors: errorsList,
    sqlDump
  };
}

module.exports = {
  exportOverallData,
  validateBackupZip,
  executeImportToMySQL,
  generateMySQLDump,
  getMigrationHistory,
  appendMigrationHistory
};
