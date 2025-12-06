// Login Page JavaScript (Admin Only)

// Toggle password visibility
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('passwordToggleIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    const submitBtn = loginForm.querySelector('.btn-login');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Simple fallback notification
    function showError(message) {
        alert(message); // Replace with SweetAlert, Toastify, etc. if you want later
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        submitBtn.disabled = true;

        const formData = {
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value,
        };

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = '/admin/dashboard';
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            showError(error.message || 'Invalid username or password');

            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
            submitBtn.disabled = false;

            loginForm.classList.add('shake');
            setTimeout(() => loginForm.classList.remove('shake'), 500);
        }
    });

    // Shake CSS injection
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      .shake {
        animation: shake 0.5s;
      }
    `;
    document.head.appendChild(style);
});
