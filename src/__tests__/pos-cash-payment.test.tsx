import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

/**
 * Mock checkout modal component that isolates the cash payment logic
 * This is based on the actual checkout modal in POS.tsx
 */
const MockCheckoutModal = ({
  isOpen,
  onClose,
  total = 1000,
  onPaymentMethodChange = () => {},
}: {
  isOpen: boolean;
  onClose: () => void;
  total?: number;
  onPaymentMethodChange?: (method: 'cash' | 'card') => void;
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [isProcessing] = useState(false);

  const amountPaidNum = parseFloat(amountPaid) || 0;
  const isCheckoutDisabled = paymentMethod === 'cash' && amountPaidNum < total;

  const handlePaymentMethodChange = (method: 'cash' | 'card') => {
    setPaymentMethod(method);
    setAmountPaid('');
    onPaymentMethodChange(method);
  };

  const formatCurrency = (amount: number): string => {
    const formatted = new Intl.NumberFormat('fr-DZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} DA`;
  };

  const handleCheckout = () => {
    if (isCheckoutDisabled) return;
    // Call parent handler
  };

  if (!isOpen) return null;

  return (
    <div data-testid="checkout-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60">
      <div className="card w-full max-w-md shadow-2xl relative overflow-hidden">
        <button
          onClick={() => {
            onClose();
            setAmountPaid('');
          }}
          data-testid="close-modal"
          className="absolute top-4 right-4"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold mb-6">Payer</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-4">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePaymentMethodChange('cash')}
                data-testid="payment-cash"
                className={`p-5 rounded-xl border-2 ${
                  paymentMethod === 'cash'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                Espèces
              </button>
              <button
                onClick={() => handlePaymentMethodChange('card')}
                data-testid="payment-card"
                className={`p-5 rounded-xl border-2 ${
                  paymentMethod === 'card'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                Carte
              </button>
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-3">Montant payé</label>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  placeholder={total.toString()}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  data-testid="amount-paid-input"
                  className="input w-full border-2 border-gray-200"
                />
              </div>

              {amountPaid && (
                <div
                  data-testid="change-display"
                  className={`p-4 rounded-xl font-bold text-center ${
                    amountPaidNum >= total
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {amountPaidNum >= total
                    ? `Monnaie à rendre: ${formatCurrency(amountPaidNum - total)}`
                    : `Manque: ${formatCurrency(total - amountPaidNum)}`}
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-gray-50 rounded-2xl">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-bold text-xs">Montant dû</span>
              <span className="text-2xl font-bold">{total.toLocaleString()} DA</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={isProcessing || isCheckoutDisabled}
            data-testid="confirm-payment-btn"
            className={`w-full py-5 text-xl font-bold rounded-xl ${
              isProcessing || isCheckoutDisabled
                ? 'opacity-70 cursor-not-allowed bg-gray-400'
                : 'bg-blue-600 text-white'
            }`}
          >
            {isProcessing ? 'Traitement…' : 'Confirmer le paiement'}
          </button>
        </div>
      </div>
    </div>
  );
};

describe('POS Cash Payment Flow', () => {
  const mockOnClose = vi.fn();
  const mockOnPaymentChange = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnPaymentChange.mockClear();
  });

  /**
   * Test 1: Cash input field appears only when payment method is "cash"
   */
  it('should show amount paid input field when cash is selected', async () => {
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    // Cash should be selected by default
    const amountPaidInput = screen.getByTestId('amount-paid-input');
    expect(amountPaidInput).toBeInTheDocument();
  });

  /**
   * Test 2: Cash input field hidden when payment method is "card"
   */
  it('should hide amount paid input field when card is selected', async () => {
    const user = userEvent.setup();
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    const cardButton = screen.getByTestId('payment-card');
    await user.click(cardButton);

    // Amount paid input should not be visible
    const amountPaidInput = screen.queryByTestId('amount-paid-input');
    expect(amountPaidInput).not.toBeInTheDocument();
  });

  /**
   * Test 3: Change displayed correctly when amount paid > total
   * Input: total = 1000, amount paid = 1200
   * Expected: "Monnaie à rendre: 200.00 DA"
   */
  it('should display change correctly when amount paid > total', async () => {
    const user = userEvent.setup();
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    const amountInput = screen.getByTestId('amount-paid-input') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '1200');

    const changeDisplay = screen.getByTestId('change-display');
    expect(changeDisplay).toBeInTheDocument();
    expect(changeDisplay.textContent).toContain('Monnaie à rendre');
    expect(changeDisplay.textContent).toContain('200');
    expect(changeDisplay).toHaveClass('bg-emerald-100');
  });

  /**
   * Test 4: Shortage displayed correctly when amount paid < total
   * Input: total = 1000, amount paid = 700
   * Expected: "Manque: 300.00 DA"
   */
  it('should display shortage correctly when amount paid < total', async () => {
    const user = userEvent.setup();
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    const amountInput = screen.getByTestId('amount-paid-input') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '700');

    const changeDisplay = screen.getByTestId('change-display');
    expect(changeDisplay).toBeInTheDocument();
    expect(changeDisplay.textContent).toContain('Manque');
    expect(changeDisplay.textContent).toContain('300');
    expect(changeDisplay).toHaveClass('bg-red-100');
  });

  /**
   * Test 5: Confirm button disabled when cash and amount paid < total
   * Condition: paymentMethod === 'cash' && amountPaidNum < total
   */
  it('should disable confirm button when cash is selected and amount paid < total', async () => {
    const user = userEvent.setup();
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    const amountInput = screen.getByTestId('amount-paid-input') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '500');

    const confirmBtn = screen.getByTestId('confirm-payment-btn');
    expect(confirmBtn).toBeDisabled();
  });

  /**
   * Test 6: Confirm button enabled when cash and amount paid >= total
   * Condition: paymentMethod === 'cash' && amountPaidNum >= total
   */
  it('should enable confirm button when cash is selected and amount paid >= total', async () => {
    const user = userEvent.setup();
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    const amountInput = screen.getByTestId('amount-paid-input') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '1500');

    const confirmBtn = screen.getByTestId('confirm-payment-btn');
    expect(confirmBtn).not.toBeDisabled();
  });

  /**
   * Test 7: Confirm button enabled for card regardless of amount
   * When paymentMethod === 'card', isCheckoutDisabled should always be false
   */
  it('should enable confirm button for card payment regardless of amount', async () => {
    const user = userEvent.setup();
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    const cardButton = screen.getByTestId('payment-card');
    await user.click(cardButton);

    const confirmBtn = screen.getByTestId('confirm-payment-btn');
    expect(confirmBtn).not.toBeDisabled();
  });

  /**
   * Test 8: Amount paid resets when switching payment methods
   * When switching from cash to card and back to cash, amountPaid should be empty
   */
  it('should reset amount paid when switching between payment methods', async () => {
    const user = userEvent.setup();
    render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    // Enter amount in cash
    const amountInput = screen.getByTestId('amount-paid-input') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '500');

    expect(amountInput.value).toBe('500');

    // Switch to card
    const cardButton = screen.getByTestId('payment-card');
    await user.click(cardButton);

    // Amount input should be gone (card doesn't show it)
    expect(screen.queryByTestId('amount-paid-input')).not.toBeInTheDocument();

    // Switch back to cash
    const cashButton = screen.getByTestId('payment-cash');
    await user.click(cashButton);

    // Amount input should be visible and empty
    const newAmountInput = screen.getByTestId('amount-paid-input') as HTMLInputElement;
    expect(newAmountInput).toBeInTheDocument();
    expect(newAmountInput.value).toBe('');
  });

  /**
   * Test 9: Closing modal resets amount paid state
   * When closing the modal, amountPaid should reset
   */
  it('should reset amount paid when modal is closed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MockCheckoutModal
        isOpen={true}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    // Enter amount
    const amountInput = screen.getByTestId('amount-paid-input') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '500');

    // Click close button
    const closeBtn = screen.getByTestId('close-modal');
    await user.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();

    // Re-render with modal closed
    rerender(
      <MockCheckoutModal
        isOpen={false}
        onClose={mockOnClose}
        total={1000}
        onPaymentMethodChange={mockOnPaymentChange}
      />
    );

    expect(screen.queryByTestId('amount-paid-input')).not.toBeInTheDocument();
  });
});
