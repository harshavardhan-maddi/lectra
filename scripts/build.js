const { execSync } = require('child_process');
const path = require('path');

console.log('[Build Script] Starting build process...');


try {
  // 1. Install Backend Dependencies
  console.log('[Build Script] Step 1: Installing backend dependencies...');
  const backendDir = path.join(__dirname, '../backend');
  execSync('npm install', { cwd: backendDir, stdio: 'inherit' });
  console.log('[Build Script] Backend dependencies installed.');

  // 2. Generate Prisma Client
  console.log('[Build Script] Step 2: Generating Prisma Client...');
  const schemaPath = path.join(backendDir, 'prisma/schema.prisma');
  try {
    execSync(`npx prisma generate --schema="${schemaPath}"`, { cwd: backendDir, stdio: 'inherit' });
  } catch (err) {
    const prismaPath = path.join(backendDir, 'node_modules/prisma/build/index.js');
    execSync(`node "${prismaPath}" generate --schema="${schemaPath}"`, { cwd: backendDir, stdio: 'inherit' });
  }
  console.log('[Build Script] Prisma Client generated successfully.');

  // 3. Install Frontend Dependencies
  console.log('[Build Script] Step 3: Installing frontend dependencies...');
  const frontendDir = path.join(__dirname, '../frontend');
  execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
  console.log('[Build Script] Frontend dependencies installed successfully.');

  // 4. Build Frontend with Vite
  console.log('[Build Script] Step 4: Compiling frontend...');
  try {
    execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
  } catch (err) {
    const vitePath = path.join(frontendDir, 'node_modules/vite/bin/vite.js');
    execSync(`node "${vitePath}" build`, { cwd: frontendDir, stdio: 'inherit' });
  }
  console.log('[Build Script] Frontend built successfully.');

  console.log('[Build Script] Build completed successfully!');
} catch (error) {
  console.error('[Build Script] Build failed:', error);
  process.exit(1);
}
