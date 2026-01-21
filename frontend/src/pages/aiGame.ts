/**
 * AI Pong Game Page
 * Single-player game against AI opponent with difficulty selection
 */

import { AIPongGame, AIDifficulty } from "../components/game/aiPongGame";
import { router } from "../router";

// Store cleanup function for proper resource management
let cleanupAIGame: (() => void) | null = null;

export function renderAIGame() {
  // Clean up previous instance
  if (cleanupAIGame) {
    cleanupAIGame();
    cleanupAIGame = null;
  }

  const app = document.getElementById("app")!;
  app.innerHTML = '';

  // Main container
  const root = createContainer();
  const container = createContentContainer();
  root.appendChild(container);

  // Header section
  container.appendChild(createHeader());

  // Game section
  const gameBox = createGameBox();
  container.appendChild(gameBox);

  // Info cards
  container.appendChild(createInfoCards());

  app.appendChild(root);

  // Initialize game after DOM is ready
  let aiGame: AIPongGame | null = null;

  setTimeout(() => {
    try {
      const difficulty = getDifficulty();
      aiGame = new AIPongGame('aiPongCanvas', difficulty);
      setupGameCallbacks(aiGame);
      setupEventListeners(aiGame);

      // Setup cleanup
      cleanupAIGame = () => {
        if (aiGame) {
          aiGame.cleanup();
          aiGame = null;
        }
      };

    } catch (error) {
      showError('Failed to load game. Please refresh the page.');
    }
  }, 100);
}

// ============================================================================
// DOM Creation Helpers
// ============================================================================

function createContainer(): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 relative pb-8 px-4';

  // Animated background
  const bg = document.createElement('div');
  bg.className = 'absolute inset-0 overflow-hidden pointer-events-none';

  const radial = document.createElement('div');
  radial.className = 'absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent';

  const blurCircle = document.createElement('div');
  blurCircle.className = 'absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl';

  bg.appendChild(radial);
  bg.appendChild(blurCircle);
  root.appendChild(bg);

  return root;
}

function createContentContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'max-w-6xl mx-auto relative';
  return container;
}

function createHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'mb-8';

  const headerContent = document.createElement('div');
  headerContent.className = 'flex justify-between items-center mb-6';

  // Title
  const titleDiv = document.createElement('div');
  const h1 = document.createElement('h1');
  h1.className = 'text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent flex items-center space-x-3';
  
  const emoji = document.createElement('span');
  emoji.textContent = '🤖';
  
  const titleText = document.createElement('span');
  titleText.textContent = 'AI Challenge';
  
  h1.appendChild(emoji);
  h1.appendChild(titleText);

  const p = document.createElement('p');
  p.className = 'text-gray-400 mt-2';
  p.textContent = 'Test your skills against our intelligent Pong AI';

  titleDiv.appendChild(h1);
  titleDiv.appendChild(p);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.id = 'backBtn';
  backBtn.className = 'px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-bold rounded-xl border border-gray-600 hover:border-gray-500 transition-all duration-300 transform hover:-translate-y-0.5';
  backBtn.textContent = '← Back to Menu';

  headerContent.appendChild(titleDiv);
  headerContent.appendChild(backBtn);
  header.appendChild(headerContent);

  return header;
}

function createGameBox(): HTMLDivElement {
  const gameBox = document.createElement('div');
  gameBox.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-2xl mb-8';

  // Game info header
  gameBox.appendChild(createGameInfo());

  // Canvas wrapper
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'relative';

  const canvasInner = document.createElement('div');
  canvasInner.className = 'aspect-video bg-gradient-to-b from-gray-900 to-black rounded-2xl border-2 border-gray-700 overflow-hidden shadow-inner';

  const canvas = document.createElement('canvas');
  canvas.id = 'aiPongCanvas';
  canvas.className = 'w-full h-full';

  canvasInner.appendChild(canvas);
  canvasWrap.appendChild(canvasInner);

  // Game message overlay
  const gameMsg = document.createElement('div');
  gameMsg.id = 'gameMessage';
  gameMsg.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none';

  canvasWrap.appendChild(gameMsg);
  gameBox.appendChild(canvasWrap);

  // Controls
  gameBox.appendChild(createControls());

  return gameBox;
}

function createGameInfo(): HTMLDivElement {
  const gameHeader = document.createElement('div');
  gameHeader.className = 'flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl border border-purple-500/20';

  // Player info
  const playerDiv = createPlayerInfo('👤 Player', 'W/S Keys', 'from-blue-400 to-cyan-300');

  // Score
  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'text-center';

  const scoreDisplay = document.createElement('div');
  scoreDisplay.id = 'scoreDisplay';
  scoreDisplay.className = 'text-4xl font-bold text-white';
  scoreDisplay.textContent = '0 - 0';

  const scoreSub = document.createElement('div');
  scoreSub.className = 'text-sm text-gray-400 mt-1';
  scoreSub.textContent = 'First to 5 points wins 🏆';

  scoreDiv.appendChild(scoreDisplay);
  scoreDiv.appendChild(scoreSub);

  // AI info
  const aiDiv = document.createElement('div');
  aiDiv.className = 'text-center';

  const aiLabel = document.createElement('div');
  aiLabel.className = 'text-sm text-gray-400 mb-1';
  aiLabel.textContent = '🤖 AI Opponent';

  const aiDiff = document.createElement('div');
  aiDiff.id = 'aiDifficulty';
  aiDiff.className = 'text-lg font-semibold bg-gradient-to-r from-red-400 to-orange-300 bg-clip-text text-transparent';
  aiDiff.textContent = 'Medium';

  aiDiv.appendChild(aiLabel);
  aiDiv.appendChild(aiDiff);

  gameHeader.appendChild(playerDiv);
  gameHeader.appendChild(scoreDiv);
  gameHeader.appendChild(aiDiv);

  return gameHeader;
}

function createPlayerInfo(label: string, keys: string, gradient: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'text-center';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'text-sm text-gray-400 mb-1';
  labelDiv.textContent = label;

  const keysDiv = document.createElement('div');
  keysDiv.className = `text-lg font-semibold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`;
  keysDiv.textContent = keys;

  div.appendChild(labelDiv);
  div.appendChild(keysDiv);

  return div;
}

function createControls(): HTMLDivElement {
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'mt-6 flex flex-wrap justify-center gap-4';

  // Start button
  const startBtn = createControlButton('startBtn', '🎮', 'Start Game', 'from-emerald-500 to-green-600');

  // Pause button
  const pauseBtn = createControlButton('pauseBtn', '⏸️', 'Pause', 'from-yellow-500 to-amber-600', true);

  // Difficulty selector
  const diffWrap = createDifficultySelector();

  controlsDiv.appendChild(startBtn);
  controlsDiv.appendChild(pauseBtn);
  controlsDiv.appendChild(diffWrap);

  return controlsDiv;
}

function createDifficultySelector(): HTMLDivElement {
  const diffWrap = document.createElement('div');
  diffWrap.className = 'relative group';

  const diffBlur = document.createElement('div');
  diffBlur.className = 'absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200';

  const diffSelect = document.createElement('select');
  diffSelect.id = 'difficultySelect';
  diffSelect.className = 'relative px-6 py-3 bg-gray-800 border border-gray-700 text-white font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-300';

  const optEasy = document.createElement('option');
  optEasy.value = 'easy';
  optEasy.className = 'bg-gray-800';
  optEasy.textContent = '🥉 Easy';

  const optMed = document.createElement('option');
  optMed.value = 'medium';
  optMed.selected = true;
  optMed.className = 'bg-gray-800';
  optMed.textContent = '🥈 Medium';

  const optHard = document.createElement('option');
  optHard.value = 'hard';
  optHard.className = 'bg-gray-800';
  optHard.textContent = '🥇 Hard';

  diffSelect.appendChild(optEasy);
  diffSelect.appendChild(optMed);
  diffSelect.appendChild(optHard);

  diffWrap.appendChild(diffBlur);
  diffWrap.appendChild(diffSelect);

  return diffWrap;
}

function createInfoCards(): HTMLDivElement {
  const infoGrid = document.createElement('div');
  infoGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';

  infoGrid.appendChild(createHowToPlayCard());
  infoGrid.appendChild(createAIBehaviorCard());

  return infoGrid;
}

function createHowToPlayCard(): HTMLDivElement {
  const card = createCard('📚', 'How to Play');

  const ul = document.createElement('ul');
  ul.className = 'space-y-3 text-gray-300';

  const instructions = [
    { text: 'Use W and S keys to move your paddle', strong: 'W and S keys', color: 'text-blue-300' },
    { text: 'First player to score 5 points wins', strong: '5 points', color: 'text-emerald-300' },
    { text: 'AI simulates human reaction times', strong: 'human reaction times', color: 'text-purple-300' },
    { text: 'Adjust difficulty to challenge yourself', strong: 'challenge yourself', color: 'text-yellow-300' }
  ];

  instructions.forEach(item => {
    const li = createListItem('bg-blue-500', item.text, item.color, item.strong);
    ul.appendChild(li);
  });

  card.appendChild(ul);
  return card;
}

function createAIBehaviorCard(): HTMLDivElement {
  const card = createCard('⚡', 'AI Behavior');

  const bList = document.createElement('div');
  bList.className = 'space-y-4';

  const behaviors = [
    { label: 'Reaction Time', id: 'aiReactionTime', value: '1 second', color: 'text-cyan-300' },
    { label: 'Accuracy', id: 'aiAccuracy', value: 'Medium', color: 'text-emerald-300' },
    { label: 'Strategy', id: '', value: 'Ball prediction', color: 'text-purple-300' }
  ];

  behaviors.forEach(item => {
    const row = createBehaviorRow(item.label, item.value, item.color, item.id);
    bList.appendChild(row);
  });

  card.appendChild(bList);
  return card;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createControlButton(id: string, emoji: string, text: string, gradient: string, disabled: boolean = false): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.disabled = disabled;
  btn.className = `px-8 py-3 bg-gradient-to-r ${gradient} text-white font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed`;

  updateButtonContent(btn, emoji, text);

  return btn;
}

function updateButtonContent(btn: HTMLButtonElement, emoji: string, text: string): void {
  btn.textContent = '';
  const span = document.createElement('span');
  span.className = 'flex items-center space-x-2';

  const eSpan = document.createElement('span');
  eSpan.className = 'text-xl';
  eSpan.textContent = emoji;

  const tSpan = document.createElement('span');
  tSpan.textContent = text;

  span.appendChild(eSpan);
  span.appendChild(tSpan);
  btn.appendChild(span);
}

function createCard(emoji: string, title: string): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl';

  const h3 = document.createElement('h3');
  h3.className = 'text-xl font-bold text-white mb-4 flex items-center space-x-2';

  const icon = document.createElement('span');
  icon.textContent = emoji;

  const text = document.createElement('span');
  text.textContent = title;

  h3.appendChild(icon);
  h3.appendChild(text);
  card.appendChild(h3);

  return card;
}

function createListItem(dotColor: string, text: string, textColor: string, strongText: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'flex items-center space-x-3';

  const dot = document.createElement('div');
  dot.className = `w-2 h-2 ${dotColor} rounded-full`;

  const span = document.createElement('span');
  const parts = text.split(strongText);

  if (parts.length > 1) {
    span.appendChild(document.createTextNode(parts[0]));
    const strong = document.createElement('strong');
    strong.className = textColor;
    strong.textContent = strongText;
    span.appendChild(strong);
    span.appendChild(document.createTextNode(parts[1]));
  } else {
    span.textContent = text;
  }

  li.appendChild(dot);
  li.appendChild(span);

  return li;
}

function createBehaviorRow(label: string, value: string, color: string, id: string = ''): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'flex justify-between items-center p-3 bg-gray-800/30 rounded-xl';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'text-gray-400';
  labelSpan.textContent = label;

  const valueSpan = document.createElement('span');
  if (id) valueSpan.id = id;
  valueSpan.className = `font-bold ${color}`;
  valueSpan.textContent = value;

  row.appendChild(labelSpan);
  row.appendChild(valueSpan);

  return row;
}

// ============================================================================
// Game Setup
// ============================================================================

function setupGameCallbacks(game: AIPongGame): void {
  game.onScore((scores) => {
    const scoreDisplay = document.getElementById('scoreDisplay');
    if (scoreDisplay) {
      scoreDisplay.textContent = `${scores[0]} - ${scores[1]}`;
    }
  });

  game.onGameOver((winner) => {
    const winnerText = winner === 0 ? 'You Win! 🎉' : 'AI Wins! 🤖';
    const emoji = winner === 0 ? '🏆' : '🤖';
    const message = winner === 0 ? 'Amazing victory!' : 'Better luck next time!';

    showGameOver(winnerText, emoji, message);

    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = false;
      updateButtonContent(startBtn, '🔄', 'Play Again');
    }

    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    if (pauseBtn) pauseBtn.disabled = true;
  });
}

function setupEventListeners(game: AIPongGame): void {
  // Back button
  document.getElementById('backBtn')?.addEventListener('click', () => {
    game.cleanup();
    router.navigate('/game');
  });

  // Start button
  document.getElementById('startBtn')?.addEventListener('click', () => {
    const difficulty = getDifficulty();
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    
    // Check if we're resuming (button says "Resume") or starting fresh
    const isResuming = startBtn && startBtn.textContent?.includes('Resume');
    
    if (!isResuming) {
      // Starting fresh - reset the game to clear scores and state
      game.reset();
      game.setAIDifficulty(difficulty);
      game.startAIOpponent();
      
      // Update score display to show 0-0
      const scoreDisplay = document.getElementById('scoreDisplay');
      if (scoreDisplay) {
        scoreDisplay.textContent = '0 - 0';
      }
      
      updateAIDifficultyDisplay(difficulty);
    }
    
    // Start or resume the game
    game.start();
    clearGameMessage();

    if (startBtn) {
      startBtn.disabled = true;
      updateButtonContent(startBtn, '🎮', 'Start Game');
    }

    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    if (pauseBtn) pauseBtn.disabled = false;
  });

  // Pause button
  document.getElementById('pauseBtn')?.addEventListener('click', () => {
    game.pause();
    showPaused();

    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = false;
      updateButtonContent(startBtn, '▶️', 'Resume');
    }

    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    if (pauseBtn) pauseBtn.disabled = true;
  });

  // Difficulty selector
  document.getElementById('difficultySelect')?.addEventListener('change', (e) => {
    const difficulty = (e.target as HTMLSelectElement).value as AIDifficulty;
    game.setAIDifficulty(difficulty);
    updateAIDifficultyDisplay(difficulty);
    updateAIStats(difficulty);
  });
}

// ============================================================================
// UI Update Functions
// ============================================================================

function showGameOver(title: string, emoji: string, message: string): void {
  const gameMsg = document.getElementById('gameMessage');
  if (!gameMsg) return;

  gameMsg.textContent = '';
  const card = document.createElement('div');
  card.className = 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 backdrop-blur-sm p-8 rounded-2xl border border-purple-500/30 animate-pulse';

  const icon = document.createElement('div');
  icon.className = 'text-5xl mb-4';
  icon.textContent = emoji;

  const titleDiv = document.createElement('div');
  titleDiv.className = 'text-3xl font-bold text-white mb-2';
  titleDiv.textContent = title;

  const text = document.createElement('p');
  text.className = 'text-gray-300';
  text.textContent = message;

  card.appendChild(icon);
  card.appendChild(titleDiv);
  card.appendChild(text);
  gameMsg.appendChild(card);
}

function showPaused(): void {
  const gameMsg = document.getElementById('gameMessage');
  if (!gameMsg) return;

  gameMsg.textContent = '';
  const card = document.createElement('div');
  card.className = 'bg-gradient-to-r from-yellow-600/30 to-amber-600/30 backdrop-blur-sm p-6 rounded-2xl border border-yellow-500/30';

  const icon = document.createElement('div');
  icon.className = 'text-3xl mb-2';
  icon.textContent = '⏸️';

  const title = document.createElement('div');
  title.className = 'text-2xl font-bold text-white';
  title.textContent = 'Game Paused';

  card.appendChild(icon);
  card.appendChild(title);
  gameMsg.appendChild(card);
}

function showError(message: string): void {
  const gameMsg = document.getElementById('gameMessage');
  if (!gameMsg) return;

  gameMsg.textContent = '';
  const card = document.createElement('div');
  card.className = 'bg-gradient-to-r from-red-600/30 to-pink-600/30 backdrop-blur-sm p-6 rounded-2xl border border-red-500/30';

  const title = document.createElement('div');
  title.className = 'text-2xl font-bold text-white mb-2';
  title.textContent = '⚠️ Game Error';

  const text = document.createElement('p');
  text.className = 'text-gray-300';
  text.textContent = message;

  card.appendChild(title);
  card.appendChild(text);
  gameMsg.appendChild(card);
}

function clearGameMessage(): void {
  const gameMsg = document.getElementById('gameMessage');
  if (gameMsg) gameMsg.textContent = '';
}

function updateAIDifficultyDisplay(difficulty: AIDifficulty): void {
  const aiDiff = document.getElementById('aiDifficulty');
  if (aiDiff) {
    aiDiff.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  }
}

function updateAIStats(difficulty: AIDifficulty): void {
  const reactionTimes: Record<AIDifficulty, string> = {
    easy: '1.5 seconds',
    medium: '1 second',
    hard: '0.7 seconds'
  };

  const accuracies: Record<AIDifficulty, string> = {
    easy: 'Low',
    medium: 'Medium',
    hard: 'High'
  };

  const reactionTime = document.getElementById('aiReactionTime');
  if (reactionTime) reactionTime.textContent = reactionTimes[difficulty];

  const accuracy = document.getElementById('aiAccuracy');
  if (accuracy) accuracy.textContent = accuracies[difficulty];
}

function getDifficulty(): AIDifficulty {
  const select = document.getElementById('difficultySelect') as HTMLSelectElement;
  return (select?.value || 'medium') as AIDifficulty;
}