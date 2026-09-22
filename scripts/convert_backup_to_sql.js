/**
 * Convert Supabase PostgreSQL JSON Backup into High-Performance MySQL Bulk Import Script
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch (e) {
  AdmZip = require('../backend/node_modules/adm-zip');
}

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\0/g, '\\0');
  return `'${str}'`;
}

function formatDate(val) {
  if (!val) return 'NULL';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'NULL';
    return `'${d.toISOString().slice(0, 19).replace('T', ' ')}'`;
  } catch (e) {
    return 'NULL';
  }
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function generateBulkSql(zipFilePath, outputSqlPath) {
  console.log(`[Converter] Reading backup ZIP: ${zipFilePath}...`);
  const zip = new AdmZip(zipFilePath);
  const readJson = (filename) => {
    try {
      const entry = zip.getEntry(filename);
      if (!entry) return [];
      return JSON.parse(zip.readAsText(entry));
    } catch (e) {
      console.warn(`[Converter] Warning: Could not read ${filename}:`, e.message);
      return [];
    }
  };

  const lines = [];

  lines.push('-- ========================================================');
  lines.push('-- High-Performance MySQL Import Script for phpMyAdmin');
  lines.push('-- Converted from Supabase PostgreSQL Backup Archive');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- ========================================================');
  lines.push('');
  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('SET UNIQUE_CHECKS = 0;');
  lines.push('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";');
  lines.push('SET time_zone = "+00:00";');
  lines.push('');

  // Include full DDL schema to ensure tables exist
  const ddlPath = path.join(__dirname, '../backend/prisma/mysql_schema.sql');
  if (fs.existsSync(ddlPath)) {
    const ddl = fs.readFileSync(ddlPath, 'utf8');
    // Strip the trailing SET FOREIGN_KEY_CHECKS = 1; and INSERT statements from DDL
    const ddlClean = ddl.split('-- Default User Accounts')[0];
    lines.push(ddlClean);
    lines.push('');
  }

  // 1. CLASSROOMS
  const classrooms = readJson('classrooms.json');
  console.log(`[Converter] Processing ${classrooms.length} classrooms...`);
  if (classrooms.length > 0) {
    for (const chunk of chunkArray(classrooms, 500)) {
      const rows = chunk.map(c => `(${Number(c.id)}, ${escapeSql(c.roomNumber)}, ${escapeSql(c.className)}, ${formatDate(c.createdAt)})`);
      lines.push(`INSERT INTO \`classrooms\` (\`id\`, \`room_number\`, \`class_name\`, \`created_at\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`room_number\`=VALUES(\`room_number\`), \`class_name\`=VALUES(\`class_name\`);\n`);
    }
  }

  // 2. FACULTY
  const faculty = readJson('faculty.json');
  console.log(`[Converter] Processing ${faculty.length} faculty members...`);
  if (faculty.length > 0) {
    for (const chunk of chunkArray(faculty, 500)) {
      const rows = chunk.map(f => `(${Number(f.id)}, ${escapeSql(f.facultyName)}, ${escapeSql(f.phoneNumber)})`);
      lines.push(`INSERT INTO \`faculty\` (\`id\`, \`faculty_name\`, \`phone_number\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`phone_number\`=VALUES(\`phone_number\`);\n`);
    }
  }

  // 3. USERS
  const users = readJson('users.json');
  console.log(`[Converter] Processing ${users.length} users...`);
  if (users.length > 0) {
    for (const chunk of chunkArray(users, 500)) {
      const rows = chunk.map(u => `(${Number(u.id)}, ${escapeSql(u.name)}, ${escapeSql(u.userId)}, ${escapeSql(u.password)}, ${escapeSql(u.role)}, ${escapeSql(u.className)}, ${formatDate(u.createdAt)}, ${u.fingerprintEnabled ? 1 : 0})`);
      lines.push(`INSERT INTO \`users\` (\`id\`, \`name\`, \`user_id\`, \`password\`, \`role\`, \`class_name\`, \`created_at\`, \`fingerprint_enabled\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`password\`=VALUES(\`password\`), \`role\`=VALUES(\`role\`);\n`);
    }
  }

  // 4. STUDENTS
  const students = readJson('students.json');
  console.log(`[Converter] Processing ${students.length} students...`);
  if (students.length > 0) {
    for (const chunk of chunkArray(students, 500)) {
      const rows = chunk.map(s => `(${Number(s.id)}, ${escapeSql(s.rollNumber)}, ${escapeSql(s.name)}, ${escapeSql(s.section)}, ${escapeSql(s.studentMobile)}, ${escapeSql(s.parentMobile)}, ${escapeSql(s.preExcusedStart)}, ${escapeSql(s.preExcusedEnd)}, ${escapeSql(s.preExcusedReason)}, ${formatDate(s.createdAt)})`);
      lines.push(`INSERT INTO \`students\` (\`id\`, \`roll_number\`, \`name\`, \`section\`, \`student_mobile\`, \`parent_mobile\`, \`pre_excused_start\`, \`pre_excused_end\`, \`pre_excused_reason\`, \`created_at\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`section\`=VALUES(\`section\`), \`student_mobile\`=VALUES(\`student_mobile\`), \`parent_mobile\`=VALUES(\`parent_mobile\`);\n`);
    }
  }

  // 5. TIMETABLE
  const timetables = readJson('timetable.json');
  console.log(`[Converter] Processing ${timetables.length} timetable entries...`);
  if (timetables.length > 0) {
    for (const chunk of chunkArray(timetables, 500)) {
      const rows = chunk.map(t => `(${Number(t.id)}, ${Number(t.classroomId)}, ${escapeSql(t.day)}, ${Number(t.periodNo)}, ${escapeSql(t.startTime)}, ${escapeSql(t.endTime)}, ${escapeSql(t.facultyName)}, ${escapeSql(t.subjectName)})`);
      lines.push(`INSERT INTO \`timetables\` (\`id\`, \`classroom_id\`, \`day\`, \`period_no\`, \`start_time\`, \`end_time\`, \`faculty_name\`, \`subject_name\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`faculty_name\`=VALUES(\`faculty_name\`), \`subject_name\`=VALUES(\`subject_name\`);\n`);
    }
  }

  // 6. ATTENDANCE (49,000+ rows batched into chunks of 500)
  const attendance = readJson('attendance.json');
  console.log(`[Converter] Processing ${attendance.length} attendance records...`);
  if (attendance.length > 0) {
    for (const chunk of chunkArray(attendance, 500)) {
      const rows = chunk.map(a => `(${Number(a.id)}, ${Number(a.studentId)}, ${escapeSql(a.date)}, ${escapeSql(a.status)}, ${Number(a.markedBy)}, ${a.isLateComer ? 1 : 0}, ${formatDate(a.updatedAt)})`);
      lines.push(`INSERT INTO \`attendance\` (\`id\`, \`student_id\`, \`date\`, \`status\`, \`marked_by\`, \`is_late_comer\`, \`updated_at\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`status\`=VALUES(\`status\`), \`is_late_comer\`=VALUES(\`is_late_comer\`);\n`);
    }
  }

  // 7. FACULTY LOGS & ABSENTEE LOGS
  const history = readJson('ticket_history.json');
  const facultyLogs = Array.isArray(history.facultyLogs) ? history.facultyLogs : [];
  console.log(`[Converter] Processing ${facultyLogs.length} faculty logs...`);
  if (facultyLogs.length > 0) {
    for (const chunk of chunkArray(facultyLogs, 500)) {
      const rows = chunk.map(fl => `(${Number(fl.id)}, ${Number(fl.classroomId)}, ${escapeSql(fl.facultyName)}, ${Number(fl.periodNo)}, ${formatDate(fl.entryTime)}, ${escapeSql(fl.status)}, ${formatDate(fl.createdAt)})`);
      lines.push(`INSERT INTO \`faculty_logs\` (\`id\`, \`classroom_id\`, \`faculty_name\`, \`period_no\`, \`entry_time\`, \`status\`, \`created_at\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`status\`=VALUES(\`status\`);\n`);
    }
  }

  const absenteeLogs = Array.isArray(history.absenteeCallLogs) ? history.absenteeCallLogs : [];
  console.log(`[Converter] Processing ${absenteeLogs.length} absentee call logs...`);
  if (absenteeLogs.length > 0) {
    for (const chunk of chunkArray(absenteeLogs, 500)) {
      const rows = chunk.map(al => `(${Number(al.id)}, ${Number(al.studentId)}, ${escapeSql(al.date)}, ${al.answered ? 1 : 0}, ${escapeSql(al.reason)}, ${Number(al.calledById)}, ${formatDate(al.createdAt)}, ${escapeSql(al.callType || 'ABSENT')}, ${escapeSql(al.recipient || 'PARENT')})`);
      lines.push(`INSERT INTO \`absentee_call_logs\` (\`id\`, \`student_id\`, \`date\`, \`answered\`, \`reason\`, \`called_by_id\`, \`created_at\`, \`call_type\`, \`recipient\`) VALUES\n  ${rows.join(',\n  ')}\nON DUPLICATE KEY UPDATE \`answered\`=VALUES(\`answered\`), \`reason\`=VALUES(\`reason\`);\n`);
    }
  }

  // 8. TICKETS
  const tickets = readJson('tickets.json');
  if (tickets.length > 0) {
    lines.push(`INSERT INTO \`system_settings\` (\`key\`, \`value\`, \`created_at\`, \`updated_at\`) VALUES ('lectra_outpass_tickets_db', ${escapeSql(JSON.stringify(tickets))}, NOW(), NOW()) ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`);\n`);
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('SET UNIQUE_CHECKS = 1;');
  lines.push('-- End of MySQL Import Dump');

  const fullSql = lines.join('\n');
  fs.writeFileSync(outputSqlPath, fullSql, 'utf8');
  console.log(`[Converter] Generated SQL: ${outputSqlPath} (${(fullSql.length / (1024 * 1024)).toFixed(2)} MB)`);

  // Also write gzipped version for phpMyAdmin fast import
  const gzipPath = outputSqlPath + '.gz';
  const gzipped = zlib.gzipSync(Buffer.from(fullSql, 'utf8'));
  fs.writeFileSync(gzipPath, gzipped);
  console.log(`[Converter] Generated GZipped SQL for phpMyAdmin: ${gzipPath} (${(gzipped.length / (1024 * 1024)).toFixed(2)} MB)`);

  return { outputSqlPath, gzipPath };
}

// Run for user's download file
const downloadZip = 'c:/Users/maddi/Downloads/attendance-system-backup-2026-09-22.zip';
const outputSql = 'c:/Users/maddi/Downloads/supabase_to_mysql_data.sql';

if (fs.existsSync(downloadZip)) {
  generateBulkSql(downloadZip, outputSql);
} else {
  console.error('File not found:', downloadZip);
}
