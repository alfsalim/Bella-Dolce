namespace BellaDolce.PrintAgent.Models;

public class PrintJob
{
    public string SaleId { get; set; } = string.Empty;
    public string ReceiptNumber { get; set; } = string.Empty;
    public string CashierName { get; set; } = string.Empty;
    public DateTime SaleDate { get; set; } = DateTime.Now;
    public List<PrintJobItem> Items { get; set; } = new();
    public decimal Total { get; set; }
    public string PaymentMethod { get; set; } = "cash";
    public decimal AmountPaid { get; set; }
    public decimal ChangeGiven { get; set; }
    public string? CustomerName { get; set; }
    public string Time { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public ReceiptLabels Labels { get; set; } = new();
}

public class ReceiptLabels
{
    public string StoreName { get; set; } = "Bella Dolce";
    public string StoreSlogan { get; set; } = "Artisanal Atelier de Pâtisserie";
    public string ReceiptLabel { get; set; } = "Reçu #";
    public string DateLabel { get; set; } = "Date";
    public string CashierLabel { get; set; } = "Caissier";
    public string TotalLabel { get; set; } = "TOTAL";
    public string SubtotalLabel { get; set; } = "Sous-total";
    public string TaxLabel { get; set; } = "TVA";
    public string PaymentLabel { get; set; } = "Paiement";
    public string PaidLabel { get; set; } = "Payé";
    public string ChangeLabel { get; set; } = "Monnaie";
    public string ThankYou { get; set; } = "Merci pour votre visite!";
    public string ComeBack { get; set; } = "À bientôt!";
    public string Currency { get; set; } = "DA";
    public string ChangeLabel { get; set; } = "Monnaie";
}

public class PrintJobItem
{
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}

public class PrintResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? OutputFile { get; set; }
}

public class PrintResponse
{
    public string Status { get; set; } = "queued";
    public string? Message { get; set; }
    public string? JobId { get; set; }
}

public class HealthResponse
{
    public string Status { get; set; } = "ok";
    public string Mode { get; set; } = "emulator";
    public string PrinterName { get; set; } = string.Empty;
    public bool PrinterReady { get; set; }
    public DateTime ServerTime { get; set; } = DateTime.Now;
    public string Version { get; set; } = "1.0.0";
}