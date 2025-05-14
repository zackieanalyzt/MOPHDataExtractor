moph-opendata-fetcher
A Node.js application to fetch report data from the MOPH Open Data API (specifically the /api/report_data endpoint) and save it to a PostgreSQL database.

Features
Fetches data from the specified MOPH Open Data API using POST requests.

Accepts report parameters (report name, year, province) via a JSON request body.

Connects to a PostgreSQL database using a connection pool.

Inserts fetched data into a specified database table within a transaction.

Basic error handling for API calls and database operations.

Uses environment variables for configuration (API URL, database credentials).

Prerequisites
Node.js installed (v14 or higher recommended)

PostgreSQL database server accessible

Git installed

A GitHub account

Setup
Clone the Repository:

git clone https://github.com/YOUR_USERNAME/moph-opendata-fetcher.git
cd moph-opendata-fetcher

(Replace YOUR_USERNAME with your GitHub username if you have already created the repository and are cloning it down, otherwise, follow the GitHub setup steps below first)

Install Dependencies:

npm install

Configure Environment Variables:

Copy the .env.example file and rename it to .env:

cp .env.example .env

Open the .env file and fill in your actual database credentials and other configuration. Do not commit your .env file to Git as it contains sensitive information.

Database Table:

Ensure you have created the necessary table in your PostgreSQL database with the following structure:

CREATE TABLE your_table_name (
    id VARCHAR(32) PRIMARY KEY, -- Assuming id is a unique identifier
    hospcode VARCHAR(5) NOT NULL,
    areacode VARCHAR(8) NOT NULL,
    date_com VARCHAR(14),
    b_year VARCHAR(4) NOT NULL,
    target INT,
    result INT
    -- Add any other columns as needed
);

Important: Update the insertQuery in index.js to use the correct table name (your_table_name) and ensure the column mapping in the values array matches the data keys from the API response and the column order in your INSERT statement.

Running the Application
Start the Server:

npm start
# or for development with auto-restart on file changes
npm run dev

The server will start on the port specified in your .env file (default: 3000).

Trigger Data Fetch:
Send a POST request to the /fetch-and-save-report endpoint. You can use tools like Postman, Insomnia, curl, or a front-end application.

Endpoint: POST http://localhost:3000/fetch-and-save-report

Request Body (JSON):

{
  "reportName": "s_kpi_cvd_risk",
  "year": "2567",
  "province": "51"
}

(Replace the values with the desired report parameters)

Project Structure
.
├── index.js          # Main application file
├── package.json      # Project dependencies and scripts
├── .gitignore        # Files/folders to ignore in Git
├── .env.example      # Example environment variables file
└── README.md         # Project description

GitHub Setup (If starting fresh)
If you haven't created the GitHub repository yet, follow these steps after setting up the local project:

Initialize Git:

git init

Add files to staging:

git add .

Commit changes:

git commit -m "Initial commit: Add Node.js report fetcher project structure"

Create a new repository on GitHub:

Go to https://github.com/new

Name it moph-opendata-fetcher

Choose Public or Private

Click "Create repository"

Link local repository to GitHub:
Follow the instructions provided by GitHub on the next page under "...or push an existing repository from the command line". It will look something like this:

git remote add origin https://github.com/YOUR_USERNAME/moph-opendata-fetcher.git
git branch -M main
git push -u origin main

(Replace YOUR_USERNAME with your actual GitHub username)

Customization
API Response Structure: You must verify the actual JSON structure returned by the MOPH API for the specific reportName you are fetching. Adjust the line const recordsToInsert = reportData.data; and the key names used in the values array within the insert loop (record.id, record.hospcode, etc.) in index.js to match the API response keys.

Database Table Name and Columns: Update your_table_name in the insertQuery and ensure the column names and order in the insertQuery and values array match your actual PostgreSQL table definition.

Error Handling: Enhance the error handling and logging for production use.

ON CONFLICT: Implement the ON CONFLICT clause in the insertQuery if you need to handle cases where records with the same id already exist in your table (e.g., update existing records instead of failing).

Feel free to contribute or report issues!