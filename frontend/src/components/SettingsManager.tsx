import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Settings,
  Activity,
  Database,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  X,
  ShieldAlert,
  Download,
  Upload,
  RefreshCw,
  Eye
} from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'logs' | 'users' | 'backup'>('logs');
  
  // Data states
  const [logs, setLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // User form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'partner'>('partner');
  const [error, setError] = useState('');

  // Backup states
  const [restoreJson, setRestoreJson] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreError, setRestoreError] = useState('');

  const fetchLogsAndUsers = async () => {
    try {
      setLoading(true);
      const [lRes, uRes] = await Promise.all([
        api.get('/system/logs'),
        api.get('/auth/users')
      ]);
      if (lRes.success) setLogs(lRes.logs);
      if (uRes.success) setUsersList(uRes.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndUsers();
  }, [activeTab]);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setName('');
    setRole('partner');
    setEditingUserId(null);
    setError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: any) => {
    setEditingUserId(u.id);
    setUsername(u.username);
    setName(u.name);
    setRole(u.role);
    setPassword(''); // Leave empty unless modifying
    setIsModalOpen(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !name || (!editingUserId && !password)) {
      setError('All fields are required.');
      return;
    }

    const payload: any = {
      username,
      name,
      role
    };
    if (password) payload.password = password;

    try {
      if (editingUserId) {
        await api.put(`/auth/users/${editingUserId}`, payload);
      } else {
        await api.post('/auth/users', payload);
      }
      setIsModalOpen(false);
      fetchLogsAndUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to save user account.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === user?.id) {
      alert('You cannot delete your own active admin account.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user account?')) {
      return;
    }

    try {
      await api.delete(`/auth/users/${id}`);
      fetchLogsAndUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  // Backup downloader
  const handleBackup = async () => {
    try {
      const data = await api.get('/system/backup');
      if (data.success && data.backup) {
        const jsonStr = JSON.stringify(data.backup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `JMCF_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Failed to extract database backup.');
    }
  };

  // Restore processor
  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreStatus('');
    setRestoreError('');

    if (!restoreJson) {
      setRestoreError('Please paste your backup JSON file content.');
      return;
    }

    try {
      const parsed = JSON.parse(restoreJson);
      if (!parsed.users || !parsed.sales || !parsed.products) {
        setRestoreError('Invalid backup layout: Missing core collections.');
        return;
      }

      const res = await api.post('/system/restore', { backupData: parsed });
      if (res.success) {
        setRestoreStatus('Database restored successfully! Reloading configuration...');
        setRestoreJson('');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Restoration error: JSON parsing failed.');
    }
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Settings className="h-6 w-6 text-amber-500" />
            System Administration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Audit logs, user account registries, and database backups.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            activeTab === 'logs'
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Activity Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            activeTab === 'users'
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Manage Staff Accounts
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            activeTab === 'backup'
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Backup & Restore Data
        </button>
      </div>

      {loading && activeTab !== 'backup' ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500">Querying security nodes...</span>
        </div>
      ) : activeTab === 'logs' ? (
        /* ================= ACTIVITY LOGS VIEW ================= */
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-amber-500" />
                Audit Logs list
              </h4>
              <button
                onClick={fetchLogsAndUsers}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-all outline-none"
                title="Refresh logs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[500px] text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/30">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Activity Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-800/10 text-slate-350">
                        <td className="p-4 text-slate-450 font-mono">
                          {new Date(log.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'medium'
                          })}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-200 capitalize">{log.username}</div>
                          <span className={`inline-block text-[8px] font-bold uppercase tracking-wider ${
                            log.role === 'admin' ? 'text-amber-500' : 'text-slate-500'
                          }`}>
                            {log.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-[10px] text-amber-400 font-semibold border border-slate-800/80">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300 font-medium">{log.details}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-650 italic">
                        No audit events logged in this session database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        /* ================= USER ACCOUNTS VIEW ================= */
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-xs transition-all outline-none"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Staff User
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="p-4">Display Name</th>
                    <th className="p-4">Username</th>
                    <th className="p-4">System Role</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-350">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/20">
                      <td className="p-4 font-bold text-slate-200">{u.name}</td>
                      <td className="p-4 font-mono font-bold text-amber-500">{u.username}</td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          u.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-850 text-slate-400 border border-slate-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-all"
                            title="Edit User"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-all"
                            title="Delete User"
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= DATABASE BACKUP & RESTORE ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
            <div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-500 w-fit mb-4">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">Export Database state</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Download a complete snapshots of all inventory tables, purchase registries, sales invoices, activity logs, and contact profiles as a structured JSON file.
              </p>
            </div>
            <button
              onClick={handleBackup}
              className="mt-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-xs transition-all outline-none"
            >
              <Download className="h-4 w-4" />
              Backup Database (.json)
            </button>
          </div>

          {/* Import card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 w-fit mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">Restore snapshotted state</h3>
            <p className="text-xs text-slate-400 mt-2 mb-4 leading-relaxed">
              Caution: Restoring a backup completely overwrites all current database tables. Paste the backup JSON data below to restore.
            </p>

            <form onSubmit={handleRestore} className="space-y-4">
              {restoreError && (
                <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{restoreError}</span>
                </div>
              )}

              {restoreStatus && (
                <div className="flex items-start gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{restoreStatus}</span>
                </div>
              )}

              <textarea
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                placeholder='Paste raw JSON backup content here (e.g. {"users": [...], "sales": [...]})'
                rows={4}
                className="w-full p-3 bg-slate-950 border border-slate-800 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 rounded-lg text-slate-300 text-[10px] outline-none font-mono transition-all"
              />

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-650 hover:bg-red-600 text-white font-bold rounded-lg text-xs transition-all outline-none"
              >
                <Upload className="h-4 w-4" />
                Upload & Restore Database
              </button>
            </form>
          </div>
        </div>
      )}

      {/* User Accounts Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">
                {editingUserId ? 'Edit Account info' : 'Add Staff User Account'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitUser} className="p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Display Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g. Raman Sharma"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Login Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="E.g. raman1"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  disabled={!!editingUserId}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {editingUserId ? 'New Password (leave empty to keep same)' : 'Login Password *'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password string"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs outline-none focus:border-amber-500"
                >
                  <option value="partner">Partner (Limit view, invoice write)</option>
                  <option value="admin">Administrator (Complete access)</option>
                </select>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950/20 border-t border-slate-800 flex items-center justify-end gap-3 mt-4 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-350 text-xs font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 text-xs font-bold rounded-lg transition-all"
                >
                  {editingUserId ? 'Save Account' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
