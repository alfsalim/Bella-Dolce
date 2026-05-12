using BellaDolce.PrintAgent.Models;
using BellaDolce.PrintAgent.Services;
using Microsoft.AspNetCore.Mvc;

namespace BellaDolce.PrintAgent.Controllers
{
    [ApiController]
    public class PrintController : ControllerBase
    {
        private readonly IPrintService _printService;
        private readonly ILogger<PrintController> _logger;

        public PrintController(IPrintService printService, ILogger<PrintController> logger)
        {
            _printService = printService;
            _logger = logger;
        }

        // GET /health
        [HttpGet("/health")]
        public IActionResult Health()
        {
            return Ok(new
            {
                status = "ok",
                mode = _printService.Mode,
                timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                version = "1.0.0"
            });
        }

        // POST /print
        [HttpPost("/print")]
        public async Task<IActionResult> Print([FromBody] PrintJob job)
        {
            if (job == null)
            {
                _logger.LogWarning("Print request with null body");
                return BadRequest(new { status = "error", message = "Request body is required" });
            }

            if (string.IsNullOrEmpty(job.SaleId))
            {
                _logger.LogWarning("Print request without saleId");
                return BadRequest(new { status = "error", message = "saleId is required" });
            }

            _logger.LogInformation(
                "Print job received: SaleId={SaleId}, Receipt={Receipt}, Items={Items}, Total={Total}, Mode={Mode}",
                job.SaleId,
                job.ReceiptNumber ?? "N/A",
                job.Items?.Count ?? 0,
                job.Total,
                _printService.Mode
            );

            var result = await _printService.PrintAsync(job);

            if (result.Success)
            {
                _logger.LogInformation("Print job completed: {Message}", result.Message);

                var response = new Dictionary<string, object>
                {
                    { "status", "printed" },
                    { "message", result.Message },
                    { "saleId", job.SaleId }
                };

                if (!string.IsNullOrEmpty(result.OutputFile))
                {
                    response.Add("outputFile", result.OutputFile);
                }

                return Ok(response);
            }
            else
            {
                _logger.LogError("Print job failed: {Message}", result.Message);
                return StatusCode(500, new
                {
                    status = "error",
                    message = result.Message,
                    saleId = job.SaleId
                });
            }
        }

        // GET /printers (list available printers — useful for config)
        [HttpGet("/printers")]
        public IActionResult ListPrinters()
        {
            var printers = new List<string>();

            foreach (string printer in System.Drawing.Printing.PrinterSettings.InstalledPrinters)
            {
                printers.Add(printer);
            }

            return Ok(new
            {
                mode = _printService.Mode,
                printers = printers,
                count = printers.Count
            });
        }
    }
}