/**
 * Generate a short, readable transaction ID from a date
 * Format: YYYYMMDD-HHmmss (e.g., 20260512-131646)
 *
 * This format is:
 * - Human readable (contains date and time)
 * - Unique (to the second, sufficient for POS use)
 * - Short (14 characters)
 * - Sortable
 */
export function generateTransactionId(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}
