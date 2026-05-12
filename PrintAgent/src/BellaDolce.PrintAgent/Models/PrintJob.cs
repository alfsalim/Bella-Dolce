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
}

public class PrintJobItem
{
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
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
