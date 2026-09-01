Add-Type -AssemblyName System.Drawing

$screenshotsDir = Join-Path $PSScriptRoot "..\images\screenshots"
if (-not (Test-Path $screenshotsDir)) {
    New-Item -ItemType Directory -Force -Path $screenshotsDir | Out-Null
}

$logoPath = Join-Path $PSScriptRoot "..\images\logo-circle.png"
if (-not (Test-Path $logoPath)) {
    $logoPath = Join-Path $PSScriptRoot "..\images\logo.png"
}
$logo = [System.Drawing.Image]::FromFile($logoPath)

# Colors
$cMaroon = [System.Drawing.Color]::FromArgb(139, 26, 74)
$cDark = [System.Drawing.Color]::FromArgb(26, 10, 15)
$cGold = [System.Drawing.Color]::FromArgb(212, 175, 55)
$cGoldLight = [System.Drawing.Color]::FromArgb(240, 208, 96)
$cCream = [System.Drawing.Color]::FromArgb(255, 248, 240)
$cWhite = [System.Drawing.Color]::White

function Create-MobileScreenshot {
    param($filename, $title, $subtitle, $items)
    $w = 720
    $h = 1280
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cCream, $cWhite, 90)
    $g.FillRectangle($brush, $rect)

    # Top Header bar
    $headerRect = New-Object System.Drawing.Rectangle(0, 0, $w, 140)
    $hBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($headerRect, $cMaroon, $cDark, 0)
    $g.FillRectangle($hBrush, $headerRect)

    # Header Logo and Title
    $g.DrawImage($logo, 30, 30, 80, 80)
    $fontBrand = New-Object System.Drawing.Font("Georgia", 26, [System.Drawing.FontStyle]::Bold)
    $fontTag = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Regular)
    $brushGold = New-Object System.Drawing.SolidBrush($cGoldLight)
    $brushWhite = New-Object System.Drawing.SolidBrush($cWhite)
    $g.DrawString("Nari Niketan", $fontBrand, $brushGold, 125, 38)
    $g.DrawString("Elegance Redefined - Ethnic Wear", $fontTag, $brushWhite, 125, 80)

    # Hero Card
    $cardRect = New-Object System.Drawing.Rectangle(30, 180, 660, 260)
    $cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($cardRect, $cMaroon, $cDark, 45)
    $g.FillRectangle($cardBrush, $cardRect)

    $fontHero = New-Object System.Drawing.Font("Georgia", 24, [System.Drawing.FontStyle]::Bold)
    $fontHeroSub = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Regular)
    $g.DrawString($title, $fontHero, $brushGold, 60, 220)
    $g.DrawString($subtitle, $fontHeroSub, $brushWhite, 60, 290)

    # CTA Button on Hero
    $btnRect = New-Object System.Drawing.Rectangle(60, 350, 240, 60)
    $btnBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($btnRect, $cGold, $cGoldLight, 0)
    $g.FillRectangle($btnBrush, $btnRect)
    $fontBtn = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)
    $brushDark = New-Object System.Drawing.SolidBrush($cDark)
    $g.DrawString("Shop Now", $fontBtn, $brushDark, 120, 368)

    # Section Title
    $fontSec = New-Object System.Drawing.Font("Georgia", 22, [System.Drawing.FontStyle]::Bold)
    $brushMaroon = New-Object System.Drawing.SolidBrush($cMaroon)
    $g.DrawString("Featured Collection", $fontSec, $brushMaroon, 30, 480)

    # Product grid (4 items)
    $xOffsets = @(30, 370)
    $yOffsets = @(540, 870)
    $idx = 0
    foreach ($y in $yOffsets) {
        foreach ($x in $xOffsets) {
            if ($idx -lt $items.Count) {
                $pCard = New-Object System.Drawing.Rectangle($x, $y, 320, 300)
                $pBrush = New-Object System.Drawing.SolidBrush($cWhite)
                $g.FillRectangle($pBrush, $pCard)
                $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 220, 210), 2)
                $g.DrawRectangle($pen, $pCard)

                # Product image placeholder
                $imgRect = New-Object System.Drawing.Rectangle(($x + 15), ($y + 15), 290, 180)
                $imgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($imgRect, $cCream, [System.Drawing.Color]::FromArgb(245, 235, 225), 45)
                $g.FillRectangle($imgBrush, $imgRect)

                $fontP = New-Object System.Drawing.Font("Georgia", 16, [System.Drawing.FontStyle]::Bold)
                $fontPrice = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)
                $item = $items[$idx]
                $g.DrawString($item.Name, $fontP, $brushMaroon, ($x + 15), ($y + 205))
                $g.DrawString($item.Price, $fontPrice, $brushGold, ($x + 15), ($y + 245))
                $idx++
            }
        }
    }

    # Bottom Nav
    $navRect = New-Object System.Drawing.Rectangle(0, 1180, $w, 100)
    $navBrush = New-Object System.Drawing.SolidBrush($cWhite)
    $g.FillRectangle($navBrush, $navRect)
    $navPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 220, 220), 2)
    $g.DrawLine($navPen, 0, 1180, $w, 1180)
    $fontNav = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("Home", $fontNav, $brushMaroon, 50, 1220)
    $g.DrawString("Shop", $fontNav, $brushDark, 230, 1220)
    $g.DrawString("Cart", $fontNav, $brushDark, 410, 1220)
    $g.DrawString("Account", $fontNav, $brushDark, 570, 1220)

    $outPath = Join-Path $screenshotsDir $filename
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $outPath"
}

function Create-DesktopScreenshot {
    param($filename, $title, $subtitle)
    $w = 1280
    $h = 720
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cCream, $cWhite, 90)
    $g.FillRectangle($brush, $rect)

    # Top Navbar
    $headerRect = New-Object System.Drawing.Rectangle(0, 0, $w, 80)
    $hBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($headerRect, $cMaroon, $cDark, 0)
    $g.FillRectangle($hBrush, $headerRect)

    $g.DrawImage($logo, 40, 15, 50, 50)
    $fontBrand = New-Object System.Drawing.Font("Georgia", 20, [System.Drawing.FontStyle]::Bold)
    $brushGold = New-Object System.Drawing.SolidBrush($cGoldLight)
    $brushWhite = New-Object System.Drawing.SolidBrush($cWhite)
    $g.DrawString("Nari Niketan", $fontBrand, $brushGold, 100, 25)

    $fontNav = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Regular)
    $g.DrawString("Home", $fontNav, $brushGold, 400, 30)
    $g.DrawString("Shop", $fontNav, $brushWhite, 480, 30)
    $g.DrawString("Sarees", $fontNav, $brushWhite, 550, 30)
    $g.DrawString("Suits", $fontNav, $brushWhite, 640, 30)
    $g.DrawString("Lehengas", $fontNav, $brushWhite, 720, 30)

    # Install & Cart buttons
    $btnRect = New-Object System.Drawing.Rectangle(1020, 20, 140, 40)
    $btnBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($btnRect, $cGold, $cGoldLight, 0)
    $g.FillRectangle($btnBrush, $btnRect)
    $fontBtn = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $brushDark = New-Object System.Drawing.SolidBrush($cDark)
    $g.DrawString("Install App", $fontBtn, $brushDark, 1045, 32)

    # Hero Section Left
    $fontHero = New-Object System.Drawing.Font("Georgia", 30, [System.Drawing.FontStyle]::Bold)
    $fontHeroSub = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Regular)
    $brushMaroon = New-Object System.Drawing.SolidBrush($cMaroon)
    $g.DrawString($title, $fontHero, $brushMaroon, 80, 150)
    $g.DrawString($subtitle, $fontHeroSub, $brushDark, 80, 240)

    # Hero CTA Button
    $ctaRect = New-Object System.Drawing.Rectangle(80, 310, 200, 55)
    $ctaBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($ctaRect, $cMaroon, $cDark, 0)
    $g.FillRectangle($ctaBrush, $ctaRect)
    $fontCta = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("Shop Now", $fontCta, $brushWhite, 130, 328)

    # Hero Right Card
    $cardRect = New-Object System.Drawing.Rectangle(760, 130, 440, 520)
    $cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($cardRect, $cMaroon, $cDark, 45)
    $g.FillRectangle($cardBrush, $cardRect)
    $g.DrawImage($logo, 860, 200, 240, 240)
    $fontHeroCard = New-Object System.Drawing.Font("Georgia", 22, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("New Collection 2026", $fontHeroCard, $brushGold, 850, 480)

    $outPath = Join-Path $screenshotsDir $filename
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $outPath"
}

# Generate 2 Mobile (Narrow) screenshots
$mobileItems1 = @(
    @{ Name = "Royal Silk Saree"; Price = "INR 3,499" },
    @{ Name = "Banarasi Lehenga"; Price = "INR 8,999" },
    @{ Name = "Anarkali Suit"; Price = "INR 2,799" },
    @{ Name = "Festive Kurta"; Price = "INR 1,499" }
)
Create-MobileScreenshot "mobile-home.png" "Discover Your Elegance" "Handcrafted Indian Ethnic Wear" $mobileItems1

$mobileItems2 = @(
    @{ Name = "Bridal Silk Saree"; Price = "INR 6,999" },
    @{ Name = "Designer Lehenga"; Price = "INR 12,499" },
    @{ Name = "Velvet Suit Set"; Price = "INR 4,299" },
    @{ Name = "Chanderi Dupatta"; Price = "INR 999" }
)
Create-MobileScreenshot "mobile-shop.png" "Exclusive Bridal Collection" "Explore 500+ Designer Styles" $mobileItems2

# Generate 2 Desktop (Wide) screenshots
Create-DesktopScreenshot "desktop-home.png" "Discover Your True Elegance" "Explore handcrafted sarees, lehengas, suits and more."
Create-DesktopScreenshot "desktop-shop.png" "Exquisite Indian Ethnic Wear" "Free shipping on orders above INR 999. 100% authentic quality."

$logo.Dispose()
Write-Host "All screenshots generated successfully!"
