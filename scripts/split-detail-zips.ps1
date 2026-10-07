Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$srcDir = 'D:\code-shop\server\uploads\detail'
$outDir = 'D:\code-shop\data'
$maxBytes = 480L * 1024L * 1024L

Get-ChildItem $outDir -Filter 'uploads-detail-part*.zip' -ErrorAction SilentlyContinue | Remove-Item -Force
if (Test-Path (Join-Path $outDir 'uploads-detail.zip')) {
  Remove-Item (Join-Path $outDir 'uploads-detail.zip') -Force
}

$files = @(Get-ChildItem $srcDir -File | Sort-Object Name)
Write-Host ("total files: {0}" -f $files.Count)

$part = 1
$batch = New-Object System.Collections.Generic.List[object]
$batchSize = 0L

function Write-Batch {
  param([int]$PartNum, $Items)
  $zipPath = Join-Path $outDir ('uploads-detail-part{0:D2}.zip' -f $PartNum)
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($f in $Items) {
      $entryName = 'detail/' + $f.Name
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $f.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal
      )
    }
  } finally {
    $zip.Dispose()
  }
  $mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
  Write-Host ("created {0} files={1} zipMB={2}" -f (Split-Path $zipPath -Leaf), $Items.Count, $mb)
}

foreach ($f in $files) {
  if ($batch.Count -gt 0 -and ($batchSize + $f.Length) -gt $maxBytes) {
    Write-Batch -PartNum $part -Items $batch
    $part++
    $batch = New-Object System.Collections.Generic.List[object]
    $batchSize = 0L
  }
  [void]$batch.Add($f)
  $batchSize += $f.Length
}

if ($batch.Count -gt 0) {
  Write-Batch -PartNum $part -Items $batch
}

Write-Host 'DONE'
Get-ChildItem $outDir -Filter 'uploads-detail-part*.zip' |
  Select-Object Name, @{ N = 'MB'; E = { [math]::Round($_.Length / 1MB, 1) } } |
  Format-Table -AutoSize
