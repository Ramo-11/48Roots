/**
 * Order Confirmation Page JavaScript
 * Handles loading order details, status updates, and printing
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeOrderConfirmation();
});

function initializeOrderConfirmation() {
    const orderNumber = getOrderNumber();

    if (!orderNumber) {
        showError('Order number not found');
        return;
    }

    loadOrderDetails(orderNumber);
    setupPrintButton();
}

function getOrderNumber() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

async function loadOrderDetails(orderNumber) {
    try {
        const response = await fetch(`/api/orders/${orderNumber}`);
        const result = await response.json();

        if (result.success && result.data) {
            renderOrderDetails(result.data);
        } else {
            showError(result.message || 'Order not found');
        }
    } catch (error) {
        console.error('Error loading order:', error);
        showError('Failed to load order details');
    }
}

function renderOrderDetails(order) {
    // Hide loading, show content
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('orderContent').style.display = 'block';

    // Render order items
    renderOrderItems(order.items);

    // Render order summary
    renderOrderSummary(order);

    // Render shipping address
    renderShippingAddress(order.shipping);

    // Update status timeline
    updateStatusTimeline(order);

    // Update tracking info
    updateTrackingInfo(order.fulfillment);

    // Update donation/impact section
    updateDonationSection(order.donation);

    // Update customer email
    const emailEl = document.getElementById('customerEmail');
    if (emailEl && order.customer?.email) {
        emailEl.textContent = order.customer.email;
    }

    // Update received date
    const receivedDateEl = document.getElementById('receivedDate');
    if (receivedDateEl && order.createdAt) {
        receivedDateEl.textContent = formatDate(order.createdAt);
    }
}

function renderOrderItems(items) {
    const container = document.getElementById('orderItems');
    if (!container || !items) return;

    container.innerHTML = items
        .map(
            (item) => `
        <div class="order-item">
            <div class="order-item-image">
                <img src="${item.image || '/images/placeholder.png'}" alt="${item.name}" loading="lazy">
            </div>
            <div class="order-item-details">
                <div class="order-item-name">${item.name}</div>
                <div class="order-item-meta">
                    ${item.variant?.size ? `Size: ${item.variant.size}` : ''}
                    ${item.variant?.size && item.quantity ? ' • ' : ''}
                    ${item.quantity ? `Qty: ${item.quantity}` : ''}
                </div>
            </div>
            <div class="order-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `
        )
        .join('');
}

function renderOrderSummary(order) {
    const subtotalEl = document.getElementById('orderSubtotal');
    const shippingEl = document.getElementById('orderShipping');
    const totalEl = document.getElementById('orderTotal');

    if (subtotalEl) subtotalEl.textContent = `$${(order.subtotal || 0).toFixed(2)}`;
    if (shippingEl) {
        const shippingCost = order.shipping?.cost || 0;
        shippingEl.textContent = shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`;
    }
    if (totalEl) totalEl.textContent = `$${(order.total || 0).toFixed(2)}`;
}

function renderShippingAddress(shipping) {
    const container = document.getElementById('shippingAddress');
    if (!container || !shipping?.address) return;

    const addr = shipping.address;
    const name = `${addr.firstName || ''} ${addr.lastName || ''}`.trim();

    container.innerHTML = `
        ${name ? `<div class="shipping-address-name">${name}</div>` : ''}
        <div>${addr.line1 || ''}</div>
        ${addr.line2 ? `<div>${addr.line2}</div>` : ''}
        <div>${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}</div>
        <div>${addr.country || 'US'}</div>
    `;
}

function updateStatusTimeline(order) {
    const status = order.fulfillment?.status || 'pending';
    const statusOrder = ['received', 'processing', 'shipped', 'delivered'];
    const currentIndex = getStatusIndex(status);

    statusOrder.forEach((step, index) => {
        const stepEl = document.querySelector(`.status-step[data-status="${step}"]`);
        if (!stepEl) return;

        stepEl.classList.remove('completed', 'active');

        if (index < currentIndex) {
            stepEl.classList.add('completed');
        } else if (index === currentIndex) {
            stepEl.classList.add('active');
            // Update the active step icon to indicate progress
            if (status !== 'delivered') {
                stepEl.classList.add('completed');
            }
        }
    });

    // If order failed or canceled, update UI accordingly
    if (status === 'failed' || status === 'canceled') {
        const processingStep = document.querySelector('.status-step[data-status="processing"]');
        if (processingStep) {
            processingStep.classList.remove('active', 'completed');
            processingStep.classList.add('error');
            const label = processingStep.querySelector('.status-label');
            if (label) {
                label.textContent = status === 'failed' ? 'Order Failed' : 'Order Canceled';
            }
        }
    }
}

function getStatusIndex(status) {
    const statusMap = {
        pending: 0,
        received: 0,
        processing: 1,
        inprocess: 1,
        shipped: 2,
        delivered: 3,
        fulfilled: 3,
    };
    return statusMap[status] ?? 0;
}

function updateTrackingInfo(fulfillment) {
    const section = document.getElementById('trackingSection');
    if (!section) return;

    if (!fulfillment?.trackingNumber) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    const carrierEl = document.getElementById('trackingCarrier');
    const linkEl = document.getElementById('trackingLink');

    if (carrierEl) {
        carrierEl.textContent = fulfillment.carrier || 'Carrier';
    }

    if (linkEl) {
        linkEl.textContent = fulfillment.trackingNumber;
        linkEl.href =
            fulfillment.trackingUrl ||
            getTrackingUrl(fulfillment.carrier, fulfillment.trackingNumber);
    }
}

function getTrackingUrl(carrier, trackingNumber) {
    const carrierUrls = {
        usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
        ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
        fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
        dhl: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`,
    };

    const normalizedCarrier = (carrier || '').toLowerCase();
    return carrierUrls[normalizedCarrier] || '#';
}

function updateDonationSection(donation) {
    const donationRow = document.getElementById('donationRow');
    const impactSection = document.getElementById('impactSection');
    const donationEl = document.getElementById('orderDonation');
    const impactMessage = document.getElementById('impactMessage');

    const amount = donation?.amount || 0;

    if (amount > 0) {
        if (donationRow) {
            donationRow.style.display = 'flex';
        }
        if (donationEl) {
            donationEl.textContent = `$${amount.toFixed(2)}`;
        }
        if (impactSection) {
            impactSection.style.display = 'block';
        }
        if (impactMessage) {
            const meals = Math.floor(amount / 2.5);
            if (meals >= 1) {
                impactMessage.textContent = `Your generous donation of $${amount.toFixed(2)} will help provide approximately ${meals} meal${meals > 1 ? 's' : ''} to families in need. Thank you for making a difference!`;
            } else {
                impactMessage.textContent = `Your donation of $${amount.toFixed(2)} helps support families in need. Every contribution makes a difference. Thank you!`;
            }
        }
    } else {
        if (donationRow) donationRow.style.display = 'none';
        if (impactSection) impactSection.style.display = 'none';
    }
}

function setupPrintButton() {
    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

function showError(message) {
    const loadingEl = document.getElementById('loadingState');
    if (loadingEl) {
        loadingEl.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>
            <span>${message}</span>
        `;
    }
}

function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
