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

document.addEventListener('DOMContentLoaded', () => {
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
