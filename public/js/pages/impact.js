document.addEventListener('DOMContentLoaded', async () => {
    await loadDonationAmount();
});

async function loadDonationAmount() {
    try {
        const response = await fetch('/api/settings/donation_per_purchase');
        const result = await response.json();

        if (result.success) {
            document.getElementById('donationAmount').textContent = `$${result.data.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Error loading donation amount:', error);
    }
}
