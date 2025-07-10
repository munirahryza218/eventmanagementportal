const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Request, TYPES } = require('tedious');
const { executeQuery } = require('../db'); // Helper to run queries

module.exports = (getConnection) => {
    const router = express.Router();

    // 🔐 Register
    router.post('/register', async (req, res) => {
        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).send('Username, password, and role are required.');
        }

        if (!['Organizer', 'Attendee'].includes(role)) {
            return res.status(400).send('Invalid role specified.');
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const connection = await getConnection(); // ✅ await here

            const query = `
                INSERT INTO Users (Username, PasswordHash, Role)
                VALUES (@Username, @PasswordHash, @Role);
                SELECT SCOPE_IDENTITY() AS UserID;
            `;

            const params = {
                Username: { type: TYPES.NVarChar, value: username },
                PasswordHash: { type: TYPES.NVarChar, value: hashedPassword },
                Role: { type: TYPES.NVarChar, value: role }
            };

            const result = await executeQuery(connection, query, params);
            connection.close(); // Always close

            res.status(201).json({ message: 'User registered', userId: result[0].UserID });
        } catch (err) {
            if (err.message.includes('UNIQUE KEY')) {
                return res.status(409).send('Username already exists.');
            }
            console.error('Registration error:', err);
            res.status(500).send('Error registering user.');
        }
    });

    // 🔐 Login
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).send('Username and password are required.');
        }

        try {
            const connection = await getConnection(); // ✅ await here

            const query = `SELECT UserID, Username, PasswordHash, Role FROM Users WHERE Username = @Username;`;
            const params = {
                Username: { type: TYPES.NVarChar, value: username }
            };

            const users = await executeQuery(connection, query, params);
            connection.close(); // Always close

            if (users.length === 0) {
                return res.status(400).send('Invalid credentials.');
            }

            const user = users[0];
            const isMatch = await bcrypt.compare(password, user.PasswordHash);

            if (!isMatch) {
                return res.status(400).send('Invalid credentials.');
            }

            const token = jwt.sign(
                { userId: user.UserID, username: user.Username, role: user.Role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({ message: 'Logged in successfully',
                token,
                role: user.Role,
                userId: user.UserID  });

        } catch (err) {
            console.error('Login error:', err);
            res.status(500).send('Error logging in.');
        }
    });

    return router;
};
