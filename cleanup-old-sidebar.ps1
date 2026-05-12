
$pages = @('shop-by-age.html','shop-by-category.html','collections.html','blogs.html','faqs.html','rewards.html','parents-choice.html','gift-finder.html')
$base = Join-Path $PSScriptRoot 'frontend'

foreach ($page in $pages) {
  $path = Join-Path $base $page
  if (-not (Test-Path $path)) { Write-Host "SKIP: $path"; continue }

  $content = Get-Content $path -Raw -Encoding UTF8

  # Remove the leftover old sidebar inner content that wasn't removed by the first script.
  # The orphaned block starts with <div class="cart-offers"> and ends just before </div>
  # (the closing tag of the now-replaced cart-sidebar outer div).
  # We match from cart-offers through to the last </div> of the old footer.
  $pattern = '(?s)    <div class="cart-offers">.*?    </div>\r?\n  </div>'
  $cleaned = [regex]::Replace($content, $pattern, '')

  if ($cleaned.Length -ne $content.Length) {
    Set-Content $path -Value $cleaned -Encoding UTF8 -NoNewline
    Write-Host "[OK] Cleaned: $page"
  } else {
    Write-Host "[--] Nothing matched: $page"
  }
}

Write-Host "Cleanup complete."
