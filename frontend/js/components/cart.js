/**
 * cart.js  — Cart modal + bKash payment
 * Depends on: API_URL, authFetch
 */

// ── Cart Modal ───────────────────────────────────────────────
async function openCartModal() {
    var cartModal    = document.getElementById('cartModal');
    var cartItemsList = document.getElementById('cartItemsList');
    cartModal.style.display = 'flex';
    cartItemsList.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner" style="border-top-color:#333;width:24px;height:24px;"></div><p style="margin-top:10px;">Loading cart...</p></div>';

    try {
        var studentId = localStorage.getItem('studentId');
        if (!studentId) {
            cartItemsList.innerHTML = '<p style="color:red;text-align:center;">Error: User not identified. Please login again.</p>';
            return;
        }

        var res  = await authFetch(API_URL + '/cart/' + studentId);
        if (!res.ok) throw new Error('Server returned ' + res.status + ' ' + res.statusText);

        var data = await res.json();
        if (data.success) {
            var items = data.cartItems || data.cart || [];
            if (items.length === 0) {
                cartItemsList.innerHTML = '<p style="text-align:center;padding:20px;">Your cart is empty.</p>';
            } else {
                var html        = '';
                var totalAmount = 0;
                items.forEach(function (item) {
                    var gameName       = item.game ? item.game.name : (item.tournament_games ? item.tournament_games.game_name : 'Unknown Game');
                    var fee            = item.game ? item.game.feePerPerson : (item.tournament_games ? item.tournament_games.fee_per_person : 0);
                    var category       = item.game ? item.game.category : (item.tournament_games ? item.tournament_games.category : 'N/A');
                    var type           = item.game ? item.game.type : (item.tournament_games ? item.tournament_games.game_type : 'N/A');
                    var itemTotal      = item.itemTotal || (fee * (item.multiplier || 1));
                    totalAmount       += itemTotal;

                    html += '<div class="cart-item">'
                          + '<div class="cart-item-header"><div class="cart-item-title">' + gameName + '</div><div class="cart-item-price">৳' + itemTotal + '</div></div>'
                          + '<div class="cart-item-details">Category: ' + category + '<br>Type: ' + type + '</div>'
                          + '<button class="remove-from-cart-btn" onclick="removeFromCart(\'' + item.id + '\')">Remove</button>'
                          + '</div>';
                });
                html += '<div class="cart-total">Total: ৳' + totalAmount + '</div>';
                html += '<button class="pay-now-btn" onclick="openBkashModal(' + totalAmount + ')">Pay Now</button>';
                cartItemsList.innerHTML = html;

                var countEl = document.getElementById('cartItemCount');
                if (countEl) countEl.textContent = items.length;
            }
        } else {
            cartItemsList.innerHTML = '<p style="color:red;text-align:center;">' + (data.message || 'Failed to load cart.') + '</p>';
        }
    } catch (err) {
        console.error('Error loading cart:', err);
        cartItemsList.innerHTML = '<p style="color:red;text-align:center;">Error loading cart: ' + err.message + '</p>';
    }
}

function closeCartModal() {
    document.getElementById('cartModal').style.display = 'none';
}

async function removeFromCart(cartItemId) {
    if (!confirm('Are you sure you want to remove this item from your cart?')) return;
    try {
        var res  = await authFetch(API_URL + '/cart/' + cartItemId, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        var data = await res.json();
        if (data.success) {
            closeCartModal();
            openCartModal();
        } else {
            alert('Error removing item from cart: ' + data.message);
        }
    } catch (err) {
        console.error('Error removing item from cart:', err);
        alert('Error removing item from cart. Please try again.');
    }
}

// ── bKash Modal ──────────────────────────────────────────────
function openBkashModal(amount) {
    closeCartModal();
    document.getElementById('bkashAmount').textContent    = amount;
    document.getElementById('bkashModal').style.display   = 'flex';
}

function closeBkashModal() {
    document.getElementById('bkashModal').style.display = 'none';
}

async function processCheckout() {
    var bkashNumber = document.getElementById('bkashNumber').value;
    var bkashPin    = document.getElementById('bkashPin').value;
    var amount      = document.getElementById('bkashAmount').textContent;

    if (!bkashNumber || !bkashPin) {
        alert('Please enter your bKash number and PIN.');
        return;
    }

    var payBtn       = document.querySelector('#bkashModal .save-btn');
    var originalText = payBtn.innerText;
    payBtn.innerText = 'Processing...';
    payBtn.disabled  = true;

    try {
        var transactionId = 'TRX-' + Date.now() + Math.floor(Math.random() * 1000);
        var studentId     = localStorage.getItem('studentId');

        var res  = await authFetch(API_URL + '/cart/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-email': localStorage.getItem('userEmail') },
            body: JSON.stringify({ paymentMethod: 'BKASH', transactionId: transactionId, bkashNumber: bkashNumber, studentId: studentId })
        });
        var data = await res.json();

        if (data.success) {
            alert('Payment Successful!\nTransaction ID: ' + transactionId);
            closeBkashModal();
            loadUserRegistrationStatus();
            loadAvailableTournaments();
            if (document.getElementById('paymentSection').style.display === 'block') {
                loadPaymentView();
            }
        } else {
            alert('Payment Failed: ' + data.message);
        }
    } catch (err) {
        console.error('Payment error:', err);
        alert('Payment error. Please try again.');
    } finally {
        payBtn.innerText = originalText;
        payBtn.disabled  = false;
    }
}

async function openBkashModalForSingleItem(amount, itemName, gameId, teamId) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { alert('Please login first'); return; }

    try {
        var res  = await authFetch(API_URL + '/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, item_type: teamId ? 'TEAM_REGISTRATION' : 'GAME_REGISTRATION', item_id: teamId || 'TEMP', tournament_game_id: gameId })
        });
        var data = await res.json();

        if (data.success || (data.message && data.message.includes('already'))) {
            var cartRes  = await authFetch(API_URL + '/cart/' + studentId);
            var cartData = await cartRes.json();
            var trueTotal = amount;
            if (cartData.success && (cartData.cart || cartData.cartItems)) {
                var items = cartData.cart || cartData.cartItems;
                trueTotal = items.reduce(function(sum, item) {
                    var fee = item.game ? item.game.feePerPerson : (item.tournament_games ? item.tournament_games.fee_per_person : 0);
                    return sum + (item.itemTotal || fee);
                }, 0);
            }
            openBkashModal(trueTotal);
        } else {
            alert('Failed to prepare payment: ' + data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Error processing payment request.');
    }
}

async function payAllPending() {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { alert('Please login first'); return; }

    try {
        var res  = await authFetch(API_URL + '/dashboard/registrations/' + studentId);
        var data = await res.json();
        if (!data.success) { alert('Failed to fetch pending items.'); return; }

        var pendingItems = data.registrations.filter(function(r) {
            return r.payment_status === 'PENDING' || r.paymentStatus === 'PENDING'
                || r.payment_status === 'UNPAID'   || r.paymentStatus === 'UNPAID'
                || !r.payment_status;
        });

        if (pendingItems.length === 0) { alert('No pending items to pay.'); return; }
        if (!confirm('Are you sure you want to add ' + pendingItems.length + ' items to your cart and pay all?')) return;

        for (var i = 0; i < pendingItems.length; i++) {
            var item   = pendingItems[i];
            var gameId = item.gameId || item.game_id;
            var teamId = item.teamId || item.team_id;
            await authFetch(API_URL + '/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: studentId, item_type: teamId ? 'TEAM_REGISTRATION' : 'GAME_REGISTRATION', item_id: teamId || 'TEMP', tournament_game_id: gameId })
            });
        }

        var cartRes  = await authFetch(API_URL + '/cart/' + studentId);
        var cartData = await cartRes.json();
        var trueTotal = 0;
        if (cartData.success && (cartData.cart || cartData.cartItems)) {
            var cartItems = cartData.cart || cartData.cartItems;
            trueTotal = cartItems.reduce(function(sum, item) {
                var fee = item.game ? item.game.feePerPerson : (item.tournament_games ? item.tournament_games.fee_per_person : 0);
                return sum + (item.itemTotal || fee);
            }, 0);
        }
        openBkashModal(trueTotal);
    } catch (e) {
        console.error(e);
        alert('Error processing Pay All request.');
    }
}
