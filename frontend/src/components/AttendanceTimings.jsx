import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  Building, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Sun,
  Sunset,
  Sparkles,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

const DEFAULT_TIMINGS = {
  morningStart: '09:10',
  morningEnd: '10:30',
  afternoonStart: '13:30',
  afternoonEnd: '15:00',
  inTime: '09:00',
  outTime: '16:30'
};

const AttendanceTimings = () => {
  const { user, token, getDepartmentsList } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [departments, setDepartments] = useState(['Department of CSE(emerging Technologies)']);
  const [selectedDept, setSelectedDept] = useState(
    user?.department || 'Department of CSE(emerging Technologies)'
  );

  const [allTimings, setAllTimings] = useState({});
  const [formTimings, setFormTimings] = useState(DEFAULT_TIMINGS);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingBackend, setLoadingBackend] = useState(false);

  // Load known departments
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const depts = await getDepartmentsList();
        if (Array.isArray(depts) && depts.length > 0) {
          setDepartments(depts);
          if (!selectedDept || (user?.role !== 'HOD' && !depts.includes(selectedDept))) {
            setSelectedDept(depts[0]);
          }
        }
      } catch (e) {
        console.warn('Failed to load departments for timings:', e);
      }
    };
    fetchDepts();
  }, []);

  // Fetch timings from backend API & localStorage
  const loadTimings = async () => {
    setLoadingBackend(true);
    let currentDeptTimings = { ...DEFAULT_TIMINGS };

    // 1. Try local storage cache
    try {
      const stored = localStorage.getItem('lectra_department_timings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAllTimings(parsed);
        if (parsed[selectedDept]) {
          currentDeptTimings = { ...currentDeptTimings, ...parsed[selectedDept] };
        }
      }
    } catch (e) {
      console.warn('Error reading saved department timings:', e);
    }

    // 2. Try fetching from backend timing settings API
    try {
      const res = await fetch('/api/student-attendance/settings/timings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        currentDeptTimings = {
          ...currentDeptTimings,
          morningStart: data.morningStart || currentDeptTimings.morningStart,
          morningEnd: data.morningEnd || currentDeptTimings.morningEnd,
          afternoonStart: data.afternoonStart || currentDeptTimings.afternoonStart,
          afternoonEnd: data.afternoonEnd || currentDeptTimings.afternoonEnd
        };
      }
    } catch (e) {
      console.warn('Backend timing fetch notice:', e);
    }

    setFormTimings(currentDeptTimings);
    setLoadingBackend(false);
  };

  useEffect(() => {
    loadTimings();
  }, [selectedDept]);

  const handleInputChange = (field, value) => {
    setFormTimings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResetDefaults = () => {
    setFormTimings(DEFAULT_TIMINGS);
    setSuccess('Reset to default session windows');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const updatedTimingObj = {
        ...formTimings,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.userId || 'Admin'
      };

      // 1. Save to local storage for instant per-department access
      const updatedAll = {
        ...allTimings,
        [selectedDept]: updatedTimingObj
      };
      localStorage.setItem('lectra_department_timings', JSON.stringify(updatedAll));
      setAllTimings(updatedAll);

      // 2. Post to backend system settings API
      try {
        const res = await fetch('/api/student-attendance/settings/timings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            morningStart: formTimings.morningStart,
            morningEnd: formTimings.morningEnd,
            afternoonStart: formTimings.afternoonStart,
            afternoonEnd: formTimings.afternoonEnd
          })
        });
        if (!res.ok) {
          const data = await res.json();
          console.warn('Backend timing update note:', data.message);
        }
      } catch (e) {
        console.warn('Backend timing save note:', e);
      }

      // 3. Trigger custom window event so CRDashboard updates instantly
      window.dispatchEvent(new CustomEvent('lectra_timings_updated', {
        detail: { department: selectedDept, timings: updatedTimingObj }
      }));

      setSuccess(`CR Attendance timings for "${selectedDept}" saved successfully!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save attendance timings');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToAll = async () => {
    if (!isSuperAdmin) return;
    if (!window.confirm(`Are you sure you want to apply these CR attendance timings to ALL ${departments.length} departments?`)) return;

    setSaving(true);
    try {
      const timingObj = {
        ...formTimings,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.userId || 'Super Admin'
      };

      const updatedAll = { ...allTimings };
      departments.forEach(dept => {
        updatedAll[dept] = timingObj;
      });

      localStorage.setItem('lectra_department_timings', JSON.stringify(updatedAll));
      setAllTimings(updatedAll);

      try {
        await fetch('/api/student-attendance/settings/timings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            morningStart: formTimings.morningStart,
            morningEnd: formTimings.morningEnd,
            afternoonStart: formTimings.afternoonStart,
            afternoonEnd: formTimings.afternoonEnd
          })
        });
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('lectra_timings_updated', { detail: updatedAll }));
      setSuccess(`Applied CR attendance timings across ALL ${departments.length} departments!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Failed to apply timings to all departments');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-primary-dark to-slate-800 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-primary-light border border-white/10">
            <Clock size={26} />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              CR Attendance Window Timings
              {isSuperAdmin ? (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-300 border border-amber-500/40 font-extrabold">
                  Super Admin
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-300 border border-blue-500/40 font-extrabold">
                  HOD Access
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Set the From & To time windows when CRs can take student attendance for Morning and Afternoon sessions.
            </p>
          </div>
        </div>

        {/* Department Selector */}
        <div className="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl border border-white/10">
          <Building size={18} className="text-amber-400 ml-1" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">
              {isSuperAdmin ? 'Select Department' : 'Department Scope'}
            </span>
            {isSuperAdmin ? (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-slate-950/80 text-white text-xs font-bold py-1 px-2.5 rounded-lg border border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept} className="bg-slate-900 text-white">
                    {dept}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-extrabold text-white">
                {selectedDept}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Main CR Attendance Timings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* MORNING SESSION ATTENDANCE WINDOW */}
          <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Sun size={22} />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-customText dark:text-customText-dark">
                    Morning Session CR Attendance Window
                  </h4>
                  <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                    Allowed From & To timings for morning attendance taking
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Morning From (Start)
                </label>
                <input
                  type="time"
                  value={formTimings.morningStart}
                  onChange={(e) => handleInputChange('morningStart', e.target.value)}
                  className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-base font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Morning To (End)
                </label>
                <input
                  type="time"
                  value={formTimings.morningEnd}
                  onChange={(e) => handleInputChange('morningEnd', e.target.value)}
                  className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-base font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
              ☀️ <strong>CR Access Rule:</strong> CRs in <span className="font-bold">{selectedDept}</span> can take Morning Session attendance only between <strong>{formTimings.morningStart}</strong> and <strong>{formTimings.morningEnd}</strong>.
            </div>
          </div>

          {/* AFTERNOON SESSION ATTENDANCE WINDOW */}
          <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sunset size={22} />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-customText dark:text-customText-dark">
                    Afternoon Session CR Attendance Window
                  </h4>
                  <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                    Allowed From & To timings for afternoon attendance taking
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Afternoon From (Start)
                </label>
                <input
                  type="time"
                  value={formTimings.afternoonStart}
                  onChange={(e) => handleInputChange('afternoonStart', e.target.value)}
                  className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-base font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Afternoon To (End)
                </label>
                <input
                  type="time"
                  value={formTimings.afternoonEnd}
                  onChange={(e) => handleInputChange('afternoonEnd', e.target.value)}
                  className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-base font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium">
              🌆 <strong>CR Access Rule:</strong> CRs in <span className="font-bold">{selectedDept}</span> can take Afternoon Session attendance only between <strong>{formTimings.afternoonStart}</strong> and <strong>{formTimings.afternoonEnd}</strong>.
            </div>
          </div>

        </div>

        {/* Live Summary Card */}
        <div className="glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck size={22} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-customText dark:text-customText-dark">
                CR Attendance Window Rule Summary ({selectedDept})
              </h4>
              <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                Morning: <span className="font-bold text-amber-600 dark:text-amber-400">{formTimings.morningStart} to {formTimings.morningEnd}</span> | Afternoon: <span className="font-bold text-purple-600 dark:text-purple-400">{formTimings.afternoonStart} to {formTimings.afternoonEnd}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-bold text-slate-500 hover:text-primary-dark dark:text-slate-400 dark:hover:text-primary flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} />
            Reset Defaults
          </button>
        </div>

        {/* Save Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleApplyToAll}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-amber-400 font-bold text-xs border border-slate-700/80 flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Sparkles size={16} />
              <span>Apply Timings to ALL Departments</span>
            </button>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto ml-auto">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto btn-primary px-6 py-2.5 text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg"
            >
              <Save size={18} />
              <span>{saving ? 'Saving Timings...' : `Save CR Timings for ${selectedDept}`}</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
};

export default AttendanceTimings;
