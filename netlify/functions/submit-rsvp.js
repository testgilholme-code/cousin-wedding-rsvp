// netlify/functions/submit-rsvp.js
const { google } = require('googleapis');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { submittedBy, responses } = JSON.parse(event.body);

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:G',
    });

    const rows = readResponse.data.values || [];
    
    const nameToRow = {};
    for (let i = 1; i < rows.length; i++) {
      const name = rows[i][0];
      if (name) {
        nameToRow[name] = i + 1;
      }
    }

    const updates = [];
    const currentDate = new Date().toISOString().split('T')[0];

    responses.forEach(response => {
      const rowNum = nameToRow[response.name];
      
      if (!rowNum) {
        console.warn(`No row found for guest: ${response.name}`);
        return;
      }

      const status = response.attending ? 'Attending' : 'Not Attending';
      
      updates.push({
        range: `Sheet1!C${rowNum}:G${rowNum}`,
        values: [[
          status,
          response.dietary || '',
          response.accommodation || '',
          currentDate,
          submittedBy
        ]]
      });
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        valueInputOption: 'RAW',
        data: updates
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        message: 'RSVP submitted successfully',
        count: updates.length
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
