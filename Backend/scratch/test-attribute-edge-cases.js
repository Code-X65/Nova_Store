const dotenv = require('dotenv');
dotenv.config();

const AttributeService = require('../src/services/attribute.service');
const ProductModel = require('../src/models/product.model');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('🚀 Starting Attribute Validation Edge Cases Verification...');

  // 1. Get a valid category and a valid user from the database
  let categoryId = null;
  const { data: categories, error: catErr } = await supabase.from('product_categories').select('id').limit(1);
  if (!catErr && categories && categories.length > 0) {
    categoryId = categories[0].id;
  }
  console.log(`Using category ID: ${categoryId}`);

  let targetUserId = null;
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (!userErr && users && users.length > 0) {
    targetUserId = users[0].id;
  }
  console.log(`Using target user ID: ${targetUserId}`);

  if (!categoryId) {
    console.log('⚠️ No categories found. Skipping database part of validation.');
    return;
  }

  // 2. Validate attributes with null/undefined values
  // This should not throw "must be a number" or other error due to conversion to "null"
  console.log('Validating attributes with null/undefined/empty...');
  const provided = {
    "RAM": null,
    "Storage": undefined,
    "Screen Size": "" // empty is validated by switch, will fail or pass depending on type
  };
  const valResult = await AttributeService.validateAttributes(categoryId, provided, true);
  console.log('Validation errors:', valResult.errors);
  // It shouldn't have errors for RAM and Storage since they are null/undefined and skipped!
  const hasRamOrStorageError = valResult.errors.some(e => e.includes('RAM') || e.includes('Storage'));
  if (hasRamOrStorageError) {
    throw new Error('Verification failed: null/undefined attribute values generated validation errors');
  }
  console.log('✅ Success: null/undefined values skipped type check correctly.');

  // 3. Test saveProductAttributes maps null/undefined to SQL null
  console.log('Testing saveProductAttributes value typing...');
  // Find category attributes template for number type if exists, or create a mock product attribute save
  const templates = await AttributeService.getInheritedAttributes(categoryId);
  if (templates.length > 0) {
    const template = templates[0];
    const attributeValues = {
      [template.attribute_name]: null
    };

    // Mock product creation to try saving attributes
    const testProduct = await ProductModel.create({
      sku: `TEST-ATTR-${Date.now()}`,
      name: 'Test Attribute Product',
      slug: `test-attribute-product-${Date.now()}`,
      category: 'electronics',
      price: 1000.00,
      stock_quantity: 10,
      track_inventory: true,
      created_by: targetUserId
    });

    try {
      console.log(`Saving product attribute for product ${testProduct.id}...`);
      await AttributeService.saveProductAttributes(testProduct.id, categoryId, attributeValues);

      // Verify the value in the database is null (and not the string "null"!) or deleted
      const { data: dbAttr, error: attrErr } = await supabase
        .from('product_attributes')
        .select('attribute_value')
        .eq('product_id', testProduct.id)
        .eq('attribute_id', template.id)
        .maybeSingle();
      if (attrErr) throw attrErr;

      console.log(`Stored attribute row in database:`, dbAttr);
      if (dbAttr !== null) {
        throw new Error(`Verification failed: Expected saved attribute row to be deleted/null, got: "${JSON.stringify(dbAttr)}"`);
      }
      console.log('✅ Success: Null value triggered attribute row deletion correctly.');

    } finally {
      // Cleanup
      await supabase.from('products').delete().eq('id', testProduct.id);
    }
  }

  console.log('🎉 ATTRIBUTE EDGE CASES VERIFICATION PASSED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('❌ Attribute edge cases verification failed:', err);
  process.exit(1);
});
