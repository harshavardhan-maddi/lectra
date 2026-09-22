const prisma = require('../db');
const { getTodayDay, getCurrentTimeInHHMM, getLocalDayBounds, STANDARD_PERIODS } = require('../utils/date');

const getClassrooms = async (req, res) => {
  try {
    const where = {};
    if (req.user && req.user.role === 'SUPER_ADMIN') {
      if (req.query.department && req.query.department !== 'ALL') {
        where.department = req.query.department;
      }
    } else if (req.user && req.user.role !== 'WATCHMAN') {
      where.department = req.user.department || 'Department of CSE(emerging Technologies)';
    }

    const classrooms = await prisma.classroom.findMany({
      where,
      orderBy: { className: 'asc' },
    });

    // Fetch student counts grouped by section
    const studentCounts = await prisma.student.groupBy({
      by: ['section'],
      _count: {
        id: true,
      },
    });

    const studentCountMap = {};
    studentCounts.forEach((sc) => {
      studentCountMap[sc.section] = sc._count.id;
    });

    const today = getTodayDay();
    const isSunday = today === 'Sunday';

    const trackingSetting = await prisma.systemSetting.findUnique({
      where: { key: 'trackingEnabled' },
    });
    const trackingEnabled = isSunday ? false : (trackingSetting ? trackingSetting.value === 'true' : true);

    if (!trackingEnabled) {
      const holidayResponse = classrooms.map((c) => ({
        id: c.id,
        roomNumber: c.roomNumber,
        className: c.className,
        department: c.department,
        status: 'College is on Holiday',
        currentPeriod: null,
        studentCount: studentCountMap[c.className] || 0,
      }));
      return res.json(holidayResponse);
    }

    const currentTime = getCurrentTimeInHHMM();

    const { start: startOfToday, end: endOfToday } = getLocalDayBounds();

    const logsToday = await prisma.facultyLog.findMany({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    // Find active period configuration from STANDARD_PERIODS
    const activePeriodConfig = STANDARD_PERIODS.find(
      (p) => p.startTime <= currentTime && currentTime < p.endTime
    );

    // Fetch faculty records to attach phone numbers
    const faculties = await prisma.faculty.findMany();
    const facultyPhoneMap = {};
    for (const f of faculties) {
      facultyPhoneMap[f.facultyName] = f.phoneNumber;
    }

    // Fetch timetables for today
    const timetablesToday = await prisma.timetable.findMany({
      where: { day: getTodayDay() },
    });

    const result = [];

    for (const classroom of classrooms) {
      let status = 'No Active Period';
      let currentPeriodInfo = null;

      // Filter logs for this classroom in-memory
      const classroomLogs = logsToday.filter(l => l.classroomId === classroom.id);

      // Filter timetables for this classroom
      const classroomTimetables = timetablesToday.filter(t => t.classroomId === classroom.id);

      if (activePeriodConfig) {
        // Find matching log for the active period
        const log = classroomLogs.find(l => l.periodNo === activePeriodConfig.periodNo);
        const timetable = classroomTimetables.find(t => t.periodNo === activePeriodConfig.periodNo);
        const actualFacultyName = log ? log.facultyName : (timetable ? timetable.facultyName : 'Faculty');
        const actualSubjectName = timetable ? timetable.subjectName : 'Class';

        if (log) {
          status = log.status; // 'Present' or 'Not Entered'
        } else {
          status = 'Pending'; // Active period but not marked yet
        }

        currentPeriodInfo = {
          periodNo: activePeriodConfig.periodNo,
          startTime: activePeriodConfig.startTime,
          endTime: activePeriodConfig.endTime,
          facultyName: actualFacultyName,
          subjectName: actualSubjectName,
          entryTime: log ? log.entryTime : null,
          facultyPhoneNumber: facultyPhoneMap[actualFacultyName] || null,
        };
      } else {
        // Fallback: check the latest completed period today
        const pastPeriods = STANDARD_PERIODS.filter((p) => p.endTime <= currentTime);
        if (pastPeriods.length > 0) {
          const latestPast = pastPeriods[pastPeriods.length - 1];
          const pastLog = classroomLogs.find(l => l.periodNo === latestPast.periodNo);
          const pastTimetable = classroomTimetables.find(t => t.periodNo === latestPast.periodNo);
          const actualPastFacultyName = pastLog ? pastLog.facultyName : (pastTimetable ? pastTimetable.facultyName : 'Faculty');
          const actualPastSubjectName = pastTimetable ? pastTimetable.subjectName : 'Class';

          status = pastLog ? pastLog.status : 'Not Entered';
          currentPeriodInfo = {
            periodNo: latestPast.periodNo,
            startTime: latestPast.startTime,
            endTime: latestPast.endTime,
            facultyName: actualPastFacultyName,
            subjectName: actualPastSubjectName,
            entryTime: pastLog ? pastLog.entryTime : null,
            facultyPhoneNumber: facultyPhoneMap[actualPastFacultyName] || null,
          };
        }
      }

      result.push({
        id: classroom.id,
        roomNumber: classroom.roomNumber,
        className: classroom.className,
        department: classroom.department,
        status,
        currentPeriod: currentPeriodInfo,
        studentCount: studentCountMap[classroom.className] || 0,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const createClassroom = async (req, res) => {
  const { roomNumber, className, department } = req.body;

  if (!roomNumber || !className) {
    return res.status(400).json({ message: 'Room number and class name are required' });
  }

  const assignedDept = (req.user && req.user.role === 'SUPER_ADMIN' && department)
    ? department.trim()
    : ((req.user && req.user.department) || 'Department of CSE(emerging Technologies)');

  try {
    const existing = await prisma.classroom.findUnique({
      where: {
        roomNumber_className: { roomNumber, className },
      },
    });

    if (existing) {
      return res.status(400).json({ message: 'Classroom with this room number and class name already exists' });
    }

    const classroom = await prisma.classroom.create({
      data: { roomNumber, className, department: assignedDept },
    });

    res.status(201).json(classroom);
  } catch (error) {
    console.error('Error creating classroom:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const deleteClassroom = async (req, res) => {
  const { id } = req.params;

  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: parseInt(id) },
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    await prisma.classroom.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Classroom deleted successfully' });
  } catch (error) {
    console.error('Error deleting classroom:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const getClassroomDetails = async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  try {
    const whereLogs = {};

    if (date) {
      const { start: startOfDay, end: endOfDay } = getLocalDayBounds(date);
      whereLogs.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const classroom = await prisma.classroom.findUnique({
      where: { id: parseInt(id) },
      include: {
        timetables: {
          orderBy: [
            { day: 'asc' },
            { periodNo: 'asc' },
          ],
        },
        logs: {
          where: whereLogs,
          orderBy: { createdAt: 'desc' },
          take: 50, // Limit to recent logs
        },
      },
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const studentCount = await prisma.student.count({
      where: { section: classroom.className }
    });

    res.json({
      ...classroom,
      studentCount
    });
  } catch (error) {
    console.error('Error fetching classroom details:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const updateClassroom = async (req, res) => {
  const { id } = req.params;
  const { roomNumber, className } = req.body;

  if (!roomNumber || !className) {
    return res.status(400).json({ message: 'Room number and class name are required' });
  }

  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: parseInt(id) },
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check if another classroom exists with the same roomNumber and className
    const duplicate = await prisma.classroom.findFirst({
      where: {
        roomNumber,
        className,
        NOT: {
          id: parseInt(id),
        },
      },
    });

    if (duplicate) {
      return res.status(400).json({ message: 'Another classroom with this room number and class name already exists' });
    }

    const updated = await prisma.classroom.update({
      where: { id: parseInt(id) },
      data: { roomNumber, className },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating classroom:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

module.exports = {
  getClassrooms,
  createClassroom,
  deleteClassroom,
  getClassroomDetails,
  updateClassroom,
};
