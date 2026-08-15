using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.Infrastructure.Services;

public sealed class AdminDashboardExportService
    : IAdminDashboardExportService
{
    public byte[] ExportToExcel(
        AdminDashboardResponse dashboard)
    {
        ArgumentNullException.ThrowIfNull(
            dashboard);

        using var workbook =
            new XLWorkbook();

        var worksheet =
            workbook.Worksheets.Add(
                "Dashboard");

        worksheet.Cell(1, 1).Value =
            "Task Management - Admin Dashboard";

        worksheet.Range(
                1,
                1,
                1,
                3)
            .Merge();

        worksheet.Range(
                1,
                1,
                1,
                3)
            .Style.Font.Bold =
            true;

        worksheet.Range(
                1,
                1,
                1,
                3)
            .Style.Font.FontSize =
            16;

        worksheet.Range(
                1,
                1,
                1,
                3)
            .Style.Alignment.Horizontal =
            XLAlignmentHorizontalValues.Center;

        worksheet.Cell(2, 1).Value =
            "Generated At (UTC)";

        worksheet.Cell(2, 2).Value =
            DateTime.UtcNow;

        worksheet.Cell(2, 2)
            .Style.DateFormat.Format =
            "yyyy-MM-dd HH:mm:ss";

        worksheet.Cell(4, 1).Value =
            "Category";

        worksheet.Cell(4, 2).Value =
            "Metric";

        worksheet.Cell(4, 3).Value =
            "Value";

        var headerRange =
            worksheet.Range(
                4,
                1,
                4,
                3);

        headerRange.Style.Font.Bold =
            true;

        headerRange.Style.Alignment.Horizontal =
            XLAlignmentHorizontalValues.Center;

        var metrics =
            GetMetrics(
                dashboard);

        var row =
            5;

        foreach (var metric in metrics)
        {
            worksheet.Cell(
                    row,
                    1)
                .Value =
                metric.Category;

            worksheet.Cell(
                    row,
                    2)
                .Value =
                metric.Name;

            worksheet.Cell(
                    row,
                    3)
                .Value =
                metric.Value;

            row++;
        }

        var dataRange =
            worksheet.Range(
                4,
                1,
                row - 1,
                3);

        foreach (var cell in dataRange.Cells())
        {
            cell.Style.Border.TopBorder =
                XLBorderStyleValues.Thin;

            cell.Style.Border.BottomBorder =
                XLBorderStyleValues.Thin;

            cell.Style.Border.LeftBorder =
                XLBorderStyleValues.Thin;

            cell.Style.Border.RightBorder =
                XLBorderStyleValues.Thin;
        }

        worksheet.Column(1).Width =
            20;

        worksheet.Column(2).Width =
            30;

        worksheet.Column(3).Width =
            15;

        worksheet.Column(3)
            .Style.Alignment.Horizontal =
            XLAlignmentHorizontalValues.Center;

        worksheet.SheetView.FreezeRows(
            4);

        using var stream =
            new MemoryStream();

        workbook.SaveAs(
            stream);

        return stream.ToArray();
    }

    public byte[] ExportToPdf(
        AdminDashboardResponse dashboard)
    {
        ArgumentNullException.ThrowIfNull(
            dashboard);

        var metrics =
            GetMetrics(
                dashboard);

        var content =
            new StringBuilder();

        var generatedAt =
            DateTime.UtcNow.ToString(
                "yyyy-MM-dd HH:mm:ss",
                CultureInfo.InvariantCulture);

        AddPdfText(
            content,
            "Task Management - Admin Dashboard",
            50,
            800,
            18,
            true);

        AddPdfText(
            content,
            $"Generated at: {generatedAt} UTC",
            50,
            775,
            9,
            false);

        var y =
            740d;

        string? currentCategory =
            null;

        foreach (var metric in metrics)
        {
            if (!string.Equals(
                    currentCategory,
                    metric.Category,
                    StringComparison.Ordinal))
            {
                if (currentCategory is not null)
                {
                    y -= 10;
                }

                currentCategory =
                    metric.Category;

                AddPdfText(
                    content,
                    currentCategory,
                    50,
                    y,
                    13,
                    true);

                y -= 22;
            }

            AddPdfText(
                content,
                $"{metric.Name}: {metric.Value}",
                70,
                y,
                10,
                false);

            y -= 18;
        }

        AddPdfText(
            content,
            "Generated by TaskManagement",
            50,
            40,
            8,
            false);

        return BuildPdf(
            content.ToString());
    }

    private static List<DashboardMetric>
        GetMetrics(
            AdminDashboardResponse dashboard)
    {
        return new List<DashboardMetric>
        {
            new(
                "Users",
                "Total Users",
                dashboard.TotalUsers),

            new(
                "Users",
                "Active Users",
                dashboard.ActiveUsers),

            new(
                "Users",
                "Inactive Users",
                dashboard.InactiveUsers),

            new(
                "Workspaces",
                "Total Workspaces",
                dashboard.TotalWorkspaces),

            new(
                "Projects",
                "Total Projects",
                dashboard.TotalProjects),

            new(
                "Projects",
                "Active Projects",
                dashboard.ActiveProjects),

            new(
                "Projects",
                "Archived Projects",
                dashboard.ArchivedProjects),

            new(
                "Tasks",
                "Total Tasks",
                dashboard.TotalTasks),

            new(
                "Tasks",
                "To Do",
                dashboard.TodoTasks),

            new(
                "Tasks",
                "In Progress",
                dashboard.InProgressTasks),

            new(
                "Tasks",
                "In Review",
                dashboard.InReviewTasks),

            new(
                "Tasks",
                "Done",
                dashboard.DoneTasks),

            new(
                "Tasks",
                "Cancelled",
                dashboard.CancelledTasks)
        };
    }

    private static void AddPdfText(
        StringBuilder content,
        string text,
        double x,
        double y,
        double fontSize,
        bool bold)
    {
        var font =
            bold
                ? "F2"
                : "F1";

        content.AppendLine(
            "BT");

        content.AppendLine(
            $"/{font} {fontSize.ToString(CultureInfo.InvariantCulture)} Tf");

        content.AppendLine(
            $"1 0 0 1 " +
            $"{x.ToString(CultureInfo.InvariantCulture)} " +
            $"{y.ToString(CultureInfo.InvariantCulture)} Tm");

        content.AppendLine(
            $"({EscapePdfText(text)}) Tj");

        content.AppendLine(
            "ET");
    }

    private static string EscapePdfText(
        string value)
    {
        return value
            .Replace(
                "\\",
                "\\\\")
            .Replace(
                "(",
                "\\(")
            .Replace(
                ")",
                "\\)");
    }

    private static byte[] BuildPdf(
        string pageContent)
    {
        var pageContentBytes =
            Encoding.ASCII.GetBytes(
                pageContent);

        var objects =
            new List<byte[]>
            {
                EncodeAscii(
                    "<< /Type /Catalog /Pages 2 0 R >>"),

                EncodeAscii(
                    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),

                EncodeAscii(
                    "<< /Type /Page /Parent 2 0 R " +
                    "/MediaBox [0 0 595 842] " +
                    "/Resources << /Font << " +
                    "/F1 5 0 R /F2 6 0 R >> >> " +
                    "/Contents 4 0 R >>"),

                BuildStreamObject(
                    pageContentBytes),

                EncodeAscii(
                    "<< /Type /Font " +
                    "/Subtype /Type1 " +
                    "/BaseFont /Helvetica >>"),

                EncodeAscii(
                    "<< /Type /Font " +
                    "/Subtype /Type1 " +
                    "/BaseFont /Helvetica-Bold >>")
            };

        using var stream =
            new MemoryStream();

        WriteAscii(
            stream,
            "%PDF-1.4\n");

        var offsets =
            new long[
                objects.Count + 1];

        for (var index = 0;
             index < objects.Count;
             index++)
        {
            var objectNumber =
                index + 1;

            offsets[objectNumber] =
                stream.Position;

            WriteAscii(
                stream,
                $"{objectNumber} 0 obj\n");

            stream.Write(
                objects[index]);

            WriteAscii(
                stream,
                "\nendobj\n");
        }

        var crossReferenceOffset =
            stream.Position;

        WriteAscii(
            stream,
            $"xref\n0 {objects.Count + 1}\n");

        WriteAscii(
            stream,
            "0000000000 65535 f \n");

        for (var objectNumber = 1;
             objectNumber <= objects.Count;
             objectNumber++)
        {
            WriteAscii(
                stream,
                $"{offsets[objectNumber]:0000000000} 00000 n \n");
        }

        WriteAscii(
            stream,
            "trailer\n");

        WriteAscii(
            stream,
            $"<< /Size {objects.Count + 1} /Root 1 0 R >>\n");

        WriteAscii(
            stream,
            "startxref\n");

        WriteAscii(
            stream,
            $"{crossReferenceOffset}\n");

        WriteAscii(
            stream,
            "%%EOF");

        return stream.ToArray();
    }

    private static byte[] BuildStreamObject(
        byte[] content)
    {
        using var stream =
            new MemoryStream();

        WriteAscii(
            stream,
            $"<< /Length {content.Length} >>\n");

        WriteAscii(
            stream,
            "stream\n");

        stream.Write(
            content);

        WriteAscii(
            stream,
            "\nendstream");

        return stream.ToArray();
    }

    private static byte[] EncodeAscii(
        string value)
    {
        return Encoding.ASCII.GetBytes(
            value);
    }

    private static void WriteAscii(
        Stream stream,
        string value)
    {
        var bytes =
            Encoding.ASCII.GetBytes(
                value);

        stream.Write(
            bytes);
    }

    private sealed record DashboardMetric(
        string Category,
        string Name,
        int Value);
}