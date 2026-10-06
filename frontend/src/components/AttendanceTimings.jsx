import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  Building, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Sparkles,
  Layers
} from 'lucide-react';

const DEFAULT_PERIODS = [
  { period: 1, label: 'Period 1', startTime: '09:00', endTime: '09:50' },
  { period: 2, label: 'Period 2', startTime: '09:50', endTime: '10:40' },
  { period: 3, label: 'Period 3', startTime: '10:50', endTime: '11:40' },
  { period: 4, label: 'Period 4', startTime: '11:40', endTime: '12:30' },
  { period: 5, label: 'Period 5', startTime: '13:30', endTime: '14:20' },
  { period: 6, label: 'Period 6', startTime: '14:20', endTime: '15:10' },
  { period: 7, label: 'Period 7', startTime: '15:10', endTime: '16:00' },
];

const DEFAULT_TIMINGS = {
  inTime: '09:00',
  lateCutoff: '09:15',
  halfDayCutoff: '13:00',
  outTime: '16:30',
  saturdayHalfDay: false,
  gracePeriodMins: 15,
  periods: DEFAULT_PERIODS
};

const AttendanceTimings = () => {
  const { user, getDepartmentsList } = useAuth();
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

  // Load timing settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lectra_department_timings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAllTimings(parsed);
      }
    } catch (e) {
      console.warn('Error reading saved department timings:', e);
    }
  }, []);

  // Sync timing form when selected department changes
  useEffect(() => {
    if (selectedDept && allTimings[selectedDept]) {
      setFormTimings({
        ...DEFAULT_TIMINGS,
        ...allTimings[selectedDept],
        periods: allTimings[selectedDept].periods || DEFAULT_PERIODS
      });
    } else {
      setFormTimings(DEFAULT_TIMINGS);
    }
  }, [selectedDept, allTimings]);

  const handleInputChange = (field, value) => {
    setFormTimings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePeriodChange = (index, field, value) => {
    setFormTimings(prev => {
      const updatedPeriods = [...(prev.periods || DEFAULT_PERIODS)];
      updatedPeriods[index] = {
        ...updatedPeriods[index],
        [field]: value
      };
      return {
        ...prev,
        periods: updatedPeriods
      };
    });
  };

  const handleResetDefaults = () => {
    setFormTimings(DEFAULT_TIMINGS);
    setSuccess('Reset to standard default college timings');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSave = (e) => {
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

      const updatedAll = {
        ...allTimings,
        [selectedDept]: updatedTimingObj
      };

      localStorage.setItem('lectra_department_timings', JSON.stringify(updatedAll));
      setAllTimings(updatedAll);

      // Trigger custom window event so other modules can react in real time
      window.dispatchEvent(new CustomEvent('lectra_timings_updated', {
        detail: { department: selectedDept, timings: updatedTimingObj }
      }));

      setSuccess(`Attendance timings for "${selectedDept}" saved successfully!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save timings configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToAll = () => {
    if (!isSuperAdmin) return;
    if (!window.confirm(`Are you sure you want to apply these timings to ALL ${departments.length} departments?`)) return;

    try {
      const updatedAll = { ...allTimings };
      const timingObj = {
        ...formTimings,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.userId || 'Super Admin'
      };

      departments.forEach(dept => {
        updatedAll[dept] = timingObj;
      });

      localStorage.setItem('lectra_department_timings', JSON.stringify(updatedAll));
      setAllTimings(updatedAll);
      window.dispatchEvent(new CustomEvent('lectra_timings_updated', { detail: updatedAll }));

      setSuccess(`Timings applied across ALL ${departments.length} departments successfully!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Failed to apply timings to all departments');
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
              Department Attendance Timings
              {isSuperAdmin && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-300 border border-amber-500/40 font-extrabold">
                  Super Admin
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Customize shift timings, late entry cutoffs, and period schedules for each department.
            </p>
          </div>
        </div>

        {/* Department Switcher */}
        <div className="flex items-center gap-2 bg-white/10 p-2 rounded-xl border border-white/10">
          <Building size={18} className="text-amber-400 ml-1" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Select Department</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-950/70 text-white text-xs font-bold py-1 px-2.5 rounded-lg border border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept} className="bg-slate-900 text-white">
                  {dept}
                </option>
              ))}
            </select>
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
        
        {/* Main Timing Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Morning Entry Time */}
          <div className="glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                Morning Entry Time
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Clock size={16} />
              </span>
            </div>
            <div>
              <input
                type="time"
                value={formTimings.inTime}
                onChange={(e) => handleInputChange('inTime', e.target.value)}
                className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-lg font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark mt-1.5">
                Standard reporting time for faculty & students
              </p>
            </div>
          </div>

          {/* Late Grace Cutoff */}
          <div className="glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                Late Entry Cutoff
              </span>
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock size={16} />
              </span>
            </div>
            <div>
              <input
                type="time"
                value={formTimings.lateCutoff}
                onChange={(e) => handleInputChange('lateCutoff', e.target.value)}
                className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-lg font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark mt-1.5">
                Arrivals after this mark as Late Attendance
              </p>
            </div>
          </div>

          {/* Half Day Cutoff */}
          <div className="glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                Half-Day Mark
              </span>
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Clock size={16} />
              </span>
            </div>
            <div>
              <input
                type="time"
                value={formTimings.halfDayCutoff}
                onChange={(e) => handleInputChange('halfDayCutoff', e.target.value)}
                className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-lg font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark mt-1.5">
                Boundary for morning session half-day
              </p>
            </div>
          </div>

          {/* Evening Departure / Out Time */}
          <div className="glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                Evening Out Time
              </span>
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock size={16} />
              </span>
            </div>
            <div>
              <input
                type="time"
                value={formTimings.outTime}
                onChange={(e) => handleInputChange('outTime', e.target.value)}
                className="w-full bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-lg font-black text-customText dark:text-customText-dark focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark mt-1.5">
                Official end of academic working hours
              </p>
            </div>
          </div>

        </div>

        {/* Saturday Schedule & Additional Options */}
        <div className="glass-card p-5 border border-slate-200/50 dark:border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary-dark dark:text-primary">
              <Calendar size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-customText dark:text-customText-dark">
                Saturday Special Timings Mode
              </h4>
              <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                Enable half-day schedule mode for Saturdays (e.g. ends at 01:00 PM)
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formTimings.saturdayHalfDay}
              onChange={(e) => handleInputChange('saturdayHalfDay', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:peer-focus:ring-primary peer-checked:bg-primary-dark"></div>
            <span className="ml-3 text-xs font-extrabold text-customText dark:text-customText-dark">
              {formTimings.saturdayHalfDay ? 'Half Day Active' : 'Full Day Active'}
            </span>
          </label>
        </div>

        {/* Period-wise Schedule Grid */}
        <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-primary-dark dark:text-primary" />
              <h4 className="text-base font-extrabold text-customText dark:text-customText-dark">
                Classroom Period Slot Timings ({selectedDept})
              </h4>
            </div>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs font-bold text-slate-500 hover:text-primary-dark dark:text-slate-400 dark:hover:text-primary flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={14} />
              Reset Standard Timings
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(formTimings.periods || DEFAULT_PERIODS).map((p, idx) => (
              <div 
                key={p.period || idx}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-3"
              >
                <span className="text-xs font-black text-primary-dark dark:text-primary min-w-[70px]">
                  {p.label || `Period ${idx + 1}`}
                </span>
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="time"
                    value={p.startTime}
                    onChange={(e) => handlePeriodChange(idx, 'startTime', e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-center focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs font-bold text-slate-400">-</span>
                  <input
                    type="time"
                    value={p.endTime}
                    onChange={(e) => handlePeriodChange(idx, 'endTime', e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-center focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleApplyToAll}
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
              <span>{saving ? 'Saving...' : `Save Timings for ${selectedDept}`}</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
};

export default AttendanceTimings;
