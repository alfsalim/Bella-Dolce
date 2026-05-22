/**
 * Generates an automatic comment for a transaction based on payment details
 * Rules (in order):
 * 1. If amountPaid === 0 → "Free"
 * 2. If totalAmount > amountPaid (and not free) → "discount {{diff}}DZ"
 * 3. Otherwise → empty string
 */
export function generateTransactionComment(
  totalAmount: number,
  amountPaid: number | undefined | null
): string {
  const paid = amountPaid ?? 0;

  // Free transaction
  if (paid === 0) {
    return "Free";
  }

  // Discount (paid less than total)
  if (totalAmount > paid) {
    const discount = totalAmount - paid;
    return `discount ${discount.toFixed(0)}DZ`;
  }

  return "";
}

/**
 * Generates a comment indicating the transaction was not printed
 */
export function getNoPrintComment(): string {
  return "No Print";
}

/**
 * Generates a comment indicating the transaction is being reprinted
 */
export function getReprintComment(): string {
  return "Reprint";
}
