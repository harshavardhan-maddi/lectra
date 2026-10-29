import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { logActivity } from '../services/activityLogger';
import ModalSessionHeader from '../components/ModalSessionHeader';
import { Search, Edit, UploadCloud, Users, Phone, Loader, Plus, X, Trash2, KeyRound, CheckCircle2, FileText, Lock, Download, AlertCircle } from 'lucide-react';

const ManageFaculty = () => {
  const { token, user, registerUser } = useAuth();
  const toast = useToast();
  const isHOD = user?.role === 'HOD';
  const isAO = user?.role === 'AO';
  const defaultDept = isAO 
    ? (user?.department || 'Administrative Office') 
    : (user?.department || 'Department of CSE(emerging Technologies)');

  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(isAO ? 'office' : 'all'); // 'all', 'teaching', 'non_teaching', 'office', 'missing'
  
  // Single edit state
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Departments list state
  const [departmentsList, setDepartmentsList] = useState([
    'Administrative Office',
    'Department of CSE(emerging Technologies)',
    'Department of Computer Science and Engineering',
    'Department of Information Technology',
    'Department of Electronics and Communication Engineering',
    'Department of Electrical and Electronics Engineering',
    'Department of Mechanical Engineering',
    'Department of Civil Engineering',
    'Department of Basic Sciences and Humanities',
    'Department of MCA',
    'Department of MBA'
  ]);

  // Single Add Faculty Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmpId, setNewEmpId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDesignation, setNewDesignation] = useState(isAO ? 'Senior Assistant' : 'Assistant Professor');
  const [newFacultyType, setNewFacultyType] = useState(isAO ? 'OFFICE' : 'TEACHING'); // 'TEACHING' | 'NON_TEACHING' | 'OFFICE'
  const [newDepartment, setNewDepartment] = useState(defaultDept);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Bulk upload state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [parsedList, setParsedList] = useState([]);
  const [bulkDepartment, setBulkDepartment] = useState(defaultDept);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkError, setBulkError] = useState('');

  // Metadata storage for EmpID, Designation, Faculty Type (Teaching / Non-Teaching), Department
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

  useEffect(() => {
    if (user?.department) {
      setNewDepartment(user.department);
      setBulkDepartment(user.department);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/departments', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setDepartmentsList(Array.from(new Set([...departmentsList, ...data])));
          }
        })
        .catch(() => {});
    }
  }, [token]);

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
      // In HOD login, department is strictly fixed to HOD's department; in AO login, fixed to Administrative Office
      const assignedDept = isHOD
        ? (user?.department || 'Department of CSE(emerging Technologies)')
        : isAO
          ? (user?.department || 'Administrative Office')
          : (newDepartment || user?.department || 'Department of CSE(emerging Technologies)');

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
          department: assignedDept,
        }),
      });

      // 2. Also register faculty login account: Login ID = Emp ID, Password = nrtec@nec
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

      // 3. Save extra metadata (Emp ID, Designation, Teaching / Non-Teaching type, Department)
      const existing = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const newEntry = {
        empid: newEmpId.trim(),
        loginId: newEmpId.trim(),
        name: newName.trim(),
        mobileNumber: newPhone.trim(),
        designation: newDesignation.trim(),
        facultyType: newFacultyType,
        department: assignedDept,
        password: 'nrtec@nec',
        updatedAt: new Date().toISOString()
      };
      const updated = [newEntry, ...existing.filter(item => 
        (item.empid && item.empid.toLowerCase() !== newEmpId.trim().toLowerCase()) &&
        (item.name && item.name.toLowerCase() !== newName.trim().toLowerCase())
      )];
      localStorage.setItem('lectra_faculty_metadata', JSON.stringify(updated));
      setFacultyMetadata(updated);

      setAddSuccess(`Faculty "${newName}" added successfully! Login ID: ${newEmpId.trim()} | Password: nrtec@nec`);
      if (toast?.success) {
        toast.success(`Faculty member "${newName.trim()}" added successfully!`);
      }
      logActivity({
        user,
        action: 'ADD_FACULTY',
        category: 'Faculty',
        details: `Added faculty "${newName.trim()}" (${newEmpId.trim()}) to ${assignedDept} as ${newFacultyType}`,
        status: 'COMPLETED'
      });
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

  const downloadSampleCsv = () => {
    const headers = isHOD
      ? "Emp ID,Faculty Name,Mobile Number,Designation,Faculty Type"
      : "Emp ID,Faculty Name,Mobile Number,Designation,Department,Faculty Type";

    const rows = isHOD
      ? [
          "EMP1001,Dr. K. Srinivas,9876543210,Professor,TEACHING",
          "EMP1002,Mrs. M. Lakshmi,9848022334,Assistant Professor,NON_TEACHING",
          "EMP1003,Mr. P. Rajesh,9988776655,Associate Professor,TEACHING",
          "OFF2001,Mr. V. Suresh,9812345678,Senior Assistant,OFFICE"
        ]
      : [
          "EMP1001,Dr. K. Srinivas,9876543210,Professor,Department of CSE(emerging Technologies),TEACHING",
          "EMP1002,Mrs. M. Lakshmi,9848022334,Assistant Professor,Department of Information Technology,NON_TEACHING",
          "EMP1003,Mr. P. Rajesh,9988776655,Associate Professor,Department of Computer Science and Engineering,TEACHING",
          "OFF2001,Mr. V. Suresh,9812345678,Senior Assistant,Administrative Office,OFFICE"
        ];

    const csvText = [headers, ...rows].join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'faculty_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV text into structured records with Emp ID, Name, Mobile, Designation, Department, Faculty Type
  const parseFacultyCsv = (text) => {
    setBulkError('');
    setBulkMessage('');
    if (!text || !text.trim()) {
      setParsedList([]);
      return;
    }

    // Strip UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setParsedList([]);
      return;
    }

    const parsed = [];
    let headerMap = null;

    // Detect if line 0 is a header row
    const firstLineParts = lines[0].split(/[,\t]/).map(p => p.replace(/^["']|["']$/g, '').trim().toLowerCase());
    const hasHeader = firstLineParts.some(p => 
      p.includes('emp') || p.includes('id') || p.includes('name') || p.includes('mobile') || p.includes('phone') || p.includes('desig') || p.includes('dept')
    );

    let startIndex = 0;
    if (hasHeader) {
      headerMap = {};
      firstLineParts.forEach((header, idx) => {
        if (header.includes('emp') || header === 'id' || header.includes('login')) headerMap.empid = idx;
        else if (header.includes('name') || header.includes('faculty')) headerMap.name = idx;
        else if (header.includes('phone') || header.includes('mobile') || header.includes('contact')) headerMap.phone = idx;
        else if (header.includes('desig') || header.includes('role')) headerMap.designation = idx;
        else if (header.includes('dept') || header.includes('department')) headerMap.department = idx;
        else if (header.includes('type') || header.includes('category')) headerMap.facultyType = idx;
      });
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      let parts = line.split(',');
      if (parts.length < 2 && line.includes('\t')) {
        parts = line.split('\t');
      }
      parts = parts.map(p => p.replace(/^["']|["']$/g, '').trim());

      let empid = '';
      let facultyName = '';
      let phoneNumber = '';
      let designation = 'Assistant Professor';
      let department = isHOD ? (user?.department || 'Department of CSE(emerging Technologies)') : (bulkDepartment || user?.department || 'Department of CSE(emerging Technologies)');
      let facultyType = 'TEACHING';

      if (headerMap) {
        if (headerMap.empid !== undefined && parts[headerMap.empid]) empid = parts[headerMap.empid];
        if (headerMap.name !== undefined && parts[headerMap.name]) facultyName = parts[headerMap.name];
        if (headerMap.phone !== undefined && parts[headerMap.phone]) phoneNumber = parts[headerMap.phone];
        if (headerMap.designation !== undefined && parts[headerMap.designation]) designation = parts[headerMap.designation];
        if (headerMap.department !== undefined && parts[headerMap.department] && !isHOD) department = parts[headerMap.department];
        if (headerMap.facultyType !== undefined && parts[headerMap.facultyType]) {
          const t = parts[headerMap.facultyType].toUpperCase();
          facultyType = t.includes('OFFICE') ? 'OFFICE' : t.includes('NON') ? 'NON_TEACHING' : 'TEACHING';
        }
      } else {
        // Positional parsing fallback
        if (parts.length >= 4) {
          empid = parts[0];
          facultyName = parts[1];
          phoneNumber = parts[2];
          designation = parts[3] || 'Assistant Professor';
          if (parts[4] && !isHOD) department = parts[4];
          if (parts[5]) {
            const t = parts[5].toUpperCase();
            facultyType = t.includes('OFFICE') ? 'OFFICE' : t.includes('NON') ? 'NON_TEACHING' : 'TEACHING';
          }
        } else if (parts.length === 3) {
          const isThirdColPhone = /^[+\d\s-]{7,15}$/.test(parts[2]);
          if (/^[A-Za-z0-9_-]+$/.test(parts[0]) && parts[0].length < 25) {
            empid = parts[0];
            facultyName = parts[1];
            if (isThirdColPhone) {
              phoneNumber = parts[2];
            } else {
              designation = parts[2];
            }
          } else {
            facultyName = parts[0];
            empid = parts[1];
            if (isThirdColPhone) {
              phoneNumber = parts[2];
            } else {
              designation = parts[2];
            }
          }
        } else if (parts.length === 2) {
          facultyName = parts[0];
          if (/^[+\d\s-]{7,15}$/.test(parts[1])) {
            phoneNumber = parts[1];
            empid = 'FAC_' + facultyName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
          } else {
            empid = parts[1];
          }
        } else if (parts.length === 1 && parts[0]) {
          facultyName = parts[0];
          empid = 'FAC_' + facultyName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
        }
      }

      if (!empid && facultyName) {
        empid = 'FAC_' + facultyName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
      }

      if (facultyName) {
        parsed.push({
          empid: empid.toUpperCase(),
          facultyName,
          phoneNumber,
          designation,
          department,
          facultyType
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
        if (toast?.success) {
          toast.success(`Contact details updated for "${editingFaculty.facultyName}"!`);
        }
        logActivity({
          user,
          action: 'UPDATE_FACULTY_CONTACT',
          category: 'Faculty',
          details: `Updated phone number for "${editingFaculty.facultyName}" to ${editPhone}`,
          status: 'COMPLETED'
        });
        await fetchFaculty();
        setEditingFaculty(null);
      } else {
        if (toast?.error) toast.error('Failed to update phone number');
        else alert('Failed to update phone number');
      }
    } catch (err) {
      console.error(err);
      if (toast?.error) toast.error('Error saving phone number');
      else alert('Error saving phone number');
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
        if (toast?.success) toast.success(`Faculty "${name}" removed successfully.`);
        logActivity({
          user,
          action: 'DELETE_FACULTY',
          category: 'Faculty',
          details: `Deleted faculty record "${name}" (ID: ${id})`,
          status: 'COMPLETED'
        });
        fetchFaculty();
      } else {
        const data = await res.json();
        if (toast?.error) toast.error(data.message || 'Failed to delete faculty');
        else alert(data.message || 'Failed to delete faculty');
      }
    } catch (err) {
      console.error(err);
      if (toast?.error) toast.error('Error deleting faculty');
      else alert('Error deleting faculty');
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (parsedList.length === 0 && bulkData.trim()) {
      parseFacultyCsv(bulkData);
    }

    const itemsToProcess = parsedList.length > 0 ? parsedList : [];
    if (itemsToProcess.length === 0) {
      setBulkError('Please select or paste valid CSV data containing Faculty Name and Emp ID.');
      return;
    }

    setIsBulkSaving(true);
    setBulkError('');
    setBulkMessage('');

    try {
      // 1. Bulk Upsert Faculty Contacts to database
      const facultyListPayload = itemsToProcess.map(item => ({
        facultyName: item.facultyName,
        phoneNumber: item.phoneNumber,
        department: item.department
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
      
      // 2. Register faculty login accounts: Login ID = Emp ID, Password = nrtec@nec
      let createdLoginsCount = 0;
      for (const item of itemsToProcess) {
        const loginUserId = item.empid;
        if (loginUserId && registerUser) {
          try {
            await registerUser(
              item.facultyName,
              loginUserId,
              'nrtec@nec',
              'FACULTY',
              null,
              item.department
            );
            createdLoginsCount++;
          } catch (regErr) {
            console.warn(`Login reg note for ${loginUserId}:`, regErr.message);
          }
        }
      }

      // 3. Save extra metadata into lectra_faculty_metadata
      const existingMeta = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const newMetaEntries = itemsToProcess.map(item => ({
        empid: item.empid,
        loginId: item.empid,
        name: item.facultyName,
        mobileNumber: item.phoneNumber,
        designation: item.designation,
        facultyType: item.facultyType,
        department: item.department,
        password: 'nrtec@nec',
        updatedAt: new Date().toISOString()
      }));

      const mergedMeta = [...newMetaEntries, ...existingMeta.filter(ex => 
        !itemsToProcess.some(item => 
          (item.empid && ex.empid && item.empid.toLowerCase() === ex.empid.toLowerCase()) ||
          (item.facultyName && ex.name && item.facultyName.toLowerCase() === ex.name.toLowerCase())
        )
      )];
      localStorage.setItem('lectra_faculty_metadata', JSON.stringify(mergedMeta));
      setFacultyMetadata(mergedMeta);

      if (res.ok) {
        let msg = data.message || `Successfully processed ${itemsToProcess.length} faculty records.`;
        msg += ` (${itemsToProcess.length} faculty logins created with Login ID = Emp ID and password nrtec@nec)`;
        setBulkMessage(msg);
        if (toast?.success) {
          toast.success(`Successfully uploaded and registered ${itemsToProcess.length} faculty members!`);
        }
        logActivity({
          user,
          action: 'BULK_IMPORT_FACULTY',
          category: 'Faculty',
          details: `Bulk imported ${itemsToProcess.length} faculty members into ${isHOD ? user?.department : bulkDepartment}`,
          status: 'COMPLETED'
        });
        setBulkData('');
        setParsedList([]);
        fetchFaculty();
        setTimeout(() => setShowBulkModal(false), 2500);
      } else {
        setBulkError(data.message || 'Failed to bulk upload faculty contacts');
        if (toast?.error) toast.error(data.message || 'Failed to bulk upload faculty contacts');
      }
    } catch (err) {
      console.error(err);
      setBulkError('Error during bulk upload');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const filteredFaculty = faculty.filter(f => {
    const meta = facultyMetadata.find(m => 
      (m.name && m.name.toLowerCase() === f.facultyName.toLowerCase()) ||
      (m.mobileNumber && f.phoneNumber && m.mobileNumber === f.phoneNumber)
    );
    if (activeTab === 'missing' && f.phoneNumber && f.phoneNumber.trim() !== '') {
      return false;
    }
    if (activeTab === 'teaching' && meta?.facultyType && meta.facultyType !== 'TEACHING') {
      return false;
    }
    if (activeTab === 'non_teaching' && meta?.facultyType !== 'NON_TEACHING') {
      return false;
    }
    if (activeTab === 'office' && meta?.facultyType !== 'OFFICE') {
      return false;
    }
    const matchesSearch = f.facultyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.phoneNumber && f.phoneNumber.includes(searchQuery)) ||
      (meta?.empid && meta.empid.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const missingCount = faculty.filter(f => !f.phoneNumber || f.phoneNumber.trim() === '').length;
  const officeCount = faculty.filter(f => {
    const meta = facultyMetadata.find(m => 
      (m.name && m.name.toLowerCase() === f.facultyName.toLowerCase()) ||
      (m.mobileNumber && f.phoneNumber && m.mobileNumber === f.phoneNumber)
    );
    return meta?.facultyType === 'OFFICE';
  }).length;
  const nonTeachingCount = faculty.filter(f => {
    const meta = facultyMetadata.find(m => 
      (m.name && m.name.toLowerCase() === f.facultyName.toLowerCase()) ||
      (m.mobileNumber && f.phoneNumber && m.mobileNumber === f.phoneNumber)
    );
    return meta?.facultyType === 'NON_TEACHING';
  }).length;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark flex items-center gap-2">
            <Users size={24} className="text-primary-dark" />
            {isAO ? 'Office Staff & Directory Management' : 'Faculty Contacts Management'}
          </h2>
          <p className="text-xs text-customText-muted dark:text-customText-mutedDark mt-1">
            {isAO 
              ? 'Manage Administrative Office staff members, phone contacts, designations and default logins'
              : 'Manage faculty phone numbers and batch import contacts or logins via CSV'}
          </p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder={isAO ? "Search office staff..." : "Search faculty..."}
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
            <span className="hidden sm:inline">{isAO ? 'Add Office Staff' : 'Add Faculty'}</span>
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
      <div className="flex flex-wrap gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
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
          onClick={() => setActiveTab('teaching')}
          className={`px-3 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'teaching'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white/40 dark:bg-slate-900/40 text-customText-muted hover:text-customText hover:bg-white/80 dark:hover:bg-slate-900/80 border border-slate-200/40 dark:border-slate-800/40'
          }`}
        >
          Teaching
        </button>
        <button
          onClick={() => setActiveTab('non_teaching')}
          className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'non_teaching'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white/40 dark:bg-slate-900/40 text-customText-muted hover:text-customText hover:bg-white/80 dark:hover:bg-slate-900/80 border border-slate-200/40 dark:border-slate-800/40'
          }`}
        >
          <span>Non-Teaching</span>
          {nonTeachingCount > 0 && <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">{nonTeachingCount}</span>}
        </button>
        <button
          onClick={() => setActiveTab('office')}
          className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'office'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-white/40 dark:bg-slate-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border border-slate-200/40 dark:border-slate-800/40'
          }`}
        >
          <span>🏢 Office Staff</span>
          {officeCount > 0 && <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20">{officeCount}</span>}
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
            const isOffice = meta?.facultyType === 'OFFICE';

            return (
              <div key={f.id} className="glass-card p-4 flex flex-col justify-between hover:border-primary/30 transition-all group relative">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-base text-customText dark:text-customText-dark truncate" title={f.facultyName}>
                      {f.facultyName}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border shrink-0 ${
                      isOffice
                        ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                        : isNonTeaching
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    }`}>
                      {isOffice ? 'Office Staff' : isNonTeaching ? 'Non-Teaching' : 'Teaching'}
                    </span>
                  </div>

                  {/* Emp ID, Designation, Department */}
                  <div className="space-y-1 mb-2">
                    {meta?.empid ? (
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] font-bold text-primary block">
                          Emp ID: {meta.empid}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                          nrtec@nec
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-slate-400 block">
                        Login: nrtec@nec
                      </span>
                    )}
                    <span className="text-xs text-customText-muted font-semibold block">
                      {meta?.designation || 'Faculty Member'}
                    </span>
                    {!isHOD && (meta?.department || f.department) && (
                      <span className="text-[10px] text-customText-muted block truncate" title={meta?.department || f.department}>
                        🏛️ {meta?.department || f.department}
                      </span>
                    )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-wrapper-fullscreen">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm modal-backdrop-responsive" onClick={() => setShowAddModal(false)} />
          <div className="modal-window-fullscreen animate-fade-in z-10">
            <ModalSessionHeader
              title="Add Faculty Member"
              subtitle="Session: 2026–2027 • Faculty Directory Management"
              user={user}
              onClose={() => setShowAddModal(false)}
            />
            <form onSubmit={handleAddFacultySubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="modal-window-body">
                <div className="max-w-4xl mx-auto space-y-5">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">
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
                      <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">
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
                      <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">
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
                      <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">
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

                    {/* Department: Fixed in HOD login, selectable in other logins */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">
                        Department {isHOD ? '(Fixed to Your Department)' : '*'}
                      </label>
                      {isHOD ? (
                        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary-950/20 text-xs font-bold text-customText dark:text-customText-dark flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lock size={14} className="text-primary-dark dark:text-primary" />
                            <span>{user?.department || 'Department of CSE(emerging Technologies)'}</span>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary-dark dark:text-primary border border-primary/20">
                            Fixed in HOD Login
                          </span>
                        </div>
                      ) : (
                        <select
                          value={newDepartment}
                          onChange={(e) => setNewDepartment(e.target.value)}
                          className="w-full glass-input text-xs py-2.5"
                          required
                        >
                          {departmentsList.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Teaching or Non-Teaching selector */}
                  <div>
                    <label className="block text-xs font-bold text-customText-muted uppercase mb-2">
                      Faculty Category *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
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
                          <span className="text-[10px] text-customText-muted block mt-0.5">
                            Can take student attendance, parent calls, and apply permissions
                          </span>
                        </div>
                      </label>

                      <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
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
                          <span className="text-[10px] text-customText-muted block mt-0.5">
                            Unable to take student attendance, just apply permissions
                          </span>
                        </div>
                      </label>

                      <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                        newFacultyType === 'OFFICE'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-900 dark:text-blue-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-customText'
                      }`}>
                        <input
                          type="radio"
                          name="facultyType"
                          value="OFFICE"
                          checked={newFacultyType === 'OFFICE'}
                          onChange={() => setNewFacultyType('OFFICE')}
                          className="mt-1 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-bold text-xs block">🏢 Office Staff</span>
                          <span className="text-[10px] text-customText-muted block mt-0.5">
                            No student attendance; leaves route directly to AO login & Security
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Login credentials notice */}
                  <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-3 text-xs text-purple-700 dark:text-purple-300">
                    <KeyRound size={18} className="shrink-0 text-purple-600 dark:text-purple-400" />
                    <div className="leading-relaxed">
                      <span className="font-bold">System Login Credentials:</span> Login ID will be <strong className="font-mono bg-purple-500/20 px-1.5 py-0.5 rounded">{newEmpId || 'Emp ID'}</strong> and Password will be <strong className="font-mono bg-purple-500/20 px-1.5 py-0.5 rounded">nrtec@nec</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Window Sticky Footer */}
              <div className="modal-window-footer">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary py-2.5 px-5 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-wrapper-fullscreen">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm modal-backdrop-responsive" onClick={() => setEditingFaculty(null)} />
          <div className="modal-window-fullscreen animate-fade-in z-10">
            <ModalSessionHeader
              title="Edit Faculty Details"
              subtitle={`Modifying Contact for ${editingFaculty.facultyName}`}
              user={user}
              onClose={() => setEditingFaculty(null)}
            />
            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="modal-window-body">
                <div className="max-w-2xl mx-auto space-y-4 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">Faculty Name</label>
                    <input type="text" value={editingFaculty.facultyName} disabled className="glass-input opacity-70 w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">Phone Number *</label>
                    <input 
                      type="tel" 
                      value={editPhone} 
                      onChange={(e) => setEditPhone(e.target.value)} 
                      placeholder="+91..." 
                      className="glass-input w-full font-mono" 
                      autoFocus
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-window-footer">
                <button type="button" onClick={() => setEditingFaculty(null)} className="btn-secondary py-2.5 px-5 text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary py-2.5 px-6 text-xs font-black">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload CSV Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-wrapper-fullscreen">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm modal-backdrop-responsive" onClick={() => !isBulkSaving && setShowBulkModal(false)} />
          <div className="modal-window-fullscreen animate-fade-in z-10">
            <ModalSessionHeader
              title="Bulk Upload Faculty Directory"
              subtitle="Session: 2026–2027 • CSV Batch Import"
              user={user}
              onClose={() => !isBulkSaving && setShowBulkModal(false)}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="modal-window-body">
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Template Download Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                    <div>
                      <h4 className="text-xs font-extrabold text-customText dark:text-customText-dark">Need an official CSV template?</h4>
                      <p className="text-[11px] text-customText-muted mt-0.5">
                        Required Columns: Emp ID, Name, Phone Number, Designation{isHOD ? '' : ', Department'}, Category
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadSampleCsv}
                      className="px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary-dark dark:text-primary text-xs font-bold rounded-xl border border-primary/20 flex items-center gap-2 shrink-0 transition-all cursor-pointer"
                    >
                      <Download size={15} />
                      <span>Download Sample CSV</span>
                    </button>
                  </div>

                  {/* Department Scoping in Bulk Modal */}
                  {isHOD ? (
                    <div className="p-3.5 bg-primary/5 dark:bg-primary-950/20 border border-primary/20 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Lock size={15} className="text-primary-dark dark:text-primary shrink-0" />
                        <div>
                          <span className="font-bold text-customText dark:text-customText-dark">Department: </span>
                          <span className="font-extrabold text-primary-dark dark:text-primary">{user?.department || 'Department of CSE(emerging Technologies)'}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary-dark dark:text-primary shrink-0 border border-primary/20">
                        Fixed for HOD
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-customText-muted uppercase mb-1.5">
                        Default Department (for rows without department column)
                      </label>
                      <select
                        value={bulkDepartment}
                        onChange={(e) => setBulkDepartment(e.target.value)}
                        className="w-full glass-input text-xs py-2.5"
                      >
                        {departmentsList.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Login info notification */}
                  <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-3 text-xs text-purple-700 dark:text-purple-300">
                    <KeyRound size={18} className="shrink-0 text-purple-600 dark:text-purple-400" />
                    <span>
                      For all uploaded faculty: <strong>Login ID = Emp ID</strong> and <strong>Password = nrtec@nec</strong>
                    </span>
                  </div>

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
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                      1. Select CSV File from Device
                    </label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileChange}
                      disabled={isBulkSaving}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20 dark:file:bg-primary-dark/20 dark:file:text-primary cursor-pointer border border-slate-200 dark:border-slate-800 rounded-xl p-1.5"
                    />
                  </div>

                  {/* Raw Text Fallback */}
                  <div>
                    <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                      2. Or Paste CSV Lines Directly
                    </label>
                    <textarea
                      value={bulkData}
                      onChange={(e) => {
                        setBulkData(e.target.value);
                        parseFacultyCsv(e.target.value);
                      }}
                      placeholder={isHOD ? "EMP1001, Dr. John Smith, 9876543210, Professor, TEACHING\nEMP1002, Mrs. Jane Doe, 9848022334, Assistant Professor, NON_TEACHING" : "EMP1001, Dr. John Smith, 9876543210, Professor, Department of CSE(emerging Technologies), TEACHING"}
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

                      <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-2">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-[10px] text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                              <th className="py-1 px-2">#</th>
                              <th className="py-1 px-2">Emp ID (Login)</th>
                              <th className="py-1 px-2">Faculty Name</th>
                              <th className="py-1 px-2">Phone</th>
                              <th className="py-1 px-2">Designation</th>
                              <th className="py-1 px-2">Category</th>
                              {!isHOD && <th className="py-1 px-2">Department</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                            {parsedList.map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-1 px-2 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-1 px-2 font-mono font-bold text-primary">{item.empid}</td>
                                <td className="py-1 px-2 font-bold text-customText dark:text-customText-dark">{item.facultyName}</td>
                                <td className="py-1 px-2 font-mono text-slate-500">{item.phoneNumber || '—'}</td>
                                <td className="py-1 px-2 text-slate-500">{item.designation || 'Assistant Professor'}</td>
                                <td className="py-1 px-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    item.facultyType === 'OFFICE'
                                      ? 'bg-blue-500/10 text-blue-600'
                                      : item.facultyType === 'NON_TEACHING'
                                      ? 'bg-amber-500/10 text-amber-600'
                                      : 'bg-emerald-500/10 text-emerald-600'
                                  }`}>
                                    {item.facultyType === 'OFFICE' ? 'Office Staff' : item.facultyType === 'NON_TEACHING' ? 'Non-Teaching' : 'Teaching'}
                                  </span>
                                </td>
                                {!isHOD && <td className="py-1 px-2 text-[11px] text-slate-500 truncate max-w-[130px]">{item.department}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons in Sticky Footer */}
              <div className="modal-window-footer">
                <button 
                  type="button" 
                  onClick={() => setShowBulkModal(false)} 
                  className="btn-secondary py-2.5 px-5 text-xs font-bold"
                  disabled={isBulkSaving}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleBulkUpload}
                  disabled={isBulkSaving || (parsedList.length === 0 && !bulkData.trim())} 
                  className="btn-primary py-2.5 px-6 text-xs font-black flex items-center gap-2"
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
