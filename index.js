// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg'); // Use Pool for better connection management

// Create an Express application instance
const app = express();
const port = process.env.PORT || 3000; // Use port from environment variable or default to 3000

// Middleware to parse JSON request bodies
app.use(express.json());

// --- PostgreSQL Database Connection Setup ---
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10), // Convert port to integer
});

// Database connection event listeners (optional but helpful for debugging)
pool.on('connect', () => {
  console.log('Successfully connected to PostgreSQL database.');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Consider restarting the application or handling this error appropriately
});

// --- Endpoint to Fetch and Save Report Data ---
// This endpoint accepts POST requests with report details in the body
app.post('/fetch-and-save-report', async (req, res) => {
  // 1. Receive requirements from the web page (via Request Body JSON)
  // Expected JSON structure: { "reportName": "s_kpi_cvd_risk", "year": "2567", "province": "51" }
  const { reportName, year, province } = req.body; // Destructure from req.body

  // Validate required parameters
  if (!reportName || !year || !province) {
    return res.status(400).send('Please provide reportName, year, and province in the Request Body (JSON).');
  }

  // API URL for the MOPH Open Data service
  const apiUrl = process.env.API_BASE_URL || "https://opendata.moph.go.th/api/report_data";

  // Request Body structure for the MOPH API (based on the provided jQuery code)
  const apiRequestBody = {
    tableName: reportName,
    year: year,
    province: province,
    type: "json" // As specified in the jQuery code
    // Add any other parameters required by the API here
  };

  let client; // Declare client variable to be accessible in the finally block

  try {
    console.log(`Fetching data from API: ${apiUrl} with Request Body: ${JSON.stringify(apiRequestBody)}`);

    // 2. Fetch data from the Web Service using POST method
    const apiResponse = await axios.post(apiUrl, apiRequestBody, {
      headers: {
        'Content-Type': 'application/json' // Specify Content-Type as application/json
      },
      timeout: 0 // Set timeout to 0 (no timeout) as per the jQuery code
      // Add other headers if needed
    });

    // Check the API response status
    if (apiResponse.status !== 200) {
      console.error('API returned an error status:', apiResponse.status, apiResponse.statusText);
      return res.status(apiResponse.status).send(`Error fetching data from API: ${apiResponse.statusText}`);
    }

    const reportData = apiResponse.data; // Data received from the API

    // *** IMPORTANT: You MUST inspect the actual structure of reportData from the API ***
    // Use console.log(reportData) after a successful API call to see the structure.
    // The array of records to insert might be under a key like 'data', 'records', etc.
    // Example: Assuming reportData is an Object with a key named 'data' which is an Array of Objects
    const recordsToInsert = reportData.data; // Adjust this based on the actual API response structure

    // Check if data was received and is an array
    if (!recordsToInsert || !Array.isArray(recordsToInsert) || recordsToInsert.length === 0) {
      console.log('No data received or received data is not an array from the specified API.');
      return res.status(200).send('No data received or received data is not an array from the specified API.');
    }

    console.log(`Fetched ${recordsToInsert.length} records.`);

    // 3. Connect to the database and Insert data
    client = await pool.connect(); // Get a client from the pool
    await client.query('BEGIN'); // Start a database transaction (recommended for multiple inserts)

    // Define the INSERT Query matching your table structure
    // Table columns: id, hospcode, areacode, date_com, b_year, target, result
    const insertQuery = `
      INSERT INTO your_table_name (id, hospcode, areacode, date_com, b_year, target, result)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      -- Optional: Add ON CONFLICT clause if you want to handle duplicate 'id' values
      -- ON CONFLICT (id) DO UPDATE SET
      -- hospcode = EXCLUDED.hospcode,
      -- areacode = EXCLUDED.areacode,
      -- date_com = EXCLUDED.date_com,
      -- b_year = EXCLUDED.b_year,
      -- target = EXCLUDED.target,
      -- result = EXCLUDED.result;
    `;
    // *** IMPORTANT: Replace 'your_table_name' with the actual name of your PostgreSQL table ***

    let insertCount = 0;
    for (const record of recordsToInsert) {
      // *** IMPORTANT: Map values from the 'record' object (from API) to the values array ***
      // You MUST inspect the actual key names in the 'record' object from the API response.
      // Example: Assuming API keys match column names (except b_year)
      const values = [
        record.id,         // Assuming API response has a key named 'id'
        record.hospcode,   // Assuming API response has a key named 'hospcode'
        record.areacode,   // Assuming API response has a key named 'areacode'
        record.date_com,   // Assuming API response has a key named 'date_com'
        year,              // Use the 'year' value from the Request Body for the 'b_year' column
        record.target,     // Assuming API response has a key named 'target'
        record.result      // Assuming API response has a key named 'result'
        // Add values for any other columns in your table, mapping from 'record' or using constants
      ];

      try {
          await client.query(insertQuery, values);
          insertCount++;
      } catch (insertErr) {
          console.error('Error inserting record:', insertErr.message, 'Record:', JSON.stringify(record));
          // You can choose to rollback the entire transaction here, or just log and continue
          // await client.query('ROLLBACK'); // Rollback all changes if any insert fails
          // throw insertErr; // Re-throw the error to be caught by the outer catch block
          // Or just log the error and continue inserting other records
      }
    }

    await client.query('COMMIT'); // Commit the transaction if all inserts were attempted

    console.log(`Successfully inserted ${insertCount} records.`);
    res.status(200).send(`Successfully fetched and saved ${insertCount} records.`);

  } catch (error) {
    console.error('An overall error occurred:', error.message);

    // If an error occurred after starting a transaction, rollback
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.error('Transaction rolled back.');
      } catch (rollbackErr) {
        console.error('Error rolling back transaction:', rollbackErr.message);
      }
    }

    // Provide more detailed error response based on the error type
    if (error.response) {
        // Axios error from API response (non-2xx status)
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        res.status(error.response.status).send(`Error from API: ${error.response.statusText || error.message}`);
    } else if (error.request) {
        // Axios error: The request was made but no response was received
         console.error('Request data:', error.request);
         res.status(500).send(`Error sending request to API: No response received.`);
    } else {
        // Other errors (e.g., DB error, code error)
        console.error('Error message:', error.message);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }

  } finally {
    // Release the client back to the pool regardless of success or failure
    if (client) {
      client.release();
      console.log('Database client released back to pool.');
    }
  }
});

// --- Start the Node.js Server ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Endpoint to fetch report: POST http://localhost:${port}/fetch-and-save-report`);
  console.log(`Example Request Body (JSON): { "reportName": "s_kpi_cvd_risk", "year": "2567", "province": "51" }`);
});

// Close the database pool when the Node.js process is terminated (e.g., Ctrl+C)
process.on('SIGINT', () => {
  pool.end(() => {
    console.log('Database pool has been closed.');
    process.exit(0);
  });
});
