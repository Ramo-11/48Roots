document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contactForm');
    form.addEventListener('submit', handleSubmit);
});

async function handleSubmit(e) {
    e.preventDefault();

    if (!Common.validateForm('contactForm')) {
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    Common.showLoading(btn);

    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        subject: document.getElementById('subject').value.trim(),
        message: document.getElementById('message').value.trim(),
    };

    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (result.success) {
            Common.showNotification('Message sent successfully!', 'success');
            document.getElementById('contactForm').reset();
        } else {
            Common.showNotification(result.message || 'Failed to send message', 'error');
        }
    } catch (error) {
        console.error('Error submitting contact form:', error);
        Common.showNotification('Failed to send message', 'error');
    } finally {
        Common.hideLoading(btn);
    }
}
