# Lectra Faculty Tracker - Hostinger Deployment Guide

This guide walks you through deploying the **Lectra Faculty Tracker** on Hostinger using **MySQL**.

---

## Architecture Overview

- **Frontend**: React (Vite, TailwindCSS, Socket.IO Client, PWA)
- **Backend**: Node.js / Express, Socket.IO Server, node-cron
- **Database**: MySQL 8.0+ / MariaDB 10.3+ (managed via Prisma ORM)
- **Deployment Structure**: Express serves the compiled frontend (`frontend/dist`) as static files in production, allowing the complete stack (API, WebSockets, Frontend) to run smoothly on a single domain or port.

---

## 1. Create MySQL Database on Hostinger (hPanel)

1. Log in to your **Hostinger hPanel**.
2. In the sidebar or search bar, navigate to **Databases** > **Management** (or **MySQL Databases**).
3. Under **Create a New MySQL Database and Database User**:
   - **Database Name**: e.g., `u123456789_faculty_tracker`
   - **Username**: e.g., `u123456789_admin`
   - **Password**: Choose a strong password (e.g., `StrongPassword123!`)
4. Click **Create**.
5. Note down your database credentials:
   - **Host**: Usually `localhost` (or the IP listed on your MySQL dashboard)
   - **Port**: `3306`
   - **Database Name**: `u123456789_faculty_tracker`
   - **Username**: `u123456789_admin`
   - **Password**: `StrongPassword123!`

---

## 2. Setting Up Environment Variables

Create or update `.env` in the `backend/` directory (or the project root):

```env
PORT=5000
NODE_ENV=production

# MySQL Database URL
# Format: mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="mysql://u123456789_admin:StrongPassword123!@localhost:3306/u123456789_faculty_tracker"

# Security & Keys
JWT_SECRET="generate_a_random_64_character_hex_or_string"
GROQ_API_KEY="your_groq_api_key_optional"
```

---

## 3. Initializing Database Schema & Seed Data

You have two convenient options to set up the database:

### Option A: Via phpMyAdmin (Easiest - No Terminal Required)
1. In Hostinger hPanel, go to **Databases** > **phpMyAdmin** and click **Enter phpMyAdmin** next to your database.
2. Click the **Import** tab at the top.
3. Click **Choose File** and select:
   `backend/prisma/mysql_schema.sql`
4. Click **Import** at the bottom. All tables, constraints, foreign keys, and indexes will be created instantly.

### Option B: Via Terminal / SSH (Prisma CLI)
If SSH is enabled on your Hostinger plan:
```bash
# Push schema to MySQL
npx prisma db push --schema=backend/prisma/schema.prisma

# Seed default admin accounts (HOD, CRs, sample classrooms, subjects)
npm run db:seed
```

> **Default Seed Accounts Created:**
> - **HOD (Admin)**: User ID `TE_HOD`, Password: `HOD_TE`
> - **Sub Admin**: User ID `subadmin123`, Password: `password123`
> - **Absent Controller**: User ID `ac123`, Password: `password123`
> - **CR 3rd Year**: User ID `cr_cse3`, Password: `password123`
> - **CR 4th Year**: User ID `cr_cse4`, Password: `password123`

---

## 4. Deployment Methods

### Method 1: Hostinger Shared / Cloud Hosting (Node.js App Manager)

If you are using Hostinger Business Web Hosting or Cloud Hosting with Node.js support:

1. **Upload Project**:
   - Go to **File Manager** in hPanel or use Git / FTP to upload the project files into your domain directory (e.g., `public_html` or `/home/u123456789/domains/yourdomain.com/public_html`).
2. **Open Node.js Web Application Manager**:
   - In hPanel, search for **Node.js**.
   - Click **Create Application**.
3. **Configure the Application**:
   - **Node.js version**: Choose `v20.x` or `v18.x`.
   - **Application mode**: `Production`.
   - **Application root**: `public_html` (or your chosen directory).
   - **Application startup file**: `server.js`.
4. **Install Dependencies & Build**:
   - In the Node.js manager, click **NPM Install** or open the **SSH Terminal** in hPanel:
     ```bash
     npm install
     npm run build
     ```
     *(This installs all backend dependencies, generates Prisma client, installs frontend packages, and compiles the React frontend into `frontend/dist`)*.
5. **Start Application**:
   - Click **Start** or **Restart** in the Node.js Manager.
   - Your site will now serve both the React frontend and Express API endpoints seamlessly under your domain!

---

### Method 2: Hostinger VPS (Ubuntu 22.04 / 24.04)

If you are using a Hostinger VPS (KVM):

1. **Connect via SSH**:
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **Install Node.js 20, Git, and MySQL (if not using remote DB)**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git nginx mysql-server
   sudo npm install -g pm2
   ```

3. **Clone and Build the Application**:
   ```bash
   cd /var/www
   git clone <YOUR_GIT_REPO_URL> faculty-tracker
   cd faculty-tracker

   # Install and build everything
   npm install
   npm run build
   ```

4. **Configure Environment File**:
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   # Enter your MySQL credentials and JWT secret, then save (Ctrl+O, Enter, Ctrl+X)
   ```

5. **Initialize Database**:
   ```bash
   npx prisma db push --schema=backend/prisma/schema.prisma
   npm run db:seed
   ```

6. **Start with PM2**:
   ```bash
   pm2 start server.js --name "faculty-tracker"
   pm2 startup
   pm2 save
   ```

7. **Configure Nginx Reverse Proxy with WebSockets**:
   Create `/etc/nginx/sites-available/faculty-tracker`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Enable site and reload:
   ```bash
   sudo ln -s /etc/nginx/sites-available/faculty-tracker /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

8. **Enable Free HTTPS via Certbot**:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

---

## 5. Verifying Deployment Health

- **Health Check Endpoint**: `https://yourdomain.com/health` should return:
  ```json
  {"status":"healthy","timestamp":"2026-..."}
  ```
- **Socket.IO Real-Time Updates**: Check browser developer console (F12) to ensure WebSocket handshake connects without errors.
- **Login Test**: Sign in using `TE_HOD` and password `HOD_TE`.
