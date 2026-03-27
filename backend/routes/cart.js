// Cart Routes
// Shopping cart and checkout

const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const registrationController = require('../controllers/registrationController');
const { requireAuth } = require('../middleware/auth');

// POST /api/cart/add - Add item to cart
router.post('/add', requireAuth, cartController.addToCart);

// GET /api/cart/:studentId - Get user's cart
router.get('/:studentId', requireAuth, cartController.getCart);

// DELETE /api/cart/:cartItemId - Remove item from cart
router.delete('/:cartItemId', requireAuth, cartController.removeFromCart);

// DELETE /api/cart/clear/:studentId - Clear user's cart
router.delete('/clear/:studentId', requireAuth, cartController.clearCart);

// POST /api/cart/checkout - Checkout cart
router.post('/checkout', requireAuth, registrationController.checkoutCart);

// DELETE /api/cart/game/:gameId/:studentId - Remove cart item by game ID
router.delete('/game/:gameId/:studentId', requireAuth, cartController.removeFromCartByGameId);

module.exports = router;
