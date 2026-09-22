const prisma = require('../db');
const XLSX = require('xlsx');
const { getTodayDay, getLocalDayBounds, getWeekdayForDate, STANDARD_PERIODS } = require('../utils/date');

const getLogsReport = async (req, res) => {
  const { classroomId, date, startDate, endDate } = req.query;

  const where = {};

  if (classroomId) {
    where.classroomId = parseInt(classroomId);
  }

  if (date) {
    const { start: startOfDay, end: endOfDay } = getLocalDayBounds(date);
    
    where.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  } else if (startDate && endDate) {
    const { start: startOfRange } = getLocalDayBounds(startDate);
    const { end: endOfRange } = getLocalDayBounds(endDate);

    where.createdAt = {
      gte: startOfRange,
      lte: endOfRange,
    };
  }

  if (req.user && req.user.role === 'SUPER_ADMIN') {
    if (req.query.department && req.query.department !== 'ALL') {
      where.classroom = { department: req.query.department };
    }
  } else if (req.user && req.user.role !== 'WATCHMAN') {
    where.classroom = { department: req.user.department || 'Department of CSE(emerging Technologies)' };
  }

  try {
    const logs = await prisma.facultyLog.findMany({
      where,
      include: {
        classroom: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const enrichedLogs = [];

    for (const log of logs) {
      // Find day name from log date to locate timetable
      const logDay = getWeekdayForDate(log.createdAt);

      const timetable = await prisma.timetable.findFirst({
        where: {
          classroomId: log.classroomId,
          periodNo: log.periodNo,
          day: logDay,
        },
      });

      const periodConfig = STANDARD_PERIODS.find(p => p.periodNo === log.periodNo);
      const timeSlot = timetable 
        ? `${timetable.startTime} - ${timetable.endTime}` 
        : (periodConfig ? `${periodConfig.startTime} - ${periodConfig.endTime}` : 'N/A');
      const subjectName = timetable ? timetable.subjectName : 'Class';

      enrichedLogs.push({
        id: log.id,
        createdAt: log.createdAt,
        classroom: {
          id: log.classroom.id,
          roomNumber: log.classroom.roomNumber,
          className: log.classroom.className,
        },
        facultyName: log.facultyName,
        subjectName: subjectName,
        periodNo: log.periodNo,
        entryTime: log.entryTime,
        status: log.status,
        timeSlot: timeSlot,
      });
    }

    res.json(enrichedLogs);
  } catch (error) {
    console.error('Error fetching logs report:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const { start: startOfToday, end: endOfToday } = getLocalDayBounds();

    let deptFilter = null;
    if (req.user && req.user.role === 'SUPER_ADMIN') {
      if (req.query.department && req.query.department !== 'ALL') {
        deptFilter = req.query.department;
      }
    } else if (req.user && req.user.role !== 'WATCHMAN') {
      deptFilter = req.user.department || 'Department of CSE(emerging Technologies)';
    }

    const classroomWhere = deptFilter ? { department: deptFilter } : {};
    const crWhere = { role: 'CR' };
    if (deptFilter) {
      crWhere.department = deptFilter;
    }

    // Basic counts scoped to department
    const classroomCount = await prisma.classroom.count({ where: classroomWhere });
    const crCount = await prisma.user.count({ where: crWhere });

    // Today's logs counts scoped to department
    const logsWhere = {
      createdAt: {
        gte: startOfToday,
        lte: endOfToday,
      },
    };
    if (deptFilter) {
      logsWhere.classroom = { department: deptFilter };
    }

    const logsToday = await prisma.facultyLog.findMany({
      where: logsWhere,
    });

    const presentCount = logsToday.filter((l) => l.status === 'Present').length;
    const absentCount = logsToday.filter((l) => l.status === 'Not Entered').length;
    const totalLogsToday = logsToday.length;

    let presencePercentage = 100;
    if (totalLogsToday > 0) {
      presencePercentage = Math.round((presentCount / totalLogsToday) * 100);
    }

    // Classroom analytics: detailed presence per class today in this department
    const classrooms = await prisma.classroom.findMany({
      where: classroomWhere,
      include: {
        logs: {
          where: {
            createdAt: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
        },
      },
    });

    const classroomAnalytics = classrooms.map((c) => {
      const total = c.logs.length;
      const present = c.logs.filter((l) => l.status === 'Present').length;
      return {
        className: c.className,
        roomNumber: c.roomNumber,
        department: c.department,
        totalPeriods: total,
        presentPeriods: present,
        percentage: total > 0 ? Math.round((present / total) * 100) : 100,
      };
    });

    // Recent activity feed: last 15 logs scoped to department
    const recentWhere = {};
    if (deptFilter) {
      recentWhere.classroom = { department: deptFilter };
    }

    const recentLogs = await prisma.facultyLog.findMany({
      where: recentWhere,
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        classroom: true,
      },
    });

    const enrichedRecent = [];
    for (const log of recentLogs) {
      const logDay = getWeekdayForDate(log.createdAt);

      const tt = await prisma.timetable.findFirst({
        where: {
          classroomId: log.classroomId,
          periodNo: log.periodNo,
          day: logDay,
        },
      });

      enrichedRecent.push({
        id: log.id,
        createdAt: log.createdAt,
        roomNumber: log.classroom ? log.classroom.roomNumber : 'N/A',
        className: log.classroom ? log.classroom.className : 'N/A',
        facultyName: log.facultyName,
        subjectName: tt ? tt.subjectName : 'N/A',
        periodNo: log.periodNo,
        entryTime: log.entryTime,
        status: log.status,
      });
    }

    res.json({
      stats: {
        classrooms: classroomCount,
        crs: crCount,
        presentToday: presentCount,
        absentToday: absentCount,
        presencePercentage,
      },
      classroomAnalytics,
      recentActivity: enrichedRecent,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const getAbsenteesReport = async (req, res) => {
  const { section, date, startDate, endDate, session } = req.query;

  const whereClause = {
    status: { in: ['Absent', 'Late'] }
  };

  // String-based Date filter (date and date range are YYYY-MM-DD formatted strings in the DB)
  if (date) {
    whereClause.date = date;
  } else if (startDate && endDate) {
    whereClause.date = {
      gte: startDate,
      lte: endDate
    };
  }

  // Section filter
  if (section && section !== 'All') {
    whereClause.student = {
      section: section
    };
  }

  try {
    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        student: true
      },
      orderBy: [
        { date: 'desc' },
        { student: { rollNumber: 'asc' } }
      ]
    });

    // Build call logs where condition
    const callLogWhere = {};
    if (date) {
      callLogWhere.date = date;
    } else if (startDate && endDate) {
      callLogWhere.date = {
        gte: startDate,
        lte: endDate
      };
    }

    const callLogs = await prisma.absenteeCallLog.findMany({
      where: {
        ...callLogWhere,
        callType: 'ABSENT'
      }
    });

    // Map call logs for fast O(1) lookup
    const callLogMap = {};
    callLogs.forEach(cl => {
      callLogMap[`${cl.studentId}_${cl.date}`] = cl;
    });

    // Map user names for fast O(1) lookup of calledById
    const users = await prisma.user.findMany({
      select: { id: true, name: true }
    });
    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = u.name;
    });

    let reportData = attendances.map(att => {
      const s = att.student;
      const callLog = callLogMap[`${att.studentId}_${att.date}`];

      const dateObj = new Date(att.updatedAt);
      const kolkataTimeString = dateObj.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const kolkataDate = new Date(kolkataTimeString);
      const hour = kolkataDate.getHours();
      const attendanceSession = hour >= 12 ? 'afternoon' : 'morning';

      return {
        id: att.id,
        date: att.date,
        rollNumber: s.rollNumber,
        name: s.name,
        section: s.section,
        status: att.status,
        session: attendanceSession,
        studentMobile: s.studentMobile,
        parentMobile: s.parentMobile,
        called: !!callLog,
        answered: callLog ? callLog.answered : null,
        reason: callLog ? (callLog.reason || '') : null,
        calledBy: callLog ? (userMap[callLog.calledById] || 'Unknown') : null,
        calledAt: callLog ? callLog.createdAt : null
      };
    });

    // Filter by session if requested ('morning' or 'afternoon')
    if (session && session !== 'All') {
      const targetSession = session.toLowerCase();
      reportData = reportData.filter(item => item.session === targetSession);
    }

    if (req.query.format === 'excel') {
      const excelRows = reportData.map(item => ({
        'Date': item.date,
        'Session': item.session === 'morning' ? 'Morning' : 'Afternoon',
        'Roll Number': item.rollNumber,
        'Student Name': item.name,
        'Section': item.section,
        'Status': item.status,
        'Student Mobile': item.studentMobile || 'N/A',
        'Parent Mobile': item.parentMobile || 'N/A',
        'Call Placed': item.called ? 'Yes' : 'No',
        'Call Answered': item.called ? (item.answered ? 'Answered' : 'Not Answered') : 'Not Called',
        'Reason for Absence': item.reason || 'N/A',
        'Logged By': item.calledBy || 'N/A'
      }));

      const ws = XLSX.utils.json_to_sheet(excelRows);
      
      const headers = Object.keys(excelRows[0] || {});
      const colWidths = headers.map(header => ({ wch: header.length }));
      
      excelRows.forEach(row => {
        headers.forEach((header, i) => {
          const val = String(row[header] || '');
          if (val.length > colWidths[i].wch) {
            colWidths[i].wch = val.length;
          }
        });
      });
      
      ws['!cols'] = colWidths.map(w => ({ wch: w.wch + 3 }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Absentees Report');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      let filename = 'Absentees_Report';
      if (date) {
        filename += `_${date}`;
      } else if (startDate && endDate) {
        filename += `_${startDate}_to_${endDate}`;
      } else {
        filename += `_${new Date().toISOString().split('T')[0]}`;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Error fetching absentees report:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const getMonthlySectionAttendanceReport = async (req, res) => {
  const { section, month, format } = req.query;

  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const studentWhere = {};
  if (section && section !== 'All') {
    studentWhere.section = section;
  }
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    if (req.query.department && req.query.department !== 'ALL') {
      studentWhere.department = req.query.department;
    }
  } else if (req.user && req.user.role !== 'WATCHMAN') {
    studentWhere.department = req.user.department || 'Department of CSE(emerging Technologies)';
  }

  try {
    const students = await prisma.student.findMany({
      where: studentWhere,
      orderBy: { rollNumber: 'asc' }
    });

    const studentIds = students.map(s => s.id);

    const attendances = await prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: { startsWith: targetMonth }
      },
      orderBy: { date: 'asc' }
    });

    const conductedDates = [...new Set(attendances.map(a => a.date))].sort();

    const attendanceByStudent = {};
    attendances.forEach(att => {
      if (!attendanceByStudent[att.studentId]) {
        attendanceByStudent[att.studentId] = {};
      }
      attendanceByStudent[att.studentId][att.date] = att.status;
    });

    const reportData = students.map(s => {
      const studentAttMap = attendanceByStudent[s.id] || {};
      
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      const dateMatrix = {};
      conductedDates.forEach(d => {
        const st = studentAttMap[d];
        if (st === 'Present') {
          presentCount++;
          dateMatrix[d] = 'P';
        } else if (st === 'Absent') {
          absentCount++;
          dateMatrix[d] = 'A';
        } else if (st === 'Late') {
          lateCount++;
          dateMatrix[d] = 'L';
        } else {
          dateMatrix[d] = '-';
        }
      });

      const totalConducted = conductedDates.length;
      const totalAttended = presentCount + lateCount;
      const percentage = totalConducted > 0 
        ? Math.round((totalAttended / totalConducted) * 100) 
        : 0;

      return {
        id: s.id,
        rollNumber: s.rollNumber,
        name: s.name,
        section: s.section,
        totalConducted,
        presentCount,
        absentCount,
        lateCount,
        totalAttended,
        percentage,
        dateMatrix
      };
    });

    if (format === 'excel') {
      const excelRows = reportData.map((item, idx) => {
        const row = {
          'S.No': idx + 1,
          'Roll Number': item.rollNumber,
          'Student Name': item.name,
          'Section': item.section,
          'Total Working Days': item.totalConducted,
          'Days Present': item.presentCount,
          'Days Late': item.lateCount,
          'Days Absent': item.absentCount,
          'Total Attended': item.totalAttended,
          'Attendance %': `${item.percentage}%`
        };

        conductedDates.forEach(d => {
          const parts = d.split('-');
          const colHeader = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
          row[colHeader] = item.dateMatrix[d] || '-';
        });

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const headers = Object.keys(excelRows[0] || {});
      const colWidths = headers.map(header => ({ wch: Math.max(header.length, 6) }));

      excelRows.forEach(row => {
        headers.forEach((header, i) => {
          const val = String(row[header] || '');
          if (val.length > colWidths[i].wch) {
            colWidths[i].wch = val.length;
          }
        });
      });

      ws['!cols'] = colWidths.map(w => ({ wch: w.wch + 2 }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Attendance');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const cleanSection = (section || 'All').replace(/\s+/g, '_');
      const filename = `Monthly_Attendance_${cleanSection}_${targetMonth}`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    }

    res.json({
      section: section || 'All',
      month: targetMonth,
      totalConductedDays: conductedDates.length,
      conductedDates,
      students: reportData
    });
  } catch (error) {
    console.error('Error fetching monthly section attendance report:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

module.exports = {
  getLogsReport,
  getDashboardStats,
  getAbsenteesReport,
  getMonthlySectionAttendanceReport,
};


