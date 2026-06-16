require('dotenv').config();

const categoryService = require('../src/services/category.service');
const productService = require('../src/services/product.service');
const categoryAttributeModel = require('../src/models/category-attribute.model');
const supabase = require('../src/config/supabase');

const ADMIN_ID = 'f69cc976-7e47-4742-b656-7ebc68364048'; // Using the admin user ID from the database seeding

async function runTest() {
  console.log('=== Starting Full Integration Test: Category Attributes & Product Upload ===');

  // Pre-cleanup: Delete any leftover categories or products from previous interrupted runs
  await supabase.from('products').delete().like('sku', 'TEST-PHONE-%');
  await supabase.from('product_categories').delete().eq('name', 'Test Mobile Child');
  await supabase.from('product_categories').delete().eq('name', 'Test Tech Parent');

  let parentId = null;
  let childId = null;
  let attributeId = null;
  let productId = null;

  try {
    // 1. Create Parent Category
    console.log('\n[1/7] Creating parent category...');
    const parent = await categoryService.createCategory(ADMIN_ID, {
      name: 'Test Tech Parent',
      description: 'Test category description for technology products.',
      image_url: 'https://example.com/test-parent.jpg',
      thumbnail_url: 'https://example.com/test-parent-thumb.jpg',
      icon: 'smartphone'
    });
    parentId = parent.id;
    console.log(`✓ Parent category created: "${parent.name}" (ID: ${parentId}, Slug: ${parent.slug})`);

    // 2. Create Child Category (Subcategory)
    console.log('\n[2/7] Creating child subcategory...');
    const child = await categoryService.createCategory(ADMIN_ID, {
      name: 'Test Mobile Child',
      parentId: parentId,
      description: 'Test subcategory description for mobile products.',
      image_url: 'https://example.com/test-child.jpg',
      thumbnail_url: 'https://example.com/test-child-thumb.jpg',
      icon: 'phone'
    });
    childId = child.id;
    console.log(`✓ Child subcategory created: "${child.name}" (ID: ${childId}, Slug: ${child.slug})`);

    // 3. Define a REQUIRED Enum Attribute on the child category
    console.log('\n[3/7] Defining required enum attribute "Test Required RAM" on child category...');
    const attribute = await categoryAttributeModel.create({
      category_id: childId,
      attribute_name: 'Test Required RAM',
      attribute_type: 'enum',
      is_required: true,
      unit: 'GB',
      allowed_values: ['8GB', '12GB'],
      display_order: 1
    });
    attributeId = attribute.id;
    console.log(`✓ Required Attribute Template created (ID: ${attributeId}, Type: ${attribute.attribute_type}, Allowed: [${attribute.allowed_values.join(', ')}])`);

    // 4. Test Scenario A: Upload product with MISSING required attribute
    console.log('\n[4/7] Testing Scenario A: Upload product with MISSING required attribute...');
    const productPayloadA = {
      sku: 'TEST-PHONE-ERR1',
      name: 'Test Phone Model X',
      description: 'A test smartphone for validating attributes.',
      short_description: 'Test phone.',
      category_id: parentId,
      subcategory_id: childId,
      price: 699.99,
      stock_quantity: 10,
      status: 'draft',
      attributes: {} // RAM attribute is omitted
    };

    try {
      await productService.createProduct(ADMIN_ID, productPayloadA);
      console.error('✗ Test Failed: Product created successfully but should have failed!');
    } catch (err) {
      console.log(`✓ Test Passed: Product upload blocked correctly as expected.`);
      console.log(`  Received Error Message: "${err.message}"`);
    }

    // 5. Test Scenario B: Upload product with INVALID value for the enum attribute
    console.log('\n[5/7] Testing Scenario B: Upload product with INVALID attribute value...');
    const productPayloadB = {
      ...productPayloadA,
      sku: 'TEST-PHONE-ERR2',
      attributes: {
        'Test Required RAM': '16GB' // Not in ['8GB', '12GB']
      }
    };

    try {
      await productService.createProduct(ADMIN_ID, productPayloadB);
      console.error('✗ Test Failed: Product created successfully but should have failed!');
    } catch (err) {
      console.log(`✓ Test Passed: Product upload blocked correctly as expected.`);
      console.log(`  Received Error Message: "${err.message}"`);
    }

    // 6. Test Scenario C: Upload product with VALID attributes (Success)
    console.log('\n[6/7] Testing Scenario C: Upload product with VALID attributes...');
    const productPayloadC = {
      ...productPayloadA,
      sku: 'TEST-PHONE-OK',
      status: 'published',
      attributes: {
        'Test Required RAM': '8GB' // Valid value!
      }
    };

    const product = await productService.createProduct(ADMIN_ID, productPayloadC);
    productId = product.id;
    console.log(`✓ Test Passed: Product created successfully!`);
    console.log(`  Product Details: ID: ${product.id}, SKU: ${product.sku}, Status: ${product.status}`);

    // Verify attribute value is saved in DB
    const { data: savedAttrs } = await supabase
      .from('product_attributes')
      .select('*')
      .eq('product_id', product.id);

    console.log(`✓ Verified saved attributes in database:`, savedAttrs);

  } catch (err) {
    console.error('✗ Unexpected error occurred during test execution:', err);
  } finally {
    // 7. Cleanup Database
    console.log('\n[7/7] Cleaning up test data from database...');
    
    // Delete any products with SKUs matching our test patterns
    const { error: prodErr } = await supabase.from('products').delete().like('sku', 'TEST-PHONE-%');
    if (prodErr) console.error('Error deleting test products:', prodErr);
    else console.log('✓ Temporary test products deleted.');
    
    if (childId) {
      const { error } = await supabase.from('product_categories').delete().eq('id', childId);
      if (error) console.error('Error deleting test child category:', error);
      else console.log('✓ Temporary child category (and cascading attributes) deleted.');
    }

    if (parentId) {
      const { error } = await supabase.from('product_categories').delete().eq('id', parentId);
      if (error) console.error('Error deleting test parent category:', error);
      else console.log('✓ Temporary parent category deleted.');
    }

    console.log('\n=== Full Integration Test Completed ===');
    process.exit(0);
  }
}

runTest();
