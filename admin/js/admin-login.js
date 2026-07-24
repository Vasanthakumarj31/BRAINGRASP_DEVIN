/* BrainGrasp Admin — Login */
(function () {
  const { redirectIfAuthenticated, publicFetch, setToken, showToast } = window.AdminApp;

  redirectIfAuthenticated();

  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('loginError');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    try {
      const res = await publicFetch('/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginForm.username.value.trim(),
          password: loginForm.password.value
        })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setToken(data.token);
        window.location.href = 'dashboard.html';
      } else {
        errorDiv.textContent = data.error || 'Invalid credentials';
        errorDiv.style.display = 'block';
      }
    } catch {
      errorDiv.textContent = 'Cannot reach the server. Check your connection or try again later.';
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In →';
    }
  });
})();
