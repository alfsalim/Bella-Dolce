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
        private readonly string _languageMode;
        private PrintJob? _currentJob;
        private KitchenTicketJob? _currentKitchenJob;

        public string Mode => "printer";

        public ThermalPrintService(string printerName, string? logoPath = null, int paperWidth = 315, int paperHeight = 1200, string languageMode = "BOTH")
        {
            _printerName = printerName;
            _logoPath = logoPath;
            _paperWidth = paperWidth;
            _paperHeight = paperHeight;
            _languageMode = languageMode;
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

        public Task<PrintResult> PrintKitchenTicketAsync(KitchenTicketJob job)
        {
            try
            {
                _currentKitchenJob = job;

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
                doc.PrintPage += OnPrintKitchenTicketPage;
                doc.Print();

                return Task.FromResult(new PrintResult
                {
                    Success = true,
                    Message = $"Kitchen ticket printed on '{_printerName}'"
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

        private void OnPrintKitchenTicketPage(object sender, PrintPageEventArgs e)
        {
            if (_currentKitchenJob == null || e.Graphics == null) return;

            var job = _currentKitchenJob;
            var g = e.Graphics;
            var pageWidth = e.PageBounds.Width - 10;
            var y = 5f;

            var fontDelivery = new Font("Arial", 20, FontStyle.Bold);
            var fontProduct = new Font("Arial", 18, FontStyle.Bold);
            var fontSpecs = new Font("Arial", 16, FontStyle.Regular);
            var fontSmall = new Font("Arial", 10, FontStyle.Regular);

            void DrawCenter(string text, Font font)
            {
                var size = g.MeasureString(text, font, (int)pageWidth);
                g.DrawString(text, font, Brushes.Black, new RectangleF(0, y, pageWidth, size.Height), new StringFormat { Alignment = StringAlignment.Center });
                y += size.Height + 4;
            }

            void DrawLeft(string text, Font font)
            {
                var size = g.MeasureString(text, font, (int)pageWidth);
                g.DrawString(text, font, Brushes.Black, new RectangleF(5, y, pageWidth - 10, size.Height));
                y += size.Height + 2;
            }

            void DrawDash()
            {
                g.DrawString(new string('-', 30), fontSmall, Brushes.Black, 5, y);
                y += fontSmall.GetHeight() + 4;
            }

            DrawDash();
            DrawCenter($"{job.DeliveryDate} {job.DeliveryTime}".Trim(), fontDelivery);
            DrawDash();

            if (!string.IsNullOrEmpty(job.CustomerName))
            {
                DrawLeft(job.CustomerName, fontSpecs);
                DrawDash();
            }

            foreach (var item in job.Items)
            {
                DrawLeft($"{item.Quantity}x {item.Name}", fontProduct);
                if (!string.IsNullOrEmpty(item.SpecificationsText))
                {
                    DrawLeft(item.SpecificationsText, fontSpecs);
                }
                y += 4;
            }
            DrawDash();

            if (!string.IsNullOrEmpty(job.Notes))
            {
                DrawLeft(job.Notes, fontSpecs);
                DrawDash();
            }

            e.HasMorePages = false;

            fontDelivery.Dispose();
            fontProduct.Dispose();
            fontSpecs.Dispose();
            fontSmall.Dispose();
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
            var effectiveLanguageMode = !string.IsNullOrEmpty(job.PrintLanguage) ? job.PrintLanguage : _languageMode;
            var isBilingual = effectiveLanguageMode.Equals("BOTH", StringComparison.OrdinalIgnoreCase);
            var isFrenchOnly = effectiveLanguageMode.Equals("FR", StringComparison.OrdinalIgnoreCase);
            var isArabicOnly = effectiveLanguageMode.Equals("AR", StringComparison.OrdinalIgnoreCase);

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

            void DrawBilingual(string leftFR, string rightFR, string leftAR, string rightAR, Font font)
            {
                if (isFrenchOnly)
                {
                    DrawLeftRight(leftFR, rightFR, font);
                    return;
                }

                if (isArabicOnly)
                {
                    DrawLeftRight(leftAR, rightAR, font);
                    return;
                }

                // For bilingual: FR label on left, amount+currency in middle, AR label on right - ALL ON ONE LINE
                var thirdWidth = pageWidth / 3;
                g.DrawString(leftFR, font, Brushes.Black, 5, y);

                var amountWithCurrency = $"{rightFR} {labels.Currency} / {labels.Currency_AR}";
                var amountSize = g.MeasureString(amountWithCurrency, font);
                g.DrawString(amountWithCurrency, font, Brushes.Black, (pageWidth / 2) - (amountSize.Width / 2), y);

                var arSize = g.MeasureString(leftAR, font);
                g.DrawString(leftAR, font, Brushes.Black, pageWidth - arSize.Width - 5, y);

                y += font.GetHeight() + 2;
            }

            void DrawDash()
            {
                g.DrawString(new string('-', isBilingual ? 20 : 40), fontSmall, Brushes.Black, 5, y);
                y += lineHeight;
            }

            // === HEADER ===
            if (!string.IsNullOrEmpty(_logoPath) && File.Exists(_logoPath))
            {
                using var logo = Image.FromFile(_logoPath);
                var logoWidth = Math.Min(isBilingual ? 75 : 150, pageWidth);
                var logoHeight = (int)(logo.Height * ((float)logoWidth / logo.Width));
                var logoX = (pageWidth - logoWidth) / 2;
                g.DrawImage(logo, (int)logoX, (int)y, (int)logoWidth, logoHeight);
                y += logoHeight + 5;
            }
            y += 5;
            DrawDash();

            // === RECEIPT INFO ===
            DrawBilingual(
                $"{labels.ReceiptLabel}:", job.ReceiptNumber ?? "N/A",
                $"{labels.ReceiptLabel_AR}:", job.ReceiptNumber ?? "N/A",
                fontNormal);
            DrawBilingual(
                $"{labels.DateLabel}:", job.Date ?? DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                $"{labels.DateLabel_AR}:", job.Date ?? DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                fontNormal);
            DrawBilingual(
                $"{labels.CashierLabel}:", job.CashierName ?? "N/A",
                $"{labels.CashierLabel_AR}:", job.CashierName ?? "N/A",
                fontNormal);
            DrawDash();

            // === ITEMS ===
            if (job.Items != null)
            {
                foreach (var item in job.Items)
                {
                    var qty = $"{item.Quantity}x {item.Name}";
                    var price = $"{item.LineTotal:N2} {labels.Currency}";
                    DrawBilingual(qty, price, qty, price, fontNormal);

                    if (item.UnitPrice > 0)
                    {
                        g.DrawString($"@ {item.UnitPrice:N2} {labels.Currency}", fontSmall, Brushes.Black, 10, y);
                        y += fontSmall.GetHeight() + 1;
                    }
                }
            }
            DrawDash();

            // === COUNTS ===
            DrawBilingual(
                $"{labels.ProductCountLabel}:", $"{job.ProductCount}",
                $"{labels.ProductCountLabel_AR}:", $"{job.ProductCount}",
                fontNormal);
            DrawBilingual(
                $"{labels.UnitCountLabel}:", $"{job.UnitCount}",
                $"{labels.UnitCountLabel_AR}:", $"{job.UnitCount}",
                fontNormal);
            DrawDash();

            // === TOTALS ===
            DrawBilingual(
                $"{labels.TotalLabel}:", $"{job.Total:N2} {labels.Currency}",
                $"{labels.TotalLabel_AR}:", $"{job.Total:N2} {labels.Currency}",
                fontBold);
            if (job.AmountPaid > 0)
                DrawBilingual(
                    $"{labels.PaidLabel}:", $"{job.AmountPaid:N2} {labels.Currency}",
                    $"{labels.PaidLabel_AR}:", $"{job.AmountPaid:N2} {labels.Currency}",
                    fontNormal);
            if (job.ChangeGiven > 0)
                DrawBilingual(
                    $"{labels.ChangeLabel}:", $"{job.ChangeGiven:N2} {labels.Currency}",
                    $"{labels.ChangeLabel_AR}:", $"{job.ChangeGiven:N2} {labels.Currency}",
                    fontNormal);

            DrawBilingual(
                $"{labels.PaymentLabel}:", job.PaymentMethod ?? "CASH",
                $"{labels.PaymentLabel_AR}:", job.PaymentMethod ?? "CASH",
                fontNormal);
            DrawDash();

            // === COMMENT (discount, free, reprint, etc.) ===
            if (isBilingual && (!string.IsNullOrEmpty(job.CommentFR) || !string.IsNullOrEmpty(job.CommentAR)))
            {
                DrawBilingual(job.CommentFR, "", job.CommentAR, "", fontBold);
                DrawDash();
            }
            else if (isFrenchOnly && !string.IsNullOrEmpty(job.CommentFR))
            {
                DrawCenter(job.CommentFR, fontBold);
                DrawDash();
            }
            else if (isArabicOnly && !string.IsNullOrEmpty(job.CommentAR))
            {
                DrawCenter(job.CommentAR, fontBold);
                DrawDash();
            }
            else if (!string.IsNullOrEmpty(job.Comment))
            {
                DrawCenter(job.Comment, fontBold);
                DrawDash();
            }

            // === FOOTER ===
            y += 5;
            if (isBilingual)
            {
                var thankYouSize = g.MeasureString(labels.ThankYou, fontNormal);
                g.DrawString(labels.ThankYou, fontNormal, Brushes.Black, (pageWidth / 4) - (thankYouSize.Width / 2), y);
                var thankYouARSize = g.MeasureString(labels.ThankYou_AR, fontNormal);
                g.DrawString(labels.ThankYou_AR, fontNormal, Brushes.Black, (pageWidth * 3 / 4) - (thankYouARSize.Width / 2), y);
                y += fontNormal.GetHeight() + 2;
            }
            else if (isFrenchOnly)
            {
                DrawCenter(labels.ThankYou, fontNormal);
            }
            else if (isArabicOnly)
            {
                DrawCenter(labels.ThankYou_AR, fontNormal);
            }

            if (isBilingual)
            {
                var comeBackSize = g.MeasureString(labels.ComeBack, fontNormal);
                g.DrawString(labels.ComeBack, fontNormal, Brushes.Black, (pageWidth / 4) - (comeBackSize.Width / 2), y);
                var comeBackARSize = g.MeasureString(labels.ComeBack_AR, fontNormal);
                g.DrawString(labels.ComeBack_AR, fontNormal, Brushes.Black, (pageWidth * 3 / 4) - (comeBackARSize.Width / 2), y);
            }
            else if (isFrenchOnly)
            {
                DrawCenter(labels.ComeBack, fontNormal);
            }
            else if (isArabicOnly)
            {
                DrawCenter(labels.ComeBack_AR, fontNormal);
            }

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