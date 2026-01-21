import { PongGame } from "./pongGame";

export class TournamentGame {
  private pongGame: PongGame;
  private currentMatch: TournamentMatch | null = null;
  private onMatchComplete?: (winnerId: string, scores: [number, number]) => void;

  constructor(canvasId: string) {
    this.pongGame = new PongGame(canvasId);
    this.setupGameEvents();
  }

  private setupGameEvents(): void {
    this.pongGame.onScore((scores) => {
      // Update tournament match scores if active
      if (this.currentMatch) {
        this.currentMatch.scores = scores;
      }
    });

    this.pongGame.onGameOver((winner) => {
      if (this.currentMatch) {
        const winnerId = winner === 0 ? this.currentMatch.player1Id : this.currentMatch.player2Id;
        this.onMatchComplete?.(winnerId, this.currentMatch.scores);
        this.currentMatch = null;
      }
    });
  }

  startMatch(match: TournamentMatch): void {
    this.currentMatch = match;
    this.pongGame.setMaxScore(match.maxScore || 5);
    this.pongGame.reset();
    this.pongGame.start();
  }

  onMatchEnd(callback: (winnerId: string, scores: [number, number]) => void): void {
    this.onMatchComplete = callback;
  }

  stop(): void {
    this.pongGame.stop();
  }
}

export interface TournamentMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  scores: [number, number];
  maxScore?: number;
}