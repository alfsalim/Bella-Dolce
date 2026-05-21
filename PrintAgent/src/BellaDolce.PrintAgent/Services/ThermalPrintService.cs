using BellaDolce.PrintAgent.Models;
using System.Drawing;
using System.Drawing.Printing;
using System.Text;

namespace BellaDolce.PrintAgent.Services
{
    public class ThermalPrintService : IPrintService
    {
        
        private readonly string _printerName;
        private readonly string? _logoPath;
        private readonly int _paperWidth;
        private readonly int _paperHeight;
        private PrintJob? _currentJob;

        public string Mode => "printer";
        
        public ThermalPrintService(string printerName, string? logoPath = null, int paperWidth = 315, int paperHeight = 1200)
        {
            _printerName = printerName;
            _logoPath = logoPath;
            _paperWidth = paperWidth;
            _paperHeight = paperHeight;
        }

        public Task<PrintResult> PrintAsync(PrintJob job)
        {
            try
            {
                _currentJob = job;

                var doc = new PrintDocument();
                doc.PrinterSettings.PrinterName = _printerName;

                if (!doc.PrinterSettings.IsValid)
                {
                    return Task.FromResult(new PrintResult
                    {
                        Success = false,
                        Message = $"Printer '{_printerName}' not found. Available: {GetAvailablePrinters()}"
                    });
                }

                doc.DefaultPageSettings.PaperSize = new PaperSize("Receipt", _paperWidth, _paperHeight);
                doc.DefaultPageSettings.Margins = new Margins(5, 5, 5, 5);
                doc.PrintPage += OnPrintPage;
                doc.Print();

                return Task.FromResult(new PrintResult
                {
                    Success = true,
                    Message = $"Printed on '{_printerName}'"
                });
            }
            catch (Exception ex)
            {
                return Task.FromResult(new PrintResult
                {
                    Success = false,
                    Message = $"Print error: {ex.Message}"
                });
            }
        }

        private void OnPrintPage(object sender, PrintPageEventArgs e)
        {
            if (_currentJob == null || e.Graphics == null) return;

            var job = _currentJob;
            var labels = job.Labels;
            var g = e.Graphics;
            var pageWidth = e.PageBounds.Width - 10;
            var y = 5f;
            var lineHeight = 14f;

            var fontTitle = new Font("Arial", 12, FontStyle.Bold);
            var fontNormal = new Font("Arial", 9, FontStyle.Regular);
            var fontBold = new Font("Arial", 9, FontStyle.Bold);
            var fontSmall = new Font("Arial", 7, FontStyle.Regular);

            void DrawCenter(string text, Font font)
            {
                var size = g.MeasureString(text, font);
                var x = (pageWidth - size.Width) / 2;
                g.DrawString(text, font, Brushes.Black, x, y);
                y += size.Height + 2;
            }

            void DrawLeftRight(string left, string right, Font font)
            {
                g.DrawString(left, font, Brushes.Black, 5, y);
                var rightSize = g.MeasureString(right, font);
                g.DrawString(right, font, Brushes.Black, pageWidth - rightSize.Width, y);
                y += font.GetHeight() + 2;
            }

            void DrawDash()
            {
                g.DrawString(new string('-', 40), fontSmall, Brushes.Black, 5, y);
                y += lineHeight;
            }

            // === HEADER ===
             // === LOGO ===
            if (!string.IsNullOrEmpty(_logoPath) && File.Exists(_logoPath))
            {
                using var logo = Image.FromFile(_logoPath);
                var logoWidth = Math.Min(150, pageWidth);
                var logoHeight = (int)(logo.Height * ((float)logoWidth / logo.Width));
                var logoX = (pageWidth - logoWidth) / 2;
                g.DrawImage(logo, (int)logoX, (int)y, (int)logoWidth, logoHeight);
                y += logoHeight + 5;
            }
            DrawCenter(labels.StoreName, fontTitle);
            DrawCenter(labels.StoreSlogan, fontNormal);
            y += 5;
            DrawDash();

            // === RECEIPT INFO ===
            DrawLeftRight($"{labels.ReceiptLabel}:", job.ReceiptNumber ?? "N/A", fontNormal);
            DrawLeftRight($"{labels.DateLabel}:", job.Date ?? DateTime.Now.ToString("dd/MM/yyyy HH:mm"), fontNormal);
            DrawLeftRight($"{labels.CashierLabel}:", job.CashierName ?? "N/A", fontNormal);
            DrawDash();

            // === ITEMS ===
            if (job.Items != null)
            {
                foreach (var item in job.Items)
                {
                    var qty = $"{item.Quantity}x {item.Name}";
                    var price = $"{item.LineTotal:N2} {labels.Currency}";
                    DrawLeftRight(qty, price, fontNormal);

                    if (item.UnitPrice > 0)
                    {
                        g.DrawString($"   @ {item.UnitPrice:N2} {labels.Currency}", fontSmall, Brushes.Black, 10, y);
                        y += fontSmall.GetHeight() + 1;
                    }
                }
            }
            DrawDash();

            // === TOTALS ===
            DrawLeftRight($"{labels.TotalLabel}:", $"{job.Total:N2} {labels.Currency}", fontBold);
            DrawLeftRight($"{labels.PaidLabel}:", $"{job.AmountPaid:N2} {labels.Currency}", fontNormal);

            var change = job.AmountPaid - job.Total;
            if (change > 0)
            {
                DrawLeftRight($"{labels.ChangeLabel}:", $"{change:N2} {labels.Currency}", fontNormal);
            }

            DrawLeftRight($"{labels.PaymentLabel}:", job.PaymentMethod ?? "CASH", fontNormal);
            DrawDash();

            // === FOOTER ===
            y += 5;
            DrawCenter(labels.ThankYou, fontNormal);
            DrawCenter(labels.ComeBack, fontNormal);
            y += 10;

            e.HasMorePages = false;

            fontTitle.Dispose();
            fontNormal.Dispose();
            fontBold.Dispose();
            fontSmall.Dispose();
        }

        private string GetAvailablePrinters()
        {
            var sb = new StringBuilder();
            foreach (string printer in PrinterSettings.InstalledPrinters)
            {
                if (sb.Length > 0) sb.Append(", ");
                sb.Append(printer);
            }
            return sb.Length > 0 ? sb.ToString() : "none found";
        }
    }
}