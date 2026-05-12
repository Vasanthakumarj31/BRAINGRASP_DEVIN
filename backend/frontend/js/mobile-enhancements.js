// ===================================
// MOBILE ENHANCEMENTS - FLIPKART STYLE
// ===================================

class MobileEnhancements {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.init();
    }

    init() {
        this.setupMobileNavigation();
        this.setupTouchGestures();
        this.setupMobileOptimizations();
        this.setupResponsiveHandlers();
        this.setupMobileCart();
        this.setupMobileQuickView();
        this.setupMobileScrollEffects();
    }

    // Mobile Navigation Setup
    setupMobileNavigation() {
        // Mobile menu toggle
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
        const mobileNavClose = document.querySelector('.mobile-nav-close');
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

        if (mobileMenuToggle && mobileNavOverlay) {
            mobileMenuToggle.addEventListener('click', () => {
                this.openMobileMenu();
            });

            if (mobileNavClose) {
                mobileNavClose.addEventListener('click', () => {
                    this.closeMobileMenu();
                });
            }

            // Close menu when clicking outside
            mobileNavOverlay.addEventListener('click', (e) => {
                if (e.target === mobileNavOverlay) {
                    this.closeMobileMenu();
                }
            });

            // Close menu when clicking on links
            mobileNavLinks.forEach(link => {
                link.addEventListener('click', () => {
                    this.closeMobileMenu();
                });
            });

            // Close menu on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && mobileNavOverlay.classList.contains('active')) {
                    this.closeMobileMenu();
                }
            });
        }
    }

    openMobileMenu() {
        const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
        if (mobileNavOverlay) {
            mobileNavOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    closeMobileMenu() {
        const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
        if (mobileNavOverlay) {
            mobileNavOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    // Touch Gestures Setup
    setupTouchGestures() {
        // Swipe gestures for product cards
        const productCards = document.querySelectorAll('.product-card');
        
        productCards.forEach(card => {
            let startX = 0;
            let startY = 0;
            let currentX = 0;
            let currentY = 0;

            card.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }, { passive: true });

            card.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].clientX;
                currentY = e.touches[0].clientY;
            }, { passive: true });

            card.addEventListener('touchend', (e) => {
                const diffX = startX - currentX;
                const diffY = startY - currentY;
                
                // Horizontal swipe (for quick actions)
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                    if (diffX > 0) {
                        // Swipe left - quick view
                        this.handleQuickSwipe(card, 'left');
                    } else {
                        // Swipe right - add to cart
                        this.handleQuickSwipe(card, 'right');
                    }
                }
            }, { passive: true });
        });

        // Pull to refresh
        this.setupPullToRefresh();
    }

    handleQuickSwipe(card, direction) {
        if (direction === 'right') {
            // Add to cart on right swipe
            const addToCartBtn = card.querySelector('.add-to-cart-btn');
            if (addToCartBtn && !addToCartBtn.disabled) {
                addToCartBtn.click();
                this.showSwipeFeedback(card, 'Added to cart!');
            }
        } else if (direction === 'left') {
            // Quick view on left swipe
            const quickViewBtn = card.querySelector('.quickview-btn');
            if (quickViewBtn) {
                quickViewBtn.click();
            }
        }
    }

    showSwipeFeedback(card, message) {
        const feedback = document.createElement('div');
        feedback.className = 'swipe-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(76, 175, 80, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            z-index: 1000;
            pointer-events: none;
        `;
        
        card.style.position = 'relative';
        card.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 1500);
    }

    setupPullToRefresh() {
        let startY = 0;
        let isPulling = false;
        const pullThreshold = 80;

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (isPulling) {
                const currentY = e.touches[0].clientY;
                const diffY = currentY - startY;
                
                if (diffY > pullThreshold) {
                    this.showPullToRefreshIndicator(diffY);
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (isPulling) {
                const currentY = e.changedTouches[0].clientY;
                const diffY = currentY - startY;
                
                if (diffY > pullThreshold) {
                    this.refreshPage();
                }
                
                this.hidePullToRefreshIndicator();
                isPulling = false;
            }
        }, { passive: true });
    }

    showPullToRefreshIndicator(diffY) {
        let indicator = document.querySelector('.pull-to-refresh');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'pull-to-refresh';
            indicator.innerHTML = '<i class="fas fa-sync-alt"></i>';
            indicator.style.cssText = `
                position: fixed;
                top: -60px;
                left: 50%;
                transform: translateX(-50%);
                background: #ff6b6b;
                color: white;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                z-index: 9999;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(indicator);
        }
        
        const progress = Math.min(diffY / 120, 1);
        indicator.style.top = `${-60 + (diffY * 0.5)}px`;
        indicator.style.transform = `translateX(-50%) rotate(${360 * progress}deg)`;
    }

    hidePullToRefreshIndicator() {
        const indicator = document.querySelector('.pull-to-refresh');
        if (indicator) {
            indicator.remove();
        }
    }

    refreshPage() {
        window.location.reload();
    }

    // Mobile Optimizations
    setupMobileOptimizations() {
        // Optimize images for mobile
        this.optimizeImages();
        
        // Setup lazy loading
        this.setupLazyLoading();
        
        // Optimize fonts
        this.optimizeFonts();
        
        // Setup mobile-specific interactions
        this.setupMobileInteractions();
    }

    optimizeImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Add loading="lazy" to images
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
            
            // Optimize for mobile
            if (this.isMobile) {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            }
        });
    }

    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    optimizeFonts() {
        // Preload critical fonts
        const fontLink = document.createElement('link');
        fontLink.rel = 'preload';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
        fontLink.as = 'style';
        fontLink.onload = function() {
            this.rel = 'stylesheet';
        };
        document.head.appendChild(fontLink);
    }

    setupMobileInteractions() {
        // Add ripple effect to buttons
        const buttons = document.querySelectorAll('.btn, .add-to-cart-btn, .quick-action-btn');
        buttons.forEach(button => {
            this.addRippleEffect(button);
        });

        // Setup mobile-specific hover states
        this.setupMobileHover();
    }

    addRippleEffect(element) {
        element.addEventListener('touchstart', (e) => {
            const ripple = document.createElement('span');
            const rect = element.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.touches[0].clientX - rect.left - size / 2;
            const y = e.touches[0].clientY - rect.top - size / 2;

            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;

            element.style.position = 'relative';
            element.style.overflow = 'hidden';
            element.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        }, { passive: true });
    }

    setupMobileHover() {
        // Remove hover effects on touch devices
        if ('ontouchstart' in window) {
            document.body.classList.add('touch-device');
        }
    }

    // Responsive Handlers
    setupResponsiveHandlers() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            this.handleOrientationChange();
        });
    }

    handleResize() {
        const newIsMobile = window.innerWidth <= 768;
        
        if (newIsMobile !== this.isMobile) {
            this.isMobile = newIsMobile;
            this.updateLayoutForDevice();
        }
    }

    handleOrientationChange() {
        // Handle landscape/portrait changes
        setTimeout(() => {
            this.updateLayoutForDevice();
        }, 100);
    }

    updateLayoutForDevice() {
        // Update layout based on device type
        if (this.isMobile) {
            this.enableMobileLayout();
        } else {
            this.enableDesktopLayout();
        }
    }

    enableMobileLayout() {
        // Mobile-specific layout adjustments
        document.body.classList.add('mobile-layout');
        document.body.classList.remove('desktop-layout');
        
        // Adjust product grid
        const productGrid = document.querySelector('.product-grid');
        if (productGrid) {
            productGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        }
    }

    enableDesktopLayout() {
        // Desktop-specific layout adjustments
        document.body.classList.add('desktop-layout');
        document.body.classList.remove('mobile-layout');
        
        // Reset product grid
        const productGrid = document.querySelector('.product-grid');
        if (productGrid) {
            productGrid.style.gridTemplateColumns = '';
        }
    }

    // Mobile Cart Setup
    setupMobileCart() {
        // Mobile cart optimizations
        const cartBtn = document.querySelector('.cart-btn');
        const cartSidebar = document.querySelector('.cart-sidebar');

        if (cartBtn && cartSidebar && this.isMobile) {
            // Make cart sidebar full screen on mobile
            cartSidebar.style.width = '100%';
            cartSidebar.style.maxWidth = '100%';
        }

        // Setup mobile cart gestures
        this.setupCartGestures();
    }

    setupCartGestures() {
        const cartSidebar = document.querySelector('.cart-sidebar');
        if (!cartSidebar) return;

        let startX = 0;
        let currentX = 0;

        cartSidebar.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });

        cartSidebar.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;
            
            if (diffX > 50) {
                cartSidebar.style.transform = `translateX(${diffX}px)`;
            }
        }, { passive: true });

        cartSidebar.addEventListener('touchend', (e) => {
            const diffX = currentX - startX;
            
            if (diffX > 100) {
                // Close cart with swipe
                this.closeCart();
            } else {
                // Reset position
                cartSidebar.style.transform = '';
            }
        }, { passive: true });
    }

    closeCart() {
        const cartSidebar = document.querySelector('.cart-sidebar');
        const cartOverlay = document.querySelector('.cart-overlay');
        
        if (cartSidebar) {
            cartSidebar.classList.remove('active');
        }
        if (cartOverlay) {
            cartOverlay.classList.remove('active');
        }
    }

    // Mobile Quick View Setup
    setupMobileQuickView() {
        const quickViewOverlay = document.querySelector('.quickview-overlay');
        
        if (quickViewOverlay && this.isMobile) {
            // Make quick view full screen on mobile
            quickViewOverlay.style.padding = '0';
            
            const quickViewContent = quickViewOverlay.querySelector('.quickview-content');
            if (quickViewContent) {
                quickViewContent.style.height = '100vh';
                quickViewContent.style.borderRadius = '0';
            }
        }
    }

    // Mobile Scroll Effects
    setupMobileScrollEffects() {
        let lastScrollTop = 0;
        const header = document.querySelector('.header');
        
        if (!header) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (this.isMobile) {
                // Hide/show header on scroll
                if (scrollTop > lastScrollTop && scrollTop > 100) {
                    // Scrolling down
                    header.style.transform = 'translateY(-100%)';
                } else {
                    // Scrolling up
                    header.style.transform = 'translateY(0)';
                }
                
                lastScrollTop = scrollTop;
            }
        }, { passive: true });
    }

    // Utility Methods
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Add CSS for ripple effect
const rippleCSS = `
@keyframes ripple {
    to {
        transform: scale(4);
        opacity: 0;
    }
}

.swipe-feedback {
    animation: swipeFadeOut 1.5s ease-out;
}

@keyframes swipeFadeOut {
    0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
}

.touch-device .product-card:hover,
.touch-device .add-to-cart-btn:hover {
    transform: none;
}

.mobile-layout .header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
}

.mobile-layout .hero {
    margin-top: 60px;
}

.pull-to-refresh i {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: translateX(-50%) rotate(0deg); }
    to { transform: translateX(-50%) rotate(360deg); }
}
`;

// Inject CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = rippleCSS;
document.head.appendChild(styleSheet);

// Initialize mobile enhancements
document.addEventListener('DOMContentLoaded', () => {
    window.mobileEnhancements = new MobileEnhancements();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileEnhancements;
}
