import { getSyncMeta } from '../db';
import type { LocalTransaction } from '../db/types';

// Mirrors PrintAgent/src/BellaDolce.PrintAgent/Models/PrintJob.cs and the
// payload server.ts's POST /api/print-receipt builds — called directly here
// since the server's PRINT_AGENT_URL only resolves on the server's network,
// not the cashier's local machine.

interface PrintJob {
  saleId: string;
  receiptNumber: string;
  cashierName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  changeGiven: number;
}

// GET /health on the local PrintAgent (PrintController.cs). Returns false
// (no error thrown) on tablets where no PrintAgent is configured/reachable.
export async function isPrintAgentAvailable(): Promise<boolean> {
  const meta = await getSyncMeta();
  if (!meta.printAgentUrl) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${meta.printAgentUrl.replace(/\/$/, '')}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// POST /print on the local PrintAgent. Caller must check
// isPrintAgentAvailable() first; on tablets (printAgentUrl unset) this is
// never called and the on-screen receipt is the only output (BRD §10.5).
export async function printReceipt(txn: LocalTransaction, receiptNumber: string, serverSaleId: string): Promise<void> {
  const meta = await getSyncMeta();
  if (!meta.printAgentUrl) return;

  const job: PrintJob = {
    saleId: serverSaleId,
    receiptNumber,
    cashierName: txn.cashierName,
    items: txn.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal: item.price * item.quantity,
    })),
    total: txn.totalAmount,
    paymentMethod: txn.paymentMethod,
    amountPaid: txn.amountPaid,
    changeGiven: txn.change,
  };

  const res = await fetch(`${meta.printAgentUrl.replace(/\/$/, '')}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Print failed (${res.status})`);
  }
}
