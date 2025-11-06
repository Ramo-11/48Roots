document.addEventListener('DOMContentLoaded', async () => {
    await loadFeaturedProducts();
    await loadAnnouncements();
    updateCartCount();
});

async function loadFeaturedProducts() {
    try {
        const response = await fetch('/api/products/featured');
        const result = await response.json();

        if (result.success) {
            renderProducts(result.data);
        }
    } catch (error) {
        console.error('Error loading featured products:', error);
    }
}

function renderProducts(products) {
    const container = document.getElementById('featuredProducts');
    if (!container) return;

    if (!products.length) {
        container.innerHTML = '<p class="text-center">No products available at this time.</p>';
        return;
    }

    container.innerHTML = products
        .map((product) => {
            const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
            const discountPercent = hasDiscount
                ? Math.round(
                      ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
                  )
                : 0;

            let badges = '';
            if (hasDiscount) {
                badges += `<span class="product-badge sale">-${discountPercent}%</span>`;
            }
            if (product.isFeatured) {
                badges += `<span class="product-badge new">Featured</span>`;
            }

            return `
            <div class="product-card" onclick="window.location.href='/product/${product.slug}'">
                ${badges}
                
                <div class="product-image-wrapper">
                    <img src="${product.images[0]?.url || '/images/placeholder.png'}" 
                         alt="${product.images[0]?.alt || product.name}" 
                         class="product-image">
                </div>
                
                <div class="product-info">
                    <div class="product-category">${product.category}</div>
                    <h3 class="product-name">${product.name}</h3>
                    
                    <div class="product-pricing">
                        <span class="product-price">$${product.price.toFixed(2)}</span>
                        ${
                            hasDiscount
                                ? `<span class="product-compare-price">$${product.compareAtPrice.toFixed(2)}</span>`
                                : ''
                        }
                    </div>
                    
                    <div class="product-footer">
                        <div class="product-sizes">
                            ${
                                product.variants
                                    ? product.variants
                                          .map((v) => v.size)
                                          .filter((v, i, arr) => arr.indexOf(v) === i)
                                          .slice(0, 5)
                                          .join(', ')
                                    : 'S, M, L, XL'
                            }
                        </div>
                        <span class="product-quick-view">View Details →</span>
                    </div>
                </div>
            </div>
        `;
        })
        .join('');
}

async function loadAnnouncements() {
    try {
        const response = await fetch('/api/announcements/active');
        const result = await response.json();

        if (result.success && result.data.length) {
            renderAnnouncement(result.data[0]);
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

function renderAnnouncement(announcement) {
    const section = document.getElementById('announcementSection');
    if (!section) return;

    section.innerHTML = `
        <div class="container">
            <p>${announcement.message}</p>
            ${
                announcement.link
                    ? `<a href="${announcement.link.url}" class="btn btn-sm btn-outline">${announcement.link.text}</a>`
                    : ''
            }
        </div>
    `;
    section.classList.remove('hidden');
}

function updateCartCount() {
    const cart = Common.localStorage.get('cart') || { items: [] };
    const count = cart.items.reduce((total, item) => total + item.quantity, 0);
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
        cartCountEl.textContent = count;
    }
}
