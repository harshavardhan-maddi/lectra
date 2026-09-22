import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  Edit,
  CalendarPlus, 
  Clock, 
  BookOpen, 
  User, 
  Building,
  Calendar,
  X,
  Grid,
  List,
  Upload
} from 'lucide-react';

// Academic schedule: 7 periods × 50 min, break after P2, lunch after P4
const SCHEDULE_ROWS = [
  { type: 'period', no: 1, start: '09:10', end: '10:00', label: '9:10 – 10:00 AM' },
  { type: 'period', no: 2, start: '10:00', end: '10:50', label: '10:00 – 10:50 AM' },
  { type: 'break',  label: 'Short Break', time: '10:50 – 11:00 AM' },
  { type: 'period', no: 3, start: '11:00', end: '11:50', label: '11:00 – 11:50 AM' },
  { type: 'period', no: 4, start: '11:50', end: '12:40', label: '11:50 AM – 12:40 PM' },
  { type: 'lunch',  label: 'Lunch Break', time: '12:40 – 1:30 PM' },
  { type: 'period', no: 5, start: '13:30', end: '14:20', label: '1:30 – 2:20 PM' },
  { type: 'period', no: 6, start: '14:20', end: '15:10', label: '2:20 – 3:10 PM' },
  { type: 'period', no: 7, start: '15:10', end: '16:00', label: '3:10 – 4:00 PM' },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ManageClassrooms = () => {
  const { token, user } = useAuth();

  // Classrooms list state
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected Classroom structure
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Modals visibility
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);

  // Edit classroom states
  const [editingClassroom, setEditingClassroom] = useState(null);
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editClassName, setEditClassName] = useState('');

  // Bulk import states
  const [importTab, setImportTab] = useState('standard'); // 'standard', 'paste', or 'ai'
  const [aiLoading, setAiLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [importPreviewCount, setImportPreviewCount] = useState(0);
  const [importError, setImportError] = useState('');
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [csvText, setCsvText] = useState('');

  useEffect(() => {
    if (!showImportModal) {
      setImportFile(null);
      setImportData([]);
      setImportPreviewCount(0);
      setImportError('');
      setCsvText('');
      setImportTab('standard');
    }
  }, [showImportModal]);

  const handleCellClick = (day, pNo) => {
    setPeriodDay(day);
    setPeriodNo(pNo);
    
    // Look up default times from the schedule constant
    const row = SCHEDULE_ROWS.find(r => r.type === 'period' && r.no === pNo);
    setPeriodStart(row ? row.start : '09:10');
    setPeriodEnd(row ? row.end : '10:00');
    setShowAddPeriodModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');
    setImportData([]);
    setImportPreviewCount(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      try {
        let rawList = [];
        if (file.name.endsWith('.json')) {
          rawList = JSON.parse(text);
          if (!Array.isArray(rawList)) throw new Error('JSON file must be an array of objects');
        } else if (file.name.endsWith('.csv')) {
          rawList = parseCSV(text);
        } else {
          throw new Error('Unsupported file format. Please upload a .csv or .json file.');
        }

        if (rawList.length === 0) {
          throw new Error('The file is empty.');
        }

        // Loose validation of sample columns
        const sample = rawList[0];
        const missingFields = [];
        const required = ['day', 'period', 'subject', 'faculty'];
        const sampleKeys = Object.keys(sample).map(k => k.toLowerCase());
        
        required.forEach(reqKey => {
          if (!sampleKeys.some(sk => sk.includes(reqKey))) {
            missingFields.push(reqKey);
          }
        });

        if (missingFields.length > 0) {
          throw new Error(`Invalid headers format. Missing columns: ${missingFields.join(', ')}`);
        }

        const parsed = rawList.map(normalizeCsvRow);
        setImportData(parsed);
        setImportPreviewCount(parsed.length);
      } catch (err) {
        setImportError(err.message || 'Failed to parse file.');
        setImportFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleCsvTextChange = (e) => {
    const text = e.target.value;
    setCsvText(text);
    setImportError('');
    setImportData([]);
    setImportPreviewCount(0);

    if (!text.trim()) return;

    try {
      const rawList = parseCSV(text);
      if (rawList.length === 0) return;

      // Loose validation of columns
      const sample = rawList[0];
      const missingFields = [];
      const required = ['day', 'period', 'subject', 'faculty'];
      const sampleKeys = Object.keys(sample).map(k => k.toLowerCase());
      
      required.forEach(reqKey => {
        if (!sampleKeys.some(sk => sk.includes(reqKey))) {
          missingFields.push(reqKey);
        }
      });

      if (missingFields.length > 0) {
        throw new Error(`Missing columns: ${missingFields.join(', ')}`);
      }

      const parsed = rawList.map(normalizeCsvRow);
      setImportData(parsed);
      setImportPreviewCount(parsed.length);
    } catch (err) {
      setImportError(err.message || 'Failed to parse CSV text.');
    }
  };

  const handleAiFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel' || 
                    file.name.toLowerCase().endsWith('.xlsx') || 
                    file.name.toLowerCase().endsWith('.xls');

    if (!isPdf && !isExcel) {
      setImportError('Invalid file format. Please upload a PDF or Excel (.xlsx, .xls) file for AI analysis.');
      setImportFile(null);
      setImportData([]);
      setImportPreviewCount(0);
      return;
    }

    setImportFile(file);
    setImportError('');
    setImportData([]);
    setImportPreviewCount(0);
    setAiLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/timetables/upload-ai', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to analyze timetable file');

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('AI could not extract any timetable periods. Please check the file format or contents.');
      }

      setImportData(data);
      setImportPreviewCount(data.length);
    } catch (err) {
      setImportError(err.message || 'An error occurred during AI parsing.');
      setImportFile(null);
    } finally {
      setAiLoading(false);
    }
  };

  const normalizeCsvRow = (row) => {
    if (!row) return {};
    const keys = Object.keys(row);
    const getVal = (possibleKeys) => {
      const key = keys.find(k => possibleKeys.includes(k.toLowerCase()));
      return key ? String(row[key]).trim() : '';
    };

    const day = getVal(['day']);
    const periodVal = getVal(['period', 'periodno', 'period_no', 'periodnumber']);
    const periodNo = parseInt(periodVal) || 1;
    const startTime = getVal(['starttime', 'start_time', 'start']);
    const endTime = getVal(['endtime', 'end_time', 'end']);
    const subjectName = getVal(['subjectname', 'subject_name', 'subject', 'course', 'class']);
    const facultyName = getVal(['facultyname', 'faculty_name', 'faculty', 'teacher', 'staff', 'prof']);

    const STANDARD_PERIOD_TIMES = [
      { periodNo: 1, start: '09:10', end: '10:00' },
      { periodNo: 2, start: '10:00', end: '10:50' },
      { periodNo: 3, start: '11:00', end: '11:50' },
      { periodNo: 4, start: '11:50', end: '12:40' },
      { periodNo: 5, start: '13:30', end: '14:20' },
      { periodNo: 6, start: '14:20', end: '15:10' },
      { periodNo: 7, start: '15:10', end: '16:00' },
    ];

    let finalStart = startTime;
    let finalEnd = endTime;
    if (!finalStart || !finalEnd) {
      const std = STANDARD_PERIOD_TIMES.find(sp => sp.periodNo === periodNo);
      if (std) {
        finalStart = std.start;
        finalEnd = std.end;
      }
    }

    return {
      day: day || 'Monday',
      periodNo,
      startTime: finalStart || '09:10',
      endTime: finalEnd || '10:00',
      subjectName: subjectName || 'Class',
      facultyName: facultyName || 'Faculty',
    };
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
    const list = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = [];
      let currentVal = '';
      let insideQuotes = false;

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const char = line[charIdx];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentVal.trim().replace(/['"]/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/['"]/g, ''));

      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = values[idx] || '';
      });
      list.push(obj);
    }
    return list;
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClassroom || importData.length === 0) return;
    setImportSubmitting(true);
    setImportError('');

    try {
      const res = await fetch('/api/timetables/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          classroomId: selectedClassroom.id,
          periods: importData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to import timetable');

      setSuccess(`Imported ${data.count} timetable slots successfully!`);
      setShowImportModal(false);
      setImportFile(null);
      setImportData([]);
      setImportPreviewCount(0);
      fetchTimetable(selectedClassroom.id);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImportSubmitting(false);
    }
  };

  // Form states
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newClassName, setNewClassName] = useState('');

  const [periodDay, setPeriodDay] = useState('Monday');
  const [periodNo, setPeriodNo] = useState(1);
  const [periodStart, setPeriodStart] = useState('09:00');
  const [periodEnd, setPeriodEnd] = useState('10:00');
  const [periodFaculty, setPeriodFaculty] = useState('');
  const [periodSubject, setPeriodSubject] = useState('');

  const fetchClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch classrooms');
      setClassrooms(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimetable = async (classroomId) => {
    setLoadingSchedule(true);
    try {
      const res = await fetch(`/api/timetables/classroom/${classroomId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch timetable');
      setTimetable(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, [token]);

  const handleClassroomSelect = (classroom) => {
    setSelectedClassroom(classroom);
    fetchTimetable(classroom.id);
  };

  // Add Classroom handler
  const handleAddClassroom = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomNumber: newRoomNumber, className: newClassName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create classroom');

      setSuccess(`Classroom ${newRoomNumber} (${newClassName}) created successfully!`);
      setShowAddClassModal(false);
      setNewRoomNumber('');
      setNewClassName('');
      fetchClassrooms();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditClassroomClick = (classroomItem, e) => {
    e.stopPropagation(); // Avoid triggering card selection click
    setEditingClassroom(classroomItem);
    setEditRoomNumber(classroomItem.roomNumber);
    setEditClassName(classroomItem.className);
    setShowEditClassModal(true);
  };

  const handleEditClassroomSubmit = async (e) => {
    e.preventDefault();
    if (!editingClassroom) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/classrooms/${editingClassroom.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomNumber: editRoomNumber, className: editClassName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update classroom');

      setSuccess(`Classroom updated to ${editRoomNumber} (${editClassName}) successfully!`);
      setShowEditClassModal(false);
      setEditingClassroom(null);
      fetchClassrooms();
      
      // Update selected classroom if it was the one edited
      if (selectedClassroom?.id === editingClassroom.id) {
        setSelectedClassroom(data);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete Classroom (HOD ONLY)
  const handleDeleteClassroom = async (id, e) => {
    e.stopPropagation(); // Avoid triggering card selection click
    if (!window.confirm('Are you sure you want to delete this classroom? All its timetables and logs will be deleted.')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/classrooms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete classroom');

      setSuccess('Classroom deleted successfully.');
      if (selectedClassroom?.id === id) {
        setSelectedClassroom(null);
        setTimetable([]);
      }
      fetchClassrooms();
    } catch (err) {
      setError(err.message);
    }
  };

  // Add Timetable Period handler
  const handleAddPeriod = async (e) => {
    e.preventDefault();
    if (!selectedClassroom) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/timetables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          classroomId: selectedClassroom.id,
          day: periodDay,
          periodNo: parseInt(periodNo),
          startTime: periodStart,
          endTime: periodEnd,
          facultyName: periodFaculty,
          subjectName: periodSubject,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save timetable period');

      setSuccess(`Period ${periodNo} saved successfully!`);
      setShowAddPeriodModal(false);
      setPeriodFaculty('');
      setPeriodSubject('');
      fetchTimetable(selectedClassroom.id);
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete Timetable Period
  const handleDeletePeriod = async (periodId) => {
    if (!window.confirm('Are you sure you want to delete this timetable period?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/timetables/${periodId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete period');
      }

      setSuccess('Period deleted successfully.');
      fetchTimetable(selectedClassroom.id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4"></div>
          <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header and triggers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark tracking-tight">
            Classroom & Schedule Planner
          </h2>
          <p className="text-sm text-customText-muted dark:text-customText-mutedDark">
            Manage academic classrooms and assign faculty timetables
          </p>
        </div>
        <button
          onClick={() => setShowAddClassModal(true)}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Add Classroom</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl animate-shake">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-semibold rounded-xl">
          ✅ {success}
        </div>
      )}

      {/* Grid: Classrooms Selection list + Selected Timetable Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Classrooms Cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-4 bg-white/40 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-2xl backdrop-blur-sm">
            <h3 className="font-bold text-sm text-customText dark:text-customText-dark mb-1">
              Select a Classroom
            </h3>
            <p className="text-[11px] text-customText-muted dark:text-customText-mutedDark">
              Click a classroom to configure its weekly timetable schedule
            </p>
          </div>

          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {classrooms.map((c) => {
              const isSelected = selectedClassroom?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleClassroomSelect(c)}
                  className={`glass-card p-4 flex items-center justify-between cursor-pointer border-2 transition-all ${
                    isSelected 
                      ? 'border-primary dark:border-primary-dark/80 bg-primary/5' 
                      : 'border-slate-200/50 dark:border-slate-800/50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-customText-muted dark:text-customText-mutedDark">
                      <Building size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-customText dark:text-customText-dark">{c.className}</h4>
                      <p className="text-xs text-customText-muted dark:text-customText-mutedDark">Room: {c.roomNumber}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {(user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') && (
                      <button
                        onClick={(e) => handleEditClassroomClick(c, e)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit classroom"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {(user?.role === 'HOD' || user?.role === 'SUPER_ADMIN') && (
                      <button
                        onClick={(e) => handleDeleteClassroom(c.id, e)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                        title="Delete classroom"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {classrooms.length === 0 && (
              <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed text-xs text-customText-muted">
                No classrooms registered yet. Add one to start.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Selected Classroom Schedule */}
        <div className="lg:col-span-2">
          {selectedClassroom ? (
            <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40 space-y-6">
              
              {/* Classroom timetable header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                    {selectedClassroom.roomNumber} Planner
                  </span>
                  <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark mt-1">
                    {selectedClassroom.className} Weekly Timetable
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Switcher Toggle */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-850 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 mr-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-slate-900 shadow text-primary-dark dark:text-primary'
                          : 'text-customText-muted dark:text-customText-mutedDark hover:text-customText'
                      }`}
                      title="Weekly Grid View"
                    >
                      <Grid size={14} />
                      <span className="hidden sm:inline">Grid</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-slate-900 shadow text-primary-dark dark:text-primary'
                          : 'text-customText-muted dark:text-customText-mutedDark hover:text-customText'
                      }`}
                      title="List View"
                    >
                      <List size={14} />
                      <span className="hidden sm:inline">List</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setPeriodDay('Monday');
                      setPeriodNo(1);
                      setPeriodStart('08:00');
                      setPeriodEnd('09:00');
                      setShowAddPeriodModal(true);
                    }}
                    className="btn-primary py-2 px-3 text-xs"
                  >
                    <CalendarPlus size={15} />
                    <span>Assign Period</span>
                  </button>

                  <button
                    onClick={() => {
                      setImportTab('standard');
                      setAiLoading(false);
                      setImportFile(null);
                      setImportError('');
                      setImportData([]);
                      setImportPreviewCount(0);
                      setShowImportModal(true);
                    }}
                    className="btn-secondary py-2 px-3 text-xs"
                  >
                    <Upload size={14} />
                    <span>Bulk Import</span>
                  </button>
                </div>
              </div>

              {/* Schedule grid/list views */}
              {loadingSchedule ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
                  <p className="text-xs text-customText-muted">Loading schedule details...</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="overflow-x-auto border border-slate-200/60 dark:border-slate-800/60 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-850 text-customText-muted dark:text-customText-mutedDark font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3 text-center border-r border-slate-200/60 dark:border-slate-800/60 w-24">Period</th>
                        {WEEKDAYS.map((day) => (
                          <th key={day} className="p-3 text-center border-r border-slate-200/60 dark:border-slate-800/60 last:border-r-0">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                      {SCHEDULE_ROWS.map((row, rowIdx) => {
                        // Break / Lunch separator row
                        if (row.type === 'break' || row.type === 'lunch') {
                          return (
                            <tr key={`${row.type}-${rowIdx}`}>
                              <td
                                colSpan={WEEKDAYS.length + 1}
                                className={`py-2 px-4 text-center text-[11px] font-bold tracking-wide ${
                                  row.type === 'lunch'
                                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-y border-amber-200/60 dark:border-amber-800/40'
                                    : 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border-y border-sky-200/60 dark:border-sky-800/40'
                                }`}
                              >
                                {row.type === 'lunch' ? '🍽️' : '☕'} {row.label}
                                <span className="ml-2 font-semibold opacity-70">({row.time})</span>
                              </td>
                            </tr>
                          );
                        }

                        // Period row
                        const pNo = row.no;
                        return (
                          <tr key={pNo} className="hover:bg-slate-50/10 dark:hover:bg-slate-900/5">
                            <td className="p-2 text-center font-bold bg-slate-50/40 dark:bg-slate-950/10 border-r border-slate-200/60 dark:border-slate-800/60">
                              <span className="block text-slate-800 dark:text-slate-200">P {pNo}</span>
                              <span className="block text-[8px] font-semibold text-customText-muted dark:text-customText-mutedDark mt-0.5">
                                {row.label}
                              </span>
                            </td>
                            {WEEKDAYS.map((day) => {
                              const match = timetable.find((p) => p.day === day && p.periodNo === pNo);
                              // Detect multi-period labs: same subject+faculty in adjacent period
                              const prevMatch = pNo > 1 ? timetable.find((p) => p.day === day && p.periodNo === pNo - 1) : null;
                              const nextMatch = pNo < 7 ? timetable.find((p) => p.day === day && p.periodNo === pNo + 1) : null;
                              const isLabBlock = match && (
                                (prevMatch && prevMatch.subjectName === match.subjectName && prevMatch.facultyName === match.facultyName) ||
                                (nextMatch && nextMatch.subjectName === match.subjectName && nextMatch.facultyName === match.facultyName)
                              );
                              return (
                                <td key={day} className="p-2 border-r border-slate-200/60 dark:border-slate-800/60 last:border-r-0 text-center align-middle relative">
                                  {match ? (
                                    <div className={`p-2 border rounded-xl min-h-[68px] flex flex-col justify-between relative group/cell ${
                                      isLabBlock
                                        ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-300/40 dark:border-violet-700/40'
                                        : 'bg-primary/5 dark:bg-primary-dark/10 border-primary/20 dark:border-primary-dark/30'
                                    }`}>
                                      <button
                                        onClick={() => handleDeletePeriod(match.id)}
                                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover/cell:opacity-100 transition-opacity duration-200 z-10 shadow"
                                        title="Delete period"
                                      >
                                        <X size={10} strokeWidth={2.5} />
                                      </button>
                                      {isLabBlock && (
                                        <span className="absolute -top-1.5 left-1.5 text-[7px] font-black uppercase tracking-wider bg-violet-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                          Lab
                                        </span>
                                      )}
                                      <div className="min-w-0">
                                        <p className="font-extrabold text-[10px] text-customText dark:text-customText-dark truncate" title={match.subjectName}>
                                          {match.subjectName}
                                        </p>
                                        <p className="text-[9px] text-customText-muted dark:text-customText-mutedDark truncate font-medium mt-0.5" title={match.facultyName}>
                                          {match.facultyName}
                                        </p>
                                      </div>
                                      <span className="text-[8px] font-bold text-primary-dark dark:text-primary mt-1 block">
                                        {match.startTime}-{match.endTime}
                                      </span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleCellClick(day, pNo)}
                                      className="w-full min-h-[68px] border border-dashed border-slate-200 dark:border-slate-800/60 hover:border-primary/50 dark:hover:border-primary-dark/50 hover:bg-primary/5 rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-700 hover:text-primary transition-all group/btn"
                                    >
                                      <Plus size={16} className="group-hover/btn:scale-110 transition-transform duration-200" />
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : timetable.length === 0 ? (
                <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-900/30 border border-dashed rounded-xl text-customText-muted dark:text-customText-mutedDark text-sm">
                  No weekly timetables assigned to this classroom. Click "Assign Period" above to configure.
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {WEEKDAYS.map((day) => {
                    const periodsForDay = timetable.filter((p) => p.day === day).sort((a, b) => a.periodNo - b.periodNo);
                    if (periodsForDay.length === 0) return null;

                    return (
                      <div key={day} className="space-y-2">
                        <h4 className="font-bold text-xs uppercase text-primary-dark tracking-wider border-l-2 border-primary-dark pl-2">
                          {day}
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {periodsForDay.map((p) => (
                            <div
                              key={p.id}
                              className="p-3.5 bg-slate-50/70 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/40 rounded-xl flex items-center justify-between transition-all hover:bg-white dark:hover:bg-slate-900"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-customText bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/30 dark:border-slate-700/25">
                                    Period {p.periodNo}
                                  </span>
                                  <span className="text-[10px] font-semibold text-customText-muted dark:text-customText-mutedDark flex items-center gap-1">
                                    <Clock size={10} />
                                    {p.startTime} - {p.endTime}
                                  </span>
                                </div>

                                <h5 className="font-bold text-xs text-customText dark:text-customText-dark truncate">
                                  {p.subjectName}
                                </h5>

                                <p className="text-[10px] text-customText-muted dark:text-customText-mutedDark flex items-center gap-1">
                                  <User size={10} />
                                  <span>Faculty: <span className="font-semibold text-customText dark:text-customText-dark">{p.facultyName}</span></span>
                                </p>
                              </div>

                              <button
                                onClick={() => handleDeletePeriod(p.id)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                                title="Remove Period"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          ) : (
            <div className="glass-card p-12 border border-slate-200/50 dark:border-slate-800/40 text-center flex flex-col items-center justify-center gap-3">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/80 text-customText-muted">
                <Calendar size={28} />
              </div>
              <h4 className="font-bold text-base text-customText dark:text-customText-dark">
                No Classroom Selected
              </h4>
              <p className="text-xs text-customText-muted dark:text-customText-mutedDark max-w-sm">
                Select an academic classroom from the left side panel to load and modify its weekly period calendar.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL 1: ADD CLASSROOM */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddClassModal(false)} />
          
          <form 
            onSubmit={handleAddClassroom}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-md p-6 shadow-2xl animate-fade-in z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                Register New Classroom
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddClassModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                  Room Number (e.g., Room 301)
                </label>
                <input
                  type="text"
                  required
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                  placeholder="e.g. Room 301"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                  Class Name (e.g., CSE 3rd Year)
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. CSE 3rd Year"
                  className="glass-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowAddClassModal(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Add Classroom
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT CLASSROOM */}
      {showEditClassModal && editingClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowEditClassModal(false)} />
          
          <form 
            onSubmit={handleEditClassroomSubmit}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-md p-6 shadow-2xl animate-fade-in z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                Edit Classroom Details
              </h3>
              <button 
                type="button"
                onClick={() => setShowEditClassModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                  Room Number
                </label>
                <input
                  type="text"
                  required
                  value={editRoomNumber}
                  onChange={(e) => setEditRoomNumber(e.target.value)}
                  placeholder="e.g. Room 301"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                  Class Name
                </label>
                <input
                  type="text"
                  required
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  placeholder="e.g. CSE 3rd Year"
                  className="glass-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowEditClassModal(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: ASSIGN SCHEDULE PERIOD */}
      {showAddPeriodModal && selectedClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddPeriodModal(false)} />
          
          <form 
            onSubmit={handleAddPeriod}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-lg p-6 shadow-2xl animate-fade-in z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase">{selectedClassroom.roomNumber}</span>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Assign Timetable Period
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddPeriodModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Day of Week
                </label>
                <select
                  value={periodDay}
                  onChange={(e) => setPeriodDay(e.target.value)}
                  className="glass-input text-sm"
                >
                  {WEEKDAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Period Number (1 - 7)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="7"
                  value={periodNo}
                  onChange={(e) => setPeriodNo(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Start Time (HH:MM)
                </label>
                <input
                  type="time"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  End Time (HH:MM)
                </label>
                <input
                  type="time"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Subject Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <BookOpen size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={periodSubject}
                    onChange={(e) => setPeriodSubject(e.target.value)}
                    placeholder="e.g. Computer Networks"
                    className="glass-input pl-9"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Assign Faculty Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={periodFaculty}
                    onChange={(e) => setPeriodFaculty(e.target.value)}
                    placeholder="e.g. Dr. Srinivas Rao"
                    className="glass-input pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowAddPeriodModal(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: BULK IMPORT TIMETABLE */}
      {showImportModal && selectedClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !importSubmitting && !aiLoading && setShowImportModal(false)} />
          
          <form 
            onSubmit={handleBulkImportSubmit}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-lg p-6 shadow-2xl animate-fade-in z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase">{selectedClassroom.roomNumber}</span>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Bulk Import Weekly Timetable
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => !importSubmitting && !aiLoading && setShowImportModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={importSubmitting || aiLoading}
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab buttons */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (importSubmitting || aiLoading) return;
                  setImportTab('standard');
                  setImportFile(null);
                  setImportError('');
                  setImportData([]);
                  setImportPreviewCount(0);
                }}
                className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-all ${
                  importTab === 'standard'
                    ? 'border-primary text-primary-dark dark:text-primary'
                    : 'border-transparent text-customText-muted dark:text-customText-mutedDark hover:text-customText'
                }`}
                disabled={importSubmitting || aiLoading}
              >
                Standard File
              </button>
              <button
                type="button"
                onClick={() => {
                  if (importSubmitting || aiLoading) return;
                  setImportTab('paste');
                  setImportFile(null);
                  setImportError('');
                  setImportData([]);
                  setImportPreviewCount(0);
                }}
                className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-all ${
                  importTab === 'paste'
                    ? 'border-primary text-primary-dark dark:text-primary'
                    : 'border-transparent text-customText-muted dark:text-customText-mutedDark hover:text-customText'
                }`}
                disabled={importSubmitting || aiLoading}
              >
                Paste CSV Text
              </button>
              <button
                type="button"
                onClick={() => {
                  if (importSubmitting || aiLoading) return;
                  setImportTab('ai');
                  setImportFile(null);
                  setImportError('');
                  setImportData([]);
                  setImportPreviewCount(0);
                }}
                className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-all ${
                  importTab === 'ai'
                    ? 'border-primary text-primary-dark dark:text-primary'
                    : 'border-transparent text-customText-muted dark:text-customText-mutedDark hover:text-customText'
                }`}
                disabled={importSubmitting || aiLoading}
              >
                AI Timetable Parser (PDF/Excel)
              </button>
            </div>

            {importError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                ⚠️ {importError}
              </div>
            )}

            <div className="space-y-4">
              {/* Standard tab instructions and input */}
              {importTab === 'standard' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border text-xs space-y-2 text-customText-muted dark:text-customText-mutedDark">
                    <p className="font-bold text-customText dark:text-customText-dark">CSV Formatting Instructions:</p>
                    <p>Provide a CSV file with these exact column headers:</p>
                    <code className="block bg-white dark:bg-slate-900 p-2 rounded border font-mono whitespace-nowrap overflow-x-auto text-[10px]">
                      day,periodNo,startTime,endTime,subjectName,facultyName
                    </code>
                    <p className="pt-2 font-bold text-customText dark:text-customText-dark">Sample Row:</p>
                    <code className="block bg-white dark:bg-slate-900 p-2 rounded border font-mono whitespace-nowrap overflow-x-auto text-[10px]">
                      Monday,1,09:00,10:00,Computer Networks,Dr. Srinivas Rao
                    </code>
                    <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold italic">
                      ⚠️ Note: Importing will replace all existing scheduled periods for this classroom.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                      Select Timetable File (.csv or .json)
                    </label>
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileChange}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20 cursor-pointer"
                      required={importTab === 'standard'}
                    />
                  </div>
                </div>
              )}

              {/* Paste CSV text instructions and textarea */}
              {importTab === 'paste' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border text-xs space-y-2 text-customText-muted dark:text-customText-mutedDark">
                    <p className="font-bold text-customText dark:text-customText-dark">CSV Format Instructions:</p>
                    <p>Paste CSV rows with headers. Headers must include: <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded border font-mono">day,period,subject,faculty</code></p>
                    <p className="pt-2 font-bold text-customText dark:text-customText-dark">Example:</p>
                    <code className="block bg-white dark:bg-slate-900 p-2 rounded border font-mono text-[9px] leading-relaxed whitespace-pre overflow-x-auto">
Day,Period,Subject,Faculty{"\n"}
Monday,1,Computer Networks,Dr. Srinivas Rao{"\n"}
Monday,2,Artificial Intelligence,Dr. Sarah Thomas
                    </code>
                    <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold italic">
                      ⚠️ Note: Importing will replace all existing scheduled periods for this classroom.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                      CSV Text Input
                    </label>
                    <textarea
                      value={csvText}
                      onChange={handleCsvTextChange}
                      rows={6}
                      placeholder="Day,Period,Subject,Faculty&#10;Monday,1,Computer Networks,Dr. Srinivas Rao&#10;Monday,2,Artificial Intelligence,Dr. Sarah Thomas"
                      className="w-full glass-input text-xs font-mono p-3 rounded-xl border focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-950 dark:border-slate-800"
                      required={importTab === 'paste'}
                    />
                  </div>
                </div>
              )}

              {/* AI tab instructions and input */}
              {importTab === 'ai' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 p-4 rounded-xl border border-primary/20 text-xs space-y-2 text-customText-muted dark:text-customText-mutedDark">
                    <p className="font-bold text-primary-dark dark:text-primary">Llama3 AI Timetable Parser Instructions:</p>
                    <p>Upload a standard PDF timetable schedule or an Excel sheet (.xlsx, .xls) containing the weekly timetable.</p>
                    <p>The AI will scan the document, parse its layout structure, and extract the schedule periods automatically.</p>
                    <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold italic">
                      ⚠️ Note: Importing will replace all existing scheduled periods for this classroom.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-2">
                      Select Timetable Document (.pdf, .xlsx, .xls)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls"
                      onChange={handleAiFileChange}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20 cursor-pointer"
                      required={importTab === 'ai'}
                      disabled={aiLoading}
                    />
                  </div>

                  {aiLoading && (
                    <div className="flex flex-col items-center justify-center py-6 gap-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-primary/30 animate-pulse">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                      <p className="text-xs font-semibold text-primary">Analyzing schedule with Llama3 AI... (may take up to 10 seconds)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview extracted schedule periods */}
              {importPreviewCount > 0 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-750 dark:text-green-300 text-xs">
                    <p className="font-bold">File Parsed Successfully!</p>
                    <p className="mt-1">Ready to import <span className="font-bold">{importPreviewCount} schedule periods</span> for {selectedClassroom.className}. Review them below:</p>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800/80 rounded-xl">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-customText-muted font-bold sticky top-0 bg-white dark:bg-slate-900 z-10">
                          <th className="p-2 border-b">Day</th>
                          <th className="p-2 border-b">Period</th>
                          <th className="p-2 border-b">Time</th>
                          <th className="p-2 border-b">Subject</th>
                          <th className="p-2 border-b">Faculty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {importData.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 text-customText dark:text-customText-dark">
                            <td className="p-2 font-semibold">{p.day}</td>
                            <td className="p-2">P{p.periodNo || p.periodno || p.period}</td>
                            <td className="p-2">{p.startTime || p.starttime || p.start} - {p.endTime || p.endtime || p.end}</td>
                            <td className="p-2 truncate max-w-[100px]" title={p.subjectName || p.subjectname || p.subject}>{p.subjectName || p.subjectname || p.subject}</td>
                            <td className="p-2 truncate max-w-[100px]" title={p.facultyName || p.facultyname || p.faculty}>{p.facultyName || p.facultyname || p.faculty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowImportModal(false)} 
                className="btn-secondary"
                disabled={importSubmitting || aiLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary"
                disabled={importSubmitting || aiLoading || importPreviewCount === 0}
              >
                {importSubmitting ? 'Importing...' : 'Upload & Import Timetable'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default ManageClassrooms;
