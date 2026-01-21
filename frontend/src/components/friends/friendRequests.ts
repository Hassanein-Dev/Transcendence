import { getCurrentFriendRequests, loadFriendRequests, removeFriendRequest, subscribe } from "../../stores/friendState";
import { handleFriendAction } from "../../services/api";

export class FriendRequestsComponent {
  private container: HTMLElement;

  constructor(containerId: string = "friend-requests") {
    this.container = document.getElementById(containerId) || this.createContainer();
    this.init();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'friend-requests';
    container.className = 'w-80 bg-white rounded-lg shadow-lg border fixed top-20 right-4 z-50 hidden';
    document.body.appendChild(container);
    return container;
  }

  async init() {
    await loadFriendRequests();
    this.render();
    this.setupSubscriptions();
  }

  private render() {
    const requests = getCurrentFriendRequests();

    this.container.innerHTML = ''; // Clear container safely

    // Header
    const header = document.createElement('div');
    header.className = 'p-4 border-b border-gray-200';

    const headerFlex = document.createElement('div');
    headerFlex.className = 'flex justify-between items-center';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-gray-800 flex items-center gap-2';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'text-blue-500';
    iconSpan.textContent = '📨';

    title.appendChild(iconSpan);
    title.appendChild(document.createTextNode(' Friend Requests'));

    if (requests.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'text-xs bg-red-500 text-white px-2 py-1 rounded-full';
      badge.textContent = requests.length.toString();
      title.appendChild(badge);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-gray-400 hover:text-gray-600 close-panel';
    closeBtn.textContent = '✕';

    headerFlex.appendChild(title);
    headerFlex.appendChild(closeBtn);
    header.appendChild(headerFlex);
    this.container.appendChild(header);

    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'p-2 max-h-96 overflow-y-auto';

    const requestsContainer = document.createElement('div');
    requestsContainer.id = 'friend-requests-container';
    requestsContainer.className = 'space-y-2';

    // Render list
    this.renderRequestsList(requests, requestsContainer);
    contentDiv.appendChild(requestsContainer);

    if (requests.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'text-center text-gray-500 py-8';

      const emoji = document.createElement('div');
      emoji.className = 'text-4xl mb-3';
      emoji.textContent = '👋';

      const emptyTitle = document.createElement('p');
      emptyTitle.className = 'text-sm font-medium';
      emptyTitle.textContent = 'No pending requests';

      const emptyDesc = document.createElement('p');
      emptyDesc.className = 'text-xs mt-1 text-gray-400';
      emptyDesc.textContent = "When you have friend requests, they'll appear here.";

      emptyState.appendChild(emoji);
      emptyState.appendChild(emptyTitle);
      emptyState.appendChild(emptyDesc);
      contentDiv.appendChild(emptyState);
    }

    this.container.appendChild(contentDiv);

    this.setupEventListeners();
  }

  private renderRequestsList(requests: any[], container: HTMLElement) {
    if (requests.length === 0) return;

    requests.forEach(request => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors';

      const left = document.createElement('div');
      left.className = 'flex items-center gap-3 flex-1 min-w-0';

      const img = document.createElement('img');
      img.src = request.avatarUrl || '/public/default-avatar.png';
      img.alt = request.username;
      img.className = 'w-10 h-10 rounded-full object-cover';

      const info = document.createElement('div');
      info.className = 'flex-1 min-w-0';

      const name = document.createElement('div');
      name.className = 'font-semibold text-sm text-gray-800 truncate';
      name.textContent = request.username;

      const time = document.createElement('div');
      time.className = 'text-xs text-gray-500';
      time.textContent = this.formatRequestTime(request.requestedAt);

      info.appendChild(name);
      info.appendChild(time);
      left.appendChild(img);
      left.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'flex gap-1 ml-2';

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'request-confirm-btn p-2 text-white bg-blue-500 rounded-full hover:bg-blue-600 transition-colors';
      confirmBtn.setAttribute('data-user-id', request.id);
      confirmBtn.title = 'Confirm';
      confirmBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'request-delete-btn p-2 text-gray-400 hover:text-gray-600 transition-colors';
      deleteBtn.setAttribute('data-user-id', request.id);
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';

      actions.appendChild(confirmBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(left);
      item.appendChild(actions);
      container.appendChild(item);
    });
  }

  private formatRequestTime(timestamp: string): string {
    const now = new Date();
    const requestTime = new Date(timestamp);
    const diffInHours = (now.getTime() - requestTime.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return requestTime.toLocaleDateString();
  }

  private setupEventListeners() {
    // Close panel
    this.container.querySelector('.close-panel')?.addEventListener('click', () => {
      this.hide();
    });

    // Request actions
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      if (!button) return;

      const userId = button.getAttribute('data-user-id');
      if (!userId) return;

      if (button.classList.contains('request-confirm-btn')) {
        this.handleRequestAction(parseInt(userId), 'accept');
      } else if (button.classList.contains('request-delete-btn')) {
        this.handleRequestAction(parseInt(userId), 'reject');
      }
    });
  }

  private setupSubscriptions() {
    subscribe(({ friendRequests }) => {
      const requestsContainer = document.getElementById('friend-requests-container');
      if (requestsContainer) {
        requestsContainer.innerHTML = '';
        this.renderRequestsList(friendRequests, requestsContainer);
      }
    });
  }

  private async handleRequestAction(userId: number, action: 'accept' | 'reject') {
    const res = await handleFriendAction(userId, action);
    if (res.ok) {
      removeFriendRequest(userId);
      if (action === 'accept') {
        // Show success feedback
        this.showToast('Friend request accepted!', 'success');
      }
    } else {
      this.showToast(`Failed to ${action} request`, 'error');
    }
  }

  private showToast(message: string, type: 'success' | 'error') {
    // Get or create notifications container
    let container = document.getElementById('notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notifications-container';
      container.className = 'fixed top-20 right-4 z-[9999] space-y-2';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `px-4 py-2 rounded-lg text-white text-sm font-medium ${type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }

  toggle() {
    this.container.classList.toggle('hidden');
  }

  destroy() {
    this.container.remove();
  }
}