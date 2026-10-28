import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { 
  getAllOutpasses, 
  subscribeToOutpasses, 
  aoApproveHodLeave, 
  aoRejectHodLeave 
} from '../services/outpassService';
import { 
  ShieldCheck, 
  Clock, 
  Calendar, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  User, 
  Building, 
  FileText, 
  Filter, 
  RefreshCw,
  DoorOpen,
  ArrowRight,
  Users,
  UserPlus,
  Phone,
  KeyRound,
  Trash2,
  Edit,
  Plus,
  X,
  Lock,
  Briefcase,
  Copy,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import OutpassTicketModal from '../components/OutpassTicketModal';

const COMMON_DESIGNATIONS = [
  'Administrative Superintendent',
  'Senior Assistant',
  'Junior Assistant',
  'Accountant / Cashier',
  'Record Assistant',
  'Office Attender / Peon',
  'Data Entry Operator',
  'Clerk',
  'Computer Operator'
];

const SAMPLE_CSV = `emp id, name, designation
OFF2001, K. Rama Rao, Senior Assistant
OFF2002, M. Lakshmi, Junior Assistant
OFF2003, P. Venkat, Accountant
OFF2004, S. Suresh, Record Assistant
OFF2005, G. Ramesh, Office Attender`;

const AODashboard = () => {
  const { user, token, registerUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  // Primary view mode: 'approvals' (leaves) or 'staff' (office staff management)
  const initialTab = searchParams.get('tab') === 'staff' ? 'staff' : 'approvals';
  const [mainView, setMainView] = useState(initialTab);

  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // Approvals filter tab: 'PENDING' | 'GRANTED' | 'COMPLETED' | 'REJECTED' | 'ALL'
  const initialFilterTab = ['PENDING', 'GRANTED', 'COMPLETED', 'REJECTED', 'ALL'].includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'PENDING';
  const [filterTab, setFilterTab] = useState(initialFilterTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  
  // Rejection modal
  const [rejectingTicket, setRejectingTicket] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Office Staff Directory states
  const [officeStaffList, setOfficeStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Single Add Office Staff Modal states
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffEmpId, setNewStaffEmpId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffDesignation, setNewStaffDesignation] = useState('Senior Assistant');
  const [customDesignation, setCustomDesignation] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [addStaffError, setAddStaffError] = useState('');
  const [addStaffSuccess, setAddStaffSuccess] = useState('');

  // Bulk Upload Office Staff CSV states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [parsedBulkList, setParsedBulkList] = useState([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');

  // Edit Office Staff Modal states
  const [editingStaff, setEditingStaff] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'staff') {
      setMainView('staff');
    } else if (['PENDING', 'GRANTED', 'COMPLETED', 'REJECTED', 'ALL'].includes(tab)) {
      setMainView('approvals');
      setFilterTab(tab);
    }
  }, [searchParams]);

  const loadTickets = () => {
    setTickets(getAllOutpasses());
  };

  const loadOfficeStaff = async () => {
    setStaffLoading(true);
    try {
      // 1. Fetch from backend faculty table
      let backendList = [];
      if (token) {
        try {
          const res = await fetch('/api/faculty', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            backendList = await res.json();
          }
        } catch (e) {
          console.warn('Backend faculty fetch error:', e);
        }
      }

      // 2. Read metadata stored in localStorage
      let metadataList = [];
      try {
        metadataList = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      } catch (e) {
        metadataList = [];
      }

      // 3. Filter for Office Staff: facultyType === 'OFFICE' or department === 'Administrative Office'
      const officeMetadata = metadataList.filter(m => 
        m.facultyType === 'OFFICE' || 
        (m.department && m.department.toLowerCase().includes('office'))
      );

      // Merge backend faculty records belonging to Administrative Office
      const mergedMap = new Map();

      // First add from metadata
      officeMetadata.forEach(m => {
        const key = (m.empid || m.name || '').toLowerCase();
        mergedMap.set(key, {
          id: m.id || null,
          empid: m.empid || m.loginId || 'OFFICE',
          loginId: m.loginId || m.empid || 'OFFICE',
          name: m.name || 'Office Staff',
          phoneNumber: m.mobileNumber || m.phoneNumber || '',
          designation: m.designation || 'Office Assistant',
          facultyType: 'OFFICE',
          department: m.department || 'Administrative Office',
          password: m.password || 'nrtec@nec',
          updatedAt: m.updatedAt || new Date().toISOString()
        });
      });

      // Overlay with backend records
      (backendList || []).forEach(f => {
        const isOfficeDept = f.department && f.department.toLowerCase().includes('office');
        const matchMeta = officeMetadata.find(m => 
          (m.name && m.name.toLowerCase() === f.facultyName?.toLowerCase()) ||
          (m.mobileNumber && f.phoneNumber && m.mobileNumber === f.phoneNumber)
        );

        if (isOfficeDept || matchMeta) {
          const key = (matchMeta?.empid || f.facultyName || '').toLowerCase();
          const existing = mergedMap.get(key) || {};
          mergedMap.set(key, {
            ...existing,
            id: f.id,
            name: f.facultyName,
            phoneNumber: f.phoneNumber || existing.phoneNumber || '',
            empid: existing.empid || matchMeta?.empid || `OFF${f.id || '101'}`,
            loginId: existing.loginId || matchMeta?.empid || `OFF${f.id || '101'}`,
            designation: existing.designation || matchMeta?.designation || 'Senior Assistant',
            department: f.department || existing.department || 'Administrative Office',
            facultyType: 'OFFICE',
            password: 'nrtec@nec',
          });
        }
      });

      setOfficeStaffList(Array.from(mergedMap.values()));
    } catch (err) {
      console.error('Failed to load office staff:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    loadOfficeStaff();
    const unsub = subscribeToOutpasses(setTickets);
    return () => unsub();
  }, [token]);

  // Filter tickets for HOD and Office Staff applicants (routes to AO Login)
  const aoTickets = tickets.filter(t => 
    t.applicantType === 'HOD' || 
    t.applicantType === 'OFFICE' || 
    t.facultyType === 'OFFICE' || 
    t.status === 'FORWARDED_TO_AO'
  );

  const pendingTickets = aoTickets.filter(t => t.status === 'FORWARDED_TO_AO');
  const grantedTickets = aoTickets.filter(t => t.status === 'PERMISSION_GRANTED' || t.status === 'FACULTY_OUT');
  const completedTickets = aoTickets.filter(t => t.status === 'SENT_OUT');

  const filteredTickets = aoTickets.filter(t => {
    if (filterTab === 'PENDING' && t.status !== 'FORWARDED_TO_AO') return false;
    if (filterTab === 'GRANTED' && (t.status !== 'PERMISSION_GRANTED' && t.status !== 'FACULTY_OUT')) return false;
    if (filterTab === 'COMPLETED' && t.status !== 'SENT_OUT') return false;
    if (filterTab === 'REJECTED' && t.status !== 'REJECTED') return false;

    const q = searchQuery.toLowerCase();
    const name = (t.facultyName || t.studentName || '').toLowerCase();
    const id = (t.id || '').toLowerCase();
    const dept = (t.department || '').toLowerCase();
    const purpose = (t.purpose || t.reason || '').toLowerCase();

    return name.includes(q) || id.includes(q) || dept.includes(q) || purpose.includes(q);
  });

  const filteredStaffList = officeStaffList.filter(s => {
    const q = staffSearchQuery.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const empid = (s.empid || '').toLowerCase();
    const designation = (s.designation || '').toLowerCase();
    const phone = (s.phoneNumber || '').toLowerCase();
    return name.includes(q) || empid.includes(q) || designation.includes(q) || phone.includes(q);
  });

  const handleApprove = (ticket) => {
    try {
      setActionError('');
      const applicantRole = (ticket.applicantType === 'OFFICE' || ticket.facultyType === 'OFFICE') ? 'Office Staff' : 'HOD';
      aoApproveHodLeave(ticket.id, {
        aoName: user?.name || 'Administrative Officer (AO)',
        remarks: `Leave approved by AO for ${applicantRole}. Forwarded to Campus Security at main gate.`
      });
      setActionSuccess(`Permission granted for ${ticket.facultyName || applicantRole}! Forwarded to Campus Security.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to approve leave application');
    }
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectingTicket) return;
    if (!rejectReason.trim()) {
      setActionError('Please specify a rejection reason');
      return;
    }

    try {
      setActionError('');
      const applicantRole = (rejectingTicket.applicantType === 'OFFICE' || rejectingTicket.facultyType === 'OFFICE') ? 'Office Staff' : 'HOD';
      aoRejectHodLeave(rejectingTicket.id, {
        aoName: user?.name || 'Administrative Officer (AO)',
        reason: rejectReason.trim()
      });
      setActionSuccess(`Application for ${rejectingTicket.facultyName || applicantRole} rejected.`);
      setRejectingTicket(null);
      setRejectReason('');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to reject leave application');
    }
  };

  // Add Single Office Staff handler
  const handleAddOfficeStaff = async (e) => {
    e.preventDefault();
    const cleanEmpId = newStaffEmpId.trim().toUpperCase();
    const cleanName = newStaffName.trim();
    const cleanPhone = newStaffPhone.trim();
    const cleanDesignation = (newStaffDesignation === 'Other' ? customDesignation : newStaffDesignation).trim() || 'Senior Assistant';

    if (!cleanEmpId || !cleanName || !cleanPhone) {
      setAddStaffError('Please enter Employee ID, Full Name, and Mobile Number.');
      return;
    }

    setIsAddingStaff(true);
    setAddStaffError('');
    setAddStaffSuccess('');

    try {
      const assignedDept = 'Administrative Office';

      // 1. Post to backend faculty table
      try {
        await fetch('/api/faculty', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            facultyName: cleanName,
            phoneNumber: cleanPhone,
            department: assignedDept
          })
        });
      } catch (fErr) {
        console.warn('Backend faculty upsert notice:', fErr);
      }

      // 2. Register faculty login account: Login ID = Emp ID, Password = nrtec@nec
      if (registerUser) {
        try {
          await registerUser(
            cleanName,
            cleanEmpId,
            'nrtec@nec',
            'FACULTY',
            null,
            assignedDept
          );
        } catch (regErr) {
          console.warn('Office staff user registration notice:', regErr.message);
        }
      }

      // 3. Save to localStorage metadata
      const existing = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const newEntry = {
        empid: cleanEmpId,
        loginId: cleanEmpId,
        name: cleanName,
        mobileNumber: cleanPhone,
        phoneNumber: cleanPhone,
        designation: cleanDesignation,
        facultyType: 'OFFICE',
        department: assignedDept,
        password: 'nrtec@nec',
        updatedAt: new Date().toISOString()
      };

      const updated = [newEntry, ...existing.filter(item => 
        (item.empid && item.empid.toUpperCase() !== cleanEmpId) &&
        (item.name && item.name.toLowerCase() !== cleanName.toLowerCase())
      )];
      localStorage.setItem('lectra_faculty_metadata', JSON.stringify(updated));

      setAddStaffSuccess(`Office Staff "${cleanName}" added successfully! Login ID: ${cleanEmpId} | Password: nrtec@nec`);
      await loadOfficeStaff();

      setTimeout(() => {
        setShowAddStaffModal(false);
        setNewStaffEmpId('');
        setNewStaffName('');
        setNewStaffPhone('');
        setNewStaffDesignation('Senior Assistant');
        setCustomDesignation('');
        setAddStaffSuccess('');
      }, 1800);
    } catch (err) {
      setAddStaffError(err.message || 'Failed to add office staff member');
    } finally {
      setIsAddingStaff(false);
    }
  };

  // CSV Text Parsing for Bulk Upload (emp id, name, designation)
  const parseBulkCsv = (text) => {
    if (!text || !text.trim()) {
      setParsedBulkList([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      setParsedBulkList([]);
      return;
    }

    const firstLineLower = lines[0].toLowerCase();
    const hasHeader = firstLineLower.includes('emp') || 
                      firstLineLower.includes('name') || 
                      firstLineLower.includes('designation') || 
                      firstLineLower.includes('id') ||
                      firstLineLower.includes('role');

    let startIndex = 0;
    let headerMap = null;

    if (hasHeader) {
      startIndex = 1;
      let headerParts = lines[0].split(',');
      if (headerParts.length < 2 && lines[0].includes('\t')) {
        headerParts = lines[0].split('\t');
      } else if (headerParts.length < 2 && lines[0].includes(';')) {
        headerParts = lines[0].split(';');
      }
      headerParts = headerParts.map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

      headerMap = {};
      headerParts.forEach((col, idx) => {
        if (col.includes('emp') || col.includes('id') || col.includes('login') || col.includes('code')) {
          headerMap.empid = idx;
        } else if (col.includes('name') || col.includes('staff') || col.includes('employee')) {
          headerMap.name = idx;
        } else if (col.includes('designation') || col.includes('role') || col.includes('post') || col.includes('position')) {
          headerMap.designation = idx;
        } else if (col.includes('phone') || col.includes('mobile') || col.includes('contact')) {
          headerMap.phone = idx;
        }
      });
    }

    const parsed = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      let parts = line.split(',');
      if (parts.length < 2 && line.includes('\t')) {
        parts = line.split('\t');
      } else if (parts.length < 2 && line.includes(';')) {
        parts = line.split(';');
      }
      parts = parts.map(p => p.replace(/^["']|["']$/g, '').trim());

      let empid = '';
      let name = '';
      let designation = 'Senior Assistant';
      let phone = '';

      if (headerMap && (headerMap.empid !== undefined || headerMap.name !== undefined)) {
        if (headerMap.empid !== undefined && parts[headerMap.empid]) empid = parts[headerMap.empid];
        if (headerMap.name !== undefined && parts[headerMap.name]) name = parts[headerMap.name];
        if (headerMap.designation !== undefined && parts[headerMap.designation]) designation = parts[headerMap.designation];
        if (headerMap.phone !== undefined && parts[headerMap.phone]) phone = parts[headerMap.phone];
      } else {
        // Positional parsing fallback:
        // Case 1: 4 or more columns -> emp id, name, designation, phone
        if (parts.length >= 4) {
          empid = parts[0];
          name = parts[1];
          designation = parts[2] || 'Senior Assistant';
          phone = parts[3] || '';
        } 
        // Case 2: 3 columns -> emp id, name, designation
        else if (parts.length === 3) {
          empid = parts[0];
          name = parts[1];
          const isPhone = /^[+\d\s-]{7,15}$/.test(parts[2]);
          if (isPhone) {
            phone = parts[2];
            designation = 'Senior Assistant';
          } else {
            designation = parts[2] || 'Senior Assistant';
          }
        } 
        // Case 3: 2 columns -> emp id, name
        else if (parts.length === 2) {
          empid = parts[0];
          name = parts[1];
          designation = 'Senior Assistant';
        } 
        // Case 4: 1 column -> name only
        else if (parts.length === 1 && parts[0]) {
          name = parts[0];
          empid = 'OFF_' + name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
        }
      }

      // If empid is empty but name exists, generate a clean empid
      if (!empid && name) {
        empid = 'OFF_' + name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
      }

      if (name && empid) {
        parsed.push({
          empid: empid.toUpperCase(),
          name: name.trim(),
          designation: designation.trim() || 'Senior Assistant',
          phone: phone.trim(),
          department: 'Administrative Office',
          password: 'nrtec@nec'
        });
      }
    }

    setParsedBulkList(parsed);
  };

  const handleBulkTextChange = (e) => {
    const text = e.target.value;
    setBulkCsvText(text);
    setBulkError('');
    parseBulkCsv(text);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      setBulkCsvText(content);
      parseBulkCsv(content);
    };
    reader.onerror = () => {
      setBulkError('Failed to read CSV file from your device.');
    };
    reader.readAsText(file);
  };

  const insertSampleTemplate = () => {
    setBulkCsvText(SAMPLE_CSV);
    parseBulkCsv(SAMPLE_CSV);
    setBulkError('');
  };

  // Submit Bulk Office Staff Upload
  const handleBulkStaffSubmit = async (e) => {
    e.preventDefault();
    if (parsedBulkList.length === 0 && bulkCsvText.trim()) {
      parseBulkCsv(bulkCsvText);
    }

    const itemsToProcess = parsedBulkList.length > 0 ? parsedBulkList : [];
    if (itemsToProcess.length === 0) {
      setBulkError('Please enter or paste valid CSV text with columns: emp id, name, designation.');
      return;
    }

    setIsBulkSaving(true);
    setBulkError('');
    setBulkSuccess('');

    try {
      const assignedDept = 'Administrative Office';

      // 1. Post to backend faculty bulk endpoint
      const facultyListPayload = itemsToProcess.map(item => ({
        facultyName: item.name,
        phoneNumber: item.phone || null,
        department: assignedDept
      }));

      try {
        await fetch('/api/faculty/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            facultyList: facultyListPayload,
            department: assignedDept
          })
        });
      } catch (fErr) {
        console.warn('Backend bulk faculty upsert notice:', fErr);
      }

      // 2. Register faculty login account for each user
      if (registerUser) {
        for (const item of itemsToProcess) {
          try {
            await registerUser(
              item.name,
              item.empid,
              'nrtec@nec',
              'FACULTY',
              null,
              assignedDept
            );
          } catch (regErr) {
            console.warn(`User registration note for ${item.empid}:`, regErr.message);
          }
        }
      }

      // 3. Save to localStorage.lectra_faculty_metadata
      const existing = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const newEntries = itemsToProcess.map(item => ({
        empid: item.empid,
        loginId: item.empid,
        name: item.name,
        mobileNumber: item.phone || '',
        phoneNumber: item.phone || '',
        designation: item.designation,
        facultyType: 'OFFICE',
        department: assignedDept,
        password: 'nrtec@nec',
        updatedAt: new Date().toISOString()
      }));

      const merged = [
        ...newEntries,
        ...existing.filter(ex => 
          !itemsToProcess.some(item => 
            (item.empid && ex.empid && item.empid.toUpperCase() === ex.empid.toUpperCase()) ||
            (item.name && ex.name && item.name.toLowerCase() === ex.name.toLowerCase())
          )
        )
      ];
      localStorage.setItem('lectra_faculty_metadata', JSON.stringify(merged));

      setBulkSuccess(`Successfully imported ${itemsToProcess.length} office staff members! All login accounts created with Login ID = Emp ID and default password nrtec@nec.`);
      await loadOfficeStaff();

      setTimeout(() => {
        setShowBulkModal(false);
        setBulkCsvText('');
        setParsedBulkList([]);
        setBulkSuccess('');
      }, 2200);
    } catch (err) {
      setBulkError(err.message || 'Failed to bulk import office staff');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Delete Office Staff handler
  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Are you sure you want to remove office staff "${staff.name}" (${staff.empid})?`)) {
      return;
    }

    try {
      if (staff.id && token) {
        await fetch(`/api/faculty/${staff.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Remove from metadata
      const existing = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const updated = existing.filter(item => 
        (item.empid && item.empid.toLowerCase() !== (staff.empid || '').toLowerCase()) &&
        (item.name && item.name.toLowerCase() !== (staff.name || '').toLowerCase())
      );
      localStorage.setItem('lectra_faculty_metadata', JSON.stringify(updated));

      setActionSuccess(`Office staff "${staff.name}" removed successfully.`);
      setTimeout(() => setActionSuccess(''), 3000);
      await loadOfficeStaff();
    } catch (err) {
      setActionError(err.message || 'Failed to delete office staff');
    }
  };

  // Edit Office Staff submit
  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;
    setIsUpdatingStaff(true);

    try {
      // 1. Update backend faculty
      if (token && editingStaff.name) {
        await fetch('/api/faculty', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            facultyName: editingStaff.name,
            phoneNumber: editPhone.trim(),
            department: 'Administrative Office'
          })
        });
      }

      // 2. Update local metadata
      const existing = JSON.parse(localStorage.getItem('lectra_faculty_metadata') || '[]');
      const updated = existing.map(item => {
        const match = (item.empid && item.empid.toLowerCase() === editingStaff.empid?.toLowerCase()) ||
                      (item.name && item.name.toLowerCase() === editingStaff.name?.toLowerCase());
        if (match) {
          return {
            ...item,
            mobileNumber: editPhone.trim(),
            phoneNumber: editPhone.trim(),
            designation: editDesignation.trim() || item.designation,
            updatedAt: new Date().toISOString()
          };
        }
        return item;
      });
      localStorage.setItem('lectra_faculty_metadata', JSON.stringify(updated));

      setActionSuccess(`Staff details for "${editingStaff.name}" updated successfully.`);
      setTimeout(() => setActionSuccess(''), 3000);
      setEditingStaff(null);
      await loadOfficeStaff();
    } catch (err) {
      setActionError(err.message || 'Failed to update office staff');
    } finally {
      setIsUpdatingStaff(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'FORWARDED_TO_AO':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs border border-amber-500/20 flex items-center gap-1.5">
            <Clock size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
            Pending AO Approval
          </span>
        );
      case 'PERMISSION_GRANTED':
        return (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs border border-blue-500/20 flex items-center gap-1.5">
            <ShieldCheck size={12} />
            Approved • At Security Gate
          </span>
        );
      case 'FACULTY_OUT':
        return (
          <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-xs border border-purple-500/20 flex items-center gap-1.5">
            <DoorOpen size={12} />
            Applicant Out • Return Pending
          </span>
        );
      case 'SENT_OUT':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            Completed & Cleared
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs border border-rose-500/20 flex items-center gap-1.5">
            <XCircle size={12} />
            Rejected by AO
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-customText dark:text-customText-dark tracking-tight">
                  Administrative Officer (AO) Portal
                </h1>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  Authorizing HOD & Office Staff Leaves, Permissions and Managing Administrative Office Staff Members
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowAddStaffModal(true);
                setAddStaffError('');
                setAddStaffSuccess('');
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ Add Office Staff</span>
            </button>

            <button
              onClick={() => {
                setShowBulkModal(true);
                setBulkError('');
                setBulkSuccess('');
              }}
              className="px-4 py-2 rounded-xl bg-primary-dark hover:bg-primary text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <UploadCloud size={15} />
              <span>Bulk Upload CSV</span>
            </button>

            <button
              onClick={() => {
                loadTickets();
                loadOfficeStaff();
              }}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Counter KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6">
          <div 
            onClick={() => {
              setMainView('approvals');
              setFilterTab('PENDING');
            }}
            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
              Awaiting AO Action
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {pendingTickets.length}
            </span>
          </div>

          <div 
            onClick={() => {
              setMainView('approvals');
              setFilterTab('GRANTED');
            }}
            className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:border-blue-500/40 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
              Forwarded to Security
            </span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {grantedTickets.length}
            </span>
          </div>

          <div 
            onClick={() => {
              setMainView('staff');
            }}
            className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 cursor-pointer hover:border-indigo-500/40 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-1">
              Office Staff Directory
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {officeStaffList.length}
            </span>
          </div>

          <div 
            onClick={() => {
              setMainView('approvals');
              setFilterTab('ALL');
            }}
            className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-slate-300 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-customText-muted block mb-1">
              Total Leave Records
            </span>
            <span className="text-2xl font-black text-customText dark:text-customText-dark">
              {aoTickets.length}
            </span>
          </div>
        </div>
      </div>

      {/* Primary View Toggle: Leave Approvals vs Manage Office Staff */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => {
            setMainView('approvals');
            setSearchParams({ tab: filterTab });
          }}
          className={`pb-3 text-sm font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            mainView === 'approvals'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-customText-muted hover:text-customText'
          }`}
        >
          <Clock size={16} />
          <span>Leave & Gate Approvals</span>
          {pendingTickets.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {pendingTickets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setMainView('staff');
            setSearchParams({ tab: 'staff' });
          }}
          className={`pb-3 text-sm font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            mainView === 'staff'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-customText-muted hover:text-customText'
          }`}
        >
          <Users size={16} />
          <span>Office Staff Directory</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
            {officeStaffList.length}
          </span>
        </button>
      </div>

      {/* Success / Error Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center gap-3">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-sm flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* VIEW 1: Leave & Gate Approvals */}
      {mainView === 'approvals' && (
        <div className="space-y-6">
          {/* Filter Tabs and Search Bar */}
          <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full md:w-auto overflow-x-auto">
              {[
                { id: 'PENDING', label: `Pending Action (${pendingTickets.length})` },
                { id: 'GRANTED', label: `At Security (${grantedTickets.length})` },
                { id: 'COMPLETED', label: `Completed (${completedTickets.length})` },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'ALL', label: `All Records (${aoTickets.length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterTab(tab.id);
                    setSearchParams({ tab: tab.id });
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    filterTab === tab.id
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-customText-muted hover:text-customText'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-customText-muted" />
              <input
                type="text"
                placeholder="Search by Name, Dept, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Main List of Applications */}
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="glass-card p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-customText-muted">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-base font-black text-customText dark:text-customText-dark">
                  No applications in this category
                </h3>
                <p className="text-xs text-customText-muted max-w-md mx-auto">
                  There are currently no HOD or Office Staff permissions or leave applications matching your selected filter.
                </p>
              </div>
            ) : (
              filteredTickets.map(ticket => {
                const isPending = ticket.status === 'FORWARDED_TO_AO';
                const isOd = ticket.type === 'FACULTY_OD' || ticket.permissionType === 'FACULTY_OD';
                const isOneHour = ticket.type === 'FACULTY_ONE_HOUR' || ticket.permissionType === 'FACULTY_ONE_HOUR';
                const isOfficeStaff = ticket.applicantType === 'OFFICE' || ticket.facultyType === 'OFFICE';

                return (
                  <div
                    key={ticket.id}
                    className={`glass-card p-5 rounded-2xl border transition-all ${
                      isPending 
                        ? 'border-amber-500/40 shadow-lg shadow-amber-500/5 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent' 
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Applicant details & Type */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                            {ticket.id}
                          </span>

                          {/* Applicant Category Badge: HOD or Office Staff */}
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border flex items-center gap-1 ${
                            isOfficeStaff
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                          }`}>
                            {isOfficeStaff ? '🏢 Office Staff' : '🏛️ HOD'}
                          </span>

                          {/* Type Badge */}
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border ${
                            isOd 
                              ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                              : isOneHour
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          }`}>
                            {isOd ? 'On Duty (OD)' : isOneHour ? '1-Hour Timing Permission' : '4:00 PM Permission'}
                          </span>

                          {/* Status Badge */}
                          {getStatusBadge(ticket.status)}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 pt-1">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-customText-muted shrink-0" />
                            <div>
                              <span className="text-[10px] text-customText-muted uppercase font-bold block">
                                {isOfficeStaff ? 'Applicant (Office Staff)' : 'Applicant (HOD)'}
                              </span>
                              <span className="text-sm font-black text-customText dark:text-customText-dark">
                                {ticket.facultyName || ticket.studentName || (isOfficeStaff ? 'Office Staff Member' : 'Head of Department')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Building size={16} className="text-customText-muted shrink-0" />
                            <div>
                              <span className="text-[10px] text-customText-muted uppercase font-bold block">Department</span>
                              <span className="text-xs font-bold text-customText dark:text-customText-dark">
                                {ticket.department}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-customText-muted shrink-0" />
                            <div>
                              <span className="text-[10px] text-customText-muted uppercase font-bold block">Leave Date & Time</span>
                              <span className="text-xs font-bold text-customText dark:text-customText-dark">
                                {ticket.date} • {ticket.leaveTime || '04:00 PM'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Stated Reason */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                          <span className="font-bold text-customText-muted mr-1.5 uppercase text-[10px]">Stated Reason:</span>
                          <span className="font-semibold text-customText dark:text-customText-dark">
                            {ticket.purpose || ticket.reason || 'No specific purpose mentioned.'}
                          </span>
                        </div>

                        {/* AO action info */}
                        {ticket.aoAction && (
                          <div className="text-[11px] text-customText-muted flex items-center gap-2 pt-0.5">
                            <span className="font-bold">AO Action:</span>
                            <span>{ticket.aoAction.remarks} ({ticket.aoAction.displayDate} {ticket.aoAction.displayTime})</span>
                          </div>
                        )}
                      </div>

                      {/* Right Actions */}
                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleApprove(ticket)}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                            >
                              <CheckCircle2 size={16} />
                              <span>Grant & Forward to Security</span>
                            </button>

                            <button
                              onClick={() => {
                                setRejectingTicket(ticket);
                                setRejectReason('');
                              }}
                              className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                            >
                              <span>Reject Application</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-customText flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FileText size={14} />
                            <span>View Pass Slip</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: Office Staff Directory Management */}
      {mainView === 'staff' && (
        <div className="space-y-6">
          {/* Search bar and Action buttons */}
          <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-customText-muted" />
              <input
                type="text"
                placeholder="Search staff by Name, Emp ID, Phone, Role..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <span className="text-xs text-customText-muted font-bold mr-1">
                {filteredStaffList.length} Office Staff Member{filteredStaffList.length !== 1 ? 's' : ''}
              </span>
              
              <button
                onClick={() => {
                  setShowBulkModal(true);
                  setBulkError('');
                  setBulkSuccess('');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-primary-dark hover:bg-primary text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <UploadCloud size={15} />
                <span>Bulk CSV Upload</span>
              </button>

              <button
                onClick={() => {
                  setShowAddStaffModal(true);
                  setAddStaffError('');
                  setAddStaffSuccess('');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>+ Add Office Staff</span>
              </button>
            </div>
          </div>

          {/* Credentials Info Tip Card */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 flex items-start gap-3">
            <KeyRound size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-black text-indigo-950 dark:text-indigo-200">
                Default Credentials & Workflow for Office Staff:
              </p>
              <p className="text-customText-muted dark:text-customText-mutedDark">
                Staff log in with <strong className="text-customText dark:text-customText-dark">Login ID = Emp ID</strong> and default password: <code className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">nrtec@nec</code>. When an office staff member applies for leaves, the request routes directly to your <strong className="text-indigo-600 dark:text-indigo-400">AO Portal</strong> for clearance before gate security.
              </p>
            </div>
          </div>

          {/* Office Staff Cards Grid */}
          {staffLoading ? (
            <div className="p-12 text-center text-xs text-customText-muted font-bold">
              Loading office staff records...
            </div>
          ) : filteredStaffList.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-customText-muted">
                <Users size={32} />
              </div>
              <h3 className="text-base font-black text-customText dark:text-customText-dark">
                No office staff found
              </h3>
              <p className="text-xs text-customText-muted max-w-md mx-auto">
                No office staff accounts found in the system. Use "+ Add Office Staff" for single entry or "Bulk CSV Upload" to add multiple staff members at once.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Plus size={15} />
                  <span>Add First Office Staff</span>
                </button>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <UploadCloud size={15} />
                  <span>Bulk Upload via CSV</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaffList.map(staff => {
                // Count leaves for this staff
                const staffLeavesCount = aoTickets.filter(t => 
                  (t.facultyName && t.facultyName.toLowerCase() === staff.name.toLowerCase()) ||
                  (t.empid && t.empid.toLowerCase() === staff.empid.toLowerCase())
                ).length;

                return (
                  <div
                    key={staff.empid || staff.name}
                    className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Bar: Designation & Category Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-black uppercase tracking-wider">
                          🏢 Office Staff
                        </span>
                        <span className="text-[11px] font-bold text-customText-muted">
                          Administrative Office
                        </span>
                      </div>

                      {/* Staff Name and Designation */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-blue-600/20">
                          {staff.name ? staff.name.charAt(0).toUpperCase() : 'O'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-customText dark:text-customText-dark truncate">
                            {staff.name}
                          </h4>
                          <p className="text-xs font-semibold text-customText-muted truncate">
                            {staff.designation || 'Staff Member'}
                          </p>
                        </div>
                      </div>

                      {/* Detail Chips */}
                      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        {/* Emp ID / Login ID */}
                        <div className="flex items-center justify-between">
                          <span className="text-customText-muted font-bold text-[11px]">Emp / Login ID:</span>
                          <div className="flex items-center gap-1.5 font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/20 text-[11px]">
                            <span>{staff.empid || staff.loginId}</span>
                            <button
                              onClick={() => copyToClipboard(staff.empid || staff.loginId, staff.empid)}
                              className="text-customText-muted hover:text-indigo-600 cursor-pointer"
                              title="Copy Login ID"
                            >
                              {copiedId === staff.empid ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        {/* Mobile Phone */}
                        <div className="flex items-center justify-between">
                          <span className="text-customText-muted font-bold text-[11px]">Mobile:</span>
                          {staff.phoneNumber ? (
                            <a
                              href={`tel:${staff.phoneNumber}`}
                              className="font-semibold text-customText hover:text-indigo-600 flex items-center gap-1 text-[11px]"
                            >
                              <Phone size={12} className="text-customText-muted" />
                              <span>{staff.phoneNumber}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">Not provided</span>
                          )}
                        </div>

                        {/* Default Password */}
                        <div className="flex items-center justify-between">
                          <span className="text-customText-muted font-bold text-[11px]">Password:</span>
                          <span className="font-mono text-[11px] text-customText-muted font-bold flex items-center gap-1">
                            <Lock size={11} />
                            nrtec@nec
                          </span>
                        </div>

                        {/* Leaves Applied */}
                        <div className="flex items-center justify-between">
                          <span className="text-customText-muted font-bold text-[11px]">Leave Applications:</span>
                          <span className="font-bold text-xs text-customText dark:text-customText-dark">
                            {staffLeavesCount} {staffLeavesCount === 1 ? 'request' : 'requests'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setEditingStaff(staff);
                          setEditPhone(staff.phoneNumber || '');
                          setEditDesignation(staff.designation || '');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-customText flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit size={13} />
                        <span>Edit</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setMainView('approvals');
                            setSearchQuery(staff.name);
                            setFilterTab('ALL');
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="View Leave Requests"
                        >
                          <FileText size={13} />
                          <span>Leaves</span>
                        </button>

                        <button
                          onClick={() => handleDeleteStaff(staff)}
                          className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Remove Office Staff"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Single Add Office Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-customText dark:text-customText-dark">
                    Add New Office Staff
                  </h3>
                  <p className="text-[11px] text-customText-muted">
                    Administrative Officer Portal • Authorized Creation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="p-2 text-customText-muted hover:text-customText rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {addStaffError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{addStaffError}</span>
              </div>
            )}

            {addStaffSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{addStaffSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddOfficeStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee / Login ID */}
                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Employee ID / Login ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OFF2001 or 1042"
                    value={newStaffEmpId}
                    onChange={(e) => setNewStaffEmpId(e.target.value.toUpperCase())}
                    className="w-full glass-input text-xs py-2.5 font-mono uppercase"
                  />
                  <span className="text-[10px] text-customText-muted mt-0.5 block">
                    Used as the username for login
                  </span>
                </div>

                {/* Mobile Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit Mobile Number"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    className="w-full glass-input text-xs py-2.5"
                  />
                  <span className="text-[10px] text-customText-muted mt-0.5 block">
                    Contact for gate alerts and records
                  </span>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Staff Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K. Rama Rao"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full glass-input text-xs py-2.5"
                />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Designation / Role in Office *
                </label>
                <select
                  value={newStaffDesignation}
                  onChange={(e) => setNewStaffDesignation(e.target.value)}
                  className="w-full glass-input text-xs py-2.5"
                >
                  {COMMON_DESIGNATIONS.map(d => (
                    <option key={d} value={d} className="dark:bg-slate-900 text-customText">
                      {d}
                    </option>
                  ))}
                  <option value="Other" className="dark:bg-slate-900 text-customText">Other / Custom Designation...</option>
                </select>

                {newStaffDesignation === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter Custom Designation"
                    value={customDesignation}
                    onChange={(e) => setCustomDesignation(e.target.value)}
                    className="w-full glass-input text-xs py-2.5 mt-2"
                    required
                  />
                )}
              </div>

              {/* Department (Fixed to Administrative Office) */}
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Department
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value="Administrative Office"
                  className="w-full glass-input text-xs py-2.5 bg-slate-100 dark:bg-slate-800 font-bold text-customText cursor-not-allowed opacity-80"
                />
              </div>

              {/* Credentials Summary Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-black text-customText dark:text-customText-dark">
                  <KeyRound size={14} className="text-indigo-600" />
                  <span>Default Account Credentials</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-customText-muted block font-bold">Login ID:</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {newStaffEmpId || 'Emp ID entered above'}
                    </span>
                  </div>
                  <div>
                    <span className="text-customText-muted block font-bold">Default Password:</span>
                    <span className="font-mono font-bold text-customText dark:text-customText-dark">
                      nrtec@nec
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-customText-muted pt-1">
                  When this staff member applies for permissions, the application routes directly to AO Login for approval before Security Gate clearance.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingStaff}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isAddingStaff ? (
                    <>
                      <Clock size={14} className="animate-spin" />
                      <span>Creating Staff Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} />
                      <span>Create Office Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Office Staff CSV Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="glass-card w-full max-w-2xl p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-dark text-white flex items-center justify-center shadow-md shadow-primary-dark/20">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-customText dark:text-customText-dark">
                    Bulk Upload Office Staff (CSV Text)
                  </h3>
                  <p className="text-[11px] text-customText-muted">
                    Format: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold">emp id, name, designation</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 text-customText-muted hover:text-customText rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {bulkError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {bulkSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{bulkSuccess}</span>
              </div>
            )}

            {/* Quick Helper Tools Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-bold text-customText-muted flex items-center gap-1.5">
                <FileSpreadsheet size={15} className="text-primary-dark" />
                CSV Format: <span className="text-customText dark:text-customText-dark font-mono">emp id, name, designation</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={insertSampleTemplate}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Insert Sample Template
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-customText font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <UploadCloud size={12} />
                  <span>Choose File</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleBulkStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Paste CSV Text Content *
                </label>
                <textarea
                  rows={6}
                  value={bulkCsvText}
                  onChange={handleBulkTextChange}
                  placeholder={`emp id, name, designation\nOFF2001, K. Rama Rao, Senior Assistant\nOFF2002, M. Lakshmi, Junior Assistant\nOFF2003, P. Venkat, Accountant\nOFF2004, S. Suresh, Record Assistant`}
                  className="w-full glass-input text-xs font-mono py-2.5 leading-relaxed resize-y"
                  required
                />
                <p className="text-[10px] text-customText-muted mt-1">
                  Separate each column with a comma (,) or tab. Department is automatically set to <strong>Administrative Office</strong> and default login password will be <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded font-bold">nrtec@nec</code>.
                </p>
              </div>

              {/* Parsed Live Preview Table */}
              {parsedBulkList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-customText dark:text-customText-dark flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Previewing {parsedBulkList.length} Office Staff Member{parsedBulkList.length !== 1 ? 's' : ''} Ready to Import:
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      Default Password: nrtec@nec
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-customText-muted sticky top-0">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Emp ID (Login)</th>
                          <th className="p-2.5">Full Name</th>
                          <th className="p-2.5">Designation</th>
                          <th className="p-2.5">Department</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedBulkList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2.5 text-customText-muted font-bold">{idx + 1}</td>
                            <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {item.empid}
                            </td>
                            <td className="p-2.5 font-bold text-customText dark:text-customText-dark">
                              {item.name}
                            </td>
                            <td className="p-2.5 text-customText-muted">
                              {item.designation}
                            </td>
                            <td className="p-2.5 text-[11px] text-customText-muted">
                              Administrative Office
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkSaving || parsedBulkList.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-primary-dark hover:bg-primary text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isBulkSaving ? (
                    <>
                      <Clock size={14} className="animate-spin" />
                      <span>Importing Office Staff...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} />
                      <span>Import {parsedBulkList.length} Office Staff Member{parsedBulkList.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Office Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Edit size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-customText dark:text-customText-dark">
                    Edit Office Staff Details
                  </h3>
                  <p className="text-[11px] text-customText-muted">
                    {editingStaff.name} ({editingStaff.empid})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-2 text-customText-muted hover:text-customText rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  required
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full glass-input text-xs py-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Optional 10-digit mobile number"
                  className="w-full glass-input text-xs py-2.5"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStaff}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingStaff ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 className="text-lg font-black text-customText dark:text-customText-dark">
                Reject Leave Application
              </h3>
            </div>
            
            <p className="text-xs text-customText-muted">
              Are you sure you want to reject the leave application for <strong className="text-customText dark:text-customText-dark">{rejectingTicket.facultyName}</strong> ({rejectingTicket.id})?
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-customText-muted uppercase mb-1">
                  Rejection Reason / Remarks *
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="State reason for rejecting (e.g. Institutional requirements, mandatory office work...)"
                  className="w-full glass-input text-xs py-2.5 resize-none"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingTicket(null)}
                  className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 shadow-md transition-all cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Outpass Ticket Viewer Modal */}
      {selectedTicket && (
        <OutpassTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
};

export default AODashboard;
