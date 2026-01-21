// frontend/src/pages/profileSetup.ts
import { router } from "../router";
import { getCurrentUser, initAuth } from "../stores/authState";

export function renderProfileSetup() {
  const user = getCurrentUser();
  const app = document.getElementById("app")!;

  // Build profile setup DOM safely
  const root = document.createElement('div');
  root.className = 'min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8';

  const card = document.createElement('div');
  card.className = 'bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700/50 w-full max-w-4xl overflow-hidden';

  // Header
  const header = document.createElement('div');
  header.className = 'bg-gradient-to-r from-purple-600 to-blue-600 p-4 sm:p-6 text-center';
  const headerRow = document.createElement('div'); headerRow.className = 'flex items-center justify-center space-x-3 mb-2';
  const headerEmoji = document.createElement('div'); headerEmoji.className = 'text-2xl sm:text-3xl'; headerEmoji.textContent = '🎮';
  const headerTitle = document.createElement('h1'); headerTitle.className = 'text-xl sm:text-2xl font-bold text-white'; headerTitle.textContent = 'Complete Your Profile';
  headerRow.appendChild(headerEmoji); headerRow.appendChild(headerTitle);
  const headerP = document.createElement('p'); headerP.className = 'text-blue-100 text-sm'; headerP.textContent = 'Customize your PongSocial experience';
  header.appendChild(headerRow); header.appendChild(headerP);

  const body = document.createElement('div'); body.className = 'p-4 sm:p-6 lg:p-8';
  const grid = document.createElement('div'); grid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8';

  // Left column
  const leftCol = document.createElement('div'); leftCol.className = 'space-y-6';
  // Profile Picture
  const picBlock = document.createElement('div'); picBlock.className = 'text-center';
  const picWrap = document.createElement('div'); picWrap.className = 'relative inline-block';
  const profilePreview = document.createElement('img'); profilePreview.id = 'profilePreview'; profilePreview.src = (user && (user.picture || (user as any).avatarUrl)) || '/public/default-avatar.svg'; profilePreview.alt = 'Profile Preview'; profilePreview.className = 'w-32 h-32 rounded-full border-4 border-purple-500 object-cover bg-gray-700';
  profilePreview.addEventListener('error', () => { profilePreview.src = '/public/default-avatar.svg'; });
  const changeAvatarBtn = document.createElement('button'); changeAvatarBtn.id = 'changeAvatarBtn'; changeAvatarBtn.className = 'absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full transition-colors';
  // Build svg icon safely for the change avatar button
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'w-4 h-4');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');
  const p1 = document.createElementNS(svgNS, 'path');
  p1.setAttribute('stroke-linecap', 'round');
  p1.setAttribute('stroke-linejoin', 'round');
  p1.setAttribute('stroke-width', '2');
  p1.setAttribute('d', "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z");
  const p2 = document.createElementNS(svgNS, 'path');
  p2.setAttribute('stroke-linecap', 'round');
  p2.setAttribute('stroke-linejoin', 'round');
  p2.setAttribute('stroke-width', '2');
  p2.setAttribute('d', 'M15 13a3 3 0 11-6 0 3 3 0 016 0z');
  svg.appendChild(p1); svg.appendChild(p2);
  changeAvatarBtn.appendChild(svg);
  picWrap.appendChild(profilePreview); picWrap.appendChild(changeAvatarBtn);
  const picHint = document.createElement('p'); picHint.className = 'text-gray-400 text-sm mt-2'; picHint.textContent = 'Click to change avatar';
  picBlock.appendChild(picWrap); picBlock.appendChild(picHint);
  leftCol.appendChild(picBlock);

  // Personal Info
  const personal = document.createElement('div'); personal.className = 'space-y-4';
  const piTitle = document.createElement('h3'); piTitle.className = 'text-lg font-semibold text-white border-b border-gray-700 pb-2'; piTitle.textContent = 'Personal Information'; personal.appendChild(piTitle);

  // Fullname
  const fullnameDiv = document.createElement('div');
  const fullnameLabel = document.createElement('label'); fullnameLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const flWrap = document.createElement('span'); flWrap.className = 'flex items-center space-x-2';
  const flIcon = document.createElement('span'); flIcon.className = 'text-lg'; flIcon.textContent = '👤';
  const flText = document.createElement('span'); flText.textContent = 'Full Name';
  flWrap.appendChild(flIcon); flWrap.appendChild(flText); fullnameLabel.appendChild(flWrap);
  const fullnameInput = document.createElement('input'); fullnameInput.id = 'fullnameInput'; fullnameInput.type = 'text'; fullnameInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'; fullnameInput.placeholder = 'Enter your full name';
  fullnameDiv.appendChild(fullnameLabel); fullnameDiv.appendChild(fullnameInput);

  // Birthday
  const birthdayDiv = document.createElement('div');
  const birthdayLabel = document.createElement('label'); birthdayLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const bdWrap = document.createElement('span'); bdWrap.className = 'flex items-center space-x-2';
  const bdIcon = document.createElement('span'); bdIcon.className = 'text-lg'; bdIcon.textContent = '🎂';
  const bdText = document.createElement('span'); bdText.textContent = 'Birthday';
  bdWrap.appendChild(bdIcon); bdWrap.appendChild(bdText); birthdayLabel.appendChild(bdWrap);
  const birthdayInput = document.createElement('input'); birthdayInput.id = 'birthdayInput'; birthdayInput.type = 'date'; birthdayInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  birthdayDiv.appendChild(birthdayLabel); birthdayDiv.appendChild(birthdayInput);

  // Gender
  const genderDiv = document.createElement('div');
  const genderLabel = document.createElement('label'); genderLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const gdWrap = document.createElement('span'); gdWrap.className = 'flex items-center space-x-2';
  const gdIcon = document.createElement('span'); gdIcon.className = 'text-lg'; gdIcon.textContent = '⚧️';
  const gdText = document.createElement('span'); gdText.textContent = 'Gender';
  gdWrap.appendChild(gdIcon); gdWrap.appendChild(gdText); genderLabel.appendChild(gdWrap);
  const genderSelect = document.createElement('select'); genderSelect.id = 'genderInput'; genderSelect.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  ['', 'male', 'female', 'non-binary', 'other'].forEach((v, i) => { const opt = document.createElement('option'); opt.value = v; opt.textContent = i === 0 ? 'Prefer not to say' : v.charAt(0).toUpperCase() + v.slice(1); genderSelect.appendChild(opt); });
  genderDiv.appendChild(genderLabel); genderDiv.appendChild(genderSelect);

  // Phone
  const phoneDiv = document.createElement('div');
  const phoneLabel = document.createElement('label'); phoneLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const phWrap = document.createElement('span'); phWrap.className = 'flex items-center space-x-2';
  const phIcon = document.createElement('span'); phIcon.className = 'text-lg'; phIcon.textContent = '📱';
  const phText = document.createElement('span'); phText.textContent = 'Phone Number';
  phWrap.appendChild(phIcon); phWrap.appendChild(phText); phoneLabel.appendChild(phWrap);
  const phoneInput = document.createElement('input'); phoneInput.id = 'phoneInput'; phoneInput.type = 'tel'; phoneInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'; phoneInput.placeholder = '+1 (555) 123-4567';
  phoneDiv.appendChild(phoneLabel); phoneDiv.appendChild(phoneInput);

  personal.appendChild(fullnameDiv); personal.appendChild(birthdayDiv); personal.appendChild(genderDiv); personal.appendChild(phoneDiv);
  leftCol.appendChild(personal);

  // Right column
  const rightCol = document.createElement('div'); rightCol.className = 'space-y-6';
  const locTitle = document.createElement('h3'); locTitle.className = 'text-lg font-semibold text-white border-b border-gray-700 pb-2'; locTitle.textContent = 'Location & Education'; rightCol.appendChild(locTitle);

  // Location
  const locDiv = document.createElement('div'); const locLabel = document.createElement('label'); locLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const locWrap = document.createElement('span'); locWrap.className = 'flex items-center space-x-2';
  const locIcon = document.createElement('span'); locIcon.className = 'text-lg'; locIcon.textContent = '📍';
  const locText = document.createElement('span'); locText.textContent = 'Where do you live?'; locWrap.appendChild(locIcon); locWrap.appendChild(locText); locLabel.appendChild(locWrap);
  const locationInput = document.createElement('input'); locationInput.id = 'locationInput'; locationInput.type = 'text'; locationInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'; locationInput.placeholder = 'City, Country'; locDiv.appendChild(locLabel); locDiv.appendChild(locationInput);

  // Education
  const eduDiv = document.createElement('div'); const eduLabel = document.createElement('label'); eduLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const eduWrap = document.createElement('span'); eduWrap.className = 'flex items-center space-x-2';
  const eduIcon = document.createElement('span'); eduIcon.className = 'text-lg'; eduIcon.textContent = '🎓';
  const eduText = document.createElement('span'); eduText.textContent = 'Education'; eduWrap.appendChild(eduIcon); eduWrap.appendChild(eduText); eduLabel.appendChild(eduWrap);
  const educationInput = document.createElement('input'); educationInput.id = 'educationInput'; educationInput.type = 'text'; educationInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'; educationInput.placeholder = 'School or University'; eduDiv.appendChild(eduLabel); eduDiv.appendChild(educationInput);

  rightCol.appendChild(locDiv); rightCol.appendChild(eduDiv);

  // Bio
  const bioBlock = document.createElement('div'); const bioLabel = document.createElement('label'); bioLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const bioWrap = document.createElement('span'); bioWrap.className = 'flex items-center space-x-2';
  const bioIcon = document.createElement('span'); bioIcon.className = 'text-lg'; bioIcon.textContent = '💬';
  const bioText = document.createElement('span'); bioText.textContent = 'Bio'; bioWrap.appendChild(bioIcon); bioWrap.appendChild(bioText); bioLabel.appendChild(bioWrap);
  const bioInput = document.createElement('textarea'); bioInput.id = 'bioInput'; bioInput.rows = 4; bioInput.maxLength = 200; bioInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none'; bioInput.placeholder = 'Tell us about yourself and your Pong skills...';
  const charDiv = document.createElement('div'); charDiv.className = 'text-xs text-gray-400 text-right mt-1'; const charCount = document.createElement('span'); charCount.id = 'charCount'; charCount.textContent = '0'; charDiv.appendChild(charCount); charDiv.appendChild(document.createTextNode('/200'));
  bioBlock.appendChild(bioLabel); bioBlock.appendChild(bioInput); bioBlock.appendChild(charDiv);
  rightCol.appendChild(bioBlock);

  // Relationship Status
  const relStatBlock = document.createElement('div');
  const relStatLabel = document.createElement('label'); relStatLabel.className = 'block text-sm font-medium text-gray-300 mb-2';
  const relWrap = document.createElement('span'); relWrap.className = 'flex items-center space-x-2';
  const relIcon = document.createElement('span'); relIcon.className = 'text-lg'; relIcon.textContent = '❤️';
  const relText = document.createElement('span'); relText.textContent = 'Relationship Status';
  relWrap.appendChild(relIcon); relWrap.appendChild(relText); relStatLabel.appendChild(relWrap);

  const relStatSelect = document.createElement('div'); relStatSelect.className = 'relative';
  const rsInput = document.createElement('select'); rsInput.id = 'relationshipInput'; rsInput.className = 'w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  ['', 'Single', 'In a Relationship', 'Married', 'Divorced', 'Widowed', 'It\'s Complicated'].forEach(opt => {
    const o = document.createElement('option'); o.value = opt; o.textContent = opt === '' ? 'Select your status' : opt;
    if (opt === '') o.disabled = true;
    if (opt === '') o.selected = true;
    rsInput.appendChild(o);
  });
  const arrowDiv = document.createElement('div'); arrowDiv.className = 'absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none';
  const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); arrowSvg.setAttribute('class', 'w-4 h-4 text-gray-400'); arrowSvg.setAttribute('fill', 'none'); arrowSvg.setAttribute('stroke', 'currentColor'); arrowSvg.setAttribute('viewBox', '0 0 24 24');
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path'); arrowPath.setAttribute('stroke-linecap', 'round'); arrowPath.setAttribute('stroke-linejoin', 'round'); arrowPath.setAttribute('stroke-width', '2'); arrowPath.setAttribute('d', 'M19 9l-7 7-7-7');
  arrowSvg.appendChild(arrowPath); arrowDiv.appendChild(arrowSvg);
  relStatSelect.appendChild(rsInput); relStatSelect.appendChild(arrowDiv);

  relStatBlock.appendChild(relStatLabel); relStatBlock.appendChild(relStatSelect);
  rightCol.appendChild(relStatBlock);

  // Gaming preferences
  const gamePref = document.createElement('div'); const gpLabel = document.createElement('label'); gpLabel.className = 'block text-sm font-medium text-gray-300 mb-3';
  const gpWrap = document.createElement('span'); gpWrap.className = 'flex items-center space-x-2';
  const gpIcon = document.createElement('span'); gpIcon.className = 'text-lg'; gpIcon.textContent = '🎯';
  const gpText = document.createElement('span'); gpText.textContent = 'Gaming Style'; gpWrap.appendChild(gpIcon); gpWrap.appendChild(gpText); gpLabel.appendChild(gpWrap); gamePref.appendChild(gpLabel);
  const gpGrid = document.createElement('div'); gpGrid.className = 'grid grid-cols-2 gap-2';
  ['competitive', 'casual', 'tournament', 'friendly'].forEach(optVal => {
    const lab = document.createElement('label'); lab.className = 'flex items-center space-x-2 p-3 bg-gray-700/50 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors';
    const inp = document.createElement('input'); inp.type = 'checkbox'; inp.name = 'gamingStyle'; inp.value = optVal; inp.className = 'text-blue-500 rounded focus:ring-blue-500';
    const span = document.createElement('span'); span.className = 'text-gray-300 text-sm'; span.textContent = optVal.charAt(0).toUpperCase() + optVal.slice(1);
    lab.appendChild(inp); lab.appendChild(span); gpGrid.appendChild(lab);
  });
  gamePref.appendChild(gpGrid); rightCol.appendChild(gamePref);

  // Action buttons
  const actionRow = document.createElement('div'); actionRow.className = 'mt-8 flex flex-col sm:flex-row gap-4';
  const completeBtn = document.createElement('button'); completeBtn.id = 'completeProfileBtn'; completeBtn.className = 'flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 shadow-lg';
  // Build complete button content safely
  const completeInner = document.createElement('span'); completeInner.className = 'flex items-center justify-center space-x-2';
  const completeIcon = document.createElement('span'); completeIcon.className = 'text-lg'; completeIcon.textContent = '🎮';
  const completeText = document.createElement('span'); completeText.textContent = 'Complete Setup & Play!';
  completeInner.appendChild(completeIcon); completeInner.appendChild(completeText); completeBtn.appendChild(completeInner);
  const skipBtn = document.createElement('button'); skipBtn.id = 'skipForNowBtn'; skipBtn.className = 'flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all border border-gray-500 hover:border-gray-400';
  const skipInner = document.createElement('span'); skipInner.className = 'flex items-center justify-center space-x-2';
  const skipText = document.createElement('span'); skipText.textContent = 'Skip for Now';
  const skipArrow = document.createElement('span'); skipArrow.textContent = '➡️';
  skipInner.appendChild(skipText); skipInner.appendChild(skipArrow); skipBtn.appendChild(skipInner);
  actionRow.appendChild(completeBtn); actionRow.appendChild(skipBtn);

  const setupMessage = document.createElement('div'); setupMessage.id = 'setupMessage'; setupMessage.className = 'mt-4 text-center text-sm';

  leftCol.appendChild(actionRow); leftCol.appendChild(setupMessage);

  grid.appendChild(leftCol); grid.appendChild(rightCol);
  body.appendChild(grid);
  card.appendChild(header); card.appendChild(body);
  root.appendChild(card);

  // Replace app content
  app.textContent = '';
  app.appendChild(root);

  setupProfileSetupEventListeners();
}

function setupProfileSetupEventListeners() {
  const completeBtn = document.getElementById('completeProfileBtn') as HTMLButtonElement;
  const skipBtn = document.getElementById('skipForNowBtn') as HTMLButtonElement;
  const bioInput = document.getElementById('bioInput') as HTMLTextAreaElement;
  const charCount = document.getElementById('charCount') as HTMLElement;
  const changeAvatarBtn = document.getElementById('changeAvatarBtn') as HTMLButtonElement;
  const profilePreview = document.getElementById('profilePreview') as HTMLImageElement;

  // Character count for bio
  bioInput.addEventListener('input', () => {
    charCount.textContent = bioInput.value.length.toString();
  });

  // Avatar change (placeholder - you can implement actual upload later)
  changeAvatarBtn.addEventListener('click', () => {
    // Simple demo - cycle through some default avatars
    const avatars = [
      '/public/default-avatar.svg',
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjOEI1QTM2Ii8+CjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIwIiBmaWxsPSIjRjhGQ0ZGIi8+CjxwYXRoIGQ9Ik0zMCA5MEMzMCA3Mi4zMjg0IDQ0LjMyODQgNTggNjIgNThINjZDNzMuNzE1NyA1OCA4MCA2NC4yODQzIDgwIDcyVjk4QzgwIDEwNS43MTYgNzMuNzE1NyAxMTIgNjYgMTE0SDYyQzQ0LjMyODQgMTE0IDMwIDk5LjY3MTYgMzAgODJaIiBmaWxsPSIjRjhGQ0ZGIi8+Cjwvc3ZnPgo=',
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjU5MzMwIi8+CjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIwIiBmaWxsPSIjRjhGQ0ZGIi8+CjxwYXRoIGQ9Ik0zMCA5MEMzMCA3Mi4zMjg0IDQ0LjMyODQgNTggNjIgNThINjZDNzMuNzE1NyA1OCA4MCA2NC4yODQzIDgwIDcyVjk4QzgwIDEwNS43MTYgNzMuNzE1NyAxMTIgNjYgMTE0SDYyQzQ0LjMyODQgMTE0IDMwIDk5LjY3MTYgMzAgODJaIiBmaWxsPSIjRjhGQ0ZGIi8+Cjwvc3ZnPgo='
    ];
    const currentIndex = avatars.indexOf(profilePreview.src);
    const nextIndex = (currentIndex + 1) % avatars.length;
    profilePreview.src = avatars[nextIndex];
  });

  completeBtn.addEventListener('click', async () => {
    const fullname = (document.getElementById('fullnameInput') as HTMLInputElement).value;
    const birthday = (document.getElementById('birthdayInput') as HTMLInputElement).value;
    const gender = (document.getElementById('genderInput') as HTMLSelectElement).value;
    const phone = (document.getElementById('phoneInput') as HTMLInputElement).value;
    const location = (document.getElementById('locationInput') as HTMLInputElement).value;
    const education = (document.getElementById('educationInput') as HTMLInputElement).value;
    const relationship_status = (document.getElementById('relationshipInput') as HTMLSelectElement).value;
    const bio = bioInput.value;
    const avatarUrl = profilePreview.src;

    // Show loading state
    completeBtn.disabled = true;
    setButtonLoadingState(completeBtn, true, 'Saving Profile...');

    try {
      // Get current user
      const user = getCurrentUser();
      if (!user) throw new Error("User not found");

      // Save profile data to backend
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          fullname: fullname || null,
          birthday: birthday || null,
          gender: gender || null,
          phone: phone || null,
          bio: bio || null,
          lives_in: location || null,
          education: education || null,
          relationship_status: relationship_status || null,
          avatarUrl: avatarUrl !== '/public/default-avatar.svg' ? avatarUrl : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      showMessage('Profile completed successfully!', 'success');
      await initAuth();
      // Show nav bar and navigate to profile
      const nav = document.querySelector("nav");
      if (nav) nav.style.display = 'block';

      setTimeout(() => {
        router.navigate('/profile');
      }, 1500);
    } catch (error) {
      // Type-safe error handling
      let errorMessage = 'Failed to save profile';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      showMessage(errorMessage, 'error');

      // Reset button state
      completeBtn.disabled = false;
      setButtonLoadingState(completeBtn, false);
    }
  });

  // Skip for now
  skipBtn.addEventListener('click', () => {
    const nav = document.querySelector("nav");
    if (nav) {
      nav.style.display = 'block';
    }
    // Navigate to profile - nav bar will show automatically there
    router.navigate('/profile');
  });
}

function setButtonLoadingState(btn: HTMLButtonElement, loading: boolean, text?: string) {
  // Clear existing children
  while (btn.firstChild) btn.removeChild(btn.firstChild);
  if (loading) {
    const wrapper = document.createElement('span');
    wrapper.className = 'flex items-center justify-center space-x-2';
    const spinner = document.createElement('div');
    spinner.className = 'animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent';
    const span = document.createElement('span');
    span.textContent = text || 'Loading...';
    wrapper.appendChild(spinner);
    wrapper.appendChild(span);
    btn.appendChild(wrapper);
  } else {
    const wrapper = document.createElement('span');
    wrapper.className = 'flex items-center justify-center space-x-2';
    const icon = document.createElement('span');
    icon.textContent = '🎮';
    icon.className = 'text-lg';
    const span = document.createElement('span');
    span.textContent = 'Complete Setup & Play!';
    wrapper.appendChild(icon);
    wrapper.appendChild(span);
    btn.appendChild(wrapper);
  }
}

function showMessage(message: string, type: 'success' | 'error') {
  const messageEl = document.getElementById('setupMessage') as HTMLElement;
  messageEl.textContent = message;
  messageEl.className = `mt-4 text-center text-sm font-medium ${type === 'success' ? 'text-green-400' : 'text-red-400'
    } animate-pulse`;
}