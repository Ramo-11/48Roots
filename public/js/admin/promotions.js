/**
 * Admin Promotions Page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    initializePromotions();
});

let allPromotions = [];
let filteredPromotions = [];
let availableProducts = [];

function initializePromotions() {
    loadPromotions();
    loadProducts();
    setupEventListeners();
}

function setupEventListeners() {
    // Create button
    document.getElementById('createPromotionBtn')?.addEventListener('click', () => openPromotionModal());

    // Filters
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('typeFilter')?.addEventListener('change', applyFilters);
    document.getElementById('scopeFilter')?.addEventListener('change', applyFilters);

    // Form submission
    document.getElementById('promotionForm')?.addEventListener('submit', handleSavePromotion);

    // Delete confirm
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleDeletePromotion);

    // Type change (show/hide value input)
    document.getElementById('promotionType')?.addEventListener('change', handleTypeChange);

    // Scope change (show/hide product/category selection)
    document.getElementById('promotionScope')?.addEventListener('change', handleScopeChange);

    // Show banner toggle
    document.getElementById('showBanner')?.addEventListener('change', handleBannerToggle);

    // Banner preview updates
    document.getElementById('bannerText')?.addEventListener('input', updateBannerPreview);
    document.getElementById('bannerColor')?.addEventListener('input', updateBannerPreview);

    // Modal dismiss
    document.querySelectorAll('[data-dismiss="modal"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach((modal) => {
                closeModal(modal.id);
            });
        }
    });
}

async function loadPromotions() {
    const tbody = document.getElementById('promotionsTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading promotions...</span>
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/admin/promotions');
        const result = await response.json();

        if (result.success) {
            allPromotions = result.data;
            applyFilters();
            updateStats();
        } else {
            throw new Error(result.message || 'Failed to load promotions');
        }
    } catch (error) {
        console.error('Error loading promotions:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Failed to load promotions. <button onclick="loadPromotions()">Retry</button></span>
                </td>
            </tr>
        `;
        showToast('Failed to load promotions', 'error');
    }
}

async function loadProducts() {
    try {
        const response = await fetch('/api/admin/promotions/products');
        const result = await response.json();

        if (result.success) {
            availableProducts = result.data;
            renderProductSelect();
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProductSelect() {
    const container = document.getElementById('productSelectContainer');
    if (!container) return;

    if (availableProducts.length === 0) {
        container.innerHTML = '<p class="text-muted">No products available</p>';
        return;
    }

    container.innerHTML = availableProducts
        .map(
            (p) => `
        <label class="product-select-item">
            <input type="checkbox" name="products" value="${p._id}" />
            <img src="${p.image}" alt="${p.name}" />
            <div class="product-select-info">
                <span class="product-select-name">${p.name}</span>
                <span class="product-select-price">$${p.price.toFixed(2)}</span>
            </div>
        </label>
    `
        )
        .join('');
}

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const scopeFilter = document.getElementById('scopeFilter')?.value || 'all';

    const now = new Date();

    filteredPromotions = allPromotions.filter((promo) => {
        const validFrom = new Date(promo.validFrom);
        const validUntil = new Date(promo.validUntil);
        const isActiveNow = promo.isActive && now >= validFrom && now <= validUntil;
        const isScheduled = promo.isActive && now < validFrom;
        const isExpired = now > validUntil;

        // Status filter
        if (statusFilter === 'active' && !isActiveNow) return false;
        if (statusFilter === 'scheduled' && !isScheduled) return false;
        if (statusFilter === 'expired' && !isExpired) return false;
        if (statusFilter === 'disabled' && promo.isActive) return false;

        // Type filter
        if (typeFilter !== 'all' && promo.type !== typeFilter) return false;

        // Scope filter
        if (scopeFilter !== 'all' && promo.scope !== scopeFilter) return false;

        return true;
    });

    renderPromotions(filteredPromotions);
}

function renderPromotions(promotions) {
    const tbody = document.getElementById('promotionsTableBody');

    if (promotions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-tags"></i>
                    <span>No promotions found</span>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = promotions
        .map((promo) => {
            const status = getPromotionStatus(promo);
            return `
            <tr data-promotion-id="${promo._id}">
                <td class="td-name">
                    <div class="promo-name-cell">
                        <strong>${promo.name}</strong>
                        <span class="promo-description">${promo.description}</span>
                    </div>
                </td>
                <td class="td-code">
                    ${promo.code ? `<code class="promo-code">${promo.code}</code>` : '<span class="text-muted">-</span>'}
                    ${promo.autoApply ? '<span class="badge badge-auto">Auto</span>' : ''}
                </td>
                <td class="td-type">${formatType(promo.type)}</td>
                <td class="td-value">${formatValue(promo.type, promo.value)}</td>
                <td class="td-scope">${formatScope(promo)}</td>
                <td class="td-validity">
                    <div class="validity-dates">
                        <span>${formatDate(promo.validFrom)}</span>
                        <span>to</span>
                        <span>${formatDate(promo.validUntil)}</span>
                    </div>
                </td>
                <td class="td-status">
                    <span class="status-badge ${status.class}">${status.label}</span>
                </td>
                <td class="td-banner">
                    ${promo.showBanner ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-muted"></i>'}
                </td>
                <td class="td-actions">
                    <div class="action-buttons">
                        <button type="button" class="btn btn-icon btn-sm" onclick="openPromotionModal('${promo._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-icon btn-sm" onclick="toggleActive('${promo._id}')" title="${promo.isActive ? 'Disable' : 'Enable'}">
                            <i class="fas ${promo.isActive ? 'fa-toggle-on text-success' : 'fa-toggle-off text-muted'}"></i>
                        </button>
                        <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="openDeleteModal('${promo._id}', '${promo.name.replace(/'/g, "\\'")}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        })
        .join('');
}

function updateStats() {
    const now = new Date();

    const active = allPromotions.filter((p) => {
        const validFrom = new Date(p.validFrom);
        const validUntil = new Date(p.validUntil);
        return p.isActive && now >= validFrom && now <= validUntil;
    }).length;

    const scheduled = allPromotions.filter((p) => {
        const validFrom = new Date(p.validFrom);
        return p.isActive && now < validFrom;
    }).length;

    const expired = allPromotions.filter((p) => {
        const validUntil = new Date(p.validUntil);
        return now > validUntil;
    }).length;

    document.getElementById('totalPromotions').textContent = allPromotions.length;
    document.getElementById('activePromotions').textContent = active;
    document.getElementById('scheduledPromotions').textContent = scheduled;
    document.getElementById('expiredPromotions').textContent = expired;
}

function getPromotionStatus(promo) {
    const now = new Date();
    const validFrom = new Date(promo.validFrom);
    const validUntil = new Date(promo.validUntil);

    if (!promo.isActive) {
        return { label: 'Disabled', class: 'disabled' };
    }
    if (now < validFrom) {
        return { label: 'Scheduled', class: 'scheduled' };
    }
    if (now > validUntil) {
        return { label: 'Expired', class: 'expired' };
    }
    return { label: 'Active', class: 'active' };
}

function openPromotionModal(promotionId = null) {
    const modal = document.getElementById('promotionModal');
    const title = document.getElementById('promotionModalTitle');
    const form = document.getElementById('promotionForm');

    // Reset form
    form.reset();
    document.getElementById('promotionId').value = '';

    // Reset visibility
    document.getElementById('productsSelectGroup').style.display = 'none';
    document.getElementById('categoriesSelectGroup').style.display = 'none';
    document.getElementById('bannerOptions').style.display = 'none';
    document.getElementById('valueGroup').style.display = '';

    // Uncheck all product/category checkboxes
    document.querySelectorAll('input[name="products"]').forEach((cb) => (cb.checked = false));
    document.querySelectorAll('input[name="categories"]').forEach((cb) => (cb.checked = false));

    // Set default dates
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    document.getElementById('validFrom').value = formatDateTimeLocal(now);
    document.getElementById('validUntil').value = formatDateTimeLocal(nextWeek);

    if (promotionId) {
        const promo = allPromotions.find((p) => p._id === promotionId);
        if (promo) {
            title.textContent = 'Edit Promotion';
            populateForm(promo);
        }
    } else {
        title.textContent = 'Create Promotion';
    }

    handleTypeChange();
    updateBannerPreview();
    openModal('promotionModal');
}

function populateForm(promo) {
    document.getElementById('promotionId').value = promo._id;
    document.getElementById('promotionName').value = promo.name;
    document.getElementById('promotionCode').value = promo.code || '';
    document.getElementById('promotionDescription').value = promo.description;
    document.getElementById('promotionType').value = promo.type;
    document.getElementById('promotionValue').value = promo.value;
    document.getElementById('promotionScope').value = promo.scope;
    document.getElementById('minPurchase').value = promo.minPurchaseAmount || 0;
    document.getElementById('maxDiscount').value = promo.maxDiscountAmount || '';
    document.getElementById('validFrom').value = formatDateTimeLocal(new Date(promo.validFrom));
    document.getElementById('validUntil').value = formatDateTimeLocal(new Date(promo.validUntil));
    document.getElementById('autoApply').checked = promo.autoApply;
    document.getElementById('showBanner').checked = promo.showBanner;
    document.getElementById('bannerText').value = promo.bannerText || '';
    document.getElementById('bannerColor').value = promo.bannerColor || '#c41e3a';
    document.getElementById('usageLimitTotal').value = promo.usageLimit?.total || '';
    document.getElementById('usageLimitPerCustomer').value = promo.usageLimit?.perCustomer || 1;
    document.getElementById('priority').value = promo.priority || 0;

    // Handle scope-specific selections
    handleScopeChange();

    if (promo.scope === 'products' && promo.applicableProducts) {
        const productIds = promo.applicableProducts.map((p) => p._id || p);
        document.querySelectorAll('input[name="products"]').forEach((cb) => {
            cb.checked = productIds.includes(cb.value);
        });
    }

    if (promo.scope === 'categories' && promo.applicableCategories) {
        document.querySelectorAll('input[name="categories"]').forEach((cb) => {
            cb.checked = promo.applicableCategories.includes(cb.value);
        });
    }

    handleBannerToggle();
}

function handleTypeChange() {
    const type = document.getElementById('promotionType').value;
    const valueGroup = document.getElementById('valueGroup');
    const valuePrefix = document.getElementById('valuePrefix');

    if (type === 'free_shipping') {
        valueGroup.style.display = 'none';
        document.getElementById('promotionValue').value = 0;
    } else {
        valueGroup.style.display = '';
        valuePrefix.textContent = type === 'percentage' ? '%' : '$';
    }
}

function handleScopeChange() {
    const scope = document.getElementById('promotionScope').value;
    document.getElementById('productsSelectGroup').style.display = scope === 'products' ? '' : 'none';
    document.getElementById('categoriesSelectGroup').style.display = scope === 'categories' ? '' : 'none';
}

function handleBannerToggle() {
    const showBanner = document.getElementById('showBanner').checked;
    document.getElementById('bannerOptions').style.display = showBanner ? '' : 'none';
    if (showBanner) {
        updateBannerPreview();
    }
}

function updateBannerPreview() {
    const text = document.getElementById('bannerText').value || 'Banner Preview';
    const color = document.getElementById('bannerColor').value || '#c41e3a';
    const preview = document.getElementById('bannerPreview');
    const previewText = document.getElementById('bannerPreviewText');

    preview.style.backgroundColor = color;
    previewText.textContent = text;
}

async function handleSavePromotion(e) {
    e.preventDefault();

    const promotionId = document.getElementById('promotionId').value;
    const isEdit = !!promotionId;

    const data = {
        name: document.getElementById('promotionName').value,
        code: document.getElementById('promotionCode').value || undefined,
        description: document.getElementById('promotionDescription').value,
        type: document.getElementById('promotionType').value,
        value: parseFloat(document.getElementById('promotionValue').value) || 0,
        scope: document.getElementById('promotionScope').value,
        minPurchaseAmount: parseFloat(document.getElementById('minPurchase').value) || 0,
        maxDiscountAmount: parseFloat(document.getElementById('maxDiscount').value) || undefined,
        validFrom: document.getElementById('validFrom').value,
        validUntil: document.getElementById('validUntil').value,
        autoApply: document.getElementById('autoApply').checked,
        showBanner: document.getElementById('showBanner').checked,
        bannerText: document.getElementById('bannerText').value,
        bannerColor: document.getElementById('bannerColor').value,
        usageLimit: {
            total: parseInt(document.getElementById('usageLimitTotal').value) || undefined,
            perCustomer: parseInt(document.getElementById('usageLimitPerCustomer').value) || 1,
        },
        priority: parseInt(document.getElementById('priority').value) || 0,
    };

    // Get selected products
    if (data.scope === 'products') {
        data.applicableProducts = Array.from(document.querySelectorAll('input[name="products"]:checked')).map(
            (cb) => cb.value
        );
    }

    // Get selected categories
    if (data.scope === 'categories') {
        data.applicableCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(
            (cb) => cb.value
        );
    }

    try {
        const url = isEdit ? `/api/admin/promotions/${promotionId}` : '/api/admin/promotions';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
            showToast(`Promotion ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            closeModal('promotionModal');
            await loadPromotions();
        } else {
            showToast(result.message || 'Failed to save promotion', 'error');
        }
    } catch (error) {
        showToast('Error saving promotion', 'error');
    }
}

function openDeleteModal(promotionId, promotionName) {
    document.getElementById('deletePromotionId').value = promotionId;
    document.getElementById('deletePromotionName').textContent = promotionName;
    openModal('deleteConfirmModal');
}

async function handleDeletePromotion() {
    const promotionId = document.getElementById('deletePromotionId').value;

    try {
        const response = await fetch(`/api/admin/promotions/${promotionId}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (result.success) {
            showToast('Promotion deleted', 'success');
            closeModal('deleteConfirmModal');
            await loadPromotions();
        } else {
            showToast(result.message || 'Failed to delete promotion', 'error');
        }
    } catch (error) {
        showToast('Error deleting promotion', 'error');
    }
}

async function toggleActive(promotionId) {
    try {
        const response = await fetch(`/api/admin/promotions/${promotionId}/toggle-active`, {
            method: 'PUT',
        });

        const result = await response.json();

        if (result.success) {
            const promo = allPromotions.find((p) => p._id === promotionId);
            if (promo) promo.isActive = result.data.isActive;
            applyFilters();
            updateStats();
            showToast(`Promotion ${result.data.isActive ? 'enabled' : 'disabled'}`, 'success');
        } else {
            showToast(result.message || 'Failed to update promotion', 'error');
        }
    } catch (error) {
        showToast('Error updating promotion', 'error');
    }
}

// Utility functions
function formatType(type) {
    const types = {
        percentage: 'Percentage',
        fixed: 'Fixed Amount',
        free_shipping: 'Free Shipping',
    };
    return types[type] || type;
}

function formatValue(type, value) {
    if (type === 'percentage') return `${value}%`;
    if (type === 'fixed') return `$${value.toFixed(2)}`;
    if (type === 'free_shipping') return 'Free';
    return value;
}

function formatScope(promo) {
    if (promo.scope === 'global') return 'All Products';
    if (promo.scope === 'products') {
        const count = promo.applicableProducts?.length || 0;
        return `${count} product${count !== 1 ? 's' : ''}`;
    }
    if (promo.scope === 'categories') {
        const count = promo.applicableCategories?.length || 0;
        return `${count} categor${count !== 1 ? 'ies' : 'y'}`;
    }
    return promo.scope;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
    };

    toast.innerHTML = `
        <i class="fas ${iconMap[type] || iconMap.info} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button type="button" class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// Make functions globally available
window.openPromotionModal = openPromotionModal;
window.openDeleteModal = openDeleteModal;
window.toggleActive = toggleActive;
