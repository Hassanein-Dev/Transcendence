import { router } from '../router';
import { searchUsers, handleFriendAction, sendFriendRequest as apiSendFriendRequest, getFriendSuggestions, getBlockedUsers, unblockUser } from '../services/api';
import { loadFriends, loadFriendRequests, getCurrentFriends, getCurrentFriendRequests, removeFriend, removeFriendRequest } from '../stores/friendState';
import { NotificationSystem } from '../components/ui/notifications';
import { eventBus, Events } from '../services/eventBus';

const notificationSystem = new NotificationSystem();

let debounceTimer: number | null = null;
let renderFriendsTimer: number | null = null; // Debounce timer for renderFriendsList
let currentSearchQuery = '';
let hiddenSuggestions: Set<number> = new Set();
// Store event callbacks for cleanup
let friendsUpdatedCallback: (() => void) | null = null;
let friendRequestsUpdatedCallback: (() => void) | null = null;
let friendStatusChangedCallback: ((data: any) => void) | null = null;

export async function renderFriends() {
  const app = document.getElementById("app")!;
  app.textContent = '';

  const root = document.createElement('div');
  root.className = 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 p-4 md:p-8';

  const container = document.createElement('div');
  container.className = 'max-w-5xl mx-auto space-y-6';

  // Header
  const header = document.createElement('div');
  header.className = 'mb-6';
  const title = document.createElement('h1');
  title.className = 'text-4xl font-bold flex items-center gap-3';
  
  const emoji = document.createElement('span');
  emoji.textContent = '👥';
  
  const titleText = document.createElement('span');
  titleText.className = 'bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent';
  titleText.textContent = 'Friends';
  
  title.appendChild(emoji);
  title.appendChild(titleText);
  
  const subtitle = document.createElement('p');
  subtitle.className = 'text-gray-400 mt-2';
  subtitle.textContent = 'Connect with other Pong players';
  header.appendChild(title);
  header.appendChild(subtitle);
  container.appendChild(header);

  // 1. Search Section
  container.appendChild(createSearchSection());

  // 2. Friend Requests (if any)
  await loadFriendRequests();
  const requests = getCurrentFriendRequests();
  if (requests.length > 0) {
    container.appendChild(createRequestsSection());
  }

  // 3. Suggested Friends
  container.appendChild(createSuggestionsSection());

  // 4. Friends List
  container.appendChild(createFriendsSection());

  // 5. Blocked Users
  container.appendChild(createBlockedSection());

  root.appendChild(container);
  app.appendChild(root);

  // Setup event listeners
  setupEventListeners();
  setupRealtimeListeners();

  // Load data
  await Promise.all([
    renderSuggestions(),
    renderFriendsList(),
    renderFriendRequests(),
    renderBlockedUsers()
  ]);
}

// ============================================================================
// Section Creators
// ============================================================================

function createSearchSection() {
  const section = document.createElement('div');
  section.className = 'bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl relative z-50';
  section.style.overflow = 'visible';

  const searchTitle = document.createElement('h2');
  searchTitle.className = 'text-xl font-bold text-white mb-4';
  searchTitle.textContent = '🔍 Find Friends';

  const rel = document.createElement('div');
  rel.className = 'relative z-50';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'friends-search';
  searchInput.placeholder = 'Search by username...';
  searchInput.className = 'w-full px-4 py-3 pl-12 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all';

  const searchIcon = document.createElement('div');
  searchIcon.className = 'absolute left-4 top-3.5 text-gray-400 text-xl';
  searchIcon.textContent = '🔍';

  const searchResults = document.createElement('div');
  searchResults.id = 'search-results';
  searchResults.className = 'absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-lg border border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto hidden';

  rel.appendChild(searchInput);
  rel.appendChild(searchIcon);
  rel.appendChild(searchResults);

  const searchLoading = document.createElement('div');
  searchLoading.id = 'search-loading';
  searchLoading.className = 'hidden mt-2 text-center text-gray-400 text-sm';
  searchLoading.innerHTML = `<div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent mr-2"></div>Searching...`;

  section.appendChild(searchTitle);
  section.appendChild(rel);
  section.appendChild(searchLoading);

  return section;
}

function createRequestsSection() {
  const section = document.createElement('div');
  section.className = 'bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl relative z-0';
  section.id = 'requests-section';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4';

  const title = document.createElement('h2');
  title.className = 'text-xl font-bold text-white';
  title.textContent = '📨 Friend Requests';

  const count = document.createElement('span');
  count.className = 'px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium';
  count.id = 'requests-count';

  header.appendChild(title);
  header.appendChild(count);

  const container = document.createElement('div');
  container.id = 'requests-container';
  container.className = 'space-y-3';

  section.appendChild(header);
  section.appendChild(container);

  return section;
}

function createSuggestionsSection() {
  const section = document.createElement('div');
  section.className = 'bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl relative z-0';

  const title = document.createElement('h2');
  title.className = 'text-xl font-bold text-white mb-4';
  title.textContent = '✨ People You May Know';

  const container = document.createElement('div');
  container.id = 'suggestions-container';
  container.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

  section.appendChild(title);
  section.appendChild(container);

  return section;
}

function createFriendsSection() {
  const section = document.createElement('div');
  section.className = 'bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl relative z-0';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4';

  const title = document.createElement('h2');
  title.className = 'text-xl font-bold text-white';
  title.textContent = '👥 Your Friends';

  const stats = document.createElement('div');
  stats.className = 'flex items-center space-x-3';

  const onlineSpan = document.createElement('span');
  onlineSpan.className = 'px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm font-medium';
  onlineSpan.id = 'online-count';
  onlineSpan.innerHTML = `<span id="online-friends-count">0</span> online`;

  const totalSpan = document.createElement('span');
  totalSpan.className = 'px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium';
  totalSpan.innerHTML = `<span id="total-friends-count">0</span> total`;

  stats.appendChild(onlineSpan);
  stats.appendChild(totalSpan);
  header.appendChild(title);
  header.appendChild(stats);

  const container = document.createElement('div');
  container.id = 'friends-container';
  container.className = 'space-y-3';

  section.appendChild(header);
  section.appendChild(container);

  return section;
}

function createBlockedSection() {
  const section = document.createElement('div');
  section.className = 'bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl relative z-0';
  section.id = 'blocked-section';
  section.style.display = 'none'; // Hidden by default

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4';

  const title = document.createElement('h2');
  title.className = 'text-xl font-bold text-white';
  title.textContent = '🚫 Blocked Users';

  const count = document.createElement('span');
  count.className = 'px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium';
  count.id = 'blocked-count';

  header.appendChild(title);
  header.appendChild(count);

  const container = document.createElement('div');
  container.id = 'blocked-container';
  container.className = 'space-y-3';

  section.appendChild(header);
  section.appendChild(container);

  return section;
}

// ============================================================================
// Render Functions
// ============================================================================

async function renderSuggestions() {
  const container = document.getElementById('suggestions-container');
  if (!container) return;

  try {
    const res = await getFriendSuggestions();
    const suggestions = (res.body?.suggestions || []).filter((s: any) => !hiddenSuggestions.has(s.id));

    container.textContent = '';

    if (suggestions.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-center py-8 col-span-2">No suggestions at the moment</p>';
      return;
    }

    suggestions.forEach((user: any) => {
      const card = document.createElement('div');
      card.className = 'flex items-center justify-between p-4 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-all';
      card.setAttribute('data-suggestion-id', String(user.id));

      // Left: Avatar + Info
      const left = document.createElement('div');
      left.className = 'flex items-center space-x-3 flex-1 cursor-pointer';
      left.onclick = () => router.navigate(`/user/${user.id}`);

      const img = document.createElement('img');
      img.src = user.avatarUrl || '/public/default-avatar.svg';
      img.className = 'w-12 h-12 rounded-full object-cover border-2 border-gray-600';
      img.onerror = () => { img.src = '/public/default-avatar.svg'; };

      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'font-bold text-white';
      name.textContent = user.username;

      const reason = document.createElement('div');
      reason.className = 'text-sm text-gray-400';
      reason.textContent = user.reason;

      info.appendChild(name);
      info.appendChild(reason);
      left.appendChild(img);
      left.appendChild(info);

      // Right: Buttons
      const actions = document.createElement('div');
      actions.className = 'flex space-x-2';

      const addBtn = document.createElement('button');
      addBtn.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
      addBtn.innerHTML = '<span>➕</span><span>Add Friend</span>';
      addBtn.onclick = async (e) => {
        e.stopPropagation();
        await sendFriendRequest(user.username);
        // Refresh suggestions to update the list
        await renderSuggestions();
      };

      const removeBtn = document.createElement('button');
      removeBtn.className = 'px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
      removeBtn.innerHTML = '<span>✖️</span><span>Remove</span>';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        hiddenSuggestions.add(user.id);
        card.remove();
      };

      actions.appendChild(addBtn);
      actions.appendChild(removeBtn);

      card.appendChild(left);
      card.appendChild(actions);
      container.appendChild(card);
    });
  } catch (error) {
    container.innerHTML = '<p class="text-red-400 text-center py-8 col-span-2">Failed to load suggestions</p>';
  }
}

// Debounced version to prevent multiple rapid re-renders
function renderFriendsListDebounced() {
  if (renderFriendsTimer) clearTimeout(renderFriendsTimer);
  renderFriendsTimer = window.setTimeout(() => {
    renderFriendsList();
  }, 100);
}

async function renderFriendsList() {
  await loadFriends();
  const friends = getCurrentFriends();
  const container = document.getElementById('friends-container');
  const onlineCount = friends.filter(f => f.onlineStatus === 'online').length;

  // Update counters
  const onlineCountEl = document.getElementById('online-friends-count');
  const totalCountEl = document.getElementById('total-friends-count');

  if (onlineCountEl) onlineCountEl.textContent = onlineCount.toString();
  if (totalCountEl) totalCountEl.textContent = friends.length.toString();

  if (!container) return;

  container.textContent = '';

  if (friends.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-12';
    empty.innerHTML = `
      <div class="text-6xl mb-4">👥</div>
      <h3 class="text-xl font-bold text-white mb-2">No friends yet</h3>
      <p class="text-gray-400 mb-6">Start by searching for players above!</p>
    `;
    container.appendChild(empty);
    return;
  }

  friends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'cursor-pointer p-4 bg-gray-700/30 rounded-xl border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-700/50 transition-all';
    item.setAttribute('data-friend-id', String(friend.id));

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between';

    // Left side
    const leftSide = document.createElement('div');
    leftSide.className = 'flex items-center space-x-3 flex-1 min-w-0 cursor-pointer';
    leftSide.onclick = () => router.navigate(`/user/${friend.id}`);

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'relative flex-shrink-0';

    const img = document.createElement('img');
    img.src = friend.picture || friend.avatarUrl || '/public/default-avatar.svg';
    img.className = `w-12 h-12 rounded-full object-cover border-2 ${getStatusBorderClass(friend.onlineStatus)}`;
    img.onerror = () => { img.src = '/public/default-avatar.svg'; };

    const statusDot = document.createElement('div');
    statusDot.className = `absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(friend.onlineStatus)} rounded-full border-2 border-gray-800`;

    avatarWrap.appendChild(img);
    avatarWrap.appendChild(statusDot);

    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0';

    const uname = document.createElement('div');
    uname.className = 'font-bold text-white truncate';
    uname.textContent = friend.username;

    const statusText = document.createElement('div');
    statusText.className = `text-sm ${getStatusTextClass(friend.onlineStatus)} capitalize`;
    statusText.textContent = getStatusDisplay(friend.onlineStatus);

    info.appendChild(uname);
    info.appendChild(statusText);

    leftSide.appendChild(avatarWrap);
    leftSide.appendChild(info);

    // Right side: Action buttons
    const actions = document.createElement('div');
    actions.className = 'flex items-center space-x-2 ml-4';

    const messageBtn = document.createElement('button');
    messageBtn.className = 'message-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
    messageBtn.setAttribute('data-friend-id', String(friend.id));
    messageBtn.innerHTML = '<span>💬</span><span>Message</span>';

    const unfriendBtn = document.createElement('button');
    unfriendBtn.className = 'unfriend-btn px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
    unfriendBtn.setAttribute('data-friend-id', String(friend.id));
    unfriendBtn.innerHTML = '<span>👋</span><span>Unfriend</span>';

    const blockBtn = document.createElement('button');
    blockBtn.className = 'block-btn px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
    blockBtn.setAttribute('data-friend-id', String(friend.id));
    blockBtn.innerHTML = '<span>🚫</span><span>Block</span>';

    actions.appendChild(messageBtn);
    actions.appendChild(unfriendBtn);
    actions.appendChild(blockBtn);

    row.appendChild(leftSide);
    row.appendChild(actions);
    item.appendChild(row);
    container.appendChild(item);
  });

  setupFriendListEventListeners();
}

async function renderFriendRequests() {
  const requests = getCurrentFriendRequests();
  const container = document.getElementById('requests-container');
  const countElement = document.getElementById('requests-count');

  if (countElement) {
    countElement.textContent = `${requests.length} pending`;
  }

  if (!container) return;

  container.textContent = '';

  if (requests.length === 0) {
    // Hide the requests section if no requests
    const section = document.getElementById('requests-section');
    if (section) section.style.display = 'none';
    return;
  }

  // Show the requests section
  const section = document.getElementById('requests-section');
  if (section) section.style.display = 'block';

  requests.forEach(request => {
    const item = document.createElement('div');
    item.className = 'p-4 bg-gray-700/30 rounded-xl';

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between';

    const left = document.createElement('div');
    left.className = 'flex items-center space-x-3 flex-1';

    const img = document.createElement('img');
    img.src = request.picture || request.avatarUrl || '/public/default-avatar.svg';
    img.className = 'w-12 h-12 rounded-full object-cover border-2 border-gray-600';
    img.onerror = () => { img.src = '/public/default-avatar.svg'; };

    const info = document.createElement('div');
    const uname = document.createElement('div');
    uname.className = 'font-bold text-white';
    uname.textContent = request.username;

    const time = document.createElement('div');
    time.className = 'text-sm text-gray-400';
    time.textContent = formatRequestTime(request.requestedAt || request.created_at || '');

    info.appendChild(uname);
    info.appendChild(time);
    left.appendChild(img);
    left.appendChild(info);

    const right = document.createElement('div');
    right.className = 'flex space-x-2 ml-4';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'confirm-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
    acceptBtn.setAttribute('data-user-id', String(request.id));
    acceptBtn.innerHTML = '<span>✅</span><span>Accept</span>';

    const declineBtn = document.createElement('button');
    declineBtn.className = 'decline-btn px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
    declineBtn.setAttribute('data-user-id', String(request.id));
    declineBtn.innerHTML = '<span>❌</span><span>Decline</span>';

    right.appendChild(acceptBtn);
    right.appendChild(declineBtn);

    row.appendChild(left);
    row.appendChild(right);
    item.appendChild(row);
    container.appendChild(item);
  });

  setupRequestsEventListeners();
}

async function renderBlockedUsers() {
  try {
    const res = await getBlockedUsers();
    const blocked = res.body?.blocked || [];
    const container = document.getElementById('blocked-container');
    const countElement = document.getElementById('blocked-count');
    const section = document.getElementById('blocked-section');

    if (countElement) {
      countElement.textContent = `${blocked.length} blocked`;
    }

    if (!container) return;

    container.textContent = '';

    if (blocked.length === 0) {
      // Hide the blocked section if no blocked users
      if (section) section.style.display = 'none';
      return;
    }

    // Show the blocked section
    if (section) section.style.display = 'block';

    blocked.forEach((user: any) => {
      const item = document.createElement('div');
      item.className = 'p-4 bg-gray-700/30 rounded-xl border border-red-500/20';

      const row = document.createElement('div');
      row.className = 'flex items-center justify-between';

      const left = document.createElement('div');
      left.className = 'flex items-center space-x-3 flex-1';

      const img = document.createElement('img');
      img.src = user.picture || user.avatarUrl || '/public/default-avatar.svg';
      img.className = 'w-12 h-12 rounded-full object-cover border-2 border-red-500/50 opacity-60';
      img.onerror = () => { img.src = '/public/default-avatar.svg'; };

      const info = document.createElement('div');
      const uname = document.createElement('div');
      uname.className = 'font-bold text-white';
      uname.textContent = user.username;

      info.appendChild(uname);
      left.appendChild(img);
      left.appendChild(info);

      const right = document.createElement('div');
      right.className = 'flex space-x-2 ml-4';

      const unblockBtn = document.createElement('button');
      unblockBtn.className = 'unblock-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2';
      unblockBtn.setAttribute('data-user-id', String(user.id));
      unblockBtn.innerHTML = '<span>✅</span><span>Unblock</span>';

      right.appendChild(unblockBtn);

      row.appendChild(left);
      row.appendChild(right);
      item.appendChild(row);
      container.appendChild(item);
    });

    setupBlockedEventListeners();
  } catch (error) {
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  // Search with debounce
  const searchInput = document.getElementById('friends-search') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim();
    currentSearchQuery = query;

    if (debounceTimer) clearTimeout(debounceTimer);

    if (query.length === 0) {
      hideSearchResults();
      return;
    }

    const loadingEl = document.getElementById('search-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');

    debounceTimer = window.setTimeout(() => {
      handleSearch(query);
    }, 300);
  });

  searchInput?.addEventListener('focus', () => {
    if (currentSearchQuery) {
      handleSearch(currentSearchQuery);
    }
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const searchContainer = document.getElementById('search-results');
    const searchInput = document.getElementById('friends-search');

    if (searchContainer && searchInput &&
      !searchContainer.contains(target) &&
      !searchInput.contains(target)) {
      hideSearchResults();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideSearchResults();
    }
  });
}

function setupRealtimeListeners() {
  // Clean up old event listeners first
  if (friendsUpdatedCallback) {
    eventBus.off(Events.FRIENDS_UPDATED, friendsUpdatedCallback);
  }
  if (friendRequestsUpdatedCallback) {
    eventBus.off(Events.FRIEND_REQUESTS_UPDATED, friendRequestsUpdatedCallback);
  }
  if (friendStatusChangedCallback) {
    eventBus.off(Events.FRIEND_STATUS_CHANGED, friendStatusChangedCallback);
  }

  // Use debounced version to prevent multiple rapid re-renders
  friendsUpdatedCallback = () => {
    renderFriendsListDebounced();
  };
  eventBus.on(Events.FRIENDS_UPDATED, friendsUpdatedCallback);

  friendRequestsUpdatedCallback = () => {
    renderFriendRequests();
  };
  eventBus.on(Events.FRIEND_REQUESTS_UPDATED, friendRequestsUpdatedCallback);

  friendStatusChangedCallback = (data: { friendId: number, status: string }) => {
    updateFriendStatusUI(data.friendId, data.status);
  };
  eventBus.on(Events.FRIEND_STATUS_CHANGED, friendStatusChangedCallback);

  // Listen for friend actions from friend profile page
  window.addEventListener('friend-action', async (e: any) => {
    const action = e.detail?.action;
    if (action === 'unfriend' || action === 'block') {
      await Promise.all([loadFriends(), loadFriendRequests(), loadBlockedUsers()]);
      renderFriendsList();
      renderFriendRequests();
      renderBlockedUsers();
      updateRequestCountBadge();
    }
  });
}

function setupFriendListEventListeners() {
  // Message buttons
  document.querySelectorAll('.message-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const friendId = btn.getAttribute('data-friend-id');
      if (friendId) {
        eventBus.emit('OPEN_CHAT', { userId: friendId });
        notificationSystem.show('💬 Opening chat...', 'success');
      }
    });
  });

  // Unfriend buttons
  document.querySelectorAll('.unfriend-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const friendId = btn.getAttribute('data-friend-id');
      if (friendId && confirm('Are you sure you want to unfriend this user?')) {
        await handleFriendAction(parseInt(friendId), 'unfriend');
        removeFriend(parseInt(friendId));
        notificationSystem.show('✅ Friend removed', 'success');
        await Promise.all([loadFriends(), loadFriendRequests()]);
        // Use debounced version to prevent race condition with FRIENDS_UPDATED event
        renderFriendsListDebounced();
        renderFriendRequests();
        updateRequestCountBadge();
      }
    });
  });

  // Block buttons
  document.querySelectorAll('.block-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const friendId = btn.getAttribute('data-friend-id');
      if (friendId && confirm('Are you sure you want to block this user?')) {
        await handleFriendAction(parseInt(friendId), 'block');
        removeFriend(parseInt(friendId));
        notificationSystem.show('🚫 User blocked', 'info');
        await loadFriends();
        // Refresh both friends list and blocked users list
        renderFriendsListDebounced();
        await renderBlockedUsers();
      }
    });
  });

  // Friend item click (view profile)
  document.querySelectorAll('[data-friend-id]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button')) {
        const friendId = item.getAttribute('data-friend-id');
        if (friendId) {
          router.navigate(`/user/${friendId}`);
        }
      }
    });
  });
}

function setupRequestsEventListeners() {
  document.querySelectorAll('.confirm-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const userId = btn.getAttribute('data-user-id');
      if (userId) {
        await handleFriendAction(parseInt(userId), 'accept');
        removeFriendRequest(parseInt(userId));
        notificationSystem.show('✅ Friend request accepted!', 'success');
        await Promise.all([loadFriends(), loadFriendRequests()]);
        renderFriendsList();
        renderFriendRequests();
        // Update count badge and hide section if empty
        updateRequestCountBadge();
        const requests = getCurrentFriendRequests();
        if (requests.length === 0) {
          const requestsSection = document.getElementById('requests-section');
          if (requestsSection) requestsSection.remove();
        }
      }
    });
  });

  document.querySelectorAll('.decline-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const userId = btn.getAttribute('data-user-id');
      if (userId) {
        await handleFriendAction(parseInt(userId), 'reject');
        removeFriendRequest(parseInt(userId));
        notificationSystem.show('❌ Friend request declined', 'info');
        await loadFriendRequests();
        renderFriendRequests();
        // Update count badge and hide section if empty
        updateRequestCountBadge();
        const requests = getCurrentFriendRequests();
        if (requests.length === 0) {
          const requestsSection = document.getElementById('requests-section');
          if (requestsSection) requestsSection.remove();
        }
      }
    });
  });
}

function setupBlockedEventListeners() {
  document.querySelectorAll('.unblock-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const userId = btn.getAttribute('data-user-id');
      if (userId && confirm('Are you sure you want to unblock this user?')) {
        try {
          await unblockUser(parseInt(userId));
          notificationSystem.show('✅ User unblocked', 'success');
          await renderBlockedUsers();
          // Refresh suggestions (unblocked user might appear)
          await renderSuggestions();
          // Update blocked count badge
          const blockedContainer = document.getElementById('blocked-container');
          const blockedSection = document.getElementById('blocked-section');
          if (blockedContainer && blockedContainer.children.length === 0 && blockedSection) {
            blockedSection.style.display = 'none';
          }
        } catch (error) {
          notificationSystem.show('❌ Failed to unblock user', 'error');
        }
      }
    });
  });
}

// ============================================================================
// Search Functions
// ============================================================================

async function handleSearch(query: string) {
  const loadingEl = document.getElementById('search-loading');
  if (loadingEl) loadingEl.classList.add('hidden');

  try {
    const res = await searchUsers(query);

    if (res.ok && res.body) {
      const users = res.body.users || res.body.data || res.body;
      showSearchResults(Array.isArray(users) ? users : []);
    } else {
      showSearchResults([]);
    }
  } catch (error) {
    showSearchResults([]);
  }
}

function showSearchResults(users: any[]) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;

  resultsContainer.textContent = '';

  if (users.length > 0) {
    users.forEach(user => {
      const isFriend = user.relationship === 'friend';
      const hasPending = user.relationship === 'pending';

      const item = document.createElement('div');
      item.className = 'p-4 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/30 transition-colors cursor-pointer';

      const row = document.createElement('div');
      row.className = 'flex items-center justify-between';

      const left = document.createElement('div');
      left.className = 'flex items-center space-x-3 flex-1';
      left.onclick = () => {
        router.navigate(`/user/${user.id}`);
        hideSearchResults();
      };

      const img = document.createElement('img');
      img.src = user.picture || user.avatarUrl || '/public/default-avatar.svg';
      img.className = 'w-10 h-10 rounded-full object-cover border-2 border-gray-600';
      img.onerror = () => { img.src = '/public/default-avatar.svg'; };

      const info = document.createElement('div');
      const uname = document.createElement('div');
      uname.className = 'font-bold text-white';
      uname.textContent = user.username;

      const status = document.createElement('div');
      status.className = 'text-xs text-gray-400';
      status.textContent = getStatusDisplay(user.onlineStatus);

      info.appendChild(uname);
      info.appendChild(status);
      left.appendChild(img);
      left.appendChild(info);

      const right = document.createElement('div');

      if (isFriend) {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-2 bg-gray-700 text-gray-400 rounded-lg text-sm cursor-not-allowed flex items-center gap-2';
        btn.disabled = true;
        btn.innerHTML = '<span>✅</span><span>Friends</span>';
        right.appendChild(btn);
      } else if (hasPending) {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm cursor-not-allowed flex items-center gap-2';
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span><span>Pending</span>';
        right.appendChild(btn);
      } else {
        const addBtn = document.createElement('button');
        addBtn.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-all flex items-center gap-2';
        addBtn.innerHTML = '<span>➕</span><span>Add Friend</span>';
        addBtn.onclick = (e) => {
          e.stopPropagation();
          sendFriendRequest(user.username);
        };
        right.appendChild(addBtn);
      }

      row.appendChild(left);
      row.appendChild(right);
      item.appendChild(row);
      resultsContainer.appendChild(item);
    });
  } else {
    resultsContainer.innerHTML = '<p class="text-gray-400 text-center py-4">No users found</p>';
  }

  resultsContainer.classList.remove('hidden');
}

function hideSearchResults() {
  const resultsContainer = document.getElementById('search-results');
  if (resultsContainer) {
    resultsContainer.classList.add('hidden');
  }
}

async function sendFriendRequest(username: string) {
  try {
    const res = await apiSendFriendRequest(username);

    if (res.ok) {
      notificationSystem.show(`✅ Friend request sent to ${username}!`, 'success');
      // Refresh search results to show updated button state
      const searchInput = document.getElementById('friends-search') as HTMLInputElement;
      if (searchInput && searchInput.value) {
        await handleSearch(searchInput.value);
      }
      // Also refresh suggestions in case they were there
      await renderSuggestions();
    } else {
      const errorMsg = res.body?.error || 'Failed to send request';
      notificationSystem.show(`❌ ${errorMsg}`, 'error');
    }
  } catch (error) {
    notificationSystem.show('❌ Failed to send request', 'error');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function updateRequestCountBadge() {
  const requests = getCurrentFriendRequests();
  const badge = document.getElementById('requests-count');
  if (badge) {
    badge.textContent = requests.length.toString();
  }
}

async function loadBlockedUsers() {
  // Just a wrapper to reload blocked users from the API
  const blockedSection = document.getElementById('blocked-section');
  if (blockedSection) {
    await renderBlockedUsers();
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'bg-green-500';
    case 'ingame': return 'bg-blue-500';
    case 'away': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
}

function getStatusBorderClass(status: string): string {
  switch (status) {
    case 'online': return 'border-green-500';
    case 'ingame': return 'border-blue-500';
    case 'away': return 'border-yellow-500';
    default: return 'border-gray-500';
  }
}

function getStatusTextClass(status: string): string {
  switch (status) {
    case 'online': return 'text-green-400';
    case 'ingame': return 'text-blue-400';
    case 'away': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
}

function getStatusDisplay(status: string): string {
  switch (status) {
    case 'online': return 'Online';
    case 'ingame': return '🎮 In Game';
    case 'away': return 'Away';
    default: return 'Offline';
  }
}

function formatRequestTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  } catch {
    return 'Recently';
  }
}

function updateFriendStatusUI(friendId: number, status: string) {
  const friendItem = document.querySelector(`[data-friend-id="${friendId}"]`);
  if (!friendItem) return;

  const statusDot = friendItem.querySelector('.absolute.w-3.h-3');
  const statusText = friendItem.querySelector('.text-sm.capitalize');
  const avatar = friendItem.querySelector('img');

  if (statusDot) {
    statusDot.className = `absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(status)} rounded-full border-2 border-gray-800`;
  }

  if (statusText) {
    statusText.className = `text-sm ${getStatusTextClass(status)} capitalize`;
    statusText.textContent = getStatusDisplay(status);
  }

  if (avatar) {
    avatar.className = `w-12 h-12 rounded-full object-cover border-2 ${getStatusBorderClass(status)}`;
  }

  // Update counters without full re-render
  const friends = getCurrentFriends();
  const onlineCount = friends.filter(f => f.onlineStatus === 'online').length;
  const onlineCountEl = document.getElementById('online-friends-count');
  if (onlineCountEl) {
    onlineCountEl.textContent = onlineCount.toString();
  }
}