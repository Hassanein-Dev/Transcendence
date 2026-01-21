// Periodic Notification Refresh Service
import { loadFriendRequests, getCurrentFriendRequests } from '../stores/friendState';
import { addFriendRequestNotification } from '../stores/notificationStore';

class NotificationRefreshService {
    private intervalId: number | null = null;
    private refreshInterval: number = 30000; // 30 seconds
    private previousRequestCount: number = 0;

    start(): void {
        if (this.intervalId) {
            return;
        }
        // Initial load
        this.checkForNewNotifications();

        // Set up periodic refresh
        this.intervalId = window.setInterval(() => {
            this.checkForNewNotifications();
        }, this.refreshInterval);
    }

    stop(): void {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async checkForNewNotifications(): Promise<void> {
        try {

            // Load latest friend requests
            await loadFriendRequests();
            const currentRequests = getCurrentFriendRequests();

            // Check if there are new requests
            if (currentRequests.length > this.previousRequestCount) {
                const newRequestsCount = currentRequests.length - this.previousRequestCount;

                // Add notifications for new requests
                const newRequests = currentRequests.slice(0, newRequestsCount);
                newRequests.forEach(request => {
                    addFriendRequestNotification(request.username, String(request.id));
                });
            }

            this.previousRequestCount = currentRequests.length;
        } catch (error) {
        }
    }

    setRefreshInterval(intervalMs: number): void {
        this.refreshInterval = intervalMs;
        if (this.intervalId) {
            this.stop();
            this.start();
        }
    }
}

// Export singleton instance
export const notificationRefreshService = new NotificationRefreshService();
