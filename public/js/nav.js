document.addEventListener('DOMContentLoaded', () => {
    initializeNavToggle();
    initializeSearch();
    initializeCart();
    initializeScrollBehavior();
});

function initializeNavToggle() {
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

    // Set active link
    navLinks.forEach((link) => {
        const linkPath = new URL(link.href).pathname;
        if (linkPath === currentPath) {
            link.classList.add('active');
        }
    });
}

function initializeScrollBehavior() {
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
}

function initializeCart() {
    updateCartCount();
}

function initializeSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchClose = document.getElementById('searchClose');
    const searchInput = document.getElementById('searchInput');
    const searchForm = document.getElementById('searchForm');
    const searchResults = document.getElementById('searchResults');

    if (!searchBtn || !searchOverlay) return;

    // Open search overlay
    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => searchInput?.focus(), 100);
    });

    // Close search overlay
    searchClose?.addEventListener('click', () => {
        closeSearchOverlay();
    });

    // Close on overlay background click
    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) {
            closeSearchOverlay();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
            closeSearchOverlay();
        }
    });

    // Live search
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
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

    // Form submit
    searchForm?.addEventListener('submit', (e) => {
        const query = searchInput?.value.trim();
        if (query && query.length >= 2) {
            // Form will submit naturally to /shop
        } else {
            e.preventDefault();
        }
    });

    function closeSearchOverlay() {
        searchOverlay.classList.remove('active');
        document.body.style.overflow = '';
        if (searchInput) searchInput.value = '';
        hideSearchResults();
    }

    async function performSearch(query) {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const result = await response.json();

            if (result.success) {
                displaySearchResults(result.data, query);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    function displaySearchResults(products, query) {
        if (!searchResults) return;

        if (!products.length) {
            searchResults.innerHTML = '<div class="search-no-results">No products found</div>';
            searchResults.classList.add('active');
            return;
        }

        searchResults.innerHTML = products
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
            searchResults.innerHTML += `
                <a href="/shop?search=${encodeURIComponent(query)}" class="search-view-all">
                    View all ${products.length} results →
                </a>
            `;
        }

        searchResults.classList.add('active');
    }

    function hideSearchResults() {
        if (searchResults) {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
        }
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
                cartCountEl.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

window.updateCartCount = updateCartCount;
