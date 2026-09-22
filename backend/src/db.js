// Automatically construct DATABASE_URL from individual DB_* environment variables if provided
if (process.env.DB_HOST && process.env.DB_USER) {
  const host = process.env.DB_HOST.trim();
  const port = process.env.DB_PORT ? String(process.env.DB_PORT).trim() : '3306';
  const user = encodeURIComponent(process.env.DB_USER.trim());
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const database = process.env.DB_NAME ? process.env.DB_NAME.trim() : 'lectra';
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
} else if (process.env.DATABASE_URL) {
  let url = process.env.DATABASE_URL.trim();
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  } else if (url.startsWith("'") && url.endsWith("'")) {
    url = url.slice(1, -1);
  }
  process.env.DATABASE_URL = url;
}

// Limit connections to 1 for serverless environments (e.g. Vercel) to prevent pool exhaustion
if (process.env.DATABASE_URL && process.env.VERCEL) {
  if (!process.env.DATABASE_URL.includes('connection_limit=')) {
    const separator = process.env.DATABASE_URL.includes('?') ? '&' : '?';
    process.env.DATABASE_URL += `${separator}connection_limit=1`;
  }
}

let PrismaClient;
try {
  PrismaClient = require('@prisma/client').PrismaClient;
} catch (e1) {
  try {
    PrismaClient = require('./generated/client').PrismaClient;
  } catch (e2) {
    console.error('PrismaClient load error:', e1, e2);
    throw e1;
  }
}

let prisma;

if (!global.prisma) {
  global.prisma = new PrismaClient();
}
prisma = global.prisma;

module.exports = prisma;
