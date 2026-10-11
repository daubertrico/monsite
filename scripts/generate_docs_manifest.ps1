# Generate docs manifest for site
# Scans 'docs asso' and 'documents administratifs' (if present) and writes data/docs_officiels.json
Param(
    [string]$Root = (Get-Location).Path,
    [string]$Output = "data/docs_officiels.json"
)

$folders = @("docs asso", "documents administratifs")
$items = @()

foreach ($f in $folders) {
    $full = Join-Path $Root $f
    if (Test-Path $full) {
        Get-ChildItem -Path $full -File | ForEach-Object {
            $rel = Join-Path $f $_.Name -Replace "\\","/"
            $items += [PSCustomObject]@{
                filename = $_.Name
                path = $rel
                folder = $f
                size = $_.Length
                modified = $_.LastWriteTime.ToString('o')
            }
        }
    }
}

# Ensure data folder exists
$dataDir = Join-Path $Root 'data'
if (-not (Test-Path $dataDir)) { New-Item -Path $dataDir -ItemType Directory | Out-Null }

# Write JSON
$items | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $Root $Output) -Encoding UTF8
Write-Host "Wrote manifest to $Output (`$($items.Count)` items)"