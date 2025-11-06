let product = null;
let selectedSize = null;
let quantity = 1;

document.addEventListener('DOMContentLoaded', async () => {
    const slug = window.location.pathname.split('/').pop();
    await loadProduct(slug);
    initializeQuantityControls();
});

async function loadProduct(slug) {
    try {
        const response = await fetch(`/api/products/${slug}`);
        const result = await response.json();

        if (result.success) {
            product = result.data;
            renderProduct();
            await loadRelatedProducts();
        } else {
            window.location.href = '/shop';
        }
    } catch (error) {
        console.error('Error loading product:', error);
        Common.showNotification('Failed to load product', 'error');
    }
}

function renderProduct() {
    document.getElementById('productName').textContent = product.name;
    document.getElementById('productPrice').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('productDescription').innerHTML = product.description;
    document.getElementById('productCategory').textContent = product.category;

    if (product.compareAtPrice) {
        const comparePriceEl = document.getElementById('productComparePrice');
        comparePriceEl.textContent = `$${product.compareAtPrice.toFixed(2)}`;
        comparePriceEl.classList.remove('hidden');
    }

    if (product.images.length) {
        const mainImage = document.getElementById('mainImage');
        mainImage.src = product.images[0].url;
        mainImage.alt = product.images[0].alt || product.name;

        const thumbnailsContainer = document.getElementById('thumbnails');
        thumbnailsContainer.innerHTML = product.images
            .map(
                (img, index) => `
            <img src="${img.url}" 
                 alt="${img.alt || product.name}" 
                 class="thumbnail ${index === 0 ? 'active' : ''}"
                 onclick="changeMainImage('${img.url}', ${index})">
        `
            )
            .join('');
    }

    renderSizeOptions();
}

function renderSizeOptions() {
    const container = document.getElementById('sizeOptions');
    const sizes = [...new Set(product.variants.map((v) => v.size))];

    container.innerHTML = sizes
        .map((size) => {
            const variant = product.variants.find((v) => v.size === size);
            const inStock = variant && variant.stock > 0;
            return `
            <button class="size-option ${!inStock ? 'disabled' : ''}" 
                    data-size="${size}"
                    ${!inStock ? 'disabled' : ''}
                    onclick="selectSize('${size}')">
                ${size}
            </button>
        `;
        })
        .join('');
}

function changeMainImage(url, index) {
    document.getElementById('mainImage').src = url;
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

function selectSize(size) {
    selectedSize = size;
    document.querySelectorAll('.size-option').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.size === size);
    });

    const variant = product.variants.find((v) => v.size === size);
    if (variant?.sku) {
        document.getElementById('productSku').textContent = variant.sku;
    }
}

function initializeQuantityControls() {
    const decreaseBtn = document.getElementById('decreaseQty');
    const increaseBtn = document.getElementById('increaseQty');
    const quantityInput = document.getElementById('quantity');

    decreaseBtn.addEventListener('click', () => {
        if (quantity > 1) {
            quantity--;
            quantityInput.value = quantity;
        }
    });

    increaseBtn.addEventListener('click', () => {
        const maxStock = getMaxStock();
        if (quantity < maxStock) {
            quantity++;
            quantityInput.value = quantity;
        }
    });

    document.getElementById('addToCartBtn').addEventListener('click', addToCart);
}

function getMaxStock() {
    if (!selectedSize) return 999;
    const variant = product.variants.find((v) => v.size === selectedSize);
    return variant?.stock || 0;
}

async function addToCart() {
    if (!selectedSize) {
        Common.showNotification('Please select a size', 'warning');
        return;
    }

    const variant = product.variants.find((v) => v.size === selectedSize);
    if (!variant || variant.stock < quantity) {
        Common.showNotification('Insufficient stock', 'error');
        return;
    }

    const btn = document.getElementById('addToCartBtn');
    Common.showLoading(btn);

    try {
        const response = await fetch('/api/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: product._id,
                variant: { size: selectedSize },
                quantity: quantity,
            }),
        });

        const result = await response.json();

        if (result.success) {
            Common.showNotification('Added to cart!', 'success');
            updateCartCount();
        } else {
            Common.showNotification(result.message || 'Failed to add to cart', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        Common.showNotification('Failed to add to cart', 'error');
    } finally {
        Common.hideLoading(btn);
    }
}

function updateCartCount() {
    const cart = Common.localStorage.get('cart') || { items: [] };
    const count = cart.items.reduce((total, item) => total + item.quantity, 0);
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
        cartCountEl.textContent = count;
    }
}

async function loadRelatedProducts() {
    try {
        const response = await fetch(`/api/products/related/${product._id}`);
        const result = await response.json();

        if (result.success && result.data.length) {
            const container = document.getElementById('relatedProducts');
            container.innerHTML = result.data
                .map(
                    (p) => `
                <div class="product-card" onclick="window.location.href='/product/${p.slug}'">
                    <img src="${p.images[0]?.url || '/images/placeholder.png'}" 
                         alt="${p.images[0]?.alt || p.name}" 
                         class="product-image">
                    <div class="product-info">
                        <h3 class="product-name">${p.name}</h3>
                        <div class="product-pricing">
                            <span class="product-price">$${p.price.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `
                )
                .join('');
        }
    } catch (error) {
        console.error('Error loading related products:', error);
    }
}
