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
              setBulkError('');
              setBulkMessage('');
              setShowBulkModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-dark hover:bg-primary text-white rounded-xl font-bold text-sm shadow transition-all active:scale-[0.98]"
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
          {filteredFaculty.map(f => (
            <div key={f.id} className="glass-card p-4 flex flex-col justify-between hover:border-primary/30 transition-all group">
              <div>
                <h3 className="font-bold text-base text-customText dark:text-customText-dark truncate" title={f.facultyName}>
                  {f.facultyName}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-customText-muted dark:text-customText-mutedDark">
                  <Phone size={14} className={f.phoneNumber ? "text-green-500" : "text-slate-400"} />
                  <span>{f.phoneNumber || 'No phone number'}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingFaculty(f);
                    setEditPhone(f.phoneNumber || '');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-primary/20 transition-all"
                >
                  <Edit size={14} /> Edit Phone
                </button>
                <button
                  onClick={() => handleDelete(f.id, f.facultyName)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-500/20 transition-all"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
          {filteredFaculty.length === 0 && (
            <div className="col-span-full text-center py-12 text-customText-muted border border-dashed rounded-xl">
              {activeTab === 'missing' 
                ? '🎉 Excellent! All faculty contacts have phone numbers assigned.'
                : 'No faculty found. Timetable syncing might be required or adjust your search.'}
            </div>
          )}
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
