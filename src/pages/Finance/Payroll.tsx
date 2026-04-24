import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Users, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Calculator,
  Printer,
  Mail,
  X,
  ChevronRight,
  ChevronLeft,
  UserPlus
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import BilingualLabel from '../../components/BilingualLabel';
import { financeService } from '../../services/financeService';
import { FinancialEmployee, PayrollStatus, UserProfile } from '../../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const Payroll: React.FC = () => {
  const { formatCurrency, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('employees');
  const [employees, setEmployees] = useState<FinancialEmployee[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'select-user' | 'salary-details'>('select-user');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  
  // Form State
  const [formData, setFormData] = useState({
    matricule: '',
    nin: '',
    cnasNumber: '',
    department: '',
    hireDate: format(new Date(), 'yyyy-MM-dd'),
    baseSalary: 0,
    transportAllowance: 0,
    performanceBonus: 0,
    otherAllowances: 0,
    contributesToCNAS: true,
    bankRIB: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedEmployees, fetchedUsers] = await Promise.all([
        financeService.getFinancialEmployees(),
        financeService.getAllUsers()
      ]);
      setEmployees(fetchedEmployees);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching payroll data:', error);
      toast.error('Failed to load payroll data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.matricule.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const availableUsers = useMemo(() => {
    const employeeIds = new Set(employees.map(emp => emp.id));
    const filtered = users.filter(user => 
      !employeeIds.has(user.id) && 
      (user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
       user.role.toLowerCase().includes(userSearchQuery.toLowerCase()))
    );

    // Sort: Non-admin roles first
    return [...filtered].sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return 1;
      if (a.role !== 'admin' && b.role === 'admin') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [users, employees, userSearchQuery]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USERS_PER_PAGE;
    return availableUsers.slice(start, start + USERS_PER_PAGE);
  }, [availableUsers, userPage]);

  const totalUserPages = Math.ceil(availableUsers.length / USERS_PER_PAGE);

  const handleAddEmployee = async () => {
    if (!selectedUser) return;

    try {
      const newEmployee: FinancialEmployee = {
        ...selectedUser,
        ...formData,
        id: selectedUser.id,
        name: selectedUser.name,
        role: selectedUser.role,
        status: 'ACTIF',
        createdAt: new Date().toISOString()
      };

      await financeService.addFinancialEmployee(newEmployee);
      toast.success('Employee added successfully');
      setIsModalOpen(false);
      resetModal();
      fetchData();
    } catch (error) {
      console.error('Error adding employee:', error);
      toast.error('Failed to add employee');
    }
  };

  const resetModal = () => {
    setModalStep('select-user');
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserPage(1);
    setFormData({
      matricule: '',
      nin: '',
      cnasNumber: '',
      department: '',
      hireDate: format(new Date(), 'yyyy-MM-dd'),
      baseSalary: 0,
      transportAllowance: 0,
      performanceBonus: 0,
      otherAllowances: 0,
      contributesToCNAS: true,
      bankRIB: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/10">
        <button
          onClick={() => setActiveSubTab('employees')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'employees'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="employees" tf />
          {activeSubTab === 'employees' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('runs')}
          className={clsx(
            "pb-3 text-sm font-bold transition-all relative",
            activeSubTab === 'runs'
              ? "text-primary-600"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BilingualLabel tKey="payrollRuns" tf />
          {activeSubTab === 'runs' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
              >
                <Plus className="w-5 h-5" />
                <BilingualLabel tKey="addEmployee" tf />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEmployees.map((emp) => {
                const payroll = financeService.calculatePayroll(emp.baseSalary, emp.transportAllowance, emp.otherAllowances);
                return (
                  <div 
                    key={emp.id}
                    className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">{emp.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{emp.role}</p>
                        </div>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400 group-hover:text-primary-600 transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 dark:border-white/5">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Base Salary</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(emp.baseSalary)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net to Pay</p>
                        <p className="font-bold text-emerald-600">{formatCurrency(payroll.net)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CNAS (9%)</p>
                        <p className="font-bold text-rose-600">{formatCurrency(payroll.cnasEmployee)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">IRG</p>
                        <p className="font-bold text-rose-600">{formatCurrency(payroll.irg)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {emp.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-primary-600 transition-colors">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-primary-600 transition-colors">
                          <Mail className="w-4 h-4" />
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

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {modalStep === 'select-user' ? 'Select User' : 'Salary Details'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {modalStep === 'select-user' 
                    ? 'Choose an existing user to add to payroll' 
                    : `Configuring payroll for ${selectedUser?.name}`
                  }
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {modalStep === 'select-user' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        setUserPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {paginatedUsers.length > 0 ? (
                      <>
                        {paginatedUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setSelectedUser(user);
                              setModalStep('salary-details');
                            }}
                            className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all text-left group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:text-primary-600 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-all">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user.role}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 transition-colors" />
                          </button>
                        ))}

                        {totalUserPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                              Page {userPage} of {totalUserPages}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                                disabled={userPage === 1}
                                className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg disabled:opacity-50 transition-all"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setUserPage(prev => Math.min(totalUserPages, prev + 1))}
                                disabled={userPage === totalUserPages}
                                className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg disabled:opacity-50 transition-all"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-10 text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        {users.length === 0 ? (
                          <p>No users found in the system. Please add users first.</p>
                        ) : availableUsers.length === 0 ? (
                          <p>All users are already enrolled in payroll.</p>
                        ) : (
                          <p>No users match your search.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-primary-600 uppercase tracking-widest">Administrative</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Matricule</label>
                        <input
                          type="text"
                          value={formData.matricule}
                          onChange={(e) => setFormData({...formData, matricule: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                          placeholder="e.g., 2026001"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">NIN (National ID)</label>
                        <input
                          type="text"
                          value={formData.nin}
                          onChange={(e) => setFormData({...formData, nin: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                          placeholder="18-digit number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">CNAS Number</label>
                        <input
                          type="text"
                          value={formData.cnasNumber}
                          onChange={(e) => setFormData({...formData, cnasNumber: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Hire Date</label>
                        <input
                          type="date"
                          value={formData.hireDate}
                          onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-primary-600 uppercase tracking-widest">Financial</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Base Salary (DZD)</label>
                        <input
                          type="number"
                          value={formData.baseSalary}
                          onChange={(e) => setFormData({...formData, baseSalary: Number(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Transport Allowance</label>
                        <input
                          type="number"
                          value={formData.transportAllowance}
                          onChange={(e) => setFormData({...formData, transportAllowance: Number(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Other Allowances</label>
                        <input
                          type="number"
                          value={formData.otherAllowances}
                          onChange={(e) => setFormData({...formData, otherAllowances: Number(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                        <input
                          type="checkbox"
                          id="cnas"
                          checked={formData.contributesToCNAS}
                          onChange={(e) => setFormData({...formData, contributesToCNAS: e.target.checked})}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="cnas" className="text-sm font-bold text-slate-700 dark:text-slate-200">Contributes to CNAS (9%)</label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between">
              {modalStep === 'salary-details' ? (
                <button
                  onClick={() => setModalStep('select-user')}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
              ) : (
                <div />
              )}
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                {modalStep === 'salary-details' && (
                  <button
                    onClick={handleAddEmployee}
                    className="px-8 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 flex items-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    Complete Setup
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'runs' && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Calculator className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">Payroll Runs Module coming soon</p>
          <p className="text-sm">Automated CNAS/IRG reporting is active</p>
        </div>
      )}
    </div>
  );
};

export default Payroll;
