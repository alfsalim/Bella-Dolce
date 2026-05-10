import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReceiptPreview from '../components/ReceiptPreview';
import { LanguageProvider } from '../contexts/LanguageContext';
import * as apiClient from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  authFetch: vi.fn(),
  db: {},
  getAuthHeaders: () => ({ 'Content-Type': 'application/json' }),
  readApiErrorMessage: async () => 'Error',
  parseJsonResponse: async () => ({})
}));

describe('ReceiptPreview', () => {
  const renderWithLanguage = (component: React.ReactElement) => {
    return render(
      <LanguageProvider>{component}</LanguageProvider>
    );
  };

  const mockOnClose = vi.fn();
  const mockReceipt = {
    receiptNumber: '20260510-001',
    storeName: 'Boulangerie Bella-Dolce',
    storeAddress: 'SIDI-ABDELLAH ALGER',
    items: [
      { name: 'Pain Complet', quantity: 2, unitPrice: 150, lineTotal: 300 },
      { name: 'Croissant', quantity: 3, unitPrice: 80, lineTotal: 240 }
    ],
    totalAmount: 540,
    paymentMethod: 'cash',
    amountPaid: 600,
    change: 60,
    cashierName: 'Fatima',
    dateTime: new Date('2026-05-10T14:30:00'),
    autoCloseDelay: 5000
  };

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('should display receipt preview after successful payment confirmation', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByRole('region', { name: /receipt/i })).toBeInTheDocument();
  });

  it('should show store name "Boulangerie Bella-Dolce"', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText('Boulangerie Bella-Dolce')).toBeInTheDocument();
  });

  it('should show store address "SIDI-ABDELLAH ALGER"', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText('SIDI-ABDELLAH ALGER')).toBeInTheDocument();
  });

  it('should show list of purchased items with name, qty, unit price, and line total', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    const painText = screen.getByText('Pain Complet');
    expect(painText).toBeInTheDocument();
    const croissantText = screen.getByText('Croissant');
    expect(croissantText).toBeInTheDocument();
    expect(screen.getByText('Article')).toBeInTheDocument();
  });

  it('should show total amount', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText(/Montant total/)).toBeInTheDocument();
    expect(screen.getByText(/540,00 DA/)).toBeInTheDocument();
  });

  it('should show payment method', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText(/cash|espèces/i)).toBeInTheDocument();
  });

  it('should show amount paid and change for cash payment', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText(/Montant payé/)).toBeInTheDocument();
    expect(screen.getByText(/600/)).toBeInTheDocument();
    expect(screen.getByText(/Monnaie/)).toBeInTheDocument();
    expect(screen.getByText(/60,00 DA/)).toBeInTheDocument();
  });

  it('should hide amount paid and change for card payment', () => {
    const cardReceipt = { ...mockReceipt, paymentMethod: 'card', amountPaid: undefined, change: undefined };
    renderWithLanguage(<ReceiptPreview {...cardReceipt} onClose={mockOnClose} />);
    expect(screen.queryByText(/Montant payé/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Monnaie/)).not.toBeInTheDocument();
  });

  it('should show receipt number in format YYYYMMDD-XXX', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText(/20260510-001/)).toBeInTheDocument();
  });

  it('should show cashier name', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText('Fatima')).toBeInTheDocument();
  });

  it('should show date and time', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText(/2026-05-10|10\/05\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/14:30|2:30/)).toBeInTheDocument();
  });

  it('should show French footer message', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText(/Merci pour votre visite/)).toBeInTheDocument();
    expect(screen.getByText(/Demandez votre ticket/)).toBeInTheDocument();
  });

  it('should be scrollable with max height', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    const receiptContainer = screen.getByRole('region', { name: /receipt/i });
    expect(receiptContainer).toHaveClass('max-h-64');
    expect(receiptContainer).toHaveClass('overflow-y-auto');
  });

  it('should display close button', () => {
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByRole('button', { name: /close|fermer/i })).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    await user.click(screen.getByRole('button', { name: /close|fermer/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should auto-close after configurable delay when no print error', async () => {
    vi.useFakeTimers();
    try {
      renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} autoCloseDelay={1000} />);
      vi.advanceTimersByTime(1000);
      expect(mockOnClose).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ReceiptPreview with Print Integration', () => {
  const renderWithLanguage = (component: React.ReactElement) => {
    return render(
      <LanguageProvider>{component}</LanguageProvider>
    );
  };

  const mockOnClose = vi.fn();
  const mockSaleId = 'sale-123';

  const mockReceipt = {
    receiptNumber: '20260510-001',
    storeName: 'Boulangerie Bella-Dolce',
    storeAddress: 'SIDI-ABDELLAH ALGER',
    items: [
      { name: 'Pain Complet', quantity: 2, unitPrice: 150, lineTotal: 300 },
      { name: 'Croissant', quantity: 3, unitPrice: 80, lineTotal: 240 }
    ],
    totalAmount: 540,
    paymentMethod: 'cash' as const,
    amountPaid: 600,
    change: 60,
    cashierName: 'Fatima',
    dateTime: new Date('2026-05-10T14:30:00'),
    autoCloseDelay: 500,
    saleId: mockSaleId
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    vi.clearAllMocks();
    (apiClient.authFetch as any).mockClear();
  });

  it('should show print status "printing" initially when print API is called', async () => {
    (apiClient.authFetch as any).mockResolvedValue(
      new Response(JSON.stringify({ status: 'queued' }), { status: 200, ok: true })
    );
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    expect(screen.getByText(/Impression en cours|جاري الطباعة/i)).toBeInTheDocument();
  });

  it('should call print API automatically when ReceiptPreview appears', async () => {
    (apiClient.authFetch as any).mockResolvedValue(
      new Response(JSON.stringify({ status: 'queued' }), { status: 200, ok: true })
    );
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(apiClient.authFetch).toHaveBeenCalledWith(
        '/api/print-receipt',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  it('should show print status "done" when API returns success', async () => {
    (apiClient.authFetch as any).mockResolvedValue(
      new Response(JSON.stringify({ status: 'queued' }), { status: 200, ok: true })
    );
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText(/Impression terminée|تمت الطباعة/i)).toBeInTheDocument();
    });
  });

  it('should show print status "error" when API fails', async () => {
    (apiClient.authFetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Print failed' }), { status: 500, ok: false })
    );
    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText(/Erreur d'impression|خطأ في الطباعة/i)).toBeInTheDocument();
    });
  });

  it('should NOT auto-close when print status is "error"', async () => {
    (apiClient.authFetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Print failed' }), { status: 500, ok: false })
    );

    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} autoCloseDelay={10000} />);

    // Wait for error status to appear
    await waitFor(() => {
      expect(screen.getByText(/Erreur d'impression|خطأ في الطباعة/i)).toBeInTheDocument();
    });

    // onClose should NOT be called because status is "error", not "done"
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should auto-close when print status is "done"', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ status: 'queued' })
    };
    (apiClient.authFetch as any).mockResolvedValue(mockResponse);

    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} autoCloseDelay={100} />);

    // Verify done status is shown
    await waitFor(() => {
      expect(screen.getByText(/Impression terminée|تمت الطباعة/i)).toBeInTheDocument();
    });
  });

  it('should allow closing with close button regardless of print status', async () => {
    const mockResponse = {
      ok: false,
      json: async () => ({ error: 'Print failed' })
    };
    (apiClient.authFetch as any).mockResolvedValue(mockResponse);

    renderWithLanguage(<ReceiptPreview {...mockReceipt} onClose={mockOnClose} />);

    // Wait for error status to appear
    await waitFor(() => {
      expect(screen.getByText(/Erreur d'impression|خطأ في الطباعة/i)).toBeInTheDocument();
    });

    // Close button should always be available
    expect(screen.getByRole('button', { name: /close|fermer/i })).toBeInTheDocument();
  });
});
