import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Users as UsersIcon, 
  Plus, 
  Search, 
  Shield, 
  Mail, 
  Calendar,
  MoreVertical,
  ShieldCheck,
  ShieldAlert,
  Activity,
  UserPlus,
  Trash2,
  UserX,
  UserCheck,
  Lock,
  CheckCircle2,
  XCircle,
  Database,
  RefreshCw
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, limit, setDoc, where, getDocs, writeBatch, handleFirestoreError, OperationType, getCountFromServer } from '../lib/firebase';
import { UserProfile, Role, ActivityLog } from '../types';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import Pagination from '../components/Pagination';

const Users: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { profile: currentUserProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(25);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [logsLimit, setLogsLimit] = useState(25);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ name: '', username: '', password: '', role: 'cashier' as Role });
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [selectedUserForLogs, setSelectedUserForLogs] = useState<UserProfile | null>(null);
  const [userLogs, setUserLogs] = useState<ActivityLog[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);

  const cleanDatabase = async () => {
    if (!window.confirm('Are you sure you want to clean the database? This will remove duplicates and ensure data consistency.')) return;
    
    setIsCleaning(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Clean Products
      const productsSnap = await getDocs(collection(db, 'products'));
      const productNames = new Set();
      for (const docSnap of productsSnap.docs) {
        const data = docSnap.data();
        const updates: any = {};
        
        // Standardize category to lowercase
        if (data.category && data.category !== data.category.toLowerCase()) {
          updates.category = data.category.toLowerCase();
        }

        if (productNames.has(data.name)) {
          batch.delete(docSnap.ref);
        } else {
          productNames.add(data.name);
          if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
          }
        }
      }

      // 2. Clean Raw Materials
      const materialsSnap = await getDocs(collection(db, 'rawMaterials'));
      const materialNames = new Set();
      for (const docSnap of materialsSnap.docs) {
        const data = docSnap.data();
        const updates: any = {};

        // Standardize category to lowercase
        if (data.category && data.category !== data.category.toLowerCase()) {
          updates.category = data.category.toLowerCase();
        }

        if (materialNames.has(data.name)) {
          batch.delete(docSnap.ref);
        } else {
          materialNames.add(data.name);
          if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
          }
        }
      }

      await batch.commit();
      alert('Database cleaned successfully!');
      
      if (currentUserProfile) {
        await logActivity(
          currentUserProfile.id,
          currentUserProfile.name,
          'database_cleanup',
          'Performed a database cleanup'
        );
      }
    } catch (error) {
      console.error('Error cleaning database:', error);
      alert('Error cleaning database. Check console for details.');
    } finally {
      setIsCleaning(false);
    }
  };

  useEffect(() => {
    const fetchCounts = async () => {
      const snapshot = await getCountFromServer(collection(db, 'users'));
      setTotalPages(Math.ceil(snapshot.data().count / pageSize));
    };
    fetchCounts();

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(pageSize * currentPage));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      const startIndex = (currentPage - 1) * pageSize;
      const usersData = allUsers.slice(startIndex, startIndex + pageSize);
      setUsers(usersData);

      // One-time fix for specific users with empty usernames
      for (const user of usersData) {
        if (!user.username) {
          let targetUsername = '';
          if (user.name === 'Salim T') targetUsername = 'alfsalim';
          else if (user.name === 'Karim Boughias') targetUsername = 'karimkrimo';

          if (targetUsername) {
            // Check if this username is already taken by someone else
            const isTaken = allUsers.some(u => u.username === targetUsername && u.id !== user.id);
            if (!isTaken) {
              try {
                await updateDoc(doc(db, 'users', user.id), { username: targetUsername });
                console.log(`Updated username for ${user.name} to ${targetUsername}`);
              } catch (err) {
                console.error(`Error updating username for ${user.name}:`, err);
              }
            }
          }
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const logsQ = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(logsLimit));
    const unsubscribeLogs = onSnapshot(logsQ, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      setAuditLogs(newLogs);
      setHasMoreLogs(newLogs.length === logsLimit);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'activityLogs'));

    return () => {
      unsubscribe();
      unsubscribeLogs();
    };
  }, [pageSize, currentPage, logsLimit]);

  useEffect(() => {
    if (selectedUserForLogs) {
      const q = query(
        collection(db, 'activityLogs'),
        where('userId', '==', selectedUserForLogs.id),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUserLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'activityLogs'));
      return () => unsubscribe();
    }
  }, [selectedUserForLogs]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if username is already taken
    const isUsernameTaken = users.some(u => u.username?.toLowerCase() === inviteData.username.toLowerCase());
    if (isUsernameTaken) {
      alert('This username is already taken. Please choose another one.');
      return;
    }

    try {
      const email = `${inviteData.username.toLowerCase()}@bakery.local`;
      const newUser = {
        ...inviteData,
        email,
        createdAt: new Date().toISOString(),
        status: 'active' as const
      };
      // Use username as doc ID for easier lookup during activation
      await setDoc(doc(db, 'users', inviteData.username.toLowerCase()), newUser);
      
      if (currentUserProfile) {
        await logActivity(
          currentUserProfile.id,
          currentUserProfile.name,
          'user_invited',
          `Invited new user: ${inviteData.name} (@${inviteData.username})`
        );
      }

      setIsInviteModalOpen(false);
      setInviteData({ name: '', username: '', password: '', role: 'cashier' });
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (newPassword && newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const updates: any = {
        name: editingUser.name,
        role: editingUser.role,
        status: editingUser.status || 'active'
      };

      if (newPassword) {
        updates.password = newPassword;
      }

      await updateDoc(doc(db, 'users', editingUser.id), updates);
      
      if (currentUserProfile) {
        await logActivity(
          currentUserProfile.id,
          currentUserProfile.name,
          'user_updated',
          `Updated user: ${editingUser.name} (@${editingUser.username})${newPassword ? ' (Password changed)' : ''}`
        );
      }

      setIsEditModalOpen(false);
      setEditingUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      
      if (currentUserProfile) {
        await logActivity(
          currentUserProfile.id,
          currentUserProfile.name,
          'user_deleted',
          `Deleted user: ${userToDelete.name} (@${userToDelete.username})`
        );
      }

      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const toggleUserStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.id), { status: newStatus });
      
      if (currentUserProfile) {
        await logActivity(
          currentUserProfile.id,
          currentUserProfile.name,
          'user_status_changed',
          `${newStatus === 'active' ? 'Activated' : 'Disabled'} user: ${user.name} (@${user.username})`
        );
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
      case 'manager': return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400';
      case 'cashier': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'baker': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400';
      case 'delivery_guy': return 'bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <ShieldCheck className="w-4 h-4" />;
      case 'manager': return <Shield className="w-4 h-4" />;
      default: return <ShieldAlert className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('users')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('manageTeam')}</p>
        </div>
        <button onClick={() => setIsInviteModalOpen(true)} className="btn-primary gap-2 w-full sm:w-auto justify-center">
          <UserPlus className="w-5 h-5" />
          {t('inviteMember')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card flex items-center gap-4 py-4 border-slate-100 dark:border-[#2a1e17]">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 w-5 h-5" />
              <input 
                type="text" 
                placeholder={t('search')} 
                className="input pl-12 bg-slate-50/50 dark:bg-[#1a1512]/50 border-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="card p-0 overflow-hidden border-slate-100 dark:border-[#2a1e17]">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest border-b border-slate-100 dark:border-[#2a1e17]">
                  <th className="px-8 py-5">{t('member')}</th>
                  <th className="px-8 py-5">{t('username')}</th>
                  <th className="px-8 py-5">{t('role')}</th>
                  <th className="px-8 py-5">{t('joined')}</th>
                  <th className="px-8 py-5 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#1a1512]">
                {users.filter(u => 
                  (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                  (u.username?.toLowerCase() || '').includes(searchTerm.toLowerCase())
                ).map((user) => (
                  <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-[#1a1512]/50 transition-all">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                          {user.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{user.name || 'Unknown'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {user.username ? `@${user.username}` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className={clsx(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        getRoleBadge(user.role)
                      )}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                        <Calendar className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                        {user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setSelectedUserForLogs(user)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 transition-all"
                          title={t('viewActivities') || 'View Activities'}
                        >
                          <Activity className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => toggleUserStatus(user)}
                          className={clsx(
                            "w-9 h-9 flex items-center justify-center rounded-lg transition-all",
                            user.status === 'active' 
                              ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" 
                              : "text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1a1512]"
                          )}
                          title={user.status === 'active' ? 'Disable User' : 'Activate User'}
                        >
                          {user.status === 'active' ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => {
                            setEditingUser(user);
                            setIsEditModalOpen(true);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1512] text-slate-400 dark:text-slate-600 transition-all"
                          title="Edit User"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            setUserToDelete(user);
                            setIsDeleteModalOpen(true);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 dark:text-red-500 transition-all"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>

        <div className="space-y-6">
          <div className="card border-slate-100 dark:border-[#2a1e17]">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              {t('auditLog')}
            </h2>
            <div className="space-y-6">
              {auditLogs.length > 0 ? (
                auditLogs.map((log, i) => (
                  <div key={log.id} className="flex gap-4 relative">
                    {i !== auditLogs.length - 1 && <div className="absolute left-2 top-6 bottom-[-24px] w-[2px] bg-slate-100 dark:bg-[#1a1512]"></div>}
                    <div className="w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900/20 border-2 border-white dark:border-black shadow-sm z-10 mt-1"></div>
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold">
                        <span className="text-primary-600 dark:text-primary-400">{log.userName}</span> {log.details}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 font-medium">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-600 italic">No activity logs found.</p>
              )}
            </div>
            {hasMoreLogs && (
              <button 
                onClick={() => setLogsLimit(prev => prev + 25)}
                className="w-full mt-8 py-3 bg-slate-50 dark:bg-[#1a1512] hover:bg-slate-100 dark:hover:bg-[#2a1e17] rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 transition-all"
              >
                {t('viewMore')}
              </button>
            )}
          </div>

          <div className="card bg-white dark:bg-zinc-900 border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <ShieldCheck className="w-10 h-10 mb-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">{t('securityOverview')}</h3>
            <p className="text-slate-500 dark:text-zinc-500 text-sm mb-6">{t('securityDescription')}</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">{t('admins')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{users.filter(u => u.role === 'admin').length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">{t('managers')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{users.filter(u => u.role === 'manager').length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">{t('staff')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{users.filter(u => !['admin', 'manager'].includes(u.role)).length}</span>
              </div>
            </div>
          </div>

          {currentUserProfile?.role === 'admin' && (
            <div className="card border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary-600" />
                {t('maintenance')}
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                {t('maintenanceDesc') || 'Clean database and ensure data consistency.'}
              </p>
              <button 
                onClick={cleanDatabase}
                disabled={isCleaning}
                className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
              >
                {isCleaning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {t('cleanDatabase') || 'Clean Database'}
              </button>
            </div>
          )}
        </div>
      </div>

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('addTeamMember')}</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('fullName')}</label>
                <input 
                  type="text" 
                  required
                  className="input" 
                  placeholder="John Doe"
                  value={inviteData.name}
                  onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('username')}</label>
                <input 
                  type="text" 
                  required
                  className="input" 
                  placeholder="johndoe"
                  value={inviteData.username}
                  onChange={(e) => setInviteData({ ...inviteData, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('password')}</label>
                <input 
                  type="password" 
                  required
                  className="input" 
                  placeholder="••••••••"
                  value={inviteData.password}
                  onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('role')}</label>
                <select 
                  className="input"
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value as Role })}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="baker">Baker</option>
                  <option value="delivery_guy">Delivery Guy</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 btn-secondary justify-center">{t('cancel')}</button>
                <button type="submit" className="flex-1 btn-primary justify-center">{t('addUser')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('editUser')}</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('username')}</label>
                <input 
                  type="text" 
                  disabled
                  className="input bg-slate-50 text-slate-500 cursor-not-allowed" 
                  value={editingUser.username}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('fullName')}</label>
                <input 
                  type="text" 
                  required
                  className="input" 
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('role')}</label>
                <select 
                  className="input disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  value={editingUser.role}
                  disabled={editingUser.role === 'admin'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as Role })}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="baker">Baker</option>
                  <option value="delivery_guy">Delivery Guy</option>
                  <option value="customer_business">Business Customer</option>
                  <option value="customer_customers">Individual Customer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                <select 
                  className="input"
                  value={editingUser.status || 'active'}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  Update Password
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                    <input 
                      type="password" 
                      className="input" 
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError('');
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Confirm New Password</label>
                    <input 
                      type="password" 
                      className="input" 
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError('');
                      }}
                    />
                  </div>
                  {passwordError && (
                    <p className="text-xs font-bold text-red-500">{passwordError}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingUser(null); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); }} className="flex-1 btn-secondary justify-center">{t('cancel')}</button>
                <button type="submit" className="flex-1 btn-primary justify-center">{t('updateUser')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Delete User</h2>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-8">
              Are you sure you want to delete <span className="font-bold text-slate-900">{userToDelete.name}</span> (@{userToDelete.username})?
            </p>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => { setIsDeleteModalOpen(false); setUserToDelete(null); }} 
                className="flex-1 btn-secondary justify-center"
              >
                {t('cancel')}
              </button>
              <button 
                type="button" 
                onClick={handleDeleteUser}
                disabled={userToDelete.role === 'admin'}
                className="flex-1 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUserForLogs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-2xl shadow-2xl border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xl">
                  {selectedUserForLogs.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedUserForLogs.name}</h2>
                  <p className="text-sm text-slate-500">{t('userActivities')} - @{selectedUserForLogs.username}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUserForLogs(null)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-all"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {userLogs.length > 0 ? (
                userLogs.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-primary-100 text-primary-700 text-[10px] font-bold uppercase tracking-wider">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium">{log.details}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">No activities recorded for this user.</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <button 
                onClick={() => setSelectedUserForLogs(null)}
                className="w-full btn-secondary justify-center"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
