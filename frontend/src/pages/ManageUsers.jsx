import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  UserPlus, 
  Trash2, 
  User, 
  ShieldCheck, 
  GraduationCap, 
  Building,
  Lock,
  Plus,
  X,
  Pencil,
  KeyRound,
  ShieldAlert
} from 'lucide-react';

const ManageUsers = () => {
  const { token, user: currentUser, registerUser, updateUserAdmin, deleteUser, getUsersList, getDepartmentsList } = useAuth();

  const [users, setUsers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [departments, setDepartments] = useState(['Department of CSE(emerging Technologies)']);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form fields for Add
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CR');
  const [className, setClassName] = useState('');
  const [department, setDepartment] = useState('Department of CSE(emerging Technologies)');
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [customDeptName, setCustomDeptName] = useState('');

  // Form fields for Edit
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('CR');
  const [editClassName, setEditClassName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const loadData = async (filterToUse = deptFilter) => {
    try {
      // Fetch users with optional department filter
      const usersData = await getUsersList(filterToUse);
      setUsers(usersData);

      // Fetch departments list
      const depts = await getDepartmentsList();
      if (Array.isArray(depts) && depts.length > 0) {
        setDepartments(depts);
      }

      // Fetch classrooms to populate CR assigned class options
      const classRes = await fetch('/api/classrooms', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const classData = await classRes.json();
      setClassrooms(classData);
      
      if (classData.length > 0 && !className) {
        setClassName(classData[0].className);
      }
    } catch (err) {
      setError(err.message || 'Failed to load user management details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleDeptFilterChange = (newDept) => {
    setDeptFilter(newDept);
    loadData(newDept);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (role === 'CR' && !className) {
      setError('Please assign a class for the CR');
      return;
    }

    const assignedDept = isSuperAdmin
      ? (isCustomDept ? customDeptName.trim() : department)
      : (currentUser?.department || 'Department of CSE(emerging Technologies)');

    if (isSuperAdmin && isCustomDept && !customDeptName.trim()) {
      setError('Please specify the new department name');
      return;
    }

    try {
      await registerUser(
        name, 
        userId, 
        password, 
        role, 
        role === 'CR' ? className : null, 
        (role === 'WATCHMAN' || role === 'SECURITY_HEAD') ? null : assignedDept
      );
      setSuccess(`User "${name}" successfully registered as ${role === 'WATCHMAN' || role === 'SECURITY_HEAD' ? 'Security Head' : role} in ${(role === 'WATCHMAN' || role === 'SECURITY_HEAD') ? 'Campus Gate' : assignedDept}.`);
      setShowAddUserModal(false);
      
      // Clear forms
      setName('');
      setUserId('');
      setPassword('');
      setRole('CR');
      setIsCustomDept(false);
      setCustomDeptName('');
      if (classrooms.length > 0) {
        setClassName(classrooms[0].className);
      }
      
      loadData();
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  const handleOpenEdit = (targetUser) => {
    setSelectedUser(targetUser);
    setEditName(targetUser.name || '');
    setEditRole(targetUser.role || 'CR');
    setEditClassName(targetUser.className || '');
    setEditDepartment(targetUser.department || 'Department of CSE(emerging Technologies)');
    setEditPassword('');
    setShowEditUserModal(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError('');
    setSuccess('');
    setEditSubmitting(true);

    try {
      const updatePayload = {
        name: editName,
        role: editRole,
        className: editRole === 'CR' ? editClassName : null,
      };
      if (isSuperAdmin && editRole !== 'WATCHMAN' && editRole !== 'SECURITY_HEAD') {
        updatePayload.department = editDepartment;
      }
      if (editPassword && editPassword.trim()) {
        updatePayload.password = editPassword.trim();
      }

      await updateUserAdmin(selectedUser.id, updatePayload);
      setSuccess(`User "${editName}" updated successfully.`);
      setShowEditUserModal(false);
      setSelectedUser(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (userToDelete.userId === currentUser.userId) {
      setError('You cannot delete your own logged-in account.');
      return;
    }

    if (!isSuperAdmin && (userToDelete.role === 'SUPER_ADMIN' || userToDelete.role === 'HOD')) {
      setError('Only a Super Admin has the override authority to manage or delete HOD and Super Admin accounts.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user ${userToDelete.name} (${userToDelete.userId})?`)) return;
    setError('');
    setSuccess('');

    try {
      await deleteUser(userToDelete.id);
      setSuccess(`User ${userToDelete.name} deleted successfully.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Delete user failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-customText dark:text-customText-dark tracking-tight">
              User Accounts & Authority Portal
            </h2>
            {isSuperAdmin && (
              <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                Super Admin Override Active
              </span>
            )}
          </div>
          <p className="text-sm text-customText-muted dark:text-customText-mutedDark">
            {isSuperAdmin 
              ? 'Super Admin Control: Full authority to create, edit, reset passwords, and manage HODs and all system users.' 
              : 'HOD Settings: Create, authorize, and manage administrative, faculty, watchman, and CR credentials.'}
          </p>
        </div>

        <button
          onClick={() => setShowAddUserModal(true)}
          className="btn-primary"
        >
          <UserPlus size={18} />
          <span>Create User Account</span>
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

      {/* Super Admin Department Filter Toolbar */}
      {isSuperAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800/40">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
              Department Scope:
            </span>
            <select
              value={deptFilter}
              onChange={(e) => handleDeptFilterChange(e.target.value)}
              className="glass-input text-xs py-1.5 px-3 rounded-xl font-semibold text-primary-dark dark:text-primary"
            >
              <option value="ALL">🏛️ All Departments (Campus-Wide)</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-customText-muted dark:text-customText-mutedDark font-medium">
            Showing {users.length} accounts
          </span>
        </div>
      )}

      {/* Users Database Table */}
      <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider">
                <th className="pb-3">Name</th>
                <th className="pb-3">User ID</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Assigned Class</th>
                <th className="pb-3">Created Date</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {users.map((u) => {
                const isSelf = u.userId === currentUser.userId;
                const canManageThisUser = isSuperAdmin || (u.role !== 'SUPER_ADMIN' && u.role !== 'HOD');
                
                let roleBadge = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                if (u.role === 'SUPER_ADMIN') roleBadge = 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-extrabold';
                if (u.role === 'HOD') roleBadge = 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/10';
                if (u.role === 'SUB_ADMIN') roleBadge = 'bg-primary/10 text-primary-dark dark:text-primary border border-primary/10';
                if (u.role === 'CR') roleBadge = 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/10';
                if (u.role === 'FACULTY') roleBadge = 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/10';
                if (u.role === 'ABSENT_CONTROLLER') roleBadge = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/10';
                if (u.role === 'WATCHMAN' || u.role === 'SECURITY_HEAD') roleBadge = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                    <td className="py-3.5 font-semibold text-customText dark:text-customText-dark">
                      <div className="flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isSelf && <span className="text-[10px] text-primary-dark font-bold ml-1 italic">(You)</span>}
                        {u.role === 'SUPER_ADMIN' && <span className="text-amber-500" title="Super Admin">⚡</span>}
                      </div>
                    </td>
                    <td className="py-3.5 text-customText-muted dark:text-customText-mutedDark font-medium">
                      {u.userId}
                    </td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${roleBadge}`}>
                        {u.role === 'SUPER_ADMIN' && '⚡ '}
                        {u.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : ((u.role === 'WATCHMAN' || u.role === 'SECURITY_HEAD') ? 'SECURITY HEAD' : u.role)}
                      </span>
                    </td>
                    <td className="py-3.5 text-xs text-customText dark:text-customText-dark font-medium max-w-[200px] truncate" title={u.department || 'Campus Gate / Global'}>
                      {u.role === 'WATCHMAN' || u.role === 'SECURITY_HEAD' || u.role === 'SUPER_ADMIN' ? (
                        <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Campus-Wide</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[11px] font-semibold">
                          {u.department || 'CSE (Emerging Technologies)'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-customText-muted dark:text-customText-mutedDark font-medium">
                      {u.className ? u.className : <span className="text-slate-400 dark:text-slate-600">—</span>}
                    </td>
                    <td className="py-3.5 text-xs text-customText-muted dark:text-customText-mutedDark">
                      {new Date(u.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {/* Edit / Password Reset Button */}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          disabled={!canManageThisUser && !isSelf}
                          className={`p-2 rounded-lg transition-colors ${
                            !canManageThisUser && !isSelf
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'text-primary-dark dark:text-primary hover:bg-primary/10'
                          }`}
                          title={!canManageThisUser && !isSelf ? "Super Admin protected" : "Edit / Reset Password"}
                        >
                          <Pencil size={16} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={isSelf || (!canManageThisUser)}
                          className={`p-2 rounded-lg transition-colors ${
                            isSelf || (!canManageThisUser)
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' 
                              : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                          }`}
                          title={isSelf ? "Cannot delete yourself" : (!canManageThisUser ? "Protected account" : "Delete user")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER POPUP MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddUserModal(false)} />
          
          <form 
            onSubmit={handleAddUser}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-md p-6 shadow-2xl animate-fade-in z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                Create User Account
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddUserModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className="glass-input pl-9"
                  />
                </div>
              </div>

              {/* User ID */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  User ID (Unique login name)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <ShieldCheck size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter unique ID (e.g. cr_rahul)"
                    className="glass-input pl-9"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Secure Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="glass-input pl-9"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Assign Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="glass-input text-sm"
                >
                  <option value="CR">Class Representative (CR)</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="ABSENT_CONTROLLER">Absent Controller</option>
                  <option value="SUB_ADMIN">Sub Admin</option>
                  {isSuperAdmin && (
                    <>
                      <option value="HOD">HOD (Head of Department)</option>
                      <option value="SECURITY_HEAD">Security Head (Campus Gate)</option>
                      <option value="SUPER_ADMIN">⚡ Super Admin (Full Control)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Department Selection */}
              {role !== 'WATCHMAN' && role !== 'SECURITY_HEAD' && (
                <div>
                  <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  {isSuperAdmin ? (
                    <div className="space-y-2">
                      <select
                        value={isCustomDept ? '__NEW__' : department}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setIsCustomDept(true);
                          } else {
                            setIsCustomDept(false);
                            setDepartment(e.target.value);
                          }
                        }}
                        className="glass-input text-sm"
                      >
                        {departments.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                        <option value="__NEW__">➕ Create New Department...</option>
                      </select>

                      {isCustomDept && (
                        <input
                          type="text"
                          required
                          value={customDeptName}
                          onChange={(e) => setCustomDeptName(e.target.value)}
                          placeholder="Type new department name (e.g. Department of ECE)"
                          className="glass-input text-sm border-primary"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="glass-input text-sm bg-slate-100/50 dark:bg-slate-800/50 cursor-not-allowed text-customText-muted dark:text-customText-mutedDark font-medium">
                      {currentUser?.department || 'Department of CSE(emerging Technologies)'}
                    </div>
                  )}
                </div>
              )}

              {/* Class Selection (Only for CR) */}
              {role === 'CR' && (
                <div>
                  <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                    Assign Classroom
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Building size={16} />
                    </span>
                    <select
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="glass-input pl-9 text-sm"
                      required
                    >
                      <option value="">-- Choose Class --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.className}>
                          {c.className} ({c.roomNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  {classrooms.length === 0 && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">
                      ⚠️ Note: No classrooms available. Please create classrooms first.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowAddUserModal(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT USER / RESET PASSWORD MODAL */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowEditUserModal(false)} />
          
          <form 
            onSubmit={handleEditUser}
            className="relative glass-card bg-white dark:bg-slate-900 border border-white/60 w-full max-w-md p-6 shadow-2xl animate-fade-in z-10 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-extrabold text-base text-customText dark:text-customText-dark">
                  Edit User & Password
                </h3>
                <p className="text-xs text-customText-muted dark:text-customText-mutedDark">
                  User ID: <span className="font-mono font-bold text-primary-dark">{selectedUser.userId}</span>
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowEditUserModal(false)} 
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="glass-input pl-9"
                    disabled={editSubmitting}
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="glass-input text-sm"
                  disabled={editSubmitting || (!isSuperAdmin && (selectedUser.role === 'SUPER_ADMIN' || selectedUser.role === 'HOD'))}
                >
                  <option value="CR">Class Representative (CR)</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="ABSENT_CONTROLLER">Absent Controller</option>
                  <option value="SUB_ADMIN">Sub Admin</option>
                  {isSuperAdmin && (
                    <>
                      <option value="HOD">HOD (Head of Department)</option>
                      <option value="SECURITY_HEAD">Security Head (Campus Gate)</option>
                      <option value="SUPER_ADMIN">⚡ Super Admin (Full Control)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Department Selection (Super Admin only) */}
              {isSuperAdmin && editRole !== 'WATCHMAN' && editRole !== 'SECURITY_HEAD' && (
                <div>
                  <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="glass-input text-sm"
                    disabled={editSubmitting}
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Class Selection (Only for CR) */}
              {editRole === 'CR' && (
                <div>
                  <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                    Assign Classroom
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Building size={16} />
                    </span>
                    <select
                      value={editClassName}
                      onChange={(e) => setEditClassName(e.target.value)}
                      className="glass-input pl-9 text-sm"
                      required
                    >
                      <option value="">-- Choose Class --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.className}>
                          {c.className} ({c.roomNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Reset Password */}
              <div>
                <label className="block text-xs font-bold text-customText-muted dark:text-customText-mutedDark uppercase tracking-wider mb-1.5">
                  Reset Password (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <KeyRound size={16} />
                  </span>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep existing password"
                    className="glass-input pl-9"
                    disabled={editSubmitting}
                  />
                </div>
                <p className="text-[10px] text-customText-muted dark:text-customText-mutedDark mt-1">
                  Enter a new password here to immediately override this user's password.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setShowEditUserModal(false)} 
                className="btn-secondary"
                disabled={editSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={editSubmitting}
              >
                {editSubmitting ? 'Saving Changes...' : 'Save & Override'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default ManageUsers;
