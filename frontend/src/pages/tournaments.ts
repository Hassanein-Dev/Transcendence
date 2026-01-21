import { router } from "../router";
import { getCurrentUser } from "../stores/authState";
import { eventBus, Events } from "../services/eventBus";

export function renderTournaments() {
  const app = document.getElementById("app")!;
  const user = getCurrentUser();

  // Build the tournaments page DOM safely without using innerHTML
  const root = document.createElement('div');
  root.className = 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 relative p-4 md:p-8';

  // Animated background
  const animatedBg = document.createElement('div');
  animatedBg.className = 'absolute inset-0 overflow-hidden';
  const radial = document.createElement('div');
  radial.className = 'absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent';
  const blueCircle = document.createElement('div');
  blueCircle.className = 'absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl';
  animatedBg.appendChild(radial);
  animatedBg.appendChild(blueCircle);
  root.appendChild(animatedBg);

  const container = document.createElement('div');
  container.className = 'max-w-6xl mx-auto relative';

  // Header
  const headerWrap = document.createElement('div');
  headerWrap.className = 'mb-8';
  const headerRow = document.createElement('div');
  headerRow.className = 'flex justify-between items-center mb-6';
  const leftHeader = document.createElement('div');
  const h1 = document.createElement('h1');
  h1.className = 'text-4xl font-bold flex items-center gap-3';
  
  const emoji = document.createElement('span');
  emoji.textContent = '🏆';
  
  const titleText = document.createElement('span');
  titleText.className = 'bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent';
  titleText.textContent = 'Tournaments';
  
  h1.appendChild(emoji);
  h1.appendChild(titleText);
  
  const p = document.createElement('p');
  p.className = 'text-gray-400 mt-2';
  p.textContent = 'Compete for glory in our Pong tournaments';
  leftHeader.appendChild(h1);
  leftHeader.appendChild(p);

  const createBtn = document.createElement('button');
  createBtn.id = 'createTournamentBtn';
  createBtn.className = 'px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 transform hover:-translate-y-1';
  const createBtnSpan = document.createElement('span');
  createBtnSpan.className = 'flex items-center space-x-2';
  const sparkle = document.createElement('span');
  sparkle.className = 'text-xl';
  sparkle.textContent = '✨';
  const createText = document.createElement('span');
  createText.textContent = 'Create Tournament';
  createBtnSpan.appendChild(sparkle);
  createBtnSpan.appendChild(createText);
  createBtn.appendChild(createBtnSpan);

  headerRow.appendChild(leftHeader);
  headerRow.appendChild(createBtn);
  headerWrap.appendChild(headerRow);
  container.appendChild(headerWrap);

  // Tournament list placeholder
  const listWrap = document.createElement('div');
  listWrap.id = 'tournamentsList';
  listWrap.className = 'space-y-6';
  const loadingBlock = document.createElement('div');
  loadingBlock.className = 'text-center py-12';
  const spinner = document.createElement('div');
  spinner.className = 'inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4';
  const loadingText = document.createElement('p');
  loadingText.className = 'text-gray-400';
  loadingText.textContent = 'Loading tournaments...';
  loadingBlock.appendChild(spinner);
  loadingBlock.appendChild(loadingText);
  listWrap.appendChild(loadingBlock);
  container.appendChild(listWrap);

  // Create Tournament Modal
  const modal = document.createElement('div');
  modal.id = 'createTournamentModal';
  modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center hidden z-50 p-4';
  const modalInner = document.createElement('div');
  modalInner.className = 'bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md shadow-2xl';

  const modalHeader = document.createElement('div');
  modalHeader.className = 'flex justify-between items-center mb-6';
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent';
  modalTitle.textContent = '✨ Create Tournament';
  const closeModalBtn = document.createElement('button');
  closeModalBtn.id = 'closeModal';
  closeModalBtn.className = 'text-gray-400 hover:text-white text-2xl transition-colors';
  closeModalBtn.textContent = '×';
  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeModalBtn);

  const form = document.createElement('form');
  form.id = 'createTournamentForm';
  form.className = 'space-y-6';

  // Tournament Name
  const nameDiv = document.createElement('div');
  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  nameLabel.textContent = 'Tournament Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'tournamentName';
  nameInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all';
  nameInput.placeholder = 'Enter tournament name';
  nameInput.required = true;
  nameDiv.appendChild(nameLabel);
  nameDiv.appendChild(nameInput);

  // Max Players
  const maxDiv = document.createElement('div');
  const maxLabel = document.createElement('label');
  maxLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  maxLabel.textContent = 'Max Players';
  const maxSelect = document.createElement('select');
  maxSelect.id = 'maxPlayers';
  maxSelect.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all';
  ['4', '8',].forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = `${v} Players`;
    if (v === '8') opt.selected = true;
    maxSelect.appendChild(opt);
  });
  maxDiv.appendChild(maxLabel);
  maxDiv.appendChild(maxSelect);

  // Tournament Type (hidden - always single elimination)
  const typeInput = document.createElement('input');
  typeInput.type = 'hidden';
  typeInput.id = 'tournamentType';
  typeInput.value = 'single_elimination';

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'flex gap-3 pt-2';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-emerald-500/25';
  submitBtn.textContent = 'Create Tournament';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.id = 'cancelCreate';
  cancelBtn.className = 'flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl border border-gray-600 transition-all duration-300';
  cancelBtn.textContent = 'Cancel';
  btnRow.appendChild(submitBtn);
  btnRow.appendChild(cancelBtn);

  form.appendChild(nameDiv);
  form.appendChild(maxDiv);
  form.appendChild(typeInput);
  form.appendChild(btnRow);

  modalInner.appendChild(modalHeader);
  modalInner.appendChild(form);
  modal.appendChild(modalInner);

  container.appendChild(modal);
  root.appendChild(container);
  root.appendChild(modal);

  // Append to app
  app.textContent = '';
  app.appendChild(root);

  loadTournaments();
  setupEventListeners();
  
  // Listen for tournament deletion from detail page
  window.addEventListener('tournament-deleted', () => {
    loadTournaments();
  });
  
  // Listen for real-time tournament updates via WebSocket
  setupTournamentEventListeners();
}

function setupTournamentEventListeners() {
  const handleTournamentUpdate = () => {
    loadTournaments();
  };
  
  eventBus.on(Events.TOURNAMENT_UPDATED, handleTournamentUpdate);
  eventBus.on(Events.TOURNAMENT_STARTED, handleTournamentUpdate);
}

async function loadTournaments() {
  try {
    const response = await fetch('/api/tournaments', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    const container = document.getElementById('tournamentsList');
    
    // Check if user is still on tournaments page
    if (!container) {
      return; // User navigated away, silently exit
    }

    if (!response.ok) {
      container.textContent = '';
      const card = document.createElement('div');
      card.className = 'bg-gradient-to-r from-red-600/20 to-pink-600/20 backdrop-blur-sm rounded-2xl border border-red-500/20 p-6';
      const icon = document.createElement('div');
      icon.className = 'text-4xl mb-4';
      icon.textContent = '⚠️';
      const title = document.createElement('h3');
      title.className = 'text-lg font-bold text-white mb-2';
      title.textContent = 'Failed to load tournaments';
      const message = document.createElement('p');
      message.className = 'text-gray-400';
      message.textContent = data.error || 'Unknown error';
      card.appendChild(icon);
      card.appendChild(title);
      card.appendChild(message);
      container.appendChild(card);
      return;
    }

    if (data.length === 0) {
      container.textContent = '';
      const emptyCard = document.createElement('div');
      emptyCard.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-8 text-center shadow-xl';
      const emoji = document.createElement('div');
      emoji.className = 'text-6xl mb-4';
      emoji.textContent = '🏆';
      const titleEmpty = document.createElement('h3');
      titleEmpty.className = 'text-2xl font-bold text-white mb-2';
      titleEmpty.textContent = 'No tournaments yet';
      const pEmpty = document.createElement('p');
      pEmpty.className = 'text-gray-400 mb-6';
      pEmpty.textContent = 'Create the first tournament to get started!';
      const createBtn = document.createElement('button');
      createBtn.id = 'createFirstTournamentBtn';
      createBtn.className = 'px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 transform hover:-translate-y-1';
      createBtn.textContent = 'Create First Tournament';
      emptyCard.appendChild(emoji);
      emptyCard.appendChild(titleEmpty);
      emptyCard.appendChild(pEmpty);
      emptyCard.appendChild(createBtn);
      container.appendChild(emptyCard);

      document.getElementById('createFirstTournamentBtn')?.addEventListener('click', () => {
        document.getElementById('createTournamentModal')!.classList.remove('hidden');
      });
      return;
    }

    // Build tournament cards safely
    container.textContent = '';
    data.forEach((tournament: any) => {
      const card = document.createElement('div');
      card.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 hover:border-purple-500/30 transition-all duration-300 group hover:shadow-xl shadow-lg';

      const top = document.createElement('div');
      top.className = 'flex flex-col md:flex-row justify-between items-start mb-4';

      const left = document.createElement('div');
      left.className = 'flex-1 mb-4 md:mb-0';

      const titleRow = document.createElement('div');
      titleRow.className = 'flex items-center space-x-3 mb-2';
      const h3 = document.createElement('h3');
      h3.className = 'text-xl font-bold text-white transition-all duration-300';
      h3.textContent = tournament.name;
      const statusBadge = document.createElement('span');
      statusBadge.className = 'px-3 py-1 text-xs font-bold rounded-full text-white ' + (tournament.status === 'waiting' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : tournament.status === 'in_progress' ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 'bg-gradient-to-r from-emerald-500 to-green-500');
      statusBadge.textContent = tournament.status.replace('_', ' ');
      titleRow.appendChild(h3);
      titleRow.appendChild(statusBadge);

      const metaRow = document.createElement('div');
      metaRow.className = 'flex items-center space-x-4 text-sm text-gray-400';
      const typeSpan = document.createElement('span');
      typeSpan.className = 'flex items-center space-x-1';
      const typeEmoji = document.createElement('span');
      typeEmoji.textContent = '⚔️';
      typeSpan.appendChild(typeEmoji);
      const typeText = document.createElement('span');
      typeText.textContent = tournament.type.replace('_', ' ');
      typeSpan.appendChild(typeText);
      const playersSpan = document.createElement('span');
      playersSpan.className = 'flex items-center space-x-1';
      const playersEmoji = document.createElement('span');
      playersEmoji.textContent = '👥';
      playersSpan.appendChild(playersEmoji);
      const playersText = document.createElement('span');
      playersText.textContent = `${tournament.currentPlayers}/${tournament.maxPlayers} players`;
      playersSpan.appendChild(playersText);
      metaRow.appendChild(typeSpan);
      metaRow.appendChild(playersSpan);

      left.appendChild(titleRow);
      left.appendChild(metaRow);      const right = document.createElement('div');
      right.className = 'flex flex-wrap gap-2';
      const viewBtn = document.createElement('button');
      viewBtn.className = 'view-tournament px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg';
      viewBtn.setAttribute('data-tournament-id', String(tournament.id));
      viewBtn.textContent = 'View Details';
      right.appendChild(viewBtn);
      
      if (tournament.status === 'waiting') {
        const user = getCurrentUser();
        const userId = user?.id ? Number(user.id) : null;
        const hasJoined = userId !== null && tournament.playerIds && tournament.playerIds.includes(userId);
        const isFull = tournament.currentPlayers >= tournament.maxPlayers;
        
        const joinBtn = document.createElement('button');
        joinBtn.setAttribute('data-tournament-id', String(tournament.id));
        
        if (hasJoined) {
          // User already joined - show disabled "Already Joined" button
          joinBtn.className = 'px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 font-bold rounded-xl cursor-not-allowed opacity-70';
          joinBtn.disabled = true;
          joinBtn.textContent = '✅ Already Joined';
          joinBtn.title = 'You have already joined this tournament';
        } else if (isFull) {
          // Tournament is full
          joinBtn.className = 'px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 font-bold rounded-xl cursor-not-allowed opacity-70';
          joinBtn.disabled = true;
          joinBtn.textContent = '🔒 Full';
          joinBtn.title = 'Tournament is full';
        } else {
          // Can join
          joinBtn.className = 'join-tournament px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg';
          joinBtn.textContent = 'Join Tournament';
        }
        
        right.appendChild(joinBtn);
      }

      top.appendChild(left);
      top.appendChild(right);
      card.appendChild(top);

      const footer = document.createElement('div');
      footer.className = 'flex justify-between items-center pt-4 border-t border-gray-700/50';
      const createdAt = document.createElement('div');
      createdAt.className = 'text-sm text-gray-400 flex items-center space-x-2';
      const calEmoji = document.createElement('span');
      calEmoji.textContent = '📅';
      createdAt.appendChild(calEmoji);
      const createdDate = document.createElement('span');
      try { createdDate.textContent = `Created ${new Date(tournament.createdAt).toLocaleDateString()}` } catch (e) { createdDate.textContent = '' }
      createdAt.appendChild(createdDate);
      const creatorDiv = document.createElement('div');
      creatorDiv.className = 'text-sm text-gray-400';
      creatorDiv.textContent = tournament.creator ? `Created by @${tournament.creator.username}` : '';
      footer.appendChild(createdAt);
      footer.appendChild(creatorDiv);
      card.appendChild(footer);

      container.appendChild(card);
    });

    // Add event listeners to tournament buttons
    document.querySelectorAll('.view-tournament').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tournamentId = (e.target as HTMLElement).getAttribute('data-tournament-id');
        if (tournamentId) {
          router.navigate(`/tournament/${tournamentId}`);
        }
      });
    });

    document.querySelectorAll('.join-tournament').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tournamentId = (e.target as HTMLElement).getAttribute('data-tournament-id');
        if (tournamentId) {
          await joinTournament(tournamentId);
        }      });
    });
  } catch (error) {
    // Only show UI error if user is still on page (element missing means user left page)
    const list = document.getElementById('tournamentsList');
    if (!list) {
      // User navigated away
      return;
    }
    // Errors are handled by UI, no need to log to console
    list.textContent = '';
    const card = document.createElement('div');
    card.className = 'bg-gradient-to-r from-red-600/20 to-pink-600/20 backdrop-blur-sm rounded-2xl border border-red-500/20 p-6 text-center';
    const icon = document.createElement('div');
    icon.className = 'text-4xl mb-4';
    icon.textContent = '⚠️';
    const title = document.createElement('h3');
    title.className = 'text-lg font-bold text-white mb-2';
    title.textContent = 'Connection Error';
    const msg = document.createElement('p');
    msg.className = 'text-gray-400';
    msg.textContent = 'Failed to load tournaments. Please try again.';
    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(msg);
    list.appendChild(card);
  }
}

function setupEventListeners() {
  const modal = document.getElementById('createTournamentModal')!;
  const form = document.getElementById('createTournamentForm') as HTMLFormElement;

  // Open modal
  document.getElementById('createTournamentBtn')!.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  // Close modal
  document.getElementById('closeModal')!.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('cancelCreate')!.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Create tournament
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('tournamentName') as HTMLInputElement).value;
    const maxPlayers = parseInt((document.getElementById('maxPlayers') as HTMLSelectElement).value);
    const type = (document.getElementById('tournamentType') as HTMLSelectElement).value;

    const user = getCurrentUser();
    if (!user) {
      showNotification('Please log in to create tournaments', 'error');
      return;
    }

    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name,
          maxPlayers,
          type,
          createdBy: user.id  // ✅ Send the actual creator ID
        })
      });

      const data = await response.json();

      if (response.ok) {
        modal.classList.add('hidden');
        form.reset();
        showNotification('Tournament created successfully!', 'success');
        loadTournaments(); // Reload the list
      } else {
        showNotification(`❌ Failed to create tournament: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification('Failed to create tournament', 'error');
    }
  });
}

async function joinTournament(tournamentId: string) {
  const user = getCurrentUser();
  if (!user) {
    showNotification('Please log in to join tournaments', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
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
      loadTournaments(); // Reload to update status
    } else {
      showNotification(`❌ Failed to join tournament: ${data.error}`, 'error');
    }
  } catch (error) {
    showNotification('Failed to join tournament', 'error');
  }
}

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `
    fixed top-20 right-4 px-6 py-4 rounded-xl shadow-2xl z-[9999] transform translate-x-full transition-transform duration-300
    ${type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
      type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600' :
        'bg-gradient-to-r from-blue-500 to-purple-600'}
  `;

  // Build notification safely
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

  // Animate in
  requestAnimationFrame(() => {
    notification.classList.remove('translate-x-full');
    notification.classList.add('translate-x-0');
  });

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('translate-x-0');
    notification.classList.add('translate-x-full');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}