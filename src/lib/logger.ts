import { db, collection, addDoc, handleFirestoreError, OperationType } from './firebase';
import { ActivityLog } from '../types';

export const logActivity = async (userId: string, userName: string, action: string, details: string) => {
  try {
    const log: Partial<ActivityLog> = {
      userId,
      userName,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, 'activityLogs'), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'activityLogs');
  }
};
