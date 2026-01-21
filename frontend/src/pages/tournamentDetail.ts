import { router } from "../router";
import { getCurrentUser } from "../stores/authState";
import { PongGame } from "../components/game/pongGame";
import { saveGameResult } from "../services/api";
import { chatService } from "../services/socket";

// Module-level state variables (declared first for cleanup function access)
let countdownIntervals: { [key: string]: any } = {};
let countdownStarted: { [key: string]: boolean } = {};
let pollingInterval: any = null;
let isPolling = false;

// Clean up all countdown intervals and tracking
function cleanupCountdowns() {
  for (const matchId in countdownIntervals) {
    if (countdownIntervals[matchId]) {
      clearInterval(countdownIntervals[matchId]);
      delete countdownIntervals[matchId];
    }
  }
  // Reset countdown tracking
  for (const matchId in countdownStarted) {
    delete countdownStarted[matchId];
  }
}

// Stop polling function (defined early for cleanup)
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isPolling = false;
}

export function renderTournamentDetail(tournamentId: string) {  
  // Clean up any existing countdowns from previous render
  cleanupCountdowns();
  stopPolling();
  
  const app = document.getElementById("app")!;
  app.textContent = '';

  // Build tournament detail page with modern styling
  const root = document.createElement('div');
  root.className = 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 relative p-4 md:p-8';

  // Animated background
  const animatedBg = document.createElement('div');
  animatedBg.className = 'absolute inset-0 overflow-hidden pointer-events-none';
  const radial = document.createElement('div');
  radial.className = 'absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent';
  const blueCircle = document.createElement('div');
  blueCircle.className = 'absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl';
  animatedBg.appendChild(radial);
  animatedBg.appendChild(blueCircle);
  root.appendChild(animatedBg);

  const container = document.createElement('div');
  container.className = 'max-w-7xl mx-auto relative';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'mb-6 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-xl border border-gray-700/50 transition-all duration-300 flex items-center space-x-2';
  const backArrow = document.createElement('span');
  backArrow.textContent = '←';
  const backText = document.createElement('span');
  backText.textContent = 'Back to Tournaments';
  backBtn.appendChild(backArrow);
  backBtn.appendChild(backText);
  backBtn.addEventListener('click', () => router.navigate('/tournament'));
  container.appendChild(backBtn);

  // Header Card
  const headerCard = document.createElement('div');
  headerCard.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 mb-6 shadow-xl';

  const headerRow = document.createElement('div');
  headerRow.className = 'flex flex-col md:flex-row justify-between items-start md:items-center gap-4';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'flex-1';

  const tournamentName = document.createElement('h1');
  tournamentName.id = 'tournamentName';
  tournamentName.className = 'text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent mb-2';
  tournamentName.textContent = 'Loading...';

  const tournamentInfo = document.createElement('div');
  tournamentInfo.id = 'tournamentInfo';
  tournamentInfo.className = 'flex flex-wrap items-center gap-4 text-gray-400';

  headerLeft.appendChild(tournamentName);
  headerLeft.appendChild(tournamentInfo);

  const actionsDiv = document.createElement('div');
  actionsDiv.id = 'tournamentActions';
  actionsDiv.className = 'flex flex-wrap gap-2';

  headerRow.appendChild(headerLeft);
  headerRow.appendChild(actionsDiv);

  const statusDiv = document.createElement('div');
  statusDiv.id = 'tournamentStatus';
  statusDiv.className = 'mt-4 flex items-center space-x-2';

  headerCard.appendChild(headerRow);
  headerCard.appendChild(statusDiv);
  container.appendChild(headerCard);

  // Winner banner (will be shown when tournament is completed)
  const winnerBanner = document.createElement('div');
  winnerBanner.id = 'winnerBanner';
  winnerBanner.className = 'hidden mb-6';
  container.appendChild(winnerBanner);

  // Main grid
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

  // Bracket section (takes 2 columns)
  const bracketCol = document.createElement('div');
  bracketCol.className = 'lg:col-span-2';

  const bracketCard = document.createElement('div');
  bracketCard.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl';

  const bracketHeader = document.createElement('div');
  bracketHeader.className = 'flex items-center space-x-3 mb-6';
  const bracketIcon = document.createElement('span');
  bracketIcon.className = 'text-3xl';
  bracketIcon.textContent = '🏆';
  const bracketTitle = document.createElement('h2');
  bracketTitle.className = 'text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent';
  bracketTitle.textContent = 'Tournament Bracket';
  bracketHeader.appendChild(bracketIcon);
  bracketHeader.appendChild(bracketTitle);

  const bracketContainer = document.createElement('div');
  bracketContainer.id = 'bracketContainer';
  bracketContainer.className = 'space-y-6';

  const bracketLoading = document.createElement('div');
  bracketLoading.className = 'text-center py-12';
  const spinner = document.createElement('div');
  spinner.className = 'inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4';
  const loadingText = document.createElement('p');
  loadingText.className = 'text-gray-400';
  loadingText.textContent = 'Loading bracket...';
  bracketLoading.appendChild(spinner);
  bracketLoading.appendChild(loadingText);
  bracketContainer.appendChild(bracketLoading);

  bracketCard.appendChild(bracketHeader);
  bracketCard.appendChild(bracketContainer);
  bracketCol.appendChild(bracketCard);

  // Right column - players & game
  const rightCol = document.createElement('div');
  rightCol.className = 'space-y-6';

  // Players card
  const playersCard = document.createElement('div');
  playersCard.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl';

  const playersHeader = document.createElement('div');
  playersHeader.className = 'flex items-center space-x-3 mb-4';
  const playersIcon = document.createElement('span');
  playersIcon.className = 'text-2xl';
  playersIcon.textContent = '👥';
  const playersTitle = document.createElement('h3');
  playersTitle.className = 'text-xl font-bold text-white';
  playersTitle.textContent = 'Players';
  playersHeader.appendChild(playersIcon);
  playersHeader.appendChild(playersTitle);

  const playersList = document.createElement('div');
  playersList.id = 'playersList';
  playersList.className = 'space-y-2 max-h-96 overflow-y-auto';

  const playersLoading = document.createElement('div');
  playersLoading.className = 'text-center text-gray-400 py-4';
  playersLoading.textContent = 'Loading players...';
  playersList.appendChild(playersLoading);

  playersCard.appendChild(playersHeader);
  playersCard.appendChild(playersList);

  // Game section (hidden by default)
  const gameSection = document.createElement('div');
  gameSection.id = 'gameSection';
  gameSection.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl hidden';

  const gameHeader = document.createElement('div');
  gameHeader.className = 'flex items-center space-x-3 mb-4';
  const gameIcon = document.createElement('span');
  gameIcon.className = 'text-2xl';
  gameIcon.textContent = '🎮';
  const gameTitle = document.createElement('h3');
  gameTitle.className = 'text-xl font-bold text-white';
  gameTitle.textContent = 'Match in Progress';
  gameHeader.appendChild(gameIcon);
  gameHeader.appendChild(gameTitle);

  const matchInfo = document.createElement('div');
  matchInfo.id = 'currentMatchInfo';
  matchInfo.className = 'mb-4 p-4 bg-gray-700/30 rounded-xl';

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'aspect-video bg-gray-900 rounded-xl border-2 border-gray-700 mb-4 overflow-hidden';
  const canvas = document.createElement('canvas');
  canvas.id = 'tournamentCanvas';
  canvas.className = 'w-full h-full';
  canvasWrap.appendChild(canvas);

  const gameBtns = document.createElement('div');
  gameBtns.className = 'flex gap-2';
  const endGameBtn = document.createElement('button');
  endGameBtn.id = 'endGameBtn';
  endGameBtn.className = 'flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold rounded-xl transition-all duration-300';
  endGameBtn.textContent = 'End Game';
  const cancelGameBtn = document.createElement('button');
  cancelGameBtn.id = 'cancelGameBtn';
  cancelGameBtn.className = 'flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all duration-300';
  cancelGameBtn.textContent = 'Cancel';
  gameBtns.appendChild(endGameBtn);
  gameBtns.appendChild(cancelGameBtn);

  gameSection.appendChild(gameHeader);
  gameSection.appendChild(matchInfo);
  gameSection.appendChild(canvasWrap);
  gameSection.appendChild(gameBtns);

  rightCol.appendChild(playersCard);
  rightCol.appendChild(gameSection);

  grid.appendChild(bracketCol);
  grid.appendChild(rightCol);
  container.appendChild(grid);
  root.appendChild(container);
  app.appendChild(root);

  loadTournamentDetail(tournamentId);
}

let currentTournament: any = null;
let currentMatch: any = null;
let pongGame: PongGame | null = null;
// pollingInterval and isPolling are declared at top of file

async function loadTournamentDetail(tournamentId: string) {
  // Setup real-time tournament update listeners
  const { eventBus, Events } = await import('../services/eventBus');
  
  // Remove any existing listeners to prevent duplicates
  eventBus.clear(Events.TOURNAMENT_UPDATED);
  eventBus.clear(Events.TOURNAMENT_STARTED);
  eventBus.clear(Events.MATCH_READY);
  eventBus.clear(Events.TOURNAMENT_COMPLETED);
  
  const handleTournamentUpdate = (data: any) => {
    // Only reload if we're still on this tournament's page and tournament exists
    if (!data || data.tournamentId == tournamentId) {
      // Check if we're still on the tournament detail page
      if (!document.getElementById('tournamentName')) {
        return; // User navigated away, don't reload
      }
      
      // If tournament was deleted, redirect to tournaments list
      if (data && data.action === 'deleted') {
        showNotification('Tournament was deleted', 'info');
        router.navigate('/tournament');
        return;
      }
      
      loadTournamentDetail(tournamentId);
    }
  };
  
  eventBus.on(Events.TOURNAMENT_UPDATED, handleTournamentUpdate);
  eventBus.on(Events.TOURNAMENT_STARTED, handleTournamentUpdate);
  eventBus.on(Events.MATCH_READY, handleTournamentUpdate);
  eventBus.on(Events.TOURNAMENT_COMPLETED, handleTournamentUpdate);

  try {
    const response = await fetch(`/api/tournaments/${tournamentId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // Silently handle 404 errors (tournament was deleted)
      if (response.status === 404) {
        const tournamentNameEl = document.getElementById('tournamentName');
        const tournamentInfoEl = document.getElementById('tournamentInfo');
        if (tournamentNameEl) tournamentNameEl.textContent = 'Tournament not found';
        if (tournamentInfoEl) tournamentInfoEl.textContent = 'This tournament may have been deleted';
        return;
      }
      const errorMsg = data.error || 'Failed to load tournament';
      const errorDetails = data.details ? ` - ${data.details}` : '';
      throw new Error(errorMsg + errorDetails);
    }

    currentTournament = data;
    renderTournamentHeader();
    renderPlayersList();
    renderBracket();
    setupEventListeners();
  } catch (error) {
    // Errors are handled by UI, no need to log to console
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const tournamentNameEl = document.getElementById('tournamentName');
    const tournamentInfoEl = document.getElementById('tournamentInfo');
    if (tournamentNameEl) tournamentNameEl.textContent = 'Error loading tournament';
    if (tournamentInfoEl) tournamentInfoEl.textContent = errorMessage;
  }
}

// Setup WebSocket handler for tournament deletion warnings
chatService.onMessage((data) => {
  if (data.type === 'TOURNAMENT_DELETION_WARNING') {
    showDeletionCountdown(data.countdown, data.message);
  }
});

function renderTournamentHeader() {
  if (!currentTournament) return;

  const user = getCurrentUser();

  // Tournament name
  document.getElementById('tournamentName')!.textContent = currentTournament.name;

  // Tournament info
  const infoEl = document.getElementById('tournamentInfo')!;
  infoEl.textContent = '';

  const typeSpan = document.createElement('span');
  typeSpan.className = 'flex items-center space-x-1';
  const typeEmoji = document.createElement('span');
  typeEmoji.textContent = '⚔️';
  const typeText = document.createElement('span');
  typeText.textContent = currentTournament.type.replace('_', ' ');
  typeSpan.appendChild(typeEmoji);
  typeSpan.appendChild(typeText);

  const playersSpan = document.createElement('span');
  playersSpan.className = 'flex items-center space-x-1';
  const playersEmoji = document.createElement('span');
  playersEmoji.textContent = '👥';
  const playersText = document.createElement('span');
  playersText.textContent = `${currentTournament.currentPlayers}/${currentTournament.maxPlayers} players`;
  playersSpan.appendChild(playersEmoji);
  playersSpan.appendChild(playersText);

  const creatorSpan = document.createElement('span');
  creatorSpan.className = 'flex items-center space-x-1';
  const creatorEmoji = document.createElement('span');
  creatorEmoji.textContent = '👤';
  const creatorText = document.createElement('span');
  creatorText.textContent = currentTournament.creatorUsername
    ? `Created by @${currentTournament.creatorUsername}`
    : `Created by User ${String(currentTournament.createdBy)}`;
  creatorSpan.appendChild(creatorEmoji);
  creatorSpan.appendChild(creatorText);

  infoEl.appendChild(typeSpan);
  infoEl.appendChild(playersSpan);
  infoEl.appendChild(creatorSpan);

  // Status badge
  const statusEl = document.getElementById('tournamentStatus')!;
  statusEl.textContent = '';

  const statusLabel = document.createElement('span');
  statusLabel.className = 'text-gray-400 text-sm';
  statusLabel.textContent = 'Status:';

  const statusBadge = document.createElement('span');
  statusBadge.className = 'px-4 py-2 text-sm font-bold rounded-full text-white ' + (
    currentTournament.status === 'waiting' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
      currentTournament.status === 'in_progress' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 animate-pulse' :
        'bg-gradient-to-r from-emerald-500 to-green-500'
  );
  statusBadge.textContent = currentTournament.status.replace('_', ' ').toUpperCase();

  statusEl.appendChild(statusLabel);
  statusEl.appendChild(statusBadge);
  // Action buttons
  const actionsContainer = document.getElementById('tournamentActions')!;
  actionsContainer.textContent = '';

  const isFull = currentTournament.currentPlayers >= currentTournament.maxPlayers;
  // Fix type mismatch: convert both to numbers for comparison
  const userId = user?.id ? Number(user.id) : null;
  const creatorId = Number(currentTournament.createdBy);
  const isCreator = userId !== null && userId === creatorId;
  // Admin override: admin can always start tournaments
  const isAdmin = user?.username === 'admin';
  const canStart = isCreator || isAdmin;
  
  // Check if user has already joined
  const hasJoined = userId !== null && currentTournament.players?.some((p: any) => Number(p.id) === userId);
  
  if (currentTournament.status === 'waiting') {
    // Show join button only if not full, not started, and user hasn't joined
    if (!isFull && !hasJoined) {
      const joinBtn = document.createElement('button');
      joinBtn.id = 'joinTournamentBtn';
      joinBtn.className = 'px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 transform hover:-translate-y-1';
      const joinSpan = document.createElement('span');
      joinSpan.className = 'flex items-center space-x-2';
      const joinEmoji = document.createElement('span');
      joinEmoji.textContent = '🎮';
      const joinText = document.createElement('span');
      joinText.textContent = 'Join Tournament';
      joinSpan.appendChild(joinEmoji);
      joinSpan.appendChild(joinText);
      joinBtn.appendChild(joinSpan);
      actionsContainer.appendChild(joinBtn);
    } else if (hasJoined && !isFull) {
      // Show "Already Joined" badge
      const joinedBadge = document.createElement('span');
      joinedBadge.className = 'px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 font-bold rounded-xl flex items-center space-x-2';
      const joinedEmoji = document.createElement('span');
      joinedEmoji.textContent = '✅';
      const joinedText = document.createElement('span');
      joinedText.textContent = 'Already Joined';
      joinedBadge.appendChild(joinedEmoji);
      joinedBadge.appendChild(joinedText);
      actionsContainer.appendChild(joinedBadge);
    }

    // Show start button for creator or admin
    if (canStart) {
      const startBtn = document.createElement('button');
      startBtn.id = 'startTournamentBtn';
      
      // Disable start button if tournament is not full
      if (!isFull) {
        startBtn.className = 'px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-gray-300 font-bold rounded-xl shadow-lg cursor-not-allowed opacity-70';
        startBtn.disabled = true;
        startBtn.title = `Tournament must be full to start (${currentTournament.currentPlayers}/${currentTournament.maxPlayers} players)`;
      } else {
        startBtn.className = 'px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:-translate-y-1';
      }
      
      const startSpan = document.createElement('span');
      startSpan.className = 'flex items-center space-x-2';
      const startEmoji = document.createElement('span');
      startEmoji.textContent = '🚀';
      const startText = document.createElement('span');
      startText.textContent = isFull ? 'Start Tournament' : `Waiting for Players (${currentTournament.currentPlayers}/${currentTournament.maxPlayers})`;
      startSpan.appendChild(startEmoji);
      startSpan.appendChild(startText);
      startBtn.appendChild(startSpan);
      actionsContainer.appendChild(startBtn);
    }

    // Show delete button for creator or admin (not during finals or completed)
    if (canStart && currentTournament.status !== 'completed') {
      // Check if tournament is in finals
      const matches = currentTournament.matches || [];
      const maxRound = Math.max(...matches.map((m: any) => m.roundNumber), 0);
      const totalRounds = Math.ceil(Math.log2(currentTournament.maxPlayers));
      const isFinals = maxRound === totalRounds;

      if (!isFinals) {
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'deleteTournamentBtn';
        deleteBtn.className = 'px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg hover:shadow-red-500/25 transition-all duration-300 transform hover:-translate-y-1';

        const deleteSpan = document.createElement('span');
        deleteSpan.className = 'flex items-center space-x-2';

        const deleteEmoji = document.createElement('span');
        deleteEmoji.textContent = '🗑️';

        const deleteText = document.createElement('span');
        deleteText.textContent = 'Delete Tournament';

        deleteSpan.appendChild(deleteEmoji);
        deleteSpan.appendChild(deleteText);
        deleteBtn.appendChild(deleteSpan);

        actionsContainer.appendChild(deleteBtn);
      }
    }
  } else if (currentTournament.status === 'in_progress') {
    const inProgressSpan = document.createElement('span');
    inProgressSpan.className = 'px-4 py-2 text-gray-400 flex items-center space-x-2';
    const progressEmoji = document.createElement('span');
    progressEmoji.className = 'text-xl animate-pulse';
    progressEmoji.textContent = '⚡';
    const progressText = document.createElement('span');
    progressText.textContent = 'Tournament in progress';
    inProgressSpan.appendChild(progressEmoji);
    inProgressSpan.appendChild(progressText);
    actionsContainer.appendChild(inProgressSpan);
  } else {
    const completedSpan = document.createElement('span');
    completedSpan.className = 'px-4 py-2 text-gray-400 flex items-center space-x-2';
    const completedEmoji = document.createElement('span');
    completedEmoji.className = 'text-xl';
    completedEmoji.textContent = '🏆';
    const completedText = document.createElement('span');
    completedText.textContent = 'Tournament completed';
    completedSpan.appendChild(completedEmoji);
    completedSpan.appendChild(completedText);
    actionsContainer.appendChild(completedSpan);
  }

  // Render winner banner if tournament is completed
  renderWinnerBanner();
}

function renderWinnerBanner() {
  const winnerBannerEl = document.getElementById('winnerBanner');
  if (!winnerBannerEl || !currentTournament) return;

  // Only show if tournament is completed
  if (currentTournament.status !== 'completed') {
    winnerBannerEl.className = 'hidden mb-6';
    return;
  }

  // Find the final match (highest round number with a winner)
  const completedMatches = currentTournament.matches?.filter((m: any) => m.status === 'completed' && m.winner_id) || [];
  if (completedMatches.length === 0) {
    winnerBannerEl.className = 'hidden mb-6';
    return;
  }

  // Get the match with the highest round number (the finals)
  const finalMatch = completedMatches.reduce((max: any, match: any) =>
    match.round_number > (max?.round_number || 0) ? match : max
    , null);

  if (!finalMatch || !finalMatch.winner_id) {
    winnerBannerEl.className = 'hidden mb-6';
    return;
  }

  // Get winner details
  const winner = currentTournament.players?.find((p: any) => p.id === finalMatch.winner_id);
  const winnerName = winner?.username || `User ${finalMatch.winner_id}`;

  // Clear and show banner
  winnerBannerEl.textContent = '';
  winnerBannerEl.className = 'mb-6';

  // Create celebration banner
  const banner = document.createElement('div');
  banner.className = 'bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 backdrop-blur-lg rounded-2xl border-2 border-yellow-500/50 p-6 shadow-2xl relative overflow-hidden';

  // Content container
  const content = document.createElement('div');
  content.className = 'relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left';

  // Trophy icon
  const trophy = document.createElement('span');
  trophy.className = 'text-6xl md:text-7xl';
  trophy.textContent = '🏆';

  // Winner text
  const textContainer = document.createElement('div');
  textContainer.className = 'flex-1';

  const title = document.createElement('div');
  title.className = 'text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-200 via-yellow-100 to-yellow-200 bg-clip-text text-transparent mb-2';
  title.textContent = 'Tournament Champion';

  const winnerNameEl = document.createElement('div');
  winnerNameEl.className = 'text-3xl md:text-4xl font-black bg-gradient-to-r from-white to-yellow-100 bg-clip-text text-transparent';
  winnerNameEl.textContent = `@${winnerName}`;

  const congratsText = document.createElement('div');
  congratsText.className = 'mt-2 text-yellow-200/80 text-sm md:text-base';
  congratsText.textContent = '🎉 Congratulations on your victory! 🎉';

  textContainer.appendChild(title);
  textContainer.appendChild(winnerNameEl);
  textContainer.appendChild(congratsText);

  // Confetti emoji
  const confetti = document.createElement('span');
  confetti.className = 'hidden md:block text-4xl';
  confetti.textContent = '🎊';

  content.appendChild(trophy);
  content.appendChild(textContainer);
  content.appendChild(confetti);

  banner.appendChild(content);
  winnerBannerEl.appendChild(banner);
}

function renderPlayersList() {
  if (!currentTournament) return;

  const container = document.getElementById('playersList')!;

  if (currentTournament.players.length === 0) {
    container.textContent = '';
    const noPlayers = document.createElement('div');
    noPlayers.className = 'text-center py-8';
    const emoji = document.createElement('div');
    emoji.className = 'text-4xl mb-2';
    emoji.textContent = '👥';
    const text = document.createElement('div');
    text.className = 'text-gray-500 text-sm';
    text.textContent = 'No players yet';
    noPlayers.appendChild(emoji);
    noPlayers.appendChild(text);
    container.appendChild(noPlayers);
    return;
  }

  container.textContent = '';
  currentTournament.players.forEach((player: any, index: number) => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-all duration-300 group';

    const left = document.createElement('div');
    left.className = 'flex items-center gap-3';

    const rank = document.createElement('div');
    rank.className = 'text-sm font-bold text-gray-500 w-6';
    rank.textContent = `#${index + 1}`;

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'relative';

    const img = document.createElement('img');
    const avatar = typeof player.avatarUrl === 'string' ? player.avatarUrl : '';
    if (/^(https?:)?\/\//i.test(avatar) || avatar.startsWith('/')) {
      img.src = avatar;
    } else {
      img.src = '/public/default-avatar.svg';
    }
    img.alt = String(player.username || 'avatar');
    img.className = 'w-10 h-10 rounded-full border-2 border-gray-600 group-hover:border-purple-500 object-cover transition-all duration-300';
    img.onerror = () => { img.src = '/public/default-avatar.svg'; };

    avatarWrap.appendChild(img);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-sm font-medium text-white';
    nameSpan.textContent = String(player.username || 'Unknown');

    left.appendChild(rank);
    left.appendChild(avatarWrap);
    left.appendChild(nameSpan);
    row.appendChild(left);

    container.appendChild(row);
  });
}

function renderBracket() {
  if (!currentTournament) return;

  const container = document.getElementById('bracketContainer')!;

  if (!currentTournament.matches || currentTournament.matches.length === 0) {
    container.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'text-center py-12';
    const emoji = document.createElement('div');
    emoji.className = 'text-6xl mb-4';
    const message = document.createElement('p');
    message.className = 'text-gray-400 text-lg';

    if (currentTournament.status === 'waiting') {
      emoji.textContent = '⏳';
      message.textContent = 'Bracket will be generated when tournament starts';
    } else {
      emoji.textContent = '❓';
      message.textContent = 'No matches found';
    }

    empty.appendChild(emoji);
    empty.appendChild(message);
    container.appendChild(empty);
    return;
  }

  // Group matches by round
  const rounds: { [key: number]: any[] } = {};
  currentTournament.matches.forEach((match: any) => {
    if (!rounds[match.roundNumber]) {
      rounds[match.roundNumber] = [];
    }
    rounds[match.roundNumber].push(match);
  });

  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  // Rebuild bracket with modern styling - VERTICAL LAYOUT (Reverted)
  container.textContent = '';

  roundNumbers.forEach(roundNumber => {
    const roundWrap = document.createElement('div');
    roundWrap.className = 'mb-8 last:mb-0';

    const roundHeader = document.createElement('div');
    roundHeader.className = 'flex items-center space-x-3 mb-4';

    const roundBadge = document.createElement('div');
    roundBadge.className = 'px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl';
    const roundTitle = document.createElement('h4');
    roundTitle.className = 'font-bold text-white';
    const totalRounds = roundNumbers.length;
    const roundName = roundNumber === totalRounds ? '🏆 Finals' :
      roundNumber === totalRounds - 1 ? '🥇 Semi-Finals' :
        `Round ${roundNumber}`;
    roundTitle.textContent = roundName;
    roundBadge.appendChild(roundTitle);
    roundHeader.appendChild(roundBadge);

    roundWrap.appendChild(roundHeader);

    const matchesGrid = document.createElement('div');
    matchesGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

    rounds[roundNumber].forEach((match: any) => {
      // Create match card - simplified structure
      const matchCard = document.createElement('div');
      matchCard.className = 'bg-gray-700/30 rounded-xl p-4 border-l-4 transition-all duration-300 hover:bg-gray-700/50 ' +
        (match.status === 'completed' ? 'border-emerald-500' :
          match.status === 'in_progress' ? 'border-amber-500 animate-pulse' :
            match.status === 'ready' ? 'border-blue-500' :
              'border-gray-600');

      const matchHeader = document.createElement('div');
      matchHeader.className = 'flex justify-between items-center mb-3';

      const matchLabel = document.createElement('span');
      matchLabel.className = 'text-xs font-bold text-gray-400 uppercase tracking-wider';
      matchLabel.textContent = `Match ${match.matchNumber}`;

      const statusBadge = document.createElement('span');
      statusBadge.className = 'text-xs px-2 py-1 rounded-full font-bold ' +
        (match.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
          match.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
            match.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
              'bg-gray-600/20 text-gray-400');
      statusBadge.textContent = match.status.replace('_', ' ');

      matchHeader.appendChild(matchLabel);
      matchHeader.appendChild(statusBadge);
      matchCard.appendChild(matchHeader);

      // Players
      const playersDiv = document.createElement('div');
      playersDiv.className = 'space-y-2 mb-3';

      // Player 1
      const p1Row = document.createElement('div');
      p1Row.className = 'flex justify-between items-center p-2 rounded-lg ' +
        (match.winnerId === match.player1Id ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-gray-800/30');

      const p1Name = document.createElement('span');
      p1Name.className = 'font-medium ' +
        (match.winnerId === match.player1Id ? 'text-emerald-400' :
          match.status === 'completed' ? 'text-gray-500' : 'text-white');
      p1Name.textContent = match.player1Username || 'TBD';

      const p1Score = document.createElement('span');
      p1Score.className = 'font-bold ' +
        (match.winnerId === match.player1Id ? 'text-emerald-400' : 'text-gray-400');
      p1Score.textContent = String(match.scorePlayer1 || 0);

      p1Row.appendChild(p1Name);
      p1Row.appendChild(p1Score);

      // VS divider
      const vsDiv = document.createElement('div');
      vsDiv.className = 'text-center text-xs font-bold text-gray-500';
      vsDiv.textContent = 'VS';

      // Player 2
      const p2Row = document.createElement('div');
      p2Row.className = 'flex justify-between items-center p-2 rounded-lg ' +
        (match.winnerId === match.player2Id ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-gray-800/30');

      const p2Name = document.createElement('span');
      p2Name.className = 'font-medium ' +
        (match.winnerId === match.player2Id ? 'text-emerald-400' :
          match.status === 'completed' ? 'text-gray-500' : 'text-white');
      p2Name.textContent = match.player2Username || 'TBD';

      const p2Score = document.createElement('span');
      p2Score.className = 'font-bold ' +
        (match.winnerId === match.player2Id ? 'text-emerald-400' : 'text-gray-400');
      p2Score.textContent = String(match.scorePlayer2 || 0);

      p2Row.appendChild(p2Name);
      p2Row.appendChild(p2Score);

      playersDiv.appendChild(p1Row);
      playersDiv.appendChild(vsDiv);
      playersDiv.appendChild(p2Row);
      matchCard.appendChild(playersDiv);

      const user = getCurrentUser();
      const isPlayer = user && (match.player1Id === user.id || match.player2Id === user.id);
      const isPlayer1 = user && match.player1Id === user.id;
      const isPlayer2 = user && match.player2Id === user.id;
      const currentPlayerAccepted = (isPlayer1 && match.player1Accepted) || (isPlayer2 && match.player2Accepted);
      const opponentAccepted = (isPlayer1 && match.player2Accepted) || (isPlayer2 && match.player1Accepted);

      // Match state handling
      if (match.status === 'ready') {
        if (isPlayer) {
          if (!currentPlayerAccepted) {
            // Show Accept Match button
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'w-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg';
            const acceptSpan = document.createElement('span');
            acceptSpan.className = 'flex items-center justify-center space-x-2';
            const acceptEmoji = document.createElement('span');
            acceptEmoji.textContent = '✅';
            const acceptText = document.createElement('span');
            acceptText.textContent = 'Accept Match';
            acceptSpan.appendChild(acceptEmoji);
            acceptSpan.appendChild(acceptText);
            acceptBtn.appendChild(acceptSpan);
            acceptBtn.addEventListener('click', () => acceptMatch(String(match.id)));
            matchCard.appendChild(acceptBtn);
          } else if (!opponentAccepted) {
            // Show waiting for opponent
            const waitingDiv = document.createElement('div');
            waitingDiv.className = 'w-full px-4 py-2 bg-blue-500/20 text-blue-300 text-center rounded-lg text-sm flex items-center justify-center space-x-2';
            const waitingEmoji = document.createElement('span');
            waitingEmoji.className = 'animate-pulse';
            waitingEmoji.textContent = '⏳';
            const waitingText = document.createElement('span');
            waitingText.textContent = 'Waiting for opponent to accept...';
            waitingDiv.appendChild(waitingEmoji);
            waitingDiv.appendChild(waitingText);
            matchCard.appendChild(waitingDiv);
          }
        } else {
          // Spectator view
          const spectatorDiv = document.createElement('div');
          spectatorDiv.className = 'w-full px-4 py-2 bg-gray-700/30 text-gray-400 text-center rounded-lg text-sm';
          spectatorDiv.textContent = '👁️ Match ready - Players only';
          matchCard.appendChild(spectatorDiv);
        }
      } else if (match.status === 'accepted') {
        // Both players accepted - show countdown
        if (isPlayer) {
          const countdownDiv = document.createElement('div');
          countdownDiv.id = `countdown-${match.id}`;
          countdownDiv.className = 'w-full px-4 py-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-yellow-300 text-center rounded-lg font-bold text-lg';
          countdownDiv.textContent = 'Starting soon...';
          matchCard.appendChild(countdownDiv);

          // Start countdown automatically
          setTimeout(() => startMatchCountdown(String(match.id)), 100);
        } else {
          const spectatorDiv = document.createElement('div');
          spectatorDiv.className = 'w-full px-4 py-2 bg-yellow-500/20 text-yellow-300 text-center rounded-lg text-sm';
          spectatorDiv.textContent = '⚡ Match starting soon...';
          matchCard.appendChild(spectatorDiv);
        }
      } else if (match.status === 'in_progress') {
        // Match in progress
        const inProgressDiv = document.createElement('div');
        inProgressDiv.className = 'w-full px-4 py-2 bg-purple-500/20 text-purple-300 text-center rounded-lg text-sm animate-pulse';
        inProgressDiv.textContent = '🎮 Match in progress...';
        matchCard.appendChild(inProgressDiv);
      }

      matchesGrid.appendChild(matchCard);
    });

    roundWrap.appendChild(matchesGrid);
    container.appendChild(roundWrap);
  });

}

function setupEventListeners() {
  // Start tournament
  const startBtn = document.getElementById('startTournamentBtn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if (!currentTournament) return;
      
      // Prevent double-clicks
      if (startBtn.hasAttribute('disabled')) return;
      startBtn.setAttribute('disabled', 'true');

      try {
        const response = await fetch(`/api/tournaments/${currentTournament.id}/start`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        const data = await response.json();

        if (response.ok) {
          showNotification('🚀 Tournament started! Bracket generated.', 'success');
          loadTournamentDetail(currentTournament.id);
        } else {
          showNotification(`❌ ${data.error || 'Failed to start tournament'}`, 'error');
        }
      } catch (error) {
        showNotification('Failed to start tournament', 'error');
      } finally {
        startBtn.removeAttribute('disabled');
      }
    });
  }

  // Join tournament
  const joinBtn = document.getElementById('joinTournamentBtn');
  if (joinBtn) {
    joinBtn.addEventListener('click', async () => {
      if (!currentTournament) return;
      const user = getCurrentUser();
      if (!user) {
        showNotification('Please log in to join', 'error');
        return;
      }

      try {
        const response = await fetch(`/api/tournaments/${currentTournament.id}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ userId: user.id })
        });

        const data = await response.json();

        if (response.ok) {
          showNotification('Successfully joined tournament!', 'success');
          loadTournamentDetail(currentTournament.id);
        } else {
          showNotification(`❌ ${data.error}`, 'error');
        }
      } catch (error) {
        showNotification('Failed to join tournament', 'error');
      }
    });
  }

  // Delete tournament
  const deleteBtn = document.getElementById('deleteTournamentBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!currentTournament) return;

      // Show confirmation dialog
      const confirmed = await showDeleteConfirmation();
      if (!confirmed) return;

      try {
        const response = await fetch(`/api/tournaments/${currentTournament.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
          }
        });

        const data = await response.json();

        if (response.ok) {
          showNotification('🗑️ Tournament deleted successfully', 'success');
          // Dispatch event to refresh tournament list
          window.dispatchEvent(new CustomEvent('tournament-deleted'));
          // Redirect to tournaments page after 1 second
          setTimeout(() => router.navigate('/tournament'), 1000);
        } else {
          showNotification(`❌ Failed to delete: ${data.error}`, 'error');
        }
      } catch (error) {
        showNotification('Failed to delete tournament', 'error');
      }
    });
  }
}

function startPolling() {
  if (isPolling || !currentTournament) return;
  isPolling = true;

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/tournaments/${currentTournament.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        // Stop polling on 404 (tournament deleted) - don't log expected errors
        if (response.status === 404) {
          stopPolling();
        }
        return;
      }

      const data = await response.json();
      const oldTournament = currentTournament;
      currentTournament = data;

      // Check if any match status changed to 'accepted'
      const user = getCurrentUser();
      if (user) {
        const userMatch = currentTournament.matches?.find((m: any) =>
          (m.player1Id === user.id || m.player2Id === user.id) && m.status === 'accepted'
        );

        if (userMatch) {
          stopPolling();
          renderBracket();
          return;
        }
      }

      // Update UI if there are changes
      renderBracket();    } catch (error) {
      // Silently handle polling errors - will retry on next interval
    }
  }, 2000); // Poll every 2 seconds
}

// stopPolling is declared at top of file

// Cleanup polling on page unload
window.addEventListener('beforeunload', () => {
  stopPolling();
});

async function startMatch(matchId: string) {
  if (!currentTournament) return;

  const match = currentTournament.matches.find((m: any) => m.id == matchId);
  if (!match) return;

  // Check if match is already completed - don't navigate
  if (match.status === 'completed') {
    showNotification('This match has already been completed', 'info');
    // Cleanup countdown tracking for this match
    delete countdownStarted[matchId];
    if (countdownIntervals[matchId]) {
      clearInterval(countdownIntervals[matchId]);
      delete countdownIntervals[matchId];
    }
    // Reload to get latest state
    await loadTournamentDetail(currentTournament.id);
    return;
  }

  // Stop polling before navigation
  stopPolling();
  
  // Cleanup countdowns
  cleanupCountdowns();

  // Navigate to REMOTE game page for synchronized multi-browser play
  router.navigate(`/remote-game?tournament=${currentTournament.id}&match=${matchId}`);
}

async function acceptMatch(matchId: string) {
  if (!currentTournament) return;

  const user = getCurrentUser();
  if (!user) {
    showNotification('Please log in', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/tournaments/${currentTournament.id}/matches/${matchId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userId: user.id })
    });

    const data = await response.json();

    if (response.ok) {
      if (data.bothAccepted) {
        showNotification('Both players ready! Match starting soon...', 'success');
        stopPolling(); // Stop polling if both accepted
      } else {
        showNotification('⏳ Waiting for opponent to accept...', 'info');
        startPolling(); // Start polling to detect when opponent accepts
      }
      // Reload tournament to update UI
      await loadTournamentDetail(currentTournament.id);
    } else {
      showNotification(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    showNotification('Failed to accept match', 'error');
  }
}

// countdownIntervals and countdownStarted are declared at top of file

async function startMatchCountdown(matchId: string) {
  if (!currentTournament) return;

  // Prevent starting multiple countdowns for the same match
  if (countdownStarted[matchId]) {
    return;
  }

  const countdownEl = document.getElementById(`countdown-${matchId}`);
  if (!countdownEl) return;

  // Mark countdown as started
  countdownStarted[matchId] = true;

  let timeLeft = 5;

  // Clear any existing countdown for this match
  if (countdownIntervals[matchId]) {
    clearInterval(countdownIntervals[matchId]);
  }

  const updateCountdown = () => {
    // Check if match is still valid (not completed)
    const match = currentTournament?.matches?.find((m: any) => m.id == matchId);
    if (!match || match.status === 'completed') {
      if (countdownIntervals[matchId]) {
        clearInterval(countdownIntervals[matchId]);
        delete countdownIntervals[matchId];
      }
      delete countdownStarted[matchId];
      return;
    }

    if (timeLeft > 0) {
      countdownEl.textContent = `Starting in ${timeLeft}...`;
      countdownEl.className = 'w-full px-4 py-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-yellow-300 text-center rounded-lg font-bold text-2xl animate-pulse';
      timeLeft--;
    } else {
      countdownEl.textContent = 'GO! 🚀';
      countdownEl.className = 'w-full px-4 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300 text-center rounded-lg font-bold text-3xl animate-bounce';

      // Clear interval
      if (countdownIntervals[matchId]) {
        clearInterval(countdownIntervals[matchId]);
        delete countdownIntervals[matchId];
      }

      // Start the match after a brief delay
      setTimeout(() => {
        startMatch(matchId);
      }, 500);
    }
  };

  // Initial update
  updateCountdown();

  // Update every second
  countdownIntervals[matchId] = setInterval(updateCountdown, 1000);
}

function endGameSession() {
  document.getElementById('gameSection')!.classList.add('hidden');

  if (pongGame) {
    pongGame.stop();
    pongGame = null;
  }

  currentMatch = null;
}

function showDeleteConfirmation(): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';

    const modal = document.createElement('div');
    modal.className = 'bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-red-500/30 p-6 max-w-md w-full shadow-2xl';

    const title = document.createElement('h3');
    title.className = 'text-2xl font-bold text-white mb-4 flex items-center space-x-2';
    const icon = document.createElement('span');
    icon.textContent = '⚠️';
    const titleText = document.createElement('span');
    titleText.textContent = 'Delete Tournament?';
    title.appendChild(icon);
    title.appendChild(titleText);

    const message = document.createElement('div');
    message.className = 'text-gray-300 mb-6 space-y-2';

    const p1 = document.createElement('p');
    p1.textContent = 'This will:';

    const ul = document.createElement('ul');
    ul.className = 'list-disc list-inside space-y-1 text-sm';

    const li1 = document.createElement('li');
    li1.textContent = 'Notify active players (5 second countdown)';

    const li2 = document.createElement('li');
    li2.textContent = 'Award tournament points based on rounds reached';

    const li3 = document.createElement('li');
    li3.textContent = 'Permanently delete the tournament';

    ul.appendChild(li1);
    ul.appendChild(li2);
    ul.appendChild(li3);

    const warning = document.createElement('p');
    warning.className = 'text-red-400 font-bold mt-3';
    warning.textContent = '⚠️ This action cannot be undone!';

    message.appendChild(p1);
    message.appendChild(ul);
    message.appendChild(warning);

    const btnContainer = document.createElement('div');
    btnContainer.className = 'flex gap-3';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all duration-300';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold rounded-xl transition-all duration-300';
    confirmBtn.textContent = 'Delete';
    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);

    modal.appendChild(title);
    modal.appendChild(message);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

function showDeletionCountdown(seconds: number, message: string) {
  // Create countdown overlay
  const overlay = document.createElement('div');
  overlay.id = 'deletionWarning';
  overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center';

  const modal = document.createElement('div');
  modal.className = 'bg-gradient-to-br from-red-900/90 to-pink-900/90 rounded-2xl border-2 border-red-500 p-8 max-w-md w-full shadow-2xl animate-pulse';

  const icon = document.createElement('div');
  icon.className = 'text-6xl text-center mb-4';
  icon.textContent = '⚠️';

  const title = document.createElement('h2');
  title.className = 'text-3xl font-bold text-white text-center mb-4';
  title.textContent = 'Tournament Deletion';

  const msg = document.createElement('p');
  msg.className = 'text-white text-center mb-6';
  msg.textContent = message;

  const countdown = document.createElement('div');
  countdown.id = 'deletionCountdown';
  countdown.className = 'text-6xl font-bold text-red-300 text-center';
  countdown.textContent = seconds.toString();

  modal.appendChild(icon);
  modal.appendChild(title);
  modal.appendChild(msg);
  modal.appendChild(countdown);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Countdown timer
  let timeLeft = seconds;
  const interval = setInterval(() => {
    timeLeft--;
    const countdownEl = document.getElementById('deletionCountdown');
    if (countdownEl) {
      countdownEl.textContent = timeLeft.toString();
    }

    if (timeLeft <= 0) {
      clearInterval(interval);
      // Redirect to tournaments page
      router.navigate('/tournament');
    }
  }, 1000);
}

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
  const notification = document.createElement('div');
  notification.className = `
    fixed top-20 right-4 px-6 py-4 rounded-xl shadow-2xl z-[9999] transform translate-x-full transition-transform duration-300
    ${type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
      type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600' :
        'bg-gradient-to-r from-blue-500 to-purple-600'}
  `;

  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center space-x-3';
  const icon = document.createElement('span');
  icon.className = 'text-xl';
  icon.textContent = (type === 'success' ? '✨' : type === 'error' ? '❌' : 'ℹ️');
  const msgSpan = document.createElement('span');
  msgSpan.className = 'font-semibold text-white';
  msgSpan.textContent = message;
  wrapper.appendChild(icon);
  wrapper.appendChild(msgSpan);
  notification.appendChild(wrapper);

  document.body.appendChild(notification);

  requestAnimationFrame(() => {
    notification.classList.remove('translate-x-full');
    notification.classList.add('translate-x-0');
  });

  setTimeout(() => {
    notification.classList.remove('translate-x-0');
    notification.classList.add('translate-x-full');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}