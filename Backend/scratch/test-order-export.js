const dotenv = require('dotenv');
dotenv.config();

const OrderController = require('../src/controllers/order.controller');

async function run() {
  console.log('🚀 Starting Bulk Order Export Verification...');

  // Mock Request for CSV
  let csvSent = false;
  let csvContentType = '';
  let csvContentDisp = '';
  let csvBody = null;

  const reqCsv = {
    query: {
      status: 'confirmed',
      format: 'csv'
    }
  };

  const resCsv = {
    setHeader(name, value) {
      if (name.toLowerCase() === 'content-type') csvContentType = value;
      if (name.toLowerCase() === 'content-disposition') csvContentDisp = value;
    },
    status(code) {
      return {
        send(data) {
          csvSent = true;
          csvBody = data;
        }
      }
    }
  };

  await OrderController.exportOrders(reqCsv, resCsv, (err) => {
    if (err) throw err;
  });

  if (!csvSent) {
    throw new Error('Verification failed: CSV export res.send was not called');
  }
  if (csvContentType !== 'text/csv') {
    throw new Error(`Verification failed: Expected content-type text/csv, got ${csvContentType}`);
  }
  if (!csvContentDisp.includes('attachment; filename=orders-export-')) {
    throw new Error(`Verification failed: Expected content-disposition matching orders-export, got ${csvContentDisp}`);
  }
  if (typeof csvBody !== 'string') {
    throw new Error(`Verification failed: Expected body to be CSV string, got: ${typeof csvBody}`);
  }
  console.log('✅ Success: CSV export format generated and sent.');
  console.log('CSV sample content:\n', csvBody.substring(0, 300));

  // Mock Request for PDF
  let pdfSent = false;
  let pdfContentType = '';
  let pdfContentDisp = '';
  let pdfBody = null;

  const reqPdf = {
    query: {
      status: 'confirmed',
      format: 'pdf'
    }
  };

  const resPdf = {
    setHeader(name, value) {
      if (name.toLowerCase() === 'content-type') pdfContentType = value;
      if (name.toLowerCase() === 'content-disposition') pdfContentDisp = value;
    },
    status(code) {
      return {
        send(data) {
          pdfSent = true;
          pdfBody = data;
        }
      }
    }
  };

  await OrderController.exportOrders(reqPdf, resPdf, (err) => {
    if (err) throw err;
  });

  if (!pdfSent) {
    throw new Error('Verification failed: PDF export res.send was not called');
  }
  if (pdfContentType !== 'application/pdf') {
    throw new Error(`Verification failed: Expected content-type application/pdf, got ${pdfContentType}`);
  }
  if (!pdfContentDisp.includes('attachment; filename=orders-export-')) {
    throw new Error(`Verification failed: Expected content-disposition matching orders-export, got ${pdfContentDisp}`);
  }
  if (!Buffer.isBuffer(pdfBody)) {
    throw new Error(`Verification failed: Expected body to be PDF buffer, got: ${typeof pdfBody}`);
  }
  console.log('✅ Success: PDF export format generated and sent.');
  console.log(`PDF Buffer size: ${pdfBody.length} bytes`);

  console.log('🎉 BULK ORDER EXPORT VERIFICATION PASSED!');
}

run().catch(err => {
  console.error('❌ Order export verification failed:', err);
  process.exit(1);
});
