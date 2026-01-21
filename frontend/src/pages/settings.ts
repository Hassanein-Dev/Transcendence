import { router } from "../router";
import { logout, getCurrentUser } from "../stores/authState";
import { TwoFactorSetup } from "../components/auth/twoFactorSetup";

export function renderSettings() {
  const app = document.getElementById("app")!;
  app.innerHTML = ''; // Changed from textContent to innerHTML

  const user = getCurrentUser();
  if (!user) {
    router.navigate("/auth");
    return;
  }

  // Build settings page DOM safely
  const root = document.createElement('div');
  root.className = 'relative w-full h-full';

  const animatedBg = document.createElement('div'); animatedBg.className = 'absolute inset-0 overflow-hidden';
  const radial = document.createElement('div'); radial.className = 'absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent';
  const blueCircle = document.createElement('div'); blueCircle.className = 'absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl';
  animatedBg.appendChild(radial); animatedBg.appendChild(blueCircle);

  const container = document.createElement('div'); container.className = 'max-w-4xl mx-auto relative';

  const headerWrap = document.createElement('div'); headerWrap.className = 'mb-8';
  const headerCenter = document.createElement('div'); headerCenter.className = 'text-center mb-8';
  const h1 = document.createElement('h1'); h1.className = 'text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent'; h1.textContent = '⚙️ Settings';
  const p = document.createElement('p'); p.className = 'text-gray-400 mt-2'; p.textContent = 'Manage your account settings and preferences';
  headerCenter.appendChild(h1); headerCenter.appendChild(p); headerWrap.appendChild(headerCenter);

  const card = document.createElement('div'); card.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden';
  const cardHeader = document.createElement('div'); cardHeader.className = 'px-6 py-8 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/50 to-gray-900/50';
  const headerRow2 = document.createElement('div'); headerRow2.className = 'flex items-center space-x-4';
  const icon = document.createElement('div'); icon.className = 'text-3xl'; icon.textContent = '🔧';
  const headerInfo = document.createElement('div'); const h2 = document.createElement('h2'); h2.className = 'text-2xl font-bold text-white'; h2.textContent = 'Account Settings'; const sub = document.createElement('p'); sub.className = 'text-gray-400 mt-1'; sub.textContent = 'Customize your PongSocial experience'; headerInfo.appendChild(h2); headerInfo.appendChild(sub);
  headerRow2.appendChild(icon); headerRow2.appendChild(headerInfo); cardHeader.appendChild(headerRow2);

  const cardBody = document.createElement('div'); cardBody.className = 'p-6 space-y-8';

  // Profile Settings block
  const profileBlock = document.createElement('div'); profileBlock.className = 'bg-gradient-to-r from-gray-800/30 to-gray-900/30 rounded-2xl border border-gray-700/50 p-6';
  const profileTitle = document.createElement('h3'); profileTitle.className = 'text-xl font-bold text-white mb-6 flex items-center space-x-2';
  const profileIcon = document.createElement('span'); profileIcon.textContent = '👤';
  const profileText = document.createElement('span'); profileText.textContent = 'Profile Settings';
  profileTitle.appendChild(profileIcon); profileTitle.appendChild(profileText);
  profileBlock.appendChild(profileTitle);
  const profileList = document.createElement('div'); profileList.className = 'space-y-4';
  const profileItem = document.createElement('div'); profileItem.className = 'flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300 group';
  const profileItemLeft = document.createElement('div'); profileItemLeft.className = 'flex items-center space-x-4'; const sparkle = document.createElement('div'); sparkle.className = 'text-2xl'; sparkle.textContent = '✨'; const profileInfo = document.createElement('div'); const profileH = document.createElement('h4'); profileH.className = 'font-medium text-white'; profileH.textContent = 'Profile Information'; const profileP = document.createElement('p'); profileP.className = 'text-sm text-gray-400'; profileP.textContent = 'Update your profile details and avatar'; profileInfo.appendChild(profileH); profileInfo.appendChild(profileP); profileItemLeft.appendChild(sparkle); profileItemLeft.appendChild(profileInfo);
  const editLink = document.createElement('a'); editLink.href = '/profile'; editLink.setAttribute('data-link', ''); editLink.className = 'px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-300 transform group-hover:-translate-y-0.5 shadow-lg hover:shadow-purple-500/25'; editLink.textContent = 'Edit Profile';
  profileItem.appendChild(profileItemLeft); profileItem.appendChild(editLink); profileList.appendChild(profileItem);

  // 2FA / Privacy Settings
  const privacyItem = document.createElement('div'); privacyItem.className = 'flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 group';
  const privacyLeft = document.createElement('div'); privacyLeft.className = 'flex items-center space-x-4'; const lock = document.createElement('div'); lock.className = 'text-2xl'; lock.textContent = '🔒'; const privacyInfo = document.createElement('div'); const privacyH = document.createElement('h4'); privacyH.className = 'font-medium text-white'; privacyH.textContent = 'Two-Factor Authentication'; const privacyP = document.createElement('p'); privacyP.className = 'text-sm text-gray-400'; privacyP.textContent = user.twoFactorEnabled ? '2FA is currently ENABLED' : 'Add an extra layer of security'; privacyInfo.appendChild(privacyH); privacyInfo.appendChild(privacyP); privacyLeft.appendChild(lock); privacyLeft.appendChild(privacyInfo);

  const configBtn = document.createElement('button');
  configBtn.id = 'configure2faBtn';
  if (user.twoFactorEnabled) {
    configBtn.className = 'px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold rounded-xl border border-red-500/50 transition-all duration-300 transform group-hover:-translate-y-0.5 shadow-md hover:shadow-red-500/25';
    configBtn.textContent = 'Disable 2FA';
  } else {
    configBtn.className = 'px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl border border-emerald-500/50 transition-all duration-300 transform group-hover:-translate-y-0.5 shadow-md hover:shadow-emerald-500/25';
    configBtn.textContent = 'Enable 2FA';
  }

  privacyItem.appendChild(privacyLeft); privacyItem.appendChild(configBtn); profileList.appendChild(privacyItem);
  profileBlock.appendChild(profileList);

  // Danger Zone
  const dangerBlock = document.createElement('div'); dangerBlock.className = 'bg-gradient-to-r from-red-900/20 to-pink-900/20 rounded-2xl border border-red-700/50 p-6';
  const dangerTitle = document.createElement('h3'); dangerTitle.className = 'text-xl font-bold text-white mb-6 flex items-center space-x-2';
  const dangerIcon = document.createElement('span'); dangerIcon.textContent = '⚠️';
  const dangerText = document.createElement('span'); dangerText.textContent = 'Danger Zone';
  dangerTitle.appendChild(dangerIcon); dangerTitle.appendChild(dangerText);
  dangerBlock.appendChild(dangerTitle);
  const dangerList = document.createElement('div'); dangerList.className = 'space-y-4';
  const logoutRow = document.createElement('div'); logoutRow.className = 'flex items-center justify-between p-4 bg-red-900/10 rounded-xl border border-red-700/30';
  const logoutLeft = document.createElement('div'); const logoutH = document.createElement('h4'); logoutH.className = 'font-medium text-white'; logoutH.textContent = 'Log Out'; const logoutP = document.createElement('p'); logoutP.className = 'text-sm text-red-400'; logoutP.textContent = 'Sign out of your account on this device'; logoutLeft.appendChild(logoutH); logoutLeft.appendChild(logoutP);
  const logoutBtn = document.createElement('button'); logoutBtn.id = 'settingsLogoutBtn'; logoutBtn.className = 'px-6 py-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-red-500/25'; logoutBtn.textContent = 'Log Out';
  logoutRow.appendChild(logoutLeft); logoutRow.appendChild(logoutBtn);
  const deleteRow = document.createElement('div'); deleteRow.className = 'flex items-center justify-between p-4 bg-red-900/10 rounded-xl border border-red-700/30';
  const deleteLeft = document.createElement('div'); const deleteH = document.createElement('h4'); deleteH.className = 'font-medium text-white'; deleteH.textContent = 'Delete Account'; const deleteP = document.createElement('p'); deleteP.className = 'text-sm text-red-400'; deleteP.textContent = 'Permanently delete your account and all data'; deleteLeft.appendChild(deleteH); deleteLeft.appendChild(deleteP);
  const deleteBtn = document.createElement('button'); deleteBtn.id = 'settingsDeleteBtn';
  
  // Disable delete button for admin user
  if (user.username === 'admin') {
    deleteBtn.className = 'px-6 py-2 bg-gray-600 text-gray-400 font-bold rounded-xl cursor-not-allowed opacity-50 border border-gray-500/50';
    deleteBtn.textContent = 'Cannot Delete Admin';
    deleteBtn.disabled = true;
    deleteBtn.title = 'Admin account cannot be deleted';
  } else {
    deleteBtn.className = 'px-6 py-2 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-red-500/25 border border-red-600/50';
    deleteBtn.textContent = 'Delete Account';
  }
  
  deleteRow.appendChild(deleteLeft); deleteRow.appendChild(deleteBtn);

  dangerList.appendChild(logoutRow); dangerList.appendChild(deleteRow);
  dangerBlock.appendChild(dangerList);

  cardBody.appendChild(profileBlock); cardBody.appendChild(dangerBlock);
  card.appendChild(cardHeader); card.appendChild(cardBody);
  container.appendChild(headerWrap); container.appendChild(card);

  root.appendChild(animatedBg); root.appendChild(container);
  app.textContent = '';
  app.appendChild(container);

  setupSettingsEventListeners(user);
}

function setupSettingsEventListeners(user: any) {
  const logoutBtn = document.getElementById('settingsLogoutBtn') as HTMLButtonElement;
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      showConfirmationModal();
    });
  }
  const deleteBtn = document.getElementById('settingsDeleteBtn') as HTMLButtonElement;
  if (deleteBtn && !deleteBtn.disabled) {
    deleteBtn.addEventListener('click', () => {
      showDeleteAccountModal(user);
    });
  }

  const config2faBtn = document.getElementById('configure2faBtn') as HTMLButtonElement;
  if (config2faBtn) {
    config2faBtn.addEventListener('click', async () => {
      if (user.twoFactorEnabled) {
        // Open the disable modal which asks for the current 2FA code
        open2FAModal(user.id, 'disable');
      } else {
        // Enable flow
        open2FAModal(user.id, 'enable');
      }
    });
  }

  // Listen for 2FA state changes
  window.addEventListener('2fa-changed', async () => {
    // Refresh user data
    const { initAuth } = await import('../stores/authState');
    await initAuth();
    // Re-render settings page to update button
    renderSettings();
  });
}

function open2FAModal(userId: number, mode: 'enable' | 'disable' = 'enable') {
  const modal = document.createElement('div');
  modal.id = '2faModal';
  modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4';

  // The setup component will construct its card inside a container, but it expects a valid containerID.
  // We will create a simple box for it to render into.
  // Actually TwoFactorSetup replaces correct element content, so we just provide a wrapper.
  const container = document.createElement('div');
  container.id = '2faContainer';
  container.className = 'w-full max-w-md';

  modal.appendChild(container);
  document.body.appendChild(modal);

  const setup = new TwoFactorSetup('2faContainer', userId, mode);
  setup.render();
}

function showConfirmationModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4';

  const box = document.createElement('div');
  box.className = 'bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md shadow-2xl';

  const inner = document.createElement('div');
  inner.className = 'text-center mb-6';
  const icon = document.createElement('div');
  icon.className = 'text-5xl mb-4';
  icon.textContent = '⚠️';
  const title = document.createElement('h3');
  title.className = 'text-xl font-bold text-white mb-2';
  title.textContent = 'Confirm Logout';
  const p = document.createElement('p');
  p.className = 'text-gray-400';
  p.textContent = 'Are you sure you want to log out of your account?';

  inner.appendChild(icon);
  inner.appendChild(title);
  inner.appendChild(p);

  const actions = document.createElement('div');
  actions.className = 'flex gap-3';
  const confirm = document.createElement('button');
  confirm.id = 'confirmLogout';
  confirm.className = 'flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold rounded-xl';
  confirm.textContent = 'Yes, Log Out';
  const cancel = document.createElement('button');
  cancel.id = 'cancelLogout';
  cancel.className = 'flex-1 px-4 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-bold rounded-xl border border-gray-600';
  cancel.textContent = 'Cancel';

  actions.appendChild(confirm);
  actions.appendChild(cancel);
  box.appendChild(inner);
  box.appendChild(actions);
  modal.appendChild(box);
  document.body.appendChild(modal);

  confirm.addEventListener('click', () => {
    modal.remove();
    logout();
    router.navigate('/login');
  });

  cancel.addEventListener('click', () => {
    modal.remove();
  });
}

function showDeleteAccountModal(user: any) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4';

  const box = document.createElement('div');
  box.className = 'bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-red-700/50 p-6 w-full max-w-md shadow-2xl';

  const inner = document.createElement('div');
  inner.className = 'text-center mb-6';

  const icon = document.createElement('div');
  icon.className = 'text-6xl mb-4';
  icon.textContent = '⚠️';

  const title = document.createElement('h3');
  title.className = 'text-2xl font-bold text-red-400 mb-3';
  title.textContent = 'Delete Account';

  const warning = document.createElement('div');
  warning.className = 'bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4';
  const warningTitle = document.createElement('p');
  warningTitle.className = 'text-red-300 font-semibold mb-2';
  warningTitle.textContent = '⚠️ This action cannot be undone!';
  const warningText = document.createElement('p');
  warningText.className = 'text-gray-300 text-sm';
  warningText.textContent = 'All your data will be permanently deleted including:';
  const warningList = document.createElement('ul');
  warningList.className = 'text-gray-400 text-sm mt-2 space-y-1 text-left';
  const items = ['Profile information', 'Game history and statistics', 'Friends and messages', 'Tournament records', 'All account settings'];
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `• ${item}`;
    warningList.appendChild(li);
  });
  warning.appendChild(warningTitle);
  warning.appendChild(warningText);
  warning.appendChild(warningList);

  const confirmLabel = document.createElement('label');
  confirmLabel.className = 'block text-left mb-2';
  const confirmLabelText = document.createElement('span');
  confirmLabelText.className = 'text-gray-300 text-sm font-medium';
  confirmLabelText.textContent = 'Type DELETE_MY_ACCOUNT to confirm:';
  confirmLabel.appendChild(confirmLabelText);

  const confirmInput = document.createElement('input');
  confirmInput.type = 'text';
  confirmInput.id = 'deleteConfirmInput';
  confirmInput.placeholder = 'DELETE_MY_ACCOUNT';
  confirmInput.className = 'w-full px-4 py-3 bg-gray-700/50 rounded-xl border border-red-600/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4';

  inner.appendChild(icon);
  inner.appendChild(title);
  inner.appendChild(warning);
  inner.appendChild(confirmLabel);
  inner.appendChild(confirmInput);

  const actions = document.createElement('div');
  actions.className = 'flex gap-3';

  const deleteButton = document.createElement('button');
  deleteButton.id = 'confirmDeleteBtn';
  deleteButton.className = 'flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';
  deleteButton.textContent = 'Delete My Account';
  deleteButton.disabled = true;

  const cancelButton = document.createElement('button');
  cancelButton.id = 'cancelDeleteBtn';
  cancelButton.className = 'flex-1 px-4 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-bold rounded-xl border border-gray-600';
  cancelButton.textContent = 'Cancel';

  actions.appendChild(deleteButton);
  actions.appendChild(cancelButton);
  box.appendChild(inner);
  box.appendChild(actions);
  modal.appendChild(box);
  document.body.appendChild(modal);

  // Enable delete button only when correct text is entered
  confirmInput.addEventListener('input', () => {
    deleteButton.disabled = confirmInput.value !== 'DELETE_MY_ACCOUNT';
  });

  deleteButton.addEventListener('click', async () => {
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting...';

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/gdpr/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          confirmation: confirmInput.value
        })
      });

      if (response.ok) {
        modal.remove();
        // Show success message
        alert('Your account has been permanently deleted. You will now be logged out.');
        // Clear local storage and redirect
        localStorage.clear();
        logout();
        router.navigate('/auth');
      } else {
        const error = await response.json();
        alert(`Failed to delete account: ${error.error || 'Unknown error'}`);
        deleteButton.disabled = false;
        deleteButton.textContent = 'Delete My Account';
      }
    } catch (error) {
      alert('Failed to delete account. Please try again.');
      deleteButton.disabled = false;
      deleteButton.textContent = 'Delete My Account';
    }
  });

  cancelButton.addEventListener('click', () => {
    modal.remove();
  });

  // Close on escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}