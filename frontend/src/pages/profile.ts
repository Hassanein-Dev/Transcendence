import { me, getUserProfile, getFriends, getUserGames, updateUserProfile } from "../services/api";
import { UserStatsDashboard } from "../components/stats/userStats";
import { router } from "../router";
import { AvatarUpload } from "../components/profile/AvatarUpload";
import { eventBus } from "../services/eventBus";



const DEFAULT_AVATAR = 'data:image/svg+xml;base64,' + btoa(`
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#4F46E5"/>
  <circle cx="50" cy="40" r="15" fill="#A5B4FC"/>
  <path d="M30 70 Q50 85 70 70" stroke="#A5B4FC" stroke-width="8" fill="none"/>
</svg>
`);

// Optional stats dashboard (can be used in a dedicated container if desired)
// const statsDashboard = new UserStatsDashboard('statsDashboard');
// statsDashboard.render();

let currentProfileUserId: number | null = null;
let avatarUploader: AvatarUpload | null = null;
let currentUserGames: any[] = [];
let currentUserFriends: any[] = [];

export async function renderProfile() {
  const app = document.getElementById("app")!;

  // Show navigation
  const nav = document.querySelector("nav");
  if (nav) {
    nav.style.display = 'block';
  }

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-blue-900/50">
      <!-- Header with background pattern -->
      <div class="relative overflow-hidden">
        <!-- Animated background -->
        <div class="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-transparent to-blue-600/20"></div>
        <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent"></div>
        
        <div class="relative max-w-7xl mx-auto px-4 pb-8">
          <!-- Profile Card -->
          <div class="bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
            <!-- Profile Header -->
            <div class="bg-gradient-to-r from-purple-600/30 to-blue-600/30 p-8 relative">
              <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div class="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div class="relative flex flex-col md:flex-row items-center md:items-end space-y-6 md:space-y-0">
                <!-- Profile Picture -->
                <div class="relative group">
                  <div class="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                  <img id="profilePicture" src="${DEFAULT_AVATAR}" 
                       class="relative w-40 h-40 rounded-full border-4 border-gray-900 object-cover transform group-hover:scale-105 transition-transform duration-300" />
                  <button id="editPictureBtn" class="absolute bottom-3 right-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white p-3 rounded-full hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 group">
                    <svg class="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </button>
                </div>
                
                <!-- Profile Info -->
                <div class="md:ml-8 text-center md:text-left flex-1">
                  <div class="mb-2">
                    <span class="inline-block bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
                      🏆 PONG PLAYER
                    </span>
                  </div>
                  <h1 id="profileFullname" class="text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                    Loading...
                  </h1>
                  <p id="profileUsername" class="text-gray-300 text-lg mb-4">@username</p>
                  <div class="flex items-center space-x-4 text-gray-300">
                    <span class="flex items-center space-x-1">
                      <span class="text-2xl">👥</span>
                      <span id="profileFriendsCount" class="font-semibold">0</span>
                      <span class="text-sm">friends</span>
                    </span>
                    <span class="flex items-center space-x-1">
                      <span class="text-2xl">🏆</span>
                      <span id="headerWinsCount" class="font-semibold">0</span>
                      <span class="text-sm">wins</span>
                    </span>
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex space-x-4 mt-6 md:mt-0">
                  <button onclick="router.navigate('/game')" class="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-green-500/25 transition-all duration-300 transform hover:-translate-y-1">
                    <span class="flex items-center space-x-2">
                      <span class="text-xl">🎮</span>
                      <span>Play Pong</span>
                    </span>
                  </button>
                  <button id="editProfileBtn" class="bg-gray-700/50 hover:bg-gray-600/50 text-white font-bold px-6 py-3 rounded-xl border border-gray-600 hover:border-gray-500 transition-all duration-300">
                    <span class="flex items-center space-x-2">
                      <span class="text-xl">✨</span>
                      <span>Edit Profile</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Navigation Tabs -->
            <div class="border-b border-gray-700/50">
              <div class="px-8">
                <nav class="flex space-x-8">
                  <button class="profile-tab py-4 px-2 font-semibold border-b-2 border-purple-500 text-white transition-colors" data-tab="overview">
                    <span class="flex items-center space-x-2">
                      <span>📊</span>
                      <span>Overview</span>
                    </span>
                  </button>
                  <button class="profile-tab py-4 px-2 font-semibold text-gray-400 hover:text-white transition-colors" data-tab="stats">
                    <span class="flex items-center space-x-2">
                      <span>📈</span>
                      <span>Statistics</span>
                    </span>
                  </button>
                  <button class="profile-tab py-4 px-2 font-semibold text-gray-400 hover:text-white transition-colors" data-tab="friends">
                    <span class="flex items-center space-x-2">
                      <span>👥</span>
                      <span>Friends</span>
                    </span>
                  </button>
                  <button class="profile-tab py-4 px-2 font-semibold text-gray-400 hover:text-white transition-colors" data-tab="games">
                    <span class="flex items-center space-x-2">
                      <span>🎮</span>
                      <span>Games</span>
                    </span>
                  </button>
                </nav>
              </div>
            </div>

            <!-- Main Content -->
            <div class="p-8">
              <div id="profileContent" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left Column -->
                <div class="lg:col-span-2 space-y-8">
                  <!-- About Card -->
                  <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                      <span>🌟</span>
                      <span>About</span>
                    </h3>
                    <div class="space-y-6">
                      <div>
                        <div class="mb-2">
                          <span class="text-gray-400">Bio</span>
                        </div>
                        <div id="profileBio" class="text-gray-300 bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                          No bio yet. Share something about yourself!
                        </div>
                      </div>
                      
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">📍</div>
                          <div>
                            <div class="text-sm text-gray-400">Location</div>
                            <div id="profileLivesIn" class="text-white">Unknown</div>
                          </div>
                        </div>
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">🎓</div>
                          <div>
                            <div class="text-sm text-gray-400">Education</div>
                            <div id="profileEducation" class="text-white">Unknown</div>
                          </div>
                        </div>
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">❤️</div>
                          <div>
                            <div class="text-sm text-gray-400">Relationship</div>
                            <div id="profileRelationship" class="text-white">Unknown</div>
                          </div>
                        </div>
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">🎂</div>
                          <div>
                            <div class="text-sm text-gray-400">Birthday</div>
                            <div id="profileBirthday" class="text-white">Unknown</div>
                          </div>
                        </div>
                         <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">⚧️</div>
                          <div>
                            <div class="text-sm text-gray-400">Gender</div>
                            <div id="profileGender" class="text-white">Unknown</div>
                          </div>
                        </div>
                         <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">📱</div>
                          <div>
                            <div class="text-sm text-gray-400">Phone</div>
                            <div id="profilePhone" class="text-white">Hidden</div>
                          </div>
                        </div>
                        <div class="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-lg">
                          <div class="text-2xl">📅</div>
                          <div>
                            <div class="text-sm text-gray-400">Joined</div>
                            <div id="profileSince" class="text-white">Recently</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Recent Activity -->
                  <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                      <span>📝</span>
                      <span>Recent Activity</span>
                    </h3>
                    <div id="postsFeed" class="space-y-4">
                      <div class="text-center py-12">
                        <div class="text-5xl mb-4 text-gray-600">📝</div>
                        <p class="text-gray-400">No recent activity</p>
                        <p class="text-sm text-gray-500 mt-2">Play games or connect with friends to see activity here!</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Right Column -->
                <div class="space-y-8">
                  <!-- Stats Summary -->
                  <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                      <span>🏆</span>
                      <span>Pong Stats</span>
                    </h3>
                    <div class="space-y-4">
                      <div class="flex justify-between items-center p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
                        <div class="flex items-center space-x-3">
                          <div class="text-2xl">🎮</div>
                          <div>
                            <div class="text-sm text-gray-400">Games Played</div>
                            <div class="text-2xl font-bold text-white" id="gamesPlayed">0</div>
                          </div>
                        </div>
                        <div class="text-3xl">⚔️</div>
                      </div>
                      
                      <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
                          <div class="text-sm text-gray-400 mb-1">Wins</div>
                          <div class="text-2xl font-bold text-green-400" id="statsWinsCount">0</div>
                        </div>
                        <div class="bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-xl p-4 border border-red-500/20">
                          <div class="text-sm text-gray-400 mb-1">Losses</div>
                          <div class="text-2xl font-bold text-red-400" id="lossesCount">0</div>
                        </div>
                      </div>
                      
                      <div class="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
                        <div class="flex justify-between items-center">
                          <div>
                            <div class="text-sm text-gray-400">Win Rate</div>
                            <div class="text-2xl font-bold text-white" id="winRate">0%</div>
                          </div>
                          <div class="text-4xl">📊</div>
                        </div>
                        <div class="mt-2 w-full bg-gray-700 rounded-full h-2">
                          <div id="winRateBar" class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" style="width: 0%"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Actions -->
                  <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl">
                    <h3 class="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                      <span>⚡</span>
                      <span>Quick Actions</span>
                    </h3>
                    <div class="space-y-3">
                      <button onclick="router.navigate('/leaderboard')" class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 hover:from-yellow-600/30 hover:to-orange-600/30 rounded-xl border border-yellow-500/30 hover:border-yellow-500/50 transition-all duration-300 group">
                        <div class="flex items-center space-x-3">
                          <div class="text-2xl group-hover:scale-110 transition-transform">🏆</div>
                          <div class="text-left">
                            <div class="font-semibold text-white">Leaderboard</div>
                            <div class="text-sm text-gray-400">Top players</div>
                          </div>
                        </div>
                        <div class="text-gray-400 group-hover:text-white">→</div>
                      </button>
                      
                      <button onclick="router.navigate('/friends')" class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all duration-300 group">
                        <div class="flex items-center space-x-3">
                          <div class="text-2xl group-hover:scale-110 transition-transform">👥</div>
                          <div class="text-left">
                            <div class="font-semibold text-white">Find Friends</div>
                            <div class="text-sm text-gray-400">Connect & play</div>
                          </div>
                        </div>
                        <div class="text-gray-400 group-hover:text-white">→</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Profile Modal -->
      <div id="editProfileModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center hidden z-50 p-4 overflow-y-auto">
        <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 p-4 sm:p-6 w-full max-w-full sm:max-w-2xl lg:max-w-3xl max-h-[80vh] overflow-y-auto shadow-2xl my-8">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              ✨ Edit Profile
            </h3>
            <button id="closeEditModal" class="text-gray-400 hover:text-white text-2xl transition-colors">&times;</button>
          </div>
          
          <form id="editProfileForm" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input type="text" id="editFullname" 
                     class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                     placeholder="Enter your full name" />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Bio
              </label>
              <textarea id="editBio" rows="3"
                        class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        placeholder="Tell the Pong community about yourself..."></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Location
              </label>
              <input type="text" id="editLocation"
                     class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                     placeholder="Where are you from?" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Education</label>
                <input type="text" id="editEducation" class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" placeholder="School/University" />
              </div>
              <div>
                 <label class="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                 <input type="tel" id="editPhone" class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" placeholder="+1..." />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Birthday</label>
                <input type="date" id="editBirthday" class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
              </div>
              <div>
                 <label class="block text-sm font-medium text-gray-300 mb-2">Gender</label>
                 <select id="editGender" class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                   <option value="">Prefer not to say</option>
                   <option value="male">Male</option>
                   <option value="female">Female</option>
                   <option value="non-binary">Non-binary</option>
                   <option value="other">Other</option>
                 </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Relationship Status</label>
              <select id="editRelationship" class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                <option value="">Status</option>
                <option value="Single">Single</option>
                <option value="In a Relationship">In a Relationship</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
                <option value="Complicated">It's Complicated</option>
              </select>
            </div>
            
            <div class="flex gap-3 pt-2">
              <button type="submit" 
                      class="flex-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-purple-500/25">
                Save Changes
              </button>
              <button type="button" id="cancelEdit"
                      class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl border border-gray-600 transition-all duration-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Load user data
  await loadProfileData();
  setupEventListeners();
  
  // Auto-load Overview tab on initial page load
  const postsFeed = document.getElementById('postsFeed');
  if (postsFeed) {
    await handleTabChange('overview');
  }
}

async function loadProfileData() {
  try {
    // First, get the authenticated user to know their ID
    const authRes = await me();

    if (!authRes.ok || !authRes.body) {
      return;
    }

    const authUser = authRes.body;
    currentProfileUserId = authUser.id;

    // Fetch profile, friends and game history from backend
    const [profileRes, friendsRes, gamesRes] = await Promise.all([
      getUserProfile(authUser.id),
      getFriends(),
      getUserGames(authUser.id),
    ]);

    // Store games and friends for tab rendering
    if (gamesRes.ok && gamesRes.body) {
      // Transform games to include won, opponent, and score properties
      currentUserGames = gamesRes.body.map((game: any) => {
        const isPlayer1 = game.player1Id === authUser.id;
        const won = game.winnerId === authUser.id;
        const opponent = isPlayer1 ? game.player2Username : game.player1Username;
        const myScore = isPlayer1 ? game.scorePlayer1 : game.scorePlayer2;
        const oppScore = isPlayer1 ? game.scorePlayer2 : game.scorePlayer1;
        
        return {
          ...game,
          won,
          opponent,
          score: `${myScore ?? 0}-${oppScore ?? 0}`,
          date: game.createdAt
        };
      });
    }

    if (friendsRes.ok && friendsRes.body?.friends) {
      currentUserFriends = friendsRes.body.friends;
    }

    if (profileRes.ok && profileRes.body) {
      const user = profileRes.body;
      // Update profile elements
      const elements = {
        profilePicture: document.getElementById("profilePicture") as HTMLImageElement,
        profileFullname: document.getElementById("profileFullname"),
        profileUsername: document.getElementById("profileUsername"),
        profileBio: document.getElementById("profileBio"),
        profileLivesIn: document.getElementById("profileLivesIn"),
        profileSince: document.getElementById("profileSince"),
        editFullname: document.getElementById("editFullname") as HTMLInputElement,
        editBio: document.getElementById("editBio") as HTMLTextAreaElement,
        editLocation: document.getElementById("editLocation") as HTMLInputElement,
        gamesPlayed: document.getElementById("gamesPlayed"),
        headerWinsCount: document.getElementById("headerWinsCount"),
        statsWinsCount: document.getElementById("statsWinsCount"),
        lossesCount: document.getElementById("lossesCount"),
        winRate: document.getElementById("winRate"),
        winRateBar: document.getElementById("winRateBar"),
        profileFriendsCount: document.getElementById("profileFriendsCount")
      };

      // Update text content safely
      if (elements.profileFullname) {
        elements.profileFullname.textContent = user.fullname || user.username;
      }
      if (elements.profileUsername) {
        elements.profileUsername.textContent = `@${user.username}`;
      }
      if (elements.profilePicture) {
        elements.profilePicture.src = user.avatarUrl || user.picture || DEFAULT_AVATAR;
      }
      if (elements.profileBio) {
        elements.profileBio.textContent = user.bio || "No bio yet. Share something about yourself!";
      }
      if (elements.profileLivesIn) {
        elements.profileLivesIn.textContent = user.livesIn || user.lives_in || "Unknown";
      }

      // Update new profile display fields
      if (document.getElementById('profileEducation')) document.getElementById('profileEducation')!.textContent = user.education || "Unknown";
      if (document.getElementById('profileRelationship')) document.getElementById('profileRelationship')!.textContent = user.relationshipStatus || user.relationship_status || "Unknown";
      if (document.getElementById('profilePhone')) document.getElementById('profilePhone')!.textContent = user.phone || "Hidden";
      if (document.getElementById('profileGender')) document.getElementById('profileGender')!.textContent = user.gender ? (user.gender.charAt(0).toUpperCase() + user.gender.slice(1)) : "Hidden";
      if (document.getElementById('profileBirthday')) document.getElementById('profileBirthday')!.textContent = user.birthday ? new Date(user.birthday).toLocaleDateString() : "Unknown";

      if (elements.profileSince) {
        elements.profileSince.textContent = (user.createdAt || user.created_at)
          ? `Joined ${new Date(user.createdAt || user.created_at).toLocaleDateString()}`
          : "Recently";
      }

      // Populate edit form
      if (elements.editFullname) elements.editFullname.value = user.fullname || '';
      if (elements.editBio) elements.editBio.value = user.bio || '';
      if (elements.editLocation) elements.editLocation.value = user.livesIn || user.lives_in || '';

      // Populate new edit inputs
      if (document.getElementById('editEducation')) (document.getElementById('editEducation') as HTMLInputElement).value = user.education || '';
      if (document.getElementById('editPhone')) (document.getElementById('editPhone') as HTMLInputElement).value = user.phone || '';
      if (document.getElementById('editBirthday')) (document.getElementById('editBirthday') as HTMLInputElement).value = user.birthday || '';
      if (document.getElementById('editGender')) (document.getElementById('editGender') as HTMLSelectElement).value = user.gender || '';
      if (document.getElementById('editRelationship')) (document.getElementById('editRelationship') as HTMLSelectElement).value = user.relationship_status || user.relationshipStatus || '';

      // Load real game stats using gamesRes and user.stats if present
      loadGameStats(elements, user, friendsRes.ok ? friendsRes.body?.friends || [] : [], gamesRes.ok ? gamesRes.body || [] : []);
    } 
  } catch (error) {
  }
}

function generateMockGames(): any[] {
  const opponents = ['ProGamer', 'SpeedDemon', 'AcePlayer', 'Champion', 'Warrior'];
  const games = [];

  for (let i = 0; i < 15; i++) {
    const won = Math.random() > 0.4; // 60% win rate
    const myScore = won ? Math.floor(Math.random() * 5) + 5 : Math.floor(Math.random() * 5);
    const oppScore = won ? Math.floor(Math.random() * 5) : Math.floor(Math.random() * 5) + 5;

    games.push({
      id: i + 1,
      opponent: opponents[Math.floor(Math.random() * opponents.length)],
      score: `${myScore}-${oppScore}`,
      won,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  return games;
}

function loadGameStats(elements: any, user: any, friends: any[], games: any[]) {
  // Use stats from backend, which are already filtered by stats_reset_at
  const totalGames = user.stats?.totalGames ?? 0;
  const wins = user.stats?.wins ?? 0;
  const losses = user.stats?.losses ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const friendsCount = friends.length ?? 0;

  if (elements.gamesPlayed) elements.gamesPlayed.textContent = totalGames.toString();

  // Update BOTH wins count locations
  if (elements.headerWinsCount) elements.headerWinsCount.textContent = wins.toString();
  if (elements.statsWinsCount) elements.statsWinsCount.textContent = wins.toString();

  if (elements.lossesCount) elements.lossesCount.textContent = losses.toString();
  if (elements.winRate) elements.winRate.textContent = `${winRate}%`;
  if (elements.winRateBar) {
    elements.winRateBar.style.width = `${winRate}%`;
  }
  if (elements.profileFriendsCount) {
    elements.profileFriendsCount.textContent = friendsCount.toString();
  }
}

function setupEventListeners() {
  const modal = document.getElementById('editProfileModal')!;
  const form = document.getElementById('editProfileForm') as HTMLFormElement;

  // Quick Action Buttons - navigate to respective pages
  const leaderboardBtn = document.querySelector('button[onclick*="/leaderboard"]') as HTMLButtonElement;
  if (leaderboardBtn) {
    leaderboardBtn.removeAttribute('onclick');
    leaderboardBtn.addEventListener('click', () => {
      router.navigate('/leaderboard');
    });
  }

  const findFriendsQuickBtn = document.querySelector('button[onclick*="/friends"]') as HTMLButtonElement;
  if (findFriendsQuickBtn) {
    findFriendsQuickBtn.removeAttribute('onclick');
    findFriendsQuickBtn.addEventListener('click', () => {
      router.navigate('/friends');
    });
  }

  // Main Play Pong Button (green button next to Edit Profile)
  const mainPlayPongBtn = document.querySelector('button[onclick*="/game"]') as HTMLButtonElement;
  if (mainPlayPongBtn) {
    mainPlayPongBtn.removeAttribute('onclick');
    mainPlayPongBtn.addEventListener('click', () => {
      router.navigate('/game');
    });
  }

  // Edit Profile Button
  const editProfileBtn = document.getElementById('editProfileBtn')!;
  editProfileBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  // Edit Picture Button
  const editPictureBtn = document.getElementById('editPictureBtn')!;
  editPictureBtn.addEventListener('click', () => {
    if (!avatarUploader) {
      avatarUploader = new AvatarUpload();
    }
    avatarUploader.open(async (base64Image) => {
      try {
        if (currentProfileUserId == null) {
          return;
        }

        // Update profile with new avatar - backend expects 'avatarUrl' field
        const res = await updateUserProfile(currentProfileUserId, {
          avatarUrl: base64Image
        });

        if (res.ok) {
          // Update UI
          const profilePic = document.getElementById('profilePicture') as HTMLImageElement;
          if (profilePic) {
            profilePic.src = base64Image;
          }
          showNotification('Avatar updated successfully!', 'success');
        } else {
          showNotification('Failed to update avatar', 'error');
        }
      } catch (error) {
        showNotification('Failed to update avatar', 'error');
      }
    });
  });

  // Close Modal
  const closeEditModal = document.getElementById('closeEditModal')!;
  closeEditModal.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  const cancelEdit = document.getElementById('cancelEdit')!;
  cancelEdit.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Tab Navigation
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabName = target.getAttribute('data-tab') || target.closest('button')?.getAttribute('data-tab');

      if (!tabName) return;

      // Update active tab
      document.querySelectorAll('.profile-tab').forEach(t => {
        t.classList.remove('border-b-2', 'border-purple-500', 'text-white');
        t.classList.add('text-gray-400');
      });

      const button = target.tagName === 'BUTTON' ? target : target.closest('button');
      if (button) {
        button.classList.add('border-b-2', 'border-purple-500', 'text-white');
        button.classList.remove('text-gray-400');
      }

      // Handle tab content switching
      handleTabChange(tabName);

      // Smooth scroll to the content section accounting for navbar height (64px)
      const postsFeed = document.getElementById('postsFeed');
      if (postsFeed) {
        const navbarHeight = 120; // Fixed navbar is h-16 = 64px
        const elementPosition = postsFeed.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - navbarHeight - 20; // Extra 20px padding
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editFullname = document.getElementById('editFullname') as HTMLInputElement;
    const editBio = document.getElementById('editBio') as HTMLTextAreaElement;
    const editLocation = document.getElementById('editLocation') as HTMLInputElement;
    const editEducation = document.getElementById('editEducation') as HTMLInputElement;
    const editPhone = document.getElementById('editPhone') as HTMLInputElement;
    const editBirthday = document.getElementById('editBirthday') as HTMLInputElement;
    const editGender = document.getElementById('editGender') as HTMLSelectElement;
    const editRelationship = document.getElementById('editRelationship') as HTMLSelectElement;

    const profileFullname = document.getElementById('profileFullname')!;
    const profileBio = document.getElementById('profileBio')!;
    const profileLivesIn = document.getElementById('profileLivesIn')!;

    const fullname = editFullname.value;
    const bio = editBio.value;
    const location = editLocation.value;

    try {
      if (currentProfileUserId == null) {
        throw new Error("Missing profile user id");
      }

      // Persist changes to backend
      const res = await updateUserProfile(currentProfileUserId, {
        fullname: fullname || null,
        bio: bio || null,
        lives_in: location || null,
        education: editEducation.value || null,
        phone: editPhone.value || null,
        birthday: editBirthday.value || null,
        gender: editGender.value || null,
        relationship_status: editRelationship.value || null,
      });

      if (!res.ok) {
        throw new Error(res.body?.error || 'Failed to update profile');
      }

      const updated = res.body || {};

      // Update UI from server response
      profileFullname.textContent = updated.fullname || fullname || document.getElementById('profileUsername')!.textContent!.replace('@', '');
      profileBio.textContent = updated.bio || bio || "No bio yet. Share something about yourself!";
      profileLivesIn.textContent = updated.livesIn || location || "Unknown";

      // Update new fields in UI
      if (document.getElementById('profileEducation')) document.getElementById('profileEducation')!.textContent = updated.education || editEducation.value || "Unknown";
      if (document.getElementById('profilePhone')) document.getElementById('profilePhone')!.textContent = updated.phone || editPhone.value || "Hidden";
      if (document.getElementById('profileRelationship')) document.getElementById('profileRelationship')!.textContent = updated.relationshipStatus || updated.relationship_status || editRelationship.value || "Unknown";
      if (document.getElementById('profileGender')) document.getElementById('profileGender')!.textContent = (updated.gender || editGender.value) ? ((updated.gender || editGender.value).charAt(0).toUpperCase() + (updated.gender || editGender.value).slice(1)) : "Hidden";
      // Birthday formatting is tricky without date parsing, simple fallback
      if (document.getElementById('profileBirthday')) document.getElementById('profileBirthday')!.textContent = (updated.birthday || editBirthday.value) ? new Date(updated.birthday || editBirthday.value).toLocaleDateString() : "Unknown";

      modal.classList.add('hidden');
      showNotification('Profile updated successfully!', 'success');
    } catch (error) {
      showNotification('Failed to update profile', 'error');
    }
  });
}

async function handleTabChange(tabName: string) {
  const postsFeed = document.getElementById('postsFeed')!;
  // Clear previous content safely
  while (postsFeed.firstChild) postsFeed.removeChild(postsFeed.firstChild);

  switch (tabName) {
    case 'overview':
      await renderOverviewTab(postsFeed);
      break;
    case 'stats':
      renderStatsTab(postsFeed);
      break;
    case 'friends':
      renderFriendsTab(postsFeed);
      break;
    case 'games':
      renderGamesTab(postsFeed);
      break;
  }
}

async function renderOverviewTab(container: HTMLElement) {
  // Show loading state
  const loading = document.createElement('div');
  loading.className = 'text-center py-12';
  loading.innerHTML = `
    <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-4"></div>
    <p class="text-gray-400">Loading activities...</p>
  `;
  container.appendChild(loading);

  try {
    // Fetch activities from API
    const response = await fetch(`/api/users/${currentProfileUserId}/activities`);
    const activities = await response.json();

    // Clear loading state
    container.innerHTML = '';

    // Check if we have activities
    if (!activities || activities.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-center py-12';
      empty.innerHTML = `
        <div class="text-5xl mb-4 text-gray-600">📝</div>
        <p class="text-gray-400">No recent activity</p>
        <p class="text-sm text-gray-500 mt-2">Play games or connect with friends to see activity here!</p>
      `;
      container.appendChild(empty);
      return;
    }

    // Render activities
    activities.forEach((activity: any) => {
      const card = document.createElement('div');
      card.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all';
      card.innerHTML = `
        <div class="flex items-start space-x-4">
          <div class="text-3xl">${activity.icon}</div>
          <div class="flex-1">
            <div class="font-semibold text-white mb-1">${activity.title}</div>
            <div class="text-sm text-gray-400 mb-2">${activity.description}</div>
            <div class="text-xs text-gray-500">${activity.time}</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = '';
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-center py-12';
    errorDiv.innerHTML = `
      <div class="text-5xl mb-4 text-red-500">⚠️</div>
      <p class="text-gray-400">Failed to load activities</p>
      <p class="text-sm text-gray-500 mt-2">Please try refreshing the page</p>
    `;
    container.appendChild(errorDiv);
  }
}

function renderStatsTab(container: HTMLElement) {
  const stats = document.createElement('div');
  stats.className = 'space-y-6';

  // Performance chart
  const chartCard = document.createElement('div');
  chartCard.className = 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-purple-500/20';
  chartCard.innerHTML = `
    <h4 class="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
      <span>📈</span>
      <span>Performance Overview</span>
    </h4>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="text-center p-4 bg-gray-800/30 rounded-xl">
        <div class="text-2xl mb-2">🎮</div>
        <div class="text-2xl font-bold text-white">${currentUserGames.length}</div>
        <div class="text-xs text-gray-400">Total Games</div>
      </div>
      <div class="text-center p-4 bg-gray-800/30 rounded-xl">
        <div class="text-2xl mb-2">🏆</div>
        <div class="text-2xl font-bold text-green-400">${currentUserGames.filter((g: any) => g.won).length}</div>
        <div class="text-xs text-gray-400">Wins</div>
      </div>
      <div class="text-center p-4 bg-gray-800/30 rounded-xl">
        <div class="text-2xl mb-2">💔</div>
        <div class="text-2xl font-bold text-red-400">${currentUserGames.filter((g: any) => !g.won).length}</div>
        <div class="text-xs text-gray-400">Losses</div>
      </div>
      <div class="text-center p-4 bg-gray-800/30 rounded-xl">
        <div class="text-2xl mb-2">⚡</div>
        <div class="text-2xl font-bold text-blue-400">${currentUserGames.length > 0 ? Math.round((currentUserGames.filter((g: any) => g.won).length / currentUserGames.length) * 100) : 0}%</div>
        <div class="text-xs text-gray-400">Win Rate</div>
      </div>
    </div>
  `;
  stats.appendChild(chartCard);

  // Recent form - show first 10 games (most recent) in same order as Recent Activity
  const formCard = document.createElement('div');
  formCard.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-6 border border-gray-700/50';
  formCard.innerHTML = `
    <h4 class="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
      <span>📊</span>
      <span>Recent Form (Last 10 Games)</span>
    </h4>
    <div class="flex space-x-2">
      ${currentUserGames.slice(0, 10).map((g: any) => `
        <div class="w-8 h-8 rounded-full flex items-center justify-center ${g.won ? 'bg-green-500' : 'bg-red-500'} text-white text-xs font-bold">
          ${g.won ? 'W' : 'L'}
        </div>
      `).join('') || '<div class="text-gray-400 text-sm">No games played yet</div>'}
    </div>
  `;
  stats.appendChild(formCard);

  container.appendChild(stats);
}

function renderFriendsTab(container: HTMLElement) {
  if (currentUserFriends.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-12';
    empty.innerHTML = `
      <div class="text-5xl mb-4 text-gray-600">👥</div>
      <p class="text-gray-400">No friends yet</p>
      <p class="text-sm text-gray-500 mt-2">Connect with other players to see them here!</p>
    `;
    
    const findFriendsBtn = document.createElement('button');
    findFriendsBtn.className = 'mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl hover:shadow-lg transition-all';
    findFriendsBtn.textContent = 'Find Friends';
    findFriendsBtn.addEventListener('click', () => {
      router.navigate('/friends');
    });
    
    empty.appendChild(findFriendsBtn);
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

  currentUserFriends.forEach((friend: any) => {
    const card = document.createElement('div');
    card.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-purple-500/50 transition-all';
    
    const cardContent = document.createElement('div');
    cardContent.className = 'flex items-center space-x-4';
    
    const avatar = document.createElement('div');
    avatar.className = 'w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold cursor-pointer';
    avatar.textContent = friend.username?.charAt(0).toUpperCase() || '?';
    avatar.onclick = () => router.navigate(`/user/${friend.id}`);
    
    const info = document.createElement('div');
    info.className = 'flex-1 cursor-pointer';
    info.onclick = () => router.navigate(`/user/${friend.id}`);
    
    const name = document.createElement('div');
    name.className = 'font-semibold text-white';
    name.textContent = friend.username;
    
    const status = document.createElement('div');
    status.className = 'text-sm text-gray-400';
    status.textContent = friend.onlineStatus === 'online' ? '🟢 Online' : '⚫ Offline';
    
    info.appendChild(name);
    info.appendChild(status);
    
    const messageBtn = document.createElement('button');
    messageBtn.className = 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors';
    messageBtn.textContent = 'Message';
    messageBtn.onclick = (e) => {
      e.stopPropagation();
      eventBus.emit('OPEN_CHAT', { userId: friend.id });
    };
    
    cardContent.appendChild(avatar);
    cardContent.appendChild(info);
    cardContent.appendChild(messageBtn);
    card.appendChild(cardContent);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function renderGamesTab(container: HTMLElement) {
  if (currentUserGames.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-12';
    empty.innerHTML = `
      <div class="text-5xl mb-4 text-gray-600">🎮</div>
      <p class="text-gray-400">No games played yet</p>
      <p class="text-sm text-gray-500 mt-2">Start playing to build your match history!</p>
    `;
    
    const playNowBtn = document.createElement('button');
    playNowBtn.className = 'mt-4 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all';
    playNowBtn.textContent = 'Play Now';
    playNowBtn.addEventListener('click', () => {
      router.navigate('/game');
    });
    
    empty.appendChild(playNowBtn);
    container.appendChild(empty);
    return;
  }

  const table = document.createElement('div');
  table.className = 'overflow-x-auto';
  table.innerHTML = `
    <table class="w-full">
      <thead class="bg-gray-900/50">
        <tr>
          <th class="px-4 py-3 text-left text-sm font-semibold text-gray-300">Date</th>
          <th class="px-4 py-3 text-left text-sm font-semibold text-gray-300">Opponent</th>
          <th class="px-4 py-3 text-center text-sm font-semibold text-gray-300">Score</th>
          <th class="px-4 py-3 text-center text-sm font-semibold text-gray-300">Result</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-700/50">
        ${currentUserGames.slice(0, 20).reverse().map((game: any) => `
          <tr class="hover:bg-gray-700/30 transition-colors">
            <td class="px-4 py-3 text-sm text-gray-400">${new Date(game.date || Date.now()).toLocaleDateString()}</td>
            <td class="px-4 py-3 text-sm text-white">${game.opponent || 'Unknown'}</td>
            <td class="px-4 py-3 text-center text-sm text-gray-300">${game.score || '0-0'}</td>
            <td class="px-4 py-3 text-center">
              <span class="px-3 py-1 rounded-full text-xs font-semibold ${game.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                ${game.won ? '✓ Won' : '✗ Lost'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.appendChild(table);
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