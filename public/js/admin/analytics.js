// Analytics Dashboard
let currentPeriod = '7d';
let trafficChart = null;
let sourcesChart = null;
let devicesChart = null;

// Chart.js colors
const chartColors = {
    primary: 'rgba(79, 70, 229, 1)',
    primaryLight: 'rgba(79, 70, 229, 0.1)',
    success: 'rgba(16, 185, 129, 1)',
    warning: 'rgba(245, 158, 11, 1)',
    danger: 'rgba(239, 68, 68, 1)',
    info: 'rgba(59, 130, 246, 1)',
    gray: 'rgba(107, 114, 128, 1)',
};

const sourceColors = {
    direct: chartColors.primary,
    organic: chartColors.success,
    social: chartColors.info,
    referral: chartColors.warning,
};

const deviceColors = {
    desktop: chartColors.primary,
    mobile: chartColors.success,
    tablet: chartColors.warning,
    unknown: chartColors.gray,
};

document.addEventListener('DOMContentLoaded', () => {
    loadAllAnalytics();
    setupEventListeners();
});

function setupEventListeners() {
    // Period filter
    document.getElementById('periodFilter').addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        loadAllAnalytics();
    });

    // Refresh button
    document.getElementById('refreshAnalyticsBtn').addEventListener('click', loadAllAnalytics);

    // Chart metric filter
    document.getElementById('chartMetricFilter').addEventListener('change', (e) => {
        loadTimeSeriesData(e.target.value);
    });
}

async function loadAllAnalytics() {
    await Promise.all([
        loadOverview(),
        loadTimeSeriesData('pageViews'),
        loadTrafficSources(),
        loadDevices(),
        loadTopProducts(),
        loadSearches(),
        loadPromotionAnalytics(),
    ]);
}

async function loadOverview() {
    try {
        const response = await fetch(`/api/admin/analytics/overview?period=${currentPeriod}`);
        const result = await response.json();

        if (result.success) {
            const metrics = result.data.metrics;

            document.getElementById('uniqueVisitors').textContent = formatNumber(metrics.uniqueVisitors);
            document.getElementById('pageViews').textContent = formatNumber(metrics.pageViews);
            document.getElementById('revenue').textContent = formatCurrency(metrics.revenue);
            document.getElementById('orderCount').textContent = formatNumber(metrics.orderCount);
            document.getElementById('conversionRate').textContent = `${metrics.conversionRate}%`;

            // Update funnel
            updateFunnel(metrics);
        }
    } catch (error) {
        console.error('Error loading overview:', error);
    }
}

function updateFunnel(metrics) {
    const maxValue = metrics.pageViews || 1;

    // Calculate percentages
    const pageViewsPct = 100;
    const productViewsPct = (metrics.productViews / maxValue) * 100 || 0;
    const addToCartsPct = (metrics.addToCarts / maxValue) * 100 || 0;
    const checkoutsPct = (metrics.checkoutsCompleted / maxValue) * 100 || 0;

    // Update bars
    document.getElementById('funnelPageViews').style.width = `${pageViewsPct}%`;
    document.getElementById('funnelProductViews').style.width = `${Math.max(productViewsPct, 5)}%`;
    document.getElementById('funnelAddToCarts').style.width = `${Math.max(addToCartsPct, 5)}%`;
    document.getElementById('funnelCheckouts').style.width = `${Math.max(checkoutsPct, 5)}%`;

    // Update values
    document.getElementById('funnelPageViewsValue').textContent = formatNumber(metrics.pageViews);
    document.getElementById('funnelProductViewsValue').textContent = formatNumber(metrics.productViews);
    document.getElementById('funnelAddToCartsValue').textContent = formatNumber(metrics.addToCarts);
    document.getElementById('funnelCheckoutsValue').textContent = formatNumber(metrics.checkoutsCompleted);
}

async function loadTimeSeriesData(metric) {
    try {
        const response = await fetch(
            `/api/admin/analytics/time-series?period=${currentPeriod}&metric=${metric}`
        );
        const result = await response.json();

        if (result.success) {
            renderTrafficChart(result.data.series, metric);
        }
    } catch (error) {
        console.error('Error loading time series:', error);
    }
}

function renderTrafficChart(series, metric) {
    const ctx = document.getElementById('trafficChart').getContext('2d');

    if (trafficChart) {
        trafficChart.destroy();
    }

    const labels = series.map((s) => s.label);
    const data = series.map((s) => s.value);

    trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: formatMetricLabel(metric),
                    data,
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primaryLight,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                    },
                },
            },
        },
    });
}

async function loadTrafficSources() {
    try {
        const response = await fetch(`/api/admin/analytics/traffic-sources?period=${currentPeriod}`);
        const result = await response.json();

        if (result.success) {
            renderSourcesChart(result.data);
            renderSourcesList(result.data);
        }
    } catch (error) {
        console.error('Error loading traffic sources:', error);
    }
}

function renderSourcesChart(data) {
    const ctx = document.getElementById('sourcesChart').getContext('2d');

    if (sourcesChart) {
        sourcesChart.destroy();
    }

    const labels = Object.keys(data).map(capitalizeFirst);
    const values = Object.values(data);
    const colors = Object.keys(data).map((key) => sourceColors[key] || chartColors.gray);

    sourcesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            cutout: '70%',
        },
    });
}

function renderSourcesList(data) {
    const container = document.getElementById('sourcesList');
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;

    container.innerHTML = Object.entries(data)
        .map(([source, count]) => {
            const pct = ((count / total) * 100).toFixed(1);
            return `
                <div class="source-item">
                    <span class="source-dot" style="background-color: ${sourceColors[source] || chartColors.gray}"></span>
                    <span class="source-name">${capitalizeFirst(source)}</span>
                    <span class="source-value">${formatNumber(count)} (${pct}%)</span>
                </div>
            `;
        })
        .join('');
}

async function loadDevices() {
    try {
        const response = await fetch(`/api/admin/analytics/devices?period=${currentPeriod}`);
        const result = await response.json();

        if (result.success) {
            renderDevicesChart(result.data);
            renderDevicesList(result.data);
        }
    } catch (error) {
        console.error('Error loading devices:', error);
    }
}

function renderDevicesChart(data) {
    const ctx = document.getElementById('devicesChart').getContext('2d');

    if (devicesChart) {
        devicesChart.destroy();
    }

    const labels = Object.keys(data).map(capitalizeFirst);
    const values = Object.values(data);
    const colors = Object.keys(data).map((key) => deviceColors[key] || chartColors.gray);

    devicesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            cutout: '70%',
        },
    });
}

function renderDevicesList(data) {
    const container = document.getElementById('devicesList');
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;

    container.innerHTML = Object.entries(data)
        .filter(([_, count]) => count > 0)
        .map(([device, count]) => {
            const pct = ((count / total) * 100).toFixed(1);
            const icon = getDeviceIcon(device);
            return `
                <div class="device-item">
                    <i class="fas ${icon}" style="color: ${deviceColors[device] || chartColors.gray}"></i>
                    <span class="device-name">${capitalizeFirst(device)}</span>
                    <span class="device-value">${formatNumber(count)} (${pct}%)</span>
                </div>
            `;
        })
        .join('');
}

async function loadTopProducts() {
    try {
        const response = await fetch(`/api/admin/analytics/top-products?period=${currentPeriod}&limit=5`);
        const result = await response.json();

        if (result.success) {
            renderTopViewedProducts(result.data.topViewed);
            renderTopAddedToCart(result.data.topAddedToCart);
        }
    } catch (error) {
        console.error('Error loading top products:', error);
    }
}

function renderTopViewedProducts(products) {
    const tbody = document.getElementById('topViewedProducts');

    if (!products || products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">No product views recorded</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = products
        .map(
            (p) => `
        <tr>
            <td>${escapeHtml(p.name || 'Unknown')}</td>
            <td>${escapeHtml(p.category || '-')}</td>
            <td class="text-right">${formatNumber(p.views)}</td>
        </tr>
    `
        )
        .join('');
}

function renderTopAddedToCart(products) {
    const tbody = document.getElementById('topAddedToCart');

    if (!products || products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">No add to cart events recorded</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = products
        .map(
            (p) => `
        <tr>
            <td>${escapeHtml(p.name || 'Unknown')}</td>
            <td>${escapeHtml(p.category || '-')}</td>
            <td class="text-right">${formatNumber(p.addToCarts)}</td>
        </tr>
    `
        )
        .join('');
}

async function loadSearches() {
    try {
        const response = await fetch('/api/admin/analytics/searches?limit=10');
        const result = await response.json();

        if (result.success) {
            renderSearches(result.data);
        }
    } catch (error) {
        console.error('Error loading searches:', error);
    }
}

function renderSearches(searches) {
    const container = document.getElementById('searchesList');

    if (!searches || searches.length === 0) {
        container.innerHTML = '<div class="empty-state">No search data available</div>';
        return;
    }

    container.innerHTML = searches
        .map(
            (s) => `
        <div class="search-item">
            <span class="search-query">"${escapeHtml(s._id)}"</span>
            <span class="search-count">${formatNumber(s.count)}</span>
        </div>
    `
        )
        .join('');
}

async function loadPromotionAnalytics() {
    try {
        const response = await fetch(`/api/admin/analytics/promotions?period=${currentPeriod}`);
        const result = await response.json();

        if (result.success) {
            renderPromotionAnalytics(result.data);
        }
    } catch (error) {
        console.error('Error loading promotion analytics:', error);
    }
}

function renderPromotionAnalytics(data) {
    // Update summary
    document.getElementById('totalPromoUses').textContent = formatNumber(data.summary.totalUses);
    document.getElementById('totalDiscountGiven').textContent = formatCurrency(data.summary.totalDiscount);

    // Update table
    const tbody = document.getElementById('promotionAnalytics');

    if (!data.promotions || data.promotions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">No promotion usage recorded</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.promotions
        .map(
            (p) => `
        <tr>
            <td><code>${escapeHtml(p._id || 'Auto-applied')}</code></td>
            <td class="text-right">${formatNumber(p.uses)}</td>
            <td class="text-right">${formatCurrency(p.totalDiscount)}</td>
        </tr>
    `
        )
        .join('');
}

// Utility functions
function formatNumber(num) {
    if (num === undefined || num === null) return '-';
    return new Intl.NumberFormat().format(num);
}

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

function formatMetricLabel(metric) {
    const labels = {
        pageViews: 'Page Views',
        productViews: 'Product Views',
        addToCarts: 'Add to Carts',
        checkouts: 'Checkouts',
    };
    return labels[metric] || metric;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getDeviceIcon(device) {
    const icons = {
        desktop: 'fa-desktop',
        mobile: 'fa-mobile-alt',
        tablet: 'fa-tablet-alt',
        unknown: 'fa-question-circle',
    };
    return icons[device] || 'fa-question-circle';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
