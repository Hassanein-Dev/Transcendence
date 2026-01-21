import { getWebSocketUrl } from "./config";
import {
  addFriendRequest,
  updateFriendOnlineStatus,
  addFriend,
  removeFriend,
  loadFriends,
  loadFriendRequests
} from "../stores/friendState";
import {
  addFriendRequestNotification,
  addFriendAcceptedNotification,
  addTournamentMatchReadyNotification,
  addTournamentStartedNotification,
  addTournamentWinnerNotification
} from "../stores/notificationStore";
import { eventBus, Events } from "./eventBus";

export class ChatService {
  private ws: WebSocket | null = null;
  private messageHandlers: ((data: any) => void)[] = [];
  private isAuthenticated: boolean = false;
  private authResolve: (() => void) | null = null;
  private authReject: ((error: any) => void) | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = getWebSocketUrl();

      this.ws = new WebSocket(url);
      this.isAuthenticated = false;

      // Store resolve/reject for authentication
      this.authResolve = resolve;
      this.authReject = reject;

      this.ws.onopen = () => {

        // Authenticate with token
        this.send({
          type: 'AUTHENTICATE',
          token: token
        });

        // Setup friend handlers
        this.setupFriendHandlers();
        this.setupAuthHandlers();

        // Set timeout for authentication
        setTimeout(() => {
          if (!this.isAuthenticated && this.authReject) {
            this.authReject(new Error('Authentication timeout'));
            this.authReject = null;
            this.authResolve = null;
          }
        }, 5000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.messageHandlers.forEach(handler => handler(data));
        } catch (error) {
        }
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onclose = (event) => {
      };
    });
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers = [];
    this.isAuthenticated = false;
    this.authResolve = null;
    this.authReject = null;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  setupAuthHandlers() {
    this.onMessage((data) => {
      switch (data.type) {
        case 'AUTHENTICATED':
          this.isAuthenticated = true;
          if (this.authResolve) {
            this.authResolve();
            this.authResolve = null;
            this.authReject = null;
          }
          break;
        case 'AUTH_ERROR':
          this.isAuthenticated = false;
          if (this.authReject) {
            this.authReject(new Error(data.message || 'Authentication failed'));
            this.authReject = null;
            this.authResolve = null;
          }
          break;
        case 'AUTH_REQUIRED':
          console.warn('[WS] Authentication required for this action');
          break;
      }
    });
  }

  setupFriendHandlers() {
    this.onMessage((data) => {

      switch (data.type) {
        case 'FRIEND_REQUEST_RECEIVED':
          this.handleFriendRequestReceived(data);
          break;
        case 'FRIEND_REQUEST_ACCEPTED':
          this.handleFriendRequestAccepted(data);
          break;
        case 'FRIEND_ADDED':
          this.handleFriendAdded(data);
          break;
        case 'FRIEND_REMOVED':
          this.handleFriendRemoved(data);
          break;
        case 'FRIEND_STATUS_CHANGED':
          this.handleFriendStatusChanged(data);
          break;
        case 'TOURNAMENT_UPDATED':
          this.handleTournamentUpdated(data);
          break;
        case 'TOURNAMENT_STARTED':
          this.handleTournamentStarted(data);
          break;
        case 'TOURNAMENT_MATCH_READY':
          this.handleTournamentMatchReady(data);
          break;
        case 'TOURNAMENT_ENDED':
          this.handleTournamentEnded(data);
          break;
      }
    });
  }

  private async handleFriendRequestReceived(data: any) {

    // Reload friend requests to show the new one
    await loadFriendRequests();

    // Emit event to update UI
    eventBus.emit(Events.FRIEND_REQUESTS_UPDATED);

    // Add to notification store (username will be updated when friend requests are loaded)
    if (data.fromUsername) {
      addFriendRequestNotification(data.fromUsername, String(data.fromUserId));
    }

    // Notification is handled by main.ts when state changes
  }

  private async handleFriendAdded(data: any) {
    // Reload friends list to show the new friend
    await loadFriends();

    // Emit event to update UI
    eventBus.emit(Events.FRIENDS_UPDATED);

    // Notification is handled by main.ts when state changes
  }

  private handleTournamentUpdated(data: any) {
    // If tournament was deleted, emit a different event to avoid 404 requests
    if (data.action === 'deleted') {
      eventBus.emit(Events.TOURNAMENT_COMPLETED, {
        tournamentId: data.tournamentId,
        action: 'deleted'
      });
      return;
    }
    
    // Emit event to update tournament UI
    eventBus.emit(Events.TOURNAMENT_UPDATED, {
      tournamentId: data.tournamentId,
      action: data.action
    });
  }

  private async handleFriendRemoved(data: any) {
    // Remove friend from local state
    removeFriend(data.friendId);

    // Emit event to update UI
    eventBus.emit(Events.FRIENDS_UPDATED);

    // Notification is handled by the action that triggered the removal
  }

  private handleFriendStatusChanged(data: any) {
    // Update friend online status
    updateFriendOnlineStatus(data.friendId, data.status);

    // Emit event to update UI with status data
    eventBus.emit(Events.FRIEND_STATUS_CHANGED, {
      friendId: data.friendId,
      status: data.status
    });
  }

  private async handleFriendRequestAccepted(data: any) {
    // Reload friends list to show the new friend
    await loadFriends();

    // Emit event to update UI
    eventBus.emit(Events.FRIENDS_UPDATED);

    // Add notification to notification store
    if (data.username && data.userId) {
      addFriendAcceptedNotification(data.username, String(data.userId));
    }

    // Show a notification for this specific event (not duplicate)
    this.showNotification(`${data.username} accepted your friend request!`, 'success');
  }

  private handleTournamentStarted(data: any) {
    // Add notification
    if (data.tournamentName && data.tournamentId) {
      addTournamentStartedNotification(data.tournamentName, String(data.tournamentId));
    }

    // Show notification
    this.showNotification(`${data.tournamentName} has started!`, 'info');

    // Emit event to update tournament pages
    eventBus.emit(Events.TOURNAMENT_STARTED, {
      tournamentId: data.tournamentId,
      tournamentName: data.tournamentName
    });
  }

  private handleTournamentMatchReady(data: any) {
    // Add notification
    if (data.tournamentName && data.opponentName && data.tournamentId) {
      addTournamentMatchReadyNotification(
        data.tournamentName,
        data.opponentName,
        String(data.tournamentId)
      );
    }

    // Show notification
    this.showNotification(`Your match is ready in ${data.tournamentName}!`, 'info');

    // Emit event to update tournament pages
    eventBus.emit(Events.MATCH_READY, {
      tournamentId: data.tournamentId,
      tournamentName: data.tournamentName,
      opponentName: data.opponentName
    });
  }

  private handleTournamentEnded(data: any) {
    // Add notification
    if (data.tournamentName && data.winnerName && data.tournamentId) {
      const isWinner = data.isWinner || false;
      addTournamentWinnerNotification(
        data.tournamentName,
        data.winnerName,
        String(data.tournamentId),
        isWinner
      );
    }

    // Show notification
    const message = data.isWinner
      ? `🏆 Congratulations! You won ${data.tournamentName}!`
      : `${data.tournamentName} has ended. Winner: ${data.winnerName}`;
    this.showNotification(message, data.isWinner ? 'success' : 'info');

    // Emit event to update tournament pages
    eventBus.emit(Events.TOURNAMENT_COMPLETED, {
      tournamentId: data.tournamentId,
      tournamentName: data.tournamentName,
      winnerName: data.winnerName,
      isWinner: data.isWinner
    });
  }

  private showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    // Use the global notification system if available
    if (typeof window !== 'undefined' && (window as any).notificationSystem) {
      (window as any).notificationSystem.show(message, type);
    } else {
      // Fallback: create simple notification
      this.createFallbackNotification(message, type);
    }
  }

  private createFallbackNotification(message: string, type: 'info' | 'success' | 'warning' | 'error') {
    // Get or create notifications container
    let container = document.getElementById('notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notifications-container';
      container.className = 'fixed top-20 right-4 z-[9999] space-y-2';
      document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `px-4 py-3 rounded-lg shadow-lg ${type === 'info' ? 'bg-blue-500 border-l-4 border-blue-600' :
      type === 'success' ? 'bg-green-500 border-l-4 border-green-600' :
        type === 'warning' ? 'bg-yellow-500 border-l-4 border-yellow-600' :
          'bg-red-500 border-l-4 border-red-600'
      } text-white max-w-sm transform transition-all duration-300 animate-slide-in`;

    // Build notification content safely
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-between';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'text-sm font-medium';
    msgSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-white hover:text-gray-200 ml-4 text-lg';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    });

    wrapper.appendChild(msgSpan);
    wrapper.appendChild(closeBtn);
    notification.appendChild(wrapper);

    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);

    // Add animation styles if not already present
    this.ensureNotificationStyles();
  }

  private ensureNotificationStyles() {
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Send friend request via WebSocket
  sendFriendRequest(toUserId: number) {
    this.send({
      type: 'FRIEND_REQUEST',
      toUserId
    });
  }
}

export const chatService = new ChatService();