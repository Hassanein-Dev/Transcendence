import { getUserProfile, getUserGames, handleFriendAction, sendFriendRequest as apiSendFriendRequest } from "../services/api";
import { router } from "../router";
import { NotificationSystem } from "../components/ui/notifications";
import { eventBus } from "../services/eventBus";

const notificationSystem = new NotificationSystem();

const DEFAULT_AVATAR = 'data:image/svg+xml;base64,' + btoa(`
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#4F46E5"/>
  <circle cx="50" cy="40" r="15" fill="#A5B4FC"/>
  <path d="M30 70 Q50 85 70 70" stroke="#A5B4FC" stroke-width="8" fill="none"/>
</svg>
`);

let currentUserGames: any[] = [];

export async function renderFriendProfile(userId: string) {
  const app = document.getElementById("app")!;

  // Show navigation
  const nav = document.querySelector("nav");
  if (nav) {
    nav.style.display = 'block';
  }

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50">
      <!-- Header with background pattern -->
      <div class="relative overflow-hidden">
        <!-- Animated background -->
        <div class="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-transparent to-blue-600/20"></div>
        <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent"></div>
        
        <div class="relative max-w-7xl mx-auto px-4 pb-8">
          <!-- Profile Card -->
          <div class="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
            <!-- Profile Header -->
            <div class="bg-gradient-to-r from-purple-600/30 to-blue-600/30 p-8 relative">
              <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div class="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div class="relative flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0">
                <!-- Profile Picture -->
                <div class="relative group">
                  <div class="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                  <img id="profilePicture" src="${DEFAULT_AVATAR}" 
                       class="relative w-40 h-40 rounded-full border-4 border-gray-900 object-cover" />
                </div>
                
                <!-- Profile Info -->
                <div class="md:ml-8 text-center md:text-left flex-1">
                  <div class="mb-2">
                    <span class="inline-block bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
                      🏆 PONG PLAYER
                    </span>
                  </div>
                  <h1 id="profileFullname" class="text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                    Loading...
                  </h1>
                  <p id="profileUsername" class="text-gray-300 text-lg mb-4">@username</p>
                  <div class="flex items-center space-x-4 text-gray-300">
                    <span class="flex items-center space-x-1">
                      <span class="text-2xl">👥</span>
                      <span id="profileFriendsCount" class="font-semibold">0</span>
                      <span class="text-sm">friends</span>
                    </span>
                    <span class="flex items-center space-x-1">
                      <span class="text-2xl">🏆</span>
                      <span id="headerWinsCount" class="font-semibold">0</span>
                      <span class="text-sm">wins</span>
                    </span>
                  </div>
                </div>
                
                <!-- Action Buttons (Dynamic based on relationship) -->
                <div id="actionButtons" class="flex flex-wrap gap-3 mt-6 md:mt-0">
                  <!-- Buttons will be dynamically added here -->
                </div>
              </div>
            </div>

            <!-- Navigation Tabs -->
            <div class="border-b border-gray-700/50">
              <div class="px-8">
                <nav class="flex space-x-8">
                  <button class="profile-tab py-4 px-2 font-semibold border-b-2 border-purple-500 text-white transition-colors" data-tab="overview">
                    <span class="flex items-center space-x-2">
                      <span>📊</span>
                      <span>Overview</span>
                    </span>
                  </button>
                </nav>
              </div>
            </div>

            <!-- Main Content -->
            <div class="p-8">
              <div id="profileContent" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left Column -->
                <div class="lg:col-span-2 space-y-8">
                  <!-- About Card -->
                  <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                      <span>🌟</span>
                      <span>About</span>
                    </h3>
                    <div class="space-y-6">
                      <div>
                        <div class="text-gray-400 mb-2">Bio</div>
                        <div id="profileBio" class="text-gray-300 bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                          No bio yet.
                        </div>
                      </div>
                      
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">📍</div>
                          <div>
                            <div class="text-sm text-gray-400">Location</div>
                            <div id="profileLivesIn" class="text-white">Unknown</div>
                          </div>
                        </div>
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">🎓</div>
                          <div>
                            <div class="text-sm text-gray-400">Education</div>
                            <div id="profileEducation" class="text-white">Unknown</div>
                          </div>
                        </div>
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">⚧️</div>
                          <div>
                            <div class="text-sm text-gray-400">Gender</div>
                            <div id="profileGender" class="text-white">Unknown</div>
                          </div>
                        </div>
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">🎂</div>
                          <div>
                            <div class="text-sm text-gray-400">Birthday</div>
                            <div id="profileBirthday" class="text-white">Unknown</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Right Column - Stats -->
                <div class="space-y-6">
                  <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl">
                    <h3 class="text-xl font-bold text-white mb-6">Statistics</h3>
                    
                    <div class="space-y-4">
                      <div class="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/20">
                        <div class="flex justify-between items-center mb-2">
                          <span class="text-gray-400">Total Games</span>
                          <span class="text-2xl font-bold text-white" id="totalGames">0</span>
                        </div>
                      </div>
                      
                      <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
                          <div class="text-sm text-gray-400 mb-1">Wins</div>
                          <div class="text-2xl font-bold text-green-400" id="statsWinsCount">0</div>
                        </div>
                        <div class="bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-xl p-4 border border-red-500/20">
                          <div class="text-sm text-gray-400 mb-1">Losses</div>
                          <div class="text-2xl font-bold text-red-400" id="lossesCount">0</div>
                        </div>
                      </div>
                      
                      <div class="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
                        <div class="flex justify-between items-center">
                          <div>
                            <div class="text-sm text-gray-400">Win Rate</div>
                            <div class="text-2xl font-bold text-white" id="winRate">0%</div>
                          </div>
                          <div class="text-4xl">📊</div>
                        </div>
                        <div class="mt-2 w-full bg-gray-700 rounded-full h-2">
                          <div id="winRateBar" class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" style="width: 0%"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load user data
  await loadUserData(userId);
  setupEventListeners();
}

async function loadUserData(userId: string) {
  try {
    const targetUserId = parseInt(userId);
    // Fetch profile and game history
    const [profileRes, gamesRes] = await Promise.all([
      getUserProfile(targetUserId),
      getUserGames(targetUserId),
    ]);

    if (profileRes.ok && profileRes.body) {
      const user = profileRes.body;

      // Update profile info
      const profilePicture = document.getElementById('profilePicture') as HTMLImageElement;
      const profileFullname = document.getElementById('profileFullname');
      const profileUsername = document.getElementById('profileUsername');
      const profileBio = document.getElementById('profileBio');
      const profileLivesIn = document.getElementById('profileLivesIn');
      const profileEducation = document.getElementById('profileEducation');
      const profileGender = document.getElementById('profileGender');
      const profileBirthday = document.getElementById('profileBirthday');
      const profileFriendsCount = document.getElementById('profileFriendsCount');

      if (profilePicture) profilePicture.src = user.avatarUrl || DEFAULT_AVATAR;
      if (profileFullname) profileFullname.textContent = user.fullname || user.username;
      if (profileUsername) profileUsername.textContent = `@${user.username}`;
      if (profileBio) profileBio.textContent = user.bio || 'No bio yet.';
      if (profileLivesIn) profileLivesIn.textContent = user.livesIn || user.lives_in || 'Unknown';
      if (profileEducation) profileEducation.textContent = user.education || 'Unknown';
      if (profileGender) profileGender.textContent = user.gender || 'Unknown';
      if (profileBirthday) profileBirthday.textContent = user.birthday ? new Date(user.birthday).toLocaleDateString() : 'Unknown';
      if (profileFriendsCount) profileFriendsCount.textContent = String(user.friendCount || 0);

      // Update action buttons based on relationship
      updateActionButtons(user);
    }

    // Load games
    if (gamesRes.ok && gamesRes.body) {
      currentUserGames = gamesRes.body;
      updateStats(currentUserGames);
    }
  } catch (error) {
    notificationSystem.show('Failed to load user profile', 'error');
  }
}

function updateActionButtons(user: any) {
  const actionButtons = document.getElementById('actionButtons');
  if (!actionButtons) return;

  actionButtons.innerHTML = '';

  const relationship = user.relationship;

  if (relationship === 'friend') {
    // Already friends - show Message, Unfriend, Block
    const messageBtn = document.createElement('button');
    messageBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-2';
    messageBtn.innerHTML = '<span>💬</span><span>Message</span>';
    messageBtn.onclick = () => {
      eventBus.emit('OPEN_CHAT', { userId: user.id });
      notificationSystem.show('💬 Opening chat...', 'success');
    };

    const unfriendBtn = document.createElement('button');
    unfriendBtn.className = 'bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-2';
    unfriendBtn.innerHTML = '<span>👋</span><span>Unfriend</span>';
    unfriendBtn.onclick = async () => {
      if (confirm('Are you sure you want to unfriend this user?')) {
        await handleFriendAction(user.id, 'unfriend');
        notificationSystem.show('✅ Friend removed', 'success');
        // Dispatch event to refresh friends page
        window.dispatchEvent(new CustomEvent('friend-action', { detail: { action: 'unfriend' } }));
        router.navigate('/friends');
      }
    };

    const blockBtn = document.createElement('button');
    blockBtn.className = 'bg-red-600/80 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-2';
    blockBtn.innerHTML = '<span>🚫</span><span>Block</span>';
    blockBtn.onclick = async () => {
      if (confirm('Are you sure you want to block this user?')) {
        await handleFriendAction(user.id, 'block');
        notificationSystem.show('🚫 User blocked', 'info');
        // Dispatch event to refresh friends page
        window.dispatchEvent(new CustomEvent('friend-action', { detail: { action: 'block' } }));
        router.navigate('/friends');
      }
    };

    actionButtons.appendChild(messageBtn);
    actionButtons.appendChild(unfriendBtn);
    actionButtons.appendChild(blockBtn);
  } else if (relationship === 'pending') {
    // Request sent - show Pending
    const pendingBtn = document.createElement('button');
    pendingBtn.className = 'bg-yellow-500/20 text-yellow-400 font-medium px-4 py-2 rounded-lg cursor-not-allowed flex items-center space-x-2';
    pendingBtn.disabled = true;
    pendingBtn.innerHTML = '<span>⏳</span><span>Request Pending</span>';
    actionButtons.appendChild(pendingBtn);
  } else if (relationship === 'requested') {
    // They sent you a request - show Accept/Decline
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-2';
    acceptBtn.innerHTML = '<span>✅</span><span>Accept Request</span>';
    acceptBtn.onclick = async () => {
      await handleFriendAction(user.id, 'accept');
      notificationSystem.show('✅ Friend request accepted!', 'success');
      // Reload the profile to show updated relationship
      const currentPath = window.location.pathname;
      router.navigate(currentPath);
    };

    const declineBtn = document.createElement('button');
    declineBtn.className = 'bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-2';
    declineBtn.innerHTML = '<span>❌</span><span>Decline</span>';
    declineBtn.onclick = async () => {
      await handleFriendAction(user.id, 'reject');
      notificationSystem.show('❌ Request declined', 'info');
      // Dispatch event to refresh friends page
      window.dispatchEvent(new CustomEvent('friend-action', { detail: { action: 'decline' } }));
      router.navigate('/friends');
    };

    actionButtons.appendChild(acceptBtn);
    actionButtons.appendChild(declineBtn);
  } else {
    // Not friends - show Add Friend
    const addFriendBtn = document.createElement('button');
    addFriendBtn.className = 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-2 rounded-lg transition-all flex items-center space-x-2';
    addFriendBtn.innerHTML = '<span>➕</span><span>Add Friend</span>';
    addFriendBtn.onclick = async () => {
      await apiSendFriendRequest(user.username);
      notificationSystem.show(`✅ Friend request sent to ${user.username}!`, 'success');
      // Reload the profile to show updated relationship
      const currentPath = window.location.pathname;
      router.navigate(currentPath);
    };

    const blockBtn = document.createElement('button');
    blockBtn.className = 'bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-2';
    blockBtn.innerHTML = '<span>🚫</span><span>Block</span>';
    blockBtn.onclick = async () => {
      if (confirm('Are you sure you want to block this user?')) {
        await handleFriendAction(user.id, 'block');
        notificationSystem.show('🚫 User blocked', 'info');
        // Dispatch event to refresh friends page
        window.dispatchEvent(new CustomEvent('friend-action', { detail: { action: 'block' } }));
        router.navigate('/friends');
      }
    };

    actionButtons.appendChild(addFriendBtn);
    actionButtons.appendChild(blockBtn);
  }
}

function updateStats(games: any[]) {
  const totalGames = games.length;
  const wins = games.filter(g => g.winner_id === parseInt(g.player1_id) || g.winner_id === parseInt(g.player2_id)).length;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const totalGamesEl = document.getElementById('totalGames');
  const statsWinsCountEl = document.getElementById('statsWinsCount');
  const lossesCountEl = document.getElementById('lossesCount');
  const winRateEl = document.getElementById('winRate');
  const winRateBarEl = document.getElementById('winRateBar');

  if (totalGamesEl) totalGamesEl.textContent = totalGames.toString();
  if (statsWinsCountEl) statsWinsCountEl.textContent = wins.toString();
  if (lossesCountEl) lossesCountEl.textContent = losses.toString();
  if (winRateEl) winRateEl.textContent = `${winRate}%`;
  if (winRateBarEl) winRateBarEl.style.width = `${winRate}%`;

  // Also update header wins count
  const headerWinsCountEl = document.getElementById('headerWinsCount');
  if (headerWinsCountEl) headerWinsCountEl.textContent = wins.toString();
}

function renderGames(games: any[]) {
  const gamesContainer = document.getElementById('gamesContainer');
  if (!gamesContainer) return;

  gamesContainer.innerHTML = '';

  if (games.length === 0) {
    gamesContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No games played yet</p>';
    return;
  }

  games.slice(0, 10).forEach(game => {
    const gameCard = document.createElement('div');
    gameCard.className = 'p-4 bg-gray-800/30 rounded-xl border border-gray-700/50';
    gameCard.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="text-white font-medium">${game.player1_name || 'Player 1'} vs ${game.player2_name || 'Player 2'}</div>
        <div class="text-gray-400 text-sm">${new Date(game.created_at).toLocaleDateString()}</div>
      </div>
      <div class="mt-2 text-2xl font-bold ${game.winner_id ? 'text-green-400' : 'text-gray-400'}">
        ${game.player1_score || 0} - ${game.player2_score || 0}
      </div>
    `;
    gamesContainer.appendChild(gameCard);
  });
}

function setupEventListeners() {
  // No tab switching needed - only overview tab remains
}
