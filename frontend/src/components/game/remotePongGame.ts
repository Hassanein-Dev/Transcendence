import { PongGame } from './pongGame';
import { chatService } from '../../services/socket';

export class RemotePongGame extends PongGame {
  private roomId: string | null = null;
  private playerNumber: number = 0;
  private opponentId: string | null = null;
  private isHost: boolean = false;

  constructor(canvasId: string, roomId?: string, playerNumber?: number) {
    super(canvasId);
    
    if (roomId && playerNumber !== undefined) {
      this.roomId = roomId;
      this.playerNumber = playerNumber;
      this.setupRemoteHandlers();
    }
  }

  // Create a new remote game and invite another user
  createRemoteGame(targetUserId: string) {
    this.isHost = true;
    this.roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.playerNumber = 0;

    chatService.send({
      type: 'REMOTE_GAME_CREATE',
      targetUserId,
      roomId: this.roomId
    });

    this.setupRemoteHandlers();
  }

  // Join an existing remote game
  joinRemoteGame(roomId: string, playerNumber: number) {
    this.roomId = roomId;
    this.playerNumber = playerNumber;
    this.setupRemoteHandlers();
  }

  private setupRemoteHandlers() {
    // Listen for remote game events
    chatService.onMessage((data) => {
      if (!this.roomId || data.roomId !== this.roomId) return;

      switch (data.type) {
        case 'PADDLE_UPDATE':
          this.handleRemotePaddleUpdate(data.playerNumber, data.paddleY);
          break;
        case 'BALL_UPDATE':
          this.handleRemoteBallUpdate(data.ball);
          break;
        case 'SCORE_UPDATE':
          this.handleRemoteScoreUpdate(data.scores);
          break;
        case 'GAME_ENDED':
          this.handleRemoteGameEnded(data.winner);
          break;
      }
    });
  }

  // Override parent methods to send updates to remote player
  protected updatePaddles(): void {
    super.updatePaddles();
    
    // Send paddle position to remote player
    if (this.roomId && this.gameState.isPlaying) {
      const paddleY = this.gameState.paddles[this.playerNumber].y;
      
      chatService.send({
        type: 'PADDLE_POSITION',
        roomId: this.roomId,
        playerNumber: this.playerNumber,
        paddleY: paddleY
      });
    }
  }

  protected updateBall(): void {
    super.updateBall();
    
    // Host sends ball state to other player
    if (this.roomId && this.isHost && this.gameState.isPlaying) {
      chatService.send({
        type: 'BALL_STATE',
        roomId: this.roomId,
        ballState: this.gameState.ball
      });
    }
  }

  protected checkScore(): void {
    const previousScores = [...this.gameState.scores];
    super.checkScore();
    
    // Send score updates if they changed
    if (this.roomId && this.isHost && 
        (previousScores[0] !== this.gameState.scores[0] || 
         previousScores[1] !== this.gameState.scores[1])) {
      
      chatService.send({
        type: 'SCORE_UPDATE',
        roomId: this.roomId,
        scores: this.gameState.scores
      });
    }
  }

  protected checkGameEnd(): void {
    super.checkGameEnd();
    
    // Host notifies when game ends
    if (this.roomId && this.isHost && this.gameState.scores.some(score => score >= this.gameState.maxScore)) {
      const winner = this.gameState.scores[0] >= this.gameState.maxScore ? 0 : 1;
      
      chatService.send({
        type: 'GAME_ENDED',
        roomId: this.roomId,
        winner: winner
      });
    }
  }

  private handleRemotePaddleUpdate(playerNumber: number, paddleY: number) {
    // Update opponent's paddle
    if (playerNumber !== this.playerNumber) {
      this.gameState.paddles[playerNumber].y = paddleY;
    }
  }

  private handleRemoteBallUpdate(ballState: any) {
    // Update ball state from host
    if (!this.isHost) {
      this.gameState.ball = ballState;
    }
  }

  private handleRemoteScoreUpdate(scores: [number, number]) {
    // Update scores from host
    if (!this.isHost) {
      this.gameState.scores = scores;
    }
  }

  private handleRemoteGameEnded(winner: number) {
    this.stop();
    this.onGameEnd?.(winner);
  }

  // Clean up when game ends
  stop(): void {
    super.stop();
  }
}