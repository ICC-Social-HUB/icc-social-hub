const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Configuration
const SHEET_ID = '1D96whVKeVHsLdl9J5u6h4OIiwIpmEfsnacitk2RVf_g';
const STUDENT_DATA_PATH = path.join(__dirname, '../js/studentData.js');
const ALLOWED_EMAILS_PATH = path.join(__dirname, '../js/allowedEmails.js');

async function sync() {
    console.log('Starting sync with Google Sheets API...');

    // 1. Authenticate
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccountEmail || !privateKey) {
        console.error('Error: GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY not found in environment.');
        console.log('Please add these to your GitHub Repository Secrets.');
        process.exit(1);
    }

    const auth = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, auth);

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Assuming first sheet
        const rows = await sheet.getRows();

        if (rows.length === 0) {
            console.log('No data found in spreadsheet.');
            return;
        }

        console.log(`Loaded ${rows.length} rows.`);

        const students = [];
        const rowsToUpdate = [];

        for (const row of rows) {
            const data = row.toObject();
            
            // Map headers (flexible matching)
            const student = {};
            Object.keys(data).forEach(key => {
                const header = key.toLowerCase();
                const val = data[key] || '';
                if (header.includes('name')) student.fullName = val;
                else if (header.includes('usn')) student.usn = val;
                else if (header.includes('section')) student.section = val;
                else if (header.includes('email')) student.email = val;
                else if (header.includes('phone')) {
                    const cleanPhone = val.toString().replace(/[^0-9]/g, '');
                    student.phone = cleanPhone ? Number(cleanPhone) : val;
                }
            });

            if (student.email && student.fullName) {
                students.push(student);
                
                // If row isn't already "green" (we check a custom flag or just always update)
                // For this request, we will fill the row with green color
                rowsToUpdate.push(row);
            }
        }

        console.log(`Syncing ${students.length} students to codebase...`);

        // Update studentData.js
        let studentDataContent = fs.readFileSync(STUDENT_DATA_PATH, 'utf8');
        const studentDataRegex = /(\/\/ ── STUDENT_DATA_START ──)([\s\S]*?)(\/\/ ── STUDENT_DATA_END ──)/;
        const newStudentDataJson = students.map(s => `  ${JSON.stringify(s, null, 2)}`).join(',\n');
        studentDataContent = studentDataContent.replace(studentDataRegex, `$1\n${newStudentDataJson}\n$3`);
        fs.writeFileSync(STUDENT_DATA_PATH, studentDataContent);

        // Update allowedEmails.js
        let allowedEmailsContent = fs.readFileSync(ALLOWED_EMAILS_PATH, 'utf8');
        const allowedEmailsRegex = /(\/\/ ── BATCH_STUDENTS_START ──)([\s\S]*?)(\/\/ ── BATCH_STUDENTS_END ──)/;
        const newEmailsList = students.map(s => `    "${s.email.trim().toLowerCase()}",`).join('\n');
        allowedEmailsContent = allowedEmailsContent.replace(allowedEmailsRegex, `$1\n${newEmailsList}\n$3`);
        fs.writeFileSync(ALLOWED_EMAILS_PATH, allowedEmailsContent);

        console.log('Codebase updated. Now marking spreadsheet rows as green...');

        // Update Spreadsheet Colors
        // Note: Formatting requires saving each row or using a batch update.
        // google-spreadsheet v4 row.save() handles values. For formatting, we use sheet.getCells or similar.
        
        for (const row of rowsToUpdate) {
            // We'll set the background color for the entire row range
            // This requires the sheet.updateCells or a similar low-level call if using google-spreadsheet
            // However, a simpler way is to just add a "Status" column and set it to "Synced"
            // But user specifically asked for "green fill".
            
            // To do green fill properly with google-spreadsheet v4:
            // We use the sheet.updateCells method.
        }

        // Batch update formatting to green for all processed rows
        const rowCount = rowsToUpdate.length;
        const colCount = sheet.columnCount;
        
        await sheet.loadCells(`A1:${String.fromCharCode(64 + colCount)}${rowCount + 1}`);
        
        for (let i = 1; i <= rowCount; i++) {
            for (let j = 0; j < colCount; j++) {
                const cell = sheet.getCell(i, j);
                cell.backgroundColor = { red: 0.8, green: 1, blue: 0.8 }; // Light green
            }
        }
        await sheet.saveUpdatedCells();

        console.log('Spreadsheet rows colored green. Sync complete!');

    } catch (e) {
        console.error('Error during sync:', e);
        process.exit(1);
    }
}

sync();
