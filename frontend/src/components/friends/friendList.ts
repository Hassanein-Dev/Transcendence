import { getCurrentFriends, loadFriends, removeFriend, subscribe } from "../../stores/friendState";
import { handleFriendAction } from "../../services/api";
import { remoteGameInvite } from "../game/remoteGameInvite";
import { ChatComponent } from '../chat/chat';

export class FriendListComponent {
  private container: HTMLElement;
  private chatComponent: ChatComponent;
  private unreadCounts: Map<string, number> = new Map();

  constructor(containerId: string = "friend-list", chatComponent: ChatComponent) {
    this.container = document.getElementById(containerId) || this.createContainer();
    this.chatComponent = chatComponent;
    this.init();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'friend-list';
    container.className = 'w-80 bg-white rounded-lg shadow-lg border fixed top-20 right-4 z-50 hidden';
    document.body.appendChild(container);
    return container;
  }

  async init() {
    await loadFriends();
    await this.loadUnreadCounts();
    this.render();
    this.setupSubscriptions();
    this.setupEventListeners();
    // Poll for unread counts every 30 seconds
    setInterval(() => this.loadUnreadCounts(), 30000);
  }

  private render() {
    const friends = getCurrentFriends();
    // Build container safely
    this.container.textContent = '';
    const header = document.createElement('div');
    header.className = 'p-4 border-b border-gray-200';
    const headerRow = document.createElement('div');
    headerRow.className = 'flex justify-between items-center';
    const h3 = document.createElement('h3');
    h3.className = 'text-lg font-semibold text-gray-800 flex items-center gap-2';
    const icon = document.createElement('span');
    icon.className = 'text-blue-500';
    icon.textContent = '👥';
    const titleText = document.createElement('span');
    titleText.textContent = 'Friends';
    const count = document.createElement('span');
    count.className = 'text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full';
    count.textContent = String(friends.length);
    h3.appendChild(icon);
    h3.appendChild(titleText);
    h3.appendChild(count);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-gray-400 hover:text-gray-600 close-panel';
    closeBtn.textContent = '✕';
    headerRow.appendChild(h3);
    headerRow.appendChild(closeBtn);
    header.appendChild(headerRow);

    const searchRow = document.createElement('div');
    searchRow.className = 'flex items-center gap-2 mt-3';
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'flex-1 relative';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'friendlist-search';
    searchInput.placeholder = 'Search friends...';
    searchInput.className = 'w-full bg-gray-100 rounded-full px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors';
    const searchIcon = document.createElement('div');
    searchIcon.className = 'absolute left-3 top-2 text-gray-400';
    searchIcon.textContent = '🔍';
    searchWrapper.appendChild(searchInput);
    searchWrapper.appendChild(searchIcon);

    const addBtn = document.createElement('button');
    addBtn.id = 'add-friend-btn';
    addBtn.className = 'p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors';
    addBtn.title = 'Add Friend';
    addBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>';

    searchRow.appendChild(searchWrapper);
    searchRow.appendChild(addBtn);

    const listWrap = document.createElement('div');
    listWrap.className = 'p-2 max-h-96 overflow-y-auto';
    const friendsContainer = document.createElement('div');
    friendsContainer.id = 'friend-list-container';
    friendsContainer.className = 'space-y-1';
    friendsContainer.appendChild(this.renderFriendsList(friends));
    listWrap.appendChild(friendsContainer);

    if (friends.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-center text-gray-500 py-8';
      empty.innerHTML = '<div class="text-4xl mb-3">👥</div><p class="text-sm font-medium">No friends yet</p><p class="text-xs mt-1 text-gray-400">Add friends to start playing Pong together!</p>';
      listWrap.appendChild(empty);
    }

    this.container.appendChild(header);
    this.container.appendChild(searchRow);
    this.container.appendChild(listWrap);
  }

  private renderFriendsList(friends: any[]) {
    const fragment = document.createDocumentFragment();
    if (friends.length === 0) return fragment;

    friends.forEach(friend => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group cursor-pointer';

      const left = document.createElement('div');
      left.className = 'flex items-center gap-3 flex-1 min-w-0';

      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'relative';
      const img = document.createElement('img');
      img.src = friend.avatarUrl || '/public/default-avatar.svg';
      img.alt = friend.username || 'User';
      img.className = 'w-10 h-10 rounded-full object-cover';
      img.onerror = () => { img.src = '/public/default-avatar.svg'; };
      const dot = document.createElement('div');
      dot.className = 'absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ' + (friend.onlineStatus === 'online' ? 'bg-green-500' : 'bg-gray-400');
      avatarWrap.appendChild(img);
      avatarWrap.appendChild(dot);

      const middle = document.createElement('div');
      middle.className = 'flex-1 min-w-0';
      const nameRow = document.createElement('div');
      nameRow.className = 'flex items-center gap-2';
      const name = document.createElement('div');
      name.className = 'font-semibold text-sm text-gray-800 truncate';
      name.textContent = friend.username;
      nameRow.appendChild(name);

      // Add unread count badge if there are unread messages
      const unreadCount = this.unreadCounts.get(friend.id.toString()) || 0;
      if (unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center';
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
        nameRow.appendChild(badge);
      }

      const status = document.createElement('div');
      status.className = 'text-xs text-gray-500 capitalize';
      status.textContent = friend.onlineStatus;
      middle.appendChild(nameRow);
      middle.appendChild(status);

      left.appendChild(avatarWrap);
      left.appendChild(middle);

      const actions = document.createElement('div');
      actions.className = 'flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity';
      if (friend.onlineStatus === 'online') {
        const inviteBtn = document.createElement('button');
        inviteBtn.className = 'game-invite-btn p-2 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded-full transition-colors';
        inviteBtn.setAttribute('data-user-id', String(friend.id));
        inviteBtn.setAttribute('data-username', String(friend.username));
        inviteBtn.title = 'Invite to Game';
        inviteBtn.textContent = '🎮';
        inviteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          remoteGameInvite.sendInvite(String(friend.id), String(friend.username));
        });
        actions.appendChild(inviteBtn);
      }

      const unfriendBtn = document.createElement('button');
      unfriendBtn.className = 'friend-unfriend-btn p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors';
      unfriendBtn.setAttribute('data-friend-id', String(friend.id));
      unfriendBtn.title = 'Unfriend';
      unfriendBtn.textContent = '🗑️';
      unfriendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleUnfriend(parseInt(String(friend.id)));
      });

      actions.appendChild(unfriendBtn);

      item.appendChild(left);
      item.appendChild(actions);
      item.addEventListener('click', () => this.startChatWithFriend(parseInt(String(friend.id))));

      fragment.appendChild(item);
    });

    return fragment;
  }

  private setupEventListeners() {
    // Close panel
    this.container.querySelector('.close-panel')?.addEventListener('click', () => {
      this.hide();
    });

    // Add friend button
    document.getElementById('add-friend-btn')?.addEventListener('click', () => {
      this.showAddFriendModal();
    });

    // Friend actions
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      if (!button) return;

      if (button.classList.contains('game-invite-btn')) {
        const userId = button.getAttribute('data-user-id');
        const username = button.getAttribute('data-username');
        if (userId && username) {
          remoteGameInvite.sendInvite(userId, username);
        }
      }

      if (button.classList.contains('friend-unfriend-btn')) {
        const friendId = button.getAttribute('data-friend-id');
        if (friendId) this.handleUnfriend(parseInt(friendId));
      }
    });

    // Search functionality
    const searchInput = document.getElementById('friendlist-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.handleSearch((e.target as HTMLInputElement).value);
    });
  }

  private setupSubscriptions() {
    subscribe(({ friends }) => {
      const friendsContainer = document.getElementById('friend-list-container');
      if (friendsContainer) {
        // Clear and append new fragment
        while (friendsContainer.firstChild) friendsContainer.removeChild(friendsContainer.firstChild);
        friendsContainer.appendChild(this.renderFriendsList(friends));
      }
    });
  }

  private async loadUnreadCounts() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/messages/unread/counts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.unreadCounts = new Map(Object.entries(data.unreadCounts || {}));
        // Re-render friend list to show updated counts
        this.render();
      }
    } catch (error) {
      // Silently handle errors loading unread counts
    }
  }

  private async handleUnfriend(friendId: number) {
    if (confirm('Are you sure you want to remove this friend?')) {
      const res = await handleFriendAction(friendId, 'unfriend');
      if (res.ok) {
        removeFriend(friendId);
        this.showToast('Friend removed', 'success');
      } else {
        this.showToast('Failed to remove friend', 'error');
      }
    }
  }

  private async startChatWithFriend(friendId: number) {
    const friends = getCurrentFriends();
    const friend = friends.find(f => f.id === friendId);
    const friendName = friend?.username || `Friend ${friendId}`;
    // Delegate to chat component (opens or creates the private conversation)
    this.chatComponent.startPrivateChat(String(friendId), friendName);
    this.hide(); // Close friend list when opening chat

    // Reload unread counts after a short delay to allow messages to be marked as read
    setTimeout(() => this.loadUnreadCounts(), 500);
  }

  private handleSearch(query: string) {
    const friends = getCurrentFriends();
    const filtered = friends.filter(friend =>
      friend.username.toLowerCase().includes(query.toLowerCase())
    );

    const friendsContainer = document.getElementById('friend-list-container');
    if (friendsContainer) {
      // Clear and append new fragment
      while (friendsContainer.firstChild) friendsContainer.removeChild(friendsContainer.firstChild);
      friendsContainer.appendChild(this.renderFriendsList(filtered));
    }
  }

  private showAddFriendModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    const box = document.createElement('div');
    box.className = 'bg-white rounded-lg p-6 w-96 max-w-full mx-4';

    const topRow = document.createElement('div');
    topRow.className = 'flex justify-between items-center mb-4';
    const heading = document.createElement('h3');
    heading.className = 'text-lg font-semibold text-gray-800';
    heading.textContent = 'Add Friend';
    const closeModalBtn = document.createElement('button');
    closeModalBtn.className = 'text-gray-400 hover:text-gray-600 text-xl close-modal';
    closeModalBtn.textContent = '×';
    topRow.appendChild(heading);
    topRow.appendChild(closeModalBtn);

    const searchBlock = document.createElement('div');
    searchBlock.className = 'mb-4';
    const searchLabel = document.createElement('label');
    searchLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
    searchLabel.textContent = 'Search by username';
    const searchFlex = document.createElement('div');
    searchFlex.className = 'flex gap-2';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search-username';
    searchInput.placeholder = 'Enter username...';
    searchInput.className = 'flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
    const searchBtn = document.createElement('button');
    searchBtn.id = 'search-user-btn';
    searchBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors';
    searchBtn.textContent = 'Search';
    searchFlex.appendChild(searchInput);
    searchFlex.appendChild(searchBtn);
    searchBlock.appendChild(searchLabel);
    searchBlock.appendChild(searchFlex);

    const results = document.createElement('div');
    results.id = 'search-results';
    results.className = 'space-y-2 max-h-60 overflow-y-auto mb-4';
    const placeholder = document.createElement('div');
    placeholder.className = 'text-center text-gray-500 py-4';
    placeholder.textContent = 'Enter a username to search';
    results.appendChild(placeholder);

    const actionRow = document.createElement('div');
    actionRow.className = 'flex gap-2';
    const sendBtn = document.createElement('button');
    sendBtn.id = 'send-request-btn';
    sendBtn.className = 'flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    sendBtn.disabled = true;
    sendBtn.textContent = 'Send Request';
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-modal';
    cancelBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors';
    cancelBtn.textContent = 'Cancel';
    actionRow.appendChild(sendBtn);
    actionRow.appendChild(cancelBtn);

    const modalMessage = document.createElement('div');
    modalMessage.id = 'modal-message';
    modalMessage.className = 'mt-3 text-sm';

    box.appendChild(topRow);
    box.appendChild(searchBlock);
    box.appendChild(results);
    box.appendChild(actionRow);
    box.appendChild(modalMessage);
    modal.appendChild(box);
    document.body.appendChild(modal);

    // Event listeners
    const closeModal = () => modal.remove();
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Search functionality
    searchBtn.addEventListener('click', () => {
      this.handleUserSearch();
    });
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleUserSearch();
      }
    });

    // Send request button
    sendBtn.addEventListener('click', () => {
      this.handleSendFriendRequest();
    });
  }

  private async handleUserSearch() {
    const searchInput = document.getElementById('search-username') as HTMLInputElement;
    const username = searchInput?.value.trim();
    const resultsContainer = document.getElementById('search-results');
    const messageEl = document.getElementById('modal-message');

    if (!username) {
      if (messageEl) {
        messageEl.textContent = '';
        const msg = document.createElement('div');
        msg.className = 'text-red-400';
        msg.textContent = 'Please enter a username';
        messageEl.appendChild(msg);
      }
      return;
    }

    try {
      // Use the search API
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        if (messageEl) {
          messageEl.textContent = '';
          const msg = document.createElement('div');
          msg.className = 'text-red-400';
          msg.textContent = `Error: ${data.error || 'Search failed'}`;
          messageEl.appendChild(msg);
        }
        return;
      }

      this.displaySearchResults(data.users || []);

    } catch (error) {
      if (messageEl) {
        messageEl.textContent = '';
        const msg = document.createElement('div');
        msg.className = 'text-red-400';
        msg.textContent = 'Search failed';
        messageEl.appendChild(msg);
      }
    }
  }

  private displaySearchResults(users: any[]) {
    const resultsContainer = document.getElementById('search-results');
    const sendRequestBtn = document.getElementById('send-request-btn') as HTMLButtonElement;

    if (!resultsContainer) return;

    if (users.length === 0) {
      resultsContainer.textContent = '';
      const noRes = document.createElement('div');
      noRes.className = 'text-center text-gray-500 py-4';
      noRes.textContent = 'No users found';
      resultsContainer.appendChild(noRes);
      sendRequestBtn.disabled = true;
      return;
    }

    resultsContainer.textContent = '';
    users.forEach(user => {
      const row = document.createElement('div');
      row.className = 'p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors user-result';
      row.setAttribute('data-user-id', String(user.id));

      const inner = document.createElement('div');
      inner.className = 'flex items-center gap-3';
      const img = document.createElement('img');
      img.src = user.avatarUrl || '/public/default-avatar.svg';
      img.alt = user.username || 'User';
      img.className = 'w-10 h-10 rounded-full object-cover';
      img.onerror = () => { img.src = '/public/default-avatar.svg'; };
      const txtWrap = document.createElement('div');
      txtWrap.className = 'flex-1';
      const uname = document.createElement('div');
      uname.className = 'font-medium text-sm text-gray-800';
      uname.textContent = user.username;
      const meta = document.createElement('div');
      meta.className = 'text-xs text-gray-500 capitalize';
      meta.textContent = `${user.onlineStatus || 'offline'} • ${user.relationship || 'none'}`;
      txtWrap.appendChild(uname);
      txtWrap.appendChild(meta);
      inner.appendChild(img);
      inner.appendChild(txtWrap);
      row.appendChild(inner);
      resultsContainer.appendChild(row);
    });

    // Add click handlers
    resultsContainer.querySelectorAll('.user-result').forEach(el => {
      el.addEventListener('click', () => {
        // Remove previous selection
        resultsContainer.querySelectorAll('.user-result').forEach(item => {
          item.classList.remove('bg-blue-50', 'border', 'border-blue-200');
        });

        // Select this user
        el.classList.add('bg-blue-50', 'border', 'border-blue-200');

        // Enable send button
        sendRequestBtn.disabled = false;
        sendRequestBtn.setAttribute('data-user-id', el.getAttribute('data-user-id') || '');
        sendRequestBtn.setAttribute('data-username', (el.querySelector('.font-medium')?.textContent || '').trim());
      });
    });
  }

  private async handleSendFriendRequest() {
    const sendRequestBtn = document.getElementById('send-request-btn') as HTMLButtonElement;
    const userId = sendRequestBtn.getAttribute('data-user-id');
    const username = sendRequestBtn.getAttribute('data-username');
    const messageEl = document.getElementById('modal-message');

    if (!userId || !username) {
      if (messageEl) {
        messageEl.textContent = '';
        const msg = document.createElement('div');
        msg.className = 'text-red-400';
        msg.textContent = 'Please select a user first';
        messageEl.appendChild(msg);
      }
      return;
    }

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ friendUsername: username })
      });

      const data = await res.json();

      if (res.ok) {
        if (messageEl) {
          messageEl.textContent = '';
          const msg = document.createElement('div');
          msg.className = 'text-green-400';
          msg.textContent = `Friend request sent to ${username}!`;
          messageEl.appendChild(msg);
        }
        sendRequestBtn.disabled = true;

        // Close modal after 2 seconds
        setTimeout(() => {
          document.querySelector('.fixed.inset-0')?.remove();
        }, 2000);
      } else {
        if (messageEl) {
          messageEl.textContent = '';
          const msg = document.createElement('div');
          msg.className = 'text-red-400';
          msg.textContent = `Error: ${data.error || 'Request failed'}`;
          messageEl.appendChild(msg);
        }
      }

    } catch (error) {
      if (messageEl) {
        messageEl.textContent = '';
        const msg = document.createElement('div');
        msg.className = 'text-red-400';
        msg.textContent = 'Failed to send request';
        messageEl.appendChild(msg);
      }
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