export class GDPRManagement {
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  render(): void {
    // Build GDPR management UI with safe DOM operations
    this.container.textContent = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-4xl mx-auto space-y-6';

    const card = document.createElement('div');
    card.className = 'bg-slate-800 rounded-lg p-6';
    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold mb-4';
    title.textContent = 'Data Privacy Management';
    const desc = document.createElement('p');
    desc.className = 'text-slate-400 mb-6';
    desc.textContent = 'Manage your personal data in accordance with GDPR regulations.';

    const section = document.createElement('div');
    section.className = 'space-y-6';

    // Export
    const exportBox = document.createElement('div');
    exportBox.className = 'border border-slate-700 rounded-lg p-4';
    const exportH = document.createElement('h3');
    exportH.className = 'text-lg font-semibold mb-2';
    exportH.textContent = 'Export Your Data';
    const exportP = document.createElement('p');
    exportP.className = 'text-slate-400 mb-4';
    exportP.textContent = 'Download a copy of all your personal data stored on our platform.';
    const exportBtn = document.createElement('button');
    exportBtn.id = 'exportDataBtn';
    exportBtn.className = 'px-4 py-2 bg-blue-600 rounded hover:bg-blue-500';
    exportBtn.textContent = 'Export My Data';
    exportBox.appendChild(exportH);
    exportBox.appendChild(exportP);
    exportBox.appendChild(exportBtn);

    // Anonymize
    const anonBox = document.createElement('div');
    anonBox.className = 'border border-slate-700 rounded-lg p-4';
    const anonH = document.createElement('h3');
    anonH.className = 'text-lg font-semibold mb-2';
    anonH.textContent = 'Anonymize My Data';
    const anonP = document.createElement('p');
    anonP.className = 'text-slate-400 mb-4';
    anonP.textContent = 'Remove personally identifiable information while keeping your game statistics. This action cannot be undone.';
    const anonBtn = document.createElement('button');
    anonBtn.id = 'anonymizeDataBtn';
    anonBtn.className = 'px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-500';
    anonBtn.textContent = 'Anonymize My Data';
    const anonNote = document.createElement('p');
    anonNote.className = 'text-xs text-slate-500';
    anonNote.textContent = 'Note: Your username, profile information, and personal messages will be removed, but your game records will be preserved for statistical purposes.';
    anonBox.appendChild(anonH);
    anonBox.appendChild(anonP);
    anonBox.appendChild(anonBtn);
    anonBox.appendChild(anonNote);

    // Delete Account
    const delBox = document.createElement('div');
    delBox.className = 'border border-red-700 rounded-lg p-4 bg-red-900/20';
    const delH = document.createElement('h3');
    delH.className = 'text-lg font-semibold mb-2 text-red-400';
    delH.textContent = 'Delete Account';
    const delP = document.createElement('p');
    delP.className = 'text-slate-400 mb-4';
    delP.textContent = 'Permanently delete your account and all associated data. This action cannot be undone.';
    const confirmationInput = document.createElement('input');
    confirmationInput.type = 'text';
    confirmationInput.id = 'deleteConfirmation';
    confirmationInput.placeholder = 'Type DELETE_MY_ACCOUNT to confirm';
    confirmationInput.className = 'w-full px-3 py-2 bg-slate-700 rounded border border-red-600';
    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'deleteAccountBtn';
    deleteBtn.className = 'px-4 py-2 bg-red-600 rounded hover:bg-red-500 disabled:opacity-50';
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Delete My Account';
    const warning = document.createElement('p');
    warning.className = 'text-xs text-red-400';
    warning.textContent = 'Warning: This will permanently remove all your data, including game history, friends, and messages.';

    delBox.appendChild(delH);
    delBox.appendChild(delP);
    delBox.appendChild(confirmationInput);
    delBox.appendChild(deleteBtn);
    delBox.appendChild(warning);

    section.appendChild(exportBox);
    section.appendChild(anonBox);
    section.appendChild(delBox);

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(section);
    wrapper.appendChild(card);
    this.container.appendChild(wrapper);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Export data
    document.getElementById('exportDataBtn')?.addEventListener('click', () => {
      this.exportData();
    });

    // Anonymize data
    document.getElementById('anonymizeDataBtn')?.addEventListener('click', () => {
      this.showAnonymizeConfirmation();
    });

    // Delete account confirmation
    const confirmationInput = document.getElementById('deleteConfirmation') as HTMLInputElement;
    const deleteBtn = document.getElementById('deleteAccountBtn') as HTMLButtonElement;

    confirmationInput?.addEventListener('input', () => {
      deleteBtn.disabled = confirmationInput.value !== 'DELETE_MY_ACCOUNT';
    });

    deleteBtn?.addEventListener('click', () => {
      this.showDeleteConfirmation();
    });
  }

  private async exportData(): Promise<void> {
    try {
      const response = await fetch('/api/gdpr/export-data', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.downloadJSON(data, 'pong-social-data-export.json');
        alert('Data exported successfully!');
      } else {
        alert('Failed to export data');
      }
    } catch (error) {
      alert('Failed to export data');
    }
  }

  private downloadJSON(data: any, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private showAnonymizeConfirmation(): void {
    if (confirm('Are you sure you want to anonymize your data? This will remove all personal information and cannot be undone.')) {
      this.anonymizeData();
    }
  }

  private async anonymizeData(): Promise<void> {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const response = await fetch('/api/gdpr/anonymize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        alert('Your data has been anonymized successfully.');
        // Log out user
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        window.location.reload();
      } else {
        alert('Failed to anonymize data');
      }
    } catch (error) {
      alert('Failed to anonymize data');
    }
  }

  private showDeleteConfirmation(): void {
    if (confirm('FINAL WARNING: This will permanently delete your account and all data. This action cannot be undone. Are you absolutely sure?')) {
      this.deleteAccount();
    }
  }

  private async deleteAccount(): Promise<void> {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const confirmationInput = document.getElementById('deleteConfirmation') as HTMLInputElement;

      const response = await fetch('/api/gdpr/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          userId: user.id,
          confirmation: confirmationInput.value
        })
      });

      if (response.ok) {
        alert('Your account has been permanently deleted.');
        // Clear local storage and redirect
        localStorage.clear();
        window.location.href = '/';
      } else {
        const error = await response.json();
        alert(`Failed to delete account: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to delete account');
    }
  }
}