const { buildVariantCombinations, signatureOf } = require('../../../src/services/catalog-variant.service');

describe('buildVariantCombinations', () => {
  it('returns [] for no options', () => {
    expect(buildVariantCombinations([])).toEqual([]);
  });

  it('returns a single combo for one option with one value', () => {
    const r = buildVariantCombinations([{ name: 'Size', values: ['S'] }]);
    expect(r).toHaveLength(1);
    expect(r[0].optionValues).toEqual([{ optionName: 'Size', value: 'S' }]);
  });

  it('computes the cartesian product of multiple options', () => {
    const r = buildVariantCombinations([
      { name: 'Size', values: ['S', 'M'] },
      { name: 'Color', values: ['Red', 'Blue'] },
    ]);
    expect(r).toHaveLength(4);
    const sigs = r.map((x) => signatureOf(x.optionValues)).sort();
    expect(sigs).toEqual(
      ['Color=Blue|Size=M', 'Color=Blue|Size=S', 'Color=Red|Size=M', 'Color=Red|Size=S'].sort()
    );
  });
});

describe('signatureOf', () => {
  it('normalizes option order so equivalent variants share a signature', () => {
    const a = signatureOf([{ optionName: 'Color', value: 'Red' }, { optionName: 'Size', value: 'M' }]);
    const b = signatureOf([{ optionName: 'Size', value: 'M' }, { optionName: 'Color', value: 'Red' }]);
    expect(a).toBe(b);
    expect(a).toBe('Color=Red|Size=M');
  });
});
