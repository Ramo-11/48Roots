document.addEventListener('DOMContentLoaded', async () => {
    await loadNewArrivals();
});

async function loadNewArrivals() {
    try {
        const response = await fetch('/api/products?sort=newest');
        const result = await response.json();

        if (result.success) {
            renderProducts(result.data);
        }
    } catch (error) {
        console.error('Error loading new arrivals:', error);
        Common.showNotification('Failed to load products', 'error');
    }
}

function renderProducts(products) {
    const container = document.getElementById('newArrivalsGrid');
    if (!container) return;

    if (!products.length) {
        container.innerHTML = `
            <div class="no-products">
                <i class="fas fa-box-open"></i>
                <p>No new arrivals at this time.</p>
            </div>
        `;
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
            badges += `<span class="product-badge new">New</span>`;

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
                            ${[1, 2, 3, 4].map(() => '<span class="product-size-dot"></span>').join('')}
                        </div>
                        <span class="product-quick-view">View Details →</span>
                    </div>
                </div>
            </div>
        `;
        })
        .join('');
}
