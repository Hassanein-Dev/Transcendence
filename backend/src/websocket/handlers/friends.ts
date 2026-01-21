import { activeConnections, userConnections } from '../router';
import { sendToUser } from '../utils';

export function handleFriendRequest(fromUserId: number, toUserId: number) {
  
  sendToUser(toUserId, {
    type: 'FRIEND_REQUEST_RECEIVED',
    fromUserId,
    timestamp: new Date().toISOString()
  });
}

export function handleFriendStatusChange(userId: number, friendId: number, status: 'accepted' | 'unfriended') {
  
  if (status === 'accepted') {
    // Notify both users about the new friendship
    sendToUser(userId, {
      type: 'FRIEND_ADDED',
      friendId,
      timestamp: new Date().toISOString()
    });
    
    sendToUser(friendId, {
      type: 'FRIEND_ADDED', 
      friendId: userId,
      timestamp: new Date().toISOString()
    });
  } else if (status === 'unfriended') {
    // Notify about friend removal
    sendToUser(userId, {
      type: 'FRIEND_REMOVED',
      friendId,
      timestamp: new Date().toISOString()
    });
    
    sendToUser(friendId, {
      type: 'FRIEND_REMOVED',
      friendId: userId, 
      timestamp: new Date().toISOString()
    });
  }
}

export function notifyUserBlocked(blockedUserId: number, blockerUserId: number) {
  
  // Notify the blocked user that they can no longer interact with the blocker
  sendToUser(blockedUserId, {
    type: 'USER_BLOCKED_YOU',
    blockerId: blockerUserId,
    timestamp: new Date().toISOString()
  });
}

export function handleOnlineStatusChange(userId: number, status: 'online' | 'offline') {
  
  // Notify all friends about status change
  // In a real implementation, we'd query the database for friends
  // For now, we'll broadcast to all connected users (simplified)
  activeConnections.forEach((connection, clientId) => {
    if (connection.userId !== userId.toString()) {
      connection.ws.send(JSON.stringify({
        type: 'FRIEND_STATUS_CHANGED',
        friendId: userId,
        status,
        timestamp: new Date().toISOString()
      }));
    }
  });
}