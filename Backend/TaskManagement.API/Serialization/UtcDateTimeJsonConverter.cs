using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TaskManagement.API.Serialization;

public sealed class UtcDateTimeJsonConverter
    : JsonConverter<DateTime>
{
    public override DateTime Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType !=
            JsonTokenType.String)
        {
            throw new JsonException(
                "Date and time value must be a string.");
        }


        var rawValue =
            reader.GetString();


        if (string.IsNullOrWhiteSpace(
                rawValue))
        {
            throw new JsonException(
                "Date and time value cannot be empty.");
        }


        /*
         * DateTimeOffset is used first because it correctly
         * understands:
         *
         * 2026-08-19T05:30:00Z
         * 2026-08-19T08:30:00+03:00
         *
         * Both become the same UTC instant.
         */
        if (
            DateTimeOffset.TryParse(
                rawValue,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces |
                DateTimeStyles.RoundtripKind,
                out var dateTimeOffset)
        )
        {
            return dateTimeOffset.UtcDateTime;
        }


        /*
         * Fallback for date/time strings without any timezone.
         *
         * Inside this system all stored timestamps are UTC,
         * so an unspecified timestamp is treated as UTC rather
         * than as the server machine's local timezone.
         */
        if (
            DateTime.TryParse(
                rawValue,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out var dateTime)
        )
        {
            return dateTime.Kind switch
            {
                DateTimeKind.Utc =>
                    dateTime,

                DateTimeKind.Local =>
                    dateTime.ToUniversalTime(),

                _ =>
                    DateTime.SpecifyKind(
                        dateTime,
                        DateTimeKind.Utc)
            };
        }


        throw new JsonException(
            $"Invalid date and time value: {rawValue}");
    }


    public override void Write(
        Utf8JsonWriter writer,
        DateTime value,
        JsonSerializerOptions options)
    {
        /*
         * SQL Server datetime/datetime2 does not preserve the
         * DateTime.Kind flag and EF may materialize the value
         * as Unspecified.
         *
         * The application stores timestamps in UTC, therefore:
         *
         * Utc         -> keep it
         * Local       -> convert it
         * Unspecified -> mark it as UTC
         */
        var utcValue =
            value.Kind switch
            {
                DateTimeKind.Utc =>
                    value,

                DateTimeKind.Local =>
                    value.ToUniversalTime(),

                _ =>
                    DateTime.SpecifyKind(
                        value,
                        DateTimeKind.Utc)
            };


        /*
         * "O" = ISO 8601 round-trip format.
         *
         * Because utcValue.Kind == Utc, the serialized value
         * ends with Z, for example:
         *
         * 2026-08-19T02:40:00.0000000Z
         */
        writer.WriteStringValue(
            utcValue.ToString(
                "O",
                CultureInfo.InvariantCulture));
    }
}