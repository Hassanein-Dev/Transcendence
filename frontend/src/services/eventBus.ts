/**
 * Simple Event Bus for cross-component communication
 * Enables real-time UI updates without tight coupling
 */

type EventCallback = (data?: any) => void;

class EventBus {
    private events: Map<string, Set<EventCallback>> = new Map();

    /**
     * Subscribe to an event
     * @param event Event name to listen for
     * @param callback Function to call when event is emitted
     */
    on(event: string, callback: EventCallback): void {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event)!.add(callback);
    }

    /**
     * Unsubscribe from an event
     * @param event Event name to stop listening for
     * @param callback Function to remove
     */
    off(event: string, callback: EventCallback): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.delete(callback);

            // Clean up empty event sets
            if (callbacks.size === 0) {
                this.events.delete(event);
            }
        }
    }

    /**
     * Emit an event to all subscribers
     * @param event Event name to emit
     * @param data Optional data to pass to callbacks
     */
    emit(event: string, data?: any): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                }
            });
        }
    }

    /**
     * Remove all listeners for an event, or all events if no event specified
     * @param event Optional event name to clear
     */
    clear(event?: string): void {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get count of listeners for an event
     * @param event Event name
     * @returns Number of listeners
     */
    listenerCount(event: string): number {
        return this.events.get(event)?.size || 0;
    }
}

// Export singleton instance
export const eventBus = new EventBus();

// Export event name constants for type safety
export const Events = {
    // Friend events
    FRIENDS_UPDATED: 'FRIENDS_UPDATED',
    FRIEND_REQUESTS_UPDATED: 'FRIEND_REQUESTS_UPDATED',
    FRIEND_STATUS_CHANGED: 'FRIEND_STATUS_CHANGED',
    FRIEND_ADDED: 'FRIEND_ADDED',
    FRIEND_REMOVED: 'FRIEND_REMOVED',

    // Chat events
    CHAT_MESSAGE_RECEIVED: 'CHAT_MESSAGE_RECEIVED',
    CHAT_TYPING_START: 'CHAT_TYPING_START',
    CHAT_TYPING_END: 'CHAT_TYPING_END',
    OPEN_CHAT: 'OPEN_CHAT',

    // Tournament events
    TOURNAMENT_UPDATED: 'TOURNAMENT_UPDATED',
    TOURNAMENT_STARTED: 'TOURNAMENT_STARTED',
    TOURNAMENT_COMPLETED: 'TOURNAMENT_COMPLETED',
    MATCH_READY: 'MATCH_READY',

    // Game events
    GAME_COMPLETED: 'GAME_COMPLETED',
    GAME_INVITE_RECEIVED: 'GAME_INVITE_RECEIVED',

    // Leaderboard events
    LEADERBOARD_UPDATED: 'LEADERBOARD_UPDATED',

    // User events
    USER_STATS_UPDATED: 'USER_STATS_UPDATED',
    USER_PROFILE_UPDATED: 'USER_PROFILE_UPDATED',
} as const;

export type EventName = typeof Events[keyof typeof Events];
