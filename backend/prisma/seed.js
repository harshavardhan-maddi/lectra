const prisma = require('../src/db');
const bcrypt = require('bcryptjs');

async function main() {
  const salt = await bcrypt.genSalt(10);
  const hodPassword = await bcrypt.hash('HOD_TE', salt);

  // Guarantee TE_HOD is set up with HOD_TE credentials
  await prisma.user.upsert({
    where: { userId: 'TE_HOD' },
    update: {
      password: hodPassword,
      role: 'HOD',
      name: 'Dr. Rajesh Sharma',
    },
    create: {
      name: 'Dr. Rajesh Sharma',
      userId: 'TE_HOD',
      password: hodPassword,
      role: 'HOD',
      className: null,
    },
  });
  console.log('[Seeder] TE_HOD credentials set (Username: TE_HOD, Password: HOD_TE)');

  const userCount = await prisma.user.count();
  if (userCount > 1) {
    console.log('[Seeder] Database already contains records. Full seed skipped to protect existing data.');
    return;
  }

  console.log('[Seeder] Seeding default database content...');

  console.log('[Seeder] Seeding default faculties...');
  const faculties = [
    'Dr. Srinivas Rao',
    'Dr. Amit Patel',
    'Prof. Vikram Sen',
    'Prof. Priya Nair',
    'Dr. Sarah Thomas',
  ];
  for (const name of faculties) {
    await prisma.faculty.create({
      data: { facultyName: name },
    });
  }

  console.log('[Seeder] Seeding default classrooms...');
  const classrooms = [
    { roomNumber: 'Room 301', className: 'CSE 3rd Year' },
    { roomNumber: 'Room 302', className: 'CSE 4th Year' },
    { roomNumber: 'Room 201', className: 'ECE 2nd Year' },
  ];
  const createdClassrooms = [];
  for (const c of classrooms) {
    const classroom = await prisma.classroom.create({
      data: c,
    });
    createdClassrooms.push(classroom);
  }

  console.log('[Seeder] Seeding users (HOD, Sub Admin, CRs)...');
  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash('password123', salt);
  const hodPassword = await bcrypt.hash('HOD_TE', salt);

  const users = [
    {
      name: 'Dr. Rajesh Sharma',
      userId: 'TE_HOD',
      password: hodPassword,
      role: 'HOD',
      className: null,
    },
    {
      name: 'Prof. Anjali Verma',
      userId: 'subadmin123',
      password: defaultPassword,
      role: 'SUB_ADMIN',
      className: null,
    },
    {
      name: 'Rahul Kumar',
      userId: 'cr_cse3',
      password: defaultPassword,
      role: 'CR',
      className: 'CSE 3rd Year',
    },
    {
      name: 'Sneha Reddy',
      userId: 'cr_cse4',
      password: defaultPassword,
      role: 'CR',
      className: 'CSE 4th Year',
    },
    {
      name: 'Amit Joshi',
      userId: 'cr_ece2',
      password: defaultPassword,
      role: 'CR',
      className: 'ECE 2nd Year',
    },
    {
      name: 'Absent Controller',
      userId: 'ac123',
      password: defaultPassword,
      role: 'ABSENT_CONTROLLER',
      className: null,
    },
  ];

  for (const u of users) {
    await prisma.user.create({
      data: u,
    });
  }

  console.log('[Seeder] Seeding continuous daily timetables (continuous 1-hour slots from 08:00 to 22:00)...');
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const subjects = [
    'Computer Networks',
    'Database Management Systems',
    'Operating Systems',
    'Software Engineering',
    'Artificial Intelligence',
    'Compiler Design',
    'Digital Electronics',
    'Web Development',
  ];

  const periods = [
    { periodNo: 1, startTime: '08:00', endTime: '09:00' },
    { periodNo: 2, startTime: '09:00', endTime: '10:00' },
    { periodNo: 3, startTime: '10:00', endTime: '11:00' },
    { periodNo: 4, startTime: '11:00', endTime: '12:00' },
    { periodNo: 5, startTime: '12:00', endTime: '13:00' },
    { periodNo: 6, startTime: '13:00', endTime: '14:00' },
    { periodNo: 7, startTime: '14:00', endTime: '15:00' },
    { periodNo: 8, startTime: '15:00', endTime: '16:00' },
    { periodNo: 9, startTime: '16:00', endTime: '17:00' },
    { periodNo: 10, startTime: '17:00', endTime: '18:00' },
    { periodNo: 11, startTime: '18:00', endTime: '19:00' },
    { periodNo: 12, startTime: '19:00', endTime: '20:00' },
    { periodNo: 13, startTime: '20:00', endTime: '21:00' },
    { periodNo: 14, startTime: '21:00', endTime: '22:00' },
  ];

  // For each classroom, create a full weekly schedule with alternating faculties and subjects
  for (let cIdx = 0; cIdx < createdClassrooms.length; cIdx++) {
    const classroom = createdClassrooms[cIdx];
    
    for (const day of daysOfWeek) {
      for (const p of periods) {
        // Deterministic but varying selection of faculty and subject
        const facIdx = (cIdx + day.length + p.periodNo) % faculties.length;
        const subIdx = (cIdx * 2 + day.charCodeAt(0) + p.periodNo) % subjects.length;

        await prisma.timetable.create({
          data: {
            classroomId: classroom.id,
            day,
            periodNo: p.periodNo,
            startTime: p.startTime,
            endTime: p.endTime,
            facultyName: faculties[facIdx],
            subjectName: subjects[subIdx],
          },
        });
      }
    }
  }



  console.log('[Seeder] Completed database seed execution successfully!');
}

main()
  .catch((e) => {
    console.error('[Seeder Error] Failed database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
