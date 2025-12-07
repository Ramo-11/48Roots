/**
 * Admin Products Page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeProducts();
});

let allProducts = [];
let filteredProducts = [];

function initializeProducts() {
    loadProducts();
    setupEventListeners();
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshProductsBtn')?.addEventListener('click', loadProducts);

    // Sync button
    document.getElementById('syncProductsBtn')?.addEventListener('click', syncProducts);

    // Filters
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('syncFilter')?.addEventListener('change', applyFilters);
    document.getElementById('categoryFilter')?.addEventListener('change', applyFilters);

    // Search
    let searchTimeout;
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applyFilters(), 300);
    });

    // Edit form
    document.getElementById('editProductForm')?.addEventListener('submit', handleEditProduct);

    // Delete confirm
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleDeleteProduct);

    // Modal dismiss
    document.querySelectorAll('[data-dismiss="modal"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach((modal) => {
                closeModal(modal.id);
            });
        }
    });

    // Sortable columns
    document.querySelectorAll('.sortable').forEach((th) => {
        th.addEventListener('click', () => sortProducts(th.dataset.sort));
    });
}

async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading products...</span>
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/admin/products');
        const result = await response.json();

        if (result.success) {
            allProducts = result.data;
            applyFilters();
            updateStats();
        } else {
            throw new Error(result.message || 'Failed to load products');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Failed to load products. <button onclick="loadProducts()">Retry</button></span>
                </td>
            </tr>
        `;
        showToast('Failed to load products', 'error');
    }
}

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const syncFilter = document.getElementById('syncFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

    filteredProducts = allProducts.filter((product) => {
        // Status filter
        if (statusFilter === 'active' && !product.isActive) return false;
        if (statusFilter === 'inactive' && product.isActive) return false;

        // Sync filter
        if (syncFilter === 'synced' && !product.isSynced) return false;
        if (syncFilter === 'unsynced' && product.isSynced) return false;

        // Category filter
        if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;

        // Search
        if (searchQuery) {
            const searchable = `${product.name} ${product.category} ${product.slug}`.toLowerCase();
            if (!searchable.includes(searchQuery)) return false;
        }

        return true;
    });

    renderProducts(filteredProducts);
}

function renderProducts(products) {
    const tbody = document.getElementById('productsTableBody');

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <span>No products found</span>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = products
        .map(
            (product) => `
        <tr data-product-id="${product._id}">
            <td class="td-image">
                <img src="${product.image || '/images/placeholder.png'}" alt="${product.name}" class="product-thumb">
            </td>
            <td class="td-name">
                <div class="product-name-cell">
                    <strong>${product.name}</strong>
                    <span class="product-slug">/${product.slug}</span>
                </div>
            </td>
            <td class="td-category">
                <span class="category-badge">${formatCategory(product.category)}</span>
            </td>
            <td class="td-price">$${product.price.toFixed(2)}</td>
            <td class="td-variants">
                ${product.variantCount || '-'}
            </td>
            <td class="td-status">
                <span class="status-badge ${product.isActive ? 'active' : 'inactive'}">
                    ${product.isActive ? 'Active' : 'Inactive'}
                </span>
                ${product.isFeatured ? '<span class="status-badge featured">Featured</span>' : ''}
            </td>
            <td class="td-sync">
                ${
                    product.isLocalOnly
                        ? '<span class="status-badge local-only"><i class="fas fa-exclamation-triangle"></i> Local Only</span>'
                        : '<span class="status-badge synced">✓ Synced</span>'
                }
            </td>
            <td class="td-date">${formatDate(product.createdAt)}</td>
            <td class="td-actions">
                <div class="action-buttons">
                    <button type="button" class="btn btn-icon btn-sm" onclick="window.open('/product/${product.slug}', '_blank')" title="View">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button type="button" class="btn btn-icon btn-sm" onclick="openEditModal('${product._id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-icon btn-sm" onclick="toggleActive('${product._id}')" title="${product.isActive ? 'Deactivate' : 'Activate'}">
                        <i class="fas ${product.isActive ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button type="button" class="btn btn-icon btn-sm" onclick="toggleFeatured('${product._id}')" title="${product.isFeatured ? 'Unfeature' : 'Feature'}">
                        <i class="fas fa-star ${product.isFeatured ? 'text-warning' : ''}"></i>
                    </button>
                    <button type="button" class="btn btn-icon btn-sm btn-danger" onclick="openDeleteModal('${product._id}', '${product.name.replace(/'/g, "\\'")}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `
        )
        .join('');
}

function updateStats() {
    document.getElementById('totalProducts').textContent = allProducts.length;
    document.getElementById('syncedProducts').textContent = allProducts.filter(
        (p) => p.isSynced
    ).length;
    document.getElementById('activeProducts').textContent = allProducts.filter(
        (p) => p.isActive
    ).length;
    document.getElementById('featuredProducts').textContent = allProducts.filter(
        (p) => p.isFeatured
    ).length;
}

function openEditModal(productId) {
    const product = allProducts.find((p) => p._id === productId);
    if (!product) return;

    document.getElementById('editProductId').value = product._id;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductPrice').value = product.price;
    document.getElementById('editProductCategory').value = product.category || 'other';
    document.getElementById('editProductDescription').value = product.description || '';
    document.getElementById('editProductComparePrice').value = product.compareAtPrice || '';
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
        compareAtPrice:
            parseFloat(document.getElementById('editProductComparePrice').value) || null,
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
            const product = allProducts.find((p) => p._id === productId);
            if (product) product.isActive = result.data.isActive;
            applyFilters();
            updateStats();
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
            const product = allProducts.find((p) => p._id === productId);
            if (product) product.isFeatured = result.data.isFeatured;
            applyFilters();
            updateStats();
            showToast(`Product ${result.data.isFeatured ? 'featured' : 'unfeatured'}`, 'success');
        } else {
            showToast(result.message || 'Failed to update product', 'error');
        }
    } catch (error) {
        showToast('Error updating product', 'error');
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
        const response = await fetch('/api/admin/printful/sync', { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            messageEl.textContent = 'Sync completed!';

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

            logEl.innerHTML += `
                <div class="sync-log-entry info">
                    <i class="fas fa-info-circle"></i>
                    <span>Total: ${result.data?.total || 0}, Created: ${result.data?.created || 0}, Updated: ${result.data?.updated || 0}, Errors: ${result.data?.errors || 0}</span>
                </div>
            `;

            showToast('Products synced successfully', 'success');
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

    document.querySelector('.sync-spinner').innerHTML = '<i class="fas fa-check-circle"></i>';
    footerEl.style.display = 'flex';
}

function sortProducts(field) {
    // Toggle sort direction
    const currentSort = document.querySelector(`[data-sort="${field}"]`);
    const isAsc = !currentSort.classList.contains('sort-asc');

    document.querySelectorAll('.sortable').forEach((th) => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    currentSort.classList.add(isAsc ? 'sort-asc' : 'sort-desc');

    filteredProducts.sort((a, b) => {
        let valA, valB;
        switch (field) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'price':
                valA = a.price;
                valB = b.price;
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

    renderProducts(filteredProducts);
}

// Utility functions
function formatCategory(category) {
    const categories = {
        tshirts: 'T-Shirts',
        hoodies: 'Hoodies',
        sweatshirts: 'Sweatshirts',
        accessories: 'Accessories',
        other: 'Other',
    };
    return categories[category] || category;
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

        if (modalId === 'syncProgressModal') {
            document.querySelector('.sync-spinner').innerHTML =
                '<i class="fas fa-sync-alt fa-spin"></i>';
        }
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
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
window.toggleActive = toggleActive;
window.toggleFeatured = toggleFeatured;
