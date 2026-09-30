// Paste this complete file into Extensions → Apps Script for the Google Sheet,
// then Deploy → Manage deployments → Edit → New version → Deploy.
const CUSTOMERS = 'Customers';
const INVOICES = 'Invoices';

function doGet(e) {
  const phone = String(e.parameter.phone || '').trim();
  if (!phone) return json({ found: false });

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const customerRows = spreadsheet.getSheetByName(CUSTOMERS).getDataRange().getValues();
  const customer = customerRows.slice(1).find(row => String(row[0]).trim() === phone);
  if (!customer) return json({ found: false });

  const result = { found: true, phone: customer[0], name: customer[1] };
  if (String(e.parameter.includeLastInvoice) === 'true') {
    const invoiceRows = spreadsheet.getSheetByName(INVOICES).getDataRange().getValues();
    const row = invoiceRows.slice(1).reverse().find(invoice => String(invoice[2]).trim() === phone);
    if (row) {
      let items = [];
      try { items = JSON.parse(row[9] || '[]'); } catch (error) {}
      result.lastInvoice = {
        invoiceNumber: row[0], date: formatDateForInput(row[1]), phone: row[2],
        customerName: row[3], shipping: row[6], returns: row[7], items: items
      };
    }
  }
  return json(result);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const customers = spreadsheet.getSheetByName(CUSTOMERS);
  const invoices = spreadsheet.getSheetByName(INVOICES);
  const phone = String(data.phone || '').trim();
  const name = String(data.customerName || '').trim();
  const now = new Date();

  if (phone && name) {
    const rows = customers.getDataRange().getValues();
    const index = rows.slice(1).findIndex(row => String(row[0]).trim() === phone);
    const customerRow = [phone, name, data.invoiceNumber || '', data.grandTotal || 0, now];
    if (index >= 0) customers.getRange(index + 2, 1, 1, customerRow.length).setValues([customerRow]);
    else customers.appendRow(customerRow);
  }

  invoices.appendRow([
    data.invoiceNumber || '', data.date || '', phone, name, data.totalQty || 0,
    data.subtotal || 0, data.shipping || 0, data.returns || 0, data.grandTotal || 0,
    JSON.stringify(data.items || [])
  ]);
  return json({ success: true });
}

function formatDateForInput(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value || '');
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
