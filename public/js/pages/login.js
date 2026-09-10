renderNav(null);

const root = document.getElementById('auth-root');
let mode = 'login';
const redirectTo = qs('redirect') || '/index.html';

function render() {
  if (mode === 'forgot') { renderForgot(); return; }

  root.innerHTML = `
    <h1 style="font-size:1.4rem; text-align:center;">${mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
    <p class="muted" style="text-align:center; font-size:.88rem;">${mode === 'login' ? 'Sign in to track your orders and saved measurements.' : 'Save your measurements once and track every order in one place.'}</p>

    <div class="auth-toggle" style="margin-top:18px;">
      <button type="button" id="tab-login" class="${mode === 'login' ? 'active' : ''}">Sign in</button>
      <button type="button" id="tab-signup" class="${mode === 'signup' ? 'active' : ''}">Sign up</button>
    </div>

    <div id="google-btn-container" style="display:flex; justify-content:center; min-height:44px;"></div>
    <p class="demo-note" id="google-fallback-note" style="display:none;">Google sign-in needs an internet connection to load — check your connection and refresh.</p>

    <div class="auth-divider">or use your email</div>

    <form id="auth-form">
      ${mode === 'signup' ? `<div class="measure-field"><label>Full name</label><input id="a-name" required placeholder="e.g. Abena Owusu"></div>` : ''}
      <div class="measure-field"><label>Email</label><input id="a-email" type="email" required placeholder="you@example.com"></div>
      <div class="measure-field"><label>Password</label><input id="a-password" type="password" required placeholder="${mode === 'signup' ? 'At least 8 characters' : ''}"></div>
      ${mode === 'login' ? `<button type="button" id="forgot-link" class="link-btn">Forgot password?</button>` : ''}
      <button class="btn btn-primary btn-block" type="submit" id="auth-submit">${mode === 'login' ? 'Sign in' : 'Create account'}</button>
    </form>
  `;

  document.getElementById('tab-login').addEventListener('click', () => { mode = 'login'; render(); });
  document.getElementById('tab-signup').addEventListener('click', () => { mode = 'signup'; render(); });
  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) forgotLink.addEventListener('click', () => { mode = 'forgot'; render(); });

  renderGoogleButton();

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('auth-submit');
    const email = document.getElementById('a-email').value;
    const password = document.getElementById('a-password').value;
    btn.disabled = true; btn.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…';
    try {
      let result;
      if (mode === 'login') {
        result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      } else {
        const name = document.getElementById('a-name').value;
        result = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      }
      const STAFF_ROLES = ['admin', 'support', 'finance', 'moderator'];
      window.location.href = (result.role && STAFF_ROLES.includes(result.role)) ? '/admin.html' : redirectTo;
    } catch (err) {
      toast(err.message);
      btn.disabled = false; btn.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    }
  });
}

function renderForgot() {
  root.innerHTML = `
    <h1 style="font-size:1.4rem; text-align:center;">Reset your password</h1>
    <p class="muted" style="text-align:center; font-size:.88rem;">Enter your email and we'll generate a reset link.</p>
    <form id="forgot-form" style="margin-top:18px;">
      <div class="measure-field"><label>Email</label><input id="f-email" type="email" required placeholder="you@example.com"></div>
      <button class="btn btn-primary btn-block" type="submit" id="forgot-submit">Send reset link</button>
    </form>
    <div id="forgot-result" style="margin-top:14px;"></div>
    <button type="button" id="back-to-login" class="link-btn" style="margin-top:14px; display:block; text-align:center; width:100%;">&larr; Back to sign in</button>
  `;

  document.getElementById('back-to-login').addEventListener('click', () => { mode = 'login'; render(); });

  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('forgot-submit');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const result = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: document.getElementById('f-email').value }) });
      const resultEl = document.getElementById('forgot-result');
      if (result.sent) {
        resultEl.innerHTML = `
          <div class="consent-note">
            <p style="margin:0 0 8px;">${result.message}</p>
            <a href="${result.resetLink}" style="font-weight:700; word-break:break-all;">${window.location.origin}${result.resetLink}</a>
          </div>`;
      } else {
        resultEl.innerHTML = `<p class="muted" style="font-size:.85rem;">${result.message}</p>`;
      }
    } catch (err) {
      toast(err.message);
    }
    btn.disabled = false; btn.textContent = 'Send reset link';
  });
}

const GOOGLE_CLIENT_ID = '936750167312-ai5nhco6cchs8kknqk7jb0jdh9drnnaj.apps.googleusercontent.com';
let googleInitialized = false;
let googleRetries = 0;

function renderGoogleButton() {
  const container = document.getElementById('google-btn-container');
  const fallback = document.getElementById('google-fallback-note');
  if (!container) return;

  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
    // The script loads async and may just not be ready yet — retry for a
    // few seconds before concluding it actually failed to load.
    if (googleRetries < 15) {
      googleRetries++;
      setTimeout(renderGoogleButton, 200);
      return;
    }
    container.style.display = 'none';
    if (fallback) fallback.style.display = 'block';
    return;
  }

  if (fallback) fallback.style.display = 'none';
  container.style.display = 'flex';
  if (!googleInitialized) {
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    googleInitialized = true;
  }
  container.innerHTML = '';
  google.accounts.id.renderButton(container, {
    theme: 'outline', size: 'large', width: 300,
    text: mode === 'signup' ? 'signup_with' : 'signin_with'
  });
}

async function handleGoogleCredential(response) {
  try {
    await api('/api/auth/google-verify', { method: 'POST', body: JSON.stringify({ credential: response.credential }) });
    window.location.href = redirectTo;
  } catch (err) { toast(err.message); }
}

render();
