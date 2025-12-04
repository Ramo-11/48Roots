/**
 * Admin Dashboard JavaScript
 * Handles Printful sync, product management, and order management
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAdmin();
});

let products = [];
let orders = [];

function initializeAdmin() {
    loadSyncStatus();
    loadProducts();
    loadOrders();
    setupEventListeners();
}

function setupEventListeners() {
    // Sync button
    const syncBtn = document.getElementById('syncProductsBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncProducts);
    }

    // Product filter
    const productFilter = document.getElementById('productFilter');
    if (productFilter) {
        productFilter.addEventListener('change', () => {
            renderProducts(products);
        });
    }

    // Edit product form
    const editForm = document.getElementById('editProductForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditProduct);
    }

    // Delete confirm button
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteProduct);
    }

    // Modal dismiss buttons
    document.querySelectorAll('[data-dismiss="modal"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });
    });

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach((modal) => {
                closeModal(modal.id);
            });
        }
    });
}

async function loadSyncStatus() {
    try {
        const response = await fetch('/api/admin/printful/status');
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            // Update status badge
            const statusEl = document.getElementById('printfulStatus');
            if (statusEl) {
                const badgeClass = data.printfulConnected ? 'connected' : 'disconnected';
                const badgeText = data.printfulConnected
                    ? `Connected${data.storeName ? ` - ${data.storeName}` : ''}`
                    : 'Disconnected';
                statusEl.innerHTML = `<span class="status-badge ${badgeClass}">${badgeText}</span>`;
            }

            // Update stats
            updateStatValue('totalProducts', data.localProducts);
            updateStatValue('syncedProducts', data.syncedProducts);
            updateStatValue('printfulOrders', data.printfulOrders);

            // Update last sync
            if (data.lastSync) {
                const lastSyncEl = document.getElementById('lastSyncInfo');
                const lastSyncTime = document.getElementById('lastSyncTime');
                if (lastSyncEl && lastSyncTime) {
                    lastSyncTime.textContent = formatDate(data.lastSync);
                    lastSyncEl.style.display = 'flex';
                }
            }
        }
    } catch (error) {
        console.error('Error loading sync status:', error);
        showToast('Failed to load sync status', 'error');
    }
}

function updateStatValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value !== undefined && value !== null ? value : '-';
    }
}

async function loadProducts() {
    try {
        const response = await fetch('/api/admin/products');
        const result = await response.json();

        if (result.success) {
            products = result.data;
            renderProducts(products);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Failed to load products', 'error');
    }
}

function renderProducts(productList) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    // Apply filter
    const filter = document.getElementById('productFilter')?.value || 'all';
    let filtered = [...productList];

    switch (filter) {
        case 'synced':
            filtered = filtered.filter((p) => p.isSynced);
            break;
        case 'unsynced':
            filtered = filtered.filter((p) => !p.isSynced);
            break;
        case 'active':
            filtered = filtered.filter((p) => p.isActive);
            break;
        case 'inactive':
            filtered = filtered.filter((p) => !p.isActive);
            break;
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>No products found</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered
        .map(
            (product) => `
        <div class="product-card" data-product-id="${product._id}">
            <div class="product-card-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy">
                <div class="product-card-badges">
                    ${product.isSynced ? '<span class="product-badge synced">Synced</span>' : '<span class="product-badge unsynced">Not Synced</span>'}
                    ${product.isFeatured ? '<span class="product-badge featured">Featured</span>' : ''}
                    ${!product.isActive ? '<span class="product-badge inactive">Inactive</span>' : ''}
                </div>
            </div>
            <div class="product-card-body">
                <div class="product-card-name" title="${product.name}">${product.name}</div>
                <div class="product-card-meta">
                    <span class="product-card-price">$${product.price.toFixed(2)}</span>
                    <span class="product-card-category">${product.category}</span>
                </div>
                <div class="product-card-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openEditModal('${product._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm btn-icon" onclick="toggleActive('${product._id}')" title="${product.isActive ? 'Deactivate' : 'Activate'}">
                        <i class="fas ${product.isActive ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm btn-icon" onclick="toggleFeatured('${product._id}')" title="${product.isFeatured ? 'Unfeature' : 'Feature'}">
                        <i class="fas ${product.isFeatured ? 'fa-star' : 'fa-star'}"></i>
                    </button>
                    <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="openDeleteModal('${product._id}', '${product.name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `
        )
        .join('');
}

async function loadOrders() {
    try {
        const response = await fetch('/api/admin/orders');
        const result = await response.json();

        if (result.success) {
            orders = result.data;
            renderOrders(orders);
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrders(orderList) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (orderList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <span>No orders yet</span>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orderList
        .map(
            (order) => `
        <tr>
            <td><span class="order-number">${order.orderNumber}</span></td>
            <td>
                <div class="order-customer">
                    <span class="order-customer-name">${order.customerName || 'N/A'}</span>
                    <span class="order-customer-email">${order.customerEmail || ''}</span>
                </div>
            </td>
            <td>$${order.total?.toFixed(2) || '0.00'}</td>
            <td><span class="status-badge ${getPaymentStatusClass(order.paymentStatus)}">${order.paymentStatus || 'unknown'}</span></td>
            <td><span class="status-badge ${getFulfillmentStatusClass(order.fulfillmentStatus)}">${order.fulfillmentStatus || 'pending'}</span></td>
            <td>${formatDate(order.createdAt)}</td>
            <td>
                ${
                    order.printfulOrderId
                        ? `<button type="button" class="btn btn-secondary btn-sm" onclick="refreshOrder('${order._id}')">
                        <i class="fas fa-sync-alt"></i>
                    </button>`
                        : '-'
                }
            </td>
        </tr>
    `
        )
        .join('');
}

function getPaymentStatusClass(status) {
    switch (status) {
        case 'paid':
        case 'succeeded':
            return 'delivered';
        case 'pending':
            return 'pending';
        case 'failed':
            return 'failed';
        default:
            return 'pending';
    }
}

function getFulfillmentStatusClass(status) {
    switch (status) {
        case 'delivered':
        case 'fulfilled':
            return 'delivered';
        case 'shipped':
            return 'shipped';
        case 'processing':
        case 'inprocess':
            return 'processing';
        case 'failed':
        case 'canceled':
            return 'failed';
        default:
            return 'pending';
    }
}

async function syncProducts() {
    openModal('syncProgressModal');

    const messageEl = document.getElementById('syncMessage');
    const logEl = document.getElementById('syncLog');
    const footerEl = document.getElementById('syncModalFooter');

    messageEl.textContent = 'Connecting to Printful...';
    logEl.innerHTML = '';
    footerEl.style.display = 'none';

    try {
        const response = await fetch('/api/admin/printful/sync', {
            method: 'POST',
        });

        const result = await response.json();

        if (result.success) {
            messageEl.textContent = 'Sync completed!';

            // Show log entries
            if (result.data?.products) {
                result.data.products.forEach((p) => {
                    const entryClass = p.action === 'error' ? 'error' : 'success';
                    const icon =
                        p.action === 'error'
                            ? 'fa-times-circle'
                            : p.action === 'created'
                              ? 'fa-plus-circle'
                              : 'fa-check-circle';
                    logEl.innerHTML += `
                        <div class="sync-log-entry ${entryClass}">
                            <i class="fas ${icon}"></i>
                            <span>${p.name} - ${p.action}${p.error ? `: ${p.error}` : ''}</span>
                        </div>
                    `;
                });
            }

            // Summary
            logEl.innerHTML += `
                <div class="sync-log-entry info">
                    <i class="fas fa-info-circle"></i>
                    <span>Total: ${result.data?.total || 0}, Created: ${result.data?.created || 0}, Updated: ${result.data?.updated || 0}, Errors: ${result.data?.errors || 0}</span>
                </div>
            `;

            showToast('Products synced successfully', 'success');

            // Reload data
            await loadSyncStatus();
            await loadProducts();
        } else {
            messageEl.textContent = 'Sync failed';
            logEl.innerHTML = `<div class="sync-log-entry error"><i class="fas fa-times-circle"></i> ${result.message || 'Unknown error'}</div>`;
            showToast(result.message || 'Sync failed', 'error');
        }
    } catch (error) {
        messageEl.textContent = 'Sync failed';
        logEl.innerHTML = `<div class="sync-log-entry error"><i class="fas fa-times-circle"></i> ${error.message}</div>`;
        showToast('Sync failed: ' + error.message, 'error');
    }

    // Update spinner to checkmark
    document.querySelector('.sync-spinner').innerHTML = '<i class="fas fa-check-circle"></i>';
    footerEl.style.display = 'flex';
}

function openEditModal(productId) {
    const product = products.find((p) => p._id === productId);
    if (!product) return;

    document.getElementById('editProductId').value = product._id;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductPrice').value = product.price;
    document.getElementById('editProductCategory').value = product.category || 'other';
    document.getElementById('editProductDescription').value = product.description || '';
    document.getElementById('editProductActive').checked = product.isActive;
    document.getElementById('editProductFeatured').checked = product.isFeatured;

    openModal('editProductModal');
}

async function handleEditProduct(e) {
    e.preventDefault();

    const productId = document.getElementById('editProductId').value;
    const data = {
        name: document.getElementById('editProductName').value,
        price: parseFloat(document.getElementById('editProductPrice').value),
        category: document.getElementById('editProductCategory').value,
        description: document.getElementById('editProductDescription').value,
        isActive: document.getElementById('editProductActive').checked,
        isFeatured: document.getElementById('editProductFeatured').checked,
    };

    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
            showToast('Product updated successfully', 'success');
            closeModal('editProductModal');
            await loadProducts();
        } else {
            showToast(result.message || 'Failed to update product', 'error');
        }
    } catch (error) {
        showToast('Error updating product', 'error');
    }
}

function openDeleteModal(productId, productName) {
    document.getElementById('deleteProductId').value = productId;
    document.getElementById('deleteProductName').textContent = productName;
    openModal('deleteConfirmModal');
}

async function handleDeleteProduct() {
    const productId = document.getElementById('deleteProductId').value;

    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (result.success) {
            showToast('Product deleted', 'success');
            closeModal('deleteConfirmModal');
            await loadProducts();
            await loadSyncStatus();
        } else {
            showToast(result.message || 'Failed to delete product', 'error');
        }
    } catch (error) {
        showToast('Error deleting product', 'error');
    }
}

async function toggleActive(productId) {
    try {
        const response = await fetch(`/api/admin/products/${productId}/toggle-active`, {
            method: 'PUT',
        });

        const result = await response.json();

        if (result.success) {
            const product = products.find((p) => p._id === productId);
            if (product) {
                product.isActive = result.data.isActive;
                renderProducts(products);
            }
            showToast(`Product ${result.data.isActive ? 'activated' : 'deactivated'}`, 'success');
        } else {
            showToast(result.message || 'Failed to update product', 'error');
        }
    } catch (error) {
        showToast('Error updating product', 'error');
    }
}

async function toggleFeatured(productId) {
    try {
        const response = await fetch(`/api/admin/products/${productId}/toggle-featured`, {
            method: 'PUT',
        });

        const result = await response.json();

        if (result.success) {
            const product = products.find((p) => p._id === productId);
            if (product) {
                product.isFeatured = result.data.isFeatured;
                renderProducts(products);
            }
            showToast(`Product ${result.data.isFeatured ? 'featured' : 'unfeatured'}`, 'success');
        } else {
            showToast(result.message || 'Failed to update product', 'error');
        }
    } catch (error) {
        showToast('Error updating product', 'error');
    }
}

async function refreshOrder(orderId) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/refresh`, {
            method: 'POST',
        });

        const result = await response.json();

        if (result.success) {
            showToast('Order status refreshed', 'success');
            await loadOrders();
        } else {
            showToast(result.message || 'Failed to refresh order', 'error');
        }
    } catch (error) {
        showToast('Error refreshing order', 'error');
    }
}

// Modal helpers
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

        // Reset sync modal state
        if (modalId === 'syncProgressModal') {
            document.querySelector('.sync-spinner').innerHTML =
                '<i class="fas fa-sync-alt fa-spin"></i>';
        }
    }
}

// Toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
    };

    toast.innerHTML = `
        <i class="fas ${iconMap[type] || iconMap.info} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button type="button" class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Date formatter
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) {
            const minutes = Math.floor(diff / 60000);
            return minutes <= 1 ? 'Just now' : `${minutes} min ago`;
        }
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return days === 1 ? 'Yesterday' : `${days} days ago`;
    }

    // Default format
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
}

// Make functions globally available
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
window.toggleActive = toggleActive;
window.toggleFeatured = toggleFeatured;
window.refreshOrder = refreshOrder;
