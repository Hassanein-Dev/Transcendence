import { WebSocket } from 'ws';
import { handleAuthentication } from './handlers/auth';
import { handlePrivateMessage, handlePrivateChatCreated } from './handlers/chat';
import { handleJoinGame, handlePlayerMove, handleGameAction, handleRemoteGameCreate, handlePaddlePosition, handleBallState, handleScoreUpdate, handlePlayerDisconnect } from './handlers/game';
import { handleGameInvite, handleGameInviteAccept, handleGameInviteDecline } from './handlers/invites';
import { handleFriendRequest, handleFriendStatusChange, handleOnlineStatusChange } from './handlers/friends';

// Import utility functions
import { broadcastToRoom, initializeGameState, sendError, generateClientId } from './utils';

// Store active connections and rooms
export const activeConnections = new Map(); // clientId -> {ws, user}
export const gameRooms = new Map();
export const gameInvites = new Map();
export const userConnections = new Map(); // userId -> Set of clientIds

// Main WebSocket message router
export function handleWebSocketMessage(clientId: string, message: any) {
  const connection = activeConnections.get(clientId);
  if (!connection) return;


  // Protect certain message types that require authentication
  const authRequiredTypes = new Set([
    'PRIVATE_MESSAGE', 'PRIVATE_CHAT_CREATED',
    'JOIN_GAME', 'PLAYER_MOVE', 'GAME_ACTION', 'REMOTE_GAME_CREATE', 'PADDLE_POSITION', 'BALL_STATE', 'SCORE_UPDATE',
    'GAME_INVITE', 'STATUS_UPDATE', 'FRIEND_REQUEST'
  ]);

  if (authRequiredTypes.has(message.type) && !connection.userId) {
    // Send auth error and ignore message
    try {
      connection.ws.send(JSON.stringify({ type: 'AUTH_REQUIRED', message: 'Please authenticate first' }));
    } catch (e) {
      // ignore send errors
    }
    return;
  }

  switch (message.type) {
    // Auth
    case 'AUTHENTICATE':
      handleAuthentication(clientId, message.token);
      break;

    // Private Chat
    case 'PRIVATE_MESSAGE':
      handlePrivateMessage(clientId, message.targetUserId, message.content);
      break;
    case 'PRIVATE_CHAT_CREATED':
      handlePrivateChatCreated(clientId, message.targetUserId);
      break;

    // Game
    case 'JOIN_GAME':
      handleJoinGame(clientId, message.gameId);
      break;
    case 'PLAYER_MOVE':
      handlePlayerMove(clientId, message.direction, message.position);
      break;
    case 'GAME_ACTION':
      handleGameAction(clientId, message.action);
      break;
    case 'REMOTE_GAME_CREATE':
      handleRemoteGameCreate(clientId, message.targetUserId);
      break;
    case 'PADDLE_POSITION':
      handlePaddlePosition(clientId, message.roomId, message.playerNumber, message.paddleY);
      break;
    case 'BALL_STATE':
      handleBallState(clientId, message.roomId, message.ballState);
      break;
    case 'SCORE_UPDATE':
      handleScoreUpdate(clientId, message.roomId, message.scores);
      break;
    case 'game:player_disconnect':
      // Handle disconnect asynchronously (don't await to avoid blocking)
      handlePlayerDisconnect(clientId, message).catch(err => {
        console.error(' [WS] Error handling player disconnect:', err);
      });
      break;

    // Social
    case 'GAME_INVITE':
      handleGameInvite(clientId, message.targetUserId, message.gameType);
      break;
    case 'GAME_INVITE_ACCEPT':
      handleGameInviteAccept(clientId, message.inviteId);
      break;
    case 'GAME_INVITE_DECLINE':
      handleGameInviteDecline(clientId, message.inviteId);
      break;
    case 'FRIEND_REQUEST':
      handleFriendRequest(connection.userId, message.toUserId);
      break;
    default:
      console.warn(`[WS] Unknown message type: ${message.type}`);
  }
}

// Re-export utility functions for handlers to use
export { broadcastToRoom, initializeGameState, sendError, generateClientId };

// Re-export sendToUser from utils for tournament notifications
export { sendToUser } from './utils';