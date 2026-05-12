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
                // Build receipt text
                var receipt = BuildReceiptText(job);

                // Print to console
                Console.WriteLine();
                Console.WriteLine("╔══════════════════════════════════════╗");
                Console.WriteLine("║     📄 PRINT JOB RECEIVED          ║");
                Console.WriteLine("╠══════════════════════════════════════╣");
                Console.WriteLine(receipt);
                Console.WriteLine("╚══════════════════════════════════════╝");
                Console.WriteLine();

                // Save to file
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

            // Header
            lines.Add(CenterText("BELLA DOLCE", width));
            lines.Add(CenterText("Artisanal Atelier de Pâtisserie", width));
            lines.Add(doubleLine);

            // Receipt info
            lines.Add($"Reçu #: {job.ReceiptNumber ?? "N/A"}");
            lines.Add($"Date: {DateTime.Now:dd/MM/yyyy HH:mm:ss}");
            lines.Add($"Caissier: {job.CashierName ?? "N/A"}");
            lines.Add(line);

            // Items
            if (job.Items != null && job.Items.Count > 0)
            {
                foreach (var item in job.Items)
                {
                    var itemName = item.Name ?? "Article";
                    var qty = item.Quantity;
                    var unitPrice = item.UnitPrice;
                    var lineTotal = item.LineTotal > 0 ? item.LineTotal : qty * unitPrice;

                    lines.Add($"{qty}x {itemName}");
                    lines.Add(RightAlign($"{unitPrice:N2} x {qty} = {lineTotal:N2} DA", width));
                }
            }

            lines.Add(line);

            // Totals
            lines.Add(RightAlign($"TOTAL: {job.Total:N2} DA", width));
            lines.Add($"Paiement: {job.PaymentMethod ?? "N/A"}");
            lines.Add($"Payé: {job.AmountPaid:N2} DA");

            if (job.AmountPaid > job.Total)
            {
                var change = job.AmountPaid - job.Total;
                lines.Add($"Monnaie: {change:N2} DA");
            }

            lines.Add(doubleLine);

            // Footer
            lines.Add(CenterText("Merci pour votre visite!", width));
            lines.Add(CenterText("À bientôt!", width));

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