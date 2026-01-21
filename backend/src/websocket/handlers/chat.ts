import { activeConnections } from '../router';
import { sendToUser } from '../utils';
import db from '../../models';

// Private message handlers
export function handlePrivateMessage(clientId: string, targetUserId: string, content: string) {
  const connection = activeConnections.get(clientId);
  if (!connection || !connection.user) return;

  // Check if sender is blocked by target user
  const isBlocked = db.prepare(`
    SELECT 1 FROM user_friends 
    WHERE user_id = ? AND friend_id = ? AND status = 'blocked'
  `).get(parseInt(targetUserId), connection.userId);

  if (isBlocked) {
    // Silently fail - don't notify sender they're blocked
    return;
  }

  const timestamp = new Date().toISOString();

  // Save message to database for offline delivery and history
  const result = db.prepare(`
    INSERT INTO chat_messages (sender_id, receiver_id, content, message_type, created_at)
    VALUES (?, ?, ?, 'text', ?)
  `).run(connection.userId, parseInt(targetUserId), content, timestamp);

  const messageId = result.lastInsertRowid;

  const privateMessage = {
    id: messageId.toString(),
    sender: connection.user,
    content: content,
    timestamp: timestamp,
    type: 'private'
  };

  // Send to target user if they're online
  const sent = sendToUser(parseInt(targetUserId), {
    type: 'PRIVATE_MESSAGE',
    message: privateMessage
  });


  // Also send back to sender for their UI
  connection.ws.send(JSON.stringify({
    type: 'PRIVATE_MESSAGE',
    message: privateMessage
  }));
}

export function handlePrivateChatCreated(clientId: string, targetUserId: string) {
  const connection = activeConnections.get(clientId);
  if (!connection || !connection.user) return;

  // Notify both users
  sendToUser(parseInt(targetUserId), {
    type: 'PRIVATE_CHAT_CREATED',
    targetUserId: connection.userId,
    fromUser: connection.user
  });

  connection.ws.send(JSON.stringify({
    type: 'PRIVATE_CHAT_CREATED',
    targetUserId: targetUserId
  }));
}