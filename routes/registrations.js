const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { Request, TYPES } = require('tedious');
const { executeQuery } = require('../db');

module.exports = (getConnection) => {
    const router = express.Router();

    // Register for an event (Attendee only)
    router.post('/', authenticateToken, authorizeRole(['Attendee']), async (req, res) => {
        const { eventId, paymentStatus } = req.body;
        const attendeeId = req.user.userId;

        if (!eventId) {
            return res.status(400).send('Event ID is required.');
        }

        try {
            const connection = await getConnection();
            const query = `
                INSERT INTO AttendeeRegistrations (EventID, AttendeeID, PaymentStatus)
                VALUES (@EventID, @AttendeeID, @PaymentStatus);
                SELECT SCOPE_IDENTITY() AS RegistrationID;
            `;
            const params = {
                EventID: { type: TYPES.Int, value: eventId },
                AttendeeID: { type: TYPES.Int, value: attendeeId },
                PaymentStatus: { type: TYPES.NVarChar, value: paymentStatus || 'Pending' }
            };
            const result = await executeQuery(connection, query, params);
            res.status(201).json({ message: 'Registered successfully', registrationId: result[0].RegistrationID });
        } catch (err) {
            console.error('Error registering for event:', err);
            res.status(500).send('Error registering for event.');
        }
    });

    // ✅ FIXED: This route now matches your frontend call to /my-registrations
    router.get('/my-registrations', authenticateToken, authorizeRole(['Attendee']), async (req, res) => {
        const attendeeId = req.user.userId;

        try {
            const connection = await getConnection();
            const query = `
                SELECT ar.RegistrationID, ar.PaymentStatus, ar.RegistrationDate,
                       e.EventName, e.EventDate, e.Location
                FROM AttendeeRegistrations ar
                JOIN Events e ON ar.EventID = e.EventID
                WHERE ar.AttendeeID = @AttendeeID
                ORDER BY e.EventDate DESC;
            `;
            const params = {
                AttendeeID: { type: TYPES.Int, value: attendeeId }
            };
            const registrations = await executeQuery(connection, query, params);
            res.json(registrations);
        } catch (err) {
            console.error('Error fetching my registrations:', err);
            res.status(500).send('Error fetching my registrations.');
        }
    });

    // Organizer: Get attendees for a specific event
    router.get('/event/:eventId', authenticateToken, authorizeRole(['Organizer']), async (req, res) => {
        const eventId = req.params.eventId;

        try {
            const connection = await getConnection();
            const query = `
                SELECT ar.RegistrationID, u.Username AS AttendeeName, u.UserID AS AttendeeID,
                       ar.RegistrationDate, ar.PaymentStatus
                FROM AttendeeRegistrations ar
                JOIN Users u ON ar.AttendeeID = u.UserID
                WHERE ar.EventID = @EventID;
            `;
            const params = {
                EventID: { type: TYPES.Int, value: parseInt(eventId) }
            };
            const attendees = await executeQuery(connection, query, params);
            res.json(attendees);
        } catch (err) {
            console.error('Error fetching attendees:', err);
            res.status(500).send('Error fetching attendees.');
        }
    });

    // Attendee: Cancel registration
    router.delete('/:id', authenticateToken, authorizeRole(['Attendee']), async (req, res) => {
        const registrationId = req.params.id;
        const attendeeId = req.user.userId;

        try {
            const connection = await getConnection();
            const query = `
                DELETE FROM AttendeeRegistrations 
                WHERE RegistrationID = @RegistrationID AND AttendeeID = @AttendeeID;
            `;
            const params = {
                RegistrationID: { type: TYPES.Int, value: parseInt(registrationId) },
                AttendeeID: { type: TYPES.Int, value: attendeeId }
            };
            await executeQuery(connection, query, params);
            res.json({ message: 'Registration cancelled successfully' });
        } catch (err) {
            console.error('Error cancelling registration:', err);
            res.status(500).send('Error cancelling registration.');
        }
    });

    return router;
};
