import { me, getUserProfile, getUserGames } from '../../services/api';

export interface UserStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  averagePointsPerGame: number;
  longestWinStreak: number;
  recentGames: GameHistory[];
  achievements: Achievement[];
}

export interface GameHistory {
  id: number;
  opponent: string;
  result: 'win' | 'loss';
  score: string;
  date: string;
  duration: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  icon: string;
}

export class UserStatsDashboard {
  private container: HTMLElement | null;
  private stats: UserStats | null = null;
  private containerId: string;

  constructor(containerId: string) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.warn(`UserStatsDashboard: Container with id '${containerId}' not found`);
    }
  }

  async render(): Promise<void> {
    if (!this.container) {
      console.warn(`UserStatsDashboard: Cannot render - container '${this.containerId}' not found`);
      return;
    }

    await this.loadStats();
    this.renderDashboard();
  }

  private async loadStats(): Promise<void> {
    try {
      // Load current user to get ID
      const auth = await me();
      if (!auth.ok || !auth.body) {
        this.stats = null;
        return;
      }

      const userId = auth.body.id;

      // Fetch profile (with basic stats) and recent games
      const [profileRes, gamesRes] = await Promise.all([
        getUserProfile(userId),
        getUserGames(userId),
      ]);

      if (!profileRes.ok || !profileRes.body) {
        this.stats = null;
        return;
      }

      const user = profileRes.body;
      const games = gamesRes.ok && Array.isArray(gamesRes.body) ? gamesRes.body : [];

      const totalGames = user.stats?.totalGames ?? games.length ?? 0;
      const wins = user.stats?.wins ?? games.filter((g: any) => g.winnerId === userId).length ?? 0;
      const losses = user.stats?.losses ?? (totalGames - wins);
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : 0;

      // Compute simple derived metrics from games
      let totalPoints = 0;
      let totalGamesWithScores = 0;
      let longestStreak = 0;
      let currentStreak = 0;

      const sortedGames = [...games].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());

      for (const g of sortedGames) {
        const isPlayer1 = g.player1Id === userId;
        const myScore = isPlayer1 ? g.scorePlayer1 : g.scorePlayer2;
        const iWon = g.winnerId === userId;

        if (typeof myScore === 'number') {
          totalPoints += myScore;
          totalGamesWithScores += 1;
        }

        if (iWon) {
          currentStreak += 1;
          if (currentStreak > longestStreak) longestStreak = currentStreak;
        } else {
          currentStreak = 0;
        }
      }

      const avgPoints = totalGamesWithScores > 0 ? totalPoints / totalGamesWithScores : 0;

      const recentGames: GameHistory[] = games.slice(0, 5).map((g: any) => {
        const isPlayer1 = g.player1Id === userId;
        const opponent = isPlayer1 ? g.player2Username : g.player1Username;
        const myScore = isPlayer1 ? g.scorePlayer1 : g.scorePlayer2;
        const oppScore = isPlayer1 ? g.scorePlayer2 : g.scorePlayer1;

        return {
          id: g.id,
          opponent: opponent || 'Unknown',
          result: g.winnerId === userId ? 'win' : 'loss',
          score: `${myScore ?? 0}-${oppScore ?? 0}`,
          date: g.createdAt || new Date().toISOString(),
          duration: g.duration || 0,
        };
      });

      // Simple achievement examples based on stats
      const achievements: Achievement[] = [
        {
          id: "first_win",
          name: "First Blood",
          description: "Win your first game",
          unlocked: wins > 0,
          unlockedAt: wins > 0 ? recentGames.find(g => g.result === 'win')?.date : undefined,
          icon: "🏆",
        },
        {
          id: "streak_5",
          name: "Hot Streak",
          description: "Win 5 games in a row",
          unlocked: longestStreak >= 5,
          unlockedAt: longestStreak >= 5 ? recentGames.find(g => g.result === 'win')?.date : undefined,
          icon: "🔥",
        },
        {
          id: "perfect_game",
          name: "Perfection",
          description: "Win a game without conceding",
          unlocked: games.some((g: any) => {
            const isPlayer1 = g.player1Id === userId;
            const myScore = isPlayer1 ? g.scorePlayer1 : g.scorePlayer2;
            const oppScore = isPlayer1 ? g.scorePlayer2 : g.scorePlayer1;
            return g.winnerId === userId && (oppScore ?? 0) === 0;
          }),
          icon: "⭐",
        },
      ];

      this.stats = {
        totalGames,
        wins,
        losses,
        winRate,
        averagePointsPerGame: avgPoints,
        longestWinStreak: longestStreak,
        recentGames,
        achievements,
      };
    } catch (error) {
      this.stats = null;
    }
  }

  private renderDashboard(): void {
    if (!this.container) {
      console.warn('Cannot render dashboard - container not found');
      return;
    }

    if (!this.stats) {
      this.container.innerHTML = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center text-slate-400 py-8';

      const icon = document.createElement('div');
      icon.className = 'text-4xl mb-4';
      icon.textContent = '📊';

      const p1 = document.createElement('p');
      p1.textContent = 'Failed to load statistics';
      const p2 = document.createElement('p');
      p2.className = 'text-sm mt-2';
      p2.textContent = 'Please try refreshing the page';

      emptyDiv.appendChild(icon);
      emptyDiv.appendChild(p1);
      emptyDiv.appendChild(p2);
      this.container.appendChild(emptyDiv);
      return;
    }

    try {
      this.container.innerHTML = ''; // Clear

      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

      // -- Stats Overview (Left/Main Col) --
      const mainCol = document.createElement('div');
      mainCol.className = 'lg:col-span-2 space-y-6';

      // 1. Overview Grid
      const ovGrid = document.createElement('div');
      ovGrid.className = 'grid grid-cols-2 md:grid-cols-4 gap-4';

      const createStatCard = (val: string | number, label: string, colorClass: string) => {
        const div = document.createElement('div');
        div.className = 'bg-slate-800 rounded-lg p-4 text-center';
        const valDiv = document.createElement('div');
        valDiv.className = `text-2xl font-bold ${colorClass}`;
        valDiv.textContent = val.toString();
        const lblDiv = document.createElement('div');
        lblDiv.className = 'text-sm text-slate-400';
        lblDiv.textContent = label;
        div.appendChild(valDiv);
        div.appendChild(lblDiv);
        return div;
      };

      ovGrid.appendChild(createStatCard(this.stats.totalGames, 'Total Games', 'text-blue-400'));
      ovGrid.appendChild(createStatCard(this.stats.wins, 'Wins', 'text-green-400'));
      ovGrid.appendChild(createStatCard(this.stats.losses, 'Losses', 'text-red-400'));
      ovGrid.appendChild(createStatCard(`${this.stats.winRate}%`, 'Win Rate', 'text-purple-400'));
      mainCol.appendChild(ovGrid);

      // 2. Win Rate Chart
      const chartCard = document.createElement('div');
      chartCard.className = 'bg-slate-800 rounded-lg p-6';
      const chartTitle = document.createElement('h3');
      chartTitle.className = 'text-lg font-semibold mb-4';
      chartTitle.textContent = 'Win Rate Distribution';

      const barBg = document.createElement('div');
      barBg.className = 'w-full bg-slate-700 rounded-full h-4';
      const barFill = document.createElement('div');
      barFill.className = 'bg-green-500 h-4 rounded-full';
      barFill.style.width = `${Math.min(this.stats.winRate, 100)}%`;
      barBg.appendChild(barFill);

      const labels = document.createElement('div');
      labels.className = 'flex justify-between text-sm text-slate-400 mt-2';
      const l0 = document.createElement('span'); l0.textContent = '0%';
      const l50 = document.createElement('span'); l50.textContent = '50%';
      const l100 = document.createElement('span'); l100.textContent = '100%';
      labels.appendChild(l0); labels.appendChild(l50); labels.appendChild(l100);

      chartCard.appendChild(chartTitle);
      chartCard.appendChild(barBg);
      chartCard.appendChild(labels);
      mainCol.appendChild(chartCard);

      // 3. Recent Games
      const recentCard = document.createElement('div');
      recentCard.className = 'bg-slate-800 rounded-lg p-6';
      const recentTitle = document.createElement('h3');
      recentTitle.className = 'text-lg font-semibold mb-4';
      recentTitle.textContent = 'Recent Games';
      const recentList = document.createElement('div');
      recentList.className = 'space-y-3';

      this.stats.recentGames.forEach(game => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-3 bg-slate-700 rounded-lg';

        const left = document.createElement('div');
        left.className = 'flex items-center gap-3';

        const icon = document.createElement('div');
        icon.className = `w-8 h-8 rounded-full flex items-center justify-center ${game.result === 'win' ? 'bg-green-500' : 'bg-red-500'}`;
        icon.textContent = game.result === 'win' ? '✓' : '✗';

        const details = document.createElement('div');
        const vsDiv = document.createElement('div');
        vsDiv.className = 'font-medium';
        vsDiv.textContent = `vs ${game.opponent}`;
        const dateDiv = document.createElement('div');
        dateDiv.className = 'text-sm text-slate-400';
        dateDiv.textContent = game.date;
        details.appendChild(vsDiv);
        details.appendChild(dateDiv);

        left.appendChild(icon);
        left.appendChild(details);

        const right = document.createElement('div');
        right.className = 'text-right';
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'font-semibold';
        scoreDiv.textContent = game.score;
        const durDiv = document.createElement('div');
        durDiv.className = 'text-sm text-slate-400';
        durDiv.textContent = `${game.duration}s`;
        right.appendChild(scoreDiv);
        right.appendChild(durDiv);

        row.appendChild(left);
        row.appendChild(right);
        recentList.appendChild(row);
      });
      recentCard.appendChild(recentTitle);
      recentCard.appendChild(recentList);
      mainCol.appendChild(recentCard);

      grid.appendChild(mainCol);

      // -- Sidebar (Right Col) --
      const sideCol = document.createElement('div');
      sideCol.className = 'space-y-6';

      // 1. Achievements
      const achCard = document.createElement('div');
      achCard.className = 'bg-slate-800 rounded-lg p-6';
      const achTitle = document.createElement('h3');
      achTitle.className = 'text-lg font-semibold mb-4';
      achTitle.textContent = 'Achievements';
      const achList = document.createElement('div');
      achList.className = 'space-y-3';

      this.stats.achievements.forEach(ach => {
        const item = document.createElement('div');
        item.className = `flex items-center gap-3 p-3 bg-slate-700 rounded-lg ${!ach.unlocked ? 'opacity-50' : ''}`;

        const icon = document.createElement('div');
        icon.className = 'text-2xl';
        icon.textContent = ach.icon;

        const info = document.createElement('div');
        info.className = 'flex-1';
        const name = document.createElement('div');
        name.className = 'font-medium';
        name.textContent = ach.name;
        const desc = document.createElement('div');
        desc.className = 'text-sm text-slate-400';
        desc.textContent = ach.description;

        info.appendChild(name);
        info.appendChild(desc);

        if (ach.unlocked && ach.unlockedAt) {
          const unlockedDiv = document.createElement('div');
          unlockedDiv.className = 'text-xs text-green-400';
          unlockedDiv.textContent = `Unlocked ${ach.unlockedAt}`;
          info.appendChild(unlockedDiv);
        }

        item.appendChild(icon);
        item.appendChild(info);
        achList.appendChild(item);
      });
      achCard.appendChild(achTitle);
      achCard.appendChild(achList);
      sideCol.appendChild(achCard);

      // 2. Performance Metrics
      const perfCard = document.createElement('div');
      perfCard.className = 'bg-slate-800 rounded-lg p-6';
      const perfTitle = document.createElement('h3');
      perfTitle.className = 'text-lg font-semibold mb-4';
      perfTitle.textContent = 'Performance';
      const perfList = document.createElement('div');
      perfList.className = 'space-y-4';

      const createPerfItem = (label: string, val: number, max: number, color: string) => {
        const div = document.createElement('div');
        const header = document.createElement('div');
        header.className = 'flex justify-between text-sm mb-1';
        const lbl = document.createElement('span'); lbl.textContent = label;
        const v = document.createElement('span'); v.className = 'font-semibold'; v.textContent = val.toString();
        header.appendChild(lbl); header.appendChild(v);

        const bar = document.createElement('div');
        bar.className = 'w-full bg-slate-700 rounded-full h-2';
        const fill = document.createElement('div');
        fill.className = `${color} h-2 rounded-full`;
        fill.style.width = `${Math.min((val / max) * 100, 100)}%`;
        bar.appendChild(fill);

        div.appendChild(header);
        div.appendChild(bar);
        return div;
      }

      perfList.appendChild(createPerfItem('Average Points/Game', parseFloat(this.stats.averagePointsPerGame.toFixed(1)), 10, 'bg-blue-500'));
      perfList.appendChild(createPerfItem('Longest Win Streak', this.stats.longestWinStreak, 10, 'bg-purple-500'));

      perfCard.appendChild(perfTitle);
      perfCard.appendChild(perfList);
      sideCol.appendChild(perfCard);

      grid.appendChild(sideCol);
      this.container.appendChild(grid);

    } catch (error) {
      if (this.container) {
        this.container.innerHTML = '';
        const errDiv = document.createElement('div');
        errDiv.className = 'text-center text-red-400 py-8';
        const icon = document.createElement('div');
        icon.className = 'text-4xl mb-4';
        icon.textContent = '❌';
        const p1 = document.createElement('p');
        p1.textContent = 'Error displaying statistics';
        const p2 = document.createElement('p');
        p2.className = 'text-sm mt-2';
        p2.textContent = 'Please try again later';
        errDiv.appendChild(icon);
        errDiv.appendChild(p1);
        errDiv.appendChild(p2);
        this.container.appendChild(errDiv);
      }
    }
  }

  // Helper method to safely escape HTML
  private escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') return String(unsafe);

    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Public method to refresh stats
  async refresh(): Promise<void> {
    await this.loadStats();
    this.renderDashboard();
  }

  // Public method to get current stats
  getStats(): UserStats | null {
    return this.stats;
  }

  // Public method to check if container exists
  isContainerAvailable(): boolean {
    return this.container !== null;
  }

  // Clean up method
  destroy(): void {
    this.container = null;
    this.stats = null;
  }
}

// Export a factory function for easy creation
export function createUserStatsDashboard(containerId: string): UserStatsDashboard {
  return new UserStatsDashboard(containerId);
}

// Export default instance creation
export default UserStatsDashboard;