import { setToken } from "../services/api";
import { initAuth } from "../stores/authState";
import { router } from "../router";

export function renderOAuthSuccess() {
  const hash = window.location.hash.substring(1);
  const urlParams = new URLSearchParams(hash);
  const token = urlParams.get('token');
  const username = urlParams.get('username');
  const error = urlParams.get('error');

  const app = document.getElementById("app")!;
  
  if (error) {
    app.textContent = '';
    const card = document.createElement('div');
    card.className = 'max-w-md mx-auto bg-slate-800 p-6 rounded shadow-lg text-center';
    const icon = document.createElement('div'); icon.className = 'text-6xl mb-4'; icon.textContent = '❌';
    const h2 = document.createElement('h2'); h2.className = 'text-2xl font-semibold mb-4'; h2.textContent = 'Authentication Failed';
    const p = document.createElement('p'); p.className = 'text-slate-400 mb-6'; p.textContent = 'There was an error during authentication. Please try again.';
    const retryBtn = document.createElement('button'); retryBtn.id = 'retryBtn'; retryBtn.className = 'px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500'; retryBtn.textContent = 'Try Again';
    retryBtn.addEventListener('click', () => router.navigate('/login'));
    card.appendChild(icon); card.appendChild(h2); card.appendChild(p); card.appendChild(retryBtn);
    app.appendChild(card);
    return;
  }

  if (token && username) {
    // Store token (treat OAuth logins as persistent) and initialize auth
    setToken(token, true);
    initAuth().then(() => {
      app.textContent = '';
      const card = document.createElement('div');
      card.className = 'max-w-md mx-auto bg-slate-800 p-6 rounded shadow-lg text-center';
      const icon = document.createElement('div'); icon.className = 'text-6xl mb-4'; icon.textContent = '✅';
      const h2 = document.createElement('h2'); h2.className = 'text-2xl font-semibold mb-4'; h2.textContent = `Welcome, ${username}!`;
      const p = document.createElement('p'); p.className = 'text-slate-400 mb-6'; p.textContent = 'Successfully authenticated with GitHub.';
      const spinner = document.createElement('div'); spinner.className = 'animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4';
      const redirectText = document.createElement('p'); redirectText.className = 'text-sm text-slate-500'; redirectText.textContent = 'Redirecting...';
      card.appendChild(icon); card.appendChild(h2); card.appendChild(p); card.appendChild(spinner); card.appendChild(redirectText);
      app.appendChild(card);

      setTimeout(() => {
        router.navigate('/profile');
      }, 2000);
    });
  } else {
    app.textContent = '';
    const card = document.createElement('div');
    card.className = 'max-w-md mx-auto bg-slate-800 p-6 rounded shadow-lg text-center';
    const icon = document.createElement('div'); icon.className = 'text-6xl mb-4'; icon.textContent = '⚠️';
    const h2 = document.createElement('h2'); h2.className = 'text-2xl font-semibold mb-4'; h2.textContent = 'Invalid Authentication';
    const p = document.createElement('p'); p.className = 'text-slate-400 mb-6'; p.textContent = 'Missing authentication parameters.';
    const loginBtn = document.createElement('button'); loginBtn.id = 'loginBtn'; loginBtn.className = 'px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500'; loginBtn.textContent = 'Go to Login';
    loginBtn.addEventListener('click', () => router.navigate('/login'));
    card.appendChild(icon); card.appendChild(h2); card.appendChild(p); card.appendChild(loginBtn);
    app.appendChild(card);
  }
}