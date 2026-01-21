import { activeConnections, gameRooms } from '../router';
import { broadcastToRoom, sendError } from '../router';
import { initializeGameState } from '../utils';
import { remoteGameManager } from './remoteGame';

// Helper function to check if a tournament match is already completed
function isTournamentMatchCompleted(gameId: string): boolean {
  // Check if this is a tournament match (numeric ID)
  const isTournamentMatch = /^\d+$/.test(gameId);
  if (!isTournamentMatch) return false;

  try {
    const db = require('../../models/connection').default;
    const match = db.prepare(`
      SELECT status FROM tournament_matches WHERE id = ?
    `).get(gameId);

    if (match && match.status === 'completed') {
      return true;
    }
  } catch (error) {
  }

  return false;
}

// Export all game handlers
export function handleJoinGame(clientId: string, gameId: string) {
  const connection = activeConnections.get(clientId);
  if (!connection) {
    return;
  }

  if (!connection.userId) {
    sendError(connection.ws, 'Please authenticate before joining a game');
    return;
  }

  // Check if this is a tournament match that's already completed
  if (isTournamentMatchCompleted(gameId)) {
    connection.ws.send(JSON.stringify({
      type: 'MATCH_ALREADY_COMPLETED',
      message: 'This match has already been completed',
      gameId: gameId
    }));
    return;
  }

  // Create or join game room
  if (!gameRooms.has(gameId)) {
    gameRooms.set(gameId, {
      players: new Set(),
      gameState: initializeGameState()
    });
  } else {
    const existingRoom = gameRooms.get(gameId);
    // If the room exists and the game is finished, reset it for a new game
    // BUT NOT for tournament matches - they should only be played once
    const isTournamentMatch = /^\d+$/.test(gameId);
    if (existingRoom && existingRoom.gameState.finished && !isTournamentMatch) {
      // Stop any existing game loop
      if (existingRoom.gameLoop) {
        clearInterval(existingRoom.gameLoop);
        existingRoom.gameLoop = null;
      }
      // Reset the game state completely
      existingRoom.players.clear();
      existingRoom.gameState = initializeGameState();
    } else if (existingRoom && existingRoom.gameState.finished && isTournamentMatch) {
      connection.ws.send(JSON.stringify({
        type: 'MATCH_ALREADY_COMPLETED',
        message: 'This match has already been completed',
        gameId: gameId
      }));
      return;
    }
  }

  const room = gameRooms.get(gameId);
  if (!room) return;

  // Prevent joining games that are already in progress
  if (room.gameState.started && !room.gameState.finished && room.players.size >= 2) {
    sendError(connection.ws, 'This game is already in progress');
    return;
  }

  room.players.add(clientId);
  connection.gameRoom = gameId;

  // Notify all players in the room
  room.players.forEach((playerId: string) => {
    const playerConn = activeConnections.get(playerId);
    if (playerConn) {
      const playerList = Array.from(room.players).map(id => {
        const conn = activeConnections.get(id);
        return {
          userId: conn?.userId,
          username: conn?.user?.username
        };
      });

      playerConn.ws.send(JSON.stringify({
        type: 'PLAYER_JOINED',
        gameId,
        playerId: connection.userId,
        username: connection.user?.username,
        players: playerList
      }));
    }
  });

  // Auto-start game when both players have joined (only if not already started)
  if (room.players.size === 2 && !room.gameState.started) {
    // Start game after a short delay to ensure both clients are ready
    setTimeout(() => {
      startGame(gameId);
    }, 1500);
  }
}

export function handlePlayerMove(clientId: string, direction: string, position: number) {
  const connection = activeConnections.get(clientId);
  if (!connection) {
    return;
  }

  if (!connection.gameRoom) {
    console.warn(`[GAME] Player ${connection.userId} not in a game room`);
    return;
  }

  const room = gameRooms.get(connection.gameRoom);
  if (!room) {
    return;
  }

  // Update paddle position in game state
  const players = Array.from(room.players);
  const playerIndex = players.indexOf(clientId);

  if (playerIndex !== -1 && room.gameState.paddles[playerIndex]) {
    room.gameState.paddles[playerIndex].y = position;
  }

  // Broadcast movement to all players in the room
  room.players.forEach((playerId: string) => {
    if (playerId !== clientId) {
      const playerConn = activeConnections.get(playerId);
      if (playerConn) {
        playerConn.ws.send(JSON.stringify({
          type: 'PLAYER_MOVED',
          playerId: connection.userId,
          playerIndex,
          direction,
          position,
          timestamp: Date.now()
        }));
      }
    }
  });
}

export function handleGameAction(clientId: string, action: any) {
  const connection = activeConnections.get(clientId);
  if (!connection || !connection.userId) {
    sendError(connection.ws, 'Authentication required');
    return;
  }

  switch (action.type) {
    case 'READY':
      handlePlayerReady(clientId, action.gameId);
      break;
    case 'START_GAME':
      handleStartGame(clientId, action.gameId);
      break;
    case 'PAUSE_GAME':
      handlePauseGame(clientId, action.gameId);
      break;
    case 'RESUME_GAME':
      handleResumeGame(clientId, action.gameId);
      break;
    default:
      console.warn(`[GAME] Unknown game action: ${action.type}`);
      sendError(connection.ws, `Unknown game action: ${action.type}`);
  }
}

// Game action sub-handlers
function handlePlayerReady(clientId: string, gameId: string) {
  const connection = activeConnections.get(clientId);
  const room = gameRooms.get(gameId);

  if (!room) {
    sendError(connection.ws, 'Game room not found');
    return;
  }

  if (!room.readyPlayers) room.readyPlayers = new Set();
  room.readyPlayers.add(clientId);

  broadcastToRoom(gameId, {
    type: 'PLAYER_READY',
    playerId: connection.userId,
    readyPlayers: Array.from(room.readyPlayers).map(id => activeConnections.get(id)?.userId)
  });

  if (room.readyPlayers.size >= 2 && room.readyPlayers.size === room.players.size) {
    startGame(gameId);
  }
}

function handleStartGame(clientId: string, gameId: string) {
  const connection = activeConnections.get(clientId);
  const room = gameRooms.get(gameId);

  if (!room) {
    sendError(connection.ws, 'Game room not found');
    return;
  }

  startGame(gameId);
}

function startGame(gameId: string) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  room.gameState.started = true;
  room.gameState.startTime = Date.now();

  // If this is a tournament match, mark it as in_progress
  const isTournamentMatch = /^\d+$/.test(gameId);
  if (isTournamentMatch) {
    try {
      const db = require('../../models/connection').default;
      db.prepare(`
        UPDATE tournament_matches 
        SET status = 'in_progress' 
        WHERE id = ? AND status != 'completed'
      `).run(gameId);
    } catch (error) {
    }
  }

  // Initialize game loop interval (60 FPS)
  if (!room.gameLoop) {
    room.gameLoop = setInterval(() => {
      updateGamePhysics(gameId);
      broadcastGameState(gameId);
    }, 1000 / 60); // 60 FPS
  }

  broadcastToRoom(gameId, {
    type: 'GAME_STARTED',
    gameId,
    startTime: room.gameState.startTime,
    initialBall: room.gameState.ball
  });
}

function updateGamePhysics(gameId: string) {
  const room = gameRooms.get(gameId);
  if (!room || !room.gameState.started || room.gameState.paused) return;

  const state = room.gameState;
  const canvasWidth = 800;
  const canvasHeight = 600;

  // Update ball position
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;

  // Ball collision with top/bottom walls
  if (state.ball.y <= 10 || state.ball.y >= canvasHeight - 10) {
    state.ball.vy = -state.ball.vy;
  }

  // Ball collision with paddles
  const paddle1 = state.paddles[0];
  const paddle2 = state.paddles[1];

  // Left paddle collision
  if (state.ball.x <= 30 && state.ball.y >= paddle1.y && state.ball.y <= paddle1.y + 100) {
    state.ball.vx = Math.abs(state.ball.vx);
    const hitPos = (state.ball.y - paddle1.y) / 100;
    state.ball.vy = (hitPos - 0.5) * 10;
  }

  // Right paddle collision
  if (state.ball.x >= canvasWidth - 30 && state.ball.y >= paddle2.y && state.ball.y <= paddle2.y + 100) {
    state.ball.vx = -Math.abs(state.ball.vx);
    const hitPos = (state.ball.y - paddle2.y) / 100;
    state.ball.vy = (hitPos - 0.5) * 10;
  }

  // Scoring
  if (state.ball.x <= 0) {
    state.scores[1]++;
    resetBall(state, canvasWidth, canvasHeight);
    broadcastToRoom(gameId, { type: 'SCORE_UPDATE', scores: state.scores });

    if (state.scores[1] >= 5) {
      endGame(gameId, 1);
    }
  } else if (state.ball.x >= canvasWidth) {
    state.scores[0]++;
    resetBall(state, canvasWidth, canvasHeight);
    broadcastToRoom(gameId, { type: 'SCORE_UPDATE', scores: state.scores });

    if (state.scores[0] >= 5) {
      endGame(gameId, 0);
    }
  }
}

function resetBall(state: any, width: number, height: number) {
  state.ball.x = width / 2;
  state.ball.y = height / 2;
  state.ball.vx = (Math.random() > 0.5 ? 1 : -1) * 5;
  state.ball.vy = (Math.random() - 0.5) * 6;
}

function broadcastGameState(gameId: string) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  broadcastToRoom(gameId, {
    type: 'GAME_STATE_UPDATE',
    ball: room.gameState.ball,
    paddles: room.gameState.paddles,
    scores: room.gameState.scores
  });
}

async function endGame(gameId: string, winner: number) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  // Stop game loop
  if (room.gameLoop) {
    clearInterval(room.gameLoop);
    room.gameLoop = null;
  }

  // Mark game as finished
  room.gameState.finished = true;

  const players = Array.from(room.players);
  const winnerConnection = activeConnections.get(players[winner]);
  const loserConnection = activeConnections.get(players[winner === 0 ? 1 : 0]);

  broadcastToRoom(gameId, {
    type: 'GAME_ENDED',
    gameId,
    winner,
    winnerUserId: winnerConnection?.userId,
    finalScores: room.gameState.scores
  });

  // Schedule cleanup of the game room after 10 seconds to allow players to see results
  setTimeout(() => {
    const roomToClean = gameRooms.get(gameId);
    if (roomToClean && roomToClean.gameState.finished) {
      // Remove all players from the room
      roomToClean.players.forEach((playerId: string) => {
        const conn = activeConnections.get(playerId);
        if (conn) {
          conn.gameRoom = undefined;
        }
      });
      // Delete the game room
      gameRooms.delete(gameId);
    }
  }, 10000); // 10 seconds delay

  // Check if this is a tournament match (gameId will be numeric matchId)
  const isTournamentMatch = /^\d+$/.test(gameId);

  if (isTournamentMatch && winnerConnection?.userId && loserConnection?.userId) {
    try {
      // Import database
      const db = (await import('../../models')).default;

      // Get match details to find tournament ID and player assignments
      const match = db.prepare(`
        SELECT tournament_id, player1_id, player2_id 
        FROM tournament_matches 
        WHERE id = ?
      `).get(gameId);

      if (match) {
        // Map player indices to database player IDs
        // Find which index each database player is at in the game room
        const player1Index = players.findIndex(p => {
          const conn = activeConnections.get(p);
          return conn?.userId === match.player1_id;
        });
        const player2Index = players.findIndex(p => {
          const conn = activeConnections.get(p);
          return conn?.userId === match.player2_id;
        });

        // Get scores based on correct player indices
        const scorePlayer1 = player1Index !== -1 ? room.gameState.scores[player1Index] : 0;
        const scorePlayer2 = player2Index !== -1 ? room.gameState.scores[player2Index] : 0;

        // Determine winner ID
        const winnerId = winnerConnection.userId;

        // Update tournament match with results
        db.prepare(`
          UPDATE tournament_matches 
          SET winner_id = ?, 
              score_player1 = ?, 
              score_player2 = ?, 
              status = 'completed', 
              completed_at = ?
          WHERE id = ?
        `).run(winnerId, scorePlayer1, scorePlayer2, new Date().toISOString(), gameId);

        // Save to games table
        db.prepare(`
          INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, game_type, tournament_match_id, created_at)
          VALUES (?, ?, ?, ?, ?, 'tournament', ?, ?)
        `).run(match.player1_id, match.player2_id, winnerId, scorePlayer1, scorePlayer2, gameId, new Date().toISOString());

        // Update tournament bracket (advance winner to next round)
        await updateTournamentBracket(match.tournament_id.toString(), gameId, winnerId.toString());
      } else {
        console.warn(` [TOURNAMENT] Match ${gameId} not found in database`);
      }
    } catch (error) {
    }
  } else {
    // Save regular remote game result
    try {
      const db = (await import('../../models')).default;

      const player1Id = winnerConnection?.userId;
      const player2Id = loserConnection?.userId;
      const winnerId = winnerConnection?.userId;

      if (player1Id && player2Id && winnerId) {
        // Save to games table
        db.prepare(`
          INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, game_type, created_at)
          VALUES (?, ?, ?, ?, ?, 'remote', datetime('now'))
        `).run(
          player1Id,
          player2Id,
          winnerId,
          room.gameState.scores[winner],
          room.gameState.scores[winner === 0 ? 1 : 0]
        );
      } else {
        console.warn(` [GAME] Missing player IDs, cannot save game result`);
      }
    } catch (error) {
    }
  }

  // Clean up game room after 10 seconds to allow players to see results
  setTimeout(() => {
    gameRooms.delete(gameId);
  }, 10000);
}

// Helper function to update tournament bracket
async function updateTournamentBracket(tournamentId: string, completedMatchId: string, winnerId: string): Promise<void> {
  const db = (await import('../../models')).default;

  // Get the completed match
  const completedMatch = db.prepare(`
    SELECT round_number, match_number FROM tournament_matches 
    WHERE id = ?
  `).get(completedMatchId);

  if (!completedMatch) {
    return;
  }

  const { round_number, match_number } = completedMatch;

  // Find the next match in the bracket
  const nextRound = round_number + 1;
  const nextMatchNumber = Math.ceil(match_number / 2);

  // Convert tournamentId to integer for SQL query (SQLite type matching)
  const tournamentIdInt = parseInt(tournamentId, 10);

  const nextMatch = db.prepare(`
    SELECT id, player1_id, player2_id FROM tournament_matches
    WHERE tournament_id = ? AND round_number = ? AND match_number = ?
  `).get(tournamentIdInt, nextRound, nextMatchNumber);

  if (nextMatch) {

    // Determine which slot to fill (odd matches go to player1, even to player2)
    const slot = match_number % 2 === 1 ? 'player1_id' : 'player2_id';

    db.prepare(`
      UPDATE tournament_matches SET ${slot} = ? WHERE id = ?
    `).run(winnerId, nextMatch.id);

    // Re-fetch the match to get updated player IDs
    const updatedMatch = db.prepare(`
      SELECT id, player1_id, player2_id FROM tournament_matches WHERE id = ?
    `).get(nextMatch.id);

    // If both players are now set, mark match as ready
    if (updatedMatch.player1_id && updatedMatch.player2_id) {
      db.prepare(`
        UPDATE tournament_matches SET status = 'ready' WHERE id = ?
      `).run(nextMatch.id);
    }
  } else {
    // This was the final match - mark tournament as completed
    const tournamentIdInt = parseInt(tournamentId, 10);

    db.prepare(`
      UPDATE tournaments SET status = 'completed', completed_at = ? WHERE id = ?
    `).run(new Date().toISOString(), tournamentIdInt);
  }
}

// Helper function to progress tournament bracket after disconnect
async function updateTournamentBracketAfterDisconnect(db: any, tournamentId: string, completedMatchId: string, winnerId: string): Promise<void> {
  // Get the completed match details
  const completedMatch = db.prepare(`
    SELECT round_number, match_number, player1_id, player2_id
    FROM tournament_matches
    WHERE id = ?
  `).get(completedMatchId);

  if (!completedMatch) {
    return;
  }

  const { round_number, match_number } = completedMatch;

  // Find the next match in the bracket (same logic as updateTournamentBracket)
  const nextRound = round_number + 1;
  const nextMatchNumber = Math.ceil(match_number / 2);

  // Convert tournamentId to integer for SQL query
  const tournamentIdInt = parseInt(tournamentId, 10);

  const nextMatch = db.prepare(`
    SELECT id, player1_id, player2_id FROM tournament_matches
    WHERE tournament_id = ? AND round_number = ? AND match_number = ?
  `).get(tournamentIdInt, nextRound, nextMatchNumber);

  if (nextMatch) {
    // Determine which slot to fill (odd matches go to player1, even to player2)
    const slot = match_number % 2 === 1 ? 'player1_id' : 'player2_id';

    db.prepare(`
      UPDATE tournament_matches SET ${slot} = ? WHERE id = ?
    `).run(winnerId, nextMatch.id);

    // Re-fetch the match to get updated player IDs
    const updatedMatch = db.prepare(`
      SELECT id, player1_id, player2_id FROM tournament_matches WHERE id = ?
    `).get(nextMatch.id);

    // If both players are now set, mark match as ready
    if (updatedMatch.player1_id && updatedMatch.player2_id) {
      db.prepare(`
        UPDATE tournament_matches SET status = 'ready' WHERE id = ?
      `).run(nextMatch.id);
    }
  } else {
    // This was the final match - mark tournament as completed
    db.prepare(`
      UPDATE tournaments SET status = 'completed', winner_id = ?, completed_at = ? WHERE id = ?
    `).run(winnerId, new Date().toISOString(), tournamentIdInt);
  }
}

function handlePauseGame(clientId: string, gameId: string) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  room.gameState.paused = true;
  room.gameState.pauseTime = Date.now();

  broadcastToRoom(gameId, {
    type: 'GAME_PAUSED',
    gameId,
    pauseTime: room.gameState.pauseTime,
    pausedBy: activeConnections.get(clientId)?.userId
  });
}

function handleResumeGame(clientId: string, gameId: string) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  room.gameState.paused = false;
  const pauseDuration = Date.now() - room.gameState.pauseTime;

  broadcastToRoom(gameId, {
    type: 'GAME_RESUMED',
    gameId,
    resumeTime: Date.now(),
    pauseDuration
  });
}

// Remote game handlers
export function handleRemoteGameCreate(clientId: string, targetUserId: string) {
  const connection = activeConnections.get(clientId);
  if (!connection || !connection.userId) return;

  const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  remoteGameManager.createGame(roomId, connection.userId, targetUserId);

  // Add both players to the game room
  if (!gameRooms.has(roomId)) {
    gameRooms.set(roomId, { players: new Set(), gameState: initializeGameState() });
  }
  gameRooms.get(roomId)!.players.add(clientId);

  // Find target user's connection and add them to room
  for (const [connId, conn] of activeConnections.entries()) {
    if (conn.userId === targetUserId) {
      gameRooms.get(roomId)!.players.add(connId);
      break;
    }
  }
}

export function handlePaddlePosition(clientId: string, roomId: string, playerNumber: number, paddleY: number) {
  remoteGameManager.updatePaddle(roomId, playerNumber, paddleY);
}

export function handleBallState(clientId: string, roomId: string, ballState: any) {
  remoteGameManager.updateBall(roomId, ballState);
}

export function handleScoreUpdate(clientId: string, roomId: string, scores: [number, number]) {
  remoteGameManager.updateScore(roomId, scores);
}

export async function handlePlayerDisconnect(clientId: string, data: any) {
  const { roomId, playerNumber, tournamentId, matchId } = data;

  const connection = activeConnections.get(clientId);
  if (!connection) {
    return;
  }

  const room = gameRooms.get(roomId);
  if (!room) {
    return;
  }

  // Stop the game loop immediately
  if (room.gameLoop) {
    clearInterval(room.gameLoop);
    room.gameLoop = null;
  }

  // Mark game as finished to prevent restart
  room.gameState.finished = true;

  // Determine the winner (the player who didn't disconnect)
  const players = Array.from(room.players);
  const remainingPlayer = players.find(id => id !== clientId);

  if (remainingPlayer) {
    const remainingConnection = activeConnections.get(remainingPlayer);
    if (remainingConnection) {
      // Notify remaining player they won
      remainingConnection.ws.send(JSON.stringify({
        type: 'game:opponent_disconnect',
        winnerId: remainingConnection.userId,
        message: 'Your opponent disconnected. You win!'
      }));


      // Save game result and update stats
      try {
        const db = require('../../models/connection').default;
        
        // Get player IDs from room
        const disconnectedConnection = activeConnections.get(clientId);
        const winnerId = remainingConnection.userId;
        const loserId = disconnectedConnection?.userId;

        if (winnerId && loserId) {
          // Determine player1 and player2 IDs
          let player1Id: string | undefined;
          let player2Id: string | undefined;
          let scorePlayer1: number | undefined;
          let scorePlayer2: number | undefined;

          // If this is a tournament match, get players from match
          if (tournamentId && matchId) {
            const match = db.prepare(`
              SELECT player1_id, player2_id FROM tournament_matches
              WHERE id = ? AND tournament_id = ?
            `).get(matchId, tournamentId);

            if (match) {
              player1Id = match.player1_id;
              player2Id = match.player2_id;
              scorePlayer1 = winnerId === player1Id ? 5 : 0;
              scorePlayer2 = winnerId === player2Id ? 5 : 0;

              // Update tournament match
              db.prepare(`
                UPDATE tournament_matches
                SET status = 'completed',
                    winner_id = ?,
                    completed_at = ?,
                    score_player1 = ?,
                    score_player2 = ?
                WHERE id = ?
              `).run(
                winnerId,
                new Date().toISOString(),
                scorePlayer1,
                scorePlayer2,
                matchId
              );

              // Progress tournament bracket (create next round matches if needed)
              try {
                await updateTournamentBracketAfterDisconnect(db, tournamentId, matchId, winnerId);
              } catch (bracketError) {
              }
            }
          } else {
            // Regular game - assign players based on who's who
            player1Id = winnerId;
            player2Id = loserId;
            scorePlayer1 = 5;
            scorePlayer2 = 0;
          }

          // Only save if we have valid player IDs
          if (player1Id && player2Id && scorePlayer1 !== undefined && scorePlayer2 !== undefined) {
            // Save game to games table
            const gameResult = db.prepare(`
              INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, game_type, tournament_match_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              player1Id,
              player2Id,
              winnerId,
              scorePlayer1,
              scorePlayer2,
              tournamentId ? 'tournament' : 'multiplayer',
              matchId || null,
              new Date().toISOString()
            );

            // Update user stats for both players
            updatePlayerStats(db, winnerId, loserId);
          }
        }
      } catch (error) {
      }
    }
  }

  // Clean up the room
  gameRooms.delete(roomId);
}

// Helper function to update player stats
function updatePlayerStats(db: any, winnerId: string, loserId: string): void {
  // Update winner stats
  const winnerStats = db.prepare(`
    SELECT * FROM user_stats WHERE user_id = ?
  `).get(winnerId);

  if (winnerStats) {
    db.prepare(`
      UPDATE user_stats SET 
        total_games = total_games + 1,
        wins = wins + 1,
        updated_at = ?
      WHERE user_id = ?
    `).run(new Date().toISOString(), winnerId);
  } else {
    db.prepare(`
      INSERT INTO user_stats (user_id, total_games, wins, losses, total_points_scored, total_points_conceded, updated_at)
      VALUES (?, 1, 1, 0, 0, 0, ?)
    `).run(winnerId, new Date().toISOString());
  }

  // Update loser stats
  const loserStats = db.prepare(`
    SELECT * FROM user_stats WHERE user_id = ?
  `).get(loserId);

  if (loserStats) {
    db.prepare(`
      UPDATE user_stats SET 
        total_games = total_games + 1,
        losses = losses + 1,
        updated_at = ?
      WHERE user_id = ?
    `).run(new Date().toISOString(), loserId);
  } else {
    db.prepare(`
      INSERT INTO user_stats (user_id, total_games, wins, losses, total_points_scored, total_points_conceded, updated_at)
      VALUES (?, 1, 0, 1, 0, 0, ?)
    `).run(loserId, new Date().toISOString());
  }
}