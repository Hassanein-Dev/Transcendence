import { WebSocket } from 'ws';
import { activeConnections, gameRooms, userConnections } from './router';

export function broadcastToRoom(roomId: string, message: any, excludeClientId?: string) {
  // Broadcast to game rooms
  const gameRoom = gameRooms.get(roomId);
  if (gameRoom) {
    gameRoom.players.forEach((playerId: string) => {
      if (playerId !== excludeClientId) {
        const playerConn = activeConnections.get(playerId);
        if (playerConn) {
          playerConn.ws.send(JSON.stringify(message));
        }
      }
    });
  }
}

// NEW: Send message to specific user by user ID
export function sendToUser(userId: number, message: any): boolean {
  // Convert userId to string since userConnections uses string keys
  const userIdStr = userId.toString();
  const connections = userConnections.get(userIdStr);

  if (!connections || connections.size === 0) {
    return false;
  }


  let sent = false;
  connections.forEach((clientId: string) => {
    const connection = activeConnections.get(clientId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
      sent = true;
    }
  });

  return sent;
}

// NEW: Send message to multiple users
export function sendToUsers(userIds: number[], message: any) {
  userIds.forEach(userId => sendToUser(userId, message));
}

export function initializeGameState() {
  return {
    ball: {
      x: 400,
      y: 300,
      vx: 5, 
      vy: 3  
    },
    paddles: [
      { x: 20, y: 250 }, 
      { x: 770, y: 250 }
    ],
    scores: [0, 0],
    started: false,
    paused: false, 
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

export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}