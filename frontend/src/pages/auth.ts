// frontend/src/pages/auth.ts
import { loginUser, registerUser } from "../services/api";
import { router } from "../router";
import { setToken } from "../services/api";
import { initAuth } from "../stores/authState";
import { OAuthButtons } from "../components/auth/oauthButtons";

export function renderAuth() {
  const app = document.getElementById("app")!;

  app.innerHTML = `
    <div class="fixed inset-0 z-50">
      <!-- Animated Background Effects -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]"></div>
        <div class="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-indigo-600/10 blur-[100px]"></div>
      </div>

      <div class="h-screen w-full flex items-center justify-center p-3 md:p-4 relative">
        <div class="w-full max-w-5xl max-h-[95vh] flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
          <!-- Left Side - Brand/Game Info -->
          <div class="hidden md:flex md:w-5/12 bg-gradient-to-br from-indigo-600 via-purple-700 to-purple-900 p-6 md:p-8 text-white flex-col justify-center relative overflow-hidden">
            <!-- Decorative elements -->
            <div class="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
            <div class="absolute -top-24 -left-24 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl"></div>
            
            <div class="relative z-10 text-center md:text-left">
              <div class="flex items-center justify-center md:justify-start space-x-4 mb-4">
                <div class="text-6xl filter drop-shadow-lg transform hover:scale-110 transition-transform duration-300">🎮</div>
                <h1 class="text-4xl font-bold tracking-tight">PongSocial</h1>
              </div>
              <p class="text-indigo-100 text-lg mb-4 leading-relaxed font-light">The ultimate Pong gaming experience. Join the community today.</p>
              
              <!-- Features List -->
              <div class="space-y-3">
                <div class="flex items-center space-x-4 bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div class="text-2xl">🏆</div>
                  <span class="text-indigo-50 font-medium">Competitive Tournaments</span>
                </div>
                <div class="flex items-center space-x-4 bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div class="text-2xl">👥</div>
                  <span class="text-indigo-50 font-medium">Play with Friends</span>
                </div>
                <div class="flex items-center space-x-4 bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div class="text-2xl">🤖</div>
                  <span class="text-indigo-50 font-medium">AI Challenges</span>
                </div>
                <div class="flex items-center space-x-4 bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div class="text-2xl">💬</div>
                  <span class="text-indigo-50 font-medium">Live Chat</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Side - Auth Forms -->
          <div class="md:w-7/12 bg-slate-900/50 p-6 md:p-8 overflow-y-auto">
            <!-- Tabs -->
            <div class="flex space-x-6 mb-4 border-b border-slate-700">
              <button 
                id="loginTab" 
                class="pb-4 px-2 font-semibold text-lg border-b-2 border-indigo-500 text-white transition-all hover:text-indigo-400"
              >
                Sign In
              </button>
              <button 
                id="registerTab" 
                class="pb-4 px-2 font-semibold text-lg text-slate-400 border-b-2 border-transparent hover:text-white transition-all"
              >
                Create Account
              </button>
            </div>

            <!-- Login Form -->
            <div id="loginForm" class="space-y-4">
              <div>
                <h2 class="text-3xl font-bold text-white mb-2">Welcome Back!</h2>
                <p class="text-slate-400">Sign in to continue your Pong journey</p>
              </div>

              <form id="loginFormContent">
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-slate-300 mb-2">
                      Username or Email
                    </label>
                    <input 
                      id="loginIdentifier"
                      type="text" 
                      required
                      class="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:bg-slate-800"
                      placeholder="Enter your username or email"
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-slate-300 mb-2">
                      Password
                    </label>
                    <input 
                      id="loginPass" 
                      type="password" 
                      required
                      class="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:bg-slate-800"
                      placeholder="Enter your password"
                    >
                  </div>

                  <div class="flex items-center justify-between">
                    <label class="flex items-center space-x-2 cursor-pointer group">
                      <input id="rememberMe" type="checkbox" class="text-indigo-500 rounded border-slate-600 bg-slate-800 focus:ring-indigo-500">
                      <span class="text-sm text-slate-300 group-hover:text-white transition-colors">Remember me</span>
                    </label>
                    <button id="forgotBtn" type="button" class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                      Forgot password?
                    </button>
                  </div>
                  <div id="oauth-buttons" class="mt-4"></div>
                  <button 
                    type="submit"
                    id="doLogin"
                    class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg shadow-indigo-500/20"
                  >
                    <span class="flex items-center justify-center space-x-2">
                      <span>🎯</span>
                      <span>Sign In</span>
                    </span>
                  </button>
                </div>
              </form>

              <!-- Quick Access Buttons -->
              <div class="mt-4 pt-4 border-t border-slate-700">
                <p class="text-sm text-slate-400 mb-3 text-center">Or explore without signing in:</p>
                <button 
                  id="playPongBtn"
                  class="w-full bg-slate-800/50 hover:bg-slate-700/50 text-white font-semibold py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02] border border-slate-600 hover:border-indigo-500"
                >
                  <span class="flex items-center justify-center space-x-2">
                    <span>🎮</span>
                    <span>Play Pong</span>
                  </span>
                </button>
              </div>

              <div class="text-center pt-2">
                <p class="text-slate-400">
                  Don't have an account? 
                  <button id="switchToRegister" class="text-indigo-400 hover:text-indigo-300 font-medium transition-colors ml-1 hover:underline">
                    Create one now
                  </button>
                </p>
              </div>

              <div id="loginMsg" class="text-center text-sm min-h-[20px]"></div>
            </div>

            <!-- 2FA Form -->
            <div id="twoFactorForm" class="space-y-4 hidden">
               <div>
                 <h2 class="text-3xl font-bold text-white mb-2">Two-Factor Authentication</h2>
                 <p class="text-slate-400">Enter the code from your authenticator app</p>
               </div>
               
               <form id="twoFactorFormContent">
                 <div class="space-y-3">
                   <div>
                     <label class="block text-sm font-medium text-slate-300 mb-2">2FA Code</label>
                     <input 
                       id="twoFactorCode" 
                       type="text" 
                       inputmode="numeric"
                       pattern="[0-9]*"
                       maxlength="6"
                       class="w-full px-4 py-4 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-center tracking-[0.5em] text-2xl font-mono"
                       placeholder="000000"
                     >
                   </div>
                   
                   <button 
                     type="submit"
                     id="verify2FA"
                     class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-500/20"
                   >
                     Verify
                   </button>
                   
                   <button 
                     type="button"
                     id="cancel2FA"
                     class="w-full text-slate-400 hover:text-white transition-colors py-2"
                   >
                     Cancel
                   </button>
                 </div>
               </form>
               <div id="twoFactorMsg" class="text-center text-sm"></div>
            </div>

            <!-- Register Form -->
            <div id="registerForm" class="space-y-4 hidden">
              <div>
                <h2 class="text-3xl font-bold text-white mb-2">Join PongSocial!</h2>
                <p class="text-slate-400">Create your account and start playing</p>
              </div>

              <form id="registerFormContent">
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-slate-300 mb-2">
                      Username
                    </label>
                    <input 
                      id="regUser" 
                      type="text" 
                      required
                      class="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:bg-slate-800"
                      placeholder="Choose a username"
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-slate-300 mb-2">
                      Email
                    </label>
                    <input 
                      id="regEmail" 
                      type="email" 
                      required
                      class="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:bg-slate-800"
                      placeholder="Enter your email"
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-slate-300 mb-2">
                      Password
                    </label>
                    <input 
                      id="regPass" 
                      type="password" 
                      required
                      class="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:bg-slate-800"
                      placeholder="Create a password"
                      minlength="6"
                    >
                    <p class="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
                  </div>

                  <button 
                    type="submit"
                    id="doRegister"
                    class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg shadow-indigo-500/20"
                  >
                    <span class="flex items-center justify-center space-x-2">
                      <span>🚀</span>
                      <span>Create Account</span>
                    </span>
                  </button>
                </div>
              </form>

              <!-- Quick Access Buttons -->
              <div class="mt-4 pt-4 border-t border-slate-700">
                <p class="text-sm text-slate-400 mb-3 text-center">Or explore without signing in:</p>
                <button 
                  id="playPongBtnRegister"
                  class="w-full bg-slate-800/50 hover:bg-slate-700/50 text-white font-semibold py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02] border border-slate-600 hover:border-indigo-500"
                >
                  <span class="flex items-center justify-center space-x-2">
                    <span>🎮</span>
                    <span>Play Pong</span>
                  </span>
                </button>
              </div>

              <div class="text-center pt-2">
                <p class="text-slate-400">
                  Already have an account? 
                  <button id="switchToLogin" class="text-indigo-400 hover:text-indigo-300 font-medium transition-colors ml-1 hover:underline">
                    Sign in here
                  </button>
                </p>
              </div>

              <div id="regMsg" class="text-center text-sm min-h-[20px]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupAuthEventListeners();

  new OAuthButtons("oauth-buttons");
}

function setupAuthEventListeners() {
  // Tab switching
  const loginTab = document.getElementById('loginTab') as HTMLButtonElement;
  const registerTab = document.getElementById('registerTab') as HTMLButtonElement;
  const loginForm = document.getElementById('loginForm') as HTMLElement;
  const registerForm = document.getElementById('registerForm') as HTMLElement;
  const switchToRegister = document.getElementById('switchToRegister') as HTMLButtonElement;
  const switchToLogin = document.getElementById('switchToLogin') as HTMLButtonElement;

  // Quick access navigation buttons
  const playPongBtn = document.getElementById('playPongBtn') as HTMLButtonElement;
  const playPongBtnRegister = document.getElementById('playPongBtnRegister') as HTMLButtonElement;

  // Navigation handlers
  if (playPongBtn) {
    playPongBtn.addEventListener('click', () => {
      router.navigate('/game');
    });
  }

  if (playPongBtnRegister) {
    playPongBtnRegister.addEventListener('click', () => {
      router.navigate('/game');
    });
  }

  // Switch to register
  registerTab.addEventListener('click', () => switchToRegisterForm());
  switchToRegister.addEventListener('click', () => switchToRegisterForm());

  // Switch to login
  loginTab.addEventListener('click', () => switchToLoginForm());
  switchToLogin.addEventListener('click', () => switchToLoginForm());

  // Form submissions
  setupLoginForm();
  setupRegisterForm();
}

function switchToRegisterForm() {
  const loginTab = document.getElementById('loginTab') as HTMLButtonElement;
  const registerTab = document.getElementById('registerTab') as HTMLButtonElement;
  const loginForm = document.getElementById('loginForm') as HTMLElement;
  const registerForm = document.getElementById('registerForm') as HTMLElement;
  const twoFactorForm = document.getElementById('twoFactorForm') as HTMLElement;

  // Remove border and active styles from login tab
  loginTab.classList.remove('border-blue-500', 'text-white');
  loginTab.classList.add('text-gray-400', 'border-transparent');

  // Add border and active styles to register tab
  registerTab.classList.add('border-blue-500', 'text-white');
  registerTab.classList.remove('text-gray-400', 'border-transparent');

  loginForm.classList.add('hidden');
  twoFactorForm?.classList.add('hidden');
  registerForm.classList.remove('hidden');
}

function switchToLoginForm() {
  const loginTab = document.getElementById('loginTab') as HTMLButtonElement;
  const registerTab = document.getElementById('registerTab') as HTMLButtonElement;
  const loginForm = document.getElementById('loginForm') as HTMLElement;
  const registerForm = document.getElementById('registerForm') as HTMLElement;
  const twoFactorForm = document.getElementById('twoFactorForm') as HTMLElement;

  // Remove border and active styles from register tab
  registerTab.classList.remove('border-blue-500', 'text-white');
  registerTab.classList.add('text-gray-400', 'border-transparent');

  // Add border and active styles to login tab
  loginTab.classList.add('border-blue-500', 'text-white');
  loginTab.classList.remove('text-gray-400', 'border-transparent');

  registerForm.classList.add('hidden');
  twoFactorForm?.classList.add('hidden');
  loginForm.classList.remove('hidden');
}

function setupLoginForm() {
  const form = document.getElementById('loginFormContent') as HTMLFormElement;
  const doLogin = document.getElementById('doLogin') as HTMLButtonElement;
  const loginIdentifier = document.getElementById('loginIdentifier') as HTMLInputElement;
  const loginPass = document.getElementById('loginPass') as HTMLInputElement;
  const loginMsg = document.getElementById('loginMsg') as HTMLElement;
  const loginForm = document.getElementById('loginForm') as HTMLElement;
  const twoFactorForm = document.getElementById('twoFactorForm') as HTMLElement;
  const twoFactorFormContent = document.getElementById('twoFactorFormContent') as HTMLFormElement;
  const twoFactorCodeInput = document.getElementById('twoFactorCode') as HTMLInputElement;
  const twoFactorMsg = document.getElementById('twoFactorMsg') as HTMLElement;
  const cancel2FA = document.getElementById('cancel2FA') as HTMLButtonElement;
  const verify2FA = document.getElementById('verify2FA') as HTMLButtonElement;

  // Temp credentials storage
  let tempIdentifier = '';
  let tempPassword = '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const identifier = loginIdentifier.value.trim();
    const password = loginPass.value;

    if (!identifier || !password) {
      showMessage(loginMsg, "Please fill in all fields", "error");
      return;
    }

    // Show loading state
    doLogin.disabled = true;
    doLogin.innerHTML = `
      <span class="flex items-center justify-center space-x-2">
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        <span>Signing In...</span>
      </span>
    `;

    try {
      const res = await loginUser(identifier, password);

      if (res.ok && res.body) {
        if (res.body.requires2FA) {
          // Show 2FA form
          tempIdentifier = identifier;
          tempPassword = password;
          loginForm.classList.add('hidden');
          twoFactorForm.classList.remove('hidden');
          twoFactorCodeInput.value = '';
          twoFactorCodeInput.focus();
          return;
        }

        if (res.body.token) {
          handleLoginSuccess(res.body);
        }
      } else {
        const errorMsg = res.body?.error || `Login failed (${res.status})`;
        showMessage(loginMsg, errorMsg, "error");
      }
    } catch (error) {
      showMessage(loginMsg, "Network error - please try again", "error");
    } finally {
      // Reset button state
      doLogin.disabled = false;
      doLogin.innerHTML = `
        <span class="flex items-center justify-center space-x-2">
          <span>🎯</span>
          <span>Sign In</span>
        </span>
      `;
    }
  });

  // 2FA Submit
  twoFactorFormContent?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = twoFactorCodeInput.value.trim();
    if (!code || code.length < 6) {
      showMessage(twoFactorMsg, "Enter a valid 6-digit code", "error");
      return;
    }

    verify2FA.disabled = true;
    verify2FA.textContent = "Verifying...";

    try {
      const res = await loginUser(tempIdentifier, tempPassword, code);
      if (res.ok && res.body && res.body.token) {
        handleLoginSuccess(res.body);
      } else {
        showMessage(twoFactorMsg, res.body?.error || "Verification failed", "error");
        verify2FA.disabled = false;
        verify2FA.textContent = "Verify";
      }
    } catch (err) {
      showMessage(twoFactorMsg, "Network error", "error");
      verify2FA.disabled = false;
      verify2FA.textContent = "Verify";
    }
  });

  cancel2FA?.addEventListener('click', () => {
    twoFactorForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    tempIdentifier = '';
    tempPassword = '';
  });

  // Helper for success logic
  async function handleLoginSuccess(body: any) {
    // Store token
    const rememberCheckbox = document.getElementById('rememberMe') as HTMLInputElement | null;
    const persistent = rememberCheckbox ? rememberCheckbox.checked : true;
    setToken(body.token, persistent);

    // Initialize auth state
    await initAuth();

    showMessage(loginMsg, `Welcome back, ${body.username || tempIdentifier}!`, "success");
    
    // Show loading overlay before navigation
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'page-loading-overlay';
    loadingOverlay.className = 'fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 z-[10000] flex items-center justify-center';
    loadingOverlay.innerHTML = `
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4"></div>
        <div class="text-white text-xl font-bold">Loading your dashboard...</div>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Navigate to profile
    setTimeout(() => {
      router.navigate("/profile");
    }, 800);
  }

  // Forgot password navigation
  const forgotBtn = document.getElementById('forgotBtn') as HTMLButtonElement | null;
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      router.navigate('/forgot');
    });
  }

  // Handle Enter key on both login inputs
  loginIdentifier.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  loginPass.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

function setupRegisterForm() {
  const form = document.getElementById('registerFormContent') as HTMLFormElement;
  const doRegister = document.getElementById('doRegister') as HTMLButtonElement;
  const regUserInput = document.getElementById('regUser') as HTMLInputElement;
  const regEmailInput = document.getElementById('regEmail') as HTMLInputElement;
  const regPassInput = document.getElementById('regPass') as HTMLInputElement;
  const regMsg = document.getElementById('regMsg') as HTMLElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = regUserInput.value.trim();
    const email = regEmailInput.value.trim();
    const password = regPassInput.value;

    // Validation
    if (!username || !email || !password) {
      showMessage(regMsg, "Please fill in all fields", "error");
      return;
    }

    if (password.length < 6) {
      showMessage(regMsg, "Password must be at least 6 characters", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showMessage(regMsg, "Please enter a valid email address", "error");
      return;
    }
    // Show loading state
    doRegister.disabled = true;
    doRegister.innerHTML = `
      <span class="flex items-center justify-center space-x-2">
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        <span>Creating Account...</span>
      </span>
    `;

    try {
      const res = await registerUser(username, email, password);

      if (res.ok && res.body) {
        // If backend returns a token, store it
        if (res.body.token) {
          // Registration: treat as persistent by default
          setToken(res.body.token, true);
          await initAuth();
        }

        showMessage(regMsg, `Welcome to PongSocial, ${res.body.username || username}!`, "success");

        // Navigate to profile setup
        setTimeout(() => {
          router.navigate("/profile-setup");
        }, 1500);
      } else {
        const errorMsg = res.body?.error || `Registration failed (${res.status})`;
        showMessage(regMsg, errorMsg, "error");
      }
    } catch (error) {
      showMessage(regMsg, "Network error - please try again", "error");
      // Network errors are expected, no need to log
    } finally {
      // Reset button state
      doRegister.disabled = false;
      doRegister.innerHTML = `
        <span class="flex items-center justify-center space-x-2">
          <span>🚀</span>
          <span>Create Account</span>
        </span>
      `;
    }
  });

  // Real-time validation
  regEmailInput.addEventListener('blur', () => {
    const email = regEmailInput.value.trim();
    if (email && !isValidEmail(email)) {
      regEmailInput.classList.add('border-red-500');
    } else {
      regEmailInput.classList.remove('border-red-500');
    }
  });

  regPassInput.addEventListener('input', () => {
    if (regPassInput.value.length > 0 && regPassInput.value.length < 6) {
      regPassInput.classList.add('border-yellow-500');
    } else {
      regPassInput.classList.remove('border-yellow-500');
    }
  });
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showMessage(element: HTMLElement, message: string, type: 'success' | 'error') {
  element.textContent = message;
  element.className = `text-center text-sm font-medium ${type === 'success' ? 'text-green-400' : 'text-red-400'
    } animate-pulse`;

  // Remove animation after 2 seconds
  setTimeout(() => {
    element.classList.remove('animate-pulse');
  }, 2000);
}