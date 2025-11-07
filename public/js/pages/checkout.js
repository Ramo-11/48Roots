let stripe, elements;
let cart = { items: [], subtotal: 0 };
let shippingCost = 0;
let clientSecret = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.Stripe || !window.STRIPE_CONFIG?.publicKey) {
        Common.showNotification('Payment system not configured', 'error');
        return;
    }

    stripe = Stripe(window.STRIPE_CONFIG.publicKey);

    await loadCart();
    await initializePayment();

    document.getElementById('checkoutForm').addEventListener('submit', handleSubmit);

    ['city', 'state', 'zipCode'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('blur', calculateShipping);
        }
    });
});

async function initializePayment() {
    try {
        const response = await fetch('/api/checkout/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Failed to initialize payment');
        }

        clientSecret = result.data.clientSecret;

        elements = stripe.elements({
            clientSecret: clientSecret,
            appearance: {
                theme: 'stripe',
            },
        });

        const paymentElement = elements.create('payment', {
            layout: 'tabs',
        });

        paymentElement.mount('#payment-element');

        paymentElement.on('change', (event) => {
            const errorElement = document.getElementById('payment-errors');
            if (event.error) {
                errorElement.textContent = event.error.message;
            } else {
                errorElement.textContent = '';
            }
        });
    } catch (error) {
        console.error('Payment initialization error:', error);
        Common.showNotification('Failed to initialize payment', 'error');
    }
}

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
                <div class="order-item-variant">Size: ${item.variant.size} × ${item.quantity}</div>
            </div>
            <div class="order-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `
        )
        .join('');

    updateTotals();
}

async function calculateShipping() {
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value.trim();
    const zipCode = document.getElementById('zipCode').value.trim();

    if (!city || !state || !zipCode) {
        console.log('Missing address fields:', { city, state, zipCode });
        return;
    }

    console.log('Calculating shipping for:', { city, state, zipCode });

    try {
        const response = await fetch('/api/checkout/calculate-shipping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: {
                    city,
                    state,
                    postalCode: zipCode,
                    country: 'US',
                },
            }),
        });

        const result = await response.json();
        console.log('Shipping calculation result:', result);

        if (result.success) {
            shippingCost = result.data.shipping;
            updateTotals();
            Common.showNotification(
                `Shipping calculated: $${shippingCost.toFixed(2)}`,
                'success',
                2000
            );
        } else {
            console.error('Shipping calculation failed:', result.message);
            Common.showNotification(result.message || 'Failed to calculate shipping', 'error');
        }
    } catch (error) {
        console.error('Error calculating shipping:', error);
        Common.showNotification('Failed to calculate shipping', 'error');
    }
}

async function updateTotals() {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const donationAmount = await getDonationAmount();
    const total = subtotal + shippingCost;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('shipping').textContent =
        shippingCost === 0 ? 'Enter address' : `$${shippingCost.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('donationInfo').textContent =
        `We will donate $${donationAmount.toFixed(2)} to Palestine from this purchase`;
}

async function getDonationAmount() {
    try {
        const response = await fetch('/api/settings/donation_per_purchase');
        const result = await response.json();
        return result.success ? result.data : 5.0;
    } catch (error) {
        return 5.0;
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    if (!Common.validateForm('checkoutForm')) {
        return;
    }

    const btn = document.getElementById('submitBtn');
    Common.showLoading(btn);

    try {
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                payment_method_data: {
                    billing_details: {
                        name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
                        email: document.getElementById('email').value,
                        address: {
                            line1: document.getElementById('address1').value,
                            line2: document.getElementById('address2').value || '',
                            city: document.getElementById('city').value,
                            state: document.getElementById('state').value,
                            postal_code: document.getElementById('zipCode').value,
                            country: 'US',
                        },
                        phone: document.getElementById('phone').value || '',
                    },
                },
            },
            redirect: 'if_required',
        });

        if (error) {
            throw new Error(error.message);
        }

        const confirmResponse = await fetch('/api/checkout/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                shippingAddress: {
                    line1: document.getElementById('address1').value,
                    line2: document.getElementById('address2').value || '',
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    postalCode: document.getElementById('zipCode').value,
                    country: 'US',
                },
                customer: {
                    email: document.getElementById('email').value,
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value,
                    phone: document.getElementById('phone').value || '',
                },
            }),
        });

        const confirmResult = await confirmResponse.json();

        if (confirmResult.success) {
            window.location.href = `/order-confirmation/${confirmResult.data.orderNumber}`;
        } else {
            throw new Error(confirmResult.message || 'Failed to confirm order');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        Common.showNotification(error.message || 'Payment failed', 'error');
    } finally {
        Common.hideLoading(btn);
    }
}
