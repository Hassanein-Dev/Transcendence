import { router } from "./router";
import { renderProfile } from "./pages/profile";
import { initAuth, subscribe, logout, getCurrentUser } from "./stores/authState";
import { getToken } from "./services/api";
import { ChatComponent } from "./components/chat/chat";
import { FriendListComponent } from "./components/friends/friendList";
import { FriendRequestsComponent } from "./components/friends/friendRequests";
import { NotificationSystem } from "./components/ui/notifications";
import { NotificationDropdown } from "./components/ui/NotificationDropdown";
import { LeftSidebarComponent } from "./components/layout/LeftSidebar";
import { renderGame } from './pages/game';
import { renderTournaments } from './pages/tournaments';
import { renderTournamentDetail } from './pages/tournamentDetail';
import { renderAIGame } from "./pages/aiGame";
import { renderAdmin } from "./pages/admin";
import { renderOAuthSuccess } from "./pages/oauthSuccess";
import { renderFriends } from "./pages/friends";
import { renderProfileSetup } from "./pages/profileSetup";
import { renderSettings } from "./pages/settings";
import { renderAuth } from "./pages/auth";
import { renderLeaderboard } from "./pages/leaderboard";
import { initializeFriendState, loadFriends, getCurrentFriends, subscribe as subscribeToFriends } from "./stores/friendState";
import { notificationStore, addFriendRequestNotification } from "./stores/notificationStore";
import { eventBus, Events } from "./services/eventBus";

let chatComponent: ChatComponent | null = null;
let friendListComponent: FriendListComponent | null = null;
let friendRequestsComponent: FriendRequestsComponent | null = null;
let leftSidebarComponent: LeftSidebarComponent | null = null;
let notificationSystem: NotificationSystem;
let notificationDropdown: NotificationDropdown | null = null;
let friendsSidebarVisible = true; // Track sidebar visibility state

// Helper functions
function positionComponents() {
  const chat = document.getElementById('chat-container');
  const friendList = document.getElementById('friend-list');
  const friendRequests = document.getElementById('friend-requests');

  if (chat) {
    chat.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1000;';
  }

  if (friendList) {
    friendList.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 999;';
  }

  if (friendRequests) {
    friendRequests.style.cssText = 'position: fixed; top: 80px; right: 340px; z-index: 999;';
  }
}

function toggleFriendsPanel() {
  const friendList = document.getElementById('friend-list');
  const friendRequests = document.getElementById('friend-requests');

  if (friendList && friendRequests) {
    const isVisible = friendList.style.display !== 'none';
    friendList.style.display = isVisible ? 'none' : 'block';
    friendRequests.style.display = isVisible ? 'none' : 'block';
  }
}

function cleanupComponents() {
  if (chatComponent) {
    chatComponent.destroy();
    chatComponent = null;
  }
  if (friendListComponent) {
    friendListComponent.destroy();
    friendListComponent = null;
  }
  if (friendRequestsComponent) {
    friendRequestsComponent.destroy();
    friendRequestsComponent = null;
  }
  if (leftSidebarComponent) {
    leftSidebarComponent.destroy();
    leftSidebarComponent = null;
  }
  if (notificationDropdown) {
    notificationDropdown.destroy();
    notificationDropdown = null;
  }
}

// small helper: guard a route renderer so unauthenticated users go to /login
function requireAuth(renderFn: (params?: Record<string, string>) => void) {
  return async (params?: Record<string, string>) => {
    const user = getCurrentUser();
    if (!user) {
      router.navigate("/auth");
      return;
    }
    renderFn(params);
  };
}

// Guard that ensures only admin user can access
function requireAdmin(renderFn: () => void) {
  return async () => {
    const user = getCurrentUser();
    if (!user) {
      router.navigate('/auth');
      return;
    }
    if (user.username !== 'admin') {
      router.navigate('/');
      return;
    }
    renderFn();
  };
}

// Safe parameter handler for tournament detail
function renderTournamentDetailSafe(params?: Record<string, string>) {
  const tournamentId = params?.id;
  if (!tournamentId) {
    router.navigate('/tournament');
    return;
  }
  renderTournamentDetail(tournamentId);
}

// Create loading overlay
function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'page-loading-overlay';
  overlay.className = 'fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 z-[10000] flex items-center justify-center';
  overlay.innerHTML = `
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4"></div>
      <div class="text-white text-xl font-bold">Loading...</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('page-loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s';
    setTimeout(() => overlay.remove(), 300);
  }
}

function showLoadingOverlay() {
  let overlay = document.getElementById('page-loading-overlay');
  if (!overlay) {
    overlay = createLoadingOverlay();
  }
  overlay.style.opacity = '1';
}

document.addEventListener("DOMContentLoaded", async () => {

  // Show loading overlay initially
  createLoadingOverlay();

  // Listen for authentication errors (401) and auto-logout
  window.addEventListener('auth-error', ((event: CustomEvent) => {
    console.warn('[MAIN] Auth error detected, logging out user');
    cleanupComponents();
    logout();
    router.navigate('/auth');
  }) as EventListener);

  await initAuth();

  // Initialize friend state if user is authenticated
  const user = getCurrentUser();
  if (user) {
    await initializeFriendState();
  }

  router.register("/auth", () => {
    renderAuth();
  });

  router.register("/login", () => {
    router.navigate("/auth");
  });

  router.register("/register", () => {
    router.navigate("/auth");
  });

  router.register("/profile-setup", requireAuth(() => {
    renderProfileSetup();
  }));

  // Add OAuth routes
  router.register("/oauth-success", () => {
    renderOAuthSuccess();
  });

  router.register("/oauth-error", () => {
    renderOAuthSuccess(); // Same component handles errors
  });

  // Password reset route
  router.register("/forgot", async () => {
    // lazy import to avoid circular
    const mod = await import('./pages/forgot');
    mod.renderForgot();
  });

  router.register("/game", () => {
    renderGame();
  });

  router.register("/tournament/:id", renderTournamentDetailSafe);

  router.register("/tournament", () => {
    renderTournaments();
  });

  router.register("/profile", requireAuth(() => {
    renderProfile();
  }));

  // Friend/User profile with ID parameter
  router.register("/user/:id", requireAuth((params?: Record<string, string>) => {
    const userId = params?.id;
    if (userId) {
      import("./pages/friendProfile").then((m) => m.renderFriendProfile(userId));
    } else {
      router.navigate('/friends');
    }
  }));

  router.register("/settings", requireAuth(() => {
    renderSettings();
  }));

  router.register("/ai-game", () => {
    renderAIGame();
  });

  router.register("/remote-game", () => {
    import("./pages/remoteGame").then((m) => m.renderRemoteGame());
  });

  router.register("/admin", requireAdmin(() => {
    renderAdmin();
  }));

  router.register("/friends", requireAuth(() => {
    renderFriends();
  }));

  router.register("/leaderboard", () => {
    renderLeaderboard();
  });

  // Root route should be last
  router.register("/", () => {
    const user = getCurrentUser();
    if (user) {
      renderProfile();
    } else {
      router.navigate("/auth");
    }
  });

  router.start();

  // Update navbar and initialize components when auth state changes
  subscribe((user) => {
    const nav = document.querySelector("nav")!;
    const app = document.getElementById("app")!;
    const body = document.body;

    // Defensive CSS resets to prevent gaps
    body.style.margin = '0';
    body.style.padding = '0';

    // Don't set inline styles on app - they will override our padding classes!

    if (user) {
      if (!notificationSystem) notificationSystem = new NotificationSystem();

      // Initialize friend state listener for notifications
      let lastRequestCount = 0;
      let firstLoad = true;

      // Subscribe to notification store changes to update badge
      const unsubscribeNotifications = notificationStore.subscribe((notifications) => {
        const badge = document.getElementById('notification-badge');
        if (badge) {
          const unreadCount = notificationStore.getUnreadCount();
          if (unreadCount > 0) {
            badge.textContent = String(unreadCount);
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        }
      });

      const unsubscribeFriends = subscribeToFriends((state) => {
        const requests = state.friendRequests || [];

        // On first load, serve as baseline (don't notify)
        if (firstLoad) {
          lastRequestCount = requests.length;
          firstLoad = false;
          return;
        }

        // Check for new requests
        if (requests.length > lastRequestCount) {
          // Find the new request(s) - naive approach: assumes new ones are added
          const diff = requests.length - lastRequestCount;
          if (diff === 1) {
            const newReq = requests[requests.length - 1]; // Assuming appended
            // Add to notification store
            addFriendRequestNotification(newReq.username, String(newReq.id));
            // Show toast notification
            notificationSystem.show(`New Friend Request from ${newReq.username}!`, 'info');
          } else {
            // Add multiple notifications
            for (let i = lastRequestCount; i < requests.length; i++) {
              addFriendRequestNotification(requests[i].username, String(requests[i].id));
            }
            notificationSystem.show(`You have ${diff} new friend requests!`, 'info');
          }
        }
        lastRequestCount = requests.length;
      });

      // Update the body background
      body.classList.remove("bg-slate-900");
      body.classList.add("bg-gradient-to-br", "from-gray-900", "via-purple-900/50", "to-blue-900/50");

      // Remove default HTML classes that interfere with authenticated layout
      app.classList.remove("flex-1", "p-6", "max-w-4xl", "mx-auto", "w-full");
      // Clear any inline styles that might exist
      app.style.cssText = '';

      // Build authenticated nav using safe DOM APIs (preserve data attributes used later)
      nav.textContent = '';
      nav.className = ''; // Remove all HTML nav classes
      nav.classList.remove('hidden'); // Show nav (was hidden in HTML to prevent flash)
      nav.style.margin = '0';
      nav.style.padding = '0';

      // Navbar wrapper - FIXED at top with exact height, NO margin/padding
      const navWrap = document.createElement('div');
      navWrap.className = 'fixed top-0 left-0 right-0 h-16 z-[100] bg-gray-800/90 backdrop-blur-lg border-b border-gray-700/50';
      navWrap.style.margin = '0';
      navWrap.style.padding = '0';
      navWrap.style.boxSizing = 'border-box';

      // Inner container - NO vertical padding, use h-full and flex to center
      const navInner = document.createElement('div');
      navInner.className = 'h-full w-full px-8 flex items-center';

      // Main flex container for navbar content
      const navFlex = document.createElement('div');
      navFlex.className = 'flex items-center justify-between w-full';

      // Left: Logo + links
      const left = document.createElement('div'); left.className = 'flex items-center gap-8';
      const logoLink = document.createElement('a'); logoLink.href = '/'; logoLink.setAttribute('data-link', ''); logoLink.className = 'flex items-center space-x-2 text-white font-bold text-lg group';
      const logoEmoji = document.createElement('span'); logoEmoji.className = 'text-2xl group-hover:scale-110 transition-transform'; logoEmoji.textContent = '🎮';
      const logoText = document.createElement('span'); logoText.className = 'bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-bold'; logoText.textContent = 'PongSocial';
      logoLink.appendChild(logoEmoji); logoLink.appendChild(logoText);

      const navLinks = document.createElement('div'); navLinks.className = 'hidden xl:flex items-center space-x-2';
      const makeLink = (href: string, emoji: string, label: string) => {
        const a = document.createElement('a'); a.href = href; a.setAttribute('data-link', ''); a.className = 'nav-link px-4 py-2 rounded-lg hover:bg-purple-500/20 transition-all duration-300 group';
        const span = document.createElement('span'); span.className = 'flex items-center space-x-2';
        const em = document.createElement('span'); em.className = 'text-xl group-hover:scale-110 transition-transform'; em.textContent = emoji;
        const lab = document.createElement('span'); lab.className = 'text-gray-300 group-hover:text-white font-medium'; lab.textContent = label;
        span.appendChild(em); span.appendChild(lab); a.appendChild(span); return a;
      };
      navLinks.appendChild(makeLink('/', '🏠', 'Home'));
      navLinks.appendChild(makeLink('/friends', '👥', 'Friends'));
      navLinks.appendChild(makeLink('/game', '🎯', 'Play'));
      navLinks.appendChild(makeLink('/tournament', '🏆', 'Tournaments'));

      // Admin link (only for admin users)
      if (user.username === 'admin') {
        navLinks.appendChild(makeLink('/admin', '🛡️', 'Admin'));
      }

      left.appendChild(logoLink); left.appendChild(navLinks);

      // Right: actions + user menu
      const right = document.createElement('div'); right.className = 'flex items-center space-x-4';
      const quickNotifs = document.createElement('button'); quickNotifs.id = 'quick-notifs'; quickNotifs.className = 'p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/20 rounded-xl transition-all duration-300 group relative';
      const qnIcon = document.createElement('span'); qnIcon.className = 'text-xl'; qnIcon.textContent = '🔔';
      const qnBadge = document.createElement('span'); qnBadge.id = 'notification-badge'; qnBadge.className = 'absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse hidden';
      quickNotifs.appendChild(qnIcon); quickNotifs.appendChild(qnBadge);

      const toggleSidebarBtn = document.createElement('button'); toggleSidebarBtn.id = 'toggle-sidebar'; toggleSidebarBtn.className = 'p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-xl transition-all duration-300 group';
      const tsIcon = document.createElement('span'); tsIcon.className = 'text-xl'; tsIcon.textContent = '👥';
      toggleSidebarBtn.appendChild(tsIcon);

      const chatToggle = document.createElement('button'); chatToggle.id = 'chat-toggle'; chatToggle.className = 'p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/20 rounded-xl transition-all duration-300 group';
      const chatIcon = document.createElement('span'); chatIcon.className = 'text-xl'; chatIcon.textContent = '💬';
      chatToggle.appendChild(chatIcon);

      // User menu
      const userMenuWrap = document.createElement('div'); userMenuWrap.className = 'relative';
      const userMenuBtn = document.createElement('button'); userMenuBtn.id = 'user-menu-btn'; userMenuBtn.className = 'flex items-center space-x-3 p-1.5 rounded-xl hover:bg-gray-700/50 transition-all duration-300 group';
      const userInner = document.createElement('div'); userInner.className = 'relative';
      const userGlow = document.createElement('div'); userGlow.className = 'absolute -inset-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-300';
      const userImg = document.createElement('img'); userImg.setAttribute('data-user-picture', ''); userImg.src = '/public/default-avatar.svg'; userImg.alt = 'user'; userImg.className = 'relative w-9 h-9 rounded-full border-2 border-gray-700 object-cover group-hover:border-purple-500 transition-all duration-300';
      userInner.appendChild(userGlow); userInner.appendChild(userImg);
      const userLabel = document.createElement('div'); userLabel.className = 'hidden md:block'; const userNameDiv = document.createElement('div'); userNameDiv.className = 'text-sm font-semibold text-white'; userNameDiv.setAttribute('data-user-name', ''); userNameDiv.textContent = 'Username'; const userRole = document.createElement('div'); userRole.className = 'text-xs text-gray-400'; userRole.textContent = 'Pong Player'; userLabel.appendChild(userNameDiv); userLabel.appendChild(userRole);
      const chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); chev.setAttribute('class', 'w-4 h-4 text-gray-400 group-hover:text-purple-400 transition-colors'); chev.setAttribute('fill', 'none'); chev.setAttribute('stroke', 'currentColor'); chev.setAttribute('viewBox', '0 0 24 24'); const chevPath = document.createElementNS('http://www.w3.org/2000/svg', 'path'); chevPath.setAttribute('stroke-linecap', 'round'); chevPath.setAttribute('stroke-linejoin', 'round'); chevPath.setAttribute('stroke-width', '2'); chevPath.setAttribute('d', 'M19 9l-7 7-7-7'); chev.appendChild(chevPath);
      userMenuBtn.appendChild(userInner); userMenuBtn.appendChild(userLabel); userMenuBtn.appendChild(chev);

      const userDropdown = document.createElement('div'); userDropdown.id = 'user-menu'; userDropdown.className = 'hidden absolute right-0 mt-2 w-56 bg-gray-800/90 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-700/50 py-2 z-[60] overflow-hidden';
      const ddTop = document.createElement('div'); ddTop.className = 'px-4 py-3 border-b border-gray-700/50'; const ddName = document.createElement('div'); ddName.className = 'text-sm font-semibold text-white'; ddName.setAttribute('data-user-name-dropdown', ''); ddName.textContent = 'Username'; const ddHandle = document.createElement('div'); ddHandle.className = 'text-xs text-gray-400'; ddHandle.setAttribute('data-user-handle', ''); ddHandle.textContent = '@username'; ddTop.appendChild(ddName); ddTop.appendChild(ddHandle);

      // Navigation links (visible only on < 1280px screens in dropdown)
      const ddNavSection = document.createElement('div'); ddNavSection.className = 'xl:hidden border-b border-gray-700/50';
      
      const ddHomeLink = document.createElement('a'); ddHomeLink.href = '/'; ddHomeLink.setAttribute('data-link', ''); ddHomeLink.className = 'flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-purple-500/20 transition-all duration-300';
      const dhIcon = document.createElement('span'); dhIcon.className = 'text-lg'; dhIcon.textContent = '🏠';
      const dhText = document.createElement('span'); dhText.textContent = 'Home';
      ddHomeLink.appendChild(dhIcon); ddHomeLink.appendChild(dhText);
      
      const ddFriendsLink = document.createElement('a'); ddFriendsLink.href = '/friends'; ddFriendsLink.setAttribute('data-link', ''); ddFriendsLink.className = 'flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-purple-500/20 transition-all duration-300';
      const dfIcon = document.createElement('span'); dfIcon.className = 'text-lg'; dfIcon.textContent = '👥';
      const dfText = document.createElement('span'); dfText.textContent = 'Friends';
      ddFriendsLink.appendChild(dfIcon); ddFriendsLink.appendChild(dfText);
      
      const ddPlayLink = document.createElement('a'); ddPlayLink.href = '/game'; ddPlayLink.setAttribute('data-link', ''); ddPlayLink.className = 'flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-purple-500/20 transition-all duration-300';
      const dplIcon = document.createElement('span'); dplIcon.className = 'text-lg'; dplIcon.textContent = '🎯';
      const dplText = document.createElement('span'); dplText.textContent = 'Play';
      ddPlayLink.appendChild(dplIcon); ddPlayLink.appendChild(dplText);
      
      const ddTournamentLink = document.createElement('a'); ddTournamentLink.href = '/tournament'; ddTournamentLink.setAttribute('data-link', ''); ddTournamentLink.className = 'flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-purple-500/20 transition-all duration-300';
      const dtIcon = document.createElement('span'); dtIcon.className = 'text-lg'; dtIcon.textContent = '🏆';
      const dtText = document.createElement('span'); dtText.textContent = 'Tournaments';
      ddTournamentLink.appendChild(dtIcon); ddTournamentLink.appendChild(dtText);
      
      ddNavSection.appendChild(ddHomeLink);
      ddNavSection.appendChild(ddFriendsLink);
      ddNavSection.appendChild(ddPlayLink);
      ddNavSection.appendChild(ddTournamentLink);
      
      // Admin link in dropdown (only for admin users on < 1280px)
      if (user.username === 'admin') {
        const ddAdminLink = document.createElement('a'); ddAdminLink.href = '/admin'; ddAdminLink.setAttribute('data-link', ''); ddAdminLink.className = 'flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-purple-500/20 transition-all duration-300';
        const daIcon = document.createElement('span'); daIcon.className = 'text-lg'; daIcon.textContent = '🛡️';
        const daText = document.createElement('span'); daText.textContent = 'Admin';
        ddAdminLink.appendChild(daIcon); ddAdminLink.appendChild(daText);
        ddNavSection.appendChild(ddAdminLink);
      }

      const ddSettingsLink = document.createElement('a'); ddSettingsLink.href = '/settings'; ddSettingsLink.setAttribute('data-link', ''); ddSettingsLink.className = 'flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-blue-500/20 transition-all duration-300 group';
      const dsIcon = document.createElement('span'); dsIcon.className = 'text-lg'; dsIcon.textContent = '⚙️';
      const dsText = document.createElement('span'); dsText.textContent = 'Settings';
      ddSettingsLink.appendChild(dsIcon); ddSettingsLink.appendChild(dsText);

      const ddDivider = document.createElement('div'); ddDivider.className = 'border-t border-gray-700/50 my-2';

      const ddLogout = document.createElement('button'); ddLogout.id = 'logoutBtn'; ddLogout.className = 'w-full text-left flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-300 group';
      const dlIcon = document.createElement('span'); dlIcon.className = 'text-lg'; dlIcon.textContent = '🚪';
      const dlText = document.createElement('span'); dlText.textContent = 'Log Out';
      ddLogout.appendChild(dlIcon); ddLogout.appendChild(dlText);

      userDropdown.appendChild(ddTop); userDropdown.appendChild(ddNavSection); userDropdown.appendChild(ddSettingsLink); userDropdown.appendChild(ddDivider); userDropdown.appendChild(ddLogout);

      userMenuWrap.appendChild(userMenuBtn); userMenuWrap.appendChild(userDropdown);

      right.appendChild(quickNotifs); right.appendChild(toggleSidebarBtn); right.appendChild(chatToggle); right.appendChild(userMenuWrap);

      navFlex.appendChild(left); navFlex.appendChild(right);
      navInner.appendChild(navFlex);
      navWrap.appendChild(navInner);
      nav.appendChild(navWrap);

      // Apply user data safely
      const userPic = nav.querySelector('[data-user-picture]') as HTMLImageElement | null;
      const userNameSpans = nav.querySelectorAll('[data-user-name]');
      const userNameDropdown = nav.querySelector('[data-user-name-dropdown]') as HTMLElement | null;
      const userHandle = nav.querySelector('[data-user-handle]') as HTMLElement | null;
      if (userPic) userPic.src = user.picture || '/public/default-avatar.svg';
      if (userPic) userPic.alt = user.username || 'User';
      userNameSpans.forEach(s => s.textContent = user.username || 'User');
      if (userNameDropdown) userNameDropdown.textContent = user.username || 'User';
      if (userHandle) userHandle.textContent = `@${user.username || 'user'}`;

      // Add padding to app for navbar and sidebars
      // pt-16 for navbar (64px), xl:pl-72 for newsfeed (from 1280px+), 2xl:pr-72 for friends (from 1536px+)
      app.classList.add("w-full", "min-h-screen"); // Full width and min height
      app.classList.add("pt-16");
      app.classList.add("xl:pl-72"); // Left sidebar padding from xl screens (1280px+)
      app.classList.add("2xl:pr-72"); // Right sidebar padding on 2xl screens only (1536px+)

      // Create sidebars
      createFriendsSidebar();

      // Initialize components when user is authenticated
      // Reduced timeout for faster load
      setTimeout(() => {
        chatComponent = new ChatComponent();
        friendListComponent = new FriendListComponent('friend-list', chatComponent);
        friendRequestsComponent = new FriendRequestsComponent();
        leftSidebarComponent = new LeftSidebarComponent();
        notificationSystem = new NotificationSystem();

        // Position components
        positionComponents();

        // Initial visibility check
        checkSidebarVisibility();

        // Event listeners for authenticated user
        setupEventListeners();

        // Initialize notification badge
        updateNotificationBadge();
        
        // Hide loading overlay after everything is initialized
        setTimeout(() => {
          const overlay = document.getElementById('page-loading-overlay');
          if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => overlay.remove(), 300);
          }
        }, 200);
      }, 100);

    } else {
      // Reset styles for non-authenticated users
      body.classList.remove("bg-gradient-to-br", "from-gray-900", "via-purple-900/50", "to-blue-900/50");
      body.classList.add("bg-slate-900");

      // Remove authenticated layout classes
      app.classList.remove("xl:pl-72", "2xl:pr-72", "w-full", "min-h-screen");

      // Restore default HTML classes for non-authenticated pages with pt-16 for navbar
      app.classList.add("flex-1", "pt-16", "p-6", "max-w-4xl", "mx-auto", "w-full");
      app.style.cssText = '';

      // Hide loading overlay immediately for non-authenticated pages
      setTimeout(() => {
        const overlay = document.getElementById('page-loading-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 0.3s';
          setTimeout(() => overlay.remove(), 300);
        }
      }, 100);

      // Remove sidebars if they exist
      const sidebar = document.getElementById('friends-sidebar');
      if (sidebar) sidebar.remove();
      const leftSidebar = document.getElementById('left-sidebar');
      if (leftSidebar) leftSidebar.remove();

      // Create simple navbar for non-authenticated users
      nav.textContent = '';
      nav.className = 'fixed top-0 left-0 right-0 h-16 z-[100] bg-gray-800/90 backdrop-blur-lg border-b border-gray-700/50';
      nav.style.margin = '0';
      nav.style.padding = '0';
      nav.style.boxSizing = 'border-box';
      nav.classList.remove('hidden');
      
      const navInner = document.createElement('div');
      navInner.className = 'h-full w-full px-8 flex items-center';
      
      const navContent = document.createElement('div');
      navContent.className = 'flex items-center justify-between w-full';
      
      const logo = document.createElement('a');
      logo.href = '/';
      logo.setAttribute('data-link', '');
      logo.className = 'flex items-center space-x-2 text-white font-bold text-lg group';
      logo.innerHTML = `
        <span class="text-2xl group-hover:scale-110 transition-transform">🎮</span>
        <span class="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-bold">PongSocial</span>
      `;
      
      const loginBtn = document.createElement('a');
      loginBtn.href = '/login';
      loginBtn.setAttribute('data-link', '');
      loginBtn.className = 'px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg text-white font-medium transition-all transform hover:scale-105';
      loginBtn.textContent = 'Login';
      
      navContent.appendChild(logo);
      navContent.appendChild(loginBtn);
      navInner.appendChild(navContent);
      nav.appendChild(navInner);

      // Clean up components when user logs out
      cleanupComponents();
    }
  });

});

// Add these functions to your main.ts file

function createFriendsSidebar() {
  // Remove existing sidebar if it exists
  const existingSidebar = document.getElementById('friends-sidebar');
  if (existingSidebar) {
    existingSidebar.remove();
  }

  // Create the sidebar element tree (safe DOM construction) — styled to match navbar
  const sidebar = document.createElement('div');
  sidebar.id = 'friends-sidebar';
  // Fixed positioning with top-16 to clear navbar
  // Hidden by default below 2xl (1536px), slides in when toggled
  sidebar.className = `fixed right-0 top-16 bottom-0 w-72 bg-gradient-to-br from-gray-800/90 to-gray-900/80 backdrop-blur-lg border-l border-gray-700/50 z-50 overflow-y-auto transform transition-transform duration-300 ease-in-out 2xl:translate-x-0 2xl:block translate-x-full`;
  sidebar.style.margin = '0';
  sidebar.style.padding = '0';
  sidebar.style.boxSizing = 'border-box';
  const sidebarInner = document.createElement('div');
  sidebarInner.className = 'h-full flex flex-col';

  // Header
  const header = document.createElement('div');
  header.className = 'p-4 border-b border-gray-700/50 bg-gray-800/90 backdrop-blur-sm';
  const headerTop = document.createElement('div');
  headerTop.className = 'flex items-center justify-between mb-4';

  // Logo + title (match navbar style)
  const logoWrap = document.createElement('div');
  logoWrap.className = 'flex items-center gap-3';
  const logoEmoji = document.createElement('span');
  logoEmoji.className = 'text-2xl';
  logoEmoji.textContent = '👥';
  const logoText = document.createElement('span');
  logoText.className = 'bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-bold';
  logoText.textContent = 'Friends';
  logoWrap.appendChild(logoEmoji);
  logoWrap.appendChild(logoText);

  const onlineCountDiv = document.createElement('div');
  onlineCountDiv.className = 'text-xs text-gray-400';
  onlineCountDiv.id = 'online-count';
  onlineCountDiv.textContent = '0 online';
  headerTop.appendChild(logoWrap);
  headerTop.appendChild(onlineCountDiv);

  // Search
  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'relative';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'chat-friend-search';
  searchInput.placeholder = 'Search friends...';
  searchInput.className = 'w-full bg-gray-700/50 rounded-xl px-4 py-2 pl-10 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-gray-800 border border-gray-600/50 transition-all';
  const searchIcon = document.createElement('div');
  searchIcon.className = 'absolute left-3 top-2.5 text-gray-400';
  searchIcon.textContent = '🔍';
  searchWrapper.appendChild(searchInput);
  searchWrapper.appendChild(searchIcon);

  header.appendChild(headerTop);
  header.appendChild(searchWrapper);

  // Online friends container
  const onlineSection = document.createElement('div');
  onlineSection.className = 'p-4 border-b border-gray-700/50';
  const onlineTitleRow = document.createElement('div');
  onlineTitleRow.className = 'flex items-center justify-between mb-3';
  const onlineTitle = document.createElement('h3');
  onlineTitle.className = 'text-sm font-semibold text-green-400 flex items-center space-x-2';
  onlineTitle.textContent = '';
  const pulse = document.createElement('span');
  pulse.className = 'w-2 h-2 bg-green-500 rounded-full animate-pulse';
  const onlineText = document.createElement('span');
  onlineText.textContent = 'Online Now';
  onlineTitle.appendChild(pulse);
  onlineTitle.appendChild(onlineText);
  const onlineBadge = document.createElement('span');
  onlineBadge.className = 'text-xs text-gray-400';
  onlineBadge.id = 'online-count-badge';
  onlineTitleRow.appendChild(onlineTitle);
  onlineTitleRow.appendChild(onlineBadge);
  const onlineListDiv = document.createElement('div');
  onlineListDiv.id = 'online-friends-list';
  onlineListDiv.className = 'space-y-2';
  const noOnline = document.createElement('div');
  noOnline.className = 'text-center py-4';
  const noOnlineText = document.createElement('div');
  noOnlineText.className = 'text-gray-500 text-sm';
  noOnlineText.textContent = 'No friends online';
  noOnline.appendChild(noOnlineText);
  onlineListDiv.appendChild(noOnline);
  onlineSection.appendChild(onlineTitleRow);
  onlineSection.appendChild(onlineListDiv);

  // All friends
  const allSection = document.createElement('div');
  allSection.className = 'flex-1 overflow-y-auto';
  const allInner = document.createElement('div');
  allInner.className = 'p-4';
  const allTitle = document.createElement('h3');
  allTitle.className = 'text-sm font-semibold text-gray-300 mb-3';
  allTitle.textContent = 'All Friends';
  const allListDiv = document.createElement('div');
  allListDiv.id = 'all-friends-list';
  allListDiv.className = 'space-y-2';
  const loadingPlaceholder = document.createElement('div');
  loadingPlaceholder.className = 'text-center py-8';
  loadingPlaceholder.textContent = '';
  const loadEmoji = document.createElement('div');
  loadEmoji.className = 'text-4xl text-gray-600 mb-2';
  loadEmoji.textContent = '👥';
  const loadText = document.createElement('div');
  loadText.className = 'text-gray-500 text-sm';
  loadText.textContent = 'Loading friends...';
  loadingPlaceholder.appendChild(loadEmoji);
  loadingPlaceholder.appendChild(loadText);
  allListDiv.appendChild(loadingPlaceholder);
  allInner.appendChild(allTitle);
  allInner.appendChild(allListDiv);
  allSection.appendChild(allInner);

  sidebarInner.appendChild(header);
  sidebarInner.appendChild(onlineSection);
  sidebarInner.appendChild(allSection);
  sidebar.appendChild(sidebarInner);

  // Append to body (fixed positioning, not part of flex layout)
  document.body.appendChild(sidebar);

  loadFriendsData();

  // Initial check
  checkSidebarVisibility();
}

// Add global listener for route changes
window.addEventListener('route-changed', () => {
  checkSidebarVisibility();
});

function checkSidebarVisibility() {
  const sidebar = document.getElementById('friends-sidebar');
  const leftSidebar = document.getElementById('left-sidebar');
  const nav = document.querySelector('nav');
  const path = location.pathname;

  // Hide sidebar and nav on profile-setup, auth, login, register, etc.
  const hiddenRoutes = ['/profile-setup', '/auth', '/login', '/register', '/oauth-success', '/oauth-error'];
  const shouldHide = hiddenRoutes.some(r => path.startsWith(r));

  if (sidebar) {
    sidebar.style.display = shouldHide ? 'none' : 'block';
  }

  if (leftSidebar) {
    // Only show left sidebar if not on hidden routes AND screen width >= 1280px
    if (shouldHide) {
      leftSidebar.style.display = 'none';
    } else {
      leftSidebar.style.display = window.innerWidth >= 1280 ? 'block' : 'none';
    }
  }

  if (nav) {
    nav.style.display = shouldHide ? 'none' : 'block';
  }
}

async function loadFriendsData() {
  // Load latest friends from backend into the shared store
  await loadFriends();
  const friends = getCurrentFriends();

  // Fetch unread message counts and last message times
  const { unreadCounts, lastMessageTimes } = await fetchUnreadCounts();

  // Map store friends into the shape expected by the renderer
  const allFriends = friends.map(f => ({
    id: f.id,
    username: f.username,
    picture: f.picture || f.avatarUrl,
    status: f.onlineStatus,
    game: f.onlineStatus === 'ingame' ? 'In Game' : null,
    lastSeen: f.friendsSince || 'Recently',
    unreadCount: unreadCounts[f.id.toString()] || 0,
    lastMessageTime: lastMessageTimes[f.id.toString()] || null
  }));

  // Sort friends by last message time (most recent first), then by online status
  allFriends.sort((a, b) => {
    // If both have messages, sort by most recent
    if (a.lastMessageTime && b.lastMessageTime) {
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    }
    // Friends with messages come before friends without
    if (a.lastMessageTime && !b.lastMessageTime) return -1;
    if (!a.lastMessageTime && b.lastMessageTime) return 1;
    // If neither has messages, online friends come first
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (a.status !== 'online' && b.status === 'online') return 1;
    return 0;
  });

  const onlineFriends = allFriends.filter(f => f.status === 'online' || f.status === 'ingame');

  updateFriendsLists(onlineFriends, allFriends);
}

async function fetchUnreadCounts(): Promise<{ unreadCounts: { [key: string]: number }, lastMessageTimes: { [key: string]: string } }> {
  try {
    const token = getToken();
    if (!token) {
      return { unreadCounts: {}, lastMessageTimes: {} };
    }

    const response = await fetch('/api/messages/unread/counts', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        unreadCounts: data.unreadCounts || {},
        lastMessageTimes: data.lastMessageTimes || {}
      };
    }
    // Silently handle non-OK responses (user may not be authenticated yet)
  } catch (error) {
    // Silently handle network errors during sidebar load
  }
  return { unreadCounts: {}, lastMessageTimes: {} };
}

function updateFriendsLists(onlineFriends: any[], allFriends: any[]) {
  const onlineList = document.getElementById('online-friends-list');
  const allList = document.getElementById('all-friends-list');
  const onlineCount = document.getElementById('online-count');
  const onlineCountBadge = document.getElementById('online-count-badge');

  if (onlineCount) {
    onlineCount.textContent = `${onlineFriends.length} online`;
  }

  if (onlineCountBadge) {
    onlineCountBadge.textContent = onlineFriends.length > 0 ? `${onlineFriends.length}` : '';
  }

  if (onlineList) {
    // Clear existing
    onlineList.textContent = '';
    if (onlineFriends.length === 0) {
      const noOnline = document.createElement('div');
      noOnline.className = 'text-center py-4';
      const txt = document.createElement('div');
      txt.className = 'text-gray-500 text-sm';
      txt.textContent = 'No friends online';
      noOnline.appendChild(txt);
      onlineList.appendChild(noOnline);
    } else {
      onlineFriends.forEach(friend => {
        const item = document.createElement('div');
        item.className = 'friend-item group cursor-pointer p-3 rounded-xl hover:bg-gray-700/50 transition-all duration-300 border border-gray-700/50';
        item.setAttribute('data-friend-id', String(friend.id));
        item.setAttribute('data-friend-name', String(friend.username));

        const row = document.createElement('div');
        row.className = 'flex items-center space-x-3';

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'relative flex-shrink-0';
        const img = document.createElement('img');
        img.src = friend.picture || '/public/default-avatar.svg';
        img.alt = friend.username || 'User';
        img.className = 'w-10 h-10 rounded-full border-2 border-green-500 object-cover';
        img.onerror = () => { img.src = '/public/default-avatar.svg'; };
        const statusDot = document.createElement('div');
        statusDot.className = 'absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800';
        avatarWrap.appendChild(img);
        avatarWrap.appendChild(statusDot);

        const main = document.createElement('div');
        main.className = 'flex-1 min-w-0';
        const nameRow = document.createElement('div');
        nameRow.className = 'flex items-center justify-between gap-2';
        const name = document.createElement('div');
        name.className = 'text-sm font-medium text-white truncate';
        name.textContent = friend.username;
        nameRow.appendChild(name);

        // Add unread count badge if there are unread messages
        if (friend.unreadCount && friend.unreadCount > 0) {
          const badge = document.createElement('span');
          badge.className = 'bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0';
          badge.textContent = friend.unreadCount > 9 ? '9+' : friend.unreadCount.toString();
          nameRow.appendChild(badge);
        }

        main.appendChild(nameRow);
        const statusText = document.createElement('div');
        statusText.className = `text-xs ${friend.game ? 'text-green-400' : 'text-gray-400'}`;
        statusText.textContent = friend.game || 'Online';
        main.appendChild(statusText);

        row.appendChild(avatarWrap);
        row.appendChild(main);
        item.appendChild(row);

        item.addEventListener('click', () => {
          openChatWithFriend(String(friend.id), String(friend.username));
        });

        onlineList.appendChild(item);
      });
    }
  }

  if (allList) {
    allList.textContent = '';
    allFriends.forEach(friend => {
      const item = document.createElement('div');
      item.className = 'friend-item group cursor-pointer p-3 rounded-xl hover:bg-gray-700/50 transition-all duration-300 border border-gray-700/50';
      item.setAttribute('data-friend-id', String(friend.id));
      item.setAttribute('data-friend-name', String(friend.username));

      const row = document.createElement('div');
      row.className = 'flex items-center space-x-3';

      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'relative flex-shrink-0';
      const img = document.createElement('img');
      img.src = friend.picture || '/public/default-avatar.svg';
      img.alt = friend.username || 'User';
      img.className = 'w-10 h-10 rounded-full border-2 ' + (friend.status === 'online' ? 'border-green-500' : friend.status === 'away' ? 'border-yellow-500' : 'border-gray-500') + ' object-cover';
      img.onerror = () => { img.src = '/public/default-avatar.svg'; };
      const statusDot = document.createElement('div');
      statusDot.className = 'absolute -bottom-1 -right-1 w-3 h-3 ' + (friend.status === 'online' ? 'bg-green-500' : friend.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500') + ' rounded-full border-2 border-gray-800';
      avatarWrap.appendChild(img);
      avatarWrap.appendChild(statusDot);

      const main = document.createElement('div');
      main.className = 'flex-1 min-w-0';
      const nameRow = document.createElement('div');
      nameRow.className = 'flex items-center justify-between gap-2';
      const name = document.createElement('div');
      name.className = 'text-sm font-medium text-white truncate';
      name.textContent = friend.username;
      nameRow.appendChild(name);

      // Add unread count badge if there are unread messages
      if (friend.unreadCount && friend.unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0';
        badge.textContent = friend.unreadCount > 9 ? '9+' : friend.unreadCount.toString();
        nameRow.appendChild(badge);
      }

      main.appendChild(nameRow);
      const statusText = document.createElement('div');
      statusText.className = `text-xs ${friend.status === 'online' ? 'text-green-400' : friend.status === 'away' ? 'text-yellow-400' : 'text-gray-400'}`;
      statusText.textContent = friend.status === 'online' ? (friend.game || 'Online') : friend.status === 'away' ? 'Away' : `Last seen ${friend.lastSeen}`;
      main.appendChild(statusText);

      row.appendChild(avatarWrap);
      row.appendChild(main);

      item.appendChild(row);
      item.addEventListener('click', () => {
        openChatWithFriend(String(friend.id), String(friend.username));
      });
      allList.appendChild(item);
    });
  }

  // Add search functionality
  const searchInput = document.getElementById('chat-friend-search') as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
      filterFriends(searchTerm);
    });
  }
}

function filterFriends(searchTerm: string) {
  const allItems = document.querySelectorAll('#all-friends-list .friend-item');
  const onlineItems = document.querySelectorAll('#online-friends-list .friend-item');

  let visibleCount = 0;

  // Filter all friends
  allItems.forEach(item => {
    const friendName = item.getAttribute('data-friend-name')?.toLowerCase() || '';
    if (friendName.includes(searchTerm)) {
      (item as HTMLElement).style.display = 'block';
      visibleCount++;
    } else {
      (item as HTMLElement).style.display = 'none';
    }
  });

  // Filter online friends
  onlineItems.forEach(item => {
    const friendName = item.getAttribute('data-friend-name')?.toLowerCase() || '';
    if (friendName.includes(searchTerm)) {
      (item as HTMLElement).style.display = 'block';
    } else {
      (item as HTMLElement).style.display = 'none';
    }
  });

  // Show no results message if needed
  const allList = document.getElementById('all-friends-list');
  if (allList && visibleCount === 0 && searchTerm) {
    allList.textContent = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'text-center py-8';
    const emoji = document.createElement('div');
    emoji.className = 'text-4xl text-gray-600 mb-2';
    emoji.textContent = '🔍';
    const t = document.createElement('div');
    t.className = 'text-gray-500 text-sm';
    t.textContent = 'No friends found';
    const note = document.createElement('div');
    note.className = 'text-gray-600 text-xs mt-1';
    note.textContent = 'Try a different search term';
    wrapper.appendChild(emoji);
    wrapper.appendChild(t);
    wrapper.appendChild(note);
    allList.appendChild(wrapper);
  }
}

function openChatWithFriend(friendId: string, friendName: string) {
  // First, ensure chat component is initialized
  if (!chatComponent) {
    chatComponent = new ChatComponent();
  }

  // Use the public method to open chat with the selected friend
  chatComponent.startPrivateChat(friendId, friendName);
}

function toggleSidebar() {
  const sidebar = document.getElementById('friends-sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar');
  const app = document.getElementById('app');

  if (sidebar && toggleBtn && app) {
    // Toggle slide-in animation on screens below 2xl (1536px)
    if (window.innerWidth < 1536) {
      const isHidden = sidebar.classList.contains('translate-x-full');
      
      if (isHidden) {
        // Show sidebar - slide in
        sidebar.classList.remove('translate-x-full');
        toggleBtn.classList.add('bg-blue-500/20', 'text-blue-400');
        
        // Add backdrop when sidebar is open on mobile/tablet
        const backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'fixed inset-0 bg-black/50 z-40 2xl:hidden';
        backdrop.addEventListener('click', () => {
          sidebar.classList.add('translate-x-full');
          backdrop.remove();
          toggleBtn.classList.remove('bg-blue-500/20', 'text-blue-400');
        });
        document.body.appendChild(backdrop);
      } else {
        // Hide sidebar - slide out
        sidebar.classList.add('translate-x-full');
        toggleBtn.classList.remove('bg-blue-500/20', 'text-blue-400');
        
        // Remove backdrop
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) backdrop.remove();
      }
    } else {
      // On 2xl+ screens, toggle visibility normally
      friendsSidebarVisible = !friendsSidebarVisible;
      
      if (friendsSidebarVisible) {
        sidebar.classList.remove('2xl:translate-x-full');
        sidebar.classList.add('2xl:translate-x-0');
        toggleBtn.classList.add('bg-blue-500/20', 'text-blue-400');
        // Add right padding back when sidebar is shown
        app.classList.add('2xl:pr-72');
      } else {
        sidebar.classList.remove('2xl:translate-x-0');
        sidebar.classList.add('2xl:translate-x-full');
        toggleBtn.classList.remove('bg-blue-500/20', 'text-blue-400');
        // Remove right padding when sidebar is hidden
        app.classList.remove('2xl:pr-72');
      }
    }
  }
}

function setupEventListeners() {
  // Event listeners for authenticated user
  const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement | null;
  logoutBtn?.addEventListener("click", () => {
    cleanupComponents();
    logout();
    router.navigate("/auth");
  });

  const userMenuBtn = document.getElementById("user-menu-btn") as HTMLButtonElement;
  const userMenu = document.getElementById("user-menu") as HTMLElement;

  userMenuBtn?.addEventListener("click", () => {
    userMenu.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!userMenuBtn?.contains(e.target as Node) && !userMenu?.contains(e.target as Node)) {
      userMenu?.classList.add('hidden');
    }
  });

  // Initialize notification dropdown
  const quickNotifs = document.getElementById("quick-notifs") as HTMLButtonElement;
  if (quickNotifs && !notificationDropdown) {
    notificationDropdown = new NotificationDropdown(quickNotifs);
  }

  const chatToggle = document.getElementById("chat-toggle") as HTMLButtonElement;
  chatToggle?.addEventListener("click", () => {
    if (chatComponent) {
      chatComponent.toggle();
    } else {
      chatComponent = new ChatComponent();
      chatComponent.toggle();
    }
  });

  // Sidebar toggle
  const toggleSidebarBtn = document.getElementById("toggle-sidebar") as HTMLButtonElement;
  toggleSidebarBtn?.addEventListener("click", () => {
    toggleSidebar();
  });

  // Setup real-time event listeners for friend updates
  setupRealtimeNavigationListeners();
}

// Real-time event listeners for navigation and sidebar updates
function setupRealtimeNavigationListeners() {

  // Update sidebar when friends list changes
  eventBus.on(Events.FRIENDS_UPDATED, () => {
    loadFriendsData();
  });

  // Update sidebar when friend requests change
  eventBus.on(Events.FRIEND_REQUESTS_UPDATED, () => {
    updateNotificationBadge();

    // Also reload sidebar to show updated counts
    loadFriendsData();
  });

  // Update friend status in sidebar without full reload
  eventBus.on(Events.FRIEND_STATUS_CHANGED, (data: { friendId: number, status: string }) => {
    updateFriendStatusInSidebar(data.friendId, data.status);
  });

  // Refresh sidebar when messages are read
  eventBus.on('MESSAGES_READ', (data: { userId: string }) => {
    loadFriendsData();
  });

  // Refresh sidebar when new message is received
  eventBus.on('MESSAGE_RECEIVED', (data: { userId: string }) => {
    loadFriendsData();
  });

  // Open chat when message button is clicked
  eventBus.on('OPEN_CHAT', (data: { userId: string | number }) => {
    const friends = getCurrentFriends();
    const friend = friends.find(f => f.id === parseInt(String(data.userId)));
    if (friend) {
      openChatWithFriend(String(data.userId), friend.username);
    } else {
      // If friend not found in list, still try to open chat with just the ID
      openChatWithFriend(String(data.userId), `User ${data.userId}`);
    }
  });

  // Global window event listener for open-chat (from notification clicks)
  window.addEventListener('open-chat', ((event: CustomEvent) => {
    const { userId, username } = event.detail;
    if (chatComponent) {
      chatComponent.startPrivateChat(String(userId), username);
    }
  }) as EventListener);
}

// Update notification badge count
function updateNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    const unreadCount = notificationStore.getUnreadCount();
    if (unreadCount > 0) {
      badge.textContent = String(unreadCount);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// Update friend status in sidebar UI without full refresh
function updateFriendStatusInSidebar(friendId: number, status: string) {
  // Update in online list
  const onlineList = document.getElementById('online-friends-list');
  const allList = document.getElementById('all-friends-list');

  // Find friend items in both lists
  const onlineItem = onlineList?.querySelector(`[data-friend-id="${friendId}"]`);
  const allItem = allList?.querySelector(`[data-friend-id="${friendId}"]`);

  // If status changed to online, reload to move to online section
  // If status changed to offline, reload to remove from online section
  if (status === 'online' || status === 'offline') {
    loadFriendsData();
    return;
  }

  // For other status changes, just update the UI elements
  [onlineItem, allItem].forEach(item => {
    if (!item) return;

    const statusDot = item.querySelector('.w-3.h-3');
    const statusText = item.querySelector('.text-xs');
    const avatar = item.querySelector('img');

    if (statusDot) {
      const colorClass = status === 'online' ? 'bg-green-500' :
        status === 'away' ? 'bg-yellow-500' : 'bg-gray-500';
      statusDot.className = `absolute -bottom-1 -right-1 w-3 h-3 ${colorClass} rounded-full border-2 border-gray-800`;
    }

    if (statusText) {
      const textColorClass = status === 'online' ? 'text-green-400' :
        status === 'away' ? 'text-yellow-400' : 'text-gray-400';
      statusText.className = `text-xs ${textColorClass}`;
      statusText.textContent = status === 'online' ? 'Online' :
        status === 'away' ? 'Away' : 'Offline';
    }

    if (avatar) {
      const borderClass = status === 'online' ? 'border-green-500' :
        status === 'away' ? 'border-yellow-500' : 'border-gray-500';
      avatar.className = `w-10 h-10 rounded-full border-2 ${borderClass} object-cover`;
    }
  });

  // Update online count
  const friends = getCurrentFriends();
  const onlineCount = friends.filter(f => f.onlineStatus === 'online').length;
  const onlineCountEl = document.getElementById('online-count');
  const onlineCountBadge = document.getElementById('online-count-badge');

  if (onlineCountEl) {
    onlineCountEl.textContent = `${onlineCount} online`;
  }

  if (onlineCountBadge) {
    onlineCountBadge.textContent = onlineCount > 0 ? `${onlineCount}` : '';
  }
}