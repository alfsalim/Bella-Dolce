using BellaDolce.PrintAgent.Services;
using BellaDolce.PrintAgent.Models;
using Serilog;
using Serilog.Events;

var tempConfig = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json")
    .Build();

var fileLogLevelStr = tempConfig["PrintAgent:FileLogLevel"] ?? "Error";
var fileLogLevel = Enum.Parse<LogEventLevel>(fileLogLevelStr, ignoreCase: true);

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("./logs/print-agent-.log",
        rollingInterval: RollingInterval.Day,
        fileSizeLimitBytes: 10_485_760, // 10 MB
        retainedFileCountLimit: 7,
        restrictedToMinimumLevel: fileLogLevel)
    .CreateLogger();

try
{
    Log.Information("Starting BellaDolce Print Agent...");

    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog();
    builder.Host.UseWindowsService();

    var config = builder.Configuration.GetSection("PrintAgent");
    var mode = config.GetValue<string>("Mode");
    var languageMode = config.GetValue<string>("LanguageMode") ?? "BOTH";
    var printerName = config.GetValue<string>("PrinterName");
    var logoPath = config.GetValue<string>("LogoPath");
    var allowedOrigins = config.GetSection("AllowedOrigins").Get<string[]>();
    var defaultLabels = config.GetSection("Labels").Get<ReceiptLabels>() ?? new ReceiptLabels();
    builder.Services.AddSingleton(defaultLabels);

    if (mode?.Equals("thermal", StringComparison.OrdinalIgnoreCase) == true)
        {
            var paperWidthMM = config.GetValue<int>("PaperWidth");
            var paperHeightMM = config.GetValue<int>("PaperHeight");
            var paperWidth = (int)(paperWidthMM * 3.937);
            var paperHeight = (int)(paperHeightMM * 3.937);
            builder.Services.AddSingleton<IPrintService>(new ThermalPrintService(printerName!, logoPath, paperWidth, paperHeight, languageMode));
            Log.Information("Print mode: THERMAL ({PrinterName}, {PaperWidth}mm, Language: {LanguageMode})", printerName, paperWidthMM, languageMode);
        }
        else
        {
            builder.Services.AddSingleton<IPrintService, EmulatorPrintService>();
            Log.Information("Print mode: EMULATOR");
        }
    builder.Services.AddControllers();

    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins(allowedOrigins ?? Array.Empty<string>())
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
    });

    var app = builder.Build();

    app.UseCors();
    app.MapControllers();

    Log.Information("BellaDolce Print Agent running in {Mode} mode", mode);

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Print Agent terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}