// Cart Controller
// Handles shopping cart operations

const { supabase } = require('../config/supabase');

// Add item to cart
const addToCart = async (req, res) => {
    try {
        const { studentId, item_type, item_id, tournament_game_id } = req.body;

        // Get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Check if item already exists in cart
        const { data: existingItem, error: existingError } = await supabase
            .from('cart')
            .select('id')
            .eq('user_id', userId)
            .eq('tournament_game_id', tournament_game_id)
            .single();

        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: 'Item already exists in cart'
            });
        }

        // Add item to cart
        const { data: cartItem, error: cartError } = await supabase
            .from('cart')
            .insert([{
                user_id: userId,
                item_type: item_type,
                item_id: item_id,
                tournament_game_id: tournament_game_id
            }])
            .select(`
                id,
                item_type,
                item_id,
                tournament_game_id,
                created_at,
                tournament_games(game_name, game_type, fee_per_person, category, tournament_id)
            `)
            .single();

        if (cartError) {
            console.error('Error adding to cart:', cartError);
            return res.status(500).json({
                success: false,
                message: 'Error adding item to cart',
                error: cartError.message
            });
        }

        res.json({
            success: true,
            message: 'Item added to cart successfully',
            cartItem: {
                id: cartItem.id,
                item_type: cartItem.item_type,
                item_id: cartItem.item_id,
                tournament_game_id: cartItem.tournament_game_id,
                game: {
                    name: cartItem.tournament_games.game_name,
                    type: cartItem.tournament_games.game_type,
                    feePerPerson: cartItem.tournament_games.fee_per_person,
                    category: cartItem.tournament_games.category,
                    tournamentId: cartItem.tournament_games.tournament_id
                },
                createdAt: cartItem.created_at
            }
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get user's cart
const getCart = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Get user's cart items
        const { data: cartItems, error: cartError } = await supabase
            .from('cart')
            .select(`
                id,
                item_type,
                item_id,
                tournament_game_id,
                created_at,
                tournament_games(game_name, game_type, fee_per_person, category, tournament_id)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (cartError) {
            console.error('Error fetching cart:', cartError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching cart',
                error: cartError.message
            });
        }

        // Calculate total amount
        let totalAmount = 0;
        const formattedCartItems = cartItems.map(item => {
            let multiplier = 1; // Default for individual registration

            if (item.item_type === 'TEAM_REGISTRATION') {
                multiplier = 2; // Assuming 2 members for demo purposes
            }

            const itemTotal = item.tournament_games.fee_per_person * multiplier;
            totalAmount += itemTotal;

            return {
                id: item.id,
                item_type: item.item_type,
                item_id: item.item_id,
                tournament_game_id: item.tournament_game_id,
                game: {
                    name: item.tournament_games.game_name,
                    type: item.tournament_games.game_type,
                    feePerPerson: item.tournament_games.fee_per_person,
                    category: item.tournament_games.category,
                    tournamentId: item.tournament_games.tournament_id
                },
                multiplier: multiplier,
                itemTotal: itemTotal,
                createdAt: item.created_at
            };
        });

        res.json({
            success: true,
            cart: formattedCartItems,
            totalAmount: totalAmount,
            itemCount: formattedCartItems.length
        });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
    try {
        const { cartItemId } = req.params;

        // Delete the cart item
        const { error: deleteError } = await supabase
            .from('cart')
            .delete()
            .eq('id', cartItemId);

        if (deleteError) {
            console.error('Error removing from cart:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing item from cart',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Item removed from cart successfully'
        });
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Clear user's cart
const clearCart = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Delete all cart items for the user
        const { error: deleteError } = await supabase
            .from('cart')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            console.error('Error clearing cart:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error clearing cart',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Cart cleared successfully'
        });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// Remove cart item by tournament game ID and student ID
const removeFromCartByGameId = async (req, res) => {
    try {
        const { gameId, studentId } = req.params;

        // Get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Delete the cart item by tournament_game_id
        const { error: deleteError } = await supabase
            .from('cart')
            .delete()
            .eq('user_id', userId)
            .eq('tournament_game_id', gameId);

        if (deleteError) {
            console.error('Error removing from cart:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing item from cart',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Item removed from cart successfully'
        });
    } catch (error) {
        console.error('Remove from cart by game ID error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    addToCart,
    getCart,
    removeFromCart,
    removeFromCartByGameId,
    clearCart
};
