let stripe, elements;
let cart = { items: [], subtotal: 0 };
let shippingCost = 0;
let clientSecret = null;

/* ============================================================
   GOOGLE ADDRESS AUTOCOMPLETE
============================================================ */
function initAddressAutocomplete() {
    const addressInput = document.getElementById('address1');
    if (!addressInput || !window.google?.maps) {
        console.warn('Google Places API not loaded.');
        return;
    }

    const autocomplete = new google.maps.places.Autocomplete(addressInput, {
        types: ['address'],
        fields: ['address_components', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        fillAddressFields(place.address_components);
        calculateShipping(); // auto-update shipping
    });
}

function fillAddressFields(components) {
    let streetNumber = '',
        route = '',
        city = '',
        state = '',
        zip = '',
        country = '';

    components.forEach((c) => {
        const type = c.types[0];

        switch (type) {
            case 'street_number':
                streetNumber = c.long_name;
                break;
            case 'route':
                route = c.long_name;
                break;
            case 'locality':
                city = c.long_name;
                break;
            case 'administrative_area_level_1':
                state = c.short_name;
                break;
            case 'postal_code':
                zip = c.long_name;
                break;
            case 'country':
                country = c.short_name;
                break;
        }
    });

    const fullStreet = `${streetNumber} ${route}`.trim();
    if (fullStreet) document.getElementById('address1').value = fullStreet;
    if (city) document.getElementById('city').value = city;
    if (state) document.getElementById('state').value = state;
    if (zip) document.getElementById('zipCode').value = zip;
    if (country) document.getElementById('country').value = country;
}

/* ============================================================
   INITIALIZE CHECKOUT
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Google script to load
    setTimeout(initAddressAutocomplete, 600);

    if (!window.Stripe || !window.STRIPE_CONFIG?.publicKey) {
        Common.showNotification('Payment system not configured', 'error');
        return;
    }

    stripe = Stripe(window.STRIPE_CONFIG.publicKey);

    await loadCart();
    await initializePayment();

    document.getElementById('checkoutForm').addEventListener('submit', handleSubmit);

    ['city', 'state', 'zipCode', 'country'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('blur', calculateShipping);
    });
});

/* ============================================================
   STRIPE PAYMENT INTENT
============================================================ */
async function initializePayment() {
    try {
        const response = await fetch('/api/checkout/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to initialize payment');

        clientSecret = result.data.clientSecret;

        elements = stripe.elements({
            clientSecret,
            appearance: { theme: 'stripe' },
        });

        const paymentElement = elements.create('payment', { layout: 'tabs' });
        paymentElement.mount('#payment-element');

        paymentElement.on('change', (event) => {
            document.getElementById('payment-errors').textContent = event.error?.message || '';
        });
    } catch (error) {
        console.error('Payment initialization error:', error);
        Common.showNotification('Failed to initialize payment', 'error');
    }
}

/* ============================================================
   LOAD CART + RENDER
============================================================ */
async function loadCart() {
    try {
        const response = await fetch('/api/cart');
        const result = await response.json();

        if (result.success) {
            cart = result.data;
            renderOrderSummary();
        } else {
            window.location.href = '/cart';
        }
    } catch (error) {
        console.error('Error loading cart:', error);
        window.location.href = '/cart';
    }
}

function renderOrderSummary() {
    const container = document.getElementById('orderItems');

    container.innerHTML = cart.items
        .map(
            (item) => `
        <div class="order-item">
            <img src="${item.product.images[0]?.url || '/images/placeholder.png'}"
                 alt="${item.product.name}"
                 class="order-item-image">
            <div class="order-item-details">
                <div class="order-item-name">${item.product.name}</div>
                <div class="order-item-variant">
                    Size: ${item.variant.size} × ${item.quantity}
                </div>
            </div>
            <div class="order-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `
        )
        .join('');

    updateTotals();
}

/* ============================================================
   SHIPPING CALCULATION
============================================================ */
async function calculateShipping() {
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value.trim();
    const zip = document.getElementById('zipCode').value.trim();
    const country = document.getElementById('country').value;

    if (!city || !state || !zip || !country) return;

    try {
        const response = await fetch('/api/checkout/calculate-shipping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: {
                    city,
                    state,
                    postalCode: zip,
                    country,
                },
            }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        shippingCost = result.data.shipping;
        updateTotals();

        Common.showNotification(
            `Shipping calculated: $${shippingCost.toFixed(2)}`,
            'success',
            2000
        );
    } catch (err) {
        console.error('Shipping error:', err);
        Common.showNotification('Failed to calculate shipping', 'error');
    }
}

/* ============================================================
   TOTALS
============================================================ */
async function updateTotals() {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const donationAmount = await getDonationAmount();
    const total = subtotal + shippingCost;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('shipping').textContent = shippingCost
        ? `$${shippingCost.toFixed(2)}`
        : 'Enter address';
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;

    document.getElementById('donationInfo').textContent =
        `We will donate $${donationAmount.toFixed(2)} to Palestine from this purchase`;
}

async function getDonationAmount() {
    try {
        const response = await fetch('/api/settings/donation_per_purchase');
        const result = await response.json();
        return result.success ? result.data : 5.0;
    } catch {
        return 5.0;
    }
}

/* ============================================================
   SUBMIT ORDER
============================================================ */
async function handleSubmit(e) {
    e.preventDefault();
    if (!Common.validateForm('checkoutForm')) return;

    const btn = document.getElementById('submitBtn');
    Common.showLoading(btn);

    try {
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                payment_method_data: {
                    billing_details: {
                        name:
                            document.getElementById('firstName').value +
                            ' ' +
                            document.getElementById('lastName').value,
                        email: document.getElementById('email').value,
                        address: {
                            line1: document.getElementById('address1').value,
                            line2: document.getElementById('address2').value,
                            city: document.getElementById('city').value,
                            state: document.getElementById('state').value,
                            postal_code: document.getElementById('zipCode').value,
                            country: document.getElementById('country').value,
                        },
                        phone: document.getElementById('phone').value || '',
                    },
                },
            },
            redirect: 'if_required',
        });

        if (error) throw new Error(error.message);

        const confirmResponse = await fetch('/api/checkout/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                shippingAddress: {
                    line1: document.getElementById('address1').value,
                    line2: document.getElementById('address2').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    postalCode: document.getElementById('zipCode').value,
                    country: document.getElementById('country').value,
                },
                customer: {
                    email: document.getElementById('email').value,
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value,
                    phone: document.getElementById('phone').value || '',
                },
            }),
        });

        const result = await confirmResponse.json();
        if (!result.success) throw new Error(result.message);

        window.location.href = `/order-confirmation/${result.data.orderNumber}`;
    } catch (error) {
        console.error('Checkout error:', error);
        Common.showNotification(error.message || 'Payment failed', 'error');
    } finally {
        Common.hideLoading(btn);
    }
}
