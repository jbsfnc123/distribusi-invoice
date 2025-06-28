/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const SHEET_NAME = "API"; // Ganti jika nama sheet Anda berbeda

// Fungsi ini menangani permintaan GET (untuk membaca data)
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOutput({ "status": "error", "message": `Sheet "${SHEET_NAME}" tidak ditemukan.` });
    }
    
    // Jangan lakukan apa-apa jika sheet kosong atau hanya berisi header
    if (sheet.getLastRow() < 2) {
      return jsonOutput({ "status": "success", "data": [] });
    }
    
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    const dataValues = dataRange.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const jsonData = dataValues.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        // Jika kolom tanggal, format dengan benar
        if(row[index] instanceof Date) {
            obj[header] = row[index].toISOString().split('T')[0];
        } else {
            obj[header] = row[index];
        }
      });
      return obj;
    });

    return jsonOutput({ "status": "success", "data": jsonData });

  } catch (err) {
    return jsonOutput({ "status": "error", "message": err.message });
  }
}

// Fungsi ini menangani permintaan POST (untuk menyimpan/memperbarui data)
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOutput({ "status": "error", "message": `Sheet "${SHEET_NAME}" tidak ditemukan.` });
    }
    
    const params = JSON.parse(e.postData.contents);
    const invoiceToFind = params.invoice;
    const newRowData = params.data;
    
    if (!invoiceToFind) {
      throw new Error("Nomor 'invoice' tidak ditemukan dalam data yang dikirim.");
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const invoiceColumnIndex = headers.indexOf("invoice") + 1;
    
    if (invoiceColumnIndex === 0) {
      throw new Error("Header kolom 'invoice' tidak ditemukan di Sheet.");
    }

    let foundRow = -1;

    if (sheet.getLastRow() > 1) {
      const invoiceColumnValues = sheet.getRange(2, invoiceColumnIndex, sheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < invoiceColumnValues.length; i++) {
        if (String(invoiceColumnValues[i][0]).trim() === String(invoiceToFind).trim()) {
          foundRow = i + 2;
          break;
        }
      }
    }
    
    const valuesToSet = headers.map(header => newRowData[String(header).trim()] !== undefined ? newRowData[String(header).trim()] : "");

    if (foundRow !== -1) {
      sheet.getRange(foundRow, 1, 1, headers.length).setValues([valuesToSet]);
    } else {
      sheet.appendRow(valuesToSet);
    }
    
    return jsonOutput({ "status": "success", "message": "Data berhasil disimpan" });
    
  } catch (err) {
    return jsonOutput({ "status": "error", "message": err.message });
  }
}

// Fungsi bantuan untuk membuat output JSON
function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
