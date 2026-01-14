const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());  // Permite peticiones desde cualquier origen (solo para desarrollo)

app.use(express.json());  // Permite leer JSON en las peticiones

//To get images
app.use('/images', express.static(path.join(__dirname, 'data', 'images')));

// Testing GET route
app.get('/', (req, res) => {
    res.send('Retail Dashboard API is running!');
});

// Route to get all products
app.get('/products', (req, res) => {
    try {
        const productsData = fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8');
        const products = JSON.parse(productsData);
        
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Error reading products:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading products'
        });
    }
});

// Route to get a product by its ID
app.get('/products/:id', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const productsData = fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8');
        const products = JSON.parse(productsData);
        
        const product = products.find(p => p.id === productId);
        
        if (product) {
            res.json({
                success: true,
                data: product
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Route to get time
app.get('/time', (req, res) => {
    res.json({
        time: new Date().toISOString(),
        server: 'Retail Dashboard API'
    });
});

// Example POST Route
app.post('/echo', (req, res) => {
    console.log('Received POST at /echo');
    console.log('Body:', req.body);
    res.json({
        received: true,
        data: req.body,
        message: 'Data received successfully'
    });
});

function saveProductsToFile(products) {
    const filePath = path.join(__dirname, 'data', 'products.json');
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    console.log('Products data saved to file');
}

// Endpoint for processing sells
app.post('/api/purchase', (req, res) => {
    try {
        console.log('Purchase request received');
        
        const { cartItems, customerInfo } = req.body;
        
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart items are required'
            });
        }
        
        const productsData = fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8');
        let products = JSON.parse(productsData);
        
        const updates = [];
        const insufficientStock = [];
        
        for (const cartItem of cartItems) {
            const product = products.find(p => p.id === cartItem.id);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product with ID ${cartItem.id} not found`
                });
            }
            
            if (product.stock < cartItem.quantity) {
                insufficientStock.push({
                    productId: product.id,
                    productName: product.name,
                    requested: cartItem.quantity,
                    available: product.stock
                });
            } else {
                updates.push({
                    productId: product.id,
                    oldStock: product.stock,
                    newStock: product.stock - cartItem.quantity
                });
            }
        }
        
        // In case 
        if (insufficientStock.length > 0) {
            return res.status(409).json({ // 409 Conflict
                success: false,
                message: 'Insufficient stock for some items',
                insufficientStock: insufficientStock
            });
        }
        
        // Apply stock update
        updates.forEach(update => {
            const productIndex = products.findIndex(p => p.id === update.productId);
            if (productIndex !== -1) {
                products[productIndex].stock = update.newStock;
            }
        });
        
        saveProductsToFile(products);
        
        const orderId = 'ORD-' + Date.now();
        const purchaseDate = new Date().toISOString();
        
        const orderSummary = {
            orderId: orderId,
            date: purchaseDate,
            items: cartItems.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.price * item.quantity
            })),
            total: req.body.total || 0,
            customer: customerInfo || {}
        };
        
        console.log(`Purchase completed: Order ${orderId}`);
        
        res.json({
            success: true,
            message: 'Purchase completed successfully',
            order: orderSummary,
            updatedProducts: updates
        });
        
    } catch (error) {
        console.error('Error processing purchase:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing purchase'
        });
    }
});

// Endpoint for adding a rating
app.post('/api/products/:id/reviews', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const { user, rating, comment } = req.body;
        
        console.log(`Review request for product ID: ${productId}`);
        
        if (!user || !rating || !comment) {
            return res.status(400).json({
                success: false,
                message: 'User, rating, and comment are required'
            });
        }
        
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }
        
        const productsData = fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8');
        let products = JSON.parse(productsData);
        
        // Search product
        const productIndex = products.findIndex(p => p.id === productId);
        if (productIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        const product = products[productIndex];
        
        // Make a review
        const newReview = {
            id: product.reviews.length + 1,
            user: user.trim(),
            rating: parseInt(rating),
            comment: comment.trim(),
            date: new Date().toISOString().split('T')[0]
        };
        
        // Add review to a product
        product.reviews.push(newReview);
        
        // Recalculate rating
        const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);
        product.rating = totalRating / product.reviews.length;
        
        // Save changes
        saveProductsToFile(products);
        
        console.log(`Review added to product ${productId}. New rating: ${product.rating.toFixed(1)}`);
        
        res.json({
            success: true,
            message: 'Review added successfully',
            review: newReview,
            newAverageRating: product.rating
        });
        
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding review'
        });
    }
});

// Endpoint to get a review of a product
app.get('/api/products/:id/reviews', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        const productsData = fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8');
        const products = JSON.parse(productsData);
        
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            reviews: product.reviews
        });
        
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching reviews'
        });
    }
});

// Endpoint to increment stock
app.post('/api/products/:id/stock', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }
        
        const productsData = fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8');
        let products = JSON.parse(productsData);
        
        const productIndex = products.findIndex(p => p.id === productId);
        if (productIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        products[productIndex].stock += parseInt(amount);
        
        saveProductsToFile(products);
        
        console.log(`Stock updated for product ${productId}. New stock: ${products[productIndex].stock}`);
        
        res.json({
            success: true,
            message: 'Stock updated successfully',
            productId: productId,
            newStock: products[productIndex].stock
        });
        
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating stock'
        });
    }
});

// Run server
app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`Products API: http://localhost:${PORT}/products`);
    console.log(`Time API: http://localhost:${PORT}/time`);
});