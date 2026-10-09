/* Gestión de sesión del panel. El token solo habilita la interfaz tras validarse en el servidor. */
(function () {
  const TOKEN_KEY = 'luminaria_access_token';
  const USER_KEY = 'luminaria_session_user';
  const apiBase = () => window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  function setMessage(message, kind = 'error') {
    const node = document.getElementById('loginMessage');
    if (!node) return;
    node.textContent = message;
    node.className = `login-message ${kind}`;
  }
  function showLogin(message) {
    document.body.classList.remove('session-ready');
    document.body.classList.add('session-required');
    if (message) setMessage(message);
  }
  function showApp(user) {
    window.luminariaAuth = { user, token: getToken() };
    document.documentElement.setAttribute('data-role', user.rol);
    document.body.classList.remove('session-required');
    document.body.classList.add('session-ready');
    const name = document.getElementById('sessionUserName');
    const role = document.getElementById('sessionUserRole');
    if (name) name.textContent = user.nombre;
    if (role) role.textContent = user.rol === 'admin' ? 'Administrador' : 'Técnico';
    window.dispatchEvent(new CustomEvent('luminaria:authenticated', { detail: user }));
  }

  async function verifySession() {
    const token = getToken();
    if (!token) return showLogin();
    try {
      const response = await fetch(`${apiBase()}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('expired');
      const body = await response.json();
      if (!body?.data) throw new Error('invalid');
      localStorage.setItem(USER_KEY, JSON.stringify(body.data));
      showApp(body.data);
    } catch (_) {
      clearSession();
      showLogin('Tu sesión venció. Ingresá nuevamente para continuar.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const button = document.getElementById('loginSubmit');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const identifier = document.getElementById('loginIdentifier').value.trim();
      const password = document.getElementById('loginPassword').value;
      button.disabled = true;
      button.textContent = 'Ingresando…';
      setMessage('');
      try {
        const response = await fetch(`${apiBase()}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identifier, password }),
        });
        const body = await response.json();
        if (!response.ok || !body?.data?.token) throw new Error(body?.message || 'No se pudo iniciar sesión.');
        localStorage.setItem(TOKEN_KEY, body.data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(body.data.usuario));
        showApp(body.data.usuario);
        form.reset();
      } catch (error) {
        setMessage(error.message || 'No se pudo iniciar sesión.');
      } finally {
        button.disabled = false;
        button.textContent = 'Ingresar';
      }
    });
    document.getElementById('logoutButton')?.addEventListener('click', () => {
      clearSession();
      window.location.reload();
    });
    verifySession();
  });

  window.luminariaRequest = async function (path, options = {}) {
    const token = getToken();
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    if (response.status === 401) { clearSession(); showLogin('Tu sesión venció. Ingresá nuevamente para continuar.'); }
    return response;
  };
})();
