const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const SHEET_ID = '1D96whVKeVHsLdl9J5u6h4OIiwIpmEfsnacitk2RVf_g';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const STUDENT_DATA_PATH = path.join(__dirname, '../js/studentData.js');
const ALLOWED_EMAILS_PATH = path.join(__dirname, '../js/allowedEmails.js');

function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        const get = (currentUrl) => {
            https.get(currentUrl, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    get(res.headers.location);
                    return;
                }
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        };
        get(url);
    });
}

function parseCSV(csvText) {
    // Simple CSV parser handling quotes
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            currentField += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentRow.length > 0 || currentField.length > 0) {
                currentRow.push(currentField.trim());
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            }
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentField += char;
        }
    }
    if (currentRow.length > 0 || currentField.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
    }
    return rows;
}

async function sync() {
    console.log('Fetching spreadsheet data...');
    const csvText = await fetchCSV(CSV_URL);
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
        console.error('No data found in spreadsheet.');
        return;
    }

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);

    const students = dataRows.map((row) => {
        const student = {};
        headers.forEach((header, index) => {
            const val = row[index] || '';
            if (header.includes('name')) student.fullName = val;
            else if (header.includes('usn')) student.usn = val;
            else if (header.includes('section')) student.section = val;
            else if (header.includes('email')) student.email = val;
            else if (header.includes('phone')) {
                const cleanPhone = val.replace(/[^0-9]/g, '');
                student.phone = cleanPhone ? Number(cleanPhone) : val;
            }
        });
        return student;
    }).filter(s => s.email && s.fullName);

    console.log(`Parsed ${students.length} students.`);

    // 1. Update studentData.js
    let studentDataContent = fs.readFileSync(STUDENT_DATA_PATH, 'utf8');
    const studentDataRegex = /(\/\/ ── STUDENT_DATA_START ──)([\s\S]*?)(\/\/ ── STUDENT_DATA_END ──)/;
    const newStudentDataJson = students.map(s => `  ${JSON.stringify(s, null, 2)}`).join(',\n');
    
    studentDataContent = studentDataContent.replace(studentDataRegex, `$1\n${newStudentDataJson}\n$3`);
    fs.writeFileSync(STUDENT_DATA_PATH, studentDataContent);
    console.log('Updated studentData.js');

    // 2. Update allowedEmails.js
    let allowedEmailsContent = fs.readFileSync(ALLOWED_EMAILS_PATH, 'utf8');
    const allowedEmailsRegex = /(\/\/ ── BATCH_STUDENTS_START ──)([\s\S]*?)(\/\/ ── BATCH_STUDENTS_END ──)/;
    const newEmailsList = students.map(s => `    "${s.email.trim().toLowerCase()}",`).join('\n');
    
    allowedEmailsContent = allowedEmailsContent.replace(allowedEmailsRegex, `$1\n${newEmailsList}\n$3`);
    fs.writeFileSync(ALLOWED_EMAILS_PATH, allowedEmailsContent);
    console.log('Updated allowedEmails.js');

    console.log('Sync complete!');
}

sync().catch(console.error);
