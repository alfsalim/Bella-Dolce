using BellaDolce.PrintAgent.Models;

namespace BellaDolce.PrintAgent.Services
{
    public interface IPrintService
    {
        Task<PrintResult> PrintAsync(PrintJob job);
        Task<PrintResult> PrintKitchenTicketAsync(KitchenTicketJob job);
        string Mode { get; }
    }

    public class PrintResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? OutputFile { get; set; }
    }
}