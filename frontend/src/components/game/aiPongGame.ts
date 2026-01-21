/**
 * AI Pong Game
 * Extends PongGame with AI opponent functionality
 * 
 * AI Implementation Details:
 * - Simulates keyboard input (ArrowUp/ArrowDown)
 * - Refreshes game view once per second (configurable by difficulty)
 * - Uses trajectory prediction algorithm to anticipate ball bounces
 * - Implements strategic decision-making based on game state snapshots
 * - Adds human-like imperfection and reaction delays
 * 
 * Algorithm: Predictive Trajectory Analysis with Snapshot-Based Decision Making
 * - Takes a snapshot of game state once per second
 * - Predicts ball trajectory including wall bounces
 * - Calculates optimal intercept position
 * - Simulates keyboard input to move paddle towards target
 * - Adapts strategy based on ball direction and game situation
 */

import { PongGame, Ball, Paddle, GameStateEnum } from './pongGame';

export class AIPongGame extends PongGame {
  private aiActive: boolean = false;
  private aiDifficulty: AIDifficulty = 'medium';
  private lastAIViewRefresh: number = 0;
  private aiViewRefreshInterval: number = 1000; // AI can only "see" game once per second
  
  // AI's snapshot of the game state (updated once per second)
  private aiGameSnapshot: {
    ball: { x: number; y: number; velocityX: number; velocityY: number };
    paddle: { y: number };
    timestamp: number;
  } | null = null;

  // Current AI decision based on snapshot
  private currentAIDecision: {
    targetY: number;
    keyPressed: 'ArrowUp' | 'ArrowDown' | null;
    confidence: number;
  } = {
    targetY: 0,
    keyPressed: null,
    confidence: 0
  };

  // AI configuration
  private readonly AI_CONFIG = {
    easy: {
      viewRefreshRate: 1000,     // AI sees game once per second (strict rule compliance)
      imperfection: 400,          // High position error - very beatable
      predictionDepth: 2,        // Predicts 2 bounces
      reactionDelay: 85,        // Slower to react
      defensiveOffset: 50        // How far from center when defending
    },
    medium: {
      viewRefreshRate: 1000,     // AI sees game once per second (strict rule compliance)
      imperfection: 250,          // Moderate position error - balanced difficulty
      predictionDepth: 3,        // Predicts up to 3 bounces
      reactionDelay: 50,         // Moderate reaction
      defensiveOffset: 30        // Closer to center
    },
    hard: {
      viewRefreshRate: 1000,     // AI sees game once per second (strict rule compliance)
      imperfection: 10,          // Low position error - challenging but beatable
      predictionDepth: 4,        // Predicts up to 4 bounces
      reactionDelay: 20,         // Fast reaction
      defensiveOffset: 10        // Very close to center
    }
  };

  constructor(canvasId: string, difficulty: AIDifficulty = 'medium') {
    super(canvasId);
    this.setAIDifficulty(difficulty);
  }

  setAIDifficulty(difficulty: AIDifficulty): void {
    this.aiDifficulty = difficulty;
    const config = this.AI_CONFIG[difficulty];
    this.aiViewRefreshInterval = config.viewRefreshRate;
  }

  startAIOpponent(): void {
    this.aiActive = true;
    this.lastAIViewRefresh = Date.now();
    this.aiGameSnapshot = null;
    }

  stopAIOpponent(): void {
    this.aiActive = false;
    // Release any AI keyboard inputs
    this.releaseAIKeys();
  }

  protected update(): void {
    super.update();

    if (this.aiActive && this.gameState.state === GameStateEnum.PLAYING) {
      this.updateAI();
    }
  }

  /**
   * Main AI update loop
   * - Refreshes AI's view of the game once per second (strict compliance)
   * - Makes decisions based on snapshot
   * - Simulates keyboard input
   */
  private updateAI(): void {
    const now = Date.now();

    // Refresh AI's view of the game once per second
    if (now - this.lastAIViewRefresh >= this.aiViewRefreshInterval) {
      this.refreshAIView();
      this.makeStrategicDecision();
      this.lastAIViewRefresh = now;
    }

    // Execute current decision by simulating keyboard input
    this.executeAIDecision();
  }

  /**
   * Refresh AI's snapshot of the game state
   * This simulates the constraint that AI can only "see" the game once per second
   */
  private refreshAIView(): void {
    const ball = this.gameState.ball;
    const aiPaddle = this.gameState.paddles[1];

    this.aiGameSnapshot = {
      ball: {
        x: ball.x,
        y: ball.y,
        velocityX: ball.velocityX,
        velocityY: ball.velocityY
      },
      paddle: {
        y: aiPaddle.y
      },
      timestamp: Date.now()
    };
  }

  /**
   * Strategic decision-making based on game snapshot
   * 
   * Algorithm:
   * 1. Analyze ball direction and position from snapshot
   * 2. If ball approaching: predict intercept point using trajectory analysis
   * 3. If ball moving away: return to defensive center position
   * 4. Add difficulty-based imperfection to simulate human error
   * 5. Calculate confidence level for decision
   */
  private makeStrategicDecision(): void {
    if (!this.aiGameSnapshot) return;

    const config = this.AI_CONFIG[this.aiDifficulty];
    const snapshot = this.aiGameSnapshot;
    const aiPaddle = this.gameState.paddles[1];
    const paddleCenter = aiPaddle.y + aiPaddle.height / 2;

    let targetY: number;
    let confidence: number;

    // Strategic decision based on ball direction
    if (snapshot.ball.velocityX > 0) {
      // Ball is approaching AI - calculate intercept position
      targetY = this.predictBallIntercept(snapshot.ball, config.predictionDepth);
      confidence = 0.8 + (Math.random() * 0.2); // 80-100% confidence when attacking
      // confidence = 1;
      // Add human-like imperfection (higher difficulty = less error)
      const imperfection = (Math.random() - 0.5) * config.imperfection;
      targetY += imperfection;
      } else {
      // Ball moving away - strategic defensive positioning
      const centerY = this.canvas.height / 2;
      
      // Analyze where ball is likely to return from
      // If ball is high, position slightly high; if low, position slightly low
      const ballYNormalized = snapshot.ball.y / this.canvas.height;
      const defensiveAdjustment = (ballYNormalized - 0.5) * config.defensiveOffset;
      
      targetY = centerY + defensiveAdjustment;
      confidence = 0.5 + (Math.random() * 0.2); // 50-70% confidence when defending
    }

    // Ensure target is within valid bounds
    const paddleHalfHeight = aiPaddle.height / 2;
    targetY = Math.max(paddleHalfHeight, Math.min(this.canvas.height - paddleHalfHeight, targetY));

    // Determine which key to press based on current position vs target
    let keyToPress: 'ArrowUp' | 'ArrowDown' | null = null;
    const distance = targetY - paddleCenter;
    const movementThreshold = 10; // Higher threshold to prevent jittering and reduce precision

    if (Math.abs(distance) > movementThreshold) {
      keyToPress = distance < 0 ? 'ArrowUp' : 'ArrowDown';
    }

    // Store decision
    this.currentAIDecision = {
      targetY,
      keyPressed: keyToPress,
      confidence
    };
  }

  /**
   * Predict where the ball will be when it reaches the AI paddle
   * Uses physics-based trajectory prediction with bounce simulation
   * 
   * @param ball - Current ball state from snapshot
   * @param maxBounces - Maximum number of wall bounces to predict (based on difficulty)
   * @returns Predicted Y position where ball will cross AI paddle line
   */
  private predictBallIntercept(ball: { x: number; y: number; velocityX: number; velocityY: number }, maxBounces: number): number {
    const aiPaddle = this.gameState.paddles[1];
    const paddleX = aiPaddle.x;
    const gameHeight = this.canvas.height;

    // Calculate time for ball to reach paddle's X position
    const distanceX = paddleX - ball.x;
    
    if (distanceX <= 0 || ball.velocityX <= 0) {
      // Ball not approaching or already past paddle
      return this.canvas.height / 2;
    }

    const timeToReach = distanceX / ball.velocityX;
    
    // Simulate ball trajectory with wall bounces
    let currentY = ball.y;
    let currentVelocityY = ball.velocityY;
    let remainingTime = timeToReach;
    let bounces = 0;

    // Physics simulation with proper bounce handling
    while (remainingTime > 0 && bounces < maxBounces) {
      // Calculate where ball would be without bouncing
      const nextY = currentY + currentVelocityY * remainingTime;

      // Check for wall collision
      if (nextY < 0) {
        // Bounce off top wall
        if (currentVelocityY === 0) break; // Avoid division by zero
        const timeToWall = Math.abs(currentY / currentVelocityY);
        if (timeToWall > remainingTime) break; // Won't reach wall in time
        
        currentY = 0;
        currentVelocityY = Math.abs(currentVelocityY); // Bounce down
        remainingTime -= timeToWall;
        bounces++;
      } else if (nextY > gameHeight) {
        // Bounce off bottom wall
        if (currentVelocityY === 0) break; // Avoid division by zero
        const timeToWall = Math.abs((gameHeight - currentY) / currentVelocityY);
        if (timeToWall > remainingTime) break; // Won't reach wall in time
        
        currentY = gameHeight;
        currentVelocityY = -Math.abs(currentVelocityY); // Bounce up
        remainingTime -= timeToWall;
        bounces++;
      } else {
        // No collision, ball reaches target
        currentY = nextY;
        remainingTime = 0;
      }
    }

    // Clamp to valid range
    const finalY = Math.max(0, Math.min(gameHeight, currentY));
    return finalY;
  }

  /**
   * Execute AI decision by simulating keyboard input
   * This is the key requirement: AI uses keyboard input, not direct paddle control
   * 
   * Key improvement: Even though AI only makes decisions once per second,
   * it checks EVERY FRAME whether it has reached its target position.
   * This prevents overshooting and endless up/down movement.
   */
  private executeAIDecision(): void {
    const decision = this.currentAIDecision;
    const aiPaddle = this.gameState.paddles[1];
    const paddleCenter = aiPaddle.y + aiPaddle.height / 2;

    // Release previous AI keys
    this.releaseAIKeys();

    // Check if we need to keep moving toward target
    // This is checked every frame to prevent overshooting
    const distance = decision.targetY - paddleCenter;
    const movementThreshold = 10; // Stop when within 10 pixels of target (prevents jittering)

    if (Math.abs(distance) > movementThreshold) {
      // Not at target yet - determine which key to press
      const keyToPress = distance < 0 ? 'ArrowUp' : 'ArrowDown';
      
      // Simulate keyboard press
      this.keys.add(keyToPress);
      
      // The paddle movement is handled by updatePaddles() just like player input
    }
    // If within threshold, keys remain released (paddle stops)
  }

  /**
   * Release all AI keyboard inputs
   */
  private releaseAIKeys(): void {
    this.keys.delete('ArrowUp');
    this.keys.delete('ArrowDown');
  }

  /**
   * Update paddles - AI now uses keyboard input just like the player
   * This ensures AI obeys the same physics and movement rules
   */
  protected updatePaddles(): void {
    const playerPaddle = this.gameState.paddles[0];
    const aiPaddle = this.gameState.paddles[1];

    // Update player paddle (keyboard controlled)
    if (this.keys.has('w') || this.keys.has('W')) {
      playerPaddle.velocityY = -playerPaddle.speed;
    } else if (this.keys.has('s') || this.keys.has('S')) {
      playerPaddle.velocityY = playerPaddle.speed;
    } else {
      playerPaddle.velocityY = 0;
    }

    // AI paddle - controlled by simulated keyboard input
    // This is the key requirement: AI uses keyboard input, not direct control
    if (this.keys.has('ArrowUp')) {
      aiPaddle.velocityY = -aiPaddle.speed;
    } else if (this.keys.has('ArrowDown')) {
      aiPaddle.velocityY = aiPaddle.speed;
    } else {
      aiPaddle.velocityY = 0;
    }

    // Apply movement and boundaries to both paddles
    [playerPaddle, aiPaddle].forEach(paddle => {
      paddle.y += paddle.velocityY;
      paddle.y = Math.max(0, Math.min(this.canvas.height - paddle.height, paddle.y));
    });
  }

  cleanup(): void {
    this.stopAIOpponent();
    super.cleanup();
  }

  reset(): void {
    this.stopAIOpponent();
    super.reset();
    if (this.aiActive) {
      this.startAIOpponent();
    }
  }
}

// Type definitions
export type AIDifficulty = 'easy' | 'medium' | 'hard';