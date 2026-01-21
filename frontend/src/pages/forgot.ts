import { requestPasswordReset, confirmPasswordReset } from "../services/api";
import { router } from "../router";

export function renderForgot() {
  const app = document.getElementById('app')!;
  app.textContent = '';
  
  // Remove padding/margin from app to prevent overflow
  app.className = 'w-full';
  app.style.padding = '0';
  app.style.margin = '0';

  // Wrapper to center content vertically - full viewport minus navbar
  const wrapper = document.createElement('div');
  wrapper.className = 'h-[calc(100vh-4rem)] w-full flex items-center justify-center px-4';

  const card = document.createElement('div'); card.className = 'max-w-md w-full bg-slate-800 p-6 rounded shadow-lg';
  const h2 = document.createElement('h2'); h2.className = 'text-2xl font-semibold mb-4 text-white'; h2.textContent = 'Reset your password';
  const p = document.createElement('p'); p.className = 'text-sm text-slate-400 mb-4'; p.textContent = 'Enter your email to receive a password reset token. For development the token will be logged to the server console.';

  const form = document.createElement('form'); form.id = 'resetRequestForm';
  const input = document.createElement('input'); input.id = 'resetEmail'; input.type = 'email'; input.required = true; input.placeholder = 'you@example.com'; input.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 mb-3';
  const btn = document.createElement('button'); btn.type = 'submit'; btn.className = 'w-full bg-indigo-600 px-4 py-3 rounded text-white font-bold'; btn.textContent = 'Request Reset';
  form.appendChild(input); form.appendChild(btn);

  const hr = document.createElement('div'); hr.className = 'my-4 border-t border-gray-700';

  const h3 = document.createElement('h3'); h3.className = 'text-lg font-medium text-white mb-2'; h3.textContent = 'Have a token? Reset now';
  const form2 = document.createElement('form'); form2.id = 'resetConfirmForm';
  const tokenInput = document.createElement('input'); tokenInput.id = 'resetToken'; tokenInput.placeholder = 'paste token here'; tokenInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 mb-3';
  const newPass = document.createElement('input'); newPass.id = 'newPassword'; newPass.type = 'password'; newPass.placeholder = 'new password'; newPass.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 mb-3';
  const btn2 = document.createElement('button'); btn2.type = 'submit'; btn2.className = 'w-full bg-green-600 px-4 py-3 rounded text-white font-bold'; btn2.textContent = 'Reset Password';
  form2.appendChild(tokenInput); form2.appendChild(newPass); form2.appendChild(btn2);

  const msg = document.createElement('div'); msg.id = 'forgotMsg'; msg.className = 'text-center text-sm mt-3';

  card.appendChild(h2); card.appendChild(p); card.appendChild(form); card.appendChild(hr); card.appendChild(h3); card.appendChild(form2); card.appendChild(msg);
  wrapper.appendChild(card);
  app.appendChild(wrapper);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('resetEmail') as HTMLInputElement).value.trim();
    const btn = form.querySelector('button') as HTMLButtonElement;
    if (!email) return;
    btn.disabled = true; btn.textContent = 'Requesting...';
    try {
      const res = await requestPasswordReset(email);
      if (res.ok) {
        msg.className = 'text-center text-sm text-green-400';
        msg.textContent = 'If that email exists, a reset token was generated. Check the server logs in development.';
      } else {
        msg.className = 'text-center text-sm text-red-400';
        msg.textContent = res.body?.error || 'Request failed';
      }
    } catch (err) {
      msg.className = 'text-center text-sm text-red-400';
      msg.textContent = 'Network error';
    } finally {
      btn.disabled = false; btn.textContent = 'Request Reset';
    }
  });

  form2.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = (document.getElementById('resetToken') as HTMLInputElement).value.trim();
    const password = (document.getElementById('newPassword') as HTMLInputElement).value;
    const btn = form2.querySelector('button') as HTMLButtonElement;
    if (!token || !password) return;
    btn.disabled = true; btn.textContent = 'Resetting...';
    try {
      const res = await confirmPasswordReset(token, password);
      if (res.ok) {
        msg.className = 'text-center text-sm text-green-400';
        msg.textContent = 'Password reset successful. You may now sign in.';
        setTimeout(() => router.navigate('/auth'), 1200);
      } else {
        msg.className = 'text-center text-sm text-red-400';
        msg.textContent = res.body?.error || 'Reset failed';
      }
    } catch (err) {
      msg.className = 'text-center text-sm text-red-400';
      msg.textContent = 'Network error';
    } finally {
      btn.disabled = false; btn.textContent = 'Reset Password';
    }
  });
}
