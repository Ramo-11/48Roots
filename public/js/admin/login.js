document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoading = loginBtn.querySelector('.btn-loading');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showError('Please enter username and password');
            return;
        }

        setLoading(true);
        hideError();

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = '/admin';
            } else {
                showError(data.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(loading) {
        loginBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline-flex';
        btnLoading.style.display = loading ? 'inline-flex' : 'none';
    }

    function showError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }

    function hideError() {
        loginError.style.display = 'none';
    }
});
