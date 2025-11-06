let cart = { items: [], subtotal: 0 };

document.addEventListener('DOMContentLoaded', async () => {
    await loadCart();
    document.getElementById('checkoutBtn').addEventListener('click', () => {
        if (cart.items.length) {
            window.location.href = '/checkout';
        }
    });
});

async function loadCart() {
    try {
        const response = await fetch('/api/cart');
        const result = await response.json();

        if (result.success) {
            cart = result.data;
            renderCart();
        }
    } catch (error) {
        console.error('Error loading cart:', error);
        renderEmptyCart();
    }
}

function renderCart() {
    const container = document.getElementById('cartItems');

    if (!cart.items || !cart.items.length) {
        renderEmptyCart();
        return;
    }

    container.innerHTML = cart.items
        .map(
            (item, index) => `
        <div class="cart-item">
            <img src="${item.product.images[0]?.url || '/images/placeholder.png'}" 
                 alt="${item.product.name}" 
                 class="cart-item-image">
            
            <div class="cart-item-details">
                <div>
                    <h3 class="cart-item-name">${item.product.name}</h3>
                    <p class="cart-item-variant">Size: ${item.variant.size}</p>
                </div>
                
                <div class="cart-item-actions">
                    <div class="cart-item-quantity">
                        <button class="qty-btn" onclick="updateQuantity(${index}, ${item.quantity - 1})">-</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity(${index}, ${item.quantity + 1})">+</button>
                    </div>
                    <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
                </div>
            </div>

            <div class="cart-item-price-section">
                <span class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        </div>
    `
        )
        .join('');

    updateSummary();
}

function renderEmptyCart() {
    const container = document.getElementById('cartItems');
    container.innerHTML = `
        <div class="empty-cart">
            <i class="fas fa-shopping-cart"></i>
            <h2>Your cart is empty</h2>
            <p>Add some items to get started!</p>
            <a href="/shop" class="btn btn-primary">Start Shopping</a>
        </div>
    `;

    document.querySelector('.cart-summary').style.display = 'none';
}

async function updateQuantity(index, newQuantity) {
    if (newQuantity < 1) return;

    const item = cart.items[index];

    try {
        const response = await fetch('/api/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: item.product._id,
                variant: item.variant,
                quantity: newQuantity,
            }),
        });

        const result = await response.json();

        if (result.success) {
            await loadCart();
            updateCartCount();
        } else {
            Common.showNotification(result.message || 'Failed to update cart', 'error');
        }
    } catch (error) {
        console.error('Error updating cart:', error);
        Common.showNotification('Failed to update cart', 'error');
    }
}

async function removeItem(index) {
    const item = cart.items[index];

    try {
        const response = await fetch('/api/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: item.product._id,
                variant: item.variant,
            }),
        });

        const result = await response.json();

        if (result.success) {
            await loadCart();
            updateCartCount();
            Common.showNotification('Item removed from cart', 'info');
        } else {
            Common.showNotification(result.message || 'Failed to remove item', 'error');
        }
    } catch (error) {
        console.error('Error removing item:', error);
        Common.showNotification('Failed to remove item', 'error');
    }
}

async function updateSummary() {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const donationAmount = await getDonationAmount();
    const total = subtotal + donationAmount;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('donation').textContent = `$${donationAmount.toFixed(2)}`;
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

function updateCartCount() {
    const count = cart.items.reduce((total, item) => total + item.quantity, 0);
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
        cartCountEl.textContent = count;
    }
}
