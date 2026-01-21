import { activeConnections, gameRooms, userConnections } from '../router';
import { broadcastToRoom, sendToUser } from '../utils';

export interface RemoteGameState {
  ball: { x: number; y: number; velocityX: number; velocityY: number };
  paddles: { y: number }[];
  scores: [number, number];
  isPlaying: boolean;
  lastUpdate: number;
}

export class RemoteGameManager {
  private games: Map<string, RemoteGameState> = new Map();

  createGame(roomId: string, player1Id: string, player2Id: string) {
    const gameState: RemoteGameState = {
      ball: { x: 400, y: 300, velocityX: 5, velocityY: 3 },
      paddles: [{ y: 250 }, { y: 250 }],
      scores: [0, 0] as [number, number],
      isPlaying: false,
      lastUpdate: Date.now()
    };

    // Store player user IDs on the game state so we can map to client connections
    (gameState as any).players = [player1Id, player2Id];

    this.games.set(roomId, gameState);

    // Notify both players
    sendToUser(parseInt(player1Id), {
      type: 'GAME_CREATED',
      roomId,
      playerNumber: 0,
      opponent: player2Id
    });

    sendToUser(parseInt(player2Id), {
      type: 'GAME_CREATED',
      roomId,
      playerNumber: 1,
      opponent: player1Id
    });

    return gameState;
  }

  updatePaddle(roomId: string, playerNumber: number, paddleY: number) {
    const game = this.games.get(roomId);
    if (!game) return;

    game.paddles[playerNumber].y = paddleY;
    game.lastUpdate = Date.now();

    // Broadcast paddle update to other player
    const excludeClientId = this.getPlayerConnectionId(roomId, playerNumber);
    broadcastToRoom(roomId, {
      type: 'PADDLE_UPDATE',
      playerNumber,
      paddleY,
      timestamp: game.lastUpdate
    }, excludeClientId || undefined);
  }

  updateBall(roomId: string, ballState: any) {
    const game = this.games.get(roomId);
    if (!game) return;

    game.ball = ballState;
    game.lastUpdate = Date.now();

    broadcastToRoom(roomId, {
      type: 'BALL_UPDATE',
      ball: ballState,
      timestamp: game.lastUpdate
    });
  }

  updateScore(roomId: string, scores: [number, number]) {
    const game = this.games.get(roomId);
    if (!game) return;

    game.scores = scores;
    game.lastUpdate = Date.now();

    broadcastToRoom(roomId, {
      type: 'SCORE_UPDATE',
      scores,
      timestamp: game.lastUpdate
    });
  }

  async endGame(roomId: string, winner: number) {
    const game = this.games.get(roomId) as any;
    if (!game) return;

    // Get player IDs
    const player1Id = game.players?.[0];
    const player2Id = game.players?.[1];
    const winnerId = game.players?.[winner];

    // Save to database
    if (player1Id && player2Id && winnerId) {
      try {
        const db = (await import('../../models')).default;

        db.prepare(`
          INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, game_type, created_at)
          VALUES (?, ?, ?, ?, ?, '1v1', ?)
        `).run(
          player1Id,
          player2Id,
          winnerId,
          game.scores[0],
          game.scores[1],
          new Date().toISOString()
        );

      } catch (error) {
      }
    } else {
      console.warn(`[REMOTE GAME] Missing player IDs, cannot save to database`);
    }

    // Broadcast game ended
    broadcastToRoom(roomId, {
      type: 'GAME_ENDED',
      winner,
      winnerId,
      finalScores: game.scores
    });

    this.games.delete(roomId);
  }

  private getPlayerConnectionId(roomId: string, playerNumber: number): string | null {
    // Try to resolve clientId by looking up the user ID stored on the game state
    const game = this.games.get(roomId) as any;
    if (game && Array.isArray(game.players)) {
      const userIdStr = String(game.players[playerNumber]);

      // First try the userConnections map (userId -> Set of clientIds)
      const conns = userConnections.get(userIdStr);
      if (conns && conns.size > 0) {
        // Return the first active clientId for that user
        for (const cid of conns) {
          const c = activeConnections.get(cid);
          if (c && c.ws && c.ws.readyState === c.ws.OPEN) return cid;
        }
      }

      // Fallback: scan the room's players list (handles legacy Set room shape)
      const room = gameRooms.get(roomId);
      if (room) {
        // room may be a Set of clientIds or an object with `players`
        const clientsIterable = (room instanceof Set) ? room : (room.players || []);
        for (const cid of clientsIterable) {
          const c = activeConnections.get(cid as string);
          if (c && String(c.userId) === userIdStr) return cid as string;
        }
      }
    }

    return null;
  }
}

export const remoteGameManager = new RemoteGameManager();