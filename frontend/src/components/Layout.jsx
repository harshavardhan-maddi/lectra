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
  ShieldCheck
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout, updateProfile } = useAuth();
  const { onlineCount, onlineUsers, notifications, clearNotifications } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

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
      { name: 'Manage All Users', path: '/users', icon: Users },
      { name: 'Classrooms', path: '/classrooms', icon: CalendarDays },
      { name: 'Faculty Contacts', path: '/faculty', icon: UserCheck },
      { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
      { name: 'Gate & Outpasses', path: '/watchman-dashboard', icon: ShieldCheck },
      { name: 'Absent Control', path: '/absent-controller', icon: Users },
      { name: 'Faculty Portal', path: '/faculty-dashboard', icon: LayoutDashboard },
      { name: 'System Settings', path: '/settings', icon: Settings }
    );
  } else if (user?.role === 'HOD' || user?.role === 'SUB_ADMIN') {
    navLinks.push(
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Classrooms', path: '/classrooms', icon: CalendarDays },
      { name: 'Faculty Contacts', path: '/faculty', icon: UserCheck },
      { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
      { name: 'Fingerprint Settings', path: '/settings', icon: Settings }
    );
    if (user?.role === 'HOD') {
      navLinks.push({ name: 'Manage Users', path: '/users', icon: Users });
    }
  } else if (user?.role === 'CR') {
    navLinks.push({ name: 'My Timetable', path: '/cr-dashboard', icon: CalendarDays });
  } else if (user?.role === 'ABSENT_CONTROLLER') {
    navLinks.push(
      { name: 'Absent Control', path: '/absent-controller', icon: Users },
      { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
      { name: 'Settings', path: '/settings', icon: Settings }
    );
  } else if (user?.role === 'FACULTY') {
    navLinks.push(
      { name: 'Faculty Portal', path: '/faculty-dashboard', icon: LayoutDashboard }
    );
  } else if (user?.role === 'WATCHMAN') {
    navLinks.push(
      { name: 'Gate Security & Outpass', path: '/watchman-dashboard', icon: ShieldCheck }
    );
  }

  const formatClockTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex bg-customBg dark:bg-customBg-dark transition-colors duration-300">
      
      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-30 glass-sidebar">
        <div className="h-16 flex items-center px-6 border-b border-slate-200/50 dark:border-slate-800/30 gap-2.5">
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

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 dark:bg-primary-dark/20 text-primary-dark dark:text-primary'
                    : 'text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100/50 dark:hover:bg-slate-800/30 hover:text-customText dark:hover:text-customText-dark'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-primary-dark dark:text-primary' : ''} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile section */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/30 bg-white/20 dark:bg-slate-950/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-primary-dark dark:text-primary border border-white/60 dark:border-slate-800">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-customText dark:text-customText-dark">
                {user?.name}
              </p>
              {user?.role === 'SUPER_ADMIN' ? (
                <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  ⚡ Super Admin
                </span>
              ) : (
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark truncate">
                  {user?.role} {user?.className ? `(${user.className})` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition-all active:scale-[0.98]"
            >
              <Settings size={14} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all duration-200"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER SIDEBAR */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-customBg dark:bg-customBg-dark border-r border-slate-200 dark:border-slate-800 h-full p-4 z-10 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img src={logo} alt="NEC Logo" className="w-7 h-7 rounded-lg object-contain bg-white" />
                <span className="font-bold text-lg text-primary-dark">Lectra</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 py-6 space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium ${
                      isActive
                        ? 'bg-primary/10 text-primary-dark'
                        : 'text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-primary-dark">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{user?.name}</p>
                  {user?.role === 'SUPER_ADMIN' ? (
                    <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      ⚡ Super Admin
                    </span>
                  ) : (
                    <p className="text-xs text-customText-muted dark:text-customText-mutedDark">{user?.role}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowProfileModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  <Settings size={14} />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        
        {/* HEADER BAR */}
        <header className="glass-navbar h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-200/50 dark:border-slate-800/30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-xl text-customText hover:bg-slate-100 dark:text-customText-dark dark:hover:bg-slate-800"
            >
              <Menu size={22} />
            </button>
            
            {/* Live Clock Component */}
            <div className="flex items-center gap-2 bg-slate-100/70 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
              <Clock size={16} className="text-primary-dark dark:text-primary animate-pulse" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tracking-wider">
                {formatClockTime(currentTime)}
              </span>
              <span className="hidden sm:inline text-xs text-customText-muted dark:text-customText-mutedDark border-l border-slate-300 dark:border-slate-700 pl-2">
                {formatDate(currentTime)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            
            {/* Online Indicator Toggle — visible to HOD / SUB_ADMIN / SUPER_ADMIN */}
            {(user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <div className="relative">
              <button
                onClick={() => setOnlineListOpen(!onlineListOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-600 dark:text-green-400 font-semibold text-xs active:scale-[0.98] transition-all"
              >
                <Globe size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
                <span>{onlineCount} Online</span>
              </button>

              {/* Online Users List Dropdown */}
              {onlineListOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOnlineListOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 glass-card z-50 p-4 border border-slate-200 dark:border-slate-800 animate-fade-in max-h-80 overflow-y-auto">
                    <h3 className="font-bold text-sm text-customText dark:text-customText-dark pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                      Connected Users ({onlineCount})
                    </h3>
                    {onlineUsers.length === 0 ? (
                      <p className="text-xs text-customText-muted dark:text-customText-mutedDark py-2">No active users logged</p>
                    ) : (
                      <div className="space-y-2">
                        {onlineUsers.map((u, i) => (
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
              className="p-2 rounded-xl text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notification Bell Component */}
            {(user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-2 rounded-xl text-customText-muted dark:text-customText-mutedDark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Bell size={20} />
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
                    <div className="absolute right-0 mt-2 w-80 glass-card z-50 p-4 border border-slate-200 dark:border-slate-800 animate-fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                        <span className="font-bold text-sm">Real-Time Alerts</span>
                        {notifications.length > 0 && (
                          <button onClick={clearNotifications} className="text-xs text-primary-dark hover:underline">
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

          </div>
        </header>

        {/* CONTAINER FOR CHILDREN */}
        <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto animate-fade-in flex flex-col justify-between">
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
