# Auszug aus einem Claude-Code-Verlauf (JSONL) für die Statusleiste: nur die Abrechnungsangaben jeder Antwort
# (Zeit, ID, Modell, Token-Zahlen), eine JSON-Zeile pro Antwort. Gebraucht für Verläufe über 4 MB, die der Mod
# selbst nicht lesen darf. Nur lesend.
param([Parameter(Mandatory = $true)][string]$Pfad)

[Console]::OutputEncoding = [Text.Encoding]::UTF8
foreach ($line in [IO.File]::ReadLines($Pfad)) {
    if ($line -notmatch '"usage"' -or $line -notmatch '"assistant"') { continue }
    try { $e = $line | ConvertFrom-Json } catch { continue }
    if ($e.type -ne 'assistant' -or -not $e.message.usage) { continue }
    [pscustomobject]@{
        type      = 'assistant'
        timestamp = $e.timestamp
        message   = [pscustomobject]@{ id = $e.message.id; model = $e.message.model; usage = $e.message.usage }
    } | ConvertTo-Json -Compress -Depth 8
}
