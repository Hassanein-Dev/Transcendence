import { WebSocket } from 'ws';
import { userConnections } from '../websocket/router';
import { updateUserOnlineStatus } from '../websocket/handlers/status';
import { notifyFriendsOfStatusChange } from '../websocket/handlers/status';

export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function initializeGameState() {
  return {
    ball: { x: 400, y: 300, velocityX: 5, velocityY: 3 },
    scores: [0, 0],
    started: false,
    timestamp: Date.now()
  };
}

export function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({
    type: 'ERROR',
    message,
    timestamp: new Date().toISOString()
  }));
}

export function handleUserDisconnect(clientId: string, activeConnections: Map<any, any>, gameRooms: Map<any, any>) {
  const connection = activeConnections.get(clientId);
  if (connection && connection.gameRoom) {
    const room = gameRooms.get(connection.gameRoom);
    if (room) {
      room.players.delete(clientId);
      
      room.players.forEach((playerId: string) => {
        const playerConn = activeConnections.get(playerId);
        if (playerConn) {
          playerConn.ws.send(JSON.stringify({
            type: 'PLAYER_LEFT',
            playerId: connection.userId
          }));
        }
      });

      if (room.players.size === 0) {
        gameRooms.delete(connection.gameRoom);
      }
    }
  }

  // Remove from userConnections map and update online status if needed
  if (connection && connection.userId) {
    const userIdStr = String(connection.userId);
    const conns = userConnections.get(userIdStr);
    if (conns) {
      conns.delete(clientId);
      if (conns.size === 0) {
        userConnections.delete(userIdStr);
        // Mark user as offline in DB and notify friends
        try {
          updateUserOnlineStatus(connection.userId, false);
          notifyFriendsOfStatusChange(connection.userId, 'offline');
        } catch (err) {
        }
      }
    }
  }
}
