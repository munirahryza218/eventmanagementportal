const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { Request, TYPES } = require('tedious');
const { executeQuery } = require('../db');

module.exports = (getConnection) => {
    const router = express.Router();

    // Public: Get all upcoming events
    router.get('/', async (req, res) => {
        try {
            const connection = await getConnection();
            const query = `
    SELECT EventID, EventName, EventDate, Description, Location, Capacity 
    FROM Events 
    ORDER BY EventDate ASC;
`;
            const events = await executeQuery(connection, query);
            res.json(events);
        } catch (err) {
            console.error('Error fetching events:', err);
            res.status(500).send('Error fetching events.');
        }
    });

    // Create a new event (Organizer only)
    router.post('/', authenticateToken, authorizeRole(['Organizer']), async (req, res) => {
        const { eventName, eventDate, description, location, capacity } = req.body;
        const organizerId = req.user.userId;

        if (!eventName || !eventDate || !location || !capacity) {
            return res.status(400).send('Event name, date, location, and capacity are required.');
        }

        try {
            const connection = await getConnection();
            const query = `
                INSERT INTO Events (EventName, EventDate, Description, Location, Capacity, OrganizerID)
                VALUES (@EventName, @EventDate, @Description, @Location, @Capacity, @OrganizerID);
                SELECT SCOPE_IDENTITY() AS EventID;
            `;
            const params = {
                EventName: { type: TYPES.NVarChar, value: eventName },
                EventDate: { type: TYPES.DateTime, value: new Date(eventDate) },
                Description: { type: TYPES.NVarChar, value: description },
                Location: { type: TYPES.NVarChar, value: location },
                Capacity: { type: TYPES.Int, value: capacity },
                OrganizerID: { type: TYPES.Int, value: organizerId }
            };
            const result = await executeQuery(connection, query, params);
            res.status(201).json({ message: 'Event created successfully', eventId: result[0].EventID });
        } catch (err) {
            console.error('Error creating event:', err);
            res.status(500).send('Error creating event.');
        }
    });

    // Update an event
    router.put('/:id', authenticateToken, authorizeRole(['Organizer']), async (req, res) => {
        const eventId = req.params.id;
        const { eventName, eventDate, description, location, capacity } = req.body;
        const organizerId = req.user.userId;

        if (!eventName || !eventDate || !location || !capacity) {
            return res.status(400).send('Event name, date, location, and capacity are required.');
        }

        try {
            const connection = await getConnection();
            const query = `
                UPDATE Events 
                SET EventName = @EventName, EventDate = @EventDate, Description = @Description, 
                    Location = @Location, Capacity = @Capacity 
                WHERE EventID = @EventID AND OrganizerID = @OrganizerID;
            `;
            const params = {
                EventName: { type: TYPES.NVarChar, value: eventName },
                EventDate: { type: TYPES.DateTime, value: new Date(eventDate) },
                Description: { type: TYPES.NVarChar, value: description },
                Location: { type: TYPES.NVarChar, value: location },
                Capacity: { type: TYPES.Int, value: capacity },
                EventID: { type: TYPES.Int, value: parseInt(eventId) },
                OrganizerID: { type: TYPES.Int, value: organizerId }
            };
            const result = await executeQuery(connection, query, params);

            if (!result || result.length === 0) {
                return res.status(403).json({ message: 'Event not found or you are not authorized to update it.' });
            }

            res.json({ message: 'Event updated successfully' });
        } catch (err) {
            console.error('Error updating event:', err);
            res.status(500).send('Error updating event.');
        }
    });

    // Delete an event
    router.delete('/:id', authenticateToken, authorizeRole(['Organizer']), async (req, res) => {
        const eventId = req.params.id;
        const organizerId = req.user.userId;

        try {
            const connection = await getConnection();

            // Delete related registrations first
            const deleteRegistrationsQuery = `DELETE FROM AttendeeRegistrations WHERE EventID = @EventID;`;
            const deleteParams = { EventID: { type: TYPES.Int, value: parseInt(eventId) } };
            await executeQuery(connection, deleteRegistrationsQuery, deleteParams);

            const query = `
                DELETE FROM Events 
                WHERE EventID = @EventID AND OrganizerID = @OrganizerID;
            `;
            const params = {
                EventID: { type: TYPES.Int, value: parseInt(eventId) },
                OrganizerID: { type: TYPES.Int, value: organizerId }
            };
            const result = await executeQuery(connection, query, params);

            if (!result || result.length === 0) {
                return res.status(403).json({ message: 'Event not found or you are not authorized to delete it.' });
            }

            res.json({ message: 'Event deleted successfully' });
        } catch (err) {
            console.error('Error deleting event:', err);
            res.status(500).send('Error deleting event.');
        }
    });

    return router;
};
