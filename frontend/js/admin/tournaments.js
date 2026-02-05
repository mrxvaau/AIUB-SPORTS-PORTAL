/**
 * AIUB Sports Portal - Tournament Management Module
 * Handles tournament CRUD operations
 */

// Temporary array to store games for new tournament
let tournamentGames = [];

/**
 * Load and display existing tournaments
 */
async function loadTournaments() {
    try {
        const response = await fetch(`${API_URL}/admin/tournaments`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        if (data.success && data.tournaments) {
            const tournamentsList = document.getElementById('tournamentsList');
            if (data.tournaments.length === 0) {
                tournamentsList.innerHTML = '<p class="info-value">No tournaments created yet.</p>';
                return;
            }

            let html = '';
            data.tournaments.forEach(tournament => {
                // Handle photo URL
                let photoHtml = buildTournamentPhotoHtml(tournament);

                html += `
                    <div class="tournament-item">
                        <div style="display: flex; align-items: center;">
                            ${photoHtml}
                            <div style="flex: 1;">
                                <div class="tournament-title">${tournament.title || 'Untitled'}</div>
                                <div class="tournament-deadline">Deadline: ${tournament.registration_deadline || 'No deadline'}</div>
                                <div class="tournament-games">${tournament.GAMES_COUNT || '0'} Games</div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <button class="edit-btn" style="padding: 6px 12px; font-size: 12px;" onclick="editTournament(${tournament.id}, '${(tournament.title || '').replace(/'/g, "\\'")}', '${(tournament.registration_deadline || '').replace(/'/g, "\\'")}', '${(tournament.description || '').replace(/'/g, "\\'")}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                            </button>
                            <button class="delete-btn delete-btn-cancel" style="padding: 6px 12px;" onclick="showDeleteModal('${tournament.id}', '${(tournament.title || '').replace(/'/g, "\\'")}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            });

            tournamentsList.innerHTML = html;
        } else {
            document.getElementById('tournamentsList').innerHTML = '<p class="info-value">Failed to load tournaments.</p>';
        }
    } catch (error) {
        console.error('Load tournaments error:', error);
        document.getElementById('tournamentsList').innerHTML = '<p class="info-value">Error loading tournaments.</p>';
    }
}

/**
 * Build HTML for tournament photo
 * @param {Object} tournament - Tournament object with photo_url
 * @returns {string} HTML string for photo display
 */
function buildTournamentPhotoHtml(tournament) {
    if (tournament.photo_url !== null && tournament.photo_url !== undefined) {
        if (typeof tournament.photo_url === 'string') {
            if (tournament.photo_url.startsWith('/uploads/')) {
                const fullPhotoUrl = `${API_URL.replace('/api', '')}${tournament.photo_url}`;
                return `<img src="${fullPhotoUrl}" style="width: 50px; height: 50px; object-fit: contain; object-position: center; border-radius: 4px; margin-right: 10px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=&quot;width: 50px; height: 50px; background: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: #9ca3af; font-size: 12px;&quot;>No Image</div>';">`;
            } else if (tournament.photo_url.startsWith('data:image')) {
                return `<img src="${tournament.photo_url}" style="width: 50px; height: 50px; object-fit: contain; object-position: center; border-radius: 4px; margin-right: 10px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=&quot;width: 50px; height: 50px; background: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: #9ca3af; font-size: 12px;&quot;>No Image</div>';">`;
            } else {
                return `<img src="${tournament.photo_url}" style="width: 50px; height: 50px; object-fit: contain; object-position: center; border-radius: 4px; margin-right: 10px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=&quot;width: 50px; height: 50px; background: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: #9ca3af; font-size: 12px;&quot;>No Image</div>';">`;
            }
        } else {
            return `<div style="width: 50px; height: 50px; background: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: #9ca3af; font-size: 12px;">CLOB Type Error</div>`;
        }
    } else {
        return `<div style="width: 50px; height: 50px; background: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: #9ca3af; font-size: 12px;">No Image</div>`;
    }
}

/**
 * Load the create tournament form
 */
function loadCreateTournamentForm() {
    const formHtml = `
        <form id="tournamentForm">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="info-field">
                    <label class="info-label">Tournament Title</label>
                    <input type="text" id="title" class="info-input" placeholder="Enter tournament title">
                </div>
                
                <div class="info-field">
                    <label class="info-label">Registration Deadline</label>
                    <input type="datetime-local" id="deadline" class="info-input">
                </div>
            </div>
            
            <div class="info-field" style="margin-bottom: 16px;">
                <label class="info-label">Tournament Photo (Optional)</label>
                <input type="file" id="photoFile" class="info-input" accept="image/*">
            </div>

            <div class="info-field" style="margin-bottom: 16px;">
                <label class="info-label">Tournament Description (Optional)</label>
                <textarea id="description" class="info-input" placeholder="Enter tournament description..." style="height: 100px; resize: vertical;"></textarea>
            </div>
            
            <div class="info-field" style="margin-bottom: 16px;">
                <label class="info-label">Games</label>

                <!-- Game List Display -->
                <div id="gamesList">
                    <div style="color: #6b7280; font-style: italic; padding: 10px;">No games added yet.</div>
                </div>

                <!-- Category Containers for managing games -->
                <div id="maleGames" style="display: none;"></div>
                <div id="femaleGames" style="display: none;"></div>
                <div id="mixGames" style="display: none;"></div>

                <!-- Visual representation of games during editing -->
                <div id="existingGamesDisplay" style="margin-top: 10px;">
                    <div id="existingMaleGames" style="display: none; margin-bottom: 10px;">
                        <h4 style="color: #1976d2; margin-bottom: 5px;">Male Category Games</h4>
                        <div id="displayMaleGames"></div>
                    </div>
                    <div id="existingFemaleGames" style="display: none; margin-bottom: 10px;">
                        <h4 style="color: #1976d2; margin-bottom: 5px;">Female Category Games</h4>
                        <div id="displayFemaleGames"></div>
                    </div>
                    <div id="existingMixGames" style="display: none;">
                        <h4 style="color: #1976d2; margin-bottom: 5px;">Mix Category Games</h4>
                        <div id="displayMixGames"></div>
                    </div>
                </div>

                <!-- Add Game Button -->
                <button type="button" onclick="openGameCategoryModal()" style="margin-top: 15px; background: #10b981; color: white; padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add game
                </button>
            </div>
            
            <div style="text-align: right;">
                <button type="button" onclick="cancelTournament()" class="cancel-btn">Cancel</button>
                <button type="button" onclick="createTournament()" class="save-btn">Create Tournament</button>
            </div>
        </form>
    `;

    document.getElementById('createTournamentForm').innerHTML = formHtml;
}

/**
 * Create a new tournament
 */
async function createTournament() {
    const title = document.getElementById('title').value;
    const deadlineInput = document.getElementById('deadline').value;
    const description = document.getElementById('description').value;

    if (!title || !deadlineInput) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    if (tournamentGames.length === 0) {
        showAlert('Please add at least one game', 'error');
        return;
    }

    // Get photo if uploaded
    const photoFile = document.getElementById('photoFile').files[0];
    if (photoFile) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            await submitTournament(title, null, null, tournamentGames, description, deadlineInput);
        };
        reader.readAsDataURL(photoFile);
    } else {
        await submitTournament(title, null, null, tournamentGames, description, deadlineInput);
    }
}

/**
 * Submit tournament to server
 */
async function submitTournament(title, photoUrl, deadline, games, description, deadlineInputValue) {
    try {
        const submitBtn = document.querySelector('.save-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;

        const photoFile = document.getElementById('photoFile').files[0];

        if (photoFile) {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('deadline', deadlineInputValue);
            formData.append('description', description);
            formData.append('games', JSON.stringify(games));
            formData.append('photo', photoFile);

            const response = await fetch(`${API_URL}/admin/tournaments`, {
                method: 'POST',
                headers: {
                    'x-user-email': localStorage.getItem('userEmail') || ''
                },
                body: formData
            });

            const result = await response.json();

            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            if (result.success) {
                showAlert('Tournament created successfully!', 'success');
                document.getElementById('tournamentForm').reset();
                setTimeout(() => {
                    showSection('existing-tournaments');
                }, 1500);
            } else {
                showAlert(result.message || 'Failed to create tournament', 'error');
            }
        } else {
            const response = await fetch(`${API_URL}/admin/tournaments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-email': localStorage.getItem('userEmail') || ''
                },
                body: JSON.stringify({ title, photoUrl, deadline: deadlineInputValue, games, description })
            });

            const result = await response.json();

            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            if (result.success) {
                showAlert('Tournament created successfully!', 'success');
                document.getElementById('tournamentForm').reset();
                setTimeout(() => {
                    showSection('existing-tournaments');
                }, 1500);
            } else {
                showAlert(result.message || 'Failed to create tournament', 'error');
            }
        }
    } catch (error) {
        console.error('Create tournament error:', error);
        showAlert('Connection error. Please try again.', 'error');
    }
}

/**
 * Cancel tournament creation
 */
function cancelTournament() {
    document.getElementById('tournamentForm').reset();
    tournamentGames = [];
    showSection('existing-tournaments');
}

/**
 * Edit an existing tournament
 * @param {number} tournamentId - Tournament ID
 * @param {string} title - Tournament title
 * @param {string} deadline - Registration deadline
 * @param {string} description - Tournament description
 */
function editTournament(tournamentId, title, deadline, description) {
    function waitForFormAndEdit() {
        const maleGamesContainer = document.getElementById('maleGames');
        const femaleGamesContainer = document.getElementById('femaleGames');
        const mixGamesContainer = document.getElementById('mixGames');

        if (maleGamesContainer && femaleGamesContainer && mixGamesContainer) {
            document.getElementById('title').value = title || '';

            if (deadline) {
                if (typeof deadline === 'string' && deadline.includes('T')) {
                    document.getElementById('deadline').value = deadline.slice(0, 16);
                } else {
                    const date = new Date(deadline);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    document.getElementById('deadline').value = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            } else {
                document.getElementById('deadline').value = '';
            }

            document.getElementById('description').value = description || '';

            // Reset game containers
            maleGamesContainer.innerHTML = '';
            femaleGamesContainer.innerHTML = '';
            mixGamesContainer.innerHTML = '';

            // Reset the temporary games array
            tournamentGames = [];

            // Load existing games for this tournament
            loadExistingGames(tournamentId);

            // Change the button text to "Update Tournament"
            const submitButton = document.querySelector('.save-btn');
            if (submitButton) {
                submitButton.textContent = 'Update Tournament';
                submitButton.onclick = function () {
                    updateTournament(tournamentId);
                };
            }
        } else {
            setTimeout(waitForFormAndEdit, 100);
        }
    }

    showSection('create-tournament');
    setTimeout(waitForFormAndEdit, 100);
}

/**
 * Load existing games for a tournament
 * @param {number} tournamentId - Tournament ID
 */
async function loadExistingGames(tournamentId) {
    try {
        const response = await fetch(`${API_URL}/admin/tournaments/${tournamentId}/games`);
        const data = await response.json();

        if (data.success && data.games) {
            const maleGames = data.games.filter(g => (g.CATEGORY || g.category || 'Unknown') === 'Male');
            const femaleGames = data.games.filter(g => (g.CATEGORY || g.category || 'Unknown') === 'Female');
            const mixGames = data.games.filter(g => (g.CATEGORY || g.category || 'Unknown') === 'Mix');

            // Display games
            displayCategoryGames('Male', maleGames, 'existingMaleGames', 'displayMaleGames');
            displayCategoryGames('Female', femaleGames, 'existingFemaleGames', 'displayFemaleGames');
            displayCategoryGames('Mix', mixGames, 'existingMixGames', 'displayMixGames');

            // Update games list message
            const totalGames = maleGames.length + femaleGames.length + mixGames.length;
            if (totalGames > 0) {
                document.getElementById('gamesList').innerHTML = `<div style="color: #6b7280; font-style: italic; padding: 10px;">Showing ${totalGames} existing games. Add more or update below.</div>`;
            }
        }
    } catch (error) {
        console.error('Load existing games error:', error);
    }
}

/**
 * Display games for a category
 */
function displayCategoryGames(category, games, containerId, displayId) {
    if (games.length > 0) {
        document.getElementById(containerId).style.display = 'block';
        const displayContainer = document.getElementById(displayId);
        games.forEach((game, index) => {
            const gameId = `${category.toLowerCase()}-game-${Date.now()}-${index}`;
            displayContainer.innerHTML += `
                <div id="${gameId}" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${game.GAME_NAME || game.game_name || game.name || 'Unknown Game'}</strong>
                        <span style="color: #6b7280; font-size: 12px;">(${game.GAME_TYPE || game.game_type || game.type || 'Type'})</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #10b981; font-weight: bold;">${game.FEE_PER_PERSON || game.fee_per_person || game.fee || 0} BDT</span>
                        <button type="button" onclick="removeExistingGame('${gameId}', '${game.GAME_NAME || game.game_name || game.name || 'Unknown Game'}')" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">
                            ×
                        </button>
                    </div>
                </div>
            `;
        });
    }
}

/**
 * Update an existing tournament
 * @param {number} tournamentId - Tournament ID
 */
async function updateTournament(tournamentId) {
    const title = document.getElementById('title').value;
    const deadlineInput = document.getElementById('deadline').value;
    const description = document.getElementById('description').value;

    if (!title) {
        showAlert('Please enter a tournament title', 'error');
        return;
    }

    if (!deadlineInput) {
        showAlert('Please select a registration deadline', 'error');
        return;
    }

    // Collect games data from form
    const games = collectGamesFromForm();

    if (games.length === 0) {
        showAlert('Please add at least one game', 'error');
        return;
    }

    const photoFile = document.getElementById('photoFile').files[0];

    try {
        let response;
        if (photoFile) {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('deadline', deadlineInput);
            formData.append('description', description);
            formData.append('games', JSON.stringify(games));
            formData.append('photo', photoFile);

            response = await fetch(`${API_URL}/admin/tournaments/${tournamentId}`, {
                method: 'PUT',
                headers: {
                    'x-user-email': localStorage.getItem('userEmail') || ''
                },
                body: formData
            });
        } else {
            response = await fetch(`${API_URL}/admin/tournaments/${tournamentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-email': localStorage.getItem('userEmail') || ''
                },
                body: JSON.stringify({ title, deadline: deadlineInput, description, games })
            });
        }

        const result = await response.json();

        if (result.success) {
            showAlert('Tournament updated successfully!', 'success');
            showSection('existing-tournaments');
            loadTournaments();
        } else {
            showAlert(result.message || 'Failed to update tournament', 'error');
        }
    } catch (error) {
        console.error('Update tournament error:', error);
        showAlert('Connection error. Please try again.', 'error');
    }
}

/**
 * Collect games data from the form
 * @returns {Array} Array of game objects
 */
function collectGamesFromForm() {
    const games = [];

    ['male', 'female', 'mix'].forEach(category => {
        const container = document.getElementById(`${category}Games`);
        if (container) {
            const items = container.querySelectorAll('.game-entry');

            items.forEach(item => {
                const nameInput = item.querySelector('.game-name');
                const typeSelect = item.querySelector('.game-type');
                const feeInput = item.querySelector('.game-fee');
                const gameNameSelect = item.querySelector('.game-name-select');

                let gameName = '';
                if (gameNameSelect && gameNameSelect.value === 'Custom' && nameInput && nameInput.value.trim() !== '') {
                    gameName = nameInput.value.trim();
                } else if (gameNameSelect && gameNameSelect.value && gameNameSelect.value !== 'Custom') {
                    gameName = gameNameSelect.value;
                }

                if (gameName !== '') {
                    let gameType = typeSelect ? typeSelect.value : '';
                    let finalGameType = gameType;

                    if (!['Solo', 'Duo', 'Custom'].includes(gameType)) {
                        finalGameType = 'Custom';
                    }

                    let feeValue = feeInput ? (parseInt(feeInput.value) || 0) : 0;

                    games.push({
                        category: category.charAt(0).toUpperCase() + category.slice(1),
                        name: gameName,
                        type: finalGameType,
                        fee: feeValue
                    });
                }
            });
        }
    });

    return games;
}

/**
 * Show delete confirmation modal
 * @param {string} tournamentId - Tournament ID
 * @param {string} tournamentTitle - Tournament title
 */
function showDeleteModal(tournamentId, tournamentTitle) {
    document.getElementById('deleteModal').style.display = 'flex';
    document.getElementById('deleteTournamentId').value = tournamentId;
    document.getElementById('deleteTournamentTitle').textContent = tournamentTitle || 'Untitled Tournament';
    document.getElementById('deleteConfirmInput').value = '';
    document.getElementById('deleteConfirmBtn').disabled = true;
}

/**
 * Handle delete confirmation input
 */
function handleDeleteInput() {
    const input = document.getElementById('deleteConfirmInput').value;
    const expectedValue = 'yes, i want to delete it';
    const confirmBtn = document.getElementById('deleteConfirmBtn');

    if (input.toLowerCase().trim() === expectedValue) {
        confirmBtn.disabled = false;
    } else {
        confirmBtn.disabled = true;
    }
}

/**
 * Confirm tournament deletion
 */
async function confirmDelete() {
    const tournamentId = document.getElementById('deleteTournamentId').value;
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const originalText = confirmBtn.textContent;

    confirmBtn.textContent = 'Deleting...';
    confirmBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/admin/tournaments/${tournamentId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Tournament deleted successfully!', 'success');
            document.getElementById('deleteModal').style.display = 'none';
            setTimeout(() => {
                loadTournaments();
            }, 1000);
        } else {
            showAlert(result.message || 'Failed to delete tournament', 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
        }
    } catch (error) {
        console.error('Delete tournament error:', error);
        showAlert('Connection error. Please try again.', 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}

/**
 * Cancel deletion
 */
function cancelDelete() {
    document.getElementById('deleteModal').style.display = 'none';
}

/**
 * Update the games list display
 */
function updateGamesList() {
    const gamesList = document.getElementById('gamesList');

    if (tournamentGames.length === 0) {
        gamesList.innerHTML = '<div style="color: #6b7280; font-style: italic; padding: 10px;">No games added yet.</div>';
        return;
    }

    let html = '<div style="margin-bottom: 10px;">';
    tournamentGames.forEach((game, index) => {
        html += `
            <div style="background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${game.name}</strong> <span style="color: #6b7280; font-size: 12px;">(${game.category})</span><br>
                    <span style="font-size: 12px; color: #6b7280;">Type: ${game.type} • Fee: ${game.fee} BDT</span>
                </div>
                <button onclick="removeGameFromList(${index})" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
            </div>
        `;
    });
    html += '</div>';

    gamesList.innerHTML = html;
}

/**
 * Remove a game from the tournament games list
 * @param {number} index - Index of the game to remove
 */
function removeGameFromList(index) {
    tournamentGames.splice(index, 1);
    updateGamesList();
}
