import { router } from "../router";
import { getCurrentUser } from "../stores/authState";

interface LeaderboardPlayer {
  id: number;
  username: string;
  fullname?: string;
  avatarUrl?: string;
  picture?: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  rank: number;
}

export async function renderLeaderboard() {
  const app = document.getElementById("app")!;
  const user = getCurrentUser();

  if (!user) {
    router.navigate('/auth');
    return;
  }

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50 p-8">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <div>
            <h1 class="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent flex items-center space-x-3">
              <span class="text-5xl">🏆</span>
              <span>Leaderboard</span>
            </h1>
            <p class="text-gray-400 mt-2">Top Pong players ranked by wins</p>
          </div>
        </div>

        <!-- Leaderboard Card -->
        <div class="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
          <!-- Top 3 Podium -->
          <div id="podium" class="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 p-8 border-b border-gray-700/50">
            <div class="flex justify-center items-end space-x-4">
              <!-- Loading state -->
              <div class="text-center text-gray-400">
                <div class="text-4xl mb-2">⏳</div>
                <div>Loading top players...</div>
              </div>
            </div>
          </div>

          <!-- Search and Filter -->
          <div class="p-6 border-b border-gray-700/50">
            <div class="flex flex-col md:flex-row gap-4">
              <div class="flex-1 relative">
                <input type="text" id="searchInput" placeholder="Search players..." 
                       class="w-full px-4 py-3 pl-10 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                <span class="absolute left-3 top-3.5 text-gray-400">🔍</span>
              </div>
              <select id="filterSelect" class="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                <option value="all">All Players</option>
                <option value="top10">Top 10</option>
                <option value="top50">Top 50</option>
              </select>
            </div>
          </div>

          <!-- Leaderboard Table -->
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-900/50">
                <tr>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-300">Rank</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-300">Player</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-gray-300">Games</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-gray-300">Wins</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-gray-300">Losses</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-gray-300">Win Rate</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody id="leaderboardBody" class="divide-y divide-gray-700/50">
                <!-- Loading state -->
                <tr>
                  <td colspan="7" class="px-6 py-12 text-center">
                    <div class="text-4xl mb-4 text-gray-600">⏳</div>
                    <div class="text-gray-400">Loading leaderboard...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div id="pagination" class="p-6 border-t border-gray-700/50 flex justify-between items-center">
            <button id="prevPage" class="px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg border border-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              ← Previous
            </button>
            <span id="pageInfo" class="text-gray-400">Page 1</span>
            <button id="nextPage" class="px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg border border-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  let currentPage = 1;
  const itemsPerPage = 10;
  let totalPages = 1;

  // Initial load
  await loadLeaderboard(currentPage);
  setupEventListeners();

  function setupEventListeners() {
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const filterSelect = document.getElementById('filterSelect') as HTMLSelectElement;
    const prevBtn = document.getElementById('prevPage') as HTMLButtonElement;
    const nextBtn = document.getElementById('nextPage') as HTMLButtonElement;

    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      const filter = filterSelect?.value || 'all';
      filterLeaderboard(query, filter);
    });

    filterSelect?.addEventListener('change', () => {
      const query = searchInput?.value.toLowerCase() || '';
      const filter = filterSelect.value;
      filterLeaderboard(query, filter);
    });

    prevBtn?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadLeaderboard(currentPage);
      }
    });

    nextBtn?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadLeaderboard(currentPage);
      }
    });
  }

  async function loadLeaderboard(page: number) {
    try {
      const response = await fetch(`/api/users/leaderboard?page=${page}&limit=${itemsPerPage}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      const data = await response.json();

      const playersData = data.players || [];
      totalPages = data.totalPages || 1;

      const players: LeaderboardPlayer[] = playersData.map((player: any, index: number) => {
        const totalGames = Number(player.totalGames) || 0;
        const wins = Number(player.wins) || 0;
        const losses = Number(player.losses) || 0;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

        const rank = ((page - 1) * itemsPerPage) + index + 1;

        return {
          id: player.id,
          username: player.username,
          fullname: player.fullname,
          avatarUrl: player.avatarUrl || player.picture,
          picture: player.picture,
          wins,
          losses,
          gamesPlayed: totalGames,
          winRate,
          rank
        };
      });

      renderPodium(page === 1 ? players.slice(0, 3) : []);
      renderLeaderboardTable(players);
      renderPagination(page, totalPages);

    } catch (error) {
      showError();
    }
  }

  function renderPagination(current: number, total: number) {
    const prevBtn = document.getElementById('prevPage') as HTMLButtonElement;
    const nextBtn = document.getElementById('nextPage') as HTMLButtonElement;
    const pageInfo = document.getElementById('pageInfo');

    if (prevBtn) prevBtn.disabled = current <= 1;
    if (nextBtn) nextBtn.disabled = current >= total;
    if (pageInfo) pageInfo.textContent = `Page ${current} of ${total}`;
  }
}

function renderPodium(topThree: LeaderboardPlayer[]) {
  const podium = document.getElementById('podium')!;

  if (topThree.length === 0) {
    podium.innerHTML = '<div class="text-center text-gray-400 py-8">No players on the leaderboard yet. Be the first to win a game!</div>';
    return;
  }

  if (topThree.length < 3) {
    podium.innerHTML = `
            <div class="flex justify-center items-center space-x-4">
                ${topThree.map((player, index) => `
                    <div class="text-center transform hover:scale-105 transition-transform">
                        <div class="bg-gradient-to-br ${index === 0 ? 'from-yellow-600/30 to-orange-600/30 border-yellow-500' : 'from-gray-600/30 to-gray-700/30 border-gray-500'} rounded-2xl p-6 border-2">
                            <div class="text-4xl mb-2">${index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}</div>
                            <div class="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br ${index === 0 ? 'from-yellow-400 to-orange-500 border-yellow-400' : 'from-gray-400 to-gray-600 border-gray-500'} flex items-center justify-center text-3xl border-4">
                                ${player.username.charAt(0).toUpperCase()}
                            </div>
                            <div class="font-bold text-white text-lg mb-1">${player.username}</div>
                            <div class="text-${index === 0 ? 'yellow' : 'gray'}-300 text-sm mb-2">${player.wins} wins</div>
                            <div class="text-xs text-gray-400">${player.winRate}% win rate</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    return;
  }

  const [first, second, third] = topThree;
  podium.innerHTML = `
    <div class="flex justify-center items-end space-x-4 max-w-4xl mx-auto">
      <div class="flex-1 text-center transform hover:scale-105 transition-transform">
        <div class="bg-gradient-to-br from-gray-600/30 to-gray-700/30 rounded-2xl p-6 border-2 border-gray-500">
          <div class="text-4xl mb-2">🥈</div>
          <div class="w-20 h-20 mx-auto mb-3 rounded-full ${second.avatarUrl ? '' : 'bg-gradient-to-br from-gray-400 to-gray-600'} flex items-center justify-center text-3xl border-4 border-gray-500 overflow-hidden">
            ${second.avatarUrl ? `<img src="${second.avatarUrl}" alt="${second.username}" class="w-full h-full object-cover" />` : second.username.charAt(0).toUpperCase()}
          </div>
          <div class="font-bold text-white text-lg mb-1">${second.username}</div>
          <div class="text-gray-300 text-sm mb-2">${second.wins} wins</div>
          <div class="text-xs text-gray-400">${second.winRate}% win rate</div>
        </div>
      </div>

      <div class="flex-1 text-center transform hover:scale-105 transition-transform -mt-8">
        <div class="bg-gradient-to-br from-yellow-600/30 to-orange-600/30 rounded-2xl p-6 border-2 border-yellow-500 shadow-2xl shadow-yellow-500/20">
          <div class="text-5xl mb-2 animate-pulse">👑</div>
          <div class="w-24 h-24 mx-auto mb-3 rounded-full ${first.avatarUrl ? '' : 'bg-gradient-to-br from-yellow-400 to-orange-500'} flex items-center justify-center text-4xl border-4 border-yellow-400 overflow-hidden">
            ${first.avatarUrl ? `<img src="${first.avatarUrl}" alt="${first.username}" class="w-full h-full object-cover" />` : first.username.charAt(0).toUpperCase()}
          </div>
          <div class="font-bold text-white text-xl mb-1">${first.username}</div>
          <div class="text-yellow-300 text-sm mb-2 font-semibold">${first.wins} wins</div>
          <div class="text-xs text-gray-300">${first.winRate}% win rate</div>
        </div>
      </div>

      <div class="flex-1 text-center transform hover:scale-105 transition-transform">
        <div class="bg-gradient-to-br from-orange-600/30 to-red-600/30 rounded-2xl p-6 border-2 border-orange-500">
          <div class="text-4xl mb-2">🥉</div>
          <div class="w-20 h-20 mx-auto mb-3 rounded-full ${third.avatarUrl ? '' : 'bg-gradient-to-br from-orange-400 to-red-500'} flex items-center justify-center text-3xl border-4 border-orange-400 overflow-hidden">
            ${third.avatarUrl ? `<img src="${third.avatarUrl}" alt="${third.username}" class="w-full h-full object-cover" />` : third.username.charAt(0).toUpperCase()}
          </div>
          <div class="font-bold text-white text-lg mb-1">${third.username}</div>
          <div class="text-orange-300 text-sm mb-2">${third.wins} wins</div>
          <div class="text-xs text-gray-400">${third.winRate}% win rate</div>
        </div>
      </div>
    </div>
  `;
}

function renderLeaderboardTable(players: LeaderboardPlayer[]) {
  const tbody = document.getElementById('leaderboardBody')!;
  const currentUser = getCurrentUser();

  tbody.innerHTML = '';

  players.forEach(player => {
    const isCurrentUser = currentUser && player.username === currentUser.username;
    const row = document.createElement('tr');
    row.className = `hover:bg-gray-700/30 transition-colors ${isCurrentUser ? 'bg-purple-500/10 border-l-4 border-purple-500' : ''}`;

    const rankBadge = player.rank <= 3
      ? `<span class="text-2xl">${player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : '🥉'}</span>`
      : `<span class="text-gray-400 font-bold">#${player.rank}</span>`;

    row.innerHTML = `
      <td class="px-6 py-4">
        <div class="flex items-center space-x-2">
          ${rankBadge}
          ${isCurrentUser ? '<span class="text-xs bg-purple-500 text-white px-2 py-1 rounded-full">You</span>' : ''}
        </div>
      </td>
      <td class="px-6 py-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-full ${player.avatarUrl ? '' : 'bg-gradient-to-br from-purple-500 to-blue-500'} flex items-center justify-center text-white font-bold overflow-hidden">
            ${player.avatarUrl ? `<img src="${player.avatarUrl}" alt="${player.username}" class="w-full h-full object-cover" />` : player.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="font-semibold text-white">${player.username}</div>
            ${player.fullname ? `<div class="text-xs text-gray-400">${player.fullname}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-center text-gray-300">${player.gamesPlayed}</td>
      <td class="px-6 py-4 text-center">
        <span class="text-green-400 font-semibold">${player.wins}</span>
      </td>
      <td class="px-6 py-4 text-center">
        <span class="text-red-400 font-semibold">${player.losses}</span>
      </td>
      <td class="px-6 py-4 text-center">
        <div class="flex items-center justify-center space-x-2">
          <span class="font-semibold text-white">${player.winRate}%</span>
          <div class="w-16 bg-gray-700 rounded-full h-2">
            <div class="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" style="width: ${player.winRate}%"></div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-right">
        <button data-user-id="${player.id}" class="view-profile-btn text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
          View Profile →
        </button>
      </td>
    `;

    row.dataset.rank = player.rank.toString();
    tbody.appendChild(row);
  });

  const viewProfileBtns = document.querySelectorAll('.view-profile-btn');
  viewProfileBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = (btn as HTMLElement).getAttribute('data-user-id');
      if (userId) {
        router.navigate(`/user/${userId}`);
      }
    });
  });
}

function filterLeaderboard(query: string, filter: string = 'all') {
  const rows = document.querySelectorAll('#leaderboardBody tr');
  let visibleCount = 0;

  rows.forEach((row) => {
    const username = row.querySelector('td:nth-child(2)')?.textContent?.toLowerCase() || '';
    const rank = parseInt((row as HTMLElement).dataset.rank || '0');

    const matchesSearch = username.includes(query);

    let matchesFilter = true;
    if (filter === 'top10') {
      matchesFilter = rank <= 10;
    } else if (filter === 'top50') {
      matchesFilter = rank <= 50;
    }

    const visible = matchesSearch && matchesFilter;
    (row as HTMLElement).style.display = visible ? '' : 'none';

    if (visible) visibleCount++;
  });

  if (visibleCount === 0) {
    const tbody = document.getElementById('leaderboardBody')!;
    const existingNoResults = tbody.querySelector('.no-results-row');

    if (!existingNoResults) {
      const noResultsRow = document.createElement('tr');
      noResultsRow.className = 'no-results-row';
      noResultsRow.innerHTML = `
                <td colspan="7" class="px-6 py-12 text-center">
                    <div class="text-4xl mb-4 text-gray-500">🔍</div>
                    <div class="text-gray-400">No players found matching your criteria</div>
                </td>
            `;
      tbody.appendChild(noResultsRow);
    }
  } else {
    const noResultsRow = document.querySelector('.no-results-row');
    if (noResultsRow) {
      noResultsRow.remove();
    }
  }
}

function showError() {
  const tbody = document.getElementById('leaderboardBody')!;
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="px-6 py-12 text-center">
        <div class="text-4xl mb-4 text-red-500">❌</div>
        <div class="text-gray-400">Failed to load leaderboard</div>
        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
          Retry
        </button>
      </td>
    </tr>
  `;
}
