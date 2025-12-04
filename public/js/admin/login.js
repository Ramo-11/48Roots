document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const togglePassword = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');

    // Toggle password visibility
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;

            const icon = togglePassword.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }

    // Handle form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            // Clear previous errors
            loginError.classList.remove('show');
            loginError.textContent = '';

            // Validate
            if (!username || !password) {
                showError('Please enter both username and password.');
                return;
            }

            // Show loading state
            submitBtn.classList.add('loading');

            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const result = await response.json();

                if (result.success) {
                    // Redirect to admin dashboard
                    window.location.href = result.redirect || '/admin';
                } else {
                    showError(result.message || 'Invalid credentials. Please try again.');
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('An error occurred. Please try again.');
            } finally {
                submitBtn.classList.remove('loading');
            }
        });
    }

    function showError(message) {
        loginError.textContent = message;
        loginError.classList.add('show');

        // Shake animation
        loginError.style.animation = 'none';
        setTimeout(() => {
            loginError.style.animation = 'shake 0.5s ease';
        }, 10);
    }
});

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);
