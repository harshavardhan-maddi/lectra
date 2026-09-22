/**
 * Quick script to set/reset HOD credentials
 * Usage: node backend/set_hod.js
 */

const prisma = require('./src/db');
const bcrypt = require('bcryptjs');

async function setHOD() {
  try {
    console.log('[HOD Setup] Configuring HOD credentials...');
    const salt = await bcrypt.genSalt(10);
    const hodPassword = await bcrypt.hash('HOD_TE', salt);

    const user = await prisma.user.upsert({
      where: { userId: 'TE_HOD' },
      update: {
        password: hodPassword,
        role: 'HOD',
        name: 'Dr. Rajesh Sharma (HOD)',
      },
      create: {
        name: 'Dr. Rajesh Sharma (HOD)',
        userId: 'TE_HOD',
        password: hodPassword,
        role: 'HOD',
        className: null,
      },
    });

    console.log('----------------------------------------------------');
    console.log(' SUCCESS: HOD Account Configured Successfully!');
    console.log('   Username : TE_HOD');
    console.log('   Password : HOD_TE');
    console.log('   Role     : HOD');
    console.log('   Database : Connected via DATABASE_URL');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error(' [Error] Failed to set HOD credentials:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setHOD();
