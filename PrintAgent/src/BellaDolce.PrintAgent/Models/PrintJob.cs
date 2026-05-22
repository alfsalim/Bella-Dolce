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
    public int ProductCount { get; set; }
    public int UnitCount { get; set; }
    public ReceiptLabels Labels { get; set; } = new();
}

public class ReceiptLabels
{
    // French labels
    public string StoreName { get; set; } = string.Empty;
    public string StoreSlogan { get; set; } = string.Empty;
    public string ReceiptLabel { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
    public string CashierLabel { get; set; } = string.Empty;
    public string TotalLabel { get; set; } = string.Empty;
    public string SubtotalLabel { get; set; } = string.Empty;
    public string TaxLabel { get; set; } = string.Empty;
    public string PaymentLabel { get; set; } = string.Empty;
    public string PaidLabel { get; set; } = string.Empty;
    public string ChangeLabel { get; set; } = string.Empty;
    public string ThankYou { get; set; } = string.Empty;
    public string ComeBack { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public string ProductCountLabel { get; set; } = string.Empty;
    public string UnitCountLabel { get; set; } = string.Empty;

    // Arabic labels (for bilingual printing)
    public string StoreName_AR { get; set; } = string.Empty;
    public string StoreSlogan_AR { get; set; } = string.Empty;
    public string ReceiptLabel_AR { get; set; } = string.Empty;
    public string DateLabel_AR { get; set; } = string.Empty;
    public string CashierLabel_AR { get; set; } = string.Empty;
    public string TotalLabel_AR { get; set; } = string.Empty;
    public string SubtotalLabel_AR { get; set; } = string.Empty;
    public string TaxLabel_AR { get; set; } = string.Empty;
    public string PaymentLabel_AR { get; set; } = string.Empty;
    public string PaidLabel_AR { get; set; } = string.Empty;
    public string ChangeLabel_AR { get; set; } = string.Empty;
    public string ThankYou_AR { get; set; } = string.Empty;
    public string ComeBack_AR { get; set; } = string.Empty;
    public string ProductCountLabel_AR { get; set; } = string.Empty;
    public string UnitCountLabel_AR { get; set; } = string.Empty;
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