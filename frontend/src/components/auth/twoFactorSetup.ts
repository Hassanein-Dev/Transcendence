export class TwoFactorSetup {
  private container: HTMLElement;
  private userId: number;
  private mode: 'enable' | 'disable';

  constructor(containerId: string, userId: number, mode: 'enable' | 'disable' = 'enable') {
    this.container = document.getElementById(containerId)!;
    this.userId = userId;
    this.mode = mode;
  }

  async render() {
    try {
      this.container.innerHTML = ''; // Clear container

      const card = document.createElement('div');
      card.className = 'bg-slate-800 rounded-lg p-6';

      const title = document.createElement('h3');
      title.className = 'text-lg font-semibold mb-4';
      title.textContent = this.mode === 'enable' ? 'Setup Two-Factor Authentication' : 'Disable Two-Factor Authentication';

      let qrSection: HTMLElement | null = null;
      let data: any = null;

      if (this.mode === 'enable') {
        const response = await fetch('/api/2fa/enable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ userId: this.userId })
        });

        data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to setup 2FA');
        }

        qrSection = document.createElement('div');
        qrSection.className = 'mb-4';

        const desc = document.createElement('p');
        desc.className = 'text-sm text-slate-300 mb-3';
        desc.textContent = 'Scan this QR code with your authenticator app:';

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'flex justify-center mb-4';

        const img = document.createElement('img');
        img.src = data.qrCodeUrl;
        img.alt = 'QR Code';
        img.className = 'w-48 h-48 bg-white p-2 rounded';

        imgWrapper.appendChild(img);
        qrSection.appendChild(desc);
        qrSection.appendChild(imgWrapper);
      }

      const inputSection = document.createElement('div');
      inputSection.className = 'mb-4';

      const label = document.createElement('label');
      label.className = 'block text-sm mb-2';
      label.textContent = this.mode === 'enable' ? 'Enter verification code' : 'Enter current 2FA code to disable';

      const input = document.createElement('input');
      input.type = 'text';
      input.id = '2faToken';
      input.maxLength = 6;
      input.placeholder = '000000';
      input.className = 'w-full px-3 py-2 bg-slate-700 rounded text-center text-lg tracking-widest';

      const helpText = document.createElement('p');
      helpText.className = 'text-xs text-slate-400 mt-1';
      helpText.textContent = this.mode === 'enable' ? 'Enter the 6-digit code from your authenticator app' : 'Enter your current 6-digit 2FA code to disable two-factor authentication';

      inputSection.appendChild(label);
      inputSection.appendChild(input);
      inputSection.appendChild(helpText);

      const btnGroup = document.createElement('div');
      btnGroup.className = 'flex gap-2';

      const verifyBtn = document.createElement('button');
      verifyBtn.id = 'verify2fa';
      verifyBtn.className = 'flex-1 px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500';
      verifyBtn.textContent = this.mode === 'enable' ? 'Verify & Enable' : 'Disable 2FA';

      const cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancel2fa';
      cancelBtn.className = 'flex-1 px-4 py-2 bg-slate-600 rounded hover:bg-slate-500';
      cancelBtn.textContent = 'Cancel';

      btnGroup.appendChild(verifyBtn);
      btnGroup.appendChild(cancelBtn);

      const msgDiv = document.createElement('div');
      msgDiv.id = '2faMessage';
      msgDiv.className = 'mt-3 text-sm';

      card.appendChild(title);
      if (qrSection) card.appendChild(qrSection);
      card.appendChild(inputSection);
      card.appendChild(btnGroup);
      card.appendChild(msgDiv);

      this.container.appendChild(card);

      this.setupEventListeners();
    } catch (error) {
      this.container.innerHTML = '';
      const errDiv = document.createElement('div');
      errDiv.className = 'bg-rose-900 border border-rose-700 rounded-lg p-4';

      const errP = document.createElement('p');
      errP.className = 'text-rose-200';
      errP.textContent = `Failed to setup 2FA: ${error}`;

      errDiv.appendChild(errP);
      this.container.appendChild(errDiv);
    }
  }

  private setupEventListeners() {
    const verifyBtn = document.getElementById('verify2fa');
    const cancelBtn = document.getElementById('cancel2fa');
    const tokenInput = document.getElementById('2faToken') as HTMLInputElement;

    tokenInput?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      (e.target as HTMLInputElement).value = value.replace(/[^0-9]/g, '').substring(0, 6);
    });

    verifyBtn?.addEventListener('click', async () => {
      const token = tokenInput.value;

      if (token.length !== 6) {
        this.showMessage('Please enter a 6-digit code', 'error');
        return;
      }

      try {
        if (this.mode === 'enable') {
          const response = await fetch('/api/2fa/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              userId: this.userId,
              token: token
            })
          });

          const data = await response.json();

          if (response.ok) {
            this.showMessage('2FA enabled successfully!', 'success');
            setTimeout(() => {
              const modal = document.getElementById('2faModal');
              if (modal) modal.remove();
              // Dispatch event to refresh settings page
              window.dispatchEvent(new CustomEvent('2fa-changed'));
            }, 2000);
          } else {
            this.showMessage(data.error || 'Invalid code', 'error');
          }
        } else {
          // disable mode
          const response = await fetch('/api/2fa/disable', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              userId: this.userId,
              token: token
            })
          });

          const data = await response.json();

          if (response.ok) {
            this.showMessage('2FA disabled successfully!', 'success');
            setTimeout(() => {
              const modal = document.getElementById('2faModal');
              if (modal) modal.remove();
              // Dispatch event to refresh settings page
              window.dispatchEvent(new CustomEvent('2fa-changed'));
            }, 1200);
          } else {
            this.showMessage(data.error || 'Invalid code', 'error');
          }
        }
      } catch (error) {
        this.showMessage('Failed to verify code', 'error');
      }
    });

    cancelBtn?.addEventListener('click', () => {
      const modal = document.getElementById('2faModal');
      if (modal) modal.remove();
    });
  }

  private showMessage(message: string, type: 'success' | 'error') {
    const messageEl = document.getElementById('2faMessage')!;
    messageEl.textContent = message;
    messageEl.className = `mt-3 text-sm ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'
      }`;
  }
}