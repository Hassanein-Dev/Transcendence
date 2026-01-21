import { activeConnections, gameInvites } from '../router';
import { sendError, generateClientId, sendToUser } from '../router';
import db from '../../models/connection';

export function handleGameInvite(clientId: string, targetUserId: string, gameType: string) {
  const connection = activeConnections.get(clientId);
  if (!connection || !connection.userId) {
    sendError(connection.ws, 'Authentication required');
    return;
  }

  // Check if either user has blocked the other
  const fromUserId = connection.userId;
  const toUserId = parseInt(targetUserId);

  try {
    const blockCheck = db.prepare(`
      SELECT COUNT(*) as blocked FROM user_friends
      WHERE status = 'blocked'
      AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
    `).get(fromUserId, toUserId, toUserId, fromUserId) as { blocked: number };

    if (blockCheck.blocked > 0) {
      sendError(connection.ws, 'Cannot send game invite to this user');
      return;
    }
  } catch (error) {
    sendError(connection.ws, 'Failed to send game invite');
    return;
  }

  // Find target user's connection - compare both as string and number
  let targetConnection = null;
  const targetUserIdNum = parseInt(targetUserId);

  for (const [connId, conn] of activeConnections.entries()) {
    if (conn.userId === targetUserId || conn.userId === targetUserIdNum) {
      targetConnection = conn;
      break;
    }
  }

  if (!targetConnection) {
    sendError(connection.ws, 'User is not online');
    return;
  }

  const inviteId = generateClientId();

  // Send invite to target user
  targetConnection.ws.send(JSON.stringify({
    type: 'GAME_INVITE_RECEIVED',
    inviteId,
    fromUserId: connection.userId,
    fromUsername: connection.user?.username || 'User',
    gameType,
    timestamp: new Date().toISOString()
  }));

  // Store invite for acceptance/decline
  gameInvites.set(inviteId, {
    id: inviteId,
    fromUserId: connection.userId,
    toUserId: targetUserId,
    gameType,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  // Confirm to sender with notification
  connection.ws.send(JSON.stringify({
    type: 'GAME_INVITE_SENT',
    inviteId,
    toUserId: targetUserId,
    toUsername: targetConnection.user?.username || 'User',
    timestamp: new Date().toISOString()
  }));

}

export function handleGameInviteAccept(clientId: string, inviteId: string) {
  const connection = activeConnections.get(clientId);
  if (!connection || !connection.userId) {
    sendError(connection.ws, 'Authentication required');
    return;
  }

  const invite = gameInvites.get(inviteId);
  if (!invite) {
    sendError(connection.ws, 'Invite not found or expired');
    return;
  }

  if (invite.status !== 'pending') {
    sendError(connection.ws, 'Invite already processed');
    return;
  }

  // Update invite status
  invite.status = 'accepted';
  gameInvites.set(inviteId, invite);

  // Create game room ID
  const gameRoomId = `game_${inviteId}`;

  // Notify both users to join the game
  const acceptMessage = {
    type: 'GAME_INVITE_ACCEPTED',
    inviteId,
    gameRoomId,
    gameType: invite.gameType,
    timestamp: new Date().toISOString()
  };

  // Send to accepter (current user)
  connection.ws.send(JSON.stringify(acceptMessage));

  // Send to inviter
  sendToUser(parseInt(invite.fromUserId), acceptMessage);

}

export function handleGameInviteDecline(clientId: string, inviteId: string) {
  const connection = activeConnections.get(clientId);
  if (!connection || !connection.userId) {
    sendError(connection.ws, 'Authentication required');
    return;
  }

  const invite = gameInvites.get(inviteId);
  if (!invite) {
    return; // Silently ignore if invite not found
  }

  // Update invite status
  invite.status = 'declined';
  gameInvites.set(inviteId, invite);

  // Notify inviter
  sendToUser(parseInt(invite.fromUserId), {
    type: 'GAME_INVITE_DECLINED',
    inviteId,
    declinedBy: connection.user?.username || 'User',
    timestamp: new Date().toISOString()
  });

}