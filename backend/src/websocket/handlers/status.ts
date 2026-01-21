import { activeConnections } from '../router';
import { sendError } from '../router';
import db from '../../models';

export function updateUserOnlineStatus(userId: number, isOnline: boolean) {
  if (isOnline) {
    db.prepare(`
      INSERT OR REPLACE INTO user_online_status (user_id, is_online, last_seen)
      VALUES (?, 1, datetime('now'))
    `).run(userId);
  } else {
    db.prepare(`
      UPDATE user_online_status 
      SET is_online = 0, last_seen = datetime('now')
      WHERE user_id = ?
    `).run(userId);
  }
}


export function notifyFriendsOfStatusChange(userId: string, status: string) {
  
  // Get user info for notification
  const userConn = Array.from(activeConnections.values())
    .find(conn => conn.userId === userId);
  
  if (!userConn || !userConn.user) return;

  activeConnections.forEach((conn, connId) => {
    if (conn.userId !== userId) {
      conn.ws.send(JSON.stringify({
        type: 'FRIEND_STATUS_CHANGED',
        friendId: userId,
        friend: userConn.user,
        status,
        timestamp: new Date().toISOString()
      }));
    }
  });
}