import { adminCreateUsers, adminListUsers, adminDeleteUser, adminGenerateConnectedUsers, adminGenerateStandaloneUsers, adminCreateNews, adminDeleteNews, getNews } from "../services/api";
import { router } from "../router";
import { getCurrentUser } from "../stores/authState";

export async function renderAdmin() {
  const app = document.getElementById("app")!;
  const user = getCurrentUser();

  // Check if user is admin
  if (!user || user.username !== 'admin') {
    router.navigate('/');
    return;
  }

  // Build admin dashboard safely
  const root = document.createElement('div');
  root.className = 'min-h-screen bg-gray-900 text-gray-100 p-8';

  const inner = document.createElement('div');
  inner.className = 'max-w-6xl mx-auto relative';

  // Header
  const header = document.createElement('div');
  header.className = 'mb-8';
  const headerRow = document.createElement('div');
  headerRow.className = 'flex items-center justify-between';
  const titleWrap = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Admin Panel';
  title.className = 'text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent';
  const info = document.createElement('p');
  info.textContent = 'Generate test users for friend suggestion testing.';
  info.className = 'text-gray-400 mt-2';
  titleWrap.appendChild(title);
  titleWrap.appendChild(info);

  headerRow.appendChild(titleWrap);
  header.appendChild(headerRow);

  // Main grid: left = generator & status, right = users list
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

  // Left column (generator)
  const leftCol = document.createElement('div');
  leftCol.className = 'lg:col-span-1';

  // Test Users Card
  const testCard = document.createElement('div');
  testCard.className = 'bg-gradient-to-br from-indigo-900/30 to-purple-900/30 backdrop-blur-lg rounded-2xl border border-indigo-700/50 p-6 shadow-xl';

  const testTitle = document.createElement('h2');
  testTitle.className = 'text-xl font-semibold text-white mb-2';
  testTitle.textContent = '🧪 Test Users Generator';

  const testDesc = document.createElement('p');
  testDesc.className = 'text-sm text-gray-300 mb-4';
  testDesc.textContent = 'Generate users for friend suggestion testing';

  const testRow = document.createElement('div');
  testRow.className = 'flex flex-col space-y-3';

  const genConnected = document.createElement('button');
  genConnected.innerHTML = '<span class="text-lg">👥</span> <span>Generate user1-user10 (Connected)</span>';
  genConnected.className = 'w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2';

  const genStandalone = document.createElement('button');
  genStandalone.innerHTML = '<span class="text-lg">🧍</span> <span>Generate user11-user20 (Standalone)</span>';
  genStandalone.className = 'w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2';

  testRow.appendChild(genConnected);
  testRow.appendChild(genStandalone);

  const testInfo = document.createElement('div');
  testInfo.className = 'mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50';
  testInfo.innerHTML = `
    <p class="text-xs text-slate-300 mb-2"><strong>user1-10:</strong> All friends, 4 Beirut, 3 Paris, 2 London, 1 Tokyo</p>
    <p class="text-xs text-slate-300 mb-2"><strong>user11-20:</strong> No friends, distributed across 10 cities</p>
    <p class="text-xs text-slate-400 mt-2"><strong>Passwords:</strong> password1, password2, ..., password20</p>
  `;

  const status = document.createElement('div');
  status.className = 'mt-4 text-sm text-gray-300 p-3 bg-slate-800/30 rounded-lg min-h-[60px]';

  testCard.appendChild(testTitle);
  testCard.appendChild(testDesc);
  testCard.appendChild(testRow);
  testCard.appendChild(testInfo);
  testCard.appendChild(status);

  leftCol.appendChild(testCard);

  // News Manager Card
  const newsCard = document.createElement('div');
  newsCard.className = 'mt-6 bg-gradient-to-br from-blue-900/30 to-cyan-900/30 backdrop-blur-lg rounded-2xl border border-blue-700/50 p-6 shadow-xl';

  const newsTitle = document.createElement('h2');
  newsTitle.className = 'text-xl font-semibold text-white mb-4';
  newsTitle.textContent = '📢 News Manager';

  const newsForm = document.createElement('div');
  newsForm.className = 'space-y-3';

  const nTitleInput = document.createElement('input');
  nTitleInput.placeholder = 'Title';
  nTitleInput.className = 'w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500';

  const nContentInput = document.createElement('textarea');
  nContentInput.placeholder = 'Content / Description';
  nContentInput.className = 'w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 h-24';

  const nTypeSelect = document.createElement('select');
  nTypeSelect.className = 'w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500';
  nTypeSelect.innerHTML = `
    <option value="news">News</option>
    <option value="event">Event</option>
    <option value="update">Update 🚀</option>
    <option value="tournament">Tournament ⚔️</option>
    <option value="feature">Feature ✨</option>
    <option value="maintenance">Maintenance 🛠️</option>
  `;

  const nDateInput = document.createElement('input');
  nDateInput.type = 'date';
  nDateInput.className = 'w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 hidden';

  nTypeSelect.addEventListener('change', () => {
    // Show date picker for Event and Tournament
    if (['event', 'tournament'].includes(nTypeSelect.value)) {
      nDateInput.classList.remove('hidden');
    } else {
      nDateInput.classList.add('hidden');
    }
  });

  const nSubmitBtn = document.createElement('button');
  nSubmitBtn.textContent = 'Post Announcement';
  nSubmitBtn.className = 'w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors';

  newsForm.appendChild(nTitleInput);
  newsForm.appendChild(nContentInput);
  newsForm.appendChild(nTypeSelect);
  newsForm.appendChild(nDateInput);
  newsForm.appendChild(nSubmitBtn);

  const newsList = document.createElement('div');
  newsList.className = 'mt-6 space-y-2 border-t border-gray-700/50 pt-4';
  const newsListTitle = document.createElement('h3');
  newsListTitle.className = 'text-sm text-gray-400 mb-2';
  newsListTitle.textContent = 'Recent Announcements';
  newsList.appendChild(newsListTitle);
  const newsItems = document.createElement('div');
  newsList.appendChild(newsItems);

  newsCard.appendChild(newsTitle);
  newsCard.appendChild(newsForm);
  newsCard.appendChild(newsList);
  leftCol.appendChild(newsCard);

  // Logic for News Manager
  async function loadNews() {
    newsItems.innerHTML = 'Loading...';
    try {
      const res = await getNews();
      if (!res.ok) {
        newsItems.textContent = 'Failed to load news';
        return;
      }
      const items = res.body || [];
      newsItems.innerHTML = '';
      if (items.length === 0) {
        newsItems.textContent = 'No announcements yet';
        return;
      }
      items.slice(0, 5).forEach((n: any) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-2 bg-gray-800/50 rounded-lg border border-gray-700/50 text-sm';
        const info = document.createElement('span');
        info.className = 'text-gray-300 truncate mr-2';
        info.textContent = `${n.type === 'event' ? '🏆' : '📰'} ${n.title}`;

        const del = document.createElement('button');
        del.textContent = '×';
        del.className = 'text-red-400 hover:text-red-300 font-bold px-2';
        del.onclick = async () => {
          if (!confirm('Delete this announcement?')) return;
          await adminDeleteNews(n.id);
          loadNews();
        };
        div.appendChild(info);
        div.appendChild(del);
        newsItems.appendChild(div);
      });
    } catch (e) {
      newsItems.textContent = 'Error loading news';
    }
  }

  nSubmitBtn.onclick = async () => {
    const title = nTitleInput.value.trim();
    const content = nContentInput.value.trim();
    const type = nTypeSelect.value as 'news' | 'event';
    const date = nDateInput.value;

    if (!title || !content) {
      alert('Title and Content are required');
      return;
    }
    if (type === 'event' && !date) {
      alert('Event Date is required for events');
      return;
    }

    try {
      const res = await adminCreateNews({ title, content, type, event_date: date });
      if (!res.ok) {
        const errorMsg = res.body?.error || 'Failed to create news';
        alert(errorMsg);
      } else {
        nTitleInput.value = '';
        nContentInput.value = '';
        nDateInput.value = '';
        loadNews();
      }
    } catch (e) {
      alert('Error creating news');
    }
  };

  loadNews(); // Initial load

  // Right column (users list)
  const rightCol = document.createElement('div');
  rightCol.className = 'lg:col-span-2';
  const usersCard = document.createElement('div');
  usersCard.className = 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-6 shadow-xl';
  const usersTitle = document.createElement('h2');
  usersTitle.className = 'text-xl font-semibold text-white mb-4';
  usersTitle.textContent = 'Existing Users';
  const usersTable = document.createElement('div');
  usersTable.className = 'w-full';
  usersCard.appendChild(usersTitle);
  usersCard.appendChild(usersTable);
  rightCol.appendChild(usersCard);

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  inner.appendChild(header);
  inner.appendChild(grid);
  root.appendChild(inner);
  app.textContent = '';
  app.appendChild(root);

  async function loadUsers() {
    usersTable.textContent = 'Loading...';
    try {
      const res = await adminListUsers();
      if (!res.ok) {
        usersTable.textContent = `Error loading users: ${res.status}`;
        return;
      }
      const users = res.body.users || [];

      // Build table via DOM inside usersTable (which is on the right card)
      usersTable.textContent = '';
      const tableWrap = document.createElement('div');
      tableWrap.className = 'w-full overflow-x-auto';
      const table = document.createElement('table');
      table.className = 'w-full table-auto';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['ID', 'Username', 'Email', 'Created', 'Deleted', 'Actions'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.className = 'text-left pb-2 text-sm text-gray-300';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      for (const u of users) {
        const tr = document.createElement('tr');
        tr.className = 'border-t border-gray-700';
        const idTd = document.createElement('td');
        idTd.className = 'py-2 text-sm text-gray-300';
        idTd.textContent = String(u.id);
        const nameTd = document.createElement('td');
        nameTd.className = 'py-2 text-sm text-white';
        nameTd.textContent = u.username || '';
        const emailTd = document.createElement('td');
        emailTd.className = 'py-2 text-sm text-gray-300';
        emailTd.textContent = u.email || '';
        const createdTd = document.createElement('td');
        createdTd.className = 'py-2 text-sm text-gray-400';
        createdTd.textContent = u.created_at || '';
        const deletedTd = document.createElement('td');
        deletedTd.className = 'py-2 text-sm text-gray-300';
        deletedTd.textContent = u.deleted ? 'yes' : 'no';
        const actionsTd = document.createElement('td');
        actionsTd.className = 'py-2 text-sm';
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.className = 'px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all';
        
        // Disable delete for admin user
        if (u.username === 'admin') {
          delBtn.disabled = true;
          delBtn.className = 'px-3 py-1 bg-gray-500 text-gray-300 rounded-lg text-sm cursor-not-allowed';
          delBtn.title = 'Admin account cannot be deleted';
        }
        
        delBtn.addEventListener('click', async () => {
          if (u.username === 'admin') {
            alert('Admin account cannot be deleted');
            return;
          }
          if (!confirm(`Delete user ${u.username}? This cannot be undone.`)) return;
          try {
            const delRes = await adminDeleteUser(u.id);
            if (!delRes.ok) {
              const errorMsg = delRes.body?.error || `Delete failed: ${delRes.status}`;
              alert(errorMsg);
              return;
            }
            await loadUsers();
          } catch (err) {
            alert('Error deleting user');
          }
        });
        actionsTd.appendChild(delBtn);
        tr.appendChild(idTd);
        tr.appendChild(nameTd);
        tr.appendChild(emailTd);
        tr.appendChild(createdTd);
        tr.appendChild(deletedTd);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      usersTable.appendChild(tableWrap);
    } catch (err) {
      usersTable.textContent = 'Unexpected error loading users';
    }
  }

  async function generateConnected() {
    status.textContent = 'Creating user1-user10...';
    try {
      const res = await adminGenerateConnectedUsers();
      if (!res.ok) {
        status.textContent = `❌ Error: ${res.body?.error || res.status}`;
        return;
      }
      status.textContent = `✅ ${res.body.message}`;
      await loadUsers();
    } catch (err) {
      status.textContent = '❌ Error generating connected users';
    }
  }

  async function generateStandalone() {
    status.textContent = 'Creating user11-user20...';
    try {
      const res = await adminGenerateStandaloneUsers();
      if (!res.ok) {
        status.textContent = `❌ Error: ${res.body?.error || res.status}`;
        return;
      }
      status.textContent = `✅ ${res.body.message}`;
      await loadUsers();
    } catch (err) {
      status.textContent = '❌ Error generating standalone users';
    }
  }

  genConnected.addEventListener('click', generateConnected);
  genStandalone.addEventListener('click', generateStandalone);

  // initial load
  loadUsers();
}
