/**
 * Remote Multiplayer Pong Game Page
 * Two-player remote game with WebSocket synchronization using existing chat WebSocket
 */

import { router } from "../router";
import { getCurrentUser } from "../stores/authState";
import { chatService } from "../services/socket";

// Store cleanup function
let cleanupGame: (() => void) | null = null;

// Handle player disconnect - notify server that remaining player wins
function handlePlayerDisconnect(event?: BeforeUnloadEvent) {
  if (!isGameActive || hasGameEnded || !roomId) return;

  // Send disconnect notification to server via WebSocket
  // The server will award the win to the remaining player
  if (chatService.isConnected()) {
    chatService.send({
      type: 'game:player_disconnect',
      roomId: roomId,
      playerNumber: playerNumber,
      tournamentId: tournamentId,
      matchId: matchId,
      timestamp: Date.now()
    });
  }

  // Mark as ended to prevent duplicate notifications
  hasGameEnded = true;
}

// Room and player state
let roomId: string | null = null;
let playerNumber: number = -1;

// Tournament mode state
let tournamentId: string | null = null;
let matchId: string | null = null;

// Game state from server
let gameState = {
    ball: { x: 400, y: 300 },
    paddle1Y: 250,
    paddle2Y: 250,
    scores: [0, 0] as [number, number]
};

// Local paddle position
let myPaddleY = 250;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animationFrame: number | null = null;
let hasJoinedGame = false; // Track if we've already joined the game

// Player usernames
let player1Username: string = 'Player 1';
let player2Username: string = 'Player 2';

// Input state
let keys: { [key: string]: boolean } = {};

// Game state tracking for disconnect handling
let isGameActive: boolean = false;
let hasGameEnded: boolean = false;

// Tab visibility tracking
let tabSwitched: boolean = false;

// Handle tab visibility change - end game if player switches tabs
function handleVisibilityChange() {
    if (document.hidden) {
        // Player switched away from the tab or minimized window
        if (isGameActive && !hasGameEnded) {            
            // Mark as switched for potential redirect
            tabSwitched = true;
            
            // Immediately handle as disconnect - opponent wins
            handlePlayerDisconnect();
            
            // Clean up the game
            if (cleanupGame) {
                cleanupGame();
            }
            
            // Redirect to home page immediately
            router.navigate('/');
        }
    }
}

export function renderRemoteGame() {
    // Reset tab switch flag
    tabSwitched = false;

    // Check for tournament mode
    const urlParams = new URLSearchParams(window.location.search);
    tournamentId = urlParams.get('tournament');
    matchId = urlParams.get('match');
    const inviteRoom = urlParams.get('room'); // Game invite room ID
    roomId = inviteRoom || matchId || `room_${Date.now()}`;

    // Clean up previous instance
    if (cleanupGame) {
        cleanupGame();
        cleanupGame = null;
    }

    // Remove old disconnect handlers
    window.removeEventListener('beforeunload', handlePlayerDisconnect);
    window.removeEventListener('visibilitychange', handleVisibilityChange);

    // Add disconnect detection
    window.addEventListener('beforeunload', handlePlayerDisconnect);
    window.addEventListener('visibilitychange', handleVisibilityChange);

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
    container.appendChild(createInfoCards());    app.appendChild(root);

    // Initialize game with existing WebSocket
    initializeGame();

    // Setup cleanup
    cleanupGame = () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('beforeunload', handlePlayerDisconnect);
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        hasJoinedGame = false; // Reset flag for next game
        isGameActive = false;
        hasGameEnded = false;
        tabSwitched = false; // Reset tab switch flag
    };
}

async function initializeGame() {
    const user = getCurrentUser();
    if (!user) {
        showError('Please log in to play');
        return;
    }

    // If this is a tournament match, check if it's already completed
    if (tournamentId && matchId) {
        try {
            const response = await fetch(`/api/tournaments/${tournamentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const tournament = await response.json();
                const match = tournament.matches?.find((m: any) => m.id == matchId);

                if (match && match.status === 'completed') {
                    showError('This match has already been completed');
                    setTimeout(() => {
                        router.navigate(`/tournament/${tournamentId}`);
                    }, 2000);
                    return;
                }
            }
        } catch (error) {
        }
    }
    // Setup game message handler
    chatService.onMessage((data) => {
        handleWebSocketMessage(data);
    });

    updateStatusInfo('🎮', 'Connecting', 'Authenticating...', 'text-blue-300');

    // Wait for authentication to complete before joining game
    try {
        // Check if already authenticated
        if (!chatService.isConnected()) {
            updateStatusInfo('⏳', 'Authenticating', 'Please wait...', 'text-yellow-300');

            // Wait a bit for authentication to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (!chatService.isConnected()) {
                throw new Error('WebSocket not authenticated');
            }
        }
        updateStatusInfo('🎮', 'Connecting', 'Joining game room...', 'text-blue-300');

        // Join game room (only once)
        if (!hasJoinedGame) {
            hasJoinedGame = true;
            chatService.send({
                type: 'JOIN_GAME',
                gameId: roomId
            });
        } 
    } catch (error) {
        showError('Failed to connect to game. Please refresh and try again.');
    }
}


function handleWebSocketMessage(message: any) {
    switch (message.type) {
        case 'MATCH_ALREADY_COMPLETED':
            isGameActive = false;
            hasGameEnded = true;
            
            // Stop any game loop
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
            
            // Show message
            showError('This match has already been completed');
            updateStatusInfo('ℹ️', 'Match Completed', 'This match has already ended', 'text-blue-300');
            
            // Redirect after short delay
            setTimeout(() => {
                if (tournamentId) {
                    router.navigate(`/tournament/${tournamentId}`);
                } else {
                    router.navigate('/game');
                }
            }, 2000);
            break;
            
        case 'game:opponent_disconnect':
            isGameActive = false;
            hasGameEnded = true;
            
            // Stop game loop
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
            
            // Show victory message
            showGameOver('You Win! (Opponent Disconnected)');
            updateStatusBadge('Victory!', 'from-emerald-600/50 to-green-600/50', 'text-emerald-300');
            updateStatusInfo('🏆', 'You Win!', 'Your opponent disconnected', 'text-emerald-300');
            
            // Redirect after delay
            setTimeout(() => {
                if (tournamentId) {
                    router.navigate(`/tournament/${tournamentId}`);
                } else {
                    router.navigate('/game');
                }
            }, 3000);
            break;
        case 'PLAYER_JOINED':
            // Determine player number based on current user
            const user = getCurrentUser();
            if (user && message.players) {
                // Use join order for player assignment (simpler and more reliable)
                const playerIndex = message.players.findIndex((p: any) => p.userId === user.id);
                if (playerIndex !== -1) {
                    playerNumber = playerIndex;
                }

                // Store player usernames in order
                if (message.players[0]) {
                    player1Username = message.players[0].username || 'Player 1';
                }
                if (message.players[1]) {
                    player2Username = message.players[1].username || 'Player 2';
                }
                // Update player info display
                updatePlayerInfo();
            }

            if (message.players && message.players.length === 2) {
                updateStatusInfo('✅', 'Both Players Connected', 'Get ready!', 'text-green-300');
                setTimeout(() => startGame(), 1000);
            } else {
                updateStatusInfo('⏳', 'Waiting', 'Waiting for opponent...', 'text-yellow-300');
            }
            break;

        case 'GAME_STARTED':
            startGame();
            break;

        case 'GAME_STATE_UPDATE':
            // Update game state from server
            if (message.ball) {
                gameState.ball = message.ball;
            }
            if (message.paddles) {
                gameState.paddle1Y = message.paddles[0]?.y || gameState.paddle1Y;
                gameState.paddle2Y = message.paddles[1]?.y || gameState.paddle2Y;
            }
            if (message.scores) {
                gameState.scores = message.scores;
                updateScoreDisplay();
            }
            break;

        case 'SCORE_UPDATE':
            if (message.scores) {
                gameState.scores = message.scores;
                updateScoreDisplay();
            }
            break;

        case 'PLAYER_MOVED':
            // Update opponent paddle
            if (message.playerIndex !== undefined) {
                if (message.playerIndex === 0) {
                    gameState.paddle1Y = message.position;
                } else {
                    gameState.paddle2Y = message.position;
                }
            }
            break;

        case 'GAME_ENDED':
            handleGameOver(message.winner, message.finalScores);
            break;

        case 'PLAYER_LEFT':
            showError('Opponent disconnected');
            break;
    }
}

function startGame() {

    canvas = document.getElementById('pongCanvas') as HTMLCanvasElement;
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // Setup input listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Start game loop
    gameLoop();
    isGameActive = true;
    hasGameEnded = false;

    updateStatusBadge('Match in progress...', 'from-emerald-600/50 to-green-600/50', 'text-emerald-300', true);
    updateStatusInfo('⚡', 'Game Active!', 'Use W/S or Arrow keys', 'text-emerald-300');
}

function handleKeyDown(e: KeyboardEvent) {
    // Don't capture keys when user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
    }
    
    // Prevent default behavior for game control keys to avoid page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 's', 'S'].includes(e.key)) {
        e.preventDefault();
    }
    keys[e.key] = true;
}

function handleKeyUp(e: KeyboardEvent) {
    // Don't capture keys when user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
    }
    
    // Prevent default behavior for game control keys to avoid page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 's', 'S'].includes(e.key)) {
        e.preventDefault();
    }
    keys[e.key] = false;
}

function gameLoop() {
    if (!canvas || !ctx) return;

    // Update local paddle
    const paddleSpeed = 5;
    let direction = 'none';

    if (keys['w'] || keys['W'] || keys['ArrowUp']) {
        myPaddleY = Math.max(0, myPaddleY - paddleSpeed);
        direction = 'up';
    }
    if (keys['s'] || keys['S'] || keys['ArrowDown']) {
        myPaddleY = Math.min(canvas.height - 100, myPaddleY + paddleSpeed);
        direction = 'down';
    }

    // Send paddle position to server via existing WebSocket
    // Only send if there's actual movement AND we're connected
    if (direction !== 'none' && chatService.isConnected()) {
        chatService.send({
            type: 'PLAYER_MOVE',
            gameId: roomId,  // ✅ Add game room context
            direction: direction,
            position: myPaddleY
        });
    }

    // Update game state
    if (playerNumber === 0) {
        gameState.paddle1Y = myPaddleY;
    } else {
        gameState.paddle2Y = myPaddleY;
    }

    // Render
    render();

    animationFrame = requestAnimationFrame(gameLoop);
}

function render() {
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw center line
    ctx.strokeStyle = '#444';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    ctx.fillStyle = '#3b82f6'; // Player 1 blue
    ctx.fillRect(20, gameState.paddle1Y, 10, 100);

    ctx.fillStyle = '#ef4444'; // Player 2 red
    ctx.fillRect(canvas.width - 30, gameState.paddle2Y, 10, 100);

    // Draw ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, 8, 0, Math.PI * 2);
    ctx.fill();
}

function updateScoreDisplay() {
    const scoreDisplay = document.getElementById('scoreDisplay');
    if (scoreDisplay) {
        scoreDisplay.textContent = `${gameState.scores[0]} - ${gameState.scores[1]}`;
    }
}

async function handleGameOver(winner: number, finalScores: [number, number]) {
    // Mark game as ended
    isGameActive = false;
    hasGameEnded = true;

    // Stop the game loop immediately
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    const winnerText = winner === playerNumber ? 'You Win!' : 'You Lose';
    showGameOver(winnerText);

    // Clean up game state
    if (cleanupGame) {
        cleanupGame();
    }

    // If this is a tournament match, redirect to tournament page after showing results
    if (tournamentId && matchId) {
        // Redirect after 3 seconds
        setTimeout(() => {
            router.navigate(`/tournament/${tournamentId}`);
        }, 3000);
    } else {
        // For remote (non-tournament) games, redirect to profile

        setTimeout(() => {
            router.navigate('/profile');
        }, 3000);
    }
}


// ============================================================================
// DOM Creation Helpers (same as game.ts for consistent UI)
// ============================================================================

function createContainer(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 pb-8 px-4';

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

function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'mb-8';

    const headerRow = document.createElement('div');
    headerRow.className = 'flex justify-between items-center mb-6';

    const titleDiv = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.className = 'text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent flex items-center space-x-3';
    
    const emoji = document.createElement('span');
    emoji.textContent = '🌐';
    
    const titleText = document.createElement('span');
    titleText.textContent = 'Remote Pong';
    
    h1.appendChild(emoji);
    h1.appendChild(titleText);

    const p = document.createElement('p');
    p.className = 'text-gray-400 mt-2';
    p.textContent = 'Play against remote opponents in real-time';

    titleDiv.appendChild(h1);
    titleDiv.appendChild(p);

    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'flex gap-4';

    const backBtn = createButton('backBtn', '←', tournamentId ? 'Back to Tournament' : 'Back to Home', 'from-gray-700 to-gray-800', true);
    btnsDiv.appendChild(backBtn);

    headerRow.appendChild(titleDiv);
    headerRow.appendChild(btnsDiv);
    header.appendChild(headerRow);

    return header;
}

function createGameBox(): HTMLDivElement {
    const gameBox = document.createElement('div');
    gameBox.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-2xl mb-8';

    gameBox.appendChild(createGameInfo());

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'relative';

    const canvasInner = document.createElement('div');
    canvasInner.className = 'aspect-video bg-gradient-to-b from-gray-900 to-black rounded-2xl border-2 border-gray-700 overflow-hidden shadow-inner';

    const canvas = document.createElement('canvas');
    canvas.id = 'pongCanvas';
    canvas.className = 'w-full h-full';

    canvasInner.appendChild(canvas);
    canvasWrap.appendChild(canvasInner);

    const gameMsg = document.createElement('div');
    gameMsg.id = 'gameMessage';
    gameMsg.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none';

    canvasWrap.appendChild(gameMsg);
    gameBox.appendChild(canvasWrap);

    gameBox.appendChild(createStatusBadge());

    return gameBox;
}

function createGameInfo(): HTMLDivElement {
    const infoRow = document.createElement('div');
    infoRow.className = 'flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl border border-purple-500/20';

    const p1Div = createPlayerInfo('👤 ' + player1Username + ' (Left)', 'W/S or ↑/↓', 'from-blue-400 to-cyan-300');
    p1Div.id = 'player1Info';

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

    const p2Div = createPlayerInfo('👤 ' + player2Username + ' (Right)', 'Remote Player', 'from-red-400 to-orange-300');
    p2Div.id = 'player2Info';

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

function updatePlayerInfo() {
    // Update player 1 label
    const player1Info = document.getElementById('player1Info');
    if (player1Info) {
        const labelDiv = player1Info.querySelector('.text-gray-400');
        if (labelDiv) {
            labelDiv.textContent = `👤 ${player1Username} (Left)`;
        }
    }

    // Update player 2 label
    const player2Info = document.getElementById('player2Info');
    if (player2Info) {
        const labelDiv = player2Info.querySelector('.text-gray-400');
        if (labelDiv) {
            labelDiv.textContent = `👤 ${player2Username} (Right)`;
        }
    }
}

function createStatusBadge(): HTMLDivElement {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'gameStatus';
    statusDiv.className = 'mt-4 text-center';

    const badge = createBadge('Connecting...', 'from-gray-700/50 to-gray-800/50', 'text-gray-300');
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
        { dot: 'bg-blue-500', text: 'Use W/S or Arrow keys to move your paddle', color: 'text-blue-300', strong: 'W/S or Arrow keys' },
        { dot: 'bg-red-500', text: 'Your opponent controls their paddle remotely', color: 'text-red-300', strong: 'remotely' },
        { dot: 'bg-emerald-500', text: 'First player to score 5 points wins', color: 'text-emerald-300', strong: '5 points' },
        { dot: 'bg-purple-500', text: 'Game state syncs in real-time via WebSocket', color: 'text-purple-300', strong: 'real-time' }
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
    text.textContent = 'Connecting to server';

    const subtext = document.createElement('p');
    subtext.className = 'text-gray-400 mt-2';
    subtext.textContent = 'Waiting for connection...';

    statusInfo.appendChild(icon);
    statusInfo.appendChild(text);
    statusInfo.appendChild(subtext);

    card.appendChild(statusInfo);
    return card;
}

// Helper functions
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

    // Add event listener
    btn.addEventListener('click', () => {
        if (cleanupGame) cleanupGame();
        if (tournamentId) {
            router.navigate(`/tournament/${tournamentId}`);
        } else {
            router.navigate('/');
        }
    });

    return btn;
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
    title.textContent = winner;

    const text = document.createElement('p');
    text.className = 'text-gray-300';
    text.textContent = 'Incredible match! 🎉';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(text);
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
    title.textContent = '⚠️ Error';

    const text = document.createElement('p');
    text.className = 'text-gray-300';
    text.textContent = message;

    card.appendChild(title);
    card.appendChild(text);
    gameMsg.appendChild(card);
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
