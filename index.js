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

// Run server
app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`Products API: http://localhost:${PORT}/products`);
    console.log(`Time API: http://localhost:${PORT}/time`);
});