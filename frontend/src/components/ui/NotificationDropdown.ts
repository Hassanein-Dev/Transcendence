import { notificationStore, Notification } from '../../stores/notificationStore';
import { router } from '../../router';

export class NotificationDropdown {
    private container: HTMLElement;
    private dropdown: HTMLElement;
    private isOpen: boolean = false;
    private unsubscribe?: () => void;

    constructor(bellButton: HTMLElement) {
        this.container = this.createDropdown();
        this.dropdown = this.container;

        // Position dropdown relative to bell button
        document.body.appendChild(this.container);

        // Toggle dropdown on bell button click
        bellButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.container.contains(e.target as Node) && !bellButton.contains(e.target as Node)) {
                this.close();
            }
        });

        // Subscribe to notification changes
        this.unsubscribe = notificationStore.subscribe((notifications) => {
            this.render(notifications);
        });
    }

    private createDropdown(): HTMLElement {
        const dropdown = document.createElement('div');
        dropdown.id = 'notification-dropdown';
        dropdown.className = 'fixed top-16 right-4 w-96 max-h-[600px] bg-gray-800/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700/50 z-[9999] hidden overflow-hidden';

        return dropdown;
    }

    private render(notifications: Notification[]): void {
        this.dropdown.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'p-4 border-b border-gray-700/50 bg-gray-800/90';

        const headerRow = document.createElement('div');
        headerRow.className = 'flex items-center justify-between';

        const title = document.createElement('h3');
        title.className = 'text-lg font-bold text-white';
        title.textContent = 'Notifications';

        const unreadCount = notificationStore.getUnreadCount();
        if (unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full';
            badge.textContent = String(unreadCount);
            title.appendChild(badge);
        }

        headerRow.appendChild(title);

        // Mark all as read button
        if (unreadCount > 0) {
            const markAllBtn = document.createElement('button');
            markAllBtn.className = 'text-xs text-purple-400 hover:text-purple-300 font-medium';
            markAllBtn.textContent = 'Mark all read';
            markAllBtn.addEventListener('click', () => {
                notificationStore.markAllAsRead();
            });
            headerRow.appendChild(markAllBtn);
        }

        header.appendChild(headerRow);
        this.dropdown.appendChild(header);

        // Notification list
        const listContainer = document.createElement('div');
        listContainer.className = 'overflow-y-auto max-h-[500px]';

        if (notifications.length === 0) {
            // Empty state
            const empty = document.createElement('div');
            empty.className = 'p-8 text-center';

            const emptyIcon = document.createElement('div');
            emptyIcon.className = 'text-6xl mb-3 opacity-50';
            emptyIcon.textContent = '🔔';

            const emptyText = document.createElement('div');
            emptyText.className = 'text-gray-400 text-sm';
            emptyText.textContent = 'No notifications yet';

            empty.appendChild(emptyIcon);
            empty.appendChild(emptyText);
            listContainer.appendChild(empty);
        } else {
            // Render notifications
            notifications.forEach(notification => {
                const item = this.createNotificationItem(notification);
                listContainer.appendChild(item);
            });
        }

        this.dropdown.appendChild(listContainer);
    }

    private createNotificationItem(notification: Notification): HTMLElement {
        const item = document.createElement('div');
        item.className = `p-4 border-b border-gray-700/30 hover:bg-gray-700/30 transition-all cursor-pointer ${!notification.read ? 'bg-purple-500/10' : ''
            }`;

        // Click handler
        item.addEventListener('click', () => {
            this.handleNotificationClick(notification);
        });

        const row = document.createElement('div');
        row.className = 'flex items-start space-x-3';

        // Icon
        const iconWrap = document.createElement('div');
        iconWrap.className = 'flex-shrink-0';
        const icon = document.createElement('div');
        icon.className = `w-10 h-10 rounded-full flex items-center justify-center text-xl ${notification.type === 'friend_request' ? 'bg-blue-500/20' :
                notification.type === 'friend_accepted' ? 'bg-green-500/20' :
                    notification.type === 'message' ? 'bg-purple-500/20' :
                        notification.type === 'tournament_invite' ? 'bg-yellow-500/20' :
                            notification.type === 'tournament_match_ready' ? 'bg-orange-500/20' :
                                notification.type === 'tournament_started' ? 'bg-indigo-500/20' :
                                    notification.type === 'tournament_winner' ? 'bg-amber-500/20' :
                                        notification.type === 'game_invite' ? 'bg-pink-500/20' :
                                            'bg-gray-500/20'
            }`;
        icon.textContent = notification.icon || this.getDefaultIcon(notification.type);
        iconWrap.appendChild(icon);

        // Content
        const content = document.createElement('div');
        content.className = 'flex-1 min-w-0';

        const titleEl = document.createElement('div');
        titleEl.className = 'text-sm font-semibold text-white mb-1';
        titleEl.textContent = notification.title;

        const messageEl = document.createElement('div');
        messageEl.className = 'text-xs text-gray-300 mb-1';
        messageEl.textContent = notification.message;

        const timeEl = document.createElement('div');
        timeEl.className = 'text-xs text-gray-500';
        timeEl.textContent = this.formatTimestamp(notification.timestamp);

        content.appendChild(titleEl);
        content.appendChild(messageEl);
        content.appendChild(timeEl);

        // Unread indicator
        if (!notification.read) {
            const unreadDot = document.createElement('div');
            unreadDot.className = 'flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-2';
            row.appendChild(iconWrap);
            row.appendChild(content);
            row.appendChild(unreadDot);
        } else {
            row.appendChild(iconWrap);
            row.appendChild(content);
        }

        item.appendChild(row);
        return item;
    }

    private handleNotificationClick(notification: Notification): void {
        // Mark as read
        notificationStore.markAsRead(notification.id);

        // Handle navigation based on notification type
        if (notification.actionUrl) {
            router.navigate(notification.actionUrl);
        }

        // Handle custom actions
        if (notification.actionData) {
            // For message notifications, open chat
            if (notification.type === 'message' && notification.actionData.userId) {
                // Dispatch custom event to open chat with user
                window.dispatchEvent(new CustomEvent('open-chat', {
                    detail: {
                        userId: notification.actionData.userId,
                        username: notification.actionData.username
                    }
                }));
            }
        }

        // Close dropdown
        this.close();
    }

    private getDefaultIcon(type: Notification['type']): string {
        switch (type) {
            case 'friend_request': return '👥';
            case 'friend_accepted': return '✅';
            case 'message': return '💬';
            case 'tournament_invite': return '🏆';
            case 'tournament_match_ready': return '⚔️';
            case 'tournament_started': return '🎯';
            case 'tournament_winner': return '🏆';
            case 'game_invite': return '🎮';
            default: return '🔔';
        }
    }

    private formatTimestamp(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return new Date(timestamp).toLocaleDateString();
    }

    toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open(): void {
        this.dropdown.classList.remove('hidden');
        this.isOpen = true;
    }

    close(): void {
        this.dropdown.classList.add('hidden');
        this.isOpen = false;
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.dropdown.remove();
    }
}
