require('dotenv').config(); // โหลดค่าจากไฟล์ .env
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg'); // ใช้ Pool เพื่อจัดการ Connection ได้ดีกว่า

const app = express();
const port = process.env.PORT || 3000; // Use port from environment variable or default to 3000

// Middleware เพื่อให้ Express สามารถอ่าน JSON จาก Request Body ได้
app.use(express.json());

// --- ตั้งค่าการเชื่อมต่อฐานข้อมูล PostgreSQL ---
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10), // แปลง Port เป็นตัวเลข
});

// ทดสอบการเชื่อมต่อฐานข้อมูล (ไม่จำเป็นต้องทำทุกครั้ง แต่มีประโยชน์ในการ Debugging)
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
    console.log(`กำลังดึงข้อมูลจาก API: ${apiUrl} พร้อม Request Body: ${JSON.stringify(apiRequestBody)}`);

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
      console.error('API ตอบกลับด้วยสถานะผิดพลาด:', apiResponse.status, apiResponse.statusText);
      // Log the response data from API if available for debugging
      if (apiResponse.data) {
          console.error('API Response Data:', apiResponse.data);
      }
      return res.status(apiResponse.status).send(`Error fetching data from API: ${apiResponse.statusText}`);
    }

    const reportData = apiResponse.data; // Data received from the API
    console.log('--- API Response Data Structure ---');
    console.log(reportData); // <<< เพิ่ม console.log ตรงนี้เพื่อดูโครงสร้างข้อมูลทั้งหมด
    console.log('-----------------------------------');


    // *** สำคัญ: คุณต้องตรวจสอบโครงสร้างของ reportData ที่ได้จาก API จริงๆ ***
    // จาก console.log(reportData) ด้านบน ให้ดูว่า Array ของ Record ที่ต้องการ Insert อยู่ภายใต้ Key ชื่ออะไร
    // ตัวอย่าง: สมมติว่า reportData เป็น Object ที่มี key ชื่อ 'data' ซึ่งเป็น Array ของ Object
    const recordsToInsert = reportData.data; // <<< ปรับตรงนี้ให้ตรงกับโครงสร้างจริง

    // Check if data was received and is an array
    if (!recordsToInsert || !Array.isArray(recordsToInsert) || recordsToInsert.length === 0) {
      console.log('ไม่พบข้อมูล หรือข้อมูลที่ได้ไม่ใช่ Array จาก API ที่ระบุ');
      // Log the type and length of recordsToInsert for debugging
      console.log('Type of recordsToInsert:', typeof recordsToInsert);
      if (Array.isArray(recordsToInsert)) {
          console.log('Length of recordsToInsert:', recordsToInsert.length);
      }
      return res.status(200).send('ไม่พบข้อมูล หรือข้อมูลที่ได้ไม่ใช่ Array จาก API ที่ระบุ');
    }

    console.log(`ดึงข้อมูลมาได้ ${recordsToInsert.length} รายการ`);

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
    // *** สำคัญ: คุณต้องปรับแก้ 'your_table_name' ให้เป็นชื่อตารางในฐานข้อมูล PostgreSQL ของคุณ ***

    let insertCount = 0;
    for (const record of recordsToInsert) {
      console.log('--- Processing Record ---');
      console.log(record); // <<< เพิ่ม console.log ตรงนี้เพื่อดูข้อมูลแต่ละ Record
      console.log('-------------------------');

      // *** สำคัญ: ปรับ array ของ values นี้ ให้ map จาก record ที่ได้จาก API ***
      // คุณต้องตรวจสอบชื่อ key ใน Object 'record' ที่ได้จาก API จริงๆ จาก console.log(record) ด้านบน
      // ตัวอย่างนี้สมมติว่า key ใน API response ตรงกับชื่อคอลัมน์ในฐานข้อมูล (ยกเว้น b_year และ areacode)
      const values = [
        record.id,         // สมมติว่า API response มี key ชื่อ 'id'
        record.hospcode,   // สมมติว่า API response มี key ชื่อ 'hospcode'
        record.areacode,   // สมมติว่า API response มี key ชื่อ 'areacode'
        record.date_com,   // สมมติว่า API response มี key ชื่อ 'date_com'
        year,              // ใช้ค่า year จาก Request Body สำหรับคอลัมน์ b_year
        record.target,     // สมมติว่า API response มี key ชื่อ 'target'
        record.result      // สมมติว่า API response มี key ชื่อ 'result'
        // เพิ่มค่าอื่นๆ ที่ map จาก record หรือค่าคงที่ ถ้ามีคอลัมน์อื่นในตาราง
      ];

      try {
          await client.query(insertQuery, values);
          insertCount++;
      } catch (insertErr) {
          console.error('ข้อผิดพลาดในการ Insert ข้อมูล:', insertErr.message, 'Record:', JSON.stringify(record));
          // คุณอาจจะเลือกที่จะ Rollback ทั้งหมด หรือแค่ข้ามรายการที่ Insert ไม่ได้
          // await client.query('ROLLBACK'); // ถ้าเลือก Rollback ทั้งหมดเมื่อมี Error
          // throw insertErr; // โยน Error เพื่อให้ไปที่ catch ด้านนอก
          // หรือแค่ log แล้วไปต่อ (ถ้าต้องการ Insert รายการอื่นๆ ที่เหลือ)
      }
    }

    await client.query('COMMIT'); // ยืนยัน Transaction

    console.log(`Insert ข้อมูลสำเร็จ ${insertCount} รายการ`);
    res.status(200).send(`ดึงและบันทึกข้อมูลสำเร็จ ${insertCount} รายการ`);

  } catch (error) {
    console.error('เกิดข้อผิดพลาดโดยรวม:', error.message);

    // ถ้าเกิดข้อผิดพลาดหลังจากเริ่ม Transaction ให้ Rollback
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
  console.log(`Example Request Body (JSON): { "reportName": "s_kpi_cvd_risk", "year": "2568", "province": "51" }`);
});

// Close the database pool when the Node.js process is terminated (e.g., Ctrl+C)
process.on('SIGINT', () => {
  pool.end(() => {
    console.log('Database pool has been closed.');
    process.exit(0);
  });
});
