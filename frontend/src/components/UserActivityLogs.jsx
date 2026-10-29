import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getActivities, 
  getDistinctUsers, 
  clearActivities, 
  downloadTextReport 
} from '../services/activityLogger';
import logo from '../neclogo.png';
import { 
  FileText, 
  Download, 
  Printer, 
  Search, 
  Calendar, 
  User, 
  Filter, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  Activity,
  Users,
  LogIn,
  LogOut,
  Sparkles
} from 'lucide-react';

const UserActivityLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  
  // Filter states
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [scopeType, setScopeType] = useState('overall'); // 'overall' | 'date'
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const printAreaRef = useRef(null);

  // Load logs
  const refreshLogs = () => {
    setIsRefreshing(true);
    try {
      const activeLogs = getActivities({
        username: selectedUser,
        date: scopeType === 'date' ? selectedDate : 'ALL',
        category: selectedCategory,
        search: searchQuery
      });
      setLogs(activeLogs);
      setUsersList(getDistinctUsers());
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    refreshLogs();

    // Listen to real-time activity events
    const handleNewActivity = () => {
      refreshLogs();
    };
    window.addEventListener('lectra_activity_logged', handleNewActivity);
    return () => {
      window.removeEventListener('lectra_activity_logged', handleNewActivity);
    };
  }, [selectedUser, scopeType, selectedDate, selectedCategory, searchQuery]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const logins = logs.filter(l => l.action === 'LOGIN').length;
    const logouts = logs.filter(l => l.action === 'LOGOUT').length;
    const completedTasks = logs.filter(l => l.completed && l.action !== 'LOGIN' && l.action !== 'LOGOUT').length;
    const uniqueUsers = new Set(logs.map(l => l.username)).size;
    return { total, logins, logouts, completedTasks, uniqueUsers };
  }, [logs]);

  // Handle Download Text Report
  const handleDownloadText = () => {
    downloadTextReport(logs, {
      filterDate: scopeType === 'date' ? selectedDate : 'Overall',
      filterUser: selectedUser === 'ALL' ? 'All Users' : selectedUser,
      generatedBy: `${user?.name || 'Super Admin'} (${user?.role || 'SUPER_ADMIN'})`
    });
  };

  // Handle Print/PDF
  const handlePrint = () => {
    window.print();
  };

  // Clear Logs handler
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all recorded activity logs? This cannot be undone.')) {
      clearActivities();
      setLogs([]);
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <LogIn size={12} />
            <span>LOGIN</span>
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <LogOut size={12} />
            <span>LOGOUT</span>
          </span>
        );
      case 'ADD_STUDENT':
      case 'UPDATE_STUDENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <span>{action === 'ADD_STUDENT' ? 'ADD STUDENT' : 'EDIT STUDENT'}</span>
          </span>
        );
      case 'ADD_FACULTY':
      case 'UPDATE_FACULTY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <span>{action === 'ADD_FACULTY' ? 'ADD FACULTY' : 'EDIT FACULTY'}</span>
          </span>
        );
      case 'APPROVE_OUTPASS':
      case 'GRANT_OUTPASS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-green-100 text-green-800 dark:bg-green-950/70 dark:text-green-300 border border-green-300 dark:border-green-800">
            <CheckCircle2 size={12} />
            <span>APPROVE PASS</span>
          </span>
        );
      case 'SUBMIT_ATTENDANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
            <Activity size={12} />
            <span>ATTENDANCE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <span>{action}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Title Bar */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/10 text-white backdrop-blur-md">
                <ShieldCheck size={22} className="text-emerald-400" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Super Admin • User Activity Audit Trail
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Monitor active logins, administrative actions, completed operations, and logout timestamps across all campus roles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={refreshLogs}
              disabled={isRefreshing}
              className="btn-secondary py-2.5 px-4 text-xs font-bold flex items-center gap-2 text-white bg-white/10 hover:bg-white/20 border-white/20 cursor-pointer"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handlePrint}
              className="btn-secondary py-2.5 px-4 text-xs font-bold flex items-center gap-2 text-white bg-white/10 hover:bg-white/20 border-white/20 cursor-pointer shadow-md"
            >
              <Printer size={15} />
              <span>Print / PDF Report</span>
            </button>
            <button
              onClick={handleDownloadText}
              className="btn-primary py-2.5 px-5 text-xs font-black flex items-center gap-2 shadow-lg shadow-primary/30 cursor-pointer"
            >
              <Download size={15} />
              <span>Download Text Report (.txt)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-customText dark:text-customText-dark">{stats.total}</div>
            <div className="text-[11px] font-bold text-customText-muted uppercase">Total Logs</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <LogIn size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-customText dark:text-customText-dark">{stats.logins}</div>
            <div className="text-[11px] font-bold text-customText-muted uppercase">Logins</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 shrink-0">
            <LogOut size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-customText dark:text-customText-dark">{stats.logouts}</div>
            <div className="text-[11px] font-bold text-customText-muted uppercase">Logouts</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-customText dark:text-customText-dark">{stats.completedTasks}</div>
            <div className="text-[11px] font-bold text-customText-muted uppercase">Tasks Completed</div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Users size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-customText dark:text-customText-dark">{stats.uniqueUsers}</div>
            <div className="text-[11px] font-bold text-customText-muted uppercase">Active Users</div>
          </div>
        </div>
      </div>

      {/* Filter and Query Controls */}
      <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* 1. Scope Type (Overall vs Specific Date) */}
          <div>
            <label className="block text-xs font-black text-customText-muted uppercase tracking-wider mb-1.5">
              Report Scope
            </label>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setScopeType('overall')}
                className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
                  scopeType === 'overall' 
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
                    : 'text-customText-muted hover:text-customText'
                }`}
              >
                Overall (All Time)
              </button>
              <button
                type="button"
                onClick={() => setScopeType('date')}
                className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
                  scopeType === 'date' 
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
                    : 'text-customText-muted hover:text-customText'
                }`}
              >
                Specific Date
              </button>
            </div>
          </div>

          {/* 2. Date Picker (if scope is Date) */}
          <div>
            <label className="block text-xs font-black text-customText-muted uppercase tracking-wider mb-1.5">
              {scopeType === 'date' ? 'Select Activity Date' : 'Active Date Range'}
            </label>
            <input
              type="date"
              disabled={scopeType !== 'date'}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="glass-input text-xs py-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* 3. Filter by User */}
          <div>
            <label className="block text-xs font-black text-customText-muted uppercase tracking-wider mb-1.5">
              Filter By User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="glass-input text-xs py-2 w-full"
            >
              <option value="ALL">All Campus Users ({usersList.length})</option>
              {usersList.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.name} ({u.username} • {u.role})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Action Category */}
          <div>
            <label className="block text-xs font-black text-customText-muted uppercase tracking-wider mb-1.5">
              Action Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="glass-input text-xs py-2 w-full"
            >
              <option value="ALL">All Operations</option>
              <option value="AUTH">Authentication (Logins & Logouts)</option>
              <option value="STUDENTS">Student Modifications</option>
              <option value="FACULTY">Faculty Modifications</option>
              <option value="OUTPASS">Outpass & Approvals</option>
              <option value="ATTENDANCE">Attendance Submissions</option>
              <option value="SYSTEM">System & Cookies</option>
            </select>
          </div>

        </div>

        {/* Search bar & Clear option */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative w-full sm:w-96">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by keywords, details, roll no, emp id..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input text-xs pl-10 pr-3 py-2 w-full"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-bold text-customText-muted">
              Showing <strong className="text-primary">{logs.length}</strong> activity records
            </span>
            <button
              onClick={handleClear}
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-xs flex items-center gap-1 font-bold"
              title="Clear all logs"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Clear Logs</span>
            </button>
          </div>
        </div>

      </div>

      {/* Main Table / Audit Log Feed */}
      <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="responsive-table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-customText-muted uppercase tracking-wider font-extrabold text-[10px]">
                <th className="p-4">Time & Date</th>
                <th className="p-4">User Details</th>
                <th className="p-4">Action Type</th>
                <th className="p-4">What Was Done / Completed Task</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-customText-muted">
                    <AlertCircle size={32} className="mx-auto text-slate-400 mb-2 opacity-60" />
                    <p className="font-bold text-sm">No user activities recorded for the selected filter.</p>
                    <p className="text-xs mt-1">Actions performed by users will appear here automatically.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-500/5 transition-colors">
                    <td className="p-4 whitespace-nowrap font-mono text-[11px]">
                      <div className="font-black text-customText dark:text-customText-dark">{log.time}</div>
                      <div className="text-[10px] text-customText-muted">{log.date}</div>
                    </td>

                    <td className="p-4">
                      <div className="font-black text-customText dark:text-customText-dark">
                        {log.name}
                      </div>
                      <div className="text-[10px] text-customText-muted font-mono">
                        {log.username} • <span className="font-bold text-primary">{log.role}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium">
                        {log.department}
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="p-4">
                      <p className="font-medium text-customText dark:text-customText-dark leading-relaxed">
                        {log.details}
                      </p>
                    </td>

                    <td className="p-4 whitespace-nowrap text-center">
                      {log.completed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 size={12} />
                          <span>DONE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <Clock size={12} />
                          <span>ACTIVE</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT-ONLY OFFICIAL AUDIT REPORT WITH COLLEGE LOGO & WATERMARK */}
      <div 
        id="printable-audit-report" 
        ref={printAreaRef} 
        className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans z-[99999]"
      >
        {/* Official College Logo Watermark in Background */}
        <div 
          aria-hidden="true" 
          className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 opacity-[0.08] select-none"
        >
          <img src={logo} alt="Watermark" className="w-[500px] h-[500px] object-contain -rotate-12 filter grayscale" />
        </div>

        {/* Printable Content */}
        <div className="relative z-10 space-y-4">
          
          {/* Header */}
          <div className="border-b-2 border-black pb-4 text-center">
            <div className="flex items-center justify-between gap-4">
              <img src={logo} alt="NEC Logo" className="w-20 h-20 object-contain" />
              <div className="flex-1 text-center">
                <h1 className="text-xl font-black uppercase tracking-tight text-black">
                  Narasaraopeta Engineering College
                </h1>
                <p className="text-xs font-black uppercase text-slate-800 mt-0.5">
                  (AUTONOMOUS) • Approved by AICTE, New Delhi & Permanently Affiliated to JNTUK
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Accredited by NAAC with 'A+' Grade • ISO 9001:2008 Certified Institution<br />
                  Kotappakonda Road, Yellamanda (P.O), Narasaraopet - 522601, Palnadu Dist., A.P.
                </p>
              </div>
              <div className="w-20" />
            </div>

            <div className="mt-3 pt-2 border-t border-slate-300 flex justify-between items-center text-xs font-bold font-mono">
              <span>REPORT: USER ACTIVITY & CAMPUS AUDIT TRAIL</span>
              <span>SCOPE: {scopeType === 'date' ? `Date: ${selectedDate}` : 'Overall History'}</span>
              <span>USER: {selectedUser === 'ALL' ? 'All Users' : selectedUser}</span>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="border-b-2 border-black text-black uppercase font-black">
                <th className="py-2 px-1">Timestamp</th>
                <th className="py-2 px-1">User & Role</th>
                <th className="py-2 px-1">Action</th>
                <th className="py-2 px-1">Details & Activity Completed</th>
                <th className="py-2 px-1 text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-1.5 px-1 font-mono">{log.date} {log.time}</td>
                  <td className="py-1.5 px-1 font-bold">{log.name} ({log.username} • {log.role})</td>
                  <td className="py-1.5 px-1 font-mono font-bold uppercase">{log.action}</td>
                  <td className="py-1.5 px-1">{log.details}</td>
                  <td className="py-1.5 px-1 text-right font-bold font-mono">{log.completed ? 'COMPLETED' : 'ACTIVE'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signatures */}
          <div className="pt-10 flex justify-between items-center text-xs font-bold">
            <div>
              <p>Verified by System Audit Daemon</p>
              <p className="text-[10px] text-slate-500">Date Generated: {new Date().toLocaleString()}</p>
            </div>
            <div className="text-right">
              <div className="h-10" />
              <p className="border-t border-black pt-1">Authorised Signatory / Super Administrator</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default UserActivityLogs;
