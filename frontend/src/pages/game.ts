/**
 * Multiplayer Pong Game Page
 * Two-player local game with keyboard controls
 */

import { PongGame, GameStateEnum } from "../components/game/pongGame";
import { router } from "../router";
import { saveGameResult } from "../services/api";

// Store cleanup function for proper resource management
let cleanupGame: (() => void) | null = null;

// Tournament mode state
let tournamentId: string | null = null;
let matchId: string | null = null;
let tournamentMatch: any = null;

// Store active game instance for disconnect handling
let activeGame: PongGame | null = null;
let isGameActive: boolean = false;

// Handle player disconnect
function handlePlayerDisconnect(event?: BeforeUnloadEvent) {
  if (!isGameActive || !activeGame) return;

  const isTournamentMode = !!(tournamentId && matchId);
  
  // Get current game state
  const scores = activeGame.getScores();
  const state = activeGame.getState();
  
  // Only handle if game is actually playing
  if (state !== GameStateEnum.PLAYING) return;

  // Determine winner (player who stayed wins)
  // In a local 2-player game, we'll consider player 1 as the one who stayed
  // since they're on this device
  const winnerId = isTournamentMode 
    ? tournamentMatch?.player1Id 
    : null;

  if (isTournamentMode && winnerId && tournamentId) {
    // Save the tournament result
    const resultData = {
      player1Id: tournamentMatch.player1Id,
      player2Id: tournamentMatch.player2Id,
      winnerId: winnerId,
      scores: [5, scores[1]], // Give player 1 a full win score
      tournamentMatchId: tournamentMatch.id,
      disconnected: true
    };

    const token = localStorage.getItem('token');
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    fetch(`/api/tournaments/${tournamentId}/game-result`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(resultData),
      keepalive: true
    }).catch(err => console.error('Failed to save disconnect result:', err));

  } else {
    // For regular local games, save to regular games table
    // We need both player IDs - but in local game we don't track individual users
    // We'll need the current user as player 1 and get player 2 info if available
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.id) {
      const resultData = {
        player1Id: currentUser.id.toString(),
        player2Id: currentUser.id.toString(), // In local 2-player, both are on same device
        winnerId: currentUser.id.toString(), // Player who stayed wins
        scores: [5, scores[1]],
        gameType: 'local'
      };

      const token = localStorage.getItem('token');
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      });

      fetch(`/api/games/save-result`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(resultData),
        keepalive: true
      }).catch(err => console.error('Failed to save disconnect result:', err));
    }
  }
}

export function renderGame() {
  // Check for tournament mode
  const urlParams = new URLSearchParams(window.location.search);
  tournamentId = urlParams.get('tournament');
  matchId = urlParams.get('match');
  const isTournamentMode = tournamentId && matchId;

  // Clean up previous instance
  if (cleanupGame) {
    cleanupGame();
    cleanupGame = null;
  }

  // Remove old disconnect handlers
  window.removeEventListener('beforeunload', handlePlayerDisconnect);
  window.removeEventListener('visibilitychange', handlePlayerDisconnect);

  // Add disconnect detection
  window.addEventListener('beforeunload', handlePlayerDisconnect);
  window.addEventListener('visibilitychange', handlePlayerDisconnect);

  const app = document.getElementById("app")!;
  app.innerHTML = '';

  // Main container
  const root = createContainer();
  const container = createContentContainer();
  root.appendChild(container);

  // Header section
  container.appendChild(createHeader(!!isTournamentMode));

  // Game section
  const gameBox = createGameBox();
  container.appendChild(gameBox);

  // Info cards
  container.appendChild(createInfoCards());

  app.appendChild(root);

  // Initialize game after DOM is ready
  if (isTournamentMode) {
    loadTournamentMatch(tournamentId!, matchId!);
  } else {
    initializeRegularGame();
  }
}

async function loadTournamentMatch(tournamentId: string, matchId: string) {
  try {
    const response = await fetch(`/api/tournaments/${tournamentId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      showError(`Failed to load tournament: ${errorData.error || response.statusText}`);
      return;
    }

    const tournament = await response.json();

    tournamentMatch = tournament.matches.find((m: any) => m.id == matchId);

    if (!tournamentMatch) {
      showError('Match not found');
      return;
    }

    // Update UI with match info
    const h1 = document.querySelector('h1');
    if (h1) {
      h1.textContent = `🏆 Tournament Match`;
    }

    const subtitle = document.querySelector('h1 + p');
    if (subtitle) {
      subtitle.textContent = `${tournamentMatch.player1Username} vs ${tournamentMatch.player2Username}`;
    }

    // Update player info
    const p1Label = document.querySelector('.text-center .text-sm.text-gray-400');
    if (p1Label && p1Label.textContent?.includes('Player 1')) {
      p1Label.textContent = `👤 ${tournamentMatch.player1Username} (Left)`;
    }

    const p2Labels = document.querySelectorAll('.text-center .text-sm.text-gray-400');
    if (p2Labels[1] && p2Labels[1].textContent?.includes('Player 2')) {
      p2Labels[1].textContent = `👤 ${tournamentMatch.player2Username} (Right)`;
    }
    // Initialize tournament game
    initializeTournamentGame();

  } catch (error) {
    showError(`Failed to load tournament match: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function initializeTournamentGame() {
  let pongGame: PongGame | null = null;

  setTimeout(() => {
    try {
      pongGame = new PongGame('pongCanvas');
      activeGame = pongGame; // Store for disconnect handling
      pongGame.setMaxScore(5);

      // Score callback
      pongGame.onScore((scores) => {
        const scoreDisplay = document.getElementById('scoreDisplay');
        if (scoreDisplay) {
          scoreDisplay.textContent = `${scores[0]} - ${scores[1]}`;
        }
      });

      // Game over callback - save to tournament
      pongGame.onGameOver(async (winner) => {
        isGameActive = false; // Mark game as ended
        if (!tournamentMatch || !tournamentId) return;

        const winnerText = winner === 0 ? tournamentMatch.player1Username : tournamentMatch.player2Username;
        showGameOver(winnerText);

        const winnerId = winner === 0 ? tournamentMatch.player1Id : tournamentMatch.player2Id;
        const scores = pongGame!.getScores();

        try {
          await saveGameResult(tournamentId, {
            player1Id: tournamentMatch.player1Id,
            player2Id: tournamentMatch.player2Id,
            winnerId: winnerId,
            scores: scores,
            tournamentMatchId: tournamentMatch.id
          });

          // Navigate back to tournament after 3 seconds with full reload
          setTimeout(() => {
            window.location.href = `/tournament/${tournamentId}`;
          }, 3000);

        } catch (error) {
          showError('Failed to save match result');
        }
      });

      setupTournamentEventListeners(pongGame);

      // Auto-start the game
      pongGame.start();
      isGameActive = true; // Mark game as active
      updateStatusBadge('Match in progress...', 'from-emerald-600/50 to-green-600/50', 'text-emerald-300', true);
      updateStatusInfo('⚡', 'Tournament Match Active!', 'Game is currently running', 'text-emerald-300');

      // Setup cleanup
      cleanupGame = () => {
        if (pongGame) {
          pongGame.cleanup();
          pongGame = null;
          activeGame = null;
          isGameActive = false;
        }
      };

    } catch (error) {
      showError('Failed to load game. Please refresh the page.');
    }
  }, 100);
}

function initializeRegularGame() {
  let pongGame: PongGame | null = null;

  setTimeout(() => {
    try {
      pongGame = new PongGame('pongCanvas');
      activeGame = pongGame; // Store for disconnect handling
      setupGameCallbacks(pongGame);
      setupEventListeners(pongGame);

      // Setup cleanup
      cleanupGame = () => {
        if (pongGame) {
          pongGame.cleanup();
          pongGame = null;
          activeGame = null;
          isGameActive = false;
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
  root.className = 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 pb-8 px-4';

  // Animated background
  const bg = document.createElement('div');
  bg.className = 'absolute inset-0 overflow-hidden pointer-events-none';

  const blurPurple = document.createElement('div');
  blurPurple.className = 'absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl';

  const blurBlue = document.createElement('div');
  blurBlue.className = 'absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl';

  bg.appendChild(blurPurple);
  bg.appendChild(blurBlue);
  root.appendChild(bg);

  return root;
}

function createContentContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'max-w-6xl mx-auto relative';
  return container;
}

function createHeader(isTournamentMode: boolean = false): HTMLElement {
  const header = document.createElement('div');
  header.className = 'mb-8';

  const headerRow = document.createElement('div');
  headerRow.className = 'flex justify-between items-center mb-6';

  // Title
  const titleDiv = document.createElement('div');
  const h1 = document.createElement('h1');
  h1.className = 'text-4xl font-bold flex items-center gap-3';
  
  const emoji = document.createElement('span');
  emoji.textContent = isTournamentMode ? '🎮' : '🎮';
  
  const titleText = document.createElement('span');
  titleText.className = 'bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent';
  titleText.textContent = isTournamentMode ? 'Tournament Match' : 'Pong Battle';
  
  h1.appendChild(emoji);
  h1.appendChild(titleText);

  const p = document.createElement('p');
  p.className = 'text-gray-400 mt-2';
  p.textContent = isTournamentMode ? 'Tournament match in progress' : 'Challenge your friends or play against the AI';

  titleDiv.appendChild(h1);
  titleDiv.appendChild(p);

  // Buttons
  const btnsDiv = document.createElement('div');
  btnsDiv.className = 'flex gap-4';

  if (!isTournamentMode) {
    const aiBtn = createButton('aiGameBtn', '🤖', 'Play vs AI', 'from-purple-600 to-blue-500');
    btnsDiv.appendChild(aiBtn);
  }

  const backBtn = createButton(
    'backBtn',
    '←',
    isTournamentMode ? 'Back to Tournament' : 'Back to Home',
    'from-gray-700 to-gray-800',
    true
  );
  btnsDiv.appendChild(backBtn);

  headerRow.appendChild(titleDiv);
  headerRow.appendChild(btnsDiv);
  header.appendChild(headerRow);

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
  canvas.id = 'pongCanvas';
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

  // Status
  gameBox.appendChild(createStatusBadge());

  return gameBox;
}

function createGameInfo(): HTMLDivElement {
  const infoRow = document.createElement('div');
  infoRow.className = 'flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl border border-purple-500/20';

  // Player 1
  const p1Div = createPlayerInfo('👤 Player 1 (Left)', 'W/S Keys', 'from-blue-400 to-cyan-300');

  // Score
  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'text-center';

  const scoreDisp = document.createElement('div');
  scoreDisp.id = 'scoreDisplay';
  scoreDisp.className = 'text-4xl font-bold text-white';
  scoreDisp.textContent = '0 - 0';

  const scoreSub = document.createElement('div');
  scoreSub.className = 'text-sm text-gray-400 mt-1';
  scoreSub.textContent = 'First to 5 points wins 🏆';

  scoreDiv.appendChild(scoreDisp);
  scoreDiv.appendChild(scoreSub);

  // Player 2
  const p2Div = createPlayerInfo('👤 Player 2 (Right)', 'Arrow Keys', 'from-red-400 to-orange-300');

  infoRow.appendChild(p1Div);
  infoRow.appendChild(scoreDiv);
  infoRow.appendChild(p2Div);

  return infoRow;
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

  const startBtn = createControlButton('startBtn', '🎮', 'Start Game', 'from-emerald-500 to-green-600');
  const pauseBtn = createControlButton('pauseBtn', '⏸️', 'Pause', 'from-yellow-500 to-amber-600', true);
  const resetBtn = createControlButton('resetBtn', '🔄', 'Reset Game', 'from-red-500 to-pink-600');

  controlsDiv.appendChild(startBtn);
  controlsDiv.appendChild(pauseBtn);
  controlsDiv.appendChild(resetBtn);

  return controlsDiv;
}

function createStatusBadge(): HTMLDivElement {
  const statusDiv = document.createElement('div');
  statusDiv.id = 'gameStatus';
  statusDiv.className = 'mt-4 text-center';

  const badge = createBadge('Ready to start...', 'from-gray-700/50 to-gray-800/50', 'text-gray-300');
  statusDiv.appendChild(badge);

  return statusDiv;
}

function createInfoCards(): HTMLDivElement {
  const cardsGrid = document.createElement('div');
  cardsGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';

  cardsGrid.appendChild(createHowToPlayCard());
  cardsGrid.appendChild(createGameStatusCard());

  return cardsGrid;
}

function createHowToPlayCard(): HTMLDivElement {
  const card = createCard('📚', 'How to Play');

  const ul = document.createElement('ul');
  ul.className = 'space-y-3 text-gray-300';

  const instructions = [
    { dot: 'bg-blue-500', text: 'Player 1: Use W and S keys to move', color: 'text-blue-300', strong: 'Player 1' },
    { dot: 'bg-red-500', text: 'Player 2: Use ↑ and ↓ arrow keys to move', color: 'text-red-300', strong: 'Player 2' },
    { dot: 'bg-emerald-500', text: 'First player to score 5 points wins', color: 'text-emerald-300', strong: '5 points' },
    { dot: 'bg-purple-500', text: 'Ball speeds up after each paddle hit', color: 'text-purple-300', strong: 'speeds up' }
  ];

  instructions.forEach(item => {
    const li = createListItem(item.dot, item.text, item.color, item.strong);
    ul.appendChild(li);
  });

  card.appendChild(ul);
  return card;
}

function createGameStatusCard(): HTMLDivElement {
  const card = createCard('📊', 'Game Status');

  const statusInfo = document.createElement('div');
  statusInfo.id = 'gameStatusInfo';
  statusInfo.className = 'text-center py-4';

  const icon = document.createElement('div');
  icon.className = 'text-5xl mb-4';
  icon.textContent = '🎯';

  const text = document.createElement('div');
  text.className = 'text-lg font-semibold text-gray-300';
  text.textContent = 'Ready to start';

  const subtext = document.createElement('p');
  subtext.className = 'text-gray-400 mt-2';
  subtext.textContent = 'Invite a friend or play solo!';

  statusInfo.appendChild(icon);
  statusInfo.appendChild(text);
  statusInfo.appendChild(subtext);

  card.appendChild(statusInfo);
  return card;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createButton(id: string, emoji: string, text: string, gradient: string, isBorder: boolean = false): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;

  if (isBorder) {
    btn.className = `px-6 py-3 bg-gradient-to-r ${gradient} hover:from-gray-600 hover:to-gray-700 text-white font-bold rounded-xl border border-gray-600 hover:border-gray-500 transition-all duration-300`;
  } else {
    btn.className = `px-6 py-3 bg-gradient-to-r ${gradient} hover:from-purple-700 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:-translate-y-1`;
  }

  const span = document.createElement('span');
  span.className = 'flex items-center space-x-2';

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'text-xl';
  emojiSpan.textContent = emoji;

  const textSpan = document.createElement('span');
  textSpan.textContent = text;

  span.appendChild(emojiSpan);
  span.appendChild(textSpan);
  btn.appendChild(span);

  return btn;
}

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

function createBadge(text: string, gradient: string, textColor: string): HTMLDivElement {
  const badge = document.createElement('div');
  badge.className = `inline-block px-4 py-2 bg-gradient-to-r ${gradient} rounded-xl border border-gray-600/50`;

  const span = document.createElement('span');
  span.className = textColor;
  span.textContent = text;

  badge.appendChild(span);
  return badge;
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

// ============================================================================
// Game Setup
// ============================================================================

function setupGameCallbacks(game: PongGame): void {
  game.onScore((scores) => {
    const scoreDisplay = document.getElementById('scoreDisplay');
    if (scoreDisplay) {
      scoreDisplay.textContent = `${scores[0]} - ${scores[1]}`;
    }
  });

  game.onGameOver((winner) => {
    isGameActive = false; // Mark game as ended
    const winnerText = winner === 0 ? 'Player 1' : 'Player 2';
    showGameOver(winnerText);
    updateStatusInfo('🏁', 'Game Complete!', `${winnerText} is the champion!`, 'text-emerald-300');

    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = false;
      updateButtonContent(startBtn, '🔄', 'Play Again');
    }

    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    if (pauseBtn) pauseBtn.disabled = true;
    
    // Hide reset button to avoid redundancy
    const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    if (resetBtn) {
      resetBtn.style.display = 'none';
    }
  });
}

function setupEventListeners(game: PongGame): void {
  // Back button
  document.getElementById('backBtn')?.addEventListener('click', () => {
    game.cleanup();
    router.navigate('/');
  });

  // AI Game button
  document.getElementById('aiGameBtn')?.addEventListener('click', () => {
    game.cleanup();
    router.navigate('/ai-game');
  });

  // Start button
  document.getElementById('startBtn')?.addEventListener('click', () => {
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    
    // If button says "Play Again", reset the game first
    if (startBtn?.textContent?.includes('Play Again')) {
      game.reset();
      
      // Reset score display
      const scoreDisplay = document.getElementById('scoreDisplay');
      if (scoreDisplay) {
        scoreDisplay.textContent = '0 - 0';
      }
      
      // Show reset button again
      const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
      if (resetBtn) {
        resetBtn.style.display = '';
        resetBtn.disabled = false;
      }
    }
    
    game.start();
    isGameActive = true; // Mark game as active
    clearGameMessage();
    updateStatusBadge('Game in progress...', 'from-emerald-600/50 to-green-600/50', 'text-emerald-300', true);
    updateStatusInfo('⚡', 'Match Active!', 'Game is currently running', 'text-emerald-300');

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
    updateStatusInfo('⏸️', 'Game Paused', 'Click Resume to continue', 'text-yellow-300');

    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = false;
      updateButtonContent(startBtn, '▶️', 'Resume');
    }

    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    if (pauseBtn) pauseBtn.disabled = true;
  });

  // Reset button
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    game.reset();
    resetUI();
  });
}

// ============================================================================
// UI Update Functions
// ============================================================================

function showGameOver(winner: string): void {
  const gameMsg = document.getElementById('gameMessage');
  if (!gameMsg) return;

  gameMsg.textContent = '';
  const card = document.createElement('div');
  card.className = 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 backdrop-blur-sm p-8 rounded-2xl border border-purple-500/30 animate-pulse';

  const icon = document.createElement('div');
  icon.className = 'text-5xl mb-4';
  icon.textContent = '🏆';

  const title = document.createElement('div');
  title.className = 'text-3xl font-bold text-white mb-2';
  title.textContent = `${winner} Wins!`;

  const text = document.createElement('p');
  text.className = 'text-gray-300';
  text.textContent = 'Incredible match! 🎉';

  card.appendChild(icon);
  card.appendChild(title);
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

function updateStatusBadge(text: string, gradient: string, textColor: string, animate: boolean = false): void {
  const status = document.getElementById('gameStatus');
  if (!status) return;

  status.textContent = '';
  const badge = createBadge(text, gradient, textColor);
  if (animate) {
    badge.classList.add('animate-pulse');
  }
  status.appendChild(badge);
}

function updateStatusInfo(emoji: string, title: string, subtitle: string, titleColor: string): void {
  const statusInfo = document.getElementById('gameStatusInfo');
  if (!statusInfo) return;

  statusInfo.textContent = '';

  const icon = document.createElement('div');
  icon.className = 'text-4xl mb-4';
  icon.textContent = emoji;

  const titleDiv = document.createElement('div');
  titleDiv.className = `text-lg font-semibold ${titleColor}`;
  titleDiv.textContent = title;

  const subtitleP = document.createElement('p');
  subtitleP.className = 'text-gray-400 mt-2';
  subtitleP.textContent = subtitle;

  statusInfo.appendChild(icon);
  statusInfo.appendChild(titleDiv);
  statusInfo.appendChild(subtitleP);
}

function resetUI(): void {
  const scoreDisplay = document.getElementById('scoreDisplay');
  if (scoreDisplay) scoreDisplay.textContent = '0 - 0';

  clearGameMessage();
  updateStatusBadge('Ready to start...', 'from-gray-700/50 to-gray-800/50', 'text-gray-300');
  updateStatusInfo('🎯', 'Ready to start', 'Invite a friend or play solo!', 'text-gray-300');

  const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
  if (startBtn) {
    startBtn.disabled = false;
    updateButtonContent(startBtn, '🎮', 'Start Game');
  }

  const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
  if (pauseBtn) pauseBtn.disabled = true;
}

function setupTournamentEventListeners(game: PongGame): void {
  // Back to tournament button
  document.getElementById('backBtn')?.addEventListener('click', () => {
    game.cleanup();
    if (tournamentId) {
      router.navigate(`/tournament/${tournamentId}`);
    } else {
      router.navigate('/tournament');
    }
  });

  // Pause button
  document.getElementById('pauseBtn')?.addEventListener('click', () => {
    game.pause();
    showPaused();
    updateStatusInfo('⏸️', 'Game Paused', 'Click Resume to continue', 'text-yellow-300');

    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = false;
      updateButtonContent(startBtn, '▶️', 'Resume');
    }

    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    if (pauseBtn) pauseBtn.disabled = true;
  });

  // Reset button - disabled in tournament mode
  const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
  if (resetBtn) {
    resetBtn.disabled = true;
    resetBtn.title = 'Reset not available in tournament mode';
  }
}