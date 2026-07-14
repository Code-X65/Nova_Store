const supabase = require('../config/supabase');
const { supabaseAdmin } = supabase;
const { SINGLE_STORE_ID } = require('../config/store');

/**
 * catalog-variant.service.js
 *
 * Manages the canonical variant *option matrix* for a product.
 * A variant is the cartesian product of its selected option values
 * (e.g. Size x Color). Previously `product_variants.option_values` was a
 * freeform JSONB blob; this service normalises it into
 * product_options / product_option_values / product_variant_options and
 * (re)builds the concrete product_variants rows.
 */

/**
 * Pure helper — compute every variant combination from an option list.
 * @param {Array<{name:string, values:string[]}>} options
 * @returns {Array<{optionValues: Array<{optionName:string, value:string}>}>}
 */
function buildVariantCombinations(options) {
  if (!Array.isArray(options) || options.length === 0) return [];
  let combos = [{ optionValues: [] }];
  for (const opt of options) {
    const values = Array.isArray(opt.values) ? opt.values : [];
    const next = [];
    for (const combo of combos) {
      for (const value of values) {
        next.push({ optionValues: [...combo.optionValues, { optionName: opt.name, value }] });
      }
    }
    combos = next;
  }
  return combos;
}

function signatureOf(optionValues) {
  return optionValues
    .slice()
    .sort((a, b) => a.optionName.localeCompare(b.optionName))
    .map((o) => `${o.optionName}=${o.value}`)
    .join('|');
}

class CatalogVariantService {
  /** Fetch the current option matrix + concrete variants for a product. */
  async getVariantOptions(productId) {
    const { data: options, error } = await supabaseAdmin
      .from('product_options')
      .select('id, name, display_order, product_option_values(id, value, position)')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });

    if (error) throw error;

    const { data: variants, error: vErr } = await supabaseAdmin
      .from('product_variants')
      .select('id, sku, name, price_modifier, sale_price, stock_quantity, is_active, product_variant_options(option_value_id, product_option_values(value, option_id, product_options(name)))')
      .eq('product_id', productId);

    if (vErr) throw vErr;

    return { options: options || [], variants: variants || [] };
  }

  /**
   * Replace a product's option matrix and rebuild its variants.
   * Combinations whose option signature already exists preserve the
   * previous variant (id + stock); new combinations get a fresh variant.
   */
  async replaceVariantOptions(productId, optionsInput) {
    const options = (optionsInput || []).filter(
      (o) => o && o.name && Array.isArray(o.values) && o.values.length > 0
    );

    // 1. Load existing variants keyed by signature (to preserve stock)
    const existing = await this.getVariantOptions(productId);
    const existingBySig = new Map();
    for (const v of existing.variants) {
      const sig = signatureOf(
        (v.product_variant_options || []).map((vo) => ({
          optionName: vo.product_option_values?.product_options?.name || '',
          value: vo.product_option_values?.value,
        }))
      );
      if (sig) existingBySig.set(sig, v);
    }

    // 2. Delete current variants first, then the option matrix.
    //    (Cascade removes product_variant_options links; deleting the variants
    //     themselves prevents stale/duplicated variant rows from accumulating.)
    await supabaseAdmin.from('product_variants').delete().eq('product_id', productId);
    await supabaseAdmin.from('product_options').delete().eq('product_id', productId);

    if (options.length === 0) {
      return { options: [], variants: [] };
    }

    // 3. (Re)create options + values
    const combos = buildVariantCombinations(options);
    const { data: product } = await supabaseAdmin
      .from('products').select('sku').eq('id', productId).single();

    const baseSku = product?.sku || productId.slice(0, 8);

    const createdVariants = [];
    for (const combo of combos) {
      const sig = signatureOf(combo.optionValues);
      const prior = existingBySig.get(sig);

      // Create variant row
      const { data: variant, error } = await supabaseAdmin
        .from('product_variants')
        .insert({
          product_id: productId,
          sku: prior?.sku || `${baseSku}-${createdVariants.length + 1}`,
          name: combo.optionValues.map((o) => o.value).join(' / '),
          option_values: combo.optionValues.reduce((acc, o) => ({ ...acc, [o.optionName]: o.value }), {}),
          stock_quantity: prior?.stock_quantity || 0,
          price_modifier: prior?.price_modifier || 0,
          sale_price: prior?.sale_price || null,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Create option rows + link variant
      for (const ov of combo.optionValues) {
        const { data: optRow, error: optErr } = await supabaseAdmin
          .from('product_options')
          .insert({ product_id: productId, name: ov.optionName })
          .select('id')
          .single();
        if (optErr) throw optErr;

        const { data: valRow, error: valErr } = await supabaseAdmin
          .from('product_option_values')
          .insert({ option_id: optRow.id, value: ov.value })
          .select('id')
          .single();
        if (valErr) throw valErr;

        await supabaseAdmin
          .from('product_variant_options')
          .insert({ variant_id: variant.id, option_value_id: valRow.id })
          .select('variant_id')
          .single();
      }

      createdVariants.push(variant.id);
    }

    return this.getVariantOptions(productId);
  }

  /** Best-effort one-off migration of legacy option_values JSONB. */
  async migrateLegacyOptionValues(productId) {
    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('id, option_values')
      .eq('product_id', productId)
      .not('option_values', 'is', null);

    if (!variants || variants.length === 0) return { migrated: 0 };

    for (const v of variants) {
      const ov = v.option_values || {};
      for (const [name, value] of Object.entries(ov)) {
        const { data: opt } = await supabaseAdmin
          .from('product_options').insert({ product_id: productId, name }).select('id').single();
        const { data: val } = await supabaseAdmin
          .from('product_option_values').insert({ option_id: opt.id, value }).select('id').single();
        await supabaseAdmin
          .from('product_variant_options').insert({ variant_id: v.id, option_value_id: val.id })
          .select('variant_id').single();
      }
    }
    return { migrated: variants.length };
  }
}

module.exports = new CatalogVariantService();
module.exports.buildVariantCombinations = buildVariantCombinations;
module.exports.signatureOf = signatureOf;
