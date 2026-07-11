/**
 * audit-exporter.js — serialise audit rows to CSV / PDF for admin export.
 */
const PDFDocument = require('pdfkit');

const CSV_COLUMNS = [
  { key: 'created_at', label: 'Timestamp' },
  { key: 'severity', label: 'Severity' },
  { key: 'action_type', label: 'Action Type' },
  { key: 'action', label: 'Action' },
  { key: 'entity_type', label: 'Entity Type' },
  { key: 'entity_id', label: 'Entity ID' },
  { key: 'actor_full_name', label: 'Actor' },
  { key: 'actor_role', label: 'Role' },
  { key: 'ip_address', label: 'IP Address' },
  { key: 'summary', label: 'Summary' },
];

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows = []) {
  const header = CSV_COLUMNS.map((c) => escapeCsv(c.label)).join(',');
  const body = rows.map((row) =>
    CSV_COLUMNS.map((c) => escapeCsv(row[c.key])).join(',')
  );
  return [header, ...body].join('\n');
}

function toPDF(rows = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fillColor('#DC2626').fontSize(20).text('NOVA STORE', 40, 40, { continued: true });
      doc.fillColor('#333333').fontSize(16).text(' - AUDIT LOG EXPORT', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666');
      doc.text(`Generated At: ${new Date().toLocaleString()}`);
      doc.text(`Records: ${rows.length}`);
      doc.moveDown();

      const cols = [
        { label: 'Timestamp', x: 40, w: 95 },
        { label: 'Severity', x: 140, w: 55 },
        { label: 'Action', x: 200, w: 110 },
        { label: 'Actor', x: 315, w: 90 },
        { label: 'Entity', x: 410, w: 70 },
        { label: 'Summary', x: 485, w: 90 },
      ];

      const drawHeader = (y) => {
        doc.fontSize(8).fillColor('#111111');
        cols.forEach((c) => doc.text(c.label, c.x, y, { width: c.w }));
        doc.moveDown(0.4);
        doc.moveTo(40, doc.y).lineTo(575, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.4);
      };

      drawHeader(doc.y);
      doc.fillColor('#444444').fontSize(7.5);

      for (const row of rows) {
        if (doc.y > 760) {
          doc.addPage();
          drawHeader(doc.y);
          doc.fillColor('#444444').fontSize(7.5);
        }
        const y = doc.y;
        doc.text(String(row.created_at || ''), cols[0].x, y, { width: cols[0].w });
        doc.text(String(row.severity || 'info'), cols[1].x, y, { width: cols[1].w });
        doc.text(String(row.action || ''), cols[2].x, y, { width: cols[2].w });
        doc.text(String(row.actor_full_name || row.actor_role || ''), cols[3].x, y, { width: cols[3].w });
        doc.text(String(row.entity_type || ''), cols[4].x, y, { width: cols[4].w });
        doc.text(String(row.summary || ''), cols[5].x, y, { width: cols[5].w });
        doc.moveDown(0.8);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { toCSV, toPDF, CSV_COLUMNS };
