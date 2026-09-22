if (process.env.DATABASE_URL) {
  let url = process.env.DATABASE_URL.trim();
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  } else if (url.startsWith("'") && url.endsWith("'")) {
    url = url.slice(1, -1);
  }
  
  // Limit connections to 1 for serverless environments (e.g. Vercel) to prevent pool exhaustion
  if (process.env.VERCEL) {
    if (!url.includes('connection_limit=')) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}connection_limit=1`;
    }
  }
  process.env.DATABASE_URL = url;
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
