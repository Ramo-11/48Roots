document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname;

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        navLinks.forEach((link) => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });

        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }

    navLinks.forEach((link) => {
        const linkPath = new URL(link.href).pathname;
        if (linkPath === currentPath) {
            link.classList.add('active');
        }
    });

    let lastScrollTop = 0;
    const nav = document.querySelector('.nav');

    window.addEventListener(
        'scroll',
        () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > lastScrollTop && scrollTop > 100) {
                nav.style.transform = 'translateY(-100%)';
            } else {
                nav.style.transform = 'translateY(0)';
            }

            lastScrollTop = scrollTop;
        },
        { passive: true }
    );

    initializeSearch();
    initializeCart();
});

function initializeCart() {
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            window.location.href = '/cart';
        });
    }

    updateCartCount();
}

function initializeSearch() {
    const searchInput = document.getElementById('navSearchInput');
    const searchBtn = document.querySelector('.nav-search-btn');

    if (!searchInput) return;

    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            hideSearchResults();
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
            window.location.href = `/shop?search=${encodeURIComponent(query)}`;
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                window.location.href = `/shop?search=${encodeURIComponent(query)}`;
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-search')) {
            hideSearchResults();
        }
    });
}

async function performSearch(query) {
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const result = await response.json();

        if (result.success) {
            displaySearchResults(result.data);
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

function displaySearchResults(products) {
    let resultsContainer = document.getElementById('searchResults');

    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'searchResults';
        resultsContainer.className = 'search-results';
        document.querySelector('.nav-search').appendChild(resultsContainer);
    }

    if (!products.length) {
        resultsContainer.innerHTML = '<div class="search-result-item">No products found</div>';
        resultsContainer.classList.add('active');
        return;
    }

    resultsContainer.innerHTML = products
        .slice(0, 5)
        .map(
            (product) => `
        <a href="/product/${product.slug}" class="search-result-item">
            <img src="${product.images[0]?.url || '/images/placeholder.png'}" alt="${product.name}">
            <div class="search-result-info">
                <div class="search-result-name">${product.name}</div>
                <div class="search-result-price">$${product.price.toFixed(2)}</div>
            </div>
        </a>
    `
        )
        .join('');

    if (products.length > 5) {
        resultsContainer.innerHTML += `
            <a href="/shop?search=${encodeURIComponent(document.getElementById('navSearchInput').value)}" class="search-view-all">
                View all ${products.length} results
            </a>
        `;
    }

    resultsContainer.classList.add('active');
}

function hideSearchResults() {
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.classList.remove('active');
    }
}

async function updateCartCount() {
    try {
        const response = await fetch('/api/cart');
        const result = await response.json();

        if (result.success && result.data.items) {
            const count = result.data.items.reduce((total, item) => total + item.quantity, 0);
            const cartCountEl = document.getElementById('cartCount');
            if (cartCountEl) {
                cartCountEl.textContent = count;
            }
        }
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

window.updateCartCount = updateCartCount;
