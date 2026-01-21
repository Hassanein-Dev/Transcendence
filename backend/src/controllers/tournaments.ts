import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import db from "../models";

interface CreateTournamentBody {
  name: string;
  maxPlayers: number;
  type: 'single_elimination';
  createdBy?: number; // Optional: user ID of tournament creator
}

interface JoinTournamentBody {
  userId: string;
}

interface GameResultBody {
  player1Id: string;
  player2Id: string;
  winnerId: string;
  scores: [number, number];
  tournamentMatchId?: string;
}

export default async function tournamentRoutes(fastify: FastifyInstance) {
  // Create a new tournament
  fastify.post<{ Body: CreateTournamentBody }>(
    "/tournaments",
    async (request, reply) => {
      const { name, maxPlayers, type, createdBy } = request.body;

      if (!name || !maxPlayers || !type) {
        return reply.status(400).send({
          error: "Name, maxPlayers and type are required"
        });
      }

      if (maxPlayers < 2 || maxPlayers > 32) {
        return reply.status(400).send({
          error: "Max players must be between 2 and 32"
        });
      }

      // Use the createdBy from request body, or default to 1 if not provided
      const tournamentCreator = createdBy || 1;

      const stmt = db.prepare(`
        INSERT INTO tournaments (name, max_players, type, status, created_by, created_at) 
        VALUES (?, ?, ?, 'waiting', ?, ?)
      `);

      const info = stmt.run(name, maxPlayers, type, tournamentCreator, new Date().toISOString());
      const tournamentId = info.lastInsertRowid;

      // Broadcast tournament creation to all connected users
      const { userConnections, activeConnections } = await import('../websocket/router');
      const allClientIds = Array.from(activeConnections.keys());
      allClientIds.forEach(clientId => {
        const connection = activeConnections.get(clientId);
        if (connection?.ws?.readyState === 1) { // WebSocket.OPEN
          try {
            connection.ws.send(JSON.stringify({
              type: 'TOURNAMENT_UPDATED',
              tournamentId: tournamentId,
              action: 'created'
            }));
          } catch (e) {
          }
        }
      });

      return reply.status(201).send({
        id: tournamentId,
        name,
        maxPlayers,
        type,
        status: 'waiting',
        created_by: tournamentCreator,
        created_at: new Date().toISOString()
      });
    }
  );

  // Get all tournaments
  fastify.get("/tournaments", async (request, reply) => {
    const tournaments = db.prepare(`
      SELECT 
        t.id,
        t.name,
        t.max_players as maxPlayers,
        t.type,
        t.status,
        t.created_by as createdBy,
        t.created_at as createdAt,
        t.started_at as startedAt,
        t.completed_at as completedAt,
        COUNT(tp.user_id) as currentPlayers
      FROM tournaments t
      LEFT JOIN tournament_players tp ON t.id = tp.tournament_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all();

    // Add player IDs for each tournament
    const tournamentsWithPlayers = tournaments.map((tournament: any) => {
      const playerIds = db.prepare(`
        SELECT user_id as id FROM tournament_players WHERE tournament_id = ?
      `).all(tournament.id).map((p: any) => p.id);
      
      return {
        ...tournament,
        playerIds
      };
    });

    return tournamentsWithPlayers;
  });

  // Get specific tournament
  fastify.get("/tournaments/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    try {
      const tournament = db.prepare(`
        SELECT 
          t.id,
          t.name,
          t.max_players as maxPlayers,
          t.type,
          t.status,
          t.created_by as createdBy,
          u.username as creatorUsername,
          t.created_at as createdAt,
          t.started_at as startedAt,
          t.completed_at as completedAt,
          COUNT(tp.user_id) as currentPlayers
        FROM tournaments t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN tournament_players tp ON t.id = tp.tournament_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(id);

      if (!tournament) {
        return reply.status(404).send({ error: "Tournament not found" });
      }

      // Get tournament players
      const players = db.prepare(`
        SELECT 
          u.id,
          u.username,
          u.picture as avatarUrl
        FROM tournament_players tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
      `).all(id);

      // Get tournament matches
      const matches = db.prepare(`
        SELECT 
          tm.id,
          tm.round_number as roundNumber,
          tm.match_number as matchNumber,
          tm.player1_id as player1Id,
          tm.player2_id as player2Id,
          tm.winner_id as winnerId,
          tm.score_player1 as scorePlayer1,
          tm.score_player2 as scorePlayer2,
          tm.status,
          tm.player1_accepted as player1Accepted,
          tm.player2_accepted as player2Accepted,
          tm.created_at as createdAt,
          tm.started_at as startedAt,
          tm.completed_at as completedAt,
          u1.username as player1Username,
          u2.username as player2Username,
          uw.username as winnerUsername
        FROM tournament_matches tm
        LEFT JOIN users u1 ON tm.player1_id = u1.id
        LEFT JOIN users u2 ON tm.player2_id = u2.id
        LEFT JOIN users uw ON tm.winner_id = uw.id
        WHERE tm.tournament_id = ?
        ORDER BY tm.round_number, tm.match_number
      `).all(id);

      return {
        ...tournament,
        players,
        matches
      };
    } catch (error) {
      return reply.status(500).send({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Join a tournament
  fastify.post<{ Params: { id: string }, Body: JoinTournamentBody }>(
    "/tournaments/:id/join",
    async (request, reply) => {
      const { id } = request.params;
      const { userId } = request.body;

      if (!userId) {
        return reply.status(400).send({ error: "User ID is required" });
      }

      // Check if tournament exists and is open
      const tournament = db.prepare(`
        SELECT id, max_players, status FROM tournaments WHERE id = ?
      `).get(id);

      if (!tournament) {
        return reply.status(404).send({ error: "Tournament not found" });
      }

      if (tournament.status !== 'waiting') {
        return reply.status(400).send({ error: "Tournament is not accepting players" });
      }

      // Check if user is already in tournament
      const existingPlayer = db.prepare(`
        SELECT id FROM tournament_players 
        WHERE tournament_id = ? AND user_id = ?
      `).get(id, userId);

      if (existingPlayer) {
        return reply.status(400).send({ error: "User already in tournament" });
      }

      // Check if tournament is full
      const playerCount = db.prepare(`
        SELECT COUNT(*) as count FROM tournament_players WHERE tournament_id = ?
      `).get(id);

      if (playerCount.count >= tournament.max_players) {
        return reply.status(400).send({ error: "Tournament is full" });
      }

      // Add player to tournament
      db.prepare(`
        INSERT INTO tournament_players (tournament_id, user_id, joined_at) 
        VALUES (?, ?, ?)
      `).run(id, userId, new Date().toISOString());

      // Broadcast tournament update to all connected users
      const { userConnections, activeConnections } = await import('../websocket/router');
      const allClientIds = Array.from(activeConnections.keys());
      allClientIds.forEach(clientId => {
        const connection = activeConnections.get(clientId);
        if (connection?.ws?.readyState === 1) {
          try {
            connection.ws.send(JSON.stringify({
              type: 'TOURNAMENT_UPDATED',
              tournamentId: id,
              action: 'player_joined'
            }));
          } catch (e) {
          }
        }
      });

      return {
        success: true,
        message: "Successfully joined tournament"
      };
    }
  );

  // Start a tournament and generate bracket
  fastify.post("/tournaments/:id/start", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    // Check if tournament exists and has enough players
    const tournament = db.prepare(`
      SELECT t.id, t.max_players, COUNT(tp.user_id) as player_count
      FROM tournaments t
      LEFT JOIN tournament_players tp ON t.id = tp.tournament_id
      WHERE t.id = ?
      GROUP BY t.id
    `).get(id);

    if (!tournament) {
      return reply.status(404).send({ error: "Tournament not found" });
    }

    if (tournament.player_count < tournament.max_players) {
      return reply.status(400).send({ 
        error: `Tournament must be full to start. Currently ${tournament.player_count}/${tournament.max_players} players.` 
      });
    }

    // Update tournament status
    db.prepare(`
      UPDATE tournaments SET status = 'in_progress', started_at = ? WHERE id = ?
    `).run(new Date().toISOString(), id);

    // Generate bracket
    const players = db.prepare(`
      SELECT tp.user_id as id, u.username
      FROM tournament_players tp
      JOIN users u ON tp.user_id = u.id
      WHERE tp.tournament_id = ?
      ORDER BY tp.joined_at
    `).all(id);

    const matches = generateSingleEliminationBracket(players);

    // Insert matches into database
    const insertStmt = db.prepare(`
      INSERT INTO tournament_matches 
      (tournament_id, round_number, match_number, player1_id, player2_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    matches.forEach(match => {
      // Set status to 'ready' if both players are assigned (round 1), otherwise 'scheduled'
      const status = (match.roundNumber === 1 && match.player1Id && match.player2Id) ? 'ready' : 'scheduled';

      insertStmt.run(
        id,
        match.roundNumber,
        match.matchNumber,
        match.player1Id,
        match.player2Id,
        status,
        new Date().toISOString()
      );
    });

    // Broadcast tournament start to all connected users
    const { userConnections, activeConnections } = await import('../websocket/router');
    const allClientIds = Array.from(activeConnections.keys());
    const tournamentData = db.prepare('SELECT name FROM tournaments WHERE id = ?').get(id);
    allClientIds.forEach(clientId => {
      const connection = activeConnections.get(clientId);
      if (connection?.ws?.readyState === 1) {
        try {
          connection.ws.send(JSON.stringify({
            type: 'TOURNAMENT_STARTED',
            tournamentId: id,
            tournamentName: tournamentData?.name || 'Tournament'
          }));
        } catch (e) {
        }
      }
    });

    return {
      success: true,
      message: "Tournament started with bracket generated",
      matches: matches.length
    };
  });

  // Accept a match (both players must accept before game starts)
  fastify.post<{ Params: { tournamentId: string, matchId: string }, Body: { userId: number } }>(
    "/tournaments/:tournamentId/matches/:matchId/accept",
    async (request, reply) => {
      const { tournamentId, matchId } = request.params;
      const { userId } = request.body;

      if (!userId) {
        return reply.status(400).send({ error: "User ID is required" });
      }

      // Get the match
      const match = db.prepare(`
        SELECT id, player1_id, player2_id, player1_accepted, player2_accepted, status
        FROM tournament_matches
        WHERE id = ? AND tournament_id = ?
      `).get(matchId, tournamentId);

      if (!match) {
        return reply.status(404).send({ error: "Match not found" });
      }

      // Check if user is in this match
      if (match.player1_id !== userId && match.player2_id !== userId) {
        return reply.status(403).send({ error: "You are not a player in this match" });
      }

      // Determine which player is accepting
      const isPlayer1 = match.player1_id === userId;
      const column = isPlayer1 ? 'player1_accepted' : 'player2_accepted';

      // Mark as accepted
      db.prepare(`
        UPDATE tournament_matches SET ${column} = 1 WHERE id = ?
      `).run(matchId);

      // Check if both players have now accepted
      const updatedMatch = db.prepare(`
        SELECT player1_accepted, player2_accepted FROM tournament_matches WHERE id = ?
      `).get(matchId);

      if (updatedMatch.player1_accepted && updatedMatch.player2_accepted) {
        // Both accepted - change status to 'accepted'
        db.prepare(`
          UPDATE tournament_matches SET status = 'accepted' WHERE id = ?
        `).run(matchId);

        // Broadcast match accepted to all users
        const { activeConnections } = await import('../websocket/router');
        const allClientIds = Array.from(activeConnections.keys());
        allClientIds.forEach(clientId => {
          const connection = activeConnections.get(clientId);
          if (connection?.ws?.readyState === 1) {
            try {
              connection.ws.send(JSON.stringify({
                type: 'TOURNAMENT_UPDATED',
                tournamentId: tournamentId,
                action: 'match_accepted',
                matchId: matchId
              }));
            } catch (e) {
            }
          }
        });

        return {
          success: true,
          message: "Match accepted - both players ready!",
          bothAccepted: true
        };
      }

      // Broadcast partial acceptance to all users
      const { activeConnections } = await import('../websocket/router');
      const allClientIds = Array.from(activeConnections.keys());
      allClientIds.forEach(clientId => {
        const connection = activeConnections.get(clientId);
        if (connection?.ws?.readyState === 1) {
          try {
            connection.ws.send(JSON.stringify({
              type: 'TOURNAMENT_UPDATED',
              tournamentId: tournamentId,
              action: 'match_accepted_partial',
              matchId: matchId
            }));
          } catch (e) {
          }
        }
      });

      return {
        success: true,
        message: "Waiting for other player to accept",
        bothAccepted: false
      };
    }
  );

  // Start a match (after both players have accepted)
  fastify.post<{ Params: { tournamentId: string, matchId: string } }>(
    "/tournaments/:tournamentId/matches/:matchId/start",
    async (request, reply) => {
      const { tournamentId, matchId } = request.params;

      // Get the match
      const match = db.prepare(`
        SELECT id, status, player1_accepted, player2_accepted
        FROM tournament_matches
        WHERE id = ? AND tournament_id = ?
      `).get(matchId, tournamentId);

      if (!match) {
        return reply.status(404).send({ error: "Match not found" });
      }

      // Validate both players have accepted
      if (!match.player1_accepted || !match.player2_accepted) {
        return reply.status(400).send({
          error: "Both players must accept the match before it can start"
        });
      }

      // Validate match status is 'accepted'
      if (match.status !== 'accepted') {
        return reply.status(400).send({
          error: `Match cannot be started. Current status: ${match.status}`
        });
      }

      // Update match status to 'in_progress'
      db.prepare(`
        UPDATE tournament_matches 
        SET status = 'in_progress', started_at = ? 
        WHERE id = ?
      `).run(new Date().toISOString(), matchId);

      // Broadcast match start to all users
      const { activeConnections } = await import('../websocket/router');
      const allClientIds = Array.from(activeConnections.keys());
      allClientIds.forEach(clientId => {
        const connection = activeConnections.get(clientId);
        if (connection?.ws?.readyState === 1) {
          try {
            connection.ws.send(JSON.stringify({
              type: 'TOURNAMENT_UPDATED',
              tournamentId: tournamentId,
              action: 'match_started',
              matchId: matchId
            }));
          } catch (e) {
          }
        }
      });

      return {
        success: true,
        message: "Match started successfully"
      };
    }
  );

  // Save game result
  fastify.post<{ Params: { id: string }, Body: GameResultBody }>(
    "/tournaments/:id/game-result",
    async (request, reply) => {
      const { id } = request.params;
      const { player1Id, player2Id, winnerId, scores, tournamentMatchId } = request.body;

      // Verify tournament exists
      const tournament = db.prepare(`
        SELECT id, status FROM tournaments WHERE id = ?
      `).get(id);

      if (!tournament) {
        return reply.status(404).send({ error: "Tournament not found" });
      }

      if (tournament.status !== 'in_progress') {
        return reply.status(400).send({ error: "Tournament is not in progress" });
      }

      try {
        // Save game result to games table
        const gameResult = db.prepare(`
          INSERT INTO games (player1_id, player2_id, winner_id, score_player1, score_player2, game_type, tournament_match_id, created_at)
          VALUES (?, ?, ?, ?, ?, 'tournament', ?, ?)
        `).run(player1Id, player2Id, winnerId, scores[0], scores[1], tournamentMatchId, new Date().toISOString());

        const gameId = gameResult.lastInsertRowid;

        // If this is part of a tournament match, update the match
        if (tournamentMatchId) {
          db.prepare(`
            UPDATE tournament_matches 
            SET winner_id = ?, score_player1 = ?, score_player2 = ?, status = 'completed', completed_at = ?
            WHERE id = ?
          `).run(winnerId, scores[0], scores[1], new Date().toISOString(), tournamentMatchId);

          // Update tournament bracket and create next matches
          await updateTournamentBracket(id, tournamentMatchId, winnerId);
        }

        // Update user stats
        updateUserStats(player1Id, player2Id, winnerId);

        // Broadcast match completion to all users
        const { activeConnections } = await import('../websocket/router');
        const allClientIds = Array.from(activeConnections.keys());
        allClientIds.forEach(clientId => {
          const connection = activeConnections.get(clientId);
          if (connection?.ws?.readyState === 1) {
            try {
              connection.ws.send(JSON.stringify({
                type: 'TOURNAMENT_UPDATED',
                tournamentId: id,
                action: 'match_completed',
                matchId: tournamentMatchId,
                winnerId: winnerId
              }));
            } catch (e) {
            }
          }
        });

        return reply.send({
          success: true,
          gameId: gameId,
          message: "Game result recorded successfully"
        });

      } catch (error) {
        return reply.status(500).send({ error: "Failed to save game result" });
      }
    }
  );

  // Get tournament matches
  fastify.get("/tournaments/:id/matches", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    const matches = db.prepare(`
      SELECT 
        tm.id,
        tm.round_number as roundNumber,
        tm.match_number as matchNumber,
        tm.player1_id as player1Id,
        tm.player2_id as player2Id,
        tm.winner_id as winnerId,
        tm.score_player1 as scorePlayer1,
        tm.score_player2 as scorePlayer2,
        tm.status,
        tm.created_at as createdAt,
        tm.started_at as startedAt,
        tm.completed_at as completedAt,
        u1.username as player1Username,
        u2.username as player2Username,
        uw.username as winnerUsername
      FROM tournament_matches tm
      LEFT JOIN users u1 ON tm.player1_id = u1.id
      LEFT JOIN users u2 ON tm.player2_id = u2.id
      LEFT JOIN users uw ON tm.winner_id = uw.id
      WHERE tm.tournament_id = ?
      ORDER BY tm.round_number, tm.match_number
    `).all(id);

    return { matches };
  });

  // Delete tournament (creator or admin only, not during finals)
  fastify.delete("/tournaments/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;

    // Get user ID from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const token = authHeader.replace('Bearer ', '');
    let userId: number;
    let username: string;

    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me_in_production') as any;
      userId = decoded.userId;
      username = decoded.username;
    } catch (error) {
      return reply.status(401).send({ error: "Invalid token" });
    }

    // Get tournament to check ownership and status
    const tournament = db.prepare(`
      SELECT id, created_by, status, max_players FROM tournaments WHERE id = ?
    `).get(id);

    if (!tournament) {
      return reply.status(404).send({ error: "Tournament not found" });
    }

    // Check if user is creator or admin
    const isAdmin = username === 'admin';
    if (tournament.created_by !== userId && !isAdmin) {
      return reply.status(403).send({ error: "Only the creator can delete this tournament" });
    }

    // Get all matches for this tournament
    const matches = db.prepare(`
      SELECT id, round_number, status, player1_id, player2_id 
      FROM tournament_matches 
      WHERE tournament_id = ?
    `).all(id);

    // Check if tournament is in finals
    if (matches.length > 0) {
      const maxRound = Math.max(...matches.map((m: any) => m.round_number));
      const totalRounds = Math.ceil(Math.log2(tournament.max_players));
      const isFinals = maxRound === totalRounds;

      if (isFinals) {
        return reply.status(403).send({
          error: "Cannot delete tournament during finals",
          details: "Tournament is in the final round and cannot be deleted"
        });
      }
    }

    // Calculate and award points to all participants
    const players = db.prepare(`
      SELECT DISTINCT user_id as userId, username 
      FROM tournament_players tp
      JOIN users u ON tp.user_id = u.id
      WHERE tp.tournament_id = ?
    `).all(id);

    const pointsAwarded: { [userId: number]: number } = {};

    // Calculate highest round reached for each player
    players.forEach((player: any) => {
      const userId = player.userId;

      // Find all matches this player participated in
      const playerMatches = matches.filter((m: any) =>
        m.player1_id === userId || m.player2_id === userId
      );

      // Find highest round reached
      const maxRound = Math.max(...playerMatches.map((m: any) => m.round_number), 0);

      // Calculate points: Round 1 = 5, Round 2 = 5 + 10 = 15, Round 3 = 15 + 15 = 30
      let points = 0;
      for (let round = 1; round <= maxRound; round++) {
        points += 5 * round;
      }

      if (points > 0) {
        // Add points to user's total score
        db.prepare(`
          UPDATE users 
          SET tournament_points = COALESCE(tournament_points, 0) + ? 
          WHERE id = ?
        `).run(points, userId);

        pointsAwarded[userId] = points;
      }
    });

    // Notify active players via WebSocket (5 second countdown)
    const activeMatches = matches.filter((m: any) => m.status === 'in_progress');
    const playerIds = new Set<number>();
    activeMatches.forEach((match: any) => {
      if (match.player1_id) playerIds.add(match.player1_id);
      if (match.player2_id) playerIds.add(match.player2_id);
    });

    // Import sendToUser from WebSocket utils
    const { sendToUser } = await import('../websocket/router');

    // Send WebSocket notification to all active players
    playerIds.forEach(userId => {
      sendToUser(userId, {
        type: 'TOURNAMENT_DELETION_WARNING',
        tournamentId: id,
        countdown: 5,
        message: 'Tournament is being deleted by creator. Game will end in 5 seconds.'
      });
    });

    // Wait 5 seconds for notification
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete matches and tournament
    db.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?').run(id);
    db.prepare('DELETE FROM tournament_players WHERE tournament_id = ?').run(id);
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(id);

    // Broadcast tournament deletion to all connected users
    const { userConnections, activeConnections } = await import('../websocket/router');
    const allClientIds = Array.from(activeConnections.keys());
    allClientIds.forEach(clientId => {
      const connection = activeConnections.get(clientId);
      if (connection?.ws?.readyState === 1) {
        try {
          connection.ws.send(JSON.stringify({
            type: 'TOURNAMENT_UPDATED',
            tournamentId: id,
            action: 'deleted'
          }));
        } catch (e) {
        }
      }
    });
    return {
      success: true,
      message: "Tournament deleted",
      pointsAwarded
    };
  });
}

// Helper functions
function generateSingleEliminationBracket(players: any[]): any[] {
  const matches = [];
  const numPlayers = players.length;
  const numRounds = Math.ceil(Math.log2(numPlayers));

  // First round matches
  let globalMatchId = 1; // For database ID purposes only
  for (let i = 0; i < numPlayers; i += 2) {
    const player1 = players[i];
    const player2 = i + 1 < numPlayers ? players[i + 1] : null; // null for bye

    const matchNumber = Math.floor(i / 2) + 1; // Match number within this round

    matches.push({
      roundNumber: 1,
      matchNumber: matchNumber,
      player1Id: player1.id,
      player2Id: player2?.id || null
    });
    globalMatchId++;
  }

  // Subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = Math.pow(2, numRounds - round);

    for (let i = 0; i < matchesInRound; i++) {
      const matchNumber = i + 1; // Match number within this round (1, 2, 3, etc.)

      matches.push({
        roundNumber: round,
        matchNumber: matchNumber,
        player1Id: null, // Will be filled by winners
        player2Id: null
      });
      globalMatchId++;
    }
  }

  return matches;
}

async function updateTournamentBracket(tournamentId: string, completedMatchId: string, winnerId: string): Promise<void> {
  // Get the completed match
  const completedMatch = db.prepare(`
    SELECT round_number, match_number FROM tournament_matches 
    WHERE id = ?
  `).get(completedMatchId);

  if (!completedMatch) return;

  const { round_number, match_number } = completedMatch;

  // Find the next match in the bracket
  const nextRound = round_number + 1;
  const nextMatchNumber = Math.ceil(match_number / 2);

  const nextMatch = db.prepare(`
    SELECT id, player1_id, player2_id FROM tournament_matches
    WHERE tournament_id = ? AND round_number = ? AND match_number = ?
  `).get(tournamentId, nextRound, nextMatchNumber);

  if (nextMatch) {
    // Determine which slot to fill (even matches go to player1, odd to player2)
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

    // Check if tournament is complete
    const finalMatch = db.prepare(`
      SELECT id, winner_id FROM tournament_matches
      WHERE tournament_id = ? AND round_number = ? AND match_number = 1
    `).get(tournamentId, nextRound, 1);

    if (finalMatch?.winner_id) {
      // Tournament complete!
      db.prepare(`
        UPDATE tournaments SET status = 'completed', completed_at = ? WHERE id = ?
      `).run(new Date().toISOString(), tournamentId);
    }
  }
}

function updateUserStats(player1Id: string, player2Id: string, winnerId: string): void {
  // Update or insert player1 stats
  const player1Current = db.prepare(`
    SELECT * FROM user_stats WHERE user_id = ?
  `).get(player1Id);

  if (player1Current) {
    db.prepare(`
      UPDATE user_stats SET 
        total_games = total_games + 1,
        wins = wins + ?,
        losses = losses + ?,
        total_points_scored = total_points_scored + ?,
        total_points_conceded = total_points_conceded + ?,
        updated_at = ?
      WHERE user_id = ?
    `).run(
      winnerId === player1Id ? 1 : 0,
      winnerId === player1Id ? 0 : 1,
      0, // You might want to track actual points scored
      0, // You might want to track actual points conceded
      new Date().toISOString(),
      player1Id
    );
  } else {
    db.prepare(`
      INSERT INTO user_stats (user_id, total_games, wins, losses, total_points_scored, total_points_conceded, updated_at)
      VALUES (?, 1, ?, ?, 0, 0, ?)
    `).run(
      player1Id,
      winnerId === player1Id ? 1 : 0,
      winnerId === player1Id ? 0 : 1,
      new Date().toISOString()
    );
  }

  // Update or insert player2 stats
  const player2Current = db.prepare(`
    SELECT * FROM user_stats WHERE user_id = ?
  `).get(player2Id);

  if (player2Current) {
    db.prepare(`
      UPDATE user_stats SET 
        total_games = total_games + 1,
        wins = wins + ?,
        losses = losses + ?,
        total_points_scored = total_points_scored + ?,
        total_points_conceded = total_points_conceded + ?,
        updated_at = ?
      WHERE user_id = ?
    `).run(
      winnerId === player2Id ? 1 : 0,
      winnerId === player2Id ? 0 : 1,
      0, // You might want to track actual points scored
      0, // You might want to track actual points conceded
      new Date().toISOString(),
      player2Id
    );
  } else {
    db.prepare(`
      INSERT INTO user_stats (user_id, total_games, wins, losses, total_points_scored, total_points_conceded, updated_at)
      VALUES (?, 1, ?, ?, 0, 0, ?)
    `).run(
      player2Id,
      winnerId === player2Id ? 1 : 0,
      winnerId === player2Id ? 0 : 1,
      new Date().toISOString()
    );
  }
}