
$base = Join-Path $PSScriptRoot 'frontend'
$pages = @('shop-by-age.html','shop-by-category.html','collections.html','blogs.html','faqs.html','rewards.html','parents-choice.html','gift-finder.html')

Write-Host "=== Page Sidebar Verification ==="
foreach ($p in $pages) {
  $path = Join-Path $base $p
  $c = Get-Content $path -Raw -Encoding UTF8
  $hasNew    = $c -match 'id="cartItemCount"'
  $hasOld    = $c -match 'cart-offers'
  $hasShip   = $c -match 'shippingBarFill'
  $hasModern = $c -match 'btn-checkout-modern'
  Write-Host ("{0,-30} modern_header={1}  shipping_bar={2}  modern_btn={3}  old_leftover={4}" -f $p, $hasNew, $hasShip, $hasModern, $hasOld)
}

Write-Host ""
Write-Host "=== common.js Fix Verification ==="
$jsPath = Join-Path $PSScriptRoot 'frontend\js\common.js'
$js = Get-Content $jsPath -Raw -Encoding UTF8
$count = ([regex]::Matches($js, 'renderCartSidebar\(\)')).Count
Write-Host "renderCartSidebar() call count: $count  (expected: 4 or more)"
