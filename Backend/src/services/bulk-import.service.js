const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const { supabaseAdmin } = supabase;
const { SINGLE_STORE_ID } = require('../config/store');
const slugify = require('../utils/slug-generator');
const CatalogVariantService = require('./catalog-variant.service');
const WarehouseService = require('./warehouse.service');
const logger = require('../utils/logger');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

/**
 * bulk-import.service.js
 *
 * Excel-based (.xlsx / .xls) catalog ingestion. Spreadsheet *columns* map
 * directly to entity fields; rows are validated and written in batches, with
 * rejected rows exported to a downloadable `.xlsx` reject sheet.
 *
 * Pure helpers (mapWorkbookRows / validateProductRow / validateCategoryRow /
 * validateInventoryRow) are exported for unit testing without infra.
 */

// ---- Pure helpers --------------------------------------------------------

function mapWorkbookRows(rows, mapping) {
  if (!mapping) return rows.map((r) => ({ ...r }));
  return rows.map((row) => {
    const out = {};
    for (const [target, source] of Object.entries(mapping)) {
      out[target] = row[source];
    }
    return out;
  });
}

function validateProductRow(row) {
  const errors = [];
  if (!row.sku) errors.push('sku is required');
  if (!row.name) errors.push('name is required');
  const price = Number(row.price);
  if (row.price === undefined || row.price === null || row.price === '' || Number.isNaN(price) || price < 0) {
    errors.push('price must be a non-negative number');
  }
  return { valid: errors.length === 0, errors };
}

function validateCategoryRow(row) {
  const errors = [];
  if (!row.name) errors.push('name is required');
  return { valid: errors.length === 0, errors };
}

function validateInventoryRow(row) {
  const errors = [];
  if (!row.sku) errors.push('sku is required');
  if (!row.warehouse_code) errors.push('warehouse_code is required');
  const qty = Number(row.quantity);
  if (row.quantity === undefined || row.quantity === null || row.quantity === '' || Number.isNaN(qty) || qty < 0) {
    errors.push('quantity must be a non-negative number');
  }
  return { valid: errors.length === 0, errors };
}

// ---- Parsing -------------------------------------------------------------

function parseXlsx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  const headers = ws['!ref']
    ? XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref'])).split(':')[0]
    : null;
  return { sheetName, headers, rows };
}

// ---- Writers -------------------------------------------------------------

async function writeProducts(rows, userId, rejectRows) {
  let count = 0;
  for (const row of rows) {
    try {
      const baseSlug = slugify(String(row.name));
      let slug = baseSlug;
      const { data: exists } = await supabaseAdmin.from('products').select('id').eq('slug', slug).maybeSingle();
      if (exists) slug = `${baseSlug}-${Math.floor(Math.random() * 1e4)}`;

      const { error } = await supabaseAdmin
        .from('products')
        .insert({
          sku: String(row.sku),
          name: String(row.name),
          slug,
          description: row.description || null,
          category: row.category || null,
          price: Number(row.price),
          sale_price: row.sale_price != null && row.sale_price !== '' ? Number(row.sale_price) : null,
          cost_price: row.cost_price != null && row.cost_price !== '' ? Number(row.cost_price) : null,
          stock_quantity: row.stock_quantity != null && row.stock_quantity !== '' ? Number(row.stock_quantity) : 0,
          status: row.status || 'published',
          created_by: userId,
          store_id: SINGLE_STORE_ID,
        })
        .select('id')
        .single();
      if (error) throw error;
      count++;
    } catch (err) {
      rejectRows.push({ ...row, __errors: `Write failed: ${err.message}` });
    }
  }
  return count;
}

async function writeCategories(rows, userId, rejectRows) {
  let count = 0;
  for (const row of rows) {
    try {
      const baseSlug = slugify(String(row.name));
      let slug = baseSlug;
      const { data: exists } = await supabaseAdmin.from('product_categories').select('id').eq('slug', slug).maybeSingle();
      if (exists) slug = `${baseSlug}-${Math.floor(Math.random() * 1e4)}`;
      const { error } = await supabaseAdmin.from('product_categories').insert({
        name: String(row.name),
        slug,
        level: 0,
        is_active: true,
        created_by: userId,
        store_id: SINGLE_STORE_ID,
      });
      if (error) throw error;
      count++;
    } catch (err) {
      rejectRows.push({ ...row, __errors: `Write failed: ${err.message}` });
    }
  }
  return count;
}

async function writeInventory(rows, rejectRows) {
  let count = 0;
  for (const row of rows) {
    try {
      const { data: product } = await supabaseAdmin
        .from('products').select('id').eq('sku', String(row.sku)).maybeSingle();
      if (!product) throw new Error(`Product not found for sku ${row.sku}`);
      const { data: wh } = await supabaseAdmin
        .from('warehouses').select('id').eq('code', String(row.warehouse_code)).maybeSingle();
      if (!wh) throw new Error(`Warehouse not found for code ${row.warehouse_code}`);
      await WarehouseService.setLevel({
        productId: product.id,
        warehouseId: wh.id,
        quantity: Number(row.quantity),
        lowStockThreshold: row.low_stock_threshold != null ? Number(row.low_stock_threshold) : 10,
      });
      count++;
    } catch (err) {
      rejectRows.push({ ...row, __errors: `Write failed: ${err.message}` });
    }
  }
  return count;
}

const RESERVED_VARIANT_COLS = new Set(['product_sku', 'sku', 'price_modifier', 'stock_quantity', 'sale_price']);

async function writeVariants(rows, rejectRows) {
  // Group rows by product_sku, build option matrix, rebuild variants.
  const byProduct = new Map();
  for (const row of rows) {
    const key = String(row.product_sku || row.sku);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(row);
  }
  let count = 0;
  for (const [sku, groupRows] of byProduct.entries()) {
    try {
      const { data: product } = await supabaseAdmin.from('products').select('id').eq('sku', sku).maybeSingle();
      if (!product) throw new Error(`Product not found for sku ${sku}`);
      const optionNames = new Set();
      for (const row of groupRows) {
        for (const col of Object.keys(row)) {
          if (!RESERVED_VARIANT_COLS.has(col)) optionNames.add(col);
        }
      }
      const options = [...optionNames].map((name) => ({
        name,
        values: [...new Set(groupRows.map((r) => r[name]).filter((v) => v != null && v !== ''))],
      }));
      await CatalogVariantService.replaceVariantOptions(product.id, options);
      count += groupRows.length;
    } catch (err) {
      for (const row of groupRows) rejectRows.push({ ...row, __errors: `Write failed: ${err.message}` });
    }
  }
  return count;
}

// ---- Orchestration -------------------------------------------------------

async function updateJob(jobId, patch) {
  await supabaseAdmin.from('import_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', jobId);
}

async function writeRejectSheet(jobId, rejectRows) {
  const ws = XLSX.utils.json_to_sheet(rejectRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');
  const fileName = `import-${jobId}-errors.xlsx`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  XLSX.writeFile(wb, filePath);
  return `/uploads/${fileName}`;
}

/**
 * Process a previously-uploaded workbook.
 * @param {string} jobId
 * @param {string} filePath  absolute path to the uploaded .xlsx/.xls
 * @param {string} entityType product|category|inventory|variant
 * @param {string} userId
 */
async function processImport(jobId, filePath, entityType, userId) {
  await updateJob(jobId, { status: 'processing' });

  let parsed;
  try {
    parsed = parseXlsx(filePath);
  } catch (err) {
    await updateJob(jobId, { status: 'failed' });
    throw err;
  }

  const rows = parsed.rows || [];
  const total = rows.length;

  const validators = {
    product: validateProductRow,
    category: validateCategoryRow,
    inventory: validateInventoryRow,
    variant: () => ({ valid: true, errors: [] }),
  };
  const validator = validators[entityType] || validateProductRow;

  const valid = [];
  const rejectRows = [];
  for (const row of rows) {
    const { valid: ok, errors } = validator(row);
    if (ok) valid.push(row);
    else rejectRows.push({ ...row, __errors: errors.join('; ') });
  }

  let processed = 0;
  let writeError = null;
  try {
    const writers = {
      product: () => writeProducts(valid, userId, rejectRows),
      category: () => writeCategories(valid, userId, rejectRows),
      inventory: () => writeInventory(valid, rejectRows),
      variant: () => writeVariants(valid, rejectRows),
    };
    processed = await (writers[entityType] || writers.product)();
  } catch (err) {
    // Catastrophic failure outside per-row handling (e.g. updateJob). Rows already
    // inserted are kept; only the not-yet-processed valid rows are reported rejected.
    writeError = err.message;
    for (let i = processed; i < valid.length; i++) {
      rejectRows.push({ ...valid[i], __errors: `Write failed: ${writeError}` });
    }
    logger.error(`[BulkImport] job ${jobId} (${entityType}) writer crashed:`, writeError);
  }

  const errorFileUrl = rejectRows.length > 0 ? await writeRejectSheet(jobId, rejectRows) : null;
  const status = writeError ? 'failed'
    : rejectRows.length > 0 && processed === 0 ? 'failed'
    : rejectRows.length > 0 ? 'partial'
    : 'completed';

  await updateJob(jobId, {
    status,
    total_rows: total,
    processed_rows: processed,
    error_rows: rejectRows.length,
    error_file_url: errorFileUrl,
  });

  logger.info(`[BulkImport] job ${jobId} (${entityType}) -> ${status}: ${processed}/${total} processed, ${rejectRows.length} rejected`);
  return { status, total, processed, errorRows: rejectRows.length, errorFileUrl };
}

module.exports = {
  parseXlsx,
  processImport,
  mapWorkbookRows,
  validateProductRow,
  validateCategoryRow,
  validateInventoryRow,
};
