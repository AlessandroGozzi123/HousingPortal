// EstaThe Minecraft username
const ESTA_THE_UUID = "534359f7-5407-4b19-ba92-c71c370022a5";

// EstaThe houses
const MY_HOUSES = [
    {
        name: "§4Cursed House §6Adventure",
        category: "adventure",
        desc: "Explore a dark, haunted mansion filled with traps."
    },
    {
        name: "§42P §bPK Reactor Run",
        category: "2player",
        desc: "Co-op parkour challenge through a melting reactor!"
    },
    {
        name: "§42P §bParkour Mountain",
        category: "2player",
        desc: "Race to the summit with your partner in this scenic climb."
    },
    {
        name: "§42P §bParkour Labs V2",
        category: "2player",
        desc: "Scientific jumping tests that require perfect synergy."
    },
    {
        name: "§42P §bParkour Everest",
        category: "2player",
        desc: "The ultimate cold peak parkour challenge for two players."
    },
    {
        name: "§4- §b3 Player Coop §4-",
        category: "2player",
        desc: "A special three-player cooperative jumping map!"
    },
    {
        name: "§6Shift At Midnight",
        category: "adventure",
        desc: "A dark mystery adventure session that starts at midnight."
    }
];

// App State
let houses = [];
let filteredHouses = [];
let favoritedHouses = JSON.parse(localStorage.getItem('favoritedHouses') || '[]');
let isSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';

// DOM Elements
const houseGrid = document.getElementById('house-grid');
const skeletonGrid = document.getElementById('skeleton-grid');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const pinnedGrid = document.getElementById('pinned-grid');
const favoritesSection = document.getElementById('favorites-section');
const favoritesGrid = document.getElementById('favorites-grid');

// Controls
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const sortSelect = document.getElementById('sort-select');
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const connectionStatus = document.getElementById('connection-status');
const retryBtn = document.getElementById('retry-btn');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIcon = document.getElementById('sound-icon');
const soundLabel = document.getElementById('sound-label');
const offlineToggle = document.getElementById('offline-toggle');

// Stats Elements
const statActiveHouses = document.getElementById('stat-active-houses');
const statTotalPlayers = document.getElementById('stat-total-players');
const statTotalCookies = document.getElementById('stat-total-cookies');

// Modal Elements
const corsHelpBtn = document.getElementById('cors-help-btn');
const corsModal = document.getElementById('cors-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalOkBtn = document.getElementById('modal-ok-btn');

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    // Register Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Initialize Ender Particles animation
    initEnderParticles();

    // Render Pinned Creations immediately (Offline mode first)
    renderPinnedHouses();

    // Render Favorites immediately (empty first or loaded from cache if data exists)
    renderFavoritesGrid();

    // Set initial sound button label/icon
    updateSoundButtonUI();

    // Event Listeners
    refreshBtn.addEventListener('click', fetchData);
    retryBtn.addEventListener('click', fetchData);
    resetFiltersBtn.addEventListener('click', resetFilters);

    searchInput.addEventListener('input', handleSearchInput);
    clearSearchBtn.addEventListener('click', clearSearch);
    sortSelect.addEventListener('change', applyFiltersAndSort);
    if (offlineToggle) {
        offlineToggle.addEventListener('change', applyFiltersAndSort);
    }

    // Modal Event Listeners
    corsHelpBtn.addEventListener('click', () => showModal(true));
    closeModalBtn.addEventListener('click', () => showModal(false));
    modalOkBtn.addEventListener('click', () => showModal(false));
    soundToggleBtn.addEventListener('click', toggleSound);

    // Event listener for sound
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.btn, .icon-btn, .close-btn, .category-checkbox, .mc-checkbox-container, select, #sound-toggle-btn, .discord-badge, .clear-btn');
        if (target) {
            playClickSound();
        }
    });

    // Close modal on outside click
    corsModal.addEventListener('click', (e) => {
        if (e.target === corsModal) showModal(false);
    });

    // Event listener for checkboxes
    const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
    categoryCheckboxes.forEach(cb => {
        cb.addEventListener('change', applyFiltersAndSort);
    });

    fetchData();
});

// Fetch Active Housing Data
async function fetchData() {
    setLoadingState(true);
    updateConnectionStatus('loading', 'Fetching data...');

    // Dual-mode API routing: local Node proxy when developing locally, php proxy online
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const targetUrl = isLocal ? '/api/active-housing' : 'api.php';

    try {
        const response = await fetch(targetUrl);

        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }

        const rawData = await response.json();

        // Parse the response based on possible structures
        houses = parseHousingData(rawData);

        // Render EstaThe's Pinned Creations with live stats
        renderPinnedHouses();

        // Render online favorited houses
        renderFavoritesGrid();

        // Update dashboard
        applyFiltersAndSort();
        updateConnectionStatus('success', 'Connected');
        setLoadingState(false);
        showToast('Successfully updated housing list!');

    } catch (error) {
        console.error('Error fetching Hypixel Housing data:', error);

        let customMsg = `API connection error: ${error.message}.`;
        if (!isLocal) {
            customMsg = `Production API error: ${error.message}. Ensure api.php is uploaded and your hosting supports cURL.`;
        } else if (window.location.protocol === 'file:') {
            customMsg = 'Opened index.html directly as a file. Please start the local server by running "npm start" in your terminal and visit http://localhost:3000 to bypass CORS restrictions.';
        } else {
            customMsg = `Local proxy error: ${error.message}. Make sure the Node server is running (run 'npm start' in terminal).`;
        }

        setLoadingState(false);
        updateConnectionStatus('error', 'Error');
        showError(customMsg);
    }
}


// Parser that handles both direct arrays and standard wrapper formats
function parseHousingData(data) {
    if (!data) return [];

    // Case 1: Response itself is an array
    if (Array.isArray(data)) {
        return data;
    }

    // Case 2: standard wrap (e.g. { success: true, active: [...] })
    if (typeof data === 'object') {
        // Look for common array wrappers
        const arrayFields = ['active', 'sessions', 'houses', 'data', 'body'];
        for (const field of arrayFields) {
            if (Array.isArray(data[field])) {
                return data[field];
            }
        }

        // Loop all fields to see if any are arrays
        for (const key in data) {
            if (Array.isArray(data[key])) {
                return data[key];
            }
        }
    }

    return [];
}

// Set loading UI states
function setLoadingState(isLoading) {
    if (isLoading) {
        skeletonGrid.style.display = 'grid';
        houseGrid.style.display = 'none';
        errorState.style.display = 'none';
        emptyState.style.display = 'none';
        refreshBtn.disabled = true;
        refreshIcon.classList.add('spin-animation');
    } else {
        skeletonGrid.style.display = 'none';
        refreshBtn.disabled = false;
        refreshIcon.classList.remove('spin-animation');
    }
}

// Show error UI state
function showError(message) {
    errorMessage.textContent = message;
    errorState.style.display = 'flex';
    houseGrid.style.display = 'none';
    skeletonGrid.style.display = 'none';
    emptyState.style.display = 'none';
}

// Update connection status indicator
function updateConnectionStatus(type, label) {
    connectionStatus.className = `api-status-badge ${type}`;
    const dot = connectionStatus.querySelector('.status-dot');
    const text = connectionStatus.querySelector('.status-text');
    text.textContent = label;
}

// Manage Search inputs
function handleSearchInput() {
    const value = searchInput.value.trim();
    clearSearchBtn.style.display = value ? 'flex' : 'none';
    applyFiltersAndSort();
}

function clearSearch() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    applyFiltersAndSort();
    searchInput.focus();
}

function resetFilters() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    sortSelect.value = 'players-desc';
    if (offlineToggle) offlineToggle.checked = true;

    // Uncheck all category checkboxes
    const checkboxes = document.querySelectorAll('.category-checkbox');
    checkboxes.forEach(cb => cb.checked = false);

    applyFiltersAndSort();
}

// Apply Search Filters & Sorting logic
function applyFiltersAndSort() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const sortBy = sortSelect.value;

    // 1. Filtering by search and selected categories
    const checkedCheckboxes = Array.from(document.querySelectorAll('.category-checkbox:checked'));
    const selectedCategories = checkedCheckboxes.map(cb => cb.value);

    filteredHouses = houses.filter(house => {
        // Assign category dynamically if not present
        if (!house.category) {
            house.category = getCategory(house.name);
        }

        const rawName = stripMinecraftColors(house.name || '').toLowerCase();
        const uuid = (house.uuid || '').toLowerCase();
        const owner = (house.owner || '').toLowerCase();
        const ownerName = (house.ownerName || '').toLowerCase();

        const matchesSearch = !searchTerm ||
            rawName.includes(searchTerm) ||
            uuid.includes(searchTerm) ||
            owner.includes(searchTerm) ||
            ownerName.includes(searchTerm);

        const matchesCategory = selectedCategories.length === 0 ||
            selectedCategories.includes(house.category);

        const matchesOffline = !offlineToggle || offlineToggle.checked || house.online !== false;

        return matchesSearch && matchesCategory && matchesOffline;
    });

    // 2. Sorting
    filteredHouses.sort((a, b) => {
        switch (sortBy) {
            case 'players-desc':
                return (b.players || 0) - (a.players || 0);
            case 'players-asc':
                return (a.players || 0) - (b.players || 0);
            case 'cookies-desc':
                const cookiesA = a.cookies?.current || 0;
                const cookiesB = b.cookies?.current || 0;
                return cookiesB - cookiesA;
            case 'name-asc':
                const nameA = stripMinecraftColors(a.name || '').toLowerCase();
                const nameB = stripMinecraftColors(b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            case 'created-desc':
                return (b.createdAt || 0) - (a.createdAt || 0);
            default:
                return 0;
        }
    });

    // 3. Render
    renderStats();
    renderHouses();
}

// Helper: Determine category of a housing based on name keywords
function getCategory(name) {
    if (!name) return 'random';

    // Clean name of formatting and lowercase it
    const cleanName = stripMinecraftColors(name).toLowerCase();

    // 1. 2Player/Co-op check (highest precedence)
    if (cleanName.includes('2p') ||
        cleanName.includes('3p') ||
        cleanName.includes('coop') ||
        cleanName.includes('co-op') ||
        cleanName.includes('2player') ||
        cleanName.includes('2 player')) {
        return '2player';
    }

    // 2. Parkour check
    if (cleanName.includes('parkour') ||
        cleanName.includes('pk') ||
        cleanName.includes('jump')) {
        return 'parkour';
    }

    // 3. Free Build check
    if (cleanName.includes('freebuild')) {
        return 'freebuild';
    }

    // 4. PvP check
    if (cleanName.includes('pvp')) {
        return 'pvp';
    }

    // 5. Hangout check
    if (cleanName.includes('hangout')) {
        return 'hangout';
    }

    // 6. Adventure check
    if (cleanName.includes('adventure') || cleanName.includes('story')) {
        return 'adventure';
    }

    // 7. Escape check
    if (cleanName.includes('escape') || cleanName.includes('puzzle')) {
        return 'escape';
    }

    // 8. Minigame check
    if (cleanName.includes('minigame')) {
        return 'minigame';
    }

    return 'random';
}

// Update the Top Stats Cards
function renderStats() {
    const totalHouses = houses.length;
    const totalPlayers = houses.reduce((sum, h) => sum + (h.players || 0), 0);
    const totalCookies = houses.reduce((sum, h) => sum + (h.cookies?.current || 0), 0);

    statActiveHouses.textContent = totalHouses.toLocaleString();
    statTotalPlayers.textContent = totalPlayers.toLocaleString();
    statTotalCookies.textContent = totalCookies.toLocaleString();
}

// Render House Cards into Grid
function renderHouses() {
    houseGrid.innerHTML = '';

    if (filteredHouses.length === 0) {
        if (houses.length > 0) {
            // Searched yielded no results
            emptyState.style.display = 'flex';
        }
        houseGrid.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    houseGrid.style.display = 'grid';

    filteredHouses.forEach(house => {
        const nameHTML = parseMinecraftColors(house.name || 'Unnamed House');
        const ownerUUID = house.owner || 'Unknown';
        const houseUUID = house.uuid || 'Unknown';
        const players = house.players || 0;
        const cookies = house.cookies?.current || 0;
        const timeAgo = formatTimeAgo(house.createdAt);

        // Avatar URL (mc-heads API is standard and fast)
        const avatarUrl = ownerUUID !== 'Unknown'
            ? `https://mc-heads.net/avatar/${ownerUUID}/32`
            : `https://mc-heads.net/avatar/steve/32`;

        const ownerName = house.ownerName || (ownerUUID !== 'Unknown' ? ownerUUID.substring(0, 14) + '...' : 'Unknown');

        const isFav = favoritedHouses.some(f => {
            const cleanFavName = f.name.toLowerCase().trim();
            const cleanActiveName = stripMinecraftColors(house.name || '').toLowerCase().trim();
            const cleanFavOwner = f.owner.replace(/-/g, '').toLowerCase();
            const cleanActiveOwner = ownerUUID.replace(/-/g, '').toLowerCase();
            return cleanFavOwner === cleanActiveOwner && cleanFavName === cleanActiveName;
        });

        const isOnline = house.online !== false;

        const card = document.createElement('div');
        card.className = `house-card ${isOnline ? '' : 'offline'}`;
        card.innerHTML = `
            <div class="card-header">
                <h3 class="house-name">${nameHTML}</h3>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${ownerUUID}', \`${escapeJSString(house.name)}\`)" title="${isFav ? 'Remove from bookmarks' : 'Bookmark this house'}">
                        <i data-lucide="star" style="width: 18px; height: 18px; fill: ${isFav ? 'currentColor' : 'none'};"></i>
                    </button>
                    <div class="cookies-badge">
                        <i data-lucide="cookie"></i>
                        <span>${cookies.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="card-details">
                <div class="detail-item">
                    <i data-lucide="user"></i>
                    <span class="label">Owner:</span>
                    <img src="${avatarUrl}" alt="Owner skin" class="owner-avatar" onerror="this.src='https://mc-heads.net/avatar/steve/32'" style="width: 16px; height: 16px; border-radius: 4px; object-fit: cover;">
                    <span class="value" title="UUID: ${ownerUUID}">${ownerName}</span>
                </div>
                <div class="detail-item">
                    <i data-lucide="tag"></i>
                    <span class="label">Category:</span>
                    <span class="value" style="color: var(--color-diamond); font-family: var(--font-clean); font-weight: 600;">${getCategoryDisplayName(house.category)}</span>
                </div>
                <div class="detail-item">
                    <i data-lucide="clock"></i>
                    <span class="label">${isOnline ? 'Started:' : 'Last Seen:'}</span>
                    <span class="value">${timeAgo}</span>
                </div>
            </div>
            
            <div class="card-footer">
                ${isOnline ? `
                <div class="players-indicator">
                    <i data-lucide="users"></i>
                    <span>${players} player${players === 1 ? '' : 's'}</span>
                </div>
                ` : `
                <div class="players-indicator offline">
                    <i data-lucide="users"></i>
                    <span>OFFLINE</span>
                </div>
                `}
                
                <div class="command-box-wrapper" onclick="copyToClipboard('/visit ${ownerName}', 'Command copied to clipboard!')" title="Click to copy join command">
                    <input type="text" class="mc-command-input" value="/visit ${ownerName}" readonly>
                    <div class="copy-badge-overlay">
                        <i data-lucide="copy"></i>
                    </div>
                </div>
            </div>
        `;

        houseGrid.appendChild(card);
    });

    // Refresh Icons inside newly added cards
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Modal Trigger Help
function showModal(show) {
    corsModal.style.display = show ? 'flex' : 'none';
}

// Helper: Copy text to clipboard and trigger alert toast
function copyToClipboard(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
        if (text.includes('/visit')) {
            playLevelUpSound();
        } else {
            playOrbSound();
        }
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// Helper: Toast alerts
function showToast(message) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const checkIcon = window.lucide ? '<i data-lucide="check-circle" style="color: var(--success); width:16px; height:16px;"></i>' : '';
    toast.className = 'toast';
    toast.innerHTML = `${checkIcon} <span>${message}</span>`;

    toastContainer.appendChild(toast);

    if (window.lucide) {
        window.lucide.createIcons();
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            toast.remove();
            if (toastContainer.childNodes.length === 0) {
                toastContainer.remove();
            }
        }, 300);
    }, 3000);
}

// Helper: Strip Minecraft color formatting codes
function stripMinecraftColors(text) {
    if (!text) return '';
    return text.replace(/[&§][0-9a-fk-or]/gi, '');
}

// Helper: Parse Minecraft styling formatting to CSS styled HTML
function parseMinecraftColors(text) {
    if (!text) return '';

    // Normalize codes to standard section sign
    let formatted = text.replace(/&([0-9a-fk-or])/gi, '§$1');

    if (!formatted.includes('§')) {
        return escapeHTML(text);
    }

    // Map standard Minecraft colors to HEX
    const colorMap = {
        '0': '#000000',
        '1': '#0000AA',
        '2': '#00AA00',
        '3': '#00AAAA',
        '4': '#AA0000',
        '5': '#AA00AA',
        '6': '#FFAA00',
        '7': '#AAAAAA',
        '8': '#555555',
        '9': '#5555FF',
        'a': '#55FF55',
        'b': '#55FFFF',
        'c': '#FF5555',
        'd': '#FF55FF',
        'e': '#FFFF55',
        'f': '#FFFFFF'
    };

    const parts = formatted.split('§');
    let result = '';
    let currentColor = null;
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isStrikethrough = false;

    if (parts[0]) {
        result += escapeHTML(parts[0]);
    }

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        const code = part.charAt(0).toLowerCase();
        const content = part.substring(1);

        if (colorMap[code] !== undefined) {
            currentColor = colorMap[code];
            isBold = false;
            isItalic = false;
            isUnderline = false;
            isStrikethrough = false;
        } else if (code === 'l') {
            isBold = true;
        } else if (code === 'm') {
            isStrikethrough = true;
        } else if (code === 'n') {
            isUnderline = true;
        } else if (code === 'o') {
            isItalic = true;
        } else if (code === 'r') {
            currentColor = null;
            isBold = false;
            isItalic = false;
            isUnderline = false;
            isStrikethrough = false;
        }

        if (content) {
            let styles = [];
            if (currentColor) styles.push(`color: ${currentColor}`);
            if (isBold) styles.push('font-weight: 800');
            if (isItalic) styles.push('font-style: italic');

            let textDecoration = [];
            if (isUnderline) textDecoration.push('underline');
            if (isStrikethrough) textDecoration.push('line-through');
            if (textDecoration.length > 0) styles.push(`text-decoration: ${textDecoration.join(' ')}`);

            if (styles.length > 0) {
                result += `<span style="${styles.join('; ')}">${escapeHTML(content)}</span>`;
            } else {
                result += escapeHTML(content);
            }
        }
    }

    return result;
}

function escapeHTML(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper: Format relative timestamp description
function formatTimeAgo(timestamp) {
    if (!timestamp || timestamp <= 0) return 'Unknown';

    const now = Date.now();
    const difference = now - timestamp;

    if (difference < 0) {
        return 'Just now';
    }

    const seconds = Math.floor(difference / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return 'Just now';
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else {
        return `${days}d ago`;
    }
}

// Helper: Initialize Ender portal particles rising from the bottom
function initEnderParticles() {
    const container = document.getElementById('particle-container');
    if (!container) return;

    const maxParticles = 25;
    for (let i = 0; i < maxParticles; i++) {
        createParticle(container);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'ender-particle';

    // Random position across viewport width
    const left = Math.random() * 100;

    // Random speed and delay
    const speed = 6 + Math.random() * 6; // 6s to 12s
    const delay = Math.random() * -12;   // negative delay to disperse initial positions
    const size = 3 + Math.random() * 5;  // 3px to 8px

    particle.style.left = `${left}vw`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.setProperty('--speed', `${speed}s`);
    particle.style.setProperty('--delay', `${delay}s`);

    // Ender colors can be pink/magenta/purple
    const colors = ['#a855f7', '#d8b4fe', '#c084fc', '#e879f9', '#f472b6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.backgroundColor = randomColor;
    particle.style.boxShadow = `0 0 6px ${randomColor}, 0 0 12px ${randomColor}`;

    container.appendChild(particle);
}

// Helper: Render Pinned Creator Houses at the top
function renderPinnedHouses() {
    if (!pinnedGrid) return;
    pinnedGrid.innerHTML = '';

    MY_HOUSES.forEach(myHouse => {
        // Strip colors for matching
        const cleanMyName = stripMinecraftColors(myHouse.name).toLowerCase().trim();

        // Find matching house in active houses list
        // Match owner UUID and name
        const activeMatch = houses.find(h => {
            if (!h.owner) return false;
            const cleanOwner = h.owner.replace(/-/g, '').toLowerCase();
            const cleanTargetOwner = ESTA_THE_UUID.replace(/-/g, '').toLowerCase();

            if (cleanOwner !== cleanTargetOwner) return false;

            const cleanActiveName = stripMinecraftColors(h.name || '').toLowerCase().trim();
            return cleanActiveName === cleanMyName;
        });

        let status = 'offline';
        let players = 0;
        let cookies = 0;

        if (activeMatch) {
            status = 'online';
            players = activeMatch.players || 0;
            cookies = activeMatch.cookies?.current || 0;
        }

        const nameHTML = parseMinecraftColors(myHouse.name);

        const card = document.createElement('div');
        card.className = 'pinned-card';
        card.innerHTML = `
            <div class="card-header">
                <h3 class="house-name">${nameHTML}</h3>
                <span class="status-badge ${status}">${status.toUpperCase()}</span>
            </div>
            
            <div class="card-details">
                <div class="detail-item">
                    <i data-lucide="tag"></i>
                    <span class="label">Category:</span>
                    <span class="value" style="color: var(--color-diamond); font-family: var(--font-clean); font-weight: 600;">${getCategoryDisplayName(myHouse.category)}</span>
                </div>
                ${status === 'online' ? `
                <div class="detail-item">
                    <i data-lucide="cookie"></i>
                    <span class="label">Cookies:</span>
                    <span class="value" style="color: var(--color-gold); font-weight: bold;">${cookies.toLocaleString()}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="card-footer">
                <div class="players-indicator" style="border-color: ${status === 'online' ? 'rgba(85,255,85,0.2)' : 'rgba(255,255,255,0.1)'}; color: ${status === 'online' ? 'var(--color-emerald)' : 'var(--text-secondary)'}; background-color: ${status === 'online' ? 'rgba(85,255,85,0.08)' : 'rgba(255,255,255,0.03)'};">
                    <i data-lucide="users"></i>
                    <span>${players} player${players === 1 ? '' : 's'}</span>
                </div>
                
                <div class="command-box-wrapper" onclick="copyToClipboard('/visit EstaThe', 'Command copied to clipboard!')" title="Click to copy join command" style="max-width: 130px;">
                    <input type="text" class="mc-command-input" value="/visit EstaThe" readonly style="font-size: 0.95rem; padding: 4px 22px 4px 8px;">
                    <div class="copy-badge-overlay" style="right: 5px;">
                        <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                    </div>
                </div>
            </div>
        `;

        pinnedGrid.appendChild(card);
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function getCategoryDisplayName(cat) {
    switch (cat) {
        case '2player': return '2 Player / Co-op';
        case 'parkour': return 'Parkour';
        case 'freebuild': return 'Free Build';
        case 'pvp': return 'PvP';
        case 'hangout': return 'Hangout';
        case 'adventure': return 'Adventure';
        case 'escape': return 'Escape / Puzzle';
        case 'minigame': return 'Minigame';
        default: return 'Random';
    }
}

// Web Audio API Synthesized Minecraft Sound Effects
function playClickSound() {
    if (!isSoundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.06);
    } catch (e) {
        console.error('AudioContext error:', e);
    }
}

function playOrbSound() {
    if (!isSoundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        const pitch = 850 + Math.random() * 200;
        osc.frequency.setValueAtTime(pitch, ctx.currentTime);

        gain.gain.setValueAtTime(0.10, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.16);
    } catch (e) {
        console.error('AudioContext error:', e);
    }
}

function playLevelUpSound() {
    if (!isSoundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (C Major chord)
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + index * 0.08);

            gain.gain.setValueAtTime(0.0, now);
            gain.gain.linearRampToValueAtTime(0.06, now + index * 0.08 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.35);

            osc.start(now + index * 0.08);
            osc.stop(now + index * 0.08 + 0.4);
        });
    } catch (e) {
        console.error('AudioContext error:', e);
    }
}

// Toggle Sound preference
function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('soundEnabled', isSoundEnabled);
    updateSoundButtonUI();

    // Play a test sound if enabled
    if (isSoundEnabled) {
        playOrbSound();
        showToast('Sound effects enabled!');
    } else {
        showToast('Sound effects muted.');
    }
}

// Update Sound Button Text and Icon
function updateSoundButtonUI() {
    if (!soundIcon || !soundLabel || !soundToggleBtn) return;

    if (isSoundEnabled) {
        soundIcon.setAttribute('data-lucide', 'volume-2');
        soundLabel.textContent = 'Sound On';
        soundToggleBtn.style.color = 'var(--color-emerald)';
    } else {
        soundIcon.setAttribute('data-lucide', 'volume-x');
        soundLabel.textContent = 'Sound Muted';
        soundToggleBtn.style.color = 'var(--text-muted)';
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Escape javascript string to prevent breaking onclick handlers
function escapeJSString(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\n/g, '\\n');
}

// Toggle Bookmarking/Favorites status
function toggleFavorite(owner, name) {
    const cleanName = stripMinecraftColors(name).trim();
    const index = favoritedHouses.findIndex(f => {
        const cleanFavOwner = f.owner.replace(/-/g, '').toLowerCase();
        const cleanActiveOwner = owner.replace(/-/g, '').toLowerCase();
        return cleanFavOwner === cleanActiveOwner && f.name.toLowerCase().trim() === cleanName.toLowerCase();
    });

    if (index === -1) {
        favoritedHouses.push({ owner, name: cleanName });
        showToast('House added to bookmarks!');
        playOrbSound();
    } else {
        favoritedHouses.splice(index, 1);
        showToast('House removed from bookmarks!');
        playClickSound();
    }

    localStorage.setItem('favoritedHouses', JSON.stringify(favoritedHouses));
    applyFiltersAndSort();
    renderFavoritesGrid();
}

// Render Favorite Online Sessions
function renderFavoritesGrid() {
    if (!favoritesGrid || !favoritesSection) return;
    favoritesGrid.innerHTML = '';

    if (favoritedHouses.length === 0 || houses.length === 0) {
        favoritesSection.style.display = 'none';
        return;
    }

    // Find active online houses that are favorited
    const activeFavorites = houses.filter(h => {
        if (!h.owner) return false;
        const cleanActiveName = stripMinecraftColors(h.name || '').toLowerCase().trim();
        const cleanActiveOwner = h.owner.replace(/-/g, '').toLowerCase();

        return favoritedHouses.some(f => {
            const cleanFavName = f.name.toLowerCase().trim();
            const cleanFavOwner = f.owner.replace(/-/g, '').toLowerCase();
            return cleanFavOwner === cleanActiveOwner && cleanFavName === cleanActiveName;
        });
    });

    if (activeFavorites.length === 0) {
        favoritesSection.style.display = 'none';
        return;
    }

    favoritesSection.style.display = 'flex';

    activeFavorites.forEach(house => {
        const nameHTML = parseMinecraftColors(house.name || 'Unnamed House');
        const ownerUUID = house.owner || 'Unknown';
        const players = house.players || 0;
        const cookies = house.cookies?.current || 0;
        const ownerName = house.ownerName || (ownerUUID !== 'Unknown' ? ownerUUID.substring(0, 14) + '...' : 'Unknown');

        const card = document.createElement('div');
        card.className = 'pinned-card'; // Reuse the pinned card styling for horizontal scrolling
        card.innerHTML = `
            <div class="card-header">
                <h3 class="house-name">${nameHTML}</h3>
                <button class="favorite-btn active" onclick="event.stopPropagation(); toggleFavorite('${ownerUUID}', \`${escapeJSString(house.name)}\`)" title="Remove from bookmarks" style="margin-left: 4px; flex-shrink: 0;">
                    <i data-lucide="star" style="width: 15px; height: 15px; fill: currentColor;"></i>
                </button>
            </div>
            
            <div class="card-details">
                <div class="detail-item">
                    <i data-lucide="user"></i>
                    <span class="label">Owner:</span>
                    <span class="value" title="UUID: ${ownerUUID}">${ownerName}</span>
                </div>
                <div class="detail-item">
                    <i data-lucide="cookie"></i>
                    <span class="label">Cookies:</span>
                    <span class="value" style="color: var(--color-gold); font-weight: bold;">${cookies.toLocaleString()}</span>
                </div>
            </div>
            
            <div class="card-footer">
                <div class="players-indicator" style="border-color: rgba(85,255,85,0.2); color: var(--color-emerald); background-color: rgba(85,255,85,0.08);">
                    <i data-lucide="users"></i>
                    <span>${players} player${players === 1 ? '' : 's'}</span>
                </div>
                
                <div class="command-box-wrapper" onclick="copyToClipboard('/visit ${ownerName}', 'Command copied to clipboard!')" title="Click to copy join command" style="max-width: 130px;">
                    <input type="text" class="mc-command-input" value="/visit ${ownerName}" readonly style="font-size: 0.95rem; padding: 4px 22px 4px 8px;">
                    <div class="copy-badge-overlay" style="right: 5px;">
                        <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                    </div>
                </div>
            </div>
        `;

        favoritesGrid.appendChild(card);
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}
