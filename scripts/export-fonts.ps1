param([string]$OutputPath='local-fonts.json')
Add-Type -AssemblyName System.Drawing
$collection = [System.Drawing.Text.InstalledFontCollection]::new()
try {
  $families = @($collection.Families | ForEach-Object { $_.Name } | Sort-Object -Unique)
  @{format='xpin-fonts/1';families=$families} | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $OutputPath -Encoding utf8
  Write-Output "Exported $($families.Count) installed font families to $OutputPath"
} finally { $collection.Dispose() }
