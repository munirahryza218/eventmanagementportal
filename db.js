const { Request } = require('tedious');

// Helper function to execute SQL queries
function executeQuery(connection, query, params = {}) {
    return new Promise((resolve, reject) => {
        const rows = [];

        const request = new Request(query, (err) => {
            if (err) {
                console.error('SQL Error:', err);
                connection.close(); // Close on error
                return reject(err);
            }
        });

        // Add parameters to the request
        for (const key in params) {
            if (Object.hasOwnProperty.call(params, key)) {
                request.addParameter(key, params[key].type, params[key].value);
            }
        }

        request.on('row', columns => {
            const row = {};
            columns.forEach(column => {
                row[column.metadata.colName] = column.value;
            });
            rows.push(row);
        });

        request.on('requestCompleted', () => {
            connection.close(); // ✅ Now safe to close
            resolve(rows);
        });

        connection.execSql(request);
    });
}

module.exports = { executeQuery };
