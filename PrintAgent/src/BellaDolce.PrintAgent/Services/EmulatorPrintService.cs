using BellaDolce.PrintAgent.Models;

namespace BellaDolce.PrintAgent.Services
{
    public class EmulatorPrintService : IPrintService
    {
        private readonly string _outputFolder;

        public string Mode => "emulator";

        public EmulatorPrintService()
        {
            _outputFolder = Path.Combine(AppContext.BaseDirectory, "output");
            if (!Directory.Exists(_outputFolder))
            {
                Directory.CreateDirectory(_outputFolder);
            }
        }

        public EmulatorPrintService(string outputFolder)
        {
            _outputFolder = outputFolder;
        }

        public async Task<PrintResult> PrintAsync(PrintJob job)
        {
            try
            {
                var receipt = BuildReceiptText(job);

                Console.WriteLine();
                Console.WriteLine("╔══════════════════════════════════════╗");
                Console.WriteLine("║ 📄 PRINT JOB RECEIVED               ║");
                Console.WriteLine("╠══════════════════════════════════════╣");
                Console.WriteLine(receipt);
                Console.WriteLine("╚══════════════════════════════════════╝");
                Console.WriteLine();

                var fileName = $"receipt_{job.SaleId}_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
                var filePath = Path.Combine(_outputFolder, fileName);
                await File.WriteAllTextAsync(filePath, receipt);

                Console.WriteLine($"✅ Receipt saved to: {filePath}");
                Console.WriteLine();

                return new PrintResult
                {
                    Success = true,
                    Message = $"Emulator: receipt saved to {fileName}",
                    OutputFile = filePath
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Emulator error: {ex.Message}");

                return new PrintResult
                {
                    Success = false,
                    Message = $"Emulator error: {ex.Message}"
                };
            }
        }

        private string BuildReceiptText(PrintJob job)
        {
            var width = 40;
            var line = new string('─', width);
            var doubleLine = new string('═', width);
            var lines = new List<string>();
            var labels = job.Labels;

            // Header
            lines.Add(CenterText(labels.StoreName, width));
            lines.Add(CenterText(labels.StoreSlogan, width));
            lines.Add(doubleLine);

            // Receipt info
            lines.Add($"{labels.ReceiptLabel}: {job.ReceiptNumber ?? "N/A"}");
            lines.Add($"{labels.DateLabel}: {DateTime.Now:dd/MM/yyyy HH:mm:ss}");
            lines.Add($"{labels.CashierLabel}: {job.CashierName ?? "N/A"}");
            lines.Add(line);

            // Items
            if (job.Items != null && job.Items.Count > 0)
            {
                foreach (var item in job.Items)
                {
                    var itemName = item.Name ?? "---";
                    var qty = item.Quantity;
                    var unitPrice = item.UnitPrice;
                    var lineTotal = item.LineTotal > 0 ? item.LineTotal : qty * unitPrice;

                    lines.Add($"{qty}x {itemName}");
                    lines.Add(RightAlign($"{unitPrice:N2} x {qty} = {lineTotal:N2} {labels.Currency}", width));
                }
            }

            lines.Add(line);

            // Totals
            lines.Add(RightAlign($"{labels.TotalLabel}: {job.Total:N2} {labels.Currency}", width));
            lines.Add($"{labels.PaymentLabel}: {job.PaymentMethod ?? "N/A"}");
            lines.Add($"{labels.PaidLabel}: {job.AmountPaid:N2} {labels.Currency}");

            if (job.AmountPaid > job.Total)
            {
                var change = job.AmountPaid - job.Total;
                lines.Add($"{labels.ChangeLabel}: {change:N2} {labels.Currency}");
            }

            if (!string.IsNullOrEmpty(job.Comment))
            {
                lines.Add(line);
                lines.Add(CenterText(job.Comment, width));
            }

            lines.Add(doubleLine);

            // Footer
            lines.Add(CenterText(labels.ThankYou, width));
            lines.Add(CenterText(labels.ComeBack, width));

            return string.Join(Environment.NewLine, lines);
        }

        private string CenterText(string text, int width)
        {
            if (text.Length >= width) return text;
            var padding = (width - text.Length) / 2;
            return text.PadLeft(padding + text.Length).PadRight(width);
        }

        private string RightAlign(string text, int width)
        {
            if (text.Length >= width) return text;
            return text.PadLeft(width);
        }
    }
}