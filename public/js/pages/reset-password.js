renderNav(null);

const root = document.getElementById('reset-root');
const token = qs('token');

if (!token) {
  root.innerHTML = `<div class="empty-state">This reset link is missing its token. <a href="/login.html" style="text-decoration:underline;">Back to sign in</a></div>`;
} else {
  root.innerHTML = `
    <h1 style="font-size:1.4rem; text-align:center;">Choose a new password</h1>
    <p class="muted" style="text-align:center; font-size:.88rem;">This link works once and expires 30 minutes after it was created.</p>
    <form id="reset-form" style="margin-top:18px;">
      <div class="measure-field"><label>New password</label><input id="new-password" type="password" required placeholder="At least 8 characters"></div>
      <button class="btn btn-primary btn-block" type="submit" id="reset-submit">Update password</button>
    </form>
  `;

  document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('reset-submit');
    btn.disabled = true; btn.textContent = 'Updating…';
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: document.getElementById('new-password').value }) });
      root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.heart}</span>Password updated. You've been signed out everywhere for safety — sign in with your new password.<div style="margin-top:16px;"><a class="btn btn-primary" href="/login.html">Sign in</a></div></div>`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false; btn.textContent = 'Update password';
    }
  });
}
