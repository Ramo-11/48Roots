let stripe, cardElement;
let cart = { items: [], subtotal: 0 };

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Stripe === 'undefined' || !window.CONFIG?.publicKey) {
        Common.showNotification('Payment system not configured', 'error');
        return;
    }

    stripe = Stripe(window.CONFIG.publicKey);
    const elements = stripe.elements();

    cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#1f2937',
                '::placeholder': {
                    color: '#9ca3af',
                },
            },
        },
    });

    cardElement.mount('#card-element');
    cardElement.on('change', handleCardChange);

    await loadCart();

    document.getElementById('checkoutForm').addEventListener('submit', handleSubmit);
});

function handleCardChange(event) {
    const errorElement = document.getElementById('card-errors');
    if (event.error) {
        errorElement.textContent = event.error.message;
    } else {
        errorElement.textContent = '';
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

async function updateTotals() {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const donationAmount = await getDonationAmount();
    const shipping = 0;
    const total = subtotal + donationAmount + shipping;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('donation').textContent = `$${donationAmount.toFixed(2)}`;
    document.getElementById('shipping').textContent =
        shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
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
        const sessionResponse = await fetch('/api/checkout/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        const sessionResult = await sessionResponse.json();

        if (!sessionResult.success) {
            throw new Error(sessionResult.message || 'Failed to create checkout session');
        }

        const { error, paymentIntent } = await stripe.confirmCardPayment(
            sessionResult.data.clientSecret,
            {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
                        email: document.getElementById('email').value,
                        address: {
                            line1: document.getElementById('address1').value,
                            line2: document.getElementById('address2').value,
                            city: document.getElementById('city').value,
                            state: document.getElementById('state').value,
                            postal_code: document.getElementById('zipCode').value,
                            country: 'US',
                        },
                    },
                },
            }
        );

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
                    line2: document.getElementById('address2').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    postalCode: document.getElementById('zipCode').value,
                    country: 'US',
                },
                customer: {
                    email: document.getElementById('email').value,
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value,
                    phone: document.getElementById('phone').value,
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
