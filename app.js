require('dotenv').config();             // Load environment variables
const express = require('express');
const cors = require('cors');           // CORS for cross-origin access

const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS setup: allow all origins (adjust in production if needed)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());                          // For JSON bodies
app.use(express.urlencoded({ extended: true }));  // For form-encoded
app.use(express.static('public'));                // Serve static frontend

// Database connection setup
const { Connection } = require('tedious');
const config = {
    server: process.env.DB_SERVER,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        }
    },
    options: {
        database: process.env.DB_DATABASE,
        encrypt: true,
        trustServerCertificate: false,
        port: parseInt(process.env.DB_PORT)
    }
};

// Get a new database connection
function getConnection() {
    return new Promise((resolve, reject) => {
        const connection = new Connection(config);
        connection.on('connect', err => {
            if (err) reject(err);
            else resolve(connection);
        });
        connection.connect();
    });
}

// Routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');

app.use('/api/auth', authRoutes(getConnection));
app.use('/api/events', eventRoutes(getConnection));
app.use('/api/registrations', registrationRoutes(getConnection));

// Homepage
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Fallback for unknown routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start the server
app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
});
