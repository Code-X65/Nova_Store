const {
  mapWorkbookRows,
  validateProductRow,
  validateCategoryRow,
  validateInventoryRow,
} = require('../../../src/services/bulk-import.service');

describe('mapWorkbookRows', () => {
  it('maps source spreadsheet columns to target entity fields', () => {
    const rows = [{ 'Product Name': 'Shoe', SKU: 'A1', Price: '100' }];
    const mapped = mapWorkbookRows(rows, { name: 'Product Name', sku: 'SKU', price: 'Price' });
    expect(mapped).toEqual([{ name: 'Shoe', sku: 'A1', price: '100' }]);
  });

  it('returns rows unchanged when no mapping is supplied', () => {
    const rows = [{ a: 1, b: 2 }];
    expect(mapWorkbookRows(rows)).toEqual(rows);
  });
});

describe('validateProductRow', () => {
  it('passes a valid row', () => {
    expect(validateProductRow({ sku: 'A1', name: 'Shoe', price: 100 }).valid).toBe(true);
  });

  it('fails on missing sku/name and invalid price', () => {
    const r = validateProductRow({ name: 'Shoe', price: 'abc' });
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining(['sku is required', 'price must be a non-negative number']));
  });
});

describe('validateCategoryRow', () => {
  it('requires a name', () => {
    expect(validateCategoryRow({}).valid).toBe(false);
    expect(validateCategoryRow({ name: 'Apparel' }).valid).toBe(true);
  });
});

describe('validateInventoryRow', () => {
  it('passes with sku, warehouse_code and a numeric quantity', () => {
    expect(validateInventoryRow({ sku: 'A1', warehouse_code: 'W1', quantity: 5 }).valid).toBe(true);
  });

  it('fails without warehouse_code and with negative quantity', () => {
    expect(validateInventoryRow({ sku: 'A1', quantity: 5 }).valid).toBe(false);
    expect(validateInventoryRow({ sku: 'A1', warehouse_code: 'W1', quantity: -1 }).valid).toBe(false);
  });
});
