/**
 * Admin Orders Page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeOrders();
});

let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
const ordersPerPage = 20;

function initializeOrders() {
    loadOrders();
    setupEventListeners();
}

function setupEventListeners() {
    // Refresh
    document.getElementById('refreshOrdersBtn')?.addEventListener('click', loadOrders);

    // Export
    document.getElementById('exportOrdersBtn')?.addEventListener('click', exportOrders);

    // Filters
    document.getElementById('paymentFilter')?.addEventListener('change', applyFilters);
    document.getElementById('fulfillmentFilter')?.addEventListener('change', applyFilters);
    document.getElementById('dateFilter')?.addEventListener('change', applyFilters);

    // Search
    let searchTimeout;
    document.getElementById('searchInput')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applyFilters(), 300);
    });

    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderOrders();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderOrders();
        }
    });

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

    // Sortable columns
    document.querySelectorAll('.sortable').forEach((th) => {
        th.addEventListener('click', () => sortOrders(th.dataset.sort));
    });

    // Refresh order in modal
    document.getElementById('refreshOrderBtn')?.addEventListener('click', refreshCurrentOrder);
}

async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading orders...</span>
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/admin/orders');
        const result = await response.json();

        if (result.success) {
            allOrders = result.data;
            applyFilters();
            updateStats();
        } else {
            throw new Error(result.message || 'Failed to load orders');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Failed to load orders. <button onclick="loadOrders()">Retry</button></span>
                </td>
            </tr>
        `;
        showToast('Failed to load orders', 'error');
    }
}

function applyFilters() {
    const paymentFilter = document.getElementById('paymentFilter')?.value || 'all';
    const fulfillmentFilter = document.getElementById('fulfillmentFilter')?.value || 'all';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';
    const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    filteredOrders = allOrders.filter((order) => {
        // Payment filter
        if (paymentFilter !== 'all' && order.paymentStatus !== paymentFilter) return false;

        // Fulfillment filter
        if (fulfillmentFilter !== 'all' && order.fulfillmentStatus !== fulfillmentFilter)
            return false;

        // Date filter
        if (dateFilter !== 'all') {
            const orderDate = new Date(order.createdAt);
            switch (dateFilter) {
                case 'today':
                    if (orderDate < today) return false;
                    break;
                case 'week':
                    if (orderDate < weekAgo) return false;
                    break;
                case 'month':
                    if (orderDate < monthAgo) return false;
                    break;
                case 'year':
                    if (orderDate < yearAgo) return false;
                    break;
            }
        }

        // Search
        if (searchQuery) {
            const searchable =
                `${order.orderNumber} ${order.customerName} ${order.customerEmail}`.toLowerCase();
            if (!searchable.includes(searchQuery)) return false;
        }

        return true;
    });

    currentPage = 1;
    renderOrders();
    updatePagination();
}

function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const pageOrders = filteredOrders.slice(startIndex, endIndex);

    if (pageOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <span>No orders found</span>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageOrders
        .map(
            (order) => `
        <tr data-order-id="${order._id}">
            <td class="td-order">
                <a href="#" onclick="openOrderModal('${order._id}')" class="order-link">${order.orderNumber}</a>
            </td>
            <td class="td-date">${formatDateTime(order.createdAt)}</td>
            <td class="td-customer">${order.customerName || 'N/A'}</td>
            <td class="td-email">${order.customerEmail || 'N/A'}</td>
            <td class="td-items">${order.itemCount || '-'}</td>
            <td class="td-total">$${(order.total || 0).toFixed(2)}</td>
            <td class="td-payment">
                <span class="status-badge ${getPaymentStatusClass(order.paymentStatus)}">
                    ${formatStatus(order.paymentStatus)}
                </span>
            </td>
            <td class="td-fulfillment">
                <span class="status-badge ${getFulfillmentStatusClass(order.fulfillmentStatus)}">
                    ${formatStatus(order.fulfillmentStatus)}
                </span>
            </td>
            <td class="td-printful">
                ${
                    order.printfulOrderId
                        ? `<span class="status-badge synced">PF-${order.printfulOrderId}</span>`
                        : '<span class="status-badge unsynced">-</span>'
                }
            </td>
            <td class="td-actions">
                <div class="action-buttons">
                    <button type="button" class="btn btn-icon btn-sm" onclick="openOrderModal('${order._id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${
                        order.printfulOrderId
                            ? `
                        <button type="button" class="btn btn-icon btn-sm" onclick="refreshOrder('${order._id}')" title="Refresh Status">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    `
                            : ''
                    }
                </div>
            </td>
        </tr>
    `
        )
        .join('');

    updatePagination();
}

function updateStats() {
    const totalRevenue = allOrders
        .filter((o) => o.paymentStatus === 'completed')
        .reduce((sum, o) => sum + (o.total || 0), 0);

    document.getElementById('totalOrders').textContent = allOrders.length;
    document.getElementById('pendingOrders').textContent = allOrders.filter(
        (o) => o.fulfillmentStatus === 'pending'
    ).length;
    document.getElementById('processingOrders').textContent = allOrders.filter(
        (o) => o.fulfillmentStatus === 'processing'
    ).length;
    document.getElementById('shippedOrders').textContent = allOrders.filter(
        (o) => o.fulfillmentStatus === 'shipped' || o.fulfillmentStatus === 'delivered'
    ).length;
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
}

function updatePagination() {
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage) || 1;

    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

let currentOrderId = null;

async function openOrderModal(orderId) {
    currentOrderId = orderId;
    const order = allOrders.find((o) => o._id === orderId);
    if (!order) return;

    document.getElementById('modalOrderNumber').textContent = order.orderNumber;

    // Customer info
    document.getElementById('customerInfo').innerHTML = `
        <p><strong>Name:</strong> ${order.customerName || 'N/A'}</p>
        <p><strong>Email:</strong> ${order.customerEmail || 'N/A'}</p>
        <p><strong>Phone:</strong> ${order.customerPhone || 'N/A'}</p>
    `;

    // Shipping info
    const addr = order.shippingAddress || {};
    document.getElementById('shippingInfo').innerHTML = `
        <p>${addr.line1 || ''}</p>
        ${addr.line2 ? `<p>${addr.line2}</p>` : ''}
        <p>${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}</p>
        <p>${addr.country || 'US'}</p>
    `;

    // Order items
    const itemsHtml = order.items?.length
        ? order.items
              .map(
                  (item) => `
        <div class="order-item-row">
            <img src="${item.image || '/images/placeholder.png'}" alt="${item.name}" class="order-item-thumb">
            <div class="order-item-details">
                <strong>${item.name || 'Product'}</strong>
                <span>Size: ${item.variant?.size || '-'} × ${item.quantity}</span>
            </div>
            <div class="order-item-price">$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</div>
        </div>
    `
              )
              .join('')
        : '<p>No items</p>';
    document.getElementById('orderItemsTable').innerHTML = itemsHtml;

    // Payment info
    document.getElementById('paymentInfo').innerHTML = `
        <p><strong>Status:</strong> <span class="status-badge ${getPaymentStatusClass(order.paymentStatus)}">${formatStatus(order.paymentStatus)}</span></p>
        <p><strong>Method:</strong> ${order.paymentMethod || 'Stripe'}</p>
        ${order.paidAt ? `<p><strong>Paid:</strong> ${formatDateTime(order.paidAt)}</p>` : ''}
    `;

    // Fulfillment info
    document.getElementById('fulfillmentInfo').innerHTML = `
        <p><strong>Status:</strong> <span class="status-badge ${getFulfillmentStatusClass(order.fulfillmentStatus)}">${formatStatus(order.fulfillmentStatus)}</span></p>
        ${order.printfulOrderId ? `<p><strong>Printful ID:</strong> ${order.printfulOrderId}</p>` : ''}
        ${order.printfulOrderStatus ? `<p><strong>Printful Status:</strong> ${order.printfulOrderStatus}</p>` : ''}
    `;

    // Tracking info
    const trackingSection = document.getElementById('trackingSection');
    if (order.trackingNumber) {
        trackingSection.style.display = 'block';
        document.getElementById('trackingInfo').innerHTML = `
            <p><strong>Carrier:</strong> ${order.carrier || 'N/A'}</p>
            <p><strong>Tracking #:</strong> ${order.trackingNumber}</p>
            ${order.trackingUrl ? `<a href="${order.trackingUrl}" target="_blank" class="btn btn-secondary btn-sm">Track Package</a>` : ''}
        `;
    } else {
        trackingSection.style.display = 'none';
    }

    // Order totals
    document.getElementById('orderTotals').innerHTML = `
        <div class="totals-row"><span>Subtotal:</span><span>$${(order.subtotal || 0).toFixed(2)}</span></div>
        <div class="totals-row"><span>Shipping:</span><span>$${(order.shippingCost || 0).toFixed(2)}</span></div>
        ${order.donation ? `<div class="totals-row"><span>Donation:</span><span>$${order.donation.toFixed(2)}</span></div>` : ''}
        <div class="totals-row total"><span>Total:</span><span>$${(order.total || 0).toFixed(2)}</span></div>
    `;

    openModal('orderDetailModal');
}

async function refreshCurrentOrder() {
    if (!currentOrderId) return;
    await refreshOrder(currentOrderId);

    // Reload and reopen modal
    await loadOrders();
    openOrderModal(currentOrderId);
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

function exportOrders() {
    if (filteredOrders.length === 0) {
        showToast('No orders to export', 'error');
        return;
    }

    const headers = [
        'Order #',
        'Date',
        'Customer',
        'Email',
        'Total',
        'Payment',
        'Fulfillment',
        'Printful ID',
    ];
    const rows = filteredOrders.map((o) => [
        o.orderNumber,
        formatDateTime(o.createdAt),
        o.customerName || '',
        o.customerEmail || '',
        o.total?.toFixed(2) || '0.00',
        o.paymentStatus || '',
        o.fulfillmentStatus || '',
        o.printfulOrderId || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
        '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('Orders exported', 'success');
}

function sortOrders(field) {
    const currentSort = document.querySelector(`[data-sort="${field}"]`);
    const isAsc = !currentSort.classList.contains('sort-asc');

    document.querySelectorAll('.sortable').forEach((th) => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    currentSort.classList.add(isAsc ? 'sort-asc' : 'sort-desc');

    filteredOrders.sort((a, b) => {
        let valA, valB;
        switch (field) {
            case 'orderNumber':
                valA = a.orderNumber;
                valB = b.orderNumber;
                break;
            case 'total':
                valA = a.total || 0;
                valB = b.total || 0;
                break;
            case 'date':
                valA = new Date(a.createdAt);
                valB = new Date(b.createdAt);
                break;
            default:
                return 0;
        }

        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });

    renderOrders();
}

// Utility functions
function getPaymentStatusClass(status) {
    const classes = {
        completed: 'success',
        succeeded: 'success',
        pending: 'warning',
        failed: 'danger',
        refunded: 'info',
    };
    return classes[status] || 'secondary';
}

function getFulfillmentStatusClass(status) {
    const classes = {
        delivered: 'success',
        fulfilled: 'success',
        shipped: 'info',
        processing: 'warning',
        inprocess: 'warning',
        pending: 'secondary',
        failed: 'danger',
        cancelled: 'danger',
        canceled: 'danger',
    };
    return classes[status] || 'secondary';
}

function formatStatus(status) {
    if (!status) return 'N/A';
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
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
window.openOrderModal = openOrderModal;
window.refreshOrder = refreshOrder;
