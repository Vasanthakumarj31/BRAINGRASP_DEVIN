
# ============================================================
# fix-cart-sidebars.ps1
# Standardises the modern cart sidebar across all BrainyGrasp pages
# and fixes the live-update bug in common.js
# ============================================================

$frontendDir = "$PSScriptRoot\frontend"

# ── New modern sidebar HTML ──────────────────────────────────
$newSidebar = @'
  <!-- Cart Sidebar -->
  <div class="cart-overlay" id="cartOverlay"></div>
  <div class="cart-sidebar" id="cartSidebar">

    <!-- Header -->
    <div class="cart-header">
      <div class="cart-header-left">
        <div class="cart-header-icon">
          <i class="fas fa-shopping-bag"></i>
        </div>
        <div>
          <h3>Your Cart</h3>
          <span class="cart-item-count-label"><span id="cartItemCount">0</span> items</span>
        </div>
      </div>
      <button class="cart-close" id="cartClose" aria-label="Close cart">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Free Shipping Progress Bar -->
    <div class="cart-shipping-bar" id="cartShippingBar">
      <div class="shipping-bar-text">
        <i class="fas fa-truck"></i>
        <span id="shippingBarMsg">Add <strong>&#8377;999</strong> more for FREE shipping!</span>
      </div>
      <div class="shipping-bar-track">
        <div class="shipping-bar-fill" id="shippingBarFill" style="width: 0%"></div>
      </div>
    </div>

    <!-- Promo Pill -->
    <div class="cart-promo-strip">
      <div class="promo-pill"><i class="fas fa-tag"></i> <strong>BRAINY10</strong> &mdash; 10% off on 2+ items</div>
      <div class="promo-pill"><i class="fas fa-gift"></i> FREE gift above &#8377;1,499</div>
    </div>

    <!-- Empty State -->
    <div class="cart-empty" id="cartEmpty">
      <div class="cart-empty-icon">
        <i class="fas fa-shopping-bag"></i>
      </div>
      <h4>Your cart is empty!</h4>
      <p>Add some amazing toys to get started.</p>
      <a href="shop-by-category.html" class="btn-shop-now">Shop Now <i class="fas fa-arrow-right"></i></a>
    </div>

    <!-- Cart Items -->
    <div class="cart-items" id="cartItems"></div>

    <!-- Footer -->
    <div class="cart-footer">
      <div class="cart-savings-badge" id="cartSavingsBadge" style="display:none;">
        <i class="fas fa-piggy-bank"></i> You save <span id="cartSavingsAmount">&#8377;0</span> on this order!
      </div>
      <div class="cart-subtotal-row">
        <span>Subtotal</span>
        <span id="cartTotal">&#8377;0</span>
      </div>
      <div class="cart-tax-note">Taxes &amp; shipping calculated at checkout</div>
      <button class="btn-checkout-modern" id="sidebarCheckoutBtn">
        <i class="fas fa-lock"></i> Secure Checkout
        <span class="checkout-arrow">&#8594;</span>
      </button>
      <button class="btn-view-cart-modern">
        <i class="fas fa-eye"></i> View Full Cart
      </button>
    </div>

  </div>
'@

# ── New cart button wrapper HTML (modern badge position) ──────
$newCartBtn = @'
          <div class="cart-btn-wrapper" style="position:relative;display:inline-flex;align-items:center;">
            <button class="header-action-btn cart-btn" id="cartBtn" aria-label="Open cart">
              <i class="fas fa-shopping-bag"></i>
            </button>
            <span class="cart-count" style="position:absolute;top:-6px;right:-6px;">0</span>
          </div>
'@

# ── Pages to update (skip index.html - already modern) ────────
$pages = @(
  "shop-by-age.html",
  "shop-by-category.html",
  "collections.html",
  "blogs.html",
  "faqs.html",
  "rewards.html",
  "parents-choice.html",
  "gift-finder.html",
  "search-results.html"
)

foreach ($page in $pages) {
  $path = Join-Path $frontendDir $page
  if (-not (Test-Path $path)) {
    Write-Host "  SKIP (not found): $page"
    continue
  }

  $content = Get-Content $path -Raw -Encoding UTF8

  # ── 1. Replace old sidebar block ─────────────────────────────
  # Regex: from  <div class="cart-overlay"  to closing </div> of cart-sidebar
  $oldPattern = '(?s)\s*<!--\s*Cart Sidebar\s*-->[\r\n]+\s*<div class="cart-overlay" id="cartOverlay"></div>[\r\n]+\s*<div class="cart-sidebar" id="cartSidebar">.*?</div>\s*(?=\r?\n)'
  if ($content -match $oldPattern) {
    $content = $content -replace $oldPattern, ("`r`n" + $newSidebar)
    Write-Host "  [OK] Replaced sidebar in $page"
  } else {
    Write-Host "  [--] No old sidebar pattern matched in $page (may already be modern)"
  }

  # ── 2. Replace old inline cart button (count inside button) ──
  # Old pattern: <button class="header-action-btn cart-btn" id="cartBtn">...<span class="cart-count">...
  $oldBtnPattern = '(?s)<button class="header-action-btn cart-btn" id="cartBtn"[^>]*>[\r\n\s]*<i class="fas fa-shopping-bag"></i>[\r\n\s]*<span class="cart-count">[^<]*</span>[\r\n\s]*</button>'
  if ($content -match $oldBtnPattern) {
    $content = $content -replace $oldBtnPattern, $newCartBtn.Trim()
    Write-Host "  [OK] Updated cart button in $page"
  }

  Set-Content $path -Value $content -Encoding UTF8 -NoNewline
}

Write-Host ""
Write-Host "== Fixing common.js initCartSidebarActions bug =="

$commonJsPath = Join-Path $frontendDir "js\common.js"
$jsContent = Get-Content $commonJsPath -Raw -Encoding UTF8

# Fix: add renderCartSidebar() call after each mutation in initCartSidebarActions
$oldMinus = @'
    if (minusBtn) {

      const id = parseInt(minusBtn.dataset.id, 10);

      if (!isNaN(id) && typeof updateQuantityInCart === 'function') updateQuantityInCart(id, -1);

      return;

    }
'@
$newMinus = @'
    if (minusBtn) {

      const id = parseInt(minusBtn.dataset.id, 10);

      if (!isNaN(id) && typeof updateQuantityInCart === 'function') updateQuantityInCart(id, -1);

      if (typeof renderCartSidebar === 'function') renderCartSidebar();

      return;

    }
'@

$oldPlus = @'
    if (plusBtn) {

      const id = parseInt(plusBtn.dataset.id, 10);

      if (!isNaN(id) && typeof updateQuantityInCart === 'function') updateQuantityInCart(id, +1);

      return;

    }
'@
$newPlus = @'
    if (plusBtn) {

      const id = parseInt(plusBtn.dataset.id, 10);

      if (!isNaN(id) && typeof updateQuantityInCart === 'function') updateQuantityInCart(id, +1);

      if (typeof renderCartSidebar === 'function') renderCartSidebar();

      return;

    }
'@

$oldRemove = @'
    if (removeBtn) {

      const id = parseInt(removeBtn.dataset.id, 10);

      if (!isNaN(id) && typeof removeFromCart === 'function') removeFromCart(id);

      return;

    }
'@
$newRemove = @'
    if (removeBtn) {

      const id = parseInt(removeBtn.dataset.id, 10);

      if (!isNaN(id) && typeof removeFromCart === 'function') removeFromCart(id);

      if (typeof renderCartSidebar === 'function') renderCartSidebar();

      return;

    }
'@

$jsContent = $jsContent.Replace($oldMinus, $newMinus)
$jsContent = $jsContent.Replace($oldPlus, $newPlus)
$jsContent = $jsContent.Replace($oldRemove, $newRemove)

Set-Content $commonJsPath -Value $jsContent -Encoding UTF8 -NoNewline
Write-Host "  [OK] Fixed live-update bug in common.js"

Write-Host ""
Write-Host "All done! Cart sidebar is now consistent across all pages."
