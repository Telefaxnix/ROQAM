# ROQAM installer for both versions: English (roqam) and German (roqam-de).
# Copies the chosen version to %USERPROFILE%\.claude\mods and adds it to %USERPROFILE%\.claude\settings.json.
# An existing mod folder, the other language version and settings.json are first moved or copied to
# %USERPROFILE%\.claude\backups; nothing is deleted. Existing entries in settings.json stay as they are.
# Start: double-click Install.bat. Without questions: -Language en|de and -Location <name> ("-" = no location).
param([string]$Language, [string]$Location)
$Sprache = $Language
$Ort = $Location

$ErrorActionPreference = 'Stop'
$PSCO = [System.Management.Automation.PSCustomObject]

# Text in the chosen language (English until a language is chosen)
function T([string]$en, [string]$de) {
    if ($script:Sprache -eq 'de') { return $de }
    return $en
}

function Abbruch([string]$text, [switch]$teilweise) {
    Write-Host ''
    Write-Host $text -ForegroundColor Red
    if (-not $teilweise) { Write-Host (T 'Nothing was changed.' 'Es wurde nichts geändert.') -ForegroundColor Red }
    exit 1
}

# Write JSON ourselves: ConvertTo-Json in Windows PowerShell 5.1 cuts deep levels and changes characters.
function Json-String([string]$s) {
    $t = $s.Replace('\', '\\').Replace('"', '\"')
    $t = [regex]::Replace($t, '[\x00-\x1f]', [Text.RegularExpressions.MatchEvaluator] { param($m) '\u{0:x4}' -f [int][char]$m.Value })
    return '"' + $t + '"'
}

function Json-Text($wert, [string]$einzug) {
    $tiefer = $einzug + '  '
    if ($null -eq $wert) { return 'null' }
    if ($wert -is [bool]) { if ($wert) { return 'true' }; return 'false' }
    if ($wert -is [string]) { return (Json-String $wert) }
    if ($wert -is [datetime]) { return (Json-String $wert.ToString('o')) }
    if ($wert -is [int] -or $wert -is [long] -or $wert -is [decimal] -or $wert -is [double] -or $wert -is [single]) {
        return [Convert]::ToString($wert, [Globalization.CultureInfo]::InvariantCulture)
    }
    if ($wert -is [array]) {
        if ($wert.Count -eq 0) { return '[]' }
        $teile = @(foreach ($x in $wert) { $tiefer + (Json-Text $x $tiefer) })
        return "[`n" + ($teile -join ",`n") + "`n$einzug]"
    }
    if ($wert -is $PSCO) {
        $props = @($wert.PSObject.Properties)
        if ($props.Count -eq 0) { return '{}' }
        $teile = @(foreach ($p in $props) { $tiefer + (Json-String $p.Name) + ': ' + (Json-Text $p.Value $tiefer) })
        return "{`n" + ($teile -join ",`n") + "`n$einzug}"
    }
    throw "Unknown value in settings.json: $($wert.GetType().FullName)"
}

# Get or create a sub-object; if the entry is not an object, stop before changing anything
function Objekt($eltern, [string]$name, [string]$wo) {
    $p = $eltern.PSObject.Properties[$name]
    if (-not $p) {
        $eltern | Add-Member -NotePropertyName $name -NotePropertyValue ([pscustomobject]@{})
        return $eltern.PSObject.Properties[$name].Value
    }
    if ($p.Value -isnot $PSCO) {
        Abbruch (T "In settings.json, `"$wo`" is not an object. Please add the entries by hand, see README.md." "In settings.json ist «$wo» kein Objekt. Bitte von Hand ergänzen, siehe ANLEITUNG.md.")
    }
    return $p.Value
}

function Setze($objekt, [string]$name, $wert, [switch]$nurWennFehlt) {
    $p = $objekt.PSObject.Properties[$name]
    if ($p) { if (-not $nurWennFehlt) { $p.Value = $wert } }
    else { $objekt | Add-Member -NotePropertyName $name -NotePropertyValue $wert }
}

# Place set earlier for a version (read only, creates nothing)
function AlterOrt($configs, [string]$name) {
    $c = $configs.PSObject.Properties[$name]
    if (-not $c -or $c.Value -isnot $PSCO) { return '' }
    $o = $c.Value.PSObject.Properties['options']
    if (-not $o -or $o.Value -isnot $PSCO) { return '' }
    foreach ($k in @('location', 'ort')) {
        $ort = $o.Value.PSObject.Properties[$k]
        if ($ort -and $ort.Value -is [string]) { return $ort.Value }
    }
    return ''
}

Write-Host "ROQAM" -ForegroundColor Cyan
Write-Host ''

# 1. Language; suggested from Windows (German Windows: German, otherwise English)
if ($PSBoundParameters.ContainsKey('Language')) {
    $Sprache = $Sprache.Trim().ToLower()
    if ($Sprache -notin @('en', 'de')) { $Sprache = 'en'; Abbruch 'Unknown language. Use -Language en or -Language de.' }
}
else {
    $vorschlag = if ((Get-UICulture).TwoLetterISOLanguageName -eq 'de') { 'de' } else { 'en' }
    $enterText = if ($vorschlag -eq 'de') { 'Enter = Deutsch' } else { 'Enter = English' }
    Write-Host 'Language / Sprache:   1 = English   2 = Deutsch'
    $Sprache = ''
    while (-not $Sprache) {
        $wahl = ([string](Read-Host "1 / 2 ($enterText)")).Trim().ToLower()
        if ($wahl -eq '') { $Sprache = $vorschlag }
        elseif ($wahl -in @('1', 'e', 'en', 'english')) { $Sprache = 'en' }
        elseif ($wahl -in @('2', 'd', 'de', 'deutsch')) { $Sprache = 'de' }
    }
    Write-Host ''
}

$name = if ($Sprache -eq 'de') { 'roqam-de' } else { 'roqam' }
$andererName = if ($Sprache -eq 'de') { 'roqam' } else { 'roqam-de' }
$quelle = Join-Path $PSScriptRoot $name
$claude = Join-Path $env:USERPROFILE '.claude'
$mods = Join-Path $claude 'mods'
$ziel = Join-Path $mods $name
$andererZiel = Join-Path $mods $andererName
$settings = Join-Path $claude 'settings.json'
$backups = Join-Path $claude 'backups'
$stempel = Get-Date -Format 'yyyy-MM-dd-HHmmss'

Write-Host (T 'Installing the English version (roqam).' 'Die deutsche Fassung (roqam-de) wird installiert.')
Write-Host ''

if (-not (Test-Path (Join-Path $quelle '.claude-plugin\plugin.json'))) {
    Abbruch (T "The folder $name is missing next to this script. Please unzip the whole package first and start Install.bat in the unzipped folder." "Der Ordner $name fehlt neben diesem Skript. Bitte das ZIP zuerst ganz entpacken und Install.bat im entpackten Ordner starten.")
}

# 2. Read and check settings.json before anything is changed
$json = $null
if (Test-Path $settings) {
    $text = [IO.File]::ReadAllText($settings)
    if ($text.Trim()) {
        try { $json = $text | ConvertFrom-Json }
        catch { Abbruch (T "settings.json is not valid JSON ($settings). Please add the entries by hand, see README.md." "settings.json ist kein gültiges JSON ($settings). Bitte von Hand ergänzen, siehe ANLEITUNG.md.") }
        if ($json -isnot $PSCO) { Abbruch (T "settings.json has an unexpected form ($settings). Please add the entries by hand, see README.md." "settings.json hat eine unerwartete Form ($settings). Bitte von Hand ergänzen, siehe ANLEITUNG.md.") }
    }
}
if ($null -eq $json) { $json = [pscustomobject]@{} }

$env_ = Objekt $json 'env' 'env'
$dirsWert = $env_.PSObject.Properties['CLAUDE_CODE_PLUGIN_DIRS']
if ($dirsWert -and $dirsWert.Value -isnot [string]) {
    Abbruch (T 'In settings.json, "env.CLAUDE_CODE_PLUGIN_DIRS" is not text. Please add the entries by hand, see README.md.' 'In settings.json ist «env.CLAUDE_CODE_PLUGIN_DIRS» kein Text. Bitte von Hand ergänzen, siehe ANLEITUNG.md.')
}
$configs = Objekt $json 'pluginConfigs' 'pluginConfigs'
$andererOrt = AlterOrt $configs $andererName
$cockpit = Objekt $configs $name "pluginConfigs.$name"
$optionen = Objekt $cockpit 'options' "pluginConfigs.$name.options"

# 3. Ask for the place: suggested is the place set earlier for this version, then the one of the other version,
#    otherwise none
$vorgabe = ''
if ($andererOrt) { $vorgabe = $andererOrt }
$bisher = AlterOrt $configs $name
if ($bisher) { $vorgabe = $bisher }
if (-not $PSBoundParameters.ContainsKey('Location')) {
    Write-Host (T 'Location for sky and weather, e.g. London.' 'Ort für Himmel und Wetter, z. B. Bern.')
    if ($vorgabe) { Write-Host (T "Enter = $vorgabe, a hyphen (-) = no sky and weather." "Nur Enter = $vorgabe, ein Bindestrich (-) = keine Himmel- und Wetteranzeige.") }
    else { Write-Host (T 'Enter = no sky and weather.' 'Nur Enter = keine Himmel- und Wetteranzeige.') }
    $Ort = ([string](Read-Host (T 'Location' 'Ort'))).Trim()
    if ($Ort -eq '') { $Ort = $vorgabe }
}
if ($Ort -eq '-') { $Ort = '' }

# 4. Copy the mod folder; an existing one and the other language version go to backups (only one bar may run)
try {
    New-Item -ItemType Directory -Force $mods, $backups | Out-Null
    $alterOrdner = $null
    if (Test-Path $ziel) {
        $alterOrdner = Join-Path $backups "$name-$stempel"
        Move-Item $ziel $alterOrdner
    }
    $andererOrdner = $null
    if (Test-Path $andererZiel) {
        $andererOrdner = Join-Path $backups "$andererName-$stempel"
        Move-Item $andererZiel $andererOrdner
    }
    Copy-Item $quelle $mods -Recurse
}
catch {
    Abbruch (T "Copying failed: $($_.Exception.Message)`nIs Claude Code still running? Quit it completely and try again." "Kopieren fehlgeschlagen: $($_.Exception.Message)`nLäuft Claude Code noch? Dann ganz beenden und nochmals starten.") -teilweise
}
if (-not (Test-Path (Join-Path $ziel '.claude-plugin\plugin.json'))) {
    Abbruch (T "The mod folder is missing after copying: $ziel" "Der Mod-Ordner fehlt nach dem Kopieren: $ziel") -teilweise
}

# 5. Update settings.json: this version's path in CLAUDE_CODE_PLUGIN_DIRS (no duplicate), the other one's out;
#    options of the mod
$dirs = @()
if ($dirsWert) { $dirs = @(([string]$dirsWert.Value) -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
$dirs = @($dirs | Where-Object { $_.TrimEnd('\') -ine $andererZiel })
if (-not @($dirs | Where-Object { $_.TrimEnd('\') -ieq $ziel }).Count) { $dirs += $ziel }
Setze $env_ 'CLAUDE_CODE_PLUGIN_DIRS' ($dirs -join ';')
# option names: English in the English version, German in the German one
if ($Sprache -eq 'de') { $kOrt = 'ort'; $kApi = 'apiKosten'; $kAktion = 'aktionen' }
else { $kOrt = 'location'; $kApi = 'apiCost'; $kAktion = 'promotions' }
Setze $optionen $kOrt $Ort
Setze $optionen $kApi $true -nurWennFehlt
Setze $optionen 'higgsfield' $true -nurWennFehlt
Setze $optionen $kAktion $true -nurWennFehlt

$sicherung = $null
if (Test-Path $settings) {
    $sicherung = Join-Path $backups "settings.json.$stempel-before-roqam"
    Copy-Item $settings $sicherung
}
[IO.File]::WriteAllText($settings, (Json-Text $json '') + "`n", (New-Object Text.UTF8Encoding $false))

# 6. Check: file readable, this path in, the other one out; otherwise restore the old state
$ok = $false
try {
    $pruef = [IO.File]::ReadAllText($settings) | ConvertFrom-Json
    $liste = @(([string]$pruef.env.CLAUDE_CODE_PLUGIN_DIRS) -split ';')
    $ok = ($liste -contains $ziel) -and -not ($liste -contains $andererZiel)
} catch {}
if (-not $ok) {
    if ($sicherung) { Copy-Item $sicherung $settings -Force }
    else { Move-Item $settings (Join-Path $backups "settings.json.$stempel-faulty") }
    Abbruch (T 'settings.json could not be written cleanly; the old state is back. Please add the entries by hand, see README.md.' 'settings.json liess sich nicht sauber schreiben; der alte Stand ist zurück. Bitte von Hand ergänzen, siehe ANLEITUNG.md.') -teilweise
}

# 7. Also installed with the plugin manager? Then two bars would run: say how to remove it (nothing is changed there)
$auchPlugin = @()
$enabled = $json.PSObject.Properties['enabledPlugins']
if ($enabled -and $enabled.Value -is $PSCO) {
    $auchPlugin = @($enabled.Value.PSObject.Properties | Where-Object { $_.Name -like 'roqam*@*' -and $_.Value -eq $true } | ForEach-Object { $_.Name })
}

$ortText = if ($Ort) { $Ort } else { T 'none (no sky or weather)' 'keiner (keine Himmel- und Wetteranzeige)' }
Write-Host ''
Write-Host (T 'Done.' 'Fertig.') -ForegroundColor Green
Write-Host ((T '  Version:        English' '  Fassung:        Deutsch') + " ($name)")
Write-Host ((T '  Mod:            ' '  Mod:            ') + $ziel)
Write-Host ((T '  Settings:       ' '  Einstellungen:  ') + $settings)
Write-Host ((T '  Location:       ' '  Ort:            ') + $ortText)
if ($sicherung) { Write-Host ((T '  Backup:         ' '  Sicherung:      ') + $sicherung) }
if ($alterOrdner) { Write-Host ((T '  Old mod:        ' '  Alter Mod:      ') + $alterOrdner) }
if ($andererOrdner) { Write-Host ((T '  Other version:  ' '  Andere Fassung: ') + $andererOrdner) }
Write-Host ''
foreach ($p in $auchPlugin) {
    Write-Host (T "Also installed with the plugin manager: $p. Two bars would run; remove it with" "Zusätzlich mit der Plugin-Verwaltung installiert: $p. Es liefen zwei Leisten; entfernen mit") -ForegroundColor Yellow
    Write-Host "  claude plugin uninstall $p" -ForegroundColor Yellow
    Write-Host ''
}
Write-Host (T 'Now quit Claude Code completely and start it again (close the terminal or exit the desktop app).' 'Jetzt Claude Code ganz beenden und neu starten (Konsole schliessen bzw. Desktop-App beenden).') -ForegroundColor Yellow
Write-Host (T "To undo: copy the settings.json backup back and remove the folder $name from .claude\mods." "Rückgängig: die Sicherung von settings.json zurückkopieren und den Ordner $name aus .claude\mods entfernen.")
exit 0
