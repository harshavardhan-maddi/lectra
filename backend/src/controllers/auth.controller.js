const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');

const WATCHMAN_SETTINGS_KEY = 'custom_watchman_accounts';

const getWatchmanAccounts = async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: WATCHMAN_SETTINGS_KEY }
    });
    if (!setting || !setting.value) return [];
    return JSON.parse(setting.value);
  } catch (err) {
    console.error('Error reading watchman accounts:', err);
    return [];
  }
};

const saveWatchmanAccounts = async (accounts) => {
  try {
    await prisma.systemSetting.upsert({
      where: { key: WATCHMAN_SETTINGS_KEY },
      update: { value: JSON.stringify(accounts) },
      create: { key: WATCHMAN_SETTINGS_KEY, value: JSON.stringify(accounts) }
    });
  } catch (err) {
    console.error('Error saving watchman accounts:', err);
  }
};

const login = async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ message: 'User ID and password are required' });
  }

  try {
    // 1. Check custom watchman accounts created by HOD
    const watchmen = await getWatchmanAccounts();
    const matchedWatchman = watchmen.find(w => w.userId.toLowerCase() === userId.toLowerCase());
    
    if (matchedWatchman) {
      let isMatch = false;
      if (matchedWatchman.password.startsWith('$2a$') || matchedWatchman.password.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, matchedWatchman.password);
      } else {
        isMatch = matchedWatchman.password === password;
      }

      if (isMatch) {
        const token = jwt.sign(
          {
            id: matchedWatchman.id,
            userId: matchedWatchman.userId,
            role: 'WATCHMAN',
            name: matchedWatchman.name,
            className: null,
          },
          process.env.JWT_SECRET || 'supersecret_facultytrackerkey_2026',
          { expiresIn: '24h' }
        );
        return res.json({
          token,
          user: {
            id: matchedWatchman.id,
            userId: matchedWatchman.userId,
            name: matchedWatchman.name,
            role: 'WATCHMAN',
            className: null,
          },
        });
      } else {
        return res.status(401).json({ message: 'Invalid User ID or password' });
      }
    }

    // 2. Check default watchman / security head credentials fallback
    if (userId.toLowerCase() === 'watchman' || userId.toLowerCase() === 'security' || userId.toLowerCase() === 'gate' || userId.toLowerCase() === 'securityhead' || userId.toLowerCase() === 'security_head') {
      if (password === 'watchman' || password === 'watchman123' || password === 'security123' || password === 'password123' || password === 'gate123' || password === 'securityhead') {
        const defaultWatchman = {
          id: 9999,
          userId: 'securityhead',
          name: 'Main Campus Security Head',
          role: 'SECURITY_HEAD',
          className: null,
        };
        const token = jwt.sign(
          defaultWatchman,
          process.env.JWT_SECRET || 'supersecret_facultytrackerkey_2026',
          { expiresIn: '24h' }
        );
        return res.json({ token, user: defaultWatchman });
      }
    }

    // 3. Check regular users in database
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid User ID or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid User ID or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        userId: user.userId,
        role: user.role,
        name: user.name,
        className: user.className,
        department: user.department || (user.role === 'SUPER_ADMIN' || user.role === 'WATCHMAN' ? null : 'Department of CSE(emerging Technologies)'),
      },
      process.env.JWT_SECRET || 'supersecret_facultytrackerkey_2026',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        role: user.role,
        className: user.className,
        department: user.department || (user.role === 'SUPER_ADMIN' || user.role === 'WATCHMAN' ? null : 'Department of CSE(emerging Technologies)'),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error', errorDetail: String(error) });
  }
};

const register = async (req, res) => {
  const { name, userId, password, className, role, department } = req.body;

  if (!name || !userId || !password || !role) {
    return res.status(400).json({ message: 'All fields except class_name (for HOD/Sub Admin/Security Head) are required' });
  }

  // Non-super-admins cannot register SUPER_ADMIN, WATCHMAN, or SECURITY_HEAD
  if (req.user.role !== 'SUPER_ADMIN' && (role === 'SUPER_ADMIN' || role === 'WATCHMAN' || role === 'SECURITY_HEAD')) {
    return res.status(403).json({ message: 'You do not have permission to register this role' });
  }

  // Determine user department based on creator authority
  let userDepartment = null;
  if (role === 'WATCHMAN' || role === 'SECURITY_HEAD') {
    userDepartment = null;
  } else if (req.user.role === 'SUPER_ADMIN') {
    // Super Admin can assign or create any department
    userDepartment = department && department.trim() ? department.trim() : (role === 'SUPER_ADMIN' ? null : 'Department of CSE(emerging Technologies)');
    
    // If a new department was entered, track it in system settings
    if (userDepartment) {
      try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'known_departments' } });
        const list = setting ? JSON.parse(setting.value || '[]') : ['Department of CSE(emerging Technologies)'];
        if (!list.includes(userDepartment)) {
          list.push(userDepartment);
          await prisma.systemSetting.upsert({
            where: { key: 'known_departments' },
            update: { value: JSON.stringify(list) },
            create: { key: 'known_departments', value: JSON.stringify(list) },
          });
        }
      } catch (e) {}
    }
  } else {
    // HOD or Sub-Admin can ONLY create users bound to their own department
    userDepartment = req.user.department || 'Department of CSE(emerging Technologies)';
  }

  try {
    // Check if user ID already exists in watchmen or DB
    const watchmen = await getWatchmanAccounts();
    if (watchmen.some(w => w.userId.toLowerCase() === userId.toLowerCase())) {
      return res.status(400).json({ message: 'User ID already exists' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { userId },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User ID already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Support SECURITY_HEAD / WATCHMAN role registered by HOD/Super Admin
    if (role === 'WATCHMAN' || role === 'SECURITY_HEAD') {
      const newWatchman = {
        id: 90000 + Math.floor(Math.random() * 9000),
        name,
        userId,
        password: hashedPassword,
        role: 'SECURITY_HEAD',
        className: null,
        department: null,
        createdAt: new Date().toISOString(),
      };

      watchmen.unshift(newWatchman);
      await saveWatchmanAccounts(watchmen);

      return res.status(201).json({
        message: 'Campus Security Head user created successfully',
        user: {
          id: newWatchman.id,
          userId: newWatchman.userId,
          name: newWatchman.name,
          role: 'WATCHMAN',
          className: null,
          department: null,
        },
      });
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        userId,
        password: hashedPassword,
        role,
        className: role === 'CR' ? className : null, // Class Name is relevant only for CRs
        department: userDepartment,
      },
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        userId: newUser.userId,
        name: newUser.name,
        role: newUser.role,
        className: newUser.className,
        department: newUser.department,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const numId = parseInt(id);

  try {
    // Check if watchman user
    const watchmen = await getWatchmanAccounts();
    const watchmanIndex = watchmen.findIndex(w => w.id === numId);
    if (watchmanIndex >= 0) {
      watchmen.splice(watchmanIndex, 1);
      await saveWatchmanAccounts(watchmen);
      return res.json({ message: 'Watchman user deleted successfully' });
    }

    const user = await prisma.user.findUnique({
      where: { id: numId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.userId === req.user.userId) {
      return res.status(400).json({ message: 'You cannot delete your own logged-in account' });
    }

    // Protection: only Super Admin can delete Super Admin or HOD accounts
    if ((user.role === 'SUPER_ADMIN' || user.role === 'HOD') && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only a Super Admin can delete HOD or Super Admin accounts' });
    }

    // Protection: HOD can only delete users in their own department
    if (req.user.role !== 'SUPER_ADMIN' && user.department !== req.user.department) {
      return res.status(403).json({ message: 'You can only manage users within your own department' });
    }

    await prisma.user.delete({
      where: { id: numId },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const numId = parseInt(id);
  const { name, role, className, password } = req.body;

  try {
    // Check if watchman account
    const watchmen = await getWatchmanAccounts();
    const watchmanIndex = watchmen.findIndex(w => w.id === numId);
    if (watchmanIndex >= 0) {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Only a Super Admin can modify watchman accounts' });
      }
      if (name) watchmen[watchmanIndex].name = name;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        watchmen[watchmanIndex].password = await bcrypt.hash(password, salt);
      }
      await saveWatchmanAccounts(watchmen);
      return res.json({ message: 'Watchman account updated successfully', user: watchmen[watchmanIndex] });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: numId },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Protection: only Super Admin can modify other HOD or Super Admin accounts
    if ((existingUser.role === 'SUPER_ADMIN' || existingUser.role === 'HOD') && req.user.role !== 'SUPER_ADMIN' && req.user.id !== numId) {
      return res.status(403).json({ message: 'Only a Super Admin can modify other HOD or Super Admin accounts' });
    }

    // Protection: HOD can only modify users in their own department
    if (req.user.role !== 'SUPER_ADMIN' && existingUser.department !== req.user.department) {
      return res.status(403).json({ message: 'You can only manage users within your own department' });
    }

    const updateData = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (role) {
      if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Only a Super Admin can assign the Super Admin role' });
      }
      if (req.user.role !== 'SUPER_ADMIN' && role !== existingUser.role) {
        return res.status(403).json({ message: 'You cannot change your own role' });
      }
      updateData.role = role;
    }
    if (className !== undefined) updateData.className = className;
    if (req.body.department !== undefined && req.user.role === 'SUPER_ADMIN') {
      updateData.department = req.body.department ? req.body.department.trim() : null;
    }
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: numId },
      data: updateData,
      select: {
        id: true,
        name: true,
        userId: true,
        role: true,
        className: true,
        department: true,
        createdAt: true,
      },
    });

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

const getUsers = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'SUPER_ADMIN') {
      if (req.query.department && req.query.department !== 'ALL') {
        where.department = req.query.department;
      }
    } else {
      // HOD and Sub-Admins only see users in their own department
      where.department = req.user.department || 'Department of CSE(emerging Technologies)';
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        userId: true,
        role: true,
        className: true,
        department: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Watchmen are campus-wide and only visible to Super Admin viewing all departments
    let combined = [...users];
    if (req.user.role === 'SUPER_ADMIN' && (!req.query.department || req.query.department === 'ALL')) {
      const watchmen = await getWatchmanAccounts();
      const formattedWatchmen = watchmen.map(w => ({
        id: w.id,
        name: w.name,
        userId: w.userId,
        role: 'SECURITY_HEAD',
        className: null,
        department: null,
        createdAt: w.createdAt || new Date().toISOString(),
      }));
      combined = [...users, ...formattedWatchmen];
    }

    res.json(combined);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getDepartments = async (req, res) => {
  try {
    const deptsSet = new Set(['Department of CSE(emerging Technologies)']);
    
    // Find distinct departments from users, faculty, students, classrooms
    const [userDepts, facultyDepts, studentDepts, classroomDepts] = await Promise.all([
      prisma.user.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ['department'] }),
      prisma.faculty.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ['department'] }),
      prisma.student.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ['department'] }),
      prisma.classroom.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ['department'] }),
    ]);

    [...userDepts, ...facultyDepts, ...studentDepts, ...classroomDepts].forEach(d => {
      if (d.department && d.department.trim()) {
        deptsSet.add(d.department.trim());
      }
    });

    res.json(Array.from(deptsSet).filter(Boolean).sort());
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const me = async (req, res) => {
  try {
    if (req.user.role === 'WATCHMAN') {
      return res.json({
        id: req.user.id,
        name: req.user.name,
        userId: req.user.userId,
        role: 'WATCHMAN',
        className: null,
        department: null,
        createdAt: new Date().toISOString(),
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        userId: true,
        role: true,
        className: true,
        department: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const updateProfile = async (req, res) => {
  const { name, userId, password } = req.body;
  const currentUserId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {};

    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    if (userId && userId !== user.userId) {
      const existing = await prisma.user.findUnique({
        where: { userId },
      });
      if (existing) {
        return res.status(400).json({ message: 'User ID is already taken' });
      }
      updateData.userId = userId;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUserId },
      data: updateData,
    });

    const token = jwt.sign(
      {
        id: updatedUser.id,
        userId: updatedUser.userId,
        role: updatedUser.role,
        name: updatedUser.name,
        className: updatedUser.className,
        department: updatedUser.department,
      },
      process.env.JWT_SECRET || 'supersecret_facultytrackerkey_2026',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Profile updated successfully',
      token,
      user: {
        id: updatedUser.id,
        userId: updatedUser.userId,
        name: updatedUser.name,
        role: updatedUser.role,
        className: updatedUser.className,
        department: updatedUser.department,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  login,
  register,
  deleteUser,
  updateUser,
  getUsers,
  getDepartments,
  me,
  updateProfile,
};
