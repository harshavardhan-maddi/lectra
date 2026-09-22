# Lectra 🏫

A production-ready, real-time faculty attendance monitoring platform built using React (Vite), Node.js (Express), PostgreSQL, and Socket.IO.

Class Representatives (CRs) log faculty entry inside classrooms during active timetable periods, which instantly updates the Heads of Departments (HODs) and Sub-Admins dashboards in real-time.

---

## 🛠️ Technology Stack
- **Frontend**: React (Vite), Tailwind CSS (Soft Academic Modern custom palette), Socket.IO Client, Lucide Icons, React Router DOM.
- **Backend**: Node.js, Express.js, Socket.IO, JWT Authentication, BCrypt (Password Hashing), Node-Cron (Background auto-expiry task).
- **ORM**: Prisma Client.
- **Database**: MySQL 8.0+ / MariaDB 10.3+ (configured via Docker Compose, Hostinger hPanel, or local MySQL).

---

## 📂 Folder Structure
```
faculty-tracker/
  ├── package.json               # Root scripts to run both servers concurrently
  ├── server.js                  # Production root entry point (Hostinger / PM2 / Passenger)
  ├── .htaccess                  # LiteSpeed / Apache reverse proxy for Hostinger
  ├── HOSTINGER_DEPLOYMENT.md    # Step-by-step Hostinger deployment instructions
  ├── docker-compose.yml         # Starts MySQL 8.0 container
  ├── backend/
  │    ├── package.json
  │    ├── prisma/
  │    │    ├── schema.prisma    # MySQL Database schema definition
  │    │    ├── mysql_schema.sql # Direct DDL script for phpMyAdmin import
  │    │    └── seed.js          # Pre-fills sandbox DB with schedules & accounts
  │    ├── src/
  │    │    ├── controllers/     # Route business logic
  │    │    ├── middleware/      # JWT authentication and authorization RBAC
  │    │    ├── services/        # Socket connection registry & cron expiry checker
  │    │    ├── routes/          # REST endpoints mapping
  │    │    ├── db.js            # Prisma client wrapper instance
  │    │    └── index.js         # Backend entry point
  │    └── .env.example
  └── frontend/
       ├── package.json
       ├── vite.config.js
       ├── tailwind.config.js    # Customized Soft Academic Modern palette
       ├── index.html
       └── src/
            ├── index.css        # Stylesheet containing glassmorphism classes
            ├── main.jsx
            ├── App.jsx          # Route structures and path resolvers
            ├── components/      # UI components (cards, stats, layout)
            ├── context/         # Auth session context & Socket client context
            └── pages/           # Portals (Login, Admin Dash, CR Dash, Reports)
```

---

## 🚀 Installation & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ or v20+ recommended)
- [Docker & Docker Compose](https://www.docker.com/) (to run MySQL 8 container, or run a local MySQL instance manually).

---

### Step 1: Clone & Configure Databases
If using Docker, run this command in the project root to spin up the MySQL database:
```bash
docker-compose up -d
```
The database will listen on `localhost:3306` with username `user` and password `password123` inside the database `faculty_tracker`.

---

### Step 2: Configure Environment Variables
Verify or edit `backend/.env`. It should resemble the following:
```env
PORT=5000
DATABASE_URL="mysql://root:password@localhost:3306/faculty_tracker"
JWT_SECRET="supersecret_facultytrackerkey_2026"
NODE_ENV=development
```

---

### Step 3: Install All Dependencies
Install backend, frontend, and development packages using the utility script in the root folder:
```bash
npm run install-all
```

---

### Step 4: Run Prisma Migrations & Seed Database
Build the database tables and seed them with classrooms, faculty, users, and full timetables:
```bash
cd backend
npx prisma db push
npm run db:seed
cd ..
```
*Note: `npx prisma db push` will build the schema directly on the MySQL database, and `npm run db:seed` will populate all the required metadata.*

---

### Step 5: Start Development Servers
Run this in the root folder to boot both the Vite development server (port `3000`) and the Node express API server (port `5000`):
```bash
npm run dev
```

---

## 🔑 Sandbox Credentials
To immediately log in and test features, use any of these seeded accounts:

| Role | User ID | Password | Classroom Assigned |
| :--- | :--- | :--- | :--- |
| **HOD** | `hod123` | `password123` | *All* (Access to User Creation & Logs) |
| **Sub Admin** | `subadmin123` | `password123` | *All* (Access to Schedules) |
| **CR (CSE 3rd Yr)** | `cr_cse3` | `password123` | CSE 3rd Year (Room 301) |
| **CR (CSE 4th Yr)** | `cr_cse4` | `password123` | CSE 4th Year (Room 302) |
| **CR (ECE 2nd Yr)** | `cr_ece2` | `password123` | ECE 2nd Year (Room 201) |

---

## 🛡️ Core Rules & Design Implementations

### ⌛ CR Timetable Constraints & Button States
- **Gray Button (Disabled)**: Displays for schedules that occur in the future or past.
- **Yellow Button (Active)**: Enabled during the exact start and end times of the period (e.g. `09:00 - 10:00`). Clicking prompts a confirmation popup.
- **Green Button (Present)**: Changes to this state once presence is marked. The record is written to database logs, and an event is fired via Socket.IO.
- **Red Button/Text (Absent)**: If the active period ends and the CR hasn't marked presence, the status changes to "Not Entered" automatically.

### 🤖 Auto-Status Daemon
A background cron schedule ticks every 60 seconds. It scans the daily timetable slots that have expired. If any completed slots do not have a recorded `FacultyLog` in the database, it inserts a `"Not Entered"` log, issues socket triggers to transition cards to Red on active dashboards, and alerts connected admins.

### 📊 Reports Module
Filters by specific class, faculty member, or date selection. Supports:
1. **Excel/CSV Export**: Offline-ready data compile.
2. **PDF Printing**: Print-optimized media styling that automatically hides filters and sidebars to print elegant tabular records.
