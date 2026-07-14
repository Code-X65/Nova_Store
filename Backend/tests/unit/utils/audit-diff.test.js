const { computeDelta, summarizeDelta, formatValue, humanize } = require('../../../src/utils/audit-diff');

describe('audit-diff', () => {
  describe('formatValue', () => {
    it('returns em-dash for null', () => {
      expect(formatValue(null, 'name')).toBe('—');
    });

    it('returns em-dash for undefined', () => {
      expect(formatValue(undefined, 'name')).toBe('—');
    });

    it('formats booleans', () => {
      expect(formatValue(true, 'flag')).toBe('true');
      expect(formatValue(false, 'flag')).toBe('false');
    });

    it('stringifies objects', () => {
      expect(formatValue({ a: 1 }, 'data')).toBe('{"a":1}');
    });

    it('formats currency fields with dollar prefix', () => {
      expect(formatValue(10, 'price')).toBe('$10.00');
      expect(formatValue(9.99, 'sale_price')).toBe('$9.99');
    });

    it('falls back to String for other primitives', () => {
      expect(formatValue(42, 'count')).toBe('42');
      expect(formatValue('hello', 'name')).toBe('hello');
    });
  });

  describe('humanize', () => {
    it('converts snake_case to Title Case', () => {
      expect(humanize('quantity_change')).toBe('Quantity Change');
      expect(humanize('reason_code')).toBe('Reason Code');
    });
  });

  describe('computeDelta', () => {
    it('treats null oldValues as empty object and reports all new fields as additions', () => {
      const { delta, summary } = computeDelta(null, { quantityChange: 5, reasonCode: 'damaged' });
      expect(delta).toHaveLength(2);
      expect(delta[0]).toEqual({ field: 'quantityChange', label: 'QuantityChange', before: null, after: 5 });
      expect(delta[1]).toEqual({ field: 'reasonCode', label: 'ReasonCode', before: null, after: 'damaged' });
      expect(summary).toBe('QuantityChange changed from — to 5; ReasonCode changed from — to damaged');
    });

    it('treats null newValues as empty object and reports all old fields as removals', () => {
      const { delta, summary } = computeDelta({ quantityChange: 5 }, null);
      expect(delta).toHaveLength(1);
      expect(delta[0]).toEqual({ field: 'quantityChange', label: 'QuantityChange', before: 5, after: null });
      expect(summary).toBe('QuantityChange changed from 5 to —');
    });

    it('returns empty delta when both are null', () => {
      const { delta, summary } = computeDelta(null, null);
      expect(delta).toEqual([]);
      expect(summary).toBe('');
    });

    it('returns empty delta when both are empty objects', () => {
      const { delta, summary } = computeDelta({}, {});
      expect(delta).toEqual([]);
      expect(summary).toBe('');
    });

    it('detects genuine field changes', () => {
      const { delta, summary } = computeDelta(
        { status: 'draft', price: 10 },
        { status: 'published', price: 12 }
      );
      expect(delta).toHaveLength(2);
      expect(delta[0]).toEqual({ field: 'status', label: 'Status', before: 'draft', after: 'published' });
      expect(delta[1]).toEqual({ field: 'price', label: 'Price', before: 10, after: 12 });
      expect(summary).toContain('Status changed from draft to published');
      expect(summary).toContain('Price changed from $10.00 to $12.00');
    });

    it('handles null to value transitions with em-dash in summary', () => {
      const { delta, summary } = computeDelta(
        { notes: null },
        { notes: 'restocked' }
      );
      expect(delta).toHaveLength(1);
      expect(delta[0]).toEqual({ field: 'notes', label: 'Notes', before: null, after: 'restocked' });
      expect(summary).toBe('Notes changed from — to restocked');
    });

    it('handles value to null transitions', () => {
      const { delta, summary } = computeDelta(
        { notes: 'restocked' },
        { notes: null }
      );
      expect(delta).toHaveLength(1);
      expect(summary).toBe('Notes changed from restocked to —');
    });

    it('detects added and removed keys', () => {
      const { delta, summary } = computeDelta(
        { a: 1 },
        { a: 1, b: 2 }
      );
      expect(delta).toHaveLength(1);
      expect(delta[0]).toEqual({ field: 'b', label: 'B', before: null, after: 2 });
      expect(summary).toBe('B changed from — to 2');
    });

    it('skips equal values', () => {
      const { delta, summary } = computeDelta(
        { a: 1, b: 'x' },
        { a: 1, b: 'x' }
      );
      expect(delta).toEqual([]);
      expect(summary).toBe('');
    });
  });

  describe('summarizeDelta', () => {
    it('builds summary from precomputed delta entries', () => {
      const delta = [
        { field: 'price', label: 'Price', before: 10, after: 12 },
        { field: 'status', label: 'Status', before: 'draft', after: 'published' },
      ];
      expect(summarizeDelta(delta)).toBe('Price changed from $10.00 to $12.00; Status changed from draft to published');
    });

    it('handles empty delta', () => {
      expect(summarizeDelta([])).toBe('');
    });

    it('handles null/undefined before/after with em-dash', () => {
      const delta = [
        { field: 'notes', label: 'Notes', before: null, after: 'ok' },
      ];
      expect(summarizeDelta(delta)).toBe('Notes changed from — to ok');
    });
  });
});
