const Common = {
    showNotification(message, type = 'info', duration = 5000) {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach((n) => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'notificationSlideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    async apiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return { success: true, data };
        } catch (error) {
            console.error('API call error:', error);
            return { success: false, error: error.message };
        }
    },

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    validatePhone(phone) {
        const phoneRegex = /^[\d\s\-\(\)\+]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    },

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(new Date(date));
    },

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
    },

    showLoading(button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<span class="loading"></span>';
    },

    hideLoading(button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Submit';
    },

    validateForm(formId) {
        const form = document.getElementById(formId);
        if (!form) return false;

        const inputs = form.querySelectorAll('[required]');
        let isValid = true;

        inputs.forEach((input) => {
            const errorElement = input.parentElement.querySelector('.form-error');

            if (!input.value.trim()) {
                input.classList.add('error');
                if (errorElement) {
                    errorElement.textContent = 'This field is required';
                }
                isValid = false;
            } else {
                input.classList.remove('error');
                if (errorElement) {
                    errorElement.textContent = '';
                }

                if (input.type === 'email' && !this.validateEmail(input.value)) {
                    input.classList.add('error');
                    if (errorElement) {
                        errorElement.textContent = 'Please enter a valid email';
                    }
                    isValid = false;
                }

                if (input.type === 'tel' && !this.validatePhone(input.value)) {
                    input.classList.add('error');
                    if (errorElement) {
                        errorElement.textContent = 'Please enter a valid phone number';
                    }
                    isValid = false;
                }
            }
        });

        return isValid;
    },

    clearFormErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
        form.querySelectorAll('.form-error').forEach((el) => (el.textContent = ''));
    },

    localStorage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
        },

        get(key) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (error) {
                console.error('Error reading from localStorage:', error);
                return null;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error('Error removing from localStorage:', error);
            }
        },

        clear() {
            try {
                localStorage.clear();
            } catch (error) {
                console.error('Error clearing localStorage:', error);
            }
        },
    },

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },
};

// Promotion banner functionality
async function loadPromotionBanners() {
    const container = document.getElementById('promoBannerContainer');
    if (!container) return;

    // Check if banner was dismissed in this session
    const dismissedBanners = JSON.parse(sessionStorage.getItem('dismissedBanners') || '[]');

    try {
        const response = await fetch('/api/promotions/banners');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            // Filter out dismissed banners
            const activeBanners = result.data.filter(b => !dismissedBanners.includes(b._id));

            if (activeBanners.length > 0) {
                // Show the first/highest priority banner
                const banner = activeBanners[0];
                container.innerHTML = `
                    <div class="promo-banner" style="background-color: ${banner.color}" data-banner-id="${banner._id}">
                        <div class="promo-banner-content">
                            <span class="promo-banner-text">${banner.text}</span>
                            ${banner.code ? `<span class="promo-banner-code">Use code: <strong>${banner.code}</strong></span>` : ''}
                        </div>
                        <button class="promo-banner-close" onclick="dismissPromoBanner('${banner._id}')" aria-label="Dismiss">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading promotion banners:', error);
    }
}

function dismissPromoBanner(bannerId) {
    const container = document.getElementById('promoBannerContainer');
    if (container) {
        container.innerHTML = '';
    }

    // Store in session so it doesn't show again until page refresh
    const dismissed = JSON.parse(sessionStorage.getItem('dismissedBanners') || '[]');
    if (!dismissed.includes(bannerId)) {
        dismissed.push(bannerId);
        sessionStorage.setItem('dismissedBanners', JSON.stringify(dismissed));
    }
}

// Make dismissPromoBanner globally available
window.dismissPromoBanner = dismissPromoBanner;

// Analytics tracking
const Analytics = {
    // Generate or retrieve visitor ID
    getVisitorId() {
        let visitorId = localStorage.getItem('visitorId');
        if (!visitorId) {
            visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            localStorage.setItem('visitorId', visitorId);
        }
        return visitorId;
    },

    // Generate or retrieve session ID
    getSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 's_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    },

    // Track generic event
    async track(eventType, data = {}) {
        // Skip tracking on admin pages
        if (window.location.pathname.startsWith('/admin')) return;

        try {
            await fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventType,
                    visitorId: this.getVisitorId(),
                    sessionId: this.getSessionId(),
                    page: window.location.pathname,
                    referrer: document.referrer,
                    ...data,
                }),
            });
        } catch (error) {
            // Silently fail - analytics should not break the site
            console.debug('Analytics track error:', error);
        }
    },

    // Track page view
    async trackPageView() {
        if (window.location.pathname.startsWith('/admin')) return;

        try {
            await fetch('/api/analytics/pageview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitorId: this.getVisitorId(),
                    sessionId: this.getSessionId(),
                    page: window.location.pathname,
                    referrer: document.referrer,
                }),
            });
        } catch (error) {
            console.debug('Analytics pageview error:', error);
        }
    },

    // Track product view
    async trackProductView(product) {
        try {
            await fetch('/api/analytics/product-view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitorId: this.getVisitorId(),
                    sessionId: this.getSessionId(),
                    productId: product._id || product.id,
                    productName: product.name,
                    productCategory: product.category,
                    productPrice: product.price,
                }),
            });
        } catch (error) {
            console.debug('Analytics product view error:', error);
        }
    },

    // Track add to cart
    trackAddToCart(product, quantity = 1) {
        this.track('add_to_cart', {
            productId: product._id || product.id,
            productName: product.name,
            productCategory: product.category,
            productPrice: product.price,
            quantity,
        });
    },

    // Track search
    trackSearch(query, resultsCount) {
        this.track('search', {
            searchQuery: query,
            searchResultsCount: resultsCount,
        });
    },

    // Track checkout completion
    trackCheckoutCompleted(order) {
        this.track('checkout_completed', {
            orderId: order._id || order.id,
            orderNumber: order.orderNumber,
            orderTotal: order.total,
        });
    },

    // Track promotion applied
    trackPromotionApplied(code, discountAmount) {
        this.track('promotion_applied', {
            promotionCode: code,
            discountAmount,
        });
    },
};

// Expose Analytics globally
window.Analytics = Analytics;

document.addEventListener('DOMContentLoaded', () => {
    // Track page view on load
    Analytics.trackPageView();

    // Load promotion banners
    loadPromotionBanners();

    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                Common.closeModal(modal.id);
            }
        });

        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                Common.closeModal(modal.id);
            });
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach((modal) => {
                Common.closeModal(modal.id);
            });
        }
    });
});

window.Common = Common;
