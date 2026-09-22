/**
 * Database Auto-Initialization Service
 * Automatically creates all tables and the TE_HOD account if they don't exist yet in MySQL.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const prisma = require('../db');
const bcrypt = require('bcryptjs');

function getMySQLConnectionOptions() {
  if (process.env.DB_HOST && process.env.DB_USER) {
    return {
      host: process.env.DB_HOST.trim(),
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER.trim(),
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME ? process.env.DB_NAME.trim() : 'lectra',
      multipleStatements: true,
      connectTimeout: 15000,
    };
  }

  if (process.env.DATABASE_URL) {
    let url = process.env.DATABASE_URL.trim();
    if (url.startsWith('"') && url.endsWith('"')) url = url.slice(1, -1);
    const sep = url.includes('?') ? '&' : '?';
    return url + `${sep}multipleStatements=true`;
  }

  return null;
}

async function ensureHODAccount() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hodPassword = await bcrypt.hash('HOD_TE', salt);

    await prisma.user.upsert({
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
    console.log('[Auto-Init] Verified TE_HOD user account (Username: TE_HOD, Password: HOD_TE).');
  } catch (err) {
    console.warn('[Auto-Init] Could not verify HOD account via Prisma:', err.message);
  }
}

async function initDatabaseSchema() {
  console.log('[Auto-Init] Checking MySQL database tables...');
  
  let tablesExist = false;
  try {
    await prisma.$queryRaw`SELECT 1 FROM users LIMIT 1`;
    tablesExist = true;
    console.log('[Auto-Init] Database tables exist.');
  } catch (err) {
    // ER_NO_SUCH_TABLE or Prisma P2010 (table doesn't exist)
    tablesExist = false;
    console.log('[Auto-Init] "users" table not found. Auto-creating schema...');
  }

  if (!tablesExist) {
    const schemaPath = path.resolve(__dirname, '../../prisma/mysql_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    const connOptions = getMySQLConnectionOptions();

    if (!connOptions) {
      throw new Error('Database connection credentials not found in environment.');
    }

    const connection = await mysql.createConnection(connOptions);
    try {
      console.log('[Auto-Init] Executing mysql_schema.sql to create all tables...');
      await connection.query(sql);
      console.log('[Auto-Init] SUCCESS: All tables and default accounts created successfully in MySQL!');
    } finally {
      await connection.end();
    }
  }

  // Always ensure TE_HOD credentials are active
  await ensureHODAccount();

  return {
    success: true,
    message: tablesExist
      ? 'Tables were already present; TE_HOD account verified.'
      : 'All database tables and TE_HOD account were created successfully!',
  };
}

module.exports = {
  initDatabaseSchema,
};
