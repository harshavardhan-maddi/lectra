const prisma = require('../db');

// Get all faculty
const getAllFaculty = async (req, res) => {
  try {
    const where = {};
    if (req.user && req.user.role === 'SUPER_ADMIN') {
      if (req.query.department && req.query.department !== 'ALL') {
        where.department = req.query.department;
      }
    } else if (req.user && req.user.role !== 'WATCHMAN') {
      where.department = req.user.department || 'Department of CSE(emerging Technologies)';
    }

    const faculty = await prisma.faculty.findMany({
      where,
      orderBy: { facultyName: 'asc' },
    });
    res.json(faculty);
  } catch (error) {
    console.error('Error fetching faculty:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

// Update or create single faculty
const upsertFaculty = async (req, res) => {
  const { facultyName, phoneNumber, department } = req.body;

  if (!facultyName) {
    return res.status(400).json({ message: 'Faculty name is required' });
  }

  const assignedDept = (req.user && req.user.role === 'SUPER_ADMIN' && department)
    ? department.trim()
    : ((req.user && req.user.department) || 'Department of CSE(emerging Technologies)');

  try {
    const faculty = await prisma.faculty.upsert({
      where: { facultyName },
      update: { phoneNumber, department: assignedDept },
      create: { facultyName, phoneNumber, department: assignedDept },
    });

    res.json(faculty);
  } catch (error) {
    console.error('Error upserting faculty:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

// Bulk update/create faculty
const bulkUpsertFaculty = async (req, res) => {
  const { facultyList, department } = req.body; // Array of { facultyName, phoneNumber }

  if (!facultyList || !Array.isArray(facultyList)) {
    return res.status(400).json({ message: 'Invalid faculty list provided' });
  }

  const assignedDept = (req.user && req.user.role === 'SUPER_ADMIN' && department)
    ? department.trim()
    : ((req.user && req.user.department) || 'Department of CSE(emerging Technologies)');

  try {
    const results = [];
    for (const item of facultyList) {
      if (item.facultyName) {
        const faculty = await prisma.faculty.upsert({
          where: { facultyName: item.facultyName.trim() },
          update: { 
            phoneNumber: item.phoneNumber ? item.phoneNumber.trim() : null,
            department: assignedDept,
          },
          create: { 
            facultyName: item.facultyName.trim(), 
            phoneNumber: item.phoneNumber ? item.phoneNumber.trim() : null,
            department: assignedDept,
          },
        });
        results.push(faculty);
      }
    }

    res.json({ message: `Successfully updated ${results.length} faculty records.`, data: results });
  } catch (error) {
    console.error('Error bulk upserting faculty:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

// Delete faculty
const deleteFaculty = async (req, res) => {
  const { id } = req.params;

  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: parseInt(id) },
    });

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    await prisma.faculty.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Faculty deleted successfully' });
  } catch (error) {
    console.error('Error deleting faculty:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

module.exports = {
  getAllFaculty,
  upsertFaculty,
  bulkUpsertFaculty,
  deleteFaculty,
};
