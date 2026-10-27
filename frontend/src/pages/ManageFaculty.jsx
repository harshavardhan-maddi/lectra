import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Edit, UploadCloud, Users, Phone, Loader, Plus, X, Trash2, KeyRound, CheckCircle2, FileText } from 'lucide-react';

const ManageFaculty = () => {
  const { token, user, registerUser } = useAuth();
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'missing'
  
  // Single edit state
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Single Add Faculty Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmpId, setNewEmpId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDesignation, setNewDesignation] = useState('Assistant Professor');
  const [newFacultyType, setNewFacultyType] = useState('TEACHING'); // 'TEACHING' | 'NON_TEACHING'
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Metadata storage for EmpID, Designation, Faculty Type (Teaching / Non-Teaching)
  const [facultyMetadata, setFacultyMetadata] = useState([]);

  const loadMetadata = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      setFacultyMetadata(stored);
    } catch (e) {
      setFacultyMetadata([]);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  const handleAddFacultySubmit = async (e) => {
    e.preventDefault();
    if (!newEmpId.trim() || !newName.trim() || !newPhone.trim() || !newDesignation.trim()) {
      setAddError('All fields (Emp ID, Name, Mobile Number, Designation) are required.');
      return;
    }

    setIsAdding(true);
    setAddError('');
    setAddSuccess('');

    try {
      // 1. Post to backend faculty table
      const res = await fetch('/api/faculty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          facultyName: newName.trim(),
          phoneNumber: newPhone.trim(),
        }),
      });

      // 2. Also register faculty login account with userId = Emp ID
      const assignedDept = user?.department || 'Department of CSE(emerging Technologies)';
      if (registerUser) {
        try {
          await registerUser(
            newName.trim(),
            newEmpId.trim(),
            'nrtec@nec',
            'FACULTY',
            null,
            assignedDept
          );
        } catch (regErr) {
          console.warn('Faculty login creation notice:', regErr.message);
        }
      }

      // 3. Save extra metadata (Emp ID, Designation, Teaching / Non-Teaching type)
      const existing = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const newEntry = {
        empid: newEmpId.trim(),
        name: newName.trim(),
        mobileNumber: newPhone.trim(),
        designation: newDesignation.trim(),
        facultyType: newFacultyType,
        department: assignedDept,
        updatedAt: new Date().toISOString()
      };
      const updated = [newEntry, ...existing.filter(item => 
        (item.empid && item.empid.toLowerCase() !== newEmpId.trim().toLowerCase()) &&
        (item.name && item.name.toLowerCase() !== newName.trim().toLowerCase())
      )];
      localStorage.setItem('lectra_faculty_metadata', JSON.stringify(updated));
      setFacultyMetadata(updated);

      setAddSuccess(`Faculty "${newName}" (${newFacultyType === 'NON_TEACHING' ? 'Non-Teaching' : 'Teaching'}) added successfully!`);
      await fetchFaculty();
      setTimeout(() => {
        setShowAddModal(false);
        setNewEmpId('');
        setNewName('');
        setNewPhone('');
        setNewDesignation('Assistant Professor');
        setNewFacultyType('TEACHING');
        setAddSuccess('');
      }, 1500);
    } catch (err) {
      setAddError(err.message || 'Failed to add faculty member');
    } finally {
      setIsAdding(false);
    }
  };

  // Bulk upload state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [parsedList, setParsedList] = useState([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkError, setBulkError] = useState('');

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/faculty', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setFaculty(data);
    } catch (err) {
      console.error('Failed to fetch faculty:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, [token]);

  // Parse CSV text into structured records
  const parseFacultyCsv = (text) => {
    setBulkError('');
    setBulkMessage('');
    if (!text || !text.trim()) {
      setParsedList([]);
      return;
    }

    // Strip UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    const parsed = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let parts = line.split(',');
      if (parts.length < 2 && line.includes('\t')) {
        parts = line.split('\t');
      }

      if (parts.length >= 1) {
        let fName = parts[0].replace(/^["']|["']$/g, '').trim();
        let secondPart = parts.length > 1 ? parts[1].replace(/^["']|["']$/g, '').trim() : '';
        let thirdPart = parts.length > 2 ? parts[2].replace(/^["']|["']$/g, '').trim() : '';

        // Skip header lines
        const lowerName = fName.toLowerCase();
        const lowerSecond = secondPart.toLowerCase();
        if (
          lowerName.includes('faculty name') ||
          lowerName.includes('name') && (lowerSecond.includes('login') || lowerSecond.includes('phone') || lowerSecond.includes('id'))
        ) {
          continue;
        }

        if (!fName) continue;

        let loginId = '';
        let phoneNumber = '';

        // Determine if second part is a phone number or login ID
        const isPhone = /^[+\d\s-]{7,15}$/.test(secondPart);
        if (isPhone) {
          phoneNumber = secondPart;
        } else {
          loginId = secondPart;
          phoneNumber = thirdPart;
        }

        parsed.push({
          facultyName: fName,
          loginId: loginId,
          phoneNumber: phoneNumber
        });
      }
    }

    setParsedList(parsed);
    if (parsed.length === 0) {
      setBulkError('No valid faculty records found in CSV text.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      setBulkData(content);
      parseFacultyCsv(content);
    };
    reader.onerror = () => {
      setBulkError('Failed to read CSV file from device.');
    };
    reader.readAsText(file);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/faculty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          facultyName: editingFaculty.facultyName,
          phoneNumber: editPhone,
        }),
      });
      if (res.ok) {
        await fetchFaculty();
        setEditingFaculty(null);
      } else {
        alert('Failed to update phone number');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving phone number');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/faculty/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (res.ok) {
        fetchFaculty();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete faculty');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting faculty');
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (parsedList.length === 0 && bulkData.trim()) {
      parseFacultyCsv(bulkData);
    }

    const itemsToProcess = parsedList.length > 0 ? parsedList : [];
    if (itemsToProcess.length === 0) {
      setBulkError('Please select or paste valid CSV data containing Faculty Name');
      return;
    }

    setIsBulkSaving(true);
    setBulkError('');
    setBulkMessage('');

    try {
      // 1. Bulk Upsert Faculty Contacts to database
      const facultyListPayload = itemsToProcess.map(item => ({
        facultyName: item.facultyName,
        phoneNumber: item.phoneNumber
      }));

      const res = await fetch('/api/faculty/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ facultyList: facultyListPayload }),
      });
      
      const data = await res.json();
      
      // 2. Also register faculty login accounts if Login ID is present
      let createdLoginsCount = 0;
      const assignedDept = user?.department || 'Department of CSE(emerging Technologies)';
      for (const item of itemsToProcess) {
        if (item.loginId && registerUser) {
          try {
            await registerUser(
              item.facultyName,
              item.loginId,
              'nrtec@nec',
              'FACULTY',
              null,
              assignedDept
            );
            createdLoginsCount++;
          } catch (regErr) {
            console.warn(`Login reg note for ${item.loginId}:`, regErr.message);
          }
        }
      }

      if (res.ok) {
        let msg = data.message || `Successfully processed ${itemsToProcess.length} faculty records.`;
        if (createdLoginsCount > 0) {
          msg += ` (${createdLoginsCount} faculty logins created with default password nrtec@nec)`;
        }
        setBulkMessage(msg);
        setBulkData('');
        setParsedList([]);
        fetchFaculty();
        setTimeout(() => setShowBulkModal(false), 2500);
      } else {
        setBulkError(data.message || 'Failed to bulk upload faculty contacts');
      }
    } catch (err) {
      console.error(err);
      setBulkError('Error during bulk upload');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const filteredFaculty = faculty.filter(f => {
    if (activeTab === 'missing' && f.phoneNumber && f.phoneNumber.trim() !== '') {
      return false;
    }
    const matchesSearch = f.facultyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.phoneNumber && f.phoneNumber.includes(searchQuery));
    return matchesSearch;
  });

  const missingCount = faculty.filter(f => !f.phoneNumber || f.phoneNumber.trim() === '').length;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark flex items-center gap-2">
            <Users size={24} className="text-primary-dark" />
            Faculty Contacts Management
          </h2>
          <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-1">
            Manage faculty phone numbers and batch import contacts or logins via CSV
          </p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            />
          </div>
          <button
            onClick={() => {
              setAddError('');
              setAddSuccess('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Faculty</span>
          </button>
          <button
            onClick={() => {
              setBulkError('');
              setBulkMessage('');
              setShowBulkModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-dark hover:bg-primary text-white rounded-xl font-bold text-sm shadow transition-all active:scale-[0.98] cursor-pointer"
          >
            <UploadCloud size={16} />
            <span className="hidden sm:inline">Bulk Add CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'all'
              ? 'bg-primary-dark text-white shadow-md shadow-primary-dark/20'
              : 'bg-white/40 dark:bg-slate-900/40 text-customText-muted hover:text-customText hover:bg-white/80 dark:hover:bg-slate-900/80 border border-slate-200/40 dark:border-slate-800/40'
          }`}
        >
          All Faculty ({faculty.length})
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'missing'
              ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
              : 'bg-white/40 dark:bg-slate-900/40 text-red-500 hover:bg-red-500/10 border border-slate-200/40 dark:border-slate-800/40'
          }`}
        >
          <span>Missing Mobile Numbers</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeTab === 'missing' ? 'bg-white text-red-500' : 'bg-red-500/10 text-red-500'}`}>
            {missingCount}
          </span>
        </button>
      </div>

      {/* Grid of Faculty */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFaculty.map(f => {
            const meta = facultyMetadata.find(m => 
              (m.name && m.name.toLowerCase() === f.facultyName.toLowerCase()) ||
              (m.mobileNumber && f.phoneNumber && m.mobileNumber === f.phoneNumber)
            );
            const isNonTeaching = meta?.facultyType === 'NON_TEACHING';

            return (
              <div key={f.id} className="glass-card p-4 flex flex-col justify-between hover:border-primary/30 transition-all group relative">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-base text-customText dark:text-customText-dark truncate" title={f.facultyName}>
                      {f.facultyName}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border shrink-0 ${
                      isNonTeaching
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    }`}>
                      {isNonTeaching ? 'Non-Teaching' : 'Teaching'}
                    </span>
                  </div>

                  {/* Emp ID and Designation if available */}
                  <div className="space-y-1 mb-2">
                    {meta?.empid && (
                      <span className="font-mono text-[11px] font-bold text-primary block">
                        Emp ID: {meta.empid}
                      </span>
                    )}
                    <span className="text-xs text-customText-muted font-semibold block">
                      {meta?.designation || 'Faculty Member'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-sm text-customText-muted dark:text-customText-mutedDark">
                    <Phone size={14} className={f.phoneNumber ? "text-green-500" : "text-slate-400"} />
                    <span className="font-mono text-xs">{f.phoneNumber || 'No phone number'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingFaculty(f);
                      setEditPhone(f.phoneNumber || '');
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-primary/20 transition-all cursor-pointer"
                  >
                    <Edit size={14} /> Edit Phone
                  </button>
                  <button
                    onClick={() => handleDelete(f.id, f.facultyName)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
          {filteredFaculty.length === 0 && (
            <div className="col-span-full text-center py-12 text-customText-muted border border-dashed rounded-xl">
              {activeTab === 'missing' 
                ? '🎉 Excellent! All faculty contacts have phone numbers assigned.'
                : 'No faculty found. Timetable syncing might be required or adjust your search.'}
            </div>
          )}
        </div>
      )}

      {/* Add Single Faculty Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark">
                    Add Faculty Member
                  </h3>
                  <p className="text-xs text-customText-muted">
                    Add faculty by Emp ID, Name, Mobile, Designation, and Teaching/Non-Teaching category
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)} 
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-customText-muted"
              >
                <X size={18} />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            {addSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{addSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddFacultySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Employee ID (Emp ID / Login ID) *
                  </label>
                  <input
                    type="text"
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value.toUpperCase())}
                    placeholder="e.g. EMP1024 or FAC01"
                    className="w-full glass-input text-xs font-mono uppercase py-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Faculty Full Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Dr. K. Srinivas"
                    className="w-full glass-input text-xs py-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full glass-input text-xs font-mono py-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Designation *
                  </label>
                  <select
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    className="w-full glass-input text-xs py-2.5"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Lab Assistant / Incharge">Lab Assistant / Incharge</option>
                    <option value="Office Administrative Staff">Office Administrative Staff</option>
                    <option value="Attender">Attender</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>
              </div>

              {/* Teaching or Non-Teaching selector */}
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">
                  Faculty Category *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    newFacultyType === 'TEACHING'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-customText'
                  }`}>
                    <input
                      type="radio"
                      name="facultyType"
                      value="TEACHING"
                      checked={newFacultyType === 'TEACHING'}
                      onChange={() => setNewFacultyType('TEACHING')}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-xs block">Teaching Faculty</span>
                      <span className="text-[10px] text-customText-muted block">
                        Can take student attendance, parent calls, and apply permissions
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    newFacultyType === 'NON_TEACHING'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-customText'
                  }`}>
                    <input
                      type="radio"
                      name="facultyType"
                      value="NON_TEACHING"
                      checked={newFacultyType === 'NON_TEACHING'}
                      onChange={() => setNewFacultyType('NON_TEACHING')}
                      className="mt-1 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold text-xs block">Non-Teaching Staff</span>
                      <span className="text-[10px] text-customText-muted block">
                        Unable to take attendance to students, just apply permissions
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary py-2.5 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {isAdding ? (
                    <span>Adding Faculty...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Save Faculty Member</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Edit Modal */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setEditingFaculty(null)} />
          <form onSubmit={handleEditSubmit} className="relative glass-card bg-white dark:bg-slate-900 w-full max-w-sm p-6 shadow-2xl animate-fade-in z-10">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark">Edit Contact</h3>
              <button type="button" onClick={() => setEditingFaculty(null)} className="p-1 hover:bg-slate-100 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-customText-muted uppercase mb-1">Faculty Name</label>
              <input type="text" value={editingFaculty.facultyName} disabled className="glass-input opacity-70" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold text-customText-muted uppercase mb-1">Phone Number</label>
              <input 
                type="tel" 
                value={editPhone} 
                onChange={(e) => setEditPhone(e.target.value)} 
                placeholder="+91..." 
                className="glass-input" 
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingFaculty(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSaving} className="btn-primary">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Upload CSV Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowBulkModal(false)} />
          <div className="relative glass-card bg-white dark:bg-slate-900 w-full max-w-2xl p-6 shadow-2xl animate-fade-in z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <div className="flex items-center gap-2">
                <UploadCloud size={22} className="text-primary-dark dark:text-primary" />
                <h3 className="font-extrabold text-lg text-customText dark:text-customText-dark">
                  Bulk Upload Faculty CSV
                </h3>
              </div>
              <button type="button" onClick={() => setShowBulkModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                Upload a <strong>.CSV</strong> file or paste content directly.<br/>
                Formats supported:<br/>
                • <span className="font-semibold text-customText dark:text-customText-dark">Faculty Name, Phone Number</span><br/>
                • <span className="font-semibold text-customText dark:text-customText-dark">Faculty Name, Login ID</span> (creates login with password <code className="bg-purple-500/10 text-purple-600 px-1 py-0.5 rounded font-mono">nrtec@nec</code>)
              </p>

              {bulkError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                  ⚠️ {bulkError}
                </div>
              )}

              {bulkMessage && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-semibold rounded-xl">
                  ✅ {bulkMessage}
                </div>
              )}

              {/* File Upload Selector */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1">
                  1. Select CSV File from Device
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  disabled={isBulkSaving}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20 dark:file:bg-primary-dark/20 dark:file:text-primary cursor-pointer border border-slate-200 dark:border-slate-800 rounded-xl p-1"
                />
              </div>

              {/* Raw Text Fallback */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1">
                  Or Paste CSV Lines
                </label>
                <textarea
                  value={bulkData}
                  onChange={(e) => {
                    setBulkData(e.target.value);
                    parseFacultyCsv(e.target.value);
                  }}
                  placeholder="Dr. John Smith, 9876543210&#10;Prof. Jane Doe, CSE101"
                  rows={4}
                  className="glass-input w-full font-mono text-xs resize-none"
                  disabled={isBulkSaving}
                />
              </div>

              {/* Parsed Preview Table */}
              {parsedList.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-dark dark:text-primary">
                      📋 Preview Ready ({parsedList.length} Records Found)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedList([]);
                        setBulkData('');
                      }}
                      className="text-[11px] text-slate-400 hover:text-red-500 underline"
                      disabled={isBulkSaving}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-2">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[10px] text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                          <th className="py-1 px-2">#</th>
                          <th className="py-1 px-2">Faculty Name</th>
                          <th className="py-1 px-2">Login ID</th>
                          <th className="py-1 px-2">Phone Number</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {parsedList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-1 px-2 font-bold text-customText dark:text-customText-dark">{item.facultyName}</td>
                            <td className="py-1 px-2 font-mono text-purple-600 dark:text-purple-400">{item.loginId || '—'}</td>
                            <td className="py-1 px-2 font-mono text-slate-500">{item.phoneNumber || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowBulkModal(false)} 
                  className="btn-secondary"
                  disabled={isBulkSaving}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleBulkUpload}
                  disabled={isBulkSaving || (parsedList.length === 0 && !bulkData.trim())} 
                  className="btn-primary flex items-center gap-2"
                >
                  <UploadCloud size={16} />
                  <span>{isBulkSaving ? 'Processing...' : `Process ${parsedList.length || 'CSV'} Records`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageFaculty;
