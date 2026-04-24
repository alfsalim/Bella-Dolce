import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch, 
  Timestamp,
  onSnapshot,
  db, 
  auth
} from '../lib/firebase';
import { 
  Account, 
  JournalEntry, 
  JournalLine, 
  JournalStatus,
  OperationType,
  FinancialEmployee,
  UserProfile
} from '../types';
import { handleFirestoreError } from '../lib/firebase';
import { format } from 'date-fns';

export const financeService = {
  // Account Management
  async getAccounts(): Promise<Account[]> {
    try {
      const snapshot = await getDocs(collection(db, 'accounts'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'accounts');
      return [];
    }
  },

  async createAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newDoc = doc(collection(db, 'accounts'));
      const data = {
        ...account,
        id: newDoc.id,
        createdAt: new Date().toISOString()
      };
      await setDoc(newDoc, data);
      return newDoc.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'accounts');
      throw error;
    }
  },

  // Journal Entries
  async createJournalEntry(
    entry: Omit<JournalEntry, 'id' | 'createdAt' | 'number'>,
    lines: Omit<JournalLine, 'id' | 'journalId' | 'createdAt'>[]
  ): Promise<string> {
    try {
      const batch = writeBatch(db);
      const entryDoc = doc(collection(db, 'journalEntries'));
      
      // Generate journal number (e.g., JV-2026-00001)
      // For simplicity in this demo, we'll use a timestamp-based number
      const entryNumber = `JV-${format(new Date(), 'yyyyMMdd-HHmmss')}`;
      
      const entryData: JournalEntry = {
        ...entry,
        id: entryDoc.id,
        number: entryNumber,
        createdAt: new Date().toISOString()
      };
      
      batch.set(entryDoc, entryData);
      
      lines.forEach(line => {
        const lineDoc = doc(collection(db, 'journalLines'));
        const lineData: JournalLine = {
          ...line,
          id: lineDoc.id,
          journalId: entryDoc.id,
          createdAt: new Date().toISOString()
        };
        batch.set(lineDoc, lineData);
      });
      
      await batch.commit();
      return entryDoc.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'journalEntries');
      throw error;
    }
  },

  // Automatic Journal Entry for Sales (CASH ONLY)
  async createSaleJournalEntry(saleId: string, totalAmount: number, tvaAmount: number) {
    const period = format(new Date(), 'yyyy-MM');
    const date = format(new Date(), 'yyyy-MM-dd');
    
    const lines: Omit<JournalLine, 'id' | 'journalId' | 'createdAt'>[] = [
      {
        accountNumber: '1101', // Caisse Principale
        debit: totalAmount,
        credit: 0,
        label: `Vente POS ${saleId}`
      },
      {
        accountNumber: '4001', // Ventes (assuming bread for simplicity)
        debit: 0,
        credit: totalAmount - tvaAmount,
        label: `Vente POS ${saleId}`
      },
      {
        accountNumber: '2301', // TVA Collectée
        debit: 0,
        credit: tvaAmount,
        label: `TVA Vente POS ${saleId}`
      }
    ];

    return this.createJournalEntry({
      date,
      period,
      label: `Vente POS ${saleId}`,
      sourceModule: 'POS',
      sourceId: saleId,
      status: 'COMPTABILISÉ',
      createdBy: auth.currentUser?.uid || 'system'
    }, lines);
  },

  // Payroll Calculation Logic
  calculatePayroll(baseSalary: number, transport: number, bonus: number) {
    const gross = baseSalary + transport + bonus;
    const cnasEmployee = gross * 0.09;
    const taxableGross = gross - cnasEmployee;
    
    // IRG Calculation (Algerian Progressive Brackets)
    // Simplified for the demo
    let irg = 0;
    if (taxableGross > 30000) {
      irg = (taxableGross - 30000) * 0.27 + (30000 - 10000) * 0.23;
    } else if (taxableGross > 10000) {
      irg = (taxableGross - 10000) * 0.23;
    }
    
    // Abattement 40% (max 1500)
    const abatement = Math.min(irg * 0.4, 1500);
    const irgFinal = Math.max(irg - abatement, 0);
    
    const net = taxableGross - irgFinal;
    const cnasEmployer = gross * 0.26;
    
    return {
      gross,
      cnasEmployee,
      taxableGross,
      irg: irgFinal,
      net,
      cnasEmployer,
      totalEmployerCost: gross + cnasEmployer
    };
  },

  // Financial Employee Management
  async getFinancialEmployees(): Promise<FinancialEmployee[]> {
    try {
      const snapshot = await getDocs(collection(db, 'financialEmployees'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialEmployee));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'financialEmployees');
      throw error;
    }
  },

  async addFinancialEmployee(employee: Omit<FinancialEmployee, 'createdAt'>): Promise<string> {
    try {
      const data = {
        ...employee,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'financialEmployees', employee.id), data);
      return employee.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'financialEmployees');
      throw error;
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
      throw error;
    }
  }
};
