const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// Robustly initialize Firebase Admin SDK
admin.initializeApp();

// Configuration values
const SPREADSHEET_ID = "1IHHsIyQiCSgO7WLnGPIdgMFTyTraQyw0NhOEEVdQtlQ";
const SHEET_NAME = "Sheet1";
const DATABASE_ID = "ai-studio-8ff12475-4475-4634-ba0f-139959e529e1";

/**
 * Returns an authorized Google Sheets client.
 * First tries local service-account.json keys, and falls back to
 * default cloud credentials if not present.
 */
async function getSheetsClient() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  const serviceAccountPath = path.join(__dirname, "service-account.json");

  let auth;
  if (fs.existsSync(serviceAccountPath)) {
    console.log("Menggunakan berkas kredensial service-account.json lokal...");
    auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: scopes,
    });
  } else {
    console.log("Kunci service-account.json tidak ditemukan secara lokal. Menggunakan Default Credentials cloud...");
    auth = new google.auth.GoogleAuth({
      scopes: scopes,
    });
  }

  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

/**
 * Cloud Function Trigger on Firestore document write events for employees.
 * Keeps data synchronized with Google Sheets.
 */
exports.mirrorEmployeesToSheet = onDocumentWritten({
  document: "employees/{employeeId}",
  database: DATABASE_ID
}, async (event) => {
  const employeeId = event.params.employeeId;
  const change = event.data;

  if (!change) {
    console.log("Data tidak ditemukan pada perubahan.");
    return null;
  }

  const afterData = change.after ? change.after.data() : null;

  try {
    const sheets = await getSheetsClient();
    const range = `${SHEET_NAME}!A:J`;

    // Fetch the current state of sheets to locate row indices
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
      });
    } catch (err) {
      console.error("Gagal menyinkronkan data ke Google Sheets. Pastikan Service Account memiliki akses Editor ke Spreadsheet Anda.", err);
      throw err;
    }

    const rows = response.data.values || [];

    // Create default column headers if spreadsheet is blank
    if (rows.length === 0) {
      const headers = [
        "ID Karyawan",
        "Nama Lengkap",
        "Jabatan / Posisi",
        "Departemen",
        "Email Kantor",
        "Nomor Telepon",
        "Status",
        "Tanggal Bergabung",
        "Tanggal Registrasi",
        "Terakhir Diperbarui"
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headers] }
      });
      rows.push(headers);
    }

    // Match row index by Employee ID in Column O (Index 0)
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === employeeId) {
        rowIndex = i;
        break;
      }
    }

    // Helper to format Firestore serverTimestamp
    const formatTimestamp = (ts) => {
      if (!ts) return "";
      if (typeof ts.toDate === "function") {
        return ts.toDate().toISOString();
      }
      if (ts._seconds) {
        return new Date(ts._seconds * 1000).toISOString();
      }
      return String(ts);
    };

    // Case 1: Firestore Document Deleted
    if (!afterData) {
      console.log(`Karyawan dengan ID ${employeeId} telah dihapus di Firestore.`);
      if (rowIndex !== -1) {
        // Mark as deleted in status column instead of clearing row to maintain spreadsheet indexing structure
        const updateRange = `${SHEET_NAME}!G${rowIndex + 1}`; // Column G: Status (Index 6)
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: updateRange,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["Dihapus (Deleted)"]]
          }
        });
        console.log(`Status karyawan berhasil diubah menjadi 'Dihapus' di baris spreadsheet ke-${rowIndex + 1}`);
      } else {
        console.log("Karyawan tidak ditemukan di lembar Spreadsheet.");
      }
      return null;
    }

    // Standardize spreadsheet row structure representation
    const recordValues = [
      employeeId,
      afterData.name || "",
      afterData.role || "",
      afterData.department || "",
      afterData.email || "",
      afterData.phone || "",
      afterData.status || "",
      afterData.joinedAt || "",
      formatTimestamp(afterData.createdAt),
      formatTimestamp(afterData.updatedAt || afterData.createdAt)
    ];

    // Case 2: Document Edited / Updated
    if (rowIndex !== -1) {
      const updateRange = `${SHEET_NAME}!A${rowIndex + 1}:J${rowIndex + 1}`;
      console.log(`Memperbarui data baris ke-${rowIndex + 1} untuk ID Karyawan: ${employeeId}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: updateRange,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [recordValues]
        }
      });
    } 
    // Case 3: Document Created / Appended
    else {
      console.log(`Menambahkan baris baru ke Spreadsheet untuk ID Karyawan asli: ${employeeId}`);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:J`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [recordValues]
        }
      });
    }

    console.log("Sinkronisasi real-time berhasil diselesaikan.");
    return null;
  } catch (error) {
    console.error("Gagal menjalankan fungsi Cloud Trigger:", error);
    throw error;
  }
});
