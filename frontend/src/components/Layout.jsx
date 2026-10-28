import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import logo from '../neclogo.png';
import { 
  LayoutDashboard, 
  CalendarDays, 
  FileSpreadsheet, 
  Users, 
  LogOut, 
  Sun, 
  Moon, 
  Bell, 
  Globe, 
  Menu, 
  X, 
  Clock,
  UserCheck,
  Settings,
  ShieldCheck,
  GraduationCap,
  AlertCircle,
  Database,
  UserX,
  DoorOpen,
  CheckCircle2,
  PhoneCall,
  Calendar,
  FileText
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, token, logout, updateProfile, selectedDepartment, setSelectedDepartment, getDepartmentsList } = useAuth();
  const { onlineCount, onlineUsers, notifications, clearNotifications } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && getDepartmentsList) {
      getDepartmentsList().then((d) => {
        if (Array.isArray(d)) setDepartments(d);
      });
    }
  }, [user]);

  // Per-user theme key so toggling dark mode doesn't affect other logins
  const themeKey = `theme_${user?.id || user?.userId || 'default'}`;
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem(themeKey) === 'dark' || 
    (!localStorage.getItem(themeKey) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [onlineListOpen, setOnlineListOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Department Classrooms for strict online user isolation
  const [layoutClassrooms, setLayoutClassrooms] = useState([]);
  useEffect(() => {
    const currentToken = token || localStorage.getItem('token');
    if (user?.role === 'HOD' && currentToken) {
      fetch('/api/classrooms', { headers: { Authorization: `Bearer ${currentToken}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setLayoutClassrooms(data);
        })
        .catch(() => {});
    }
  }, [user?.role, token]);

  // Online users strictly scoped: Super Admin sees all departments/users; HOD sees ONLY their department
  const displayedOnlineUsers = React.useMemo(() => {
    const safeOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
    if (user?.role === 'SUPER_ADMIN') {
      return safeOnlineUsers;
    }
    if (user?.role === 'HOD') {
      const userDept = (user?.department || '').trim().toLowerCase();
      const deptClassNames = (layoutClassrooms || [])
        .filter(c => !user?.department || c.department === user?.department)
        .map(c => (c.className || '').toLowerCase());

      return safeOnlineUsers.filter(u => {
        if (!u) return false;
        if (u.department && u.department.toLowerCase() === userDept) return true;
        if (u.className) {
          const cleanClass = u.className.toLowerCase();
          if (deptClassNames.includes(cleanClass)) return true;
          if (userDept.includes('cse') && (cleanClass.includes('cse') || cleanClass.includes('csm') || cleanClass.includes('csd') || cleanClass.includes('cso') || cleanClass.includes('ai'))) return true;
          if (userDept.includes('ece') && cleanClass.includes('ece')) return true;
          if (userDept.includes('eee') && cleanClass.includes('eee')) return true;
          if (userDept.includes('mech') && cleanClass.includes('mech')) return true;
          if (userDept.includes('civil') && cleanClass.includes('civil')) return true;
          if (userDept.includes('it') && cleanClass.includes('it')) return true;
        }
        if (u.name && u.name.trim().toLowerCase() === (user?.name || '').trim().toLowerCase()) return true;
        return false;
      });
    }
    return [];
  }, [user, onlineUsers, layoutClassrooms]);

  const displayedOnlineCount = displayedOnlineUsers.length;

  // Profile Edit Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileUserId, setProfileUserId] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Sync profile details when user loads or modal opens
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileUserId(user.userId);
    }
  }, [user, showProfileModal]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileSubmitting(true);

    try {
      await updateProfile(profileName, profileUserId, profilePassword || undefined);
      setProfileSuccess('Profile updated successfully!');
      setProfilePassword('');
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileSuccess('');
      }, 1500);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Handle live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(themeKey, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(themeKey, 'light');
    }
  }, [darkMode, themeKey]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [];
  if (user?.role === 'SUPER_ADMIN') {
    navLinks.push(
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Student Registry', path: '/students', icon: GraduationCap },
      { name: 'Absentees Tracking', path: '/absentees', icon: AlertCircle },
      { name: 'Outpass Approvals', path: '/outpasses', icon: FileText },
      { name: 'Manage All Users', path: '/users', icon: Users },
      { name: 'Classrooms', path: '/classrooms', icon: CalendarDays },
      { name: 'Faculty Contacts', path: '/faculty', icon: UserCheck },
      { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
      { name: 'Gate Exit Clearance', path: '/watchman-dashboard', icon: DoorOpen },
      { name: 'Gate Exit History', path: '/watchman-dashboard?tab=exitHistory', icon: CheckCircle2 },
      { name: 'AO Portal (HOD Leaves)', path: '/ao-dashboard', icon: ShieldCheck },
      { name: 'Office Certificates', path: '/office-dashboard', icon: FileText },
      { name: 'Section Absentees', path: '/absent-controller', icon: Users },
      { name: 'All Section Absentees', path: '/absent-controller?tab=allSections', icon: AlertCircle },
      { name: 'Student Outpasses', path: '/absent-controller?tab=outpassRequests', icon: FileText },
      { name: 'Attendance Registry', path: '/faculty-dashboard', icon: UserCheck },
      { name: 'Parent Call Logs', path: '/faculty-dashboard?tab=calls', icon: PhoneCall },
      { name: 'Faculty Permissions', path: '/faculty-dashboard?tab=leaves', icon: Calendar },
      { name: 'Data Backup', path: '/backup', icon: Database },
      { name: 'Attendance Timings', path: '/settings?tab=timings', icon: Clock },
      { name: 'Fingerprint Settings', path: '/settings', icon: Settings },
      { name: 'Attendance Overrides', path: '/settings?tab=overrides', icon: ShieldCheck }
    );
  } else if (user?.role === 'HOD' || user?.role === 'SUB_ADMIN') {
    navLinks.push(
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Student Registry', path: '/students', icon: GraduationCap },
      { name: 'Absentees Tracking', path: '/absentees', icon: AlertCircle },
      { name: 'Outpass Approvals', path: '/outpasses', icon: FileText },
      { name: 'Faculty Permissions', path: '/faculty-dashboard?tab=leaves', icon: Calendar },
      { name: 'Classrooms', path: '/classrooms', icon: CalendarDays },
      { name: 'Faculty Contacts', path: '/faculty', icon: UserCheck },
      { name: 'Reports', path: '/reports', icon: FileSpreadsheet }
    );
    if (user?.role === 'HOD') {
      navLinks.push({ name: 'Manage Users', path: '/users', icon: Users });
      navLinks.push({ name: 'Data Backup', path: '/backup', icon: Database });
    }
    navLinks.push(
      { name: 'Attendance Timings', path: '/settings?tab=timings', icon: Clock },
      { name: 'Fingerprint Settings', path: '/settings', icon: Settings },
      { name: 'Attendance Overrides', path: '/settings?tab=overrides', icon: ShieldCheck }
    );
  } else if (user?.role === 'CR') {
    navLinks.push(
      { name: 'Faculty Schedule', path: '/cr-dashboard', icon: CalendarDays },
      { name: 'Student Attendance', path: '/cr-dashboard?tab=students', icon: Users }
    );
  } else if (user?.role === 'ABSENT_CONTROLLER') {
    navLinks.push(
      { name: 'Section Absentees', path: '/absent-controller', icon: Users },
      { name: 'All Absentees', path: '/absent-controller?tab=allSections', icon: AlertCircle },
      { name: 'Outpass Requests', path: '/absent-controller?tab=outpassRequests', icon: FileText },
      { name: 'Attendance Reports', path: '/reports', icon: FileSpreadsheet },
      { name: 'Attendance Overrides', path: '/settings?tab=overrides', icon: ShieldCheck }
    );
  } else if (user?.role === 'FACULTY') {
    // Check if faculty is non-teaching
    let isNonTeaching = user?.facultyType === 'NON_TEACHING';
    if (!isNonTeaching) {
      try {
        const metaList = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
        const meta = metaList.find(m => 
          (m.empid && String(m.empid).toLowerCase() === String(user?.userId).toLowerCase()) ||
          (m.name && String(m.name).trim().toLowerCase() === String(user?.name).trim().toLowerCase())
        );
        if (meta && meta.facultyType === 'NON_TEACHING') {
          isNonTeaching = true;
        }
      } catch (e) {}
    }

    if (isNonTeaching) {
      // Non-teaching faculty can ONLY apply permissions, cannot take attendance or make calls
      navLinks.push(
        { name: 'Faculty Permissions', path: '/faculty-dashboard?tab=leaves', icon: Calendar }
      );
    } else {
      navLinks.push(
        { name: 'Attendance Registry', path: '/faculty-dashboard', icon: UserCheck },
        { name: 'Parent Call Logs', path: '/faculty-dashboard?tab=calls', icon: PhoneCall },
        { name: 'Faculty Permissions', path: '/faculty-dashboard?tab=leaves', icon: Calendar },
        { name: 'Class Mentorship', path: '/faculty-dashboard?tab=mentor', icon: GraduationCap }
      );
    }
  } else if (user?.role === 'AO') {
    navLinks.push(
      { name: 'AO Portal', path: '/ao-dashboard', icon: ShieldCheck },
      { name: 'Pending Leaves', path: '/ao-dashboard?tab=PENDING', icon: Clock },
      { name: 'Security Cleared', path: '/ao-dashboard?tab=GRANTED', icon: DoorOpen }
    );
  } else if (user?.role === 'OFFICE') {
    navLinks.push(
      { name: 'Certificates Portal', path: '/office-dashboard', icon: FileText },
      { name: 'Pending Requests', path: '/office-dashboard?tab=PENDING', icon: Clock },
      { name: 'Ready for Collection', path: '/office-dashboard?tab=READY', icon: CheckCircle2 }
    );
  } else if (user?.role === 'WATCHMAN' || user?.role === 'SECURITY_HEAD') {
    navLinks.push(
      { name: 'Gate Exit Clearance', path: '/watchman-dashboard', icon: DoorOpen },
      { name: 'Gate Exit History', path: '/watchman-dashboard?tab=exitHistory', icon: CheckCircle2 }
    );
  }

  // Mobile Bottom Navigation Bar Items (tailored for native mobile app UX)
  const mobileBottomItems = React.useMemo(() => {
    const items = [];
    if (user?.role === 'SUPER_ADMIN') {
      items.push(
        { name: 'Dashboard', shortName: 'Home', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Students', shortName: 'Students', path: '/students', icon: GraduationCap },
        { name: 'Absentees', shortName: 'Absentees', path: '/absentees', icon: AlertCircle },
        { name: 'Outpass Approvals', shortName: 'Approvals', path: '/outpasses', icon: FileText }
      );
    } else if (user?.role === 'HOD' || user?.role === 'SUB_ADMIN') {
      items.push(
        { name: 'Dashboard', shortName: 'Home', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Students', shortName: 'Students', path: '/students', icon: GraduationCap },
        { name: 'Absentees', shortName: 'Absentees', path: '/absentees', icon: AlertCircle },
        { name: 'Outpass Approvals', shortName: 'Approvals', path: '/outpasses', icon: FileText }
      );
    } else if (user?.role === 'FACULTY') {
      let isNonTeaching = user?.facultyType === 'NON_TEACHING';
      if (!isNonTeaching) {
        try {
          const metaList = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
          const meta = metaList.find(m => 
            (m.empid && String(m.empid).toLowerCase() === String(user?.userId).toLowerCase()) ||
            (m.name && String(m.name).trim().toLowerCase() === String(user?.name).trim().toLowerCase())
          );
          if (meta && meta.facultyType === 'NON_TEACHING') isNonTeaching = true;
        } catch (e) {}
      }

      if (isNonTeaching) {
        items.push(
          { name: 'Faculty Permissions', shortName: 'Permissions', path: '/faculty-dashboard?tab=leaves', icon: Calendar },
          { name: 'Edit Profile', shortName: 'Profile', isProfile: true, icon: Settings }
        );
      } else {
        items.push(
          { name: 'Attendance', shortName: 'Attendance', path: '/faculty-dashboard', icon: UserCheck },
          { name: 'Call Logs', shortName: 'Calls', path: '/faculty-dashboard?tab=calls', icon: PhoneCall },
          { name: 'Permissions', shortName: 'Permission', path: '/faculty-dashboard?tab=leaves', icon: Calendar },
          { name: 'Mentorship', shortName: 'Mentor', path: '/faculty-dashboard?tab=mentor', icon: GraduationCap }
        );
      }
    } else if (user?.role === 'AO') {
      items.push(
        { name: 'AO Portal', shortName: 'Portal', path: '/ao-dashboard', icon: ShieldCheck },
        { name: 'Pending Leaves', shortName: 'Pending', path: '/ao-dashboard?tab=PENDING', icon: Clock },
        { name: 'Security Cleared', shortName: 'Cleared', path: '/ao-dashboard?tab=GRANTED', icon: DoorOpen }
      );
    } else if (user?.role === 'OFFICE') {
      items.push(
        { name: 'Certificates Portal', shortName: 'Portal', path: '/office-dashboard', icon: FileText },
        { name: 'Pending', shortName: 'Pending', path: '/office-dashboard?tab=PENDING', icon: Clock },
        { name: 'Ready', shortName: 'Ready', path: '/office-dashboard?tab=READY', icon: CheckCircle2 }
      );
    } else if (user?.role === 'WATCHMAN' || user?.role === 'SECURITY_HEAD') {
      items.push(
        { name: 'Clearance', shortName: 'Clearance', path: '/watchman-dashboard', icon: DoorOpen },
        { name: 'Exit History', shortName: 'History', path: '/watchman-dashboard?tab=exitHistory', icon: CheckCircle2 }
      );
    } else if (user?.role === 'CR') {
      items.push(
        { name: 'Schedule', shortName: 'Schedule', path: '/cr-dashboard', icon: CalendarDays },
        { name: 'Attendance', shortName: 'Attendance', path: '/cr-dashboard?tab=students', icon: Users }
      );
    } else if (user?.role === 'ABSENT_CONTROLLER') {
      items.push(
        { name: 'Section', shortName: 'Section', path: '/absent-controller', icon: Users },
        { name: 'All Sections', shortName: 'All', path: '/absent-controller?tab=allSections', icon: AlertCircle },
        { name: 'Outpasses', shortName: 'Outpasses', path: '/absent-controller?tab=outpassRequests', icon: FileText }
      );
    }
    return items;
  }, [user]);

  const isLinkActive = (linkPath) => {
    const currentPath = location.pathname;
    const currentSearch = location.search;

    if (linkPath.includes('?')) {
      const [path, query] = linkPath.split('?');
      return currentPath === path && currentSearch.includes(query);
    }

    if (currentPath !== linkPath) return false;

    // Base path check: if current search has query params matching another navLink, this base shouldn't be active
    const siblings = navLinks.filter(l => l.path.startsWith(linkPath + '?'));
    if (siblings.length > 0 && currentSearch) {
      return !siblings.some(s => currentSearch.includes(s.path.split('?')[1]));
    }

    return true;
  };

  const formatClockTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex bg-customBg dark:bg-customBg-dark transition-colors duration-300">
      
      {/* SIDEBAR FOR DESKTOP & TABLET */}
      <aside className="hidden md:flex flex-col w-60 lg:w-64 fixed inset-y-0 left-0 z-30 glass-sidebar print:hidden transition-all duration-300">
        <div className="h-16 flex items-center px-5 lg:px-6 border-b border-slate-200/50 dark:border-slate-800/30 gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-white">
            <img src={logo} alt="NEC Logo" className="w-9 h-9 object-contain rounded-xl" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight bg-gradient-to-r from-primary-dark to-slate-700 dark:to-slate-300 bg-clip-text text-transparent">
              Lectra
            </h1>
            <span className="text-[10px] text-customText-muted dark:text-customText-mutedDark font-semibold tracking-wider uppercase">
              NEC
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 lg:px-4 py-5 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = isLinkActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs lg:text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 dark:bg-primary-dark/20 text-primary-dark dark:text-primary font-bold shadow-xs'
                    : 'text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100/50 dark:hover:bg-slate-800/30 hover:text-customText dark:hover:text-customText-dark'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-primary-dark dark:text-primary' : ''} />
                <span className="truncate">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile section */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/30 bg-white/20 dark:bg-slate-950/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-primary-dark dark:text-primary border border-white/60 dark:border-slate-800 shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs lg:text-sm font-semibold truncate text-customText dark:text-customText-dark">
                {user?.name}
              </p>
              {user?.role === 'SUPER_ADMIN' ? (
                <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  ⚡ Super Admin
                </span>
              ) : (
                <>
                  <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark truncate">
                    {(user?.role === 'WATCHMAN' || user?.role === 'SECURITY_HEAD') ? 'Security Head' : user?.role} {user?.className ? `(${user.className})` : ''}
                  </p>
                  {user?.department && user?.role !== 'WATCHMAN' && user?.role !== 'SECURITY_HEAD' && (
                    <p className="text-[10px] text-primary-dark dark:text-primary font-bold truncate mt-0.5" title={user.department}>
                      🏛️ {user.department.replace(/^Department of\s+/i, '')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition-all active:scale-[0.98]"
            >
              <Settings size={14} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all duration-200 active:scale-95"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE APP SLIDE-OVER DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full p-4 z-10 animate-fade-in shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white p-0.5 shadow-sm border border-slate-200 flex items-center justify-center">
                  <img src={logo} alt="NEC Logo" className="w-full h-full object-contain rounded-lg" />
                </div>
                <div>
                  <span className="font-extrabold text-base text-primary-dark dark:text-primary leading-tight block">Lectra</span>
                  <span className="text-[10px] text-customText-muted dark:text-customText-mutedDark font-bold tracking-widest uppercase block">NEC Autonomous</span>
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-customText-muted active:scale-95 cursor-pointer"
                aria-label="Close Menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="my-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary-dark dark:text-primary font-black text-sm flex items-center justify-center border border-primary/20 shrink-0">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black truncate text-customText dark:text-customText-dark">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-customText-muted dark:text-customText-mutedDark truncate">
                    {user?.userId}
                  </p>
                  {user?.role === 'SUPER_ADMIN' ? (
                    <span className="inline-block mt-0.5 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      ⚡ Super Admin
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary-dark font-bold">
                        {(user?.role === 'WATCHMAN' || user?.role === 'SECURITY_HEAD') ? 'Security' : user?.role}
                      </span>
                      {user?.department && user?.role !== 'WATCHMAN' && user?.role !== 'SECURITY_HEAD' && (
                        <span className="text-[9px] text-primary-dark dark:text-primary font-bold truncate">
                          🏛️ {user.department.replace(/^Department of\s+/i, '')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions in Mobile Drawer */}
              <div className="flex gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowProfileModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
                >
                  <Settings size={13} />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer"
                  title="Toggle Theme"
                >
                  {darkMode ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 text-[11px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {/* Super Admin Dept Switcher in Drawer */}
            {user?.role === 'SUPER_ADMIN' && (
              <div className="mb-3 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider block mb-1">
                  Department Filter:
                </span>
                <select
                  value={selectedDepartment || 'ALL'}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 text-xs font-bold text-primary-dark dark:text-primary rounded-lg p-2 border border-slate-200 dark:border-slate-700 focus:outline-none"
                >
                  <option value="ALL">🏛️ All Departments (Campus-Wide)</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Full Nav Links */}
            <div className="text-[10px] font-bold uppercase tracking-wider text-customText-muted px-2 mb-1">
              All Modules
            </div>
            <nav className="flex-1 space-y-1 pb-4">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isLinkActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary-dark dark:text-primary font-bold shadow-xs'
                        : 'text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-primary' : ''} />
                    <span className="truncate">{link.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center pb-safe">
              <span className="text-[10px] text-customText-muted dark:text-customText-mutedDark font-semibold">
                Lectra v2.0 • NEC Autonomous
              </span>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col md:pl-60 lg:pl-64 min-w-0 print:pl-0 transition-all duration-300">
        
        {/* HEADER BAR */}
        <header className="glass-navbar h-14 md:h-16 flex items-center justify-between px-3 md:px-8 border-b border-slate-200/50 dark:border-slate-800/30 print:hidden sticky top-0 z-30">
          
          {/* Mobile Left Brand */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-xl text-customText hover:bg-slate-100 dark:text-customText-dark dark:hover:bg-slate-800 active:scale-95"
              aria-label="Open Menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMobileMenuOpen(true)}>
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-white p-0.5 shadow-sm border border-slate-200/60">
                <img src={logo} alt="NEC Logo" className="w-full h-full object-contain rounded-md" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xs text-primary-dark dark:text-primary leading-none">
                  Lectra
                </span>
                <span className="text-[9px] font-bold text-customText-muted dark:text-customText-mutedDark truncate max-w-[110px]">
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'HOD' ? `HOD ${user?.department ? user.department.replace(/^Department of\s+/i, '') : ''}` : (user?.role === 'WATCHMAN' || user?.role === 'SECURITY_HEAD') ? 'Security' : user?.role || 'Portal'}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop/Tablet Left brand info & clock */}
          <div className="hidden md:flex items-center gap-4">
            {/* Live Clock Component */}
            <div className="flex items-center gap-2 bg-slate-100/70 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/40 dark:border-slate-700/40 shadow-xs">
              <Clock size={16} className="text-primary-dark dark:text-primary animate-pulse" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wider">
                {formatClockTime(currentTime)}
              </span>
              <span className="hidden lg:inline text-xs text-customText-muted dark:text-customText-mutedDark border-l border-slate-300 dark:border-slate-700 pl-2">
                {formatDate(currentTime)}
              </span>
            </div>

            {/* Super Admin Department Switcher in Header */}
            {user?.role === 'SUPER_ADMIN' && (
              <div className="hidden lg:flex items-center gap-2 bg-slate-100/70 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
                <span className="text-[11px] font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                  Dept:
                </span>
                <select
                  value={selectedDepartment || 'ALL'}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-primary-dark dark:text-primary focus:outline-none cursor-pointer"
                >
                  <option value="ALL">🏛️ All Departments (Campus-Wide)</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mobile Center Time badge */}
          <div className="flex md:hidden items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 shadow-2xs">
            <Clock size={12} className="text-primary" />
            <span>{formatClockTime(currentTime)}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Online Indicator Toggle — visible to HOD and SUPER_ADMIN ONLY */}
            {(user?.role === 'HOD' || user?.role === 'SUPER_ADMIN') && (
            <div className="relative">
              <button
                onClick={() => setOnlineListOpen(!onlineListOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-600 dark:text-green-400 font-semibold text-[11px] sm:text-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <Globe size={13} className="animate-spin" style={{ animationDuration: '6s' }} />
                <span>{displayedOnlineCount} <span className="hidden sm:inline">Online</span></span>
              </button>

              {/* Online Users List Dropdown */}
              {onlineListOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOnlineListOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 glass-card z-50 p-4 border border-slate-200 dark:border-slate-800 animate-fade-in max-h-80 overflow-y-auto shadow-2xl">
                    <h3 className="font-bold text-sm text-customText dark:text-customText-dark pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                      Connected Users ({displayedOnlineCount})
                    </h3>
                    {displayedOnlineUsers.length === 0 ? (
                      <p className="text-xs text-customText-muted dark:text-customText-mutedDark py-2">No active users in department</p>
                    ) : (
                      <div className="space-y-2">
                        {displayedOnlineUsers.map((u, i) => (
                          <div key={i} className="flex items-center gap-2.5 py-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate text-customText dark:text-customText-dark">{u.name}</p>
                              <p className="text-[10px] text-customText-muted dark:text-customText-mutedDark truncate">
                                {u.role} {u.className ? `(${u.className})` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            )}

            {/* Dark Mode Switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 sm:p-2 rounded-xl text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification Bell Component */}
            {(user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-1.5 sm:p-2 rounded-xl text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
                >
                  <Bell size={18} />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-dark opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-dark"></span>
                    </span>
                  )}
                </button>

                {/* Notification Box Dropdown */}
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 sm:w-80 glass-card z-50 p-4 border border-slate-200 dark:border-slate-800 animate-fade-in shadow-2xl">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                        <span className="font-bold text-sm">Real-Time Alerts</span>
                        {notifications.length > 0 && (
                          <button onClick={clearNotifications} className="text-xs text-primary-dark hover:underline cursor-pointer">
                            Clear All
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-2.5">
                        {notifications.length === 0 ? (
                          <div className="text-center py-6 text-customText-muted dark:text-customText-mutedDark text-xs">
                            No recent entry activity logs
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id} 
                              className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                                notif.type === 'success' 
                                  ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300' 
                                  : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                              }`}
                            >
                              <p className="font-medium">{notif.message}</p>
                              <span className="text-[10px] text-customText-muted dark:text-customText-mutedDark block mt-1">
                                {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile User Avatar Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-8 h-8 rounded-full bg-primary/10 text-primary-dark dark:text-primary font-bold text-xs flex items-center justify-center border border-primary/20 active:scale-90 cursor-pointer"
              title="Open Menu"
            >
              {user?.name?.charAt(0).toUpperCase()}
            </button>

            {/* Top Right Logout Button (Desktop & Tablet) */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/20 transition-all active:scale-[0.98] ml-1 cursor-pointer"
              title="Log Out of System"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>

          </div>
        </header>

        {/* CONTAINER FOR CHILDREN (Responsive padding with pb-24 on mobile so bottom dock never overlaps content) */}
        <main className="flex-1 p-3 sm:p-5 md:p-8 pb-24 sm:pb-28 md:pb-8 max-w-[1600px] w-full mx-auto animate-fade-in flex flex-col justify-between print:p-0 print:m-0 print:max-w-full">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-8 pt-6 pb-4 border-t border-slate-200/50 dark:border-slate-800/30 text-center no-print">
            <div className="inline-flex items-center justify-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 text-xs font-semibold text-customText-muted dark:text-customText-mutedDark shadow-sm">
              <a 
                href="https://nrtec.in" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary-dark dark:text-primary font-bold hover:underline"
              >
                NEC
              </a>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold select-none">✕</span>
              <a 
                href="https://technoelite-web-portal.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary-dark dark:text-primary font-bold hover:underline"
              >
                Technoelite
              </a>
            </div>
          </footer>
        </main>
      </div>

      {/* NATIVE MOBILE APP BOTTOM NAVIGATION BAR (DOCK) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] pb-safe transition-all duration-300 print:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div className="h-14 flex items-center justify-around px-1">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path ? isLinkActive(item.path) : false;

            if (item.isProfile) {
              return (
                <button
                  key="bottom-profile"
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all active:scale-90 text-customText-muted dark:text-customText-mutedDark cursor-pointer"
                >
                  <Icon size={19} />
                  <span className="text-[10px] font-semibold tracking-tight mt-0.5 truncate max-w-[64px]">
                    {item.shortName}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all active:scale-90 relative ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-customText-muted dark:text-customText-mutedDark hover:text-customText'
                }`}
              >
                <div className="relative">
                  <Icon size={19} className={isActive ? 'text-primary scale-110 transition-transform' : ''} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-xs" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
                  {item.shortName}
                </span>
              </Link>
            );
          })}

          {/* More / Menu Drawer button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all active:scale-90 relative cursor-pointer ${
              mobileMenuOpen
                ? 'text-primary font-bold'
                : 'text-customText-muted dark:text-customText-mutedDark hover:text-customText'
            }`}
          >
            <div className="relative">
              <Menu size={19} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* EDIT PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          
          <form 
            onSubmit={handleUpdateProfile}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-md p-6 shadow-2xl animate-fade-in z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                Edit My Profile
              </h3>
              <button 
                type="button"
                onClick={() => setShowProfileModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {profileError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                ⚠️ {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-semibold rounded-xl">
                ✅ {profileSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="glass-input"
                  disabled={profileSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  User ID (Login Username)
                </label>
                <input
                  type="text"
                  required
                  value={profileUserId}
                  onChange={(e) => setProfileUserId(e.target.value)}
                  className="glass-input"
                  disabled={profileSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  New Password (Optional)
                </label>
                <input
                  type="password"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="glass-input"
                  disabled={profileSubmitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowProfileModal(false)} 
                className="btn-secondary"
                disabled={profileSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={profileSubmitting}
              >
                {profileSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Layout;
