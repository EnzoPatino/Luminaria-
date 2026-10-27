document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('loginPassword');
  const passwordToggle = document.getElementById('toggleLoginPassword');
  const loginForm = document.getElementById('loginForm');

  if (!passwordInput || !passwordToggle) return;

  function setPasswordVisibility(visible) {
    passwordInput.type = visible ? 'text' : 'password';
    passwordToggle.textContent = visible ? 'Ocultar' : 'Mostrar';
    passwordToggle.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} contraseña`);
    passwordToggle.setAttribute('aria-pressed', String(visible));
  }

  passwordToggle.addEventListener('click', () => {
    setPasswordVisibility(passwordInput.type === 'password');
  });

  loginForm?.addEventListener('reset', () => setPasswordVisibility(false));
});
