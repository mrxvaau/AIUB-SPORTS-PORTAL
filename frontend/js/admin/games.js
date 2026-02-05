/**
 * AIUB Sports Portal - Game Management Module
 * Handles game creation, editing, and the game category modal
 */

// Game counters for IDs
let gameCounters = { male: 0, female: 0, mix: 0 };

// Game rules for different game types
const GC_GAME_RULES = {
    chess: { solo: true, duo: false, mixDuo: false, nvn: false, lockSoloOnly: true },
    carrom: { solo: true, duo: true, mixDuo: true, nvn: false },
    badminton: { solo: true, duo: true, mixDuo: true, nvn: false },
    lawnTennis: { solo: true, duo: true, mixDuo: true, nvn: false },
    tableTennis: { solo: true, duo: true, mixDuo: true, nvn: false },
    pool: { solo: true, duo: true, mixDuo: true, nvn: false },
    ludo: { solo: false, duo: true, mixDuo: true, nvn: false },
    football: { solo: false, duo: false, mixDuo: false, nvn: true },
    cricket: { solo: false, duo: false, mixDuo: false, nvn: true },
    basketball: { solo: false, duo: false, mixDuo: false, nvn: true },
    futsal: { solo: false, duo: false, mixDuo: false, nvn: true },
    handball: { solo: false, duo: false, mixDuo: false, nvn: true },
    volleyball: { solo: false, duo: false, mixDuo: false, nvn: true },
};

/**
 * Open the game category modal
 */
function openGameCategoryModal() {
    document.getElementById('gameCategoryModal').classList.add('active');
    document.getElementById('gc_gameSelect').value = "";
    document.getElementById('gc_entryFee').value = 100;
    document.getElementById('gc_customGameField').style.display = 'none';
    document.getElementById('gc_customTeamSizeRow').style.display = 'none';
    document.getElementById('gc_teamSize').value = "";
    document.getElementById('gc_customGame').value = "";

    // Reset Men/Women
    const personPills = document.querySelectorAll('#gc_personGroup .pill-check');
    personPills.forEach(p => {
        p.classList.add('active');
        const input = p.querySelector('input');
        if (input) input.checked = true;
    });

    gc_resetFormats();
}

/**
 * Close the game category modal
 */
function closeGameCategoryModal() {
    document.getElementById('gameCategoryModal').classList.remove('active');
}

/**
 * Reset all format options
 */
function gc_resetFormats() {
    const formatIds = [
        { pill: 'gc_fmtSolo', input: 'gc_formatSolo' },
        { pill: 'gc_fmtDuo', input: 'gc_formatDuo' },
        { pill: 'gc_fmtMixDuo', input: 'gc_formatMixDuo' },
        { pill: 'gc_fmtSquad', input: 'gc_formatSquad' },
    ];
    formatIds.forEach(({ pill, input }) => {
        const pillEl = document.getElementById(pill);
        const inputEl = document.getElementById(input);
        pillEl.classList.remove('active', 'disabled');
        pillEl.dataset.locked = 'false';
        inputEl.checked = false;
        inputEl.disabled = false;
    });
}

/**
 * Handle game selection change
 * @param {string} value - Selected game value
 */
function gc_handleGameChange(value) {
    const customField = document.getElementById('gc_customGameField');
    const teamSizeRow = document.getElementById('gc_customTeamSizeRow');
    const teamSizeInput = document.getElementById('gc_teamSize');

    if (value === 'custom') {
        customField.style.display = 'block';
    } else {
        customField.style.display = 'none';
        document.getElementById('gc_customGame').value = "";
    }

    gc_resetFormats();
    teamSizeRow.style.display = 'none';
    teamSizeInput.value = "";
    document.getElementById('gc_entryFee').value = 100;

    // Enable Men/Women when game changes
    const personPills = document.querySelectorAll('#gc_personGroup .pill-check');
    personPills.forEach(p => {
        p.classList.add('active');
        const input = p.querySelector('input');
        if (input) input.checked = true;
    });

    if (!value || value === 'custom') return;

    const rules = GC_GAME_RULES[value];
    if (!rules) return;

    function setFormat(pillId, inputId, allowed, checked, locked) {
        const pillEl = document.getElementById(pillId);
        const inputEl = document.getElementById(inputId);
        pillEl.dataset.locked = locked ? 'true' : 'false';

        if (!allowed) {
            pillEl.classList.remove('active');
            pillEl.classList.add('disabled');
            inputEl.checked = false;
            inputEl.disabled = true;
            return;
        }

        pillEl.classList.remove('disabled');
        inputEl.disabled = false;

        if (checked) {
            pillEl.classList.add('active');
            inputEl.checked = true;
        } else {
            pillEl.classList.remove('active');
            inputEl.checked = false;
        }
    }

    // Chess: solo only
    if (rules.lockSoloOnly) {
        setFormat('gc_fmtSolo', 'gc_formatSolo', true, true, true);
        setFormat('gc_fmtDuo', 'gc_formatDuo', false, false, false);
        setFormat('gc_fmtMixDuo', 'gc_formatMixDuo', false, false, false);
        setFormat('gc_fmtSquad', 'gc_formatSquad', false, false, false);
        return;
    }

    // Pool / racket-type: solo + duo + mix, no squad
    if (rules.solo && rules.duo && rules.mixDuo && !rules.nvn) {
        setFormat('gc_fmtSolo', 'gc_formatSolo', true, true, false);
        setFormat('gc_fmtDuo', 'gc_formatDuo', true, true, false);
        setFormat('gc_fmtMixDuo', 'gc_formatMixDuo', true, true, false);
        setFormat('gc_fmtSquad', 'gc_formatSquad', false, false, false);
        return;
    }

    // Ludo: duo + mix only
    if (!rules.solo && rules.duo && rules.mixDuo && !rules.nvn) {
        setFormat('gc_fmtSolo', 'gc_formatSolo', false, false, false);
        setFormat('gc_fmtDuo', 'gc_formatDuo', true, true, false);
        setFormat('gc_fmtMixDuo', 'gc_formatMixDuo', true, true, false);
        setFormat('gc_fmtSquad', 'gc_formatSquad', false, false, false);
        return;
    }

    // NVN: squad only
    if (rules.nvn && !rules.solo && !rules.duo && !rules.mixDuo) {
        setFormat('gc_fmtSolo', 'gc_formatSolo', false, false, false);
        setFormat('gc_fmtDuo', 'gc_formatDuo', false, false, false);
        setFormat('gc_fmtMixDuo', 'gc_formatMixDuo', false, false, false);
        setFormat('gc_fmtSquad', 'gc_formatSquad', true, true, true);
        teamSizeRow.style.display = 'flex';
        return;
    }
}

/**
 * Toggle pill active state
 * @param {HTMLElement} el - Pill element
 */
function gc_togglePill(el) {
    if (el.classList.contains('disabled')) return;
    el.classList.toggle('active');
    const input = el.querySelector('input');
    if (input) input.checked = el.classList.contains('active');
}

/**
 * Toggle format pill active state
 * @param {HTMLElement} el - Format pill element
 */
function gc_toggleFormatPill(el) {
    const locked = el.dataset.locked === 'true';
    if (locked || el.classList.contains('disabled')) return;
    el.classList.toggle('active');
    const input = el.querySelector('input');
    if (input) input.checked = el.classList.contains('active');

    const squadInput = document.getElementById('gc_formatSquad');
    const teamSizeRow = document.getElementById('gc_customTeamSizeRow');
    if (squadInput.checked && !squadInput.disabled) {
        teamSizeRow.style.display = 'flex';
    } else {
        teamSizeRow.style.display = 'none';
        document.getElementById('gc_teamSize').value = "";
    }
}

/**
 * Save game to the tournament games array
 */
function gc_saveGame() {
    const gameKey = document.getElementById('gc_gameSelect').value;
    const customName = document.getElementById('gc_customGame').value.trim();
    const fee = document.getElementById('gc_entryFee').value;
    const teamSize = document.getElementById('gc_teamSize').value.trim();

    const solo = document.getElementById('gc_formatSolo').checked;
    const duo = document.getElementById('gc_formatDuo').checked;
    const mixDuo = document.getElementById('gc_formatMixDuo').checked;
    const squad = document.getElementById('gc_formatSquad').checked;

    let name = gameKey === 'custom' ? customName : gameKey;

    // Capitalize first letter
    if (name && typeof name === 'string') {
        name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    // Determine categories based on pills
    const menPill = document.querySelector('#gc_personGroup .pill-check:nth-child(1)');
    const womenPill = document.querySelector('#gc_personGroup .pill-check:nth-child(2)');
    const isMen = menPill.classList.contains('active');
    const isWomen = womenPill.classList.contains('active');

    let categories = [];
    if (isMen && isWomen) {
        categories = ['Male', 'Female', 'Mix'];
    } else if (isMen) {
        categories = ['Male'];
    } else if (isWomen) {
        categories = ['Female'];
    } else {
        categories = ['Mix'];
    }

    // Create format array
    let formats = [];
    if (solo) formats.push('Solo');
    if (duo) formats.push('Duo');
    if (mixDuo) formats.push('Duo (Mixed)');
    if (squad) formats.push(teamSize ? `${teamSize}v${teamSize}` : 'Squad');

    // Process each format
    for (const format of formats) {
        if (format === 'Solo' || format === 'Duo') {
            if (categories.includes('Male')) {
                tournamentGames.push({
                    category: 'Male',
                    name: name,
                    type: format,
                    fee: parseInt(fee) || 0
                });
            }
            if (categories.includes('Female')) {
                tournamentGames.push({
                    category: 'Female',
                    name: name,
                    type: format,
                    fee: parseInt(fee) || 0
                });
            }
        } else if (format === 'Duo (Mixed)') {
            if (categories.includes('Mix')) {
                tournamentGames.push({
                    category: 'Mix',
                    name: name,
                    type: format,
                    fee: parseInt(fee) || 0
                });
            }
        } else if (format.includes('v') || format === 'Squad') {
            if (categories.includes('Male')) {
                tournamentGames.push({
                    category: 'Male',
                    name: name,
                    type: format,
                    fee: parseInt(fee) || 0
                });
            }
            if (categories.includes('Female')) {
                tournamentGames.push({
                    category: 'Female',
                    name: name,
                    type: format,
                    fee: parseInt(fee) || 0
                });
            }
        }
    }

    updateGamesList();
    closeGameCategoryModal();
}

/**
 * Add a game entry to a category container
 * @param {string} category - Category name (male, female, mix)
 */
function addGame(category) {
    const container = document.getElementById(`${category}Games`);
    const id = `${category}_${gameCounters[category]++}`;

    const gameHtml = `
        <div class="game-entry" id="${id}" style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 10px; display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 15px; align-items: end;">
            <div class="info-field" style="margin: 0;">
                <label class="info-label">Game Name</label>
                <select class="info-input game-name-select" onchange="toggleGameNameField(this)" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; display: block; margin-bottom: 5px;">
                    <option value="">Select a game or choose Custom</option>
                    <option value="Badminton">Badminton</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Carrom">Carrom</option>
                    <option value="Chess">Chess</option>
                    <option value="Futsal">Futsal</option>
                    <option value="Handball">Handball</option>
                    <option value="Lawn Tennis">Lawn Tennis</option>
                    <option value="Ludo">Ludo</option>
                    <option value="Pool">Pool</option>
                    <option value="Table Tennis">Table Tennis</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Cricket">Cricket</option>
                    <option value="Football">Football</option>
                    <option value="Custom">Custom</option>
                </select>
                <input type="text" class="info-input game-name" placeholder="Enter custom game name" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; display: none;" disabled>
            </div>
            <div class="info-field" style="margin: 0;">
                <label class="info-label">Type</label>
                <select class="info-input game-type" onchange="toggleCustom('${id}')" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    <option value="">Select</option>
                    <option value="Solo">Solo</option>
                    <option value="Duo">Duo</option>
                    <option value="Custom">Custom</option>
                </select>
                <input type="text" class="info-input custom-value" placeholder="e.g., 5v5, 11v11" style="margin-top: 8px; display: none; width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>
            <div class="info-field" style="margin: 0;">
                <label class="info-label">Fee (per person)</label>
                <input type="number" class="info-input game-fee" placeholder="100" min="0" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>
            <button type="button" class="delete-btn delete-btn-cancel" style="padding: 6px 12px;" onclick="removeGame('${id}')">✕</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', gameHtml);
}

/**
 * Toggle game name field visibility based on dropdown selection
 * @param {HTMLElement} selectElement - The select dropdown
 */
function toggleGameNameField(selectElement) {
    const customInput = selectElement.nextElementSibling;
    if (selectElement.value === 'Custom') {
        customInput.style.display = 'block';
        customInput.disabled = false;
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.disabled = true;
        customInput.value = '';
    }
}

/**
 * Toggle custom type input visibility
 * @param {string} id - Game entry ID
 */
function toggleCustom(id) {
    const item = document.getElementById(id);
    const select = item.querySelector('.game-type');
    const customInput = item.querySelector('.custom-value');

    if (select.value === 'Custom') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
}

/**
 * Remove a game entry
 * @param {string|number} id - Game ID or index
 */
function removeGame(id) {
    if (typeof id === 'number') {
        tournamentGames.splice(id, 1);
    } else {
        const gameElement = document.getElementById(id);
        if (gameElement) {
            gameElement.remove();
        }
    }
    updateGamesList();
}

/**
 * Open remove game confirmation modal
 * @param {string} gameElementId - Element ID
 * @param {string} gameName - Game name
 */
function removeExistingGame(gameElementId, gameName) {
    document.getElementById('removeGameConfirmName').textContent = gameName;
    document.getElementById('removeGameElementId').value = gameElementId;
    document.getElementById('removeGameConfirmModal').style.display = 'flex';
}

/**
 * Confirm game removal
 */
function confirmRemoveGame() {
    const gameElementId = document.getElementById('removeGameElementId').value;
    const gameElement = document.getElementById(gameElementId);

    if (gameElement) {
        gameElement.remove();
        const parentContainer = gameElement.parentElement;
        if (parentContainer && parentContainer.children.length === 0) {
            parentContainer.parentElement.style.display = 'none';
        }
        updateGamesCountDisplay();
    }

    closeRemoveGameConfirmModal();
}

/**
 * Close the remove game confirmation modal
 */
function closeRemoveGameConfirmModal() {
    document.getElementById('removeGameConfirmModal').style.display = 'none';
}

/**
 * Update the games count display
 */
function updateGamesCountDisplay() {
    const maleGameCount = document.querySelectorAll('#displayMaleGames > div').length;
    const femaleGameCount = document.querySelectorAll('#displayFemaleGames > div').length;
    const mixGameCount = document.querySelectorAll('#displayMixGames > div').length;
    const totalGames = maleGameCount + femaleGameCount + mixGameCount;

    if (totalGames > 0) {
        document.getElementById('gamesList').innerHTML = `<div style="color: #6b7280; font-style: italic; padding: 10px;">Showing ${totalGames} existing games. Add more or update below.</div>`;
    } else {
        document.getElementById('gamesList').innerHTML = `<div style="color: #6b7280; font-style: italic; padding: 10px;">No games added yet.</div>`;
    }
}

/**
 * Add a game to a specific category when editing
 * @param {string} category - Category name
 * @param {Object} game - Game object
 */
function addGameToCategory(category, game) {
    const container = document.getElementById(`${category}Games`);
    const id = `${category}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const gameHtml = `
        <div class="game-entry" id="${id}" style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 10px; display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 15px; align-items: end;">
            <div class="info-field" style="margin: 0;">
                <label class="info-label">Game Name</label>
                <select class="info-input game-name-select" onchange="toggleGameNameField(this)" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; display: block; margin-bottom: 5px;">
                    <option value="">Select a game or choose Custom</option>
                    <option value="Badminton" ${game.GAME_NAME === 'Badminton' ? 'selected' : ''}>Badminton</option>
                    <option value="Basketball" ${game.GAME_NAME === 'Basketball' ? 'selected' : ''}>Basketball</option>
                    <option value="Carrom" ${game.GAME_NAME === 'Carrom' ? 'selected' : ''}>Carrom</option>
                    <option value="Chess" ${game.GAME_NAME === 'Chess' ? 'selected' : ''}>Chess</option>
                    <option value="Futsal" ${game.GAME_NAME === 'Futsal' ? 'selected' : ''}>Futsal</option>
                    <option value="Handball" ${game.GAME_NAME === 'Handball' ? 'selected' : ''}>Handball</option>
                    <option value="Lawn Tennis" ${game.GAME_NAME === 'Lawn Tennis' ? 'selected' : ''}>Lawn Tennis</option>
                    <option value="Ludo" ${game.GAME_NAME === 'Ludo' ? 'selected' : ''}>Ludo</option>
                    <option value="Pool" ${game.GAME_NAME === 'Pool' ? 'selected' : ''}>Pool</option>
                    <option value="Table Tennis" ${game.GAME_NAME === 'Table Tennis' ? 'selected' : ''}>Table Tennis</option>
                    <option value="Volleyball" ${game.GAME_NAME === 'Volleyball' ? 'selected' : ''}>Volleyball</option>
                    <option value="Cricket" ${game.GAME_NAME === 'Cricket' ? 'selected' : ''}>Cricket</option>
                    <option value="Football" ${game.GAME_NAME === 'Football' ? 'selected' : ''}>Football</option>
                    <option value="Custom" ${game.GAME_NAME === 'Custom' ? 'selected' : ''}>Custom</option>
                </select>
                <input type="text" class="info-input game-name" placeholder="Enter custom game name" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; display: none;" disabled value="${game.GAME_NAME}">
            </div>
            <div class="info-field" style="margin: 0;">
                <label class="info-label">Type</label>
                <select class="info-input game-type" onchange="toggleCustom('${id}')" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                    <option value="">Select</option>
                    <option value="Solo" ${game.GAME_TYPE === 'Solo' ? 'selected' : ''}>Solo</option>
                    <option value="Duo" ${game.GAME_TYPE === 'Duo' ? 'selected' : ''}>Duo</option>
                    <option value="Custom" ${game.GAME_TYPE === 'Custom' ? 'selected' : ''}>Custom</option>
                </select>
                <input type="text" class="info-input custom-value" placeholder="e.g., 5v5, 11v11" style="margin-top: 8px; display: none; width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>
            <div class="info-field" style="margin: 0;">
                <label class="info-label">Fee (per person)</label>
                <input type="number" class="info-input game-fee" placeholder="100" min="0" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" value="${game.FEE_PER_PERSON}">
            </div>
            <button type="button" class="delete-btn delete-btn-cancel" style="padding: 6px 12px;" onclick="removeGame('${id}')">✕</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', gameHtml);
}
