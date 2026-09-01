Add-Type -AssemblyName System.Drawing
$srcPath = Join-Path $PSScriptRoot "..\images\logo-circle.png"
if (-not (Test-Path $srcPath)) {
    $srcPath = Join-Path $PSScriptRoot "..\images\logo.png"
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)
$outDir = Join-Path $PSScriptRoot "..\images\icons"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImg, 0, 0, $size, $size)
    $g.Dispose()

    $outPath = Join-Path $outDir "icon-$($size)x$($size).png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: icon-$($size)x$($size).png"
}

# Create maskable icon with maroon background and safe padding
$maskSizes = @(192, 512)
foreach ($size in $maskSizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $maroon = [System.Drawing.ColorTranslator]::FromHtml("#8B1A4A")
    $g.Clear($maroon)
    
    $padding = [int]($size * 0.12)
    $innerSize = $size - (2 * $padding)
    $g.DrawImage($srcImg, $padding, $padding, $innerSize, $innerSize)
    $g.Dispose()

    $outPath = Join-Path $outDir "icon-maskable-$($size)x$($size).png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created maskable: icon-maskable-$($size)x$($size).png"
}

# Also create apple-touch-icon
$appleBmp = New-Object System.Drawing.Bitmap(180, 180)
$ag = [System.Drawing.Graphics]::FromImage($appleBmp)
$ag.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ag.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ag.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$maroon = [System.Drawing.ColorTranslator]::FromHtml("#8B1A4A")
$ag.Clear($maroon)
$ag.DrawImage($srcImg, 16, 16, 148, 148)
$ag.Dispose()
$applePath = Join-Path $outDir "apple-touch-icon.png"
$appleBmp.Save($applePath, [System.Drawing.Imaging.ImageFormat]::Png)
$appleBmp.Dispose()
Write-Host "Created: apple-touch-icon.png"

$srcImg.Dispose()
Write-Host "All PWA icons generated successfully!"
