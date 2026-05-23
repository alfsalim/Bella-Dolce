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
            var effectiveLanguageMode = !string.IsNullOrEmpty(job.PrintLanguage) ? job.PrintLanguage : "BOTH";
            var isBilingual = effectiveLanguageMode.Equals("BOTH", StringComparison.OrdinalIgnoreCase);
            var isFrenchOnly = effectiveLanguageMode.Equals("FR", StringComparison.OrdinalIgnoreCase);
            var isArabicOnly = effectiveLanguageMode.Equals("AR", StringComparison.OrdinalIgnoreCase);
            var width = isBilingual ? 80 : 40;
            var halfWidth = width / 2;
            var dash = new string('-', isBilingual ? 20 : 40);
            var doubleDash = new string('═', width);
            var lines = new List<string>();
            var labels = job.Labels;

            void AddDash() => lines.Add(dash);

            void AddBilingual(string leftFR, string rightFR, string leftAR, string rightAR)
            {
                if (isFrenchOnly)
                {
                    lines.Add(LeftRight(leftFR, rightFR, halfWidth));
                    return;
                }
                if (isArabicOnly)
                {
                    lines.Add(LeftRight(leftAR, rightAR, halfWidth));
                    return;
                }
                var frCol = LeftRight(leftFR, rightFR, halfWidth);
                var arCol = LeftRight(leftAR, rightAR, halfWidth);
                lines.Add(frCol + arCol);
            }

            // === HEADER ===
            AddDash();

            // === RECEIPT INFO ===
            AddBilingual($"{labels.ReceiptLabel}:", job.ReceiptNumber ?? "N/A",
                         $"{labels.ReceiptLabel_AR}:", job.ReceiptNumber ?? "N/A");
            AddBilingual($"{labels.DateLabel}:", job.Date ?? DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                         $"{labels.DateLabel_AR}:", job.Date ?? DateTime.Now.ToString("dd/MM/yyyy HH:mm"));
            AddBilingual($"{labels.CashierLabel}:", job.CashierName ?? "N/A",
                         $"{labels.CashierLabel_AR}:", job.CashierName ?? "N/A");
            AddDash();

            // === ITEMS ===
            if (job.Items != null)
            {
                foreach (var item in job.Items)
                {
                    var qty = $"{item.Quantity}x {item.Name}";
                    var price = $"{item.LineTotal:N2} {labels.Currency}";
                    AddBilingual(qty, price, qty, price);
                    lines.Add($"  @ {item.UnitPrice:N2} {labels.Currency}");
                }
            }
            AddDash();

            // === COUNTS ===
            AddBilingual($"{labels.ProductCountLabel}:", $"{job.ProductCount}",
                         $"{labels.ProductCountLabel_AR}:", $"{job.ProductCount}");
            AddBilingual($"{labels.UnitCountLabel}:", $"{job.UnitCount}",
                         $"{labels.UnitCountLabel_AR}:", $"{job.UnitCount}");
            AddDash();

            // === TOTALS ===
            AddBilingual($"{labels.TotalLabel}:", $"{job.Total:N2} {labels.Currency}",
                         $"{labels.TotalLabel_AR}:", $"{job.Total:N2} {labels.Currency}");
            if (job.AmountPaid > 0)
                AddBilingual($"{labels.PaidLabel}:", $"{job.AmountPaid:N2} {labels.Currency}",
                             $"{labels.PaidLabel_AR}:", $"{job.AmountPaid:N2} {labels.Currency}");
            if (job.ChangeGiven > 0)
                AddBilingual($"{labels.ChangeLabel}:", $"{job.ChangeGiven:N2} {labels.Currency}",
                             $"{labels.ChangeLabel_AR}:", $"{job.ChangeGiven:N2} {labels.Currency}");
            AddBilingual($"{labels.PaymentLabel}:", job.PaymentMethod ?? "CASH",
                         $"{labels.PaymentLabel_AR}:", job.PaymentMethod ?? "CASH");
            AddDash();

            // === COMMENT (discount, free, etc.) ===
            if (isBilingual && (!string.IsNullOrEmpty(job.CommentFR) || !string.IsNullOrEmpty(job.CommentAR)))
            {
                AddBilingual(job.CommentFR, "", job.CommentAR, "");
                AddDash();
            }
            else if (isFrenchOnly && !string.IsNullOrEmpty(job.CommentFR))
            {
                lines.Add(CenterText(job.CommentFR, width));
                AddDash();
            }
            else if (isArabicOnly && !string.IsNullOrEmpty(job.CommentAR))
            {
                lines.Add(CenterText(job.CommentAR, width));
                AddDash();
            }
            else if (!string.IsNullOrEmpty(job.Comment))
            {
                lines.Add(CenterText(job.Comment, width));
                AddDash();
            }

            // === FOOTER ===
            lines.Add(doubleDash);
            if (isBilingual)
            {
                var frCol = CenterText(labels.ThankYou, halfWidth);
                var arCol = CenterText(labels.ThankYou_AR, halfWidth);
                lines.Add(frCol + arCol);
                var frCol2 = CenterText(labels.ComeBack, halfWidth);
                var arCol2 = CenterText(labels.ComeBack_AR, halfWidth);
                lines.Add(frCol2 + arCol2);
            }
            else if (isFrenchOnly)
            {
                lines.Add(CenterText(labels.ThankYou, width));
                lines.Add(CenterText(labels.ComeBack, width));
            }
            else if (isArabicOnly)
            {
                lines.Add(CenterText(labels.ThankYou_AR, width));
                lines.Add(CenterText(labels.ComeBack_AR, width));
            }

            return string.Join(Environment.NewLine, lines);
        }

        private string CenterText(string text, int width)
        {
            if (string.IsNullOrEmpty(text)) return new string(' ', width);
            if (text.Length >= width) return text;
            var padding = (width - text.Length) / 2;
            return text.PadLeft(padding + text.Length).PadRight(width);
        }

        private string LeftRight(string left, string right, int width)
        {
            var combined = $"{left} {right}";
            if (combined.Length >= width) return combined.PadRight(width);
            return left + right.PadLeft(width - left.Length);
        }
    }
}