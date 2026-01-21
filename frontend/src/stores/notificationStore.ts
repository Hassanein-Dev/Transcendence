// Notification Store - Centralized notification management
export interface Notification {
    id: string;
    type: 'friend_request' | 'friend_accepted' | 'message' | 'tournament_invite' | 'tournament_match_ready' | 'tournament_started' | 'tournament_winner' | 'game_invite';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
    actionUrl?: string;
    actionData?: any; // Additional data for custom actions
    icon?: string;
}

type NotificationListener = (notifications: Notification[]) => void;

class NotificationStore {
    private notifications: Notification[] = [];
    private listeners: Set<NotificationListener> = new Set();

    // Add a new notification
    addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
        const newNotification: Notification = {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            read: false,
        };

        this.notifications.unshift(newNotification); // Add to beginning
        this.notifyListeners();
    }

    // Get all notifications
    getNotifications(): Notification[] {
        return [...this.notifications];
    }

    // Get unread notifications
    getUnreadNotifications(): Notification[] {
        return this.notifications.filter(n => !n.read);
    }

    // Get unread count
    getUnreadCount(): number {
        return this.notifications.filter(n => !n.read).length;
    }

    // Mark notification as read
    markAsRead(id: string): void {
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            this.notifyListeners();
        }
    }

    // Mark all as read
    markAllAsRead(): void {
        let changed = false;
        this.notifications.forEach(n => {
            if (!n.read) {
                n.read = true;
                changed = true;
            }
        });
        if (changed) {
            this.notifyListeners();
        }
    }

    // Remove notification
    removeNotification(id: string): void {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            this.notifications.splice(index, 1);
            this.notifyListeners();
        }
    }

    // Clear all notifications
    clearAll(): void {
        this.notifications = [];
        this.notifyListeners();
    }

    // Subscribe to notification changes
    subscribe(listener: NotificationListener): () => void {
        this.listeners.add(listener);
        // Immediately call with current state
        listener(this.getNotifications());

        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        const notifications = this.getNotifications();
        this.listeners.forEach(listener => listener(notifications));
    }
}

// Export singleton instance
export const notificationStore = new NotificationStore();

// Helper functions to add specific notification types
export function addFriendRequestNotification(username: string, userId?: string): void {
    notificationStore.addNotification({
        type: 'friend_request',
        title: 'New Friend Request',
        message: `from ${username}`,
        actionUrl: '/friends',
        icon: '👥',
    });
}

export function addMessageNotification(username: string, messagePreview: string, userId: string): void {
    notificationStore.addNotification({
        type: 'message',
        title: 'New Message',
        message: `${username}: ${messagePreview}`,
        actionUrl: `/chat`,
        actionData: { userId, username },
        icon: '💬',
    });
}

export function addTournamentInviteNotification(username: string, tournamentName: string, tournamentId: string): void {
    notificationStore.addNotification({
        type: 'tournament_invite',
        title: 'Tournament Invitation',
        message: `${username} invited you to ${tournamentName}`,
        actionUrl: `/tournament/${tournamentId}`,
        icon: '🏆',
    });
}

export function addGameInviteNotification(username: string, userId?: string): void {
    notificationStore.addNotification({
        type: 'game_invite',
        title: 'Game Invitation',
        message: `${username} wants to play`,
        actionUrl: '/game',
        actionData: { userId, username },
        icon: '🎮',
    });
}

export function addFriendAcceptedNotification(username: string, userId: string): void {
    notificationStore.addNotification({
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${username} accepted your friend request`,
        actionUrl: `/user/${userId}`,
        icon: '✅',
    });
}

export function addTournamentMatchReadyNotification(tournamentName: string, opponentName: string, tournamentId: string): void {
    notificationStore.addNotification({
        type: 'tournament_match_ready',
        title: 'Match Ready!',
        message: `Your match vs ${opponentName} in ${tournamentName}`,
        actionUrl: `/tournament/${tournamentId}`,
        icon: '⚔️',
    });
}

export function addTournamentStartedNotification(tournamentName: string, tournamentId: string): void {
    notificationStore.addNotification({
        type: 'tournament_started',
        title: 'Tournament Started',
        message: `${tournamentName} has begun!`,
        actionUrl: `/tournament/${tournamentId}`,
        icon: '🎯',
    });
}

export function addTournamentWinnerNotification(tournamentName: string, winnerName: string, tournamentId: string, isWinner: boolean = false): void {
    notificationStore.addNotification({
        type: 'tournament_winner',
        title: isWinner ? 'You Won!' : 'Tournament Ended',
        message: isWinner ? `Congratulations! You won ${tournamentName}!` : `${winnerName} won ${tournamentName}`,
        actionUrl: `/tournament/${tournamentId}`,
        icon: isWinner ? '🏆' : '🥈',
    });
}

