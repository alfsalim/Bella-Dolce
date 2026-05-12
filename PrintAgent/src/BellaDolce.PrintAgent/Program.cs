using BellaDolce.PrintAgent.Services;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("./logs/print-agent-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    Log.Information("Starting BellaDolce Print Agent...");

    var builder = WebApplication.CreateBuilder(args);

    // Add Serilog
    builder.Host.UseSerilog();

    // Windows Service support
    builder.Host.UseWindowsService();

    // Configure Kestrel to listen on configured port
    var port = builder.Configuration.GetValue<int>("PrintAgent:Port", 5555);
    builder.WebHost.UseUrls($"http://localhost:{port}");

    // Register print service based on mode
    var mode = builder.Configuration.GetValue<string>("PrintAgent:Mode", "emulator");

    if (mode?.Equals("thermal", StringComparison.OrdinalIgnoreCase) == true)
    {
        builder.Services.AddSingleton<IPrintService, ThermalPrintService>();
        Log.Information("Print mode: THERMAL (real printer)");
    }
    else
    {
        builder.Services.AddSingleton<IPrintService, EmulatorPrintService>();
        Log.Information("Print mode: EMULATOR (console + file output)");
    }

    // Add controllers
    builder.Services.AddControllers();

    // Add CORS for local POS app
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins(
                    "http://localhost:3500",
                    "http://localhost:5173",
                    "http://localhost:3000"
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
    });

    var app = builder.Build();

    app.UseCors();
    app.MapControllers();

    Log.Information("BellaDolce Print Agent running on http://localhost:{Port} in {Mode} mode", port, mode);

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