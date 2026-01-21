/**
 * Core Pong Game Engine
 * Handles game physics, rendering, and player controls
 */

export class PongGame {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected gameState: GameState;
  protected keys: Set<string> = new Set();
  private animationFrameId: number = 0;
  protected onScoreUpdate?: (scores: [number, number]) => void;
  protected onGameEnd?: (winner: number) => void;

  // Collision prevention
  private lastCollisionTime: number = 0;
  private readonly COLLISION_COOLDOWN = 100; // ms

  // Speed limits
  private readonly MAX_BALL_SPEED = 15;
  private readonly MIN_BALL_SPEED = 5;

  // Event handler references for cleanup
  private handleKeyDown = (e: KeyboardEvent) => {
    // Don't capture keys when user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    // Prevent default behavior for game control keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 's', 'S'].includes(e.key)) {
      e.preventDefault();
    }
    this.keys.add(e.key);
    this.updatePaddleVelocities();
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    // Don't capture keys when user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    // Prevent default behavior for game control keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 's', 'S'].includes(e.key)) {
      e.preventDefault();
    }
    this.keys.delete(e.key);
    this.updatePaddleVelocities();
  };

  private handleResize = () => {
    this.resizeCanvas();
  };

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }
    this.canvas = canvas;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;

    this.gameState = this.initializeGameState();
    this.setupEventListeners();
    this.resizeCanvas();
  }

  protected initializeGameState(): GameState {
    const width = this.canvas.width || 800;
    const height = this.canvas.height || 600;

    return {
      ball: {
        x: width / 2,
        y: height / 2,
        radius: 8,
        velocityX: this.MIN_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
        velocityY: 3 * (Math.random() > 0.5 ? 1 : -1)
      },
      paddles: [
        { // Player 1 (left)
          x: 20,
          y: height / 2 - 50,
          width: 10,
          height: 100,
          velocityY: 0,
          speed: 5
        },
        { // Player 2 (right)
          x: width - 30,
          y: height / 2 - 50,
          width: 10,
          height: 100,
          velocityY: 0,
          speed: 5
        }
      ],
      scores: [0, 0],
      state: GameStateEnum.READY,
      maxScore: 5
    };
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('resize', this.handleResize);
  }

  private updatePaddleVelocities(): void {
    // Player 1: W/S keys
    if (this.keys.has('w') || this.keys.has('W')) {
      this.gameState.paddles[0].velocityY = -this.gameState.paddles[0].speed;
    } else if (this.keys.has('s') || this.keys.has('S')) {
      this.gameState.paddles[0].velocityY = this.gameState.paddles[0].speed;
    } else {
      this.gameState.paddles[0].velocityY = 0;
    }

    // Player 2: Arrow Up/Down keys
    if (this.keys.has('ArrowUp')) {
      this.gameState.paddles[1].velocityY = -this.gameState.paddles[1].speed;
    } else if (this.keys.has('ArrowDown')) {
      this.gameState.paddles[1].velocityY = this.gameState.paddles[1].speed;
    } else {
      this.gameState.paddles[1].velocityY = 0;
    }
  }

  private resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;

    this.canvas.width = container.clientWidth;
    this.canvas.height = Math.min(container.clientHeight, 600);

    // Reposition game elements proportionally
    if (oldWidth > 0 && oldHeight > 0) {
      const scaleX = this.canvas.width / oldWidth;
      const scaleY = this.canvas.height / oldHeight;

      this.gameState.ball.x *= scaleX;
      this.gameState.ball.y *= scaleY;

      this.gameState.paddles.forEach((paddle, index) => {
        paddle.y *= scaleY;
        if (index === 1) {
          paddle.x = this.canvas.width - 30; // Reposition right paddle
        }
      });
    }
  }

  start(): void {
    if (this.gameState.state === GameStateEnum.PLAYING) return;

    this.gameState.state = GameStateEnum.PLAYING;
    this.gameLoop();
  }

  stop(): void {
    this.gameState.state = GameStateEnum.PAUSED;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  pause(): void {
    if (this.gameState.state === GameStateEnum.PLAYING) {
      this.stop();
    }
  }

  resume(): void {
    if (this.gameState.state === GameStateEnum.PAUSED) {
      this.start();
    }
  }

  reset(): void {
    this.stop();
    this.gameState = this.initializeGameState();
    this.lastCollisionTime = 0;
    this.draw();
  }

  cleanup(): void {
    this.stop();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.handleResize);
    this.keys.clear();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private gameLoop = (): void => {
    if (this.gameState.state !== GameStateEnum.PLAYING) return;

    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  protected update(): void {
    this.updatePaddles();
    this.updateBall();
    this.checkCollisions();
    this.checkScore();
  }

  protected updatePaddles(): void {
    this.gameState.paddles.forEach(paddle => {
      paddle.y += paddle.velocityY;

      // Keep paddles within canvas bounds
      paddle.y = Math.max(0, Math.min(this.canvas.height - paddle.height, paddle.y));
    });
  }

  protected updateBall(): void {
    const { ball } = this.gameState;

    ball.x += ball.velocityX;
    ball.y += ball.velocityY;

    // Top/bottom wall collision
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.velocityY = Math.abs(ball.velocityY);
    } else if (ball.y + ball.radius >= this.canvas.height) {
      ball.y = this.canvas.height - ball.radius;
      ball.velocityY = -Math.abs(ball.velocityY);
    }
  }

  private checkCollisions(): void {
    const { ball, paddles } = this.gameState;
    const now = Date.now();

    // Prevent rapid collisions (ball getting stuck)
    if (now - this.lastCollisionTime < this.COLLISION_COOLDOWN) {
      return;
    }

    paddles.forEach((paddle, index) => {
      if (this.isBallCollidingWithPaddle(ball, paddle)) {
        // Reverse horizontal direction
        ball.velocityX *= -1;

        // Position ball outside paddle to prevent sticking
        if (index === 0) {
          // Left paddle - push ball to the right
          ball.x = paddle.x + paddle.width + ball.radius;
        } else {
          // Right paddle - push ball to the left
          ball.x = paddle.x - ball.radius;
        }

        // Add angle based on where the ball hits the paddle
        const paddleCenter = paddle.y + paddle.height / 2;
        const hitPosition = (ball.y - paddleCenter) / (paddle.height / 2);
        ball.velocityY = hitPosition * 6;

        // Increase speed with cap
        const currentSpeed = Math.sqrt(ball.velocityX ** 2 + ball.velocityY ** 2);
        if (currentSpeed < this.MAX_BALL_SPEED) {
          const speedMultiplier = 1.05;
          ball.velocityX *= speedMultiplier;
          ball.velocityY *= speedMultiplier;
        } else {
          // Normalize to max speed
          const angle = Math.atan2(ball.velocityY, ball.velocityX);
          ball.velocityX = Math.cos(angle) * this.MAX_BALL_SPEED;
          ball.velocityY = Math.sin(angle) * this.MAX_BALL_SPEED;
        }

        this.lastCollisionTime = now;
      }
    });
  }

  private isBallCollidingWithPaddle(ball: Ball, paddle: Paddle): boolean {
    return ball.x - ball.radius < paddle.x + paddle.width &&
      ball.x + ball.radius > paddle.x &&
      ball.y - ball.radius < paddle.y + paddle.height &&
      ball.y + ball.radius > paddle.y;
  }

  protected checkScore(): void {
    const { ball, scores } = this.gameState;

    // Player 2 scores (ball went past left paddle)
    if (ball.x - ball.radius <= 0) {
      scores[1]++;
      this.onScoreUpdate?.(scores as [number, number]);
      this.resetBall();
      this.checkGameEnd();
    }
    // Player 1 scores (ball went past right paddle)
    else if (ball.x + ball.radius >= this.canvas.width) {
      scores[0]++;
      this.onScoreUpdate?.(scores as [number, number]);
      this.resetBall();
      this.checkGameEnd();
    }
  }

  private resetBall(): void {
    const { ball } = this.gameState;

    ball.x = this.canvas.width / 2;
    ball.y = this.canvas.height / 2;
    ball.velocityX = this.MIN_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    ball.velocityY = 3 * (Math.random() > 0.5 ? 1 : -1);

    this.lastCollisionTime = 0;
  }

  protected checkGameEnd(): void {
    const { scores, maxScore } = this.gameState;

    if (scores[0] >= maxScore || scores[1] >= maxScore) {
      const winner = scores[0] >= maxScore ? 0 : 1;
      this.gameState.state = GameStateEnum.ENDED;
      this.stop();
      this.onGameEnd?.(winner);
    }
  }

  private draw(): void {
    // Clear canvas
    this.ctx.fillStyle = '#0f172a'; // slate-900
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw center line
    this.ctx.strokeStyle = '#334155'; // slate-700
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 15]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2, 0);
    this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw paddles
    this.gameState.paddles.forEach((paddle, index) => {
      this.ctx.fillStyle = index === 0 ? '#3b82f6' : '#ef4444'; // blue-500 vs red-500
      this.ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    });

    // Draw ball
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(this.gameState.ball.x, this.gameState.ball.y, this.gameState.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw scores
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.gameState.scores[0].toString(), this.canvas.width / 4, 60);
    this.ctx.fillText(this.gameState.scores[1].toString(), (this.canvas.width / 4) * 3, 60);
  }

  // Public API methods
  onScore(callback: (scores: [number, number]) => void): void {
    this.onScoreUpdate = callback;
  }

  onGameOver(callback: (winner: number) => void): void {
    this.onGameEnd = callback;
  }

  getScores(): [number, number] {
    return [...this.gameState.scores] as [number, number];
  }

  setMaxScore(maxScore: number): void {
    this.gameState.maxScore = maxScore;
  }

  getState(): GameStateEnum {
    return this.gameState.state;
  }
}

// Type definitions
export enum GameStateEnum {
  READY = 'READY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED'
}

interface GameState {
  ball: Ball;
  paddles: Paddle[];
  scores: number[];
  state: GameStateEnum;
  maxScore: number;
}

export interface Ball {
  x: number;
  y: number;
  radius: number;
  velocityX: number;
  velocityY: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  speed: number;
}