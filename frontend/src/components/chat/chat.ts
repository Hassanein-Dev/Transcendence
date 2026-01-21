import { chatService } from "../../services/socket";
import { getToken } from "../../services/api";
import { getCurrentUser } from "../../stores/authState";
import { addMessageNotification, addGameInviteNotification } from "../../stores/notificationStore";
import { router } from "../../router";
import { eventBus } from "../../services/eventBus";

export class ChatComponent {
  private container: HTMLElement;
  private isConnected = false;
  private activeRoom: string = ''; // No default room
  private privateChats: Map<string, { userId: string, username: string, messages: any[], unread: number }> = new Map();
  private friendsList: any[] = [];
  private blockedUsers: Set<string> = new Set(); // Track blocked user IDs

  constructor(containerId: string = "chat-container") {
    this.container = document.getElementById(containerId) || this.createContainer();
    this.init();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'chat-container';
    container.className = 'fixed bottom-4 right-4 w-[360px] h-[520px] bg-gradient-to-b from-slate-900 via-gray-900 to-slate-950 rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.2)] border border-slate-700/50 z-50 overflow-hidden hidden flex flex-col';
    document.body.appendChild(container);
    return container;
  }

  async init() {
    const token = getToken();
    if (!token) {
      this.renderNotAuthenticated();
      return;
    }

    try {
      await chatService.connect(token);
      this.isConnected = true;
      this.renderChatInterface();
      this.setupMessageHandlers();
      await this.loadFriends();
      await this.loadBlockedUsers();
    } catch (error) {
      this.renderConnectionError();
    }
  }

  private async loadFriends() {
    try {
      const response = await fetch('/api/friends', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.friendsList = data.friends || [];
        this.updateFriendsOnlineStatus();
      }
    } catch (error) {
    }
  }

  private async loadBlockedUsers() {
    try {
      const response = await fetch('/api/friends/blocked', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.blockedUsers = new Set((data.blocked || []).map((u: any) => u.id.toString()));
      }
    } catch (error) {
    }
  }

  private updateFriendsOnlineStatus() {
    // This would be updated via WebSocket in a real app
    // For now, just keep the static list
  }

  private renderNotAuthenticated() {
    this.container.innerHTML = `
      <div class="p-6 text-center">
        <div class="text-5xl mb-4 text-gray-600">💬</div>
        <h3 class="text-xl font-bold text-white mb-2">Private Messages</h3>
        <p class="text-gray-400">Please log in to use chat</p>
      </div>
    `;
  }

  private renderConnectionError() {
    this.container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-900/10 to-gray-900/40 px-8">
        <div class="text-6xl mb-4 text-red-400 drop-shadow-[0_0_30px_rgba(248,113,113,0.6)]">⚠️</div>
        <h3 class="text-xl font-bold text-white mb-2">Connection Failed</h3>
        <p class="text-gray-400 text-sm mb-6 text-center max-w-xs">We couldn’t reach the chat server. Check your connection and try again.</p>
        <button id="retryChat" class="w-full max-w-xs px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 rounded-2xl text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-purple-500/40">
          🔄 Retry Connection
        </button>
      </div>
    `;

    document.getElementById('retryChat')?.addEventListener('click', () => {
      this.init();
    });
  }

  private renderChatInterface() {
    this.container.innerHTML = `
      <!-- Header - Facebook Messenger style with dark theme -->
      <div class="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-xl">💬</span>
          <h3 class="text-white font-semibold text-base">Chats</h3>
        </div>
        <div class="flex items-center space-x-2">
          <button id="new-chat-btn" class="p-1.5 text-white hover:bg-white/20 rounded-full transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </button>
          <button id="close-chat" class="p-1.5 text-white hover:bg-white/20 rounded-full transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <div class="relative">
          <input 
            id="chat-search" 
            type="text" 
            placeholder="Search Messenger" 
            class="w-full bg-slate-800/80 rounded-full px-4 py-2 pl-9 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-slate-700/80 transition-all border border-slate-700/50"
          />
          <div class="absolute left-3 top-2.5 text-slate-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Conversations List -->
      <div class="flex-1 overflow-y-auto bg-slate-900/60">
        <div id="conversations-list" class="divide-y divide-slate-700/30">
          <!-- Conversations will be loaded here -->
          <div class="text-center py-16 px-4">
            <div class="text-5xl mb-3">💬</div>
            <p class="text-slate-300 text-sm font-medium">No conversations yet</p>
            <p class="text-slate-500 text-xs mt-1">Start chatting with a friend!</p>
          </div>
        </div>
      </div>

      <!-- Chat View (hidden by default, shown when conversation is selected) -->
      <div id="chat-view" class="absolute inset-0 bg-gradient-to-b from-slate-900 via-gray-900 to-slate-950 hidden flex-col">
        <!-- Chat Header -->
        <div id="chat-header" class="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <button id="close-current-chat" class="p-1 text-white hover:bg-white/20 rounded-full transition-all">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div id="chat-partner-avatar" class="relative flex-shrink-0">
              <img class="w-9 h-9 rounded-full object-cover" />
              <div id="chat-status" class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-indigo-600"></div>
            </div>
            <div class="flex-1 min-w-0">
              <h4 id="chat-partner-name" class="font-semibold text-white text-sm cursor-pointer hover:underline truncate"></h4>
              <p id="chat-status-text" class="text-xs text-white/80"></p>
            </div>
          </div>
          <div class="flex items-center space-x-1">
            <button id="game-invite-btn" class="p-2 text-white hover:bg-white/20 rounded-full transition-all" title="Invite to game">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </button>
            <button id="block-user-btn" class="p-2 text-white hover:bg-white/20 rounded-full transition-all" title="Block user">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Messages Area -->
        <div id="chat-messages" class="flex-1 p-4 overflow-y-auto bg-slate-900/60">
          <div class="h-full flex flex-col items-center justify-center text-center">
            <div class="text-6xl mb-4">💭</div>
            <p class="text-slate-400 text-sm">No messages yet</p>
          </div>
        </div>

        <!-- Input Area -->
        <div id="chat-input-area" class="px-3 py-3 bg-slate-900/80 border-t border-slate-700/50">
          <form id="message-form">
            <div class="flex gap-2 items-center">
              <input 
                id="chat-input" 
                type="text" 
                placeholder="Aa" 
                class="flex-1 px-4 py-2 bg-slate-800/80 rounded-full text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-slate-700/80 transition-all border border-slate-700/50"
                maxlength="1000"
              />
              <button type="submit" class="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full transition-all">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.renderConversationsList();
  }

  // Public helper: open (or create) a private chat with a friend by ID
  public async startPrivateChat(friendId: string, friendName?: string) {
    const privateRoomId = `private_${friendId}`;

    if (!this.privateChats.has(privateRoomId)) {
      this.privateChats.set(privateRoomId, {
        userId: friendId,
        username: friendName || `Friend ${friendId}`,
        messages: [],
        unread: 0
      });
    }

    // Open the chat (loads history and marks as read)
    await this.openPrivateChat(friendId);

    // Show the chat container
    this.container.classList.remove('hidden');
  }
  private setupEventListeners() {
    // Close chat button
    document.getElementById('close-chat')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
    });

    // Close current chat button - go back to conversations list
    document.getElementById('close-current-chat')?.addEventListener('click', () => {
      this.activeRoom = '';
      this.hideChatArea();
    });

    // New chat button
    document.getElementById('new-chat-btn')?.addEventListener('click', () => {
      this.showNewChatModal();
    });

    // Block/Unblock user button
    document.getElementById('block-user-btn')?.addEventListener('click', () => {
      const userId = this.activeRoom.replace('private_', '');
      this.handleBlockToggle(userId);
    });

    // Game invite button
    document.getElementById('game-invite-btn')?.addEventListener('click', () => {
      const userId = this.activeRoom.replace('private_', '');
      this.sendGameInvite(userId);
    });

    // Profile navigation - chat partner name
    document.getElementById('chat-partner-name')?.addEventListener('click', () => {
      const userId = this.activeRoom.replace('private_', '');
      this.navigateToProfile(userId);
    });

    // Message form
    const messageForm = document.getElementById('message-form') as HTMLFormElement;
    messageForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input') as HTMLInputElement;
      this.sendMessage(input.value);
      input.value = '';
    });

    // Search conversations
    const searchInput = document.getElementById('chat-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.filterConversations((e.target as HTMLInputElement).value.toLowerCase());
    });

    // Prevent clicks inside the container from closing it
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      const target = e.target as Node;
      const chatToggle = document.getElementById('chat-toggle');

      if (!this.container.contains(target) && !chatToggle?.contains(target)) {
        this.container.classList.add('hidden');
      }
    });
  }

  private setupMessageHandlers() {
    chatService.onMessage((data) => {

      switch (data.type) {
        case 'AUTH_SUCCESS':
          this.addSystemMessage('Connected to chat server', 'success');
          break;
        case 'PRIVATE_MESSAGE':
          this.handlePrivateMessage(data.message);
          break;
        case 'PRIVATE_CHAT_CREATED':
          this.handlePrivateChatCreated(data);
          break;
        case 'FRIEND_STATUS_CHANGED':
          this.handleFriendStatusChange(data);
          break;
        case 'USER_BLOCKED_YOU':
          this.handleUserBlockedYou(data);
          break;
        case 'GAME_INVITE_RECEIVED':
          this.handleGameInviteReceived(data);
          break;
        case 'GAME_INVITE_SENT':
          this.handleGameInviteSent(data);
          break;
        case 'GAME_INVITE_ACCEPTED':
          this.handleGameInviteAccepted(data);
          break;
        case 'GAME_INVITE_DECLINED':
          this.handleGameInviteDeclined(data);
          break;
      }
    });
  }

  private async handleBlockToggle(userId: string) {
    const isBlocked = this.blockedUsers.has(userId);
    const conversation = this.privateChats.get(`private_${userId}`);
    const username = conversation?.username || 'this user';

    // Only allow blocking from chat interface, not unblocking
    if (isBlocked) {
      this.addSystemMessage(`${username} is already blocked`, 'info');
      return;
    }

    try {
      // Block user
      const response = await fetch('/api/friends/action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ friendId: parseInt(userId), action: 'block' })
      });

      if (response.ok) {
        this.blockedUsers.add(userId);
        this.updateBlockButton(userId, true);
        this.addSystemMessage(`Blocked ${username}`, 'info');
      }
    } catch (error) {
      this.addSystemMessage('Failed to block user', 'error');
    }
  }

  private updateBlockButton(userId: string, isBlocked: boolean) {
    const blockBtn = document.getElementById('block-user-btn');
    if (!blockBtn) return;

    // Always show block button, never show unblock button in chat
    blockBtn.title = 'Block user';
    blockBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
      </svg>
    `;
  }

  private sendGameInvite(userId: string) {
    // Check if user is blocked before sending invite
    if (this.blockedUsers.has(userId)) {
      this.addSystemMessage('Cannot send game invite to this user', 'error');
      return;
    }

    const conversation = this.privateChats.get(`private_${userId}`);
    const username = conversation?.username || 'User';

    chatService.send({
      type: 'GAME_INVITE',
      targetUserId: userId,
      gameType: 'pong'
    });

    this.addSystemMessage(`Game invite sent to ${username}`, 'success');
  }

  private handleGameInviteReceived(data: any) {
    const { fromUsername, fromUserId, inviteId } = data;

    // Add to notification store (navbar notification icon)
    addGameInviteNotification(fromUsername, fromUserId);

    // Show toast notification
    this.showNotification(fromUsername, '🎮 wants to play Pong with you!');

    // Show invite modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]';

    modal.innerHTML = `
      <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-purple-500/50 p-6 w-full max-w-md mx-4 shadow-2xl">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">🎮</div>
          <h3 class="text-2xl font-bold text-white mb-2">Game Invite!</h3>
          <p class="text-gray-300"><span class="font-semibold text-purple-400">${fromUsername}</span> wants to play Pong with you</p>
        </div>
        <div class="flex gap-3">
          <button id="accept-invite" class="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all duration-300">
            ✓ Accept
          </button>
          <button id="decline-invite" class="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl border border-gray-600 transition-all duration-300">
            ✗ Decline
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();

    modal.querySelector('#accept-invite')?.addEventListener('click', () => {
      closeModal();
      // Send accept message via WebSocket
      chatService.send({
        type: 'GAME_INVITE_ACCEPT',
        inviteId
      });
    });

    modal.querySelector('#decline-invite')?.addEventListener('click', () => {
      closeModal();
      // Send decline message via WebSocket
      chatService.send({
        type: 'GAME_INVITE_DECLINE',
        inviteId
      });
    });
  }

  private handleGameInviteSent(data: any) {
    const { toUsername } = data;
    this.addSystemMessage(`🎮 Game invite sent to ${toUsername}! Waiting for response...`, 'success');
  }

  private handleGameInviteAccepted(data: any) {
    const { gameRoomId } = data;

    // Show notification
    this.addSystemMessage('🎉 Invite accepted! Starting game...', 'success');

    // Close chat and redirect immediately
    this.container.classList.add('hidden');

    const targetUrl = `/remote-game?room=${gameRoomId}`;
    router.navigate(targetUrl);
  }

  private handleGameInviteDeclined(data: any) {
    const { declinedBy } = data;
    this.addSystemMessage(`${declinedBy} declined your game invite`, 'info');
  }

  private navigateToProfile(userId: string) {
    // Navigate to friend profile page
    router.navigate(`/user/${userId}`);
    // Close the chat when navigating to profile
    this.container.classList.add('hidden');
  }

  private renderConversationsList() {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) return;

    const conversations = Array.from(this.privateChats.values());
    conversationsList.textContent = '';

    if (conversations.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-16 px-4';
      emptyDiv.innerHTML = `
        <div class="text-5xl mb-3">💬</div>
        <p class="text-slate-300 text-sm font-medium">No conversations yet</p>
        <p class="text-slate-500 text-xs mt-1">Start chatting with a friend!</p>
      `;
      conversationsList.appendChild(emptyDiv);
      return;
    }

    const frag = document.createDocumentFragment();
    conversations.forEach(conversation => {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      const isActive = this.activeRoom === `private_${conversation.userId}`;

      const item = document.createElement('div');
      item.className = `conversation-item cursor-pointer p-3 hover:bg-slate-800/50 transition-all ${isActive ? 'bg-slate-800/70' : ''}`;
      item.setAttribute('data-user-id', conversation.userId);
      item.addEventListener('click', () => {
        this.openPrivateChat(conversation.userId);
      });

      const flexDiv = document.createElement('div');
      flexDiv.className = 'flex items-center space-x-3';

      const relativeDiv = document.createElement('div');
      relativeDiv.className = 'relative';

      const img = document.createElement('img');
      img.src = this.getAvatarUrl(conversation.userId);
      img.alt = conversation.username;
      img.className = 'w-12 h-12 rounded-full object-cover';
      img.onerror = function () { (this as HTMLImageElement).src = '/public/default-avatar.svg'; };

      const statusDiv = document.createElement('div');
      statusDiv.className = `absolute bottom-0 right-0 w-3 h-3 ${this.getStatusColor(conversation.userId)} rounded-full border-2 border-slate-900`;

      relativeDiv.appendChild(img);
      relativeDiv.appendChild(statusDiv);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'flex-1 min-w-0';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'flex justify-between items-start';

      const nameDiv = document.createElement('div');
      nameDiv.className = `font-semibold text-slate-100 text-sm truncate ${conversation.unread > 0 ? 'font-bold' : ''}`;
      nameDiv.textContent = conversation.username;

      const timeDiv = document.createElement('div');
      timeDiv.className = 'text-xs text-slate-400';
      if (lastMessage) {
        timeDiv.textContent = this.formatTime(lastMessage.timestamp);
      }

      headerDiv.appendChild(nameDiv);
      headerDiv.appendChild(timeDiv);

      const msgPreview = document.createElement('div');
      msgPreview.className = `text-sm text-slate-400 truncate ${conversation.unread > 0 ? 'font-semibold text-slate-300' : ''}`;
      msgPreview.textContent = lastMessage ? this.truncateText(lastMessage.content, 35) : 'No messages yet';

      infoDiv.appendChild(headerDiv);
      infoDiv.appendChild(msgPreview);

      if (conversation.unread > 0) {
        const unreadBadge = document.createElement('div');
        unreadBadge.className = 'w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-bold';
        unreadBadge.textContent = String(conversation.unread);
        flexDiv.appendChild(relativeDiv);
        flexDiv.appendChild(infoDiv);
        flexDiv.appendChild(unreadBadge);
      } else {
        flexDiv.appendChild(relativeDiv);
        flexDiv.appendChild(infoDiv);
      }

      item.appendChild(flexDiv);
      frag.appendChild(item);
    });

    conversationsList.appendChild(frag);
  }

  private filterConversations(searchTerm: string) {
    const items = document.querySelectorAll('.conversation-item');

    items.forEach(item => {
      const username = item.querySelector('.font-semibold')?.textContent?.toLowerCase() || '';
      const lastMessage = item.querySelector('.text-sm')?.textContent?.toLowerCase() || '';

      if (username.includes(searchTerm) || lastMessage.includes(searchTerm)) {
        (item as HTMLElement).style.display = 'block';
      } else {
        (item as HTMLElement).style.display = 'none';
      }
    });
  }

  private async openPrivateChat(userId: string) {
    const privateRoomId = `private_${userId}`;
    const conversation = this.privateChats.get(privateRoomId);

    if (!conversation) {
      // Create new conversation
      const friend = this.friendsList.find(f => f.id.toString() === userId);
      this.privateChats.set(privateRoomId, {
        userId,
        username: friend?.username || `Friend ${userId}`,
        messages: [],
        unread: 0
      });
    }

    // Fetch message history from database
    await this.loadMessageHistory(userId);

    // Mark messages as read
    await this.markMessagesAsRead(userId);

    this.activeRoom = privateRoomId;
    this.showChatArea(userId);
    this.renderConversationsList();
  }

  private async loadMessageHistory(userId: string) {
    try {
      const response = await fetch(`/api/messages/${userId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const privateRoomId = `private_${userId}`;
        const conversation = this.privateChats.get(privateRoomId);

        if (conversation) {
          conversation.messages = data.messages || [];
        }
      }
    } catch (error) {
    }
  }

  private async markMessagesAsRead(userId: string) {
    try {
      const response = await fetch(`/api/messages/${userId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        const privateRoomId = `private_${userId}`;
        const conversation = this.privateChats.get(privateRoomId);
        if (conversation) {
          conversation.unread = 0;
        }
        eventBus.emit('MESSAGES_READ', { userId });
      }
    } catch (error) {
    }
  }

  private showChatArea(userId: string) {
    const conversation = this.privateChats.get(`private_${userId}`);
    if (!conversation) return;

    // Show chat view overlay
    const chatView = document.getElementById('chat-view');
    if (chatView) {
      chatView.classList.remove('hidden');
      chatView.classList.add('flex');
    }

    // Update header
    const partnerName = document.getElementById('chat-partner-name');
    const statusText = document.getElementById('chat-status-text');
    const avatar = document.getElementById('chat-partner-avatar')?.querySelector('img');
    const statusIndicator = document.getElementById('chat-status');

    if (partnerName && statusText && avatar && statusIndicator) {
      partnerName.textContent = conversation.username;
      statusText.textContent = 'Active now';
      avatar.src = this.getAvatarUrl(userId);
      avatar.alt = conversation.username;
      statusIndicator.className = `absolute bottom-0 right-0 w-2.5 h-2.5 ${this.getStatusColor(userId)} rounded-full border-2 border-white`;
    }

    // Update block button state
    this.updateBlockButton(userId, this.blockedUsers.has(userId));

    // Update game invite button state based on block status
    if (this.blockedUsers.has(userId)) {
      this.disableGameInviteButton();
    } else {
      this.enableGameInviteButton();
    }

    // Render messages
    this.renderMessages(userId);
  }

  private hideChatArea() {
    const chatView = document.getElementById('chat-view');
    if (chatView) {
      chatView.classList.add('hidden');
      chatView.classList.remove('flex');
    }

    // Re-render conversations list
    this.renderConversationsList();
  }

  private renderMessages(userId: string) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const conversation = this.privateChats.get(`private_${userId}`);
    if (!conversation) return;

    messagesContainer.textContent = '';

    if (conversation.messages.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'h-full flex flex-col items-center justify-center text-center';
      emptyDiv.innerHTML = `
        <div class="text-6xl mb-4">💭</div>
        <p class="text-slate-400 text-sm">No messages yet</p>
        <p class="text-slate-500 text-xs mt-1">Send your first message to ${conversation.username}</p>
      `;
      messagesContainer.appendChild(emptyDiv);
      return;
    }

    const frag = document.createDocumentFragment();
    conversation.messages.forEach(message => {
      const isSender = message.sender.id.toString() !== userId;
      const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const outerDiv = document.createElement('div');
      outerDiv.className = `flex ${isSender ? 'justify-end' : 'justify-start'} mb-2`;

      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = `max-w-[70%] ${isSender ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-700/70'} rounded-2xl px-4 py-2`;

      const contentDiv = document.createElement('div');
      contentDiv.className = `${isSender ? 'text-white' : 'text-slate-100'} text-sm`;
      contentDiv.textContent = message.content;

      const timeDiv = document.createElement('div');
      timeDiv.className = `text-xs ${isSender ? 'text-white/70' : 'text-slate-400'} mt-1`;
      timeDiv.textContent = time;

      bubbleDiv.appendChild(contentDiv);
      bubbleDiv.appendChild(timeDiv);
      outerDiv.appendChild(bubbleDiv);
      frag.appendChild(outerDiv);
    });

    messagesContainer.appendChild(frag);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private sendMessage(content: string) {
    if (!content.trim() || !this.activeRoom) return;

    const userId = this.activeRoom.replace('private_', '');

    // Add message locally immediately for instant feedback
    const conversation = this.privateChats.get(this.activeRoom);
    if (conversation) {
      const message = {
        id: Date.now().toString(),
        sender: { id: 'me', username: 'You' },
        content: content.trim(),
        timestamp: new Date().toISOString(),
        type: 'private'
      };

      conversation.messages.push(message);
      this.renderMessages(userId);
    }

    // Send via WebSocket
    chatService.send({
      type: 'PRIVATE_MESSAGE',
      targetUserId: userId,
      content: content.trim()
    });
  }

  private handlePrivateMessage(message: any) {
    // Ignore our own echo from the server – we already added the message locally
    const current = getCurrentUser();
    if (current && String(message.sender.id) === String(current.id)) {
      return;
    }

    const senderId = message.sender.id.toString();

    // Ignore messages from blocked users
    if (this.blockedUsers.has(senderId)) {
      return;
    }

    const privateRoomId = `private_${senderId}`;
    let conversation = this.privateChats.get(privateRoomId);

    if (!conversation) {
      // Create conversation if it doesn't exist
      conversation = {
        userId: senderId,
        username: message.sender.username,
        messages: [],
        unread: 0
      };
      this.privateChats.set(privateRoomId, conversation);
    }

    conversation.messages.push(message);

    if (this.activeRoom === privateRoomId) {
      // If we're viewing this conversation, render the message
      this.renderMessages(senderId);
    } else {
      // Otherwise, increment unread count
      conversation.unread++;

      // Add notification to notification store
      const preview = message.content.length > 50
        ? message.content.substring(0, 50) + '...'
        : message.content;
      addMessageNotification(message.sender.username, preview, senderId);
      eventBus.emit('MESSAGE_RECEIVED', { userId: senderId });
    }

    this.renderConversationsList();

    // Show notification
    this.showNotification(message.sender.username, message.content);
  }

  private handlePrivateChatCreated(data: any) {
    const userId = data.targetUserId.toString();
    const privateRoomId = `private_${userId}`;

    if (!this.privateChats.has(privateRoomId)) {
      this.privateChats.set(privateRoomId, {
        userId,
        username: data.fromUser?.username || `Friend ${userId}`,
        messages: [],
        unread: 0
      });
    }

    this.renderConversationsList();
    this.openPrivateChat(userId);
  }

  private handleFriendStatusChange(data: any) {
    // Update local friend status so avatars / indicators stay in sync
    const friendId = data.friendId;
    this.friendsList = this.friendsList.map(friend =>
      friend.id === friendId || friend.id?.toString() === String(friendId)
        ? { ...friend, onlineStatus: data.status }
        : friend
    );
    this.renderConversationsList();
  }

  private handleUserBlockedYou(data: any) {
    const blockerId = data.blockerId.toString();
    
    // Add blocker to blocked users set (from the blocked user's perspective)
    this.blockedUsers.add(blockerId);
    
    // If currently chatting with this user, disable game invite button
    if (this.activeRoom === `private_${blockerId}`) {
      this.disableGameInviteButton();
      this.addSystemMessage('This user is no longer available for game invites', 'info');
    }
  }

  private disableGameInviteButton() {
    const gameInviteBtn = document.getElementById('game-invite-btn');
    if (gameInviteBtn) {
      gameInviteBtn.classList.add('opacity-50', 'cursor-not-allowed');
      gameInviteBtn.setAttribute('disabled', 'true');
      gameInviteBtn.title = 'Cannot send game invite';
    }
  }

  private enableGameInviteButton() {
    const gameInviteBtn = document.getElementById('game-invite-btn');
    if (gameInviteBtn) {
      gameInviteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      gameInviteBtn.removeAttribute('disabled');
      gameInviteBtn.title = 'Invite to game';
    }
  }

  private showNewChatModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50';
    // Create card
    const card = document.createElement('div');
    card.className = 'bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md mx-4 shadow-2xl';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-6';

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent';
    title.textContent = '✏️ New Message';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'closeNewChatModal';
    closeBtn.className = 'text-gray-400 hover:text-white text-2xl transition-colors';
    closeBtn.innerHTML = '&times;';

    header.appendChild(title);
    header.appendChild(closeBtn);

    const searchDiv = document.createElement('div');
    searchDiv.className = 'mb-4';

    const label = document.createElement('label');
    label.className = 'block text-sm font-medium text-gray-300 mb-2';
    label.textContent = 'Select Friend';

    const relDiv = document.createElement('div');
    relDiv.className = 'relative';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'friend-search-input';
    input.placeholder = 'Search friends...';
    input.className = 'w-full px-4 py-3 bg-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-gray-800/70 border border-gray-600/50 transition-all';

    const searchIcon = document.createElement('div');
    searchIcon.className = 'absolute right-3 top-3 text-gray-400';
    searchIcon.textContent = '🔍';

    relDiv.appendChild(input);
    relDiv.appendChild(searchIcon);
    searchDiv.appendChild(label);
    searchDiv.appendChild(relDiv);

    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'friend-search-results';
    resultsDiv.className = 'max-h-60 overflow-y-auto space-y-2 mb-4';

    // Populate Results
    this.friendsList.forEach(friend => {
      const item = document.createElement('div');
      item.className = 'friend-select-item cursor-pointer p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/50 transition-all';
      item.setAttribute('data-user-id', String(friend.id));

      const row = document.createElement('div');
      row.className = 'flex items-center space-x-3';

      const img = document.createElement('img');
      img.src = friend.avatarUrl || '/public/default-avatar.svg';
      img.alt = friend.username;
      img.className = 'w-10 h-10 rounded-full object-cover';
      img.onerror = function () { (this as HTMLImageElement).src = '/public/default-avatar.svg'; };

      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'font-medium text-white';
      name.textContent = friend.username;

      const STATUS_ONLINE = friend.onlineStatus === 'online';
      const status = document.createElement('div');
      status.className = `text-xs ${STATUS_ONLINE ? 'text-green-400' : 'text-gray-400'}`;
      status.textContent = STATUS_ONLINE ? '🟢 Online' : '⚫ Offline';

      info.appendChild(name);
      info.appendChild(status);
      row.appendChild(img);
      row.appendChild(info);
      item.appendChild(row);
      resultsDiv.appendChild(item);
    });

    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex gap-3';

    const startBtn = document.createElement('button');
    startBtn.id = 'startChatWithSelected';
    startBtn.className = 'flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-semibold rounded-xl transition-all duration-300';
    startBtn.disabled = true;
    startBtn.textContent = 'Start Chat';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelNewChat';
    cancelBtn.className = 'flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl border border-gray-600 transition-all duration-300';
    cancelBtn.textContent = 'Cancel';

    btnGroup.appendChild(startBtn);
    btnGroup.appendChild(cancelBtn);

    card.appendChild(header);
    card.appendChild(searchDiv);
    card.appendChild(resultsDiv);
    card.appendChild(btnGroup);
    modal.appendChild(card);

    document.body.appendChild(modal);

    // Event listeners
    const closeModal = () => modal.remove();

    document.getElementById('closeNewChatModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelNewChat')?.addEventListener('click', closeModal);

    // Friend search
    let selectedUserId: string | null = null;

    input.addEventListener('input', () => {
      const searchTerm = input.value.toLowerCase();
      this.filterFriendResults(searchTerm);
    });

    // Friend selection
    // Attach listeners to the newly created elements directly using delegation or selection
    // Since we appended them, we can select them
    resultsDiv.querySelectorAll('.friend-select-item').forEach(item => {
      item.addEventListener('click', () => {
        // Remove previous selection
        resultsDiv.querySelectorAll('.friend-select-item').forEach(f => {
          f.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-600/20');
        });

        // Add selection to clicked item
        item.classList.add('ring-2', 'ring-purple-500', 'bg-purple-600/20');
        selectedUserId = item.getAttribute('data-user-id');
        startBtn.disabled = false;
      });
    });

    // Start chat
    startBtn.addEventListener('click', () => {
      if (selectedUserId) {
        this.openPrivateChat(selectedUserId);
        this.container.classList.remove('hidden');
        closeModal();
      }
    });
  }

  private filterFriendResults(searchTerm: string) {
    const items = document.querySelectorAll('.friend-select-item');

    items.forEach(item => {
      const nameElement = item.querySelector('.font-medium');
      const username = nameElement?.textContent?.toLowerCase() || '';

      if (searchTerm === '' || username.includes(searchTerm)) {
        (item as HTMLElement).style.display = 'flex';
      } else {
        (item as HTMLElement).style.display = 'none';
      }
    });
  }

  private showNotification(sender: string, message: string) {
    // Create a toast notification
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 left-4 max-w-sm bg-gradient-to-r from-purple-600/90 to-blue-500/90 backdrop-blur-lg rounded-xl shadow-2xl border border-purple-500/30 p-4 transform translate-y-full transition-transform duration-500 z-50';

    // Build notification safely
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-start space-x-3';

    const icon = document.createElement('div');
    icon.className = 'text-2xl';
    icon.textContent = '💬';

    const body = document.createElement('div');
    body.className = 'flex-1';
    const title = document.createElement('div');
    title.className = 'font-semibold text-white';
    title.textContent = `New message from ${String(sender)}`;
    const preview = document.createElement('div');
    preview.className = 'text-sm text-purple-100 truncate mt-1';
    preview.textContent = this.truncateText(message, 60);
    body.appendChild(title);
    body.appendChild(preview);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-purple-200 hover:text-white text-xl';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });

    wrapper.appendChild(icon);
    wrapper.appendChild(body);
    wrapper.appendChild(closeBtn);
    notification.appendChild(wrapper);

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.remove('translate-y-full');
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('translate-y-full');
      setTimeout(() => notification.remove(), 500);
    }, 5000);
  }

  // Toggle chat visibility
  toggle() {
    this.container.classList.toggle('hidden');
    if (!this.container.classList.contains('hidden')) {
      this.renderConversationsList();
    }
  }

  private updateCharCount() {
    const input = document.getElementById('chat-input') as HTMLInputElement;
    const counter = document.getElementById('char-count');
    if (counter && input) {
      const count = input.value.length;
      counter.textContent = `${count}/1000`;
      counter.className = `text-xs ${count > 950 ? 'text-red-400' : count > 800 ? 'text-yellow-400' : 'text-gray-500'}`;
    }
  }

  private getAvatarUrl(userId: string): string {
    const friend = this.friendsList.find(f => f.id.toString() === userId);
    return friend?.avatarUrl || '/public/default-avatar.svg';
  }

  private getStatusColor(userId: string): string {
    const friend = this.friendsList.find(f => f.id.toString() === userId);
    return friend?.onlineStatus === 'online' ? 'bg-green-500' :
      friend?.onlineStatus === 'away' ? 'bg-yellow-500' :
        'bg-gray-500';
  }

  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private addSystemMessage(content: string, type: 'success' | 'info' | 'error' = 'info') {
    const colors = {
      success: 'bg-green-900/30 border-green-500/30',
      info: 'bg-blue-900/30 border-blue-500/30',
      error: 'bg-red-900/30 border-red-500/30'
    };

    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageEl = document.createElement('div');
    messageEl.className = `text-center my-2`;

    const span = document.createElement('span');
    span.className = `inline-block px-3 py-1 ${colors[type]} rounded-full border text-xs text-gray-300`;
    span.textContent = content; // Safe content

    messageEl.appendChild(span);
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  destroy() {
    chatService.disconnect();
    this.container.remove();
  }
}