import {
  IfuCalculationInput,
  IfuCalculationResult,
  validateIfuInput,
  calculateIfuTax,
  calculateGrossTurnover,
  createIfuConfigSnapshot,
  DEFAULT_IFU_CONFIG,
  TaxConfig,
  IfuConfigSnapshot,
} from '../lib/ifuEngine';
import { authFetch, getAuthHeaders, readApiErrorMessage } from '../lib/api-client';

export interface IfuDeclaration {
  id: string;
  year: number;
  grossTurnover: number;
  taxRatePercent: number;
  taxAmountDue: number;
  configSnapshot?: string;
  status: 'BROUILLON' | 'FINALISÉ' | 'SOUMIS';
  finalizedBy?: string;
  finalizedAt?: string;
  submittedAt?: string;
  submissionReference?: string;
  amendmentOf?: string;
  createdAt: string;
  updatedAt: string;
}

export const taxService = {
  // Configuration Management
  async getTaxConfig(type: string = 'IFU_RATE', year?: number): Promise<TaxConfig | null> {
    const params = new URLSearchParams();
    params.append('type', type);
    if (year !== undefined) params.append('year', String(year));

    const res = await authFetch(`/api/admin/tax-config?${params}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(await readApiErrorMessage(res));
    }
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : data;
  },

  async saveTaxConfig(config: Omit<TaxConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaxConfig> {
    const res = await authFetch('/api/admin/tax-config', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(await readApiErrorMessage(res));
    return res.json();
  },

  async getDefaultConfig(): Promise<TaxConfig> {
    const config = await this.getTaxConfig('IFU_RATE', new Date().getFullYear());
    return config || DEFAULT_IFU_CONFIG;
  },

  // IFU Declaration Management
  async getIfuDeclarations(year?: number): Promise<IfuDeclaration[]> {
    const params = year ? `?year=${year}` : '';
    const res = await authFetch(`/api/tax/ifu-declarations${params}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch IFU declarations');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async getIfuDeclaration(id: string): Promise<IfuDeclaration | null> {
    const res = await authFetch(`/api/tax/ifu-declarations/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch IFU declaration');
    }
    return res.json();
  },

  async createIfuDeclaration(input: {
    year: number;
    grossTurnover: number;
    taxRatePercent: number;
  }): Promise<IfuDeclaration> {
    const validation = validateIfuInput({
      grossTurnover: input.grossTurnover,
      taxRatePercent: input.taxRatePercent,
    });
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const calculation = calculateIfuTax({
      grossTurnover: input.grossTurnover,
      taxRatePercent: input.taxRatePercent,
    });

    const res = await authFetch('/api/tax/ifu-declarations', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: input.year,
        grossTurnover: calculation.grossTurnover,
        taxRatePercent: calculation.taxRatePercent,
        taxAmountDue: calculation.taxAmountDue,
        status: 'BROUILLON',
      }),
    });
    if (!res.ok) throw new Error(await readApiErrorMessage(res));
    return res.json();
  },

  async updateIfuDeclaration(
    id: string,
    updates: Partial<{
      grossTurnover: number;
      taxRatePercent: number;
    }>
  ): Promise<IfuDeclaration> {
    let taxAmountDue: number | undefined;

    if (updates.grossTurnover !== undefined || updates.taxRatePercent !== undefined) {
      const current = await this.getIfuDeclaration(id);
      if (!current) throw new Error('Declaration not found');

      const calculation = calculateIfuTax({
        grossTurnover: updates.grossTurnover ?? current.grossTurnover,
        taxRatePercent: updates.taxRatePercent ?? current.taxRatePercent,
      });
      taxAmountDue = calculation.taxAmountDue;
    }

    const body: any = { ...updates };
    if (taxAmountDue !== undefined) body.taxAmountDue = taxAmountDue;

    const res = await authFetch(`/api/tax/ifu-declarations/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await readApiErrorMessage(res));
    return res.json();
  },

  async finalizeIfuDeclaration(id: string, userId: string): Promise<IfuDeclaration> {
    const res = await authFetch(`/api/tax/ifu-declarations/${id}/finalize`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(await readApiErrorMessage(res));
    return res.json();
  },

  // Calculation Helpers
  calculateTax(input: IfuCalculationInput): IfuCalculationResult {
    return calculateIfuTax(input);
  },

  aggregateTurnover(sales: Array<{ totalAmount?: number; status?: string }>): number {
    return calculateGrossTurnover(sales);
  },

  validate(input: IfuCalculationInput) {
    return validateIfuInput(input);
  },

  createSnapshot(config: TaxConfig, year: number): IfuConfigSnapshot {
    return createIfuConfigSnapshot(config, year);
  },
};
