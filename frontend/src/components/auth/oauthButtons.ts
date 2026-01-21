// ./frontend/src/components/auth/oauthButtons.ts

export class OAuthButtons {
  private container: HTMLElement;
  private config: any = null;
  private isInitialized = false;

  constructor(containerId: string = "oauth-buttons") {
    this.container = document.getElementById(containerId) || this.createContainer();
    this.init();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'oauth-buttons';
    container.className = 'flex flex-col gap-3';
    return container;
  }

  // Generate a secure random state parameter
  private generateState(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async init() {
    if (this.isInitialized) return;

    try {
      const response = await fetch('/api/oauth/config');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      this.config = await response.json();
      this.render();
      this.isInitialized = true;
    } catch (error) {
      this.renderError('Unable to load login options. Please try again later.');
    }
  }

  private render() {
    if (!this.config) return;

    // Clear container
    this.container.innerHTML = '';

    const providers = [];

    // GitHub OAuth provider
    if (this.config.github?.enabled) {
      providers.push({
        id: 'github',
        name: 'GitHub',
        icon: `
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        `,
        url: '/api/oauth/github',
        bgColor: 'bg-gray-900 hover:bg-gray-800',
        borderColor: 'border-gray-700',
        textColor: 'text-white',
        shadow: 'shadow-lg'
      });
    }

    if (providers.length === 0) {
      this.renderNotConfigured();
      return;
    }

    // Render separator
    this.container.innerHTML = `
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-600"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-3 bg-gray-800 text-gray-300 font-medium">Or continue with</span>
        </div>
      </div>
    `;

    providers.forEach(provider => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `
        w-full flex items-center justify-center gap-3 px-6 py-4 
        ${provider.bgColor} 
        border ${provider.borderColor}
        ${provider.textColor}
        ${provider.shadow}
        rounded-xl
        font-semibold
        transition-all
        duration-200
        transform
        hover:scale-[1.02]
        active:scale-[0.98]
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500
        focus:ring-opacity-50
        group
      `;

      btn.innerHTML = `
        <span class="transition-transform duration-200 group-hover:scale-110">
          ${provider.icon}
        </span>
        <span>Continue with ${provider.name}</span>
      `;

      btn.addEventListener('click', () => {
        // Generate and store state parameter
        const state = this.generateState();

        // Store state in sessionStorage for verification in callback
        sessionStorage.setItem('oauth_state', state);
        sessionStorage.setItem('oauth_provider', provider.id);
        sessionStorage.setItem('oauth_timestamp', Date.now().toString());

        // Add loading state
        btn.disabled = true;
        btn.innerHTML = `
          <div class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          <span>Redirecting...</span>
        `;

        // Preserve current tab state
        const isRegisterTab = document.getElementById('registerForm')?.classList.contains('hidden') === false;
        sessionStorage.setItem('oauth_target_tab', isRegisterTab ? 'register' : 'login');

        // Redirect to OAuth endpoint with state parameter
        setTimeout(() => {
          window.location.href = `${provider.url}?state=${encodeURIComponent(state)}`;
        }, 500);
      });

      this.container.appendChild(btn);
    });
  }

  private renderNotConfigured() {
    this.container.innerHTML = `
      <div class="bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-sm">
        <div class="font-medium text-amber-300">OAuth not configured</div>
        <p class="text-amber-200 mt-1">Ask your admin to set up GitHub OAuth to enable one-click login.</p>
      </div>
    `;
  }

  private renderError(message: string) {
    this.container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm';

    const title = document.createElement('div');
    title.className = 'font-medium text-red-300';
    title.textContent = '⚠️ Error';

    const p = document.createElement('p');
    p.className = 'text-red-200 mt-1';
    p.textContent = message;

    wrapper.appendChild(title);
    wrapper.appendChild(p);
    this.container.appendChild(wrapper);
  }

  // Static method to verify state on callback
  static verifyState(receivedState: string): boolean {
    const storedState = sessionStorage.getItem('oauth_state');
    const timestamp = sessionStorage.getItem('oauth_timestamp');

    // Clean up stored state
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_provider');
    sessionStorage.removeItem('oauth_timestamp');

    if (!storedState || !timestamp) {
      return false;
    }

    // Check if state is too old (10 minutes)
    const age = Date.now() - parseInt(timestamp);
    if (age > 10 * 60 * 1000) {
      return false;
    }

    // Compare states
    const isValid = storedState === receivedState;

    return isValid;
  }

  destroy() {
    this.container.remove();
  }
}