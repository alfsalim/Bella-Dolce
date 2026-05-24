import { describe, it, expect } from 'vitest';
import {
  calculateGrossTurnover,
  calculateIfuTax,
  validateIfuInput,
  createIfuConfigSnapshot,
  DEFAULT_IFU_CONFIG,
} from '../lib/ifuEngine';

describe('IFU Engine', () => {
  describe('calculateGrossTurnover', () => {
    it('should sum all positive sales amounts', () => {
      const sales = [
        { totalAmount: 100, status: 'completed' },
        { totalAmount: 200, status: 'completed' },
        { totalAmount: 50, status: 'completed' },
      ];
      expect(calculateGrossTurnover(sales)).toBe(350);
    });

    it('should exclude zero or negative amounts', () => {
      const sales = [
        { totalAmount: 100, status: 'completed' },
        { totalAmount: 0, status: 'completed' },
        { totalAmount: -50, status: 'completed' },
        { totalAmount: 200, status: 'completed' },
      ];
      expect(calculateGrossTurnover(sales)).toBe(300);
    });

    it('should handle missing totalAmount as 0', () => {
      const sales = [
        { totalAmount: 100 },
        { status: 'completed' },
        { totalAmount: 50 },
      ];
      expect(calculateGrossTurnover(sales)).toBe(150);
    });

    it('should return 0 for empty sales array', () => {
      expect(calculateGrossTurnover([])).toBe(0);
    });

    it('should return 0 when all amounts are zero or negative', () => {
      const sales = [
        { totalAmount: 0 },
        { totalAmount: -100 },
        { totalAmount: -50 },
      ];
      expect(calculateGrossTurnover(sales)).toBe(0);
    });
  });

  describe('calculateIfuTax', () => {
    it('should calculate tax with default 1.5% rate', () => {
      const result = calculateIfuTax({
        grossTurnover: 100000,
        taxRatePercent: 1.5,
      });
      expect(result.taxAmountDue).toBe(1500);
      expect(result.grossTurnover).toBe(100000);
      expect(result.taxRatePercent).toBe(1.5);
    });

    it('should round to 2 decimal places for DZD currency', () => {
      const result = calculateIfuTax({
        grossTurnover: 12345.67,
        taxRatePercent: 1.5,
      });
      expect(result.taxAmountDue).toBe(185.19);
    });

    it('should handle zero turnover', () => {
      const result = calculateIfuTax({
        grossTurnover: 0,
        taxRatePercent: 1.5,
      });
      expect(result.taxAmountDue).toBe(0);
    });

    it('should handle zero tax rate', () => {
      const result = calculateIfuTax({
        grossTurnover: 100000,
        taxRatePercent: 0,
      });
      expect(result.taxAmountDue).toBe(0);
    });

    it('should handle 100% tax rate', () => {
      const result = calculateIfuTax({
        grossTurnover: 1000,
        taxRatePercent: 100,
      });
      expect(result.taxAmountDue).toBe(1000);
    });

    it('should be deterministic (same inputs always produce same outputs)', () => {
      const input = { grossTurnover: 50000.555, taxRatePercent: 2.75 };
      const result1 = calculateIfuTax(input);
      const result2 = calculateIfuTax(input);
      expect(result1.taxAmountDue).toBe(result2.taxAmountDue);
      expect(result1.taxAmountDue).toBe(1375.02);
    });
  });

  describe('validateIfuInput', () => {
    it('should validate correct input', () => {
      const validation = validateIfuInput({
        grossTurnover: 100000,
        taxRatePercent: 1.5,
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject negative gross turnover', () => {
      const validation = validateIfuInput({
        grossTurnover: -1000,
        taxRatePercent: 1.5,
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Gross turnover cannot be negative');
    });

    it('should reject tax rate < 0%', () => {
      const validation = validateIfuInput({
        grossTurnover: 100000,
        taxRatePercent: -1,
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Tax rate must be between 0% and 100%');
    });

    it('should reject tax rate > 100%', () => {
      const validation = validateIfuInput({
        grossTurnover: 100000,
        taxRatePercent: 101,
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Tax rate must be between 0% and 100%');
    });

    it('should accept boundary values 0% and 100%', () => {
      const validation0 = validateIfuInput({
        grossTurnover: 100000,
        taxRatePercent: 0,
      });
      expect(validation0.valid).toBe(true);

      const validation100 = validateIfuInput({
        grossTurnover: 100000,
        taxRatePercent: 100,
      });
      expect(validation100.valid).toBe(true);
    });

    it('should accept zero turnover', () => {
      const validation = validateIfuInput({
        grossTurnover: 0,
        taxRatePercent: 1.5,
      });
      expect(validation.valid).toBe(true);
    });

    it('should collect multiple errors', () => {
      const validation = validateIfuInput({
        grossTurnover: -5000,
        taxRatePercent: 150,
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero turnover with normal tax rate', () => {
      const result = calculateIfuTax({
        grossTurnover: 0,
        taxRatePercent: 1.5,
      });
      expect(result.taxAmountDue).toBe(0);
    });

    it('should handle very large turnover values', () => {
      const result = calculateIfuTax({
        grossTurnover: 999999999.99,
        taxRatePercent: 1.5,
      });
      expect(result.taxAmountDue).toBe(15000000);
    });

    it('should handle fractional tax rates', () => {
      const result = calculateIfuTax({
        grossTurnover: 100000,
        taxRatePercent: 0.5,
      });
      expect(result.taxAmountDue).toBe(500);
    });

    it('should handle small decimal amounts', () => {
      const result = calculateIfuTax({
        grossTurnover: 1.23,
        taxRatePercent: 1.5,
      });
      expect(result.taxAmountDue).toBe(0.02);
    });
  });

  describe('Configuration Snapshot', () => {
    it('should create a snapshot with all required fields', () => {
      const snapshot = createIfuConfigSnapshot(DEFAULT_IFU_CONFIG, 2026);
      expect(snapshot).toHaveProperty('taxRatePercent');
      expect(snapshot).toHaveProperty('year');
      expect(snapshot).toHaveProperty('snapshotDate');
      expect(snapshot).toHaveProperty('system');
      expect(snapshot.taxRatePercent).toBe(DEFAULT_IFU_CONFIG.ratePercent);
      expect(snapshot.year).toBe(2026);
      expect(snapshot.system).toBe('bella-dolce-v1.0');
    });

    it('should serialize to JSON', () => {
      const snapshot = createIfuConfigSnapshot(DEFAULT_IFU_CONFIG, 2026);
      const json = JSON.stringify(snapshot);
      const parsed = JSON.parse(json);
      expect(parsed.taxRatePercent).toBe(1.5);
      expect(parsed.year).toBe(2026);
    });

    it('should include description if provided', () => {
      const config = { ...DEFAULT_IFU_CONFIG, description: 'Custom rate for 2026' };
      const snapshot = createIfuConfigSnapshot(config, 2026);
      expect(snapshot.description).toBe('Custom rate for 2026');
    });

    it('should generate ISO timestamp for snapshot date', () => {
      const snapshot = createIfuConfigSnapshot(DEFAULT_IFU_CONFIG, 2026);
      const date = new Date(snapshot.snapshotDate);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now());
      expect(date.getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('Default Configuration', () => {
    it('should have 1.5% as default rate', () => {
      expect(DEFAULT_IFU_CONFIG.ratePercent).toBe(1.5);
    });

    it('should be marked as IFU_RATE type', () => {
      expect(DEFAULT_IFU_CONFIG.type).toBe('IFU_RATE');
    });

    it('should have appropriate description', () => {
      expect(DEFAULT_IFU_CONFIG.description).toContain('bakery');
    });
  });

  describe('Integration Scenarios', () => {
    it('should calculate annual IFU from aggregated monthly turnover', () => {
      const monthlySales = [
        { totalAmount: 50000, status: 'completed' },
        { totalAmount: 55000, status: 'completed' },
        { totalAmount: 48000, status: 'completed' },
        { totalAmount: 52000, status: 'completed' },
      ];
      const annualTurnover = calculateGrossTurnover(monthlySales);
      const taxResult = calculateIfuTax({
        grossTurnover: annualTurnover,
        taxRatePercent: 1.5,
      });
      expect(annualTurnover).toBe(205000);
      expect(taxResult.taxAmountDue).toBe(3075);
    });

    it('should handle complete declaration workflow', () => {
      const sales = [
        { totalAmount: 100000 },
        { totalAmount: 50000 },
      ];
      const turnover = calculateGrossTurnover(sales);
      expect(turnover).toBe(150000);

      const validation = validateIfuInput({
        grossTurnover: turnover,
        taxRatePercent: 1.5,
      });
      expect(validation.valid).toBe(true);

      const calculation = calculateIfuTax({
        grossTurnover: turnover,
        taxRatePercent: 1.5,
      });
      expect(calculation.taxAmountDue).toBe(2250);

      const snapshot = createIfuConfigSnapshot(DEFAULT_IFU_CONFIG, 2026);
      expect(snapshot.taxRatePercent).toBe(1.5);
    });
  });
});
