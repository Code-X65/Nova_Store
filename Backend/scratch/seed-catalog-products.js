require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../src/config/supabase');
const productService = require('../src/services/product.service');

const ADMIN_ID = 'f69cc976-7e47-4742-b656-7ebc68364048'; // Admin user ID

const getPriceRange = (subcatSlug, index) => {
  const multipliers = [1.2, 1.8, 0.75];
  let basePrice = 49.99;
  
  const expensive = ['smartphones', 'laptops', 'furniture', 'luxury-watches', 'cycling', 'guitars', 'keyboards', 'strollers'];
  const mid = ['audio-equipment', 'smartwatches', 'powertools', 'camping-gear', 'fitness-equipment', 'board-games', 'office-furniture', 'suitcases', 'travel-backpacks'];
  const cheap = ['clothing', 'menswear', 'womenswear', 'kidswear', 'activewear', 'puzzles', 'dolls', 'action-figures', 'car-parts', 'accessories', 'diagnostic-tools', 'car-care'];

  if (expensive.some(s => subcatSlug.includes(s))) {
    basePrice = 499.99;
  } else if (mid.some(s => subcatSlug.includes(s))) {
    basePrice = 129.99;
  } else if (cheap.some(s => subcatSlug.includes(s))) {
    basePrice = 34.99;
  } else {
    // food, stationery, books, plants, etc.
    basePrice = 14.99;
  }
  
  return parseFloat((basePrice * multipliers[index]).toFixed(2));
};

async function seed() {
  console.log('=== Starting Catalog Products Seeder ===');
  
  // 1. Fetch active categories
  const { data: categories, error } = await supabase
    .from('product_categories')
    .select('id, name, slug, parent_id, level')
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching categories:', error);
    process.exit(1);
  }

  const parents = categories.filter(c => c.level === 0 || !c.parent_id);
  const subcategories = categories.filter(c => c.level === 1 && c.parent_id);

  console.log(`Found ${parents.length} root categories and ${subcategories.length} subcategories.`);

  const generatedProducts = [];
  const uploadPayloads = [];

  for (const sub of subcategories) {
    const parent = parents.find(p => p.id === sub.parent_id);
    if (!parent) continue;

    const cleanSlug = sub.slug.toUpperCase().replace(/[^A-Z]/g, '');
    const prefix = cleanSlug.length <= 6 ? cleanSlug.padEnd(6, 'X') : (cleanSlug.slice(0, 3) + cleanSlug.slice(-3));
    
    // Define 3 products for this subcategory
    const templates = [
      {
        name: `Apex ${sub.name} X1`,
        sku: `${prefix}-APX-01`,
        description: `Experience the advanced features of the Apex ${sub.name.toLowerCase()} X1. Perfect for standard daily use.`,
        short_description: `High-quality Apex ${sub.name.toLowerCase()}.`
      },
      {
        name: `Nova ${sub.name} Pro`,
        sku: `${prefix}-NOV-02`,
        description: `Premium edition Nova ${sub.name.toLowerCase()} Pro. Built with top-grade materials for maximum reliability and lifespan.`,
        short_description: `Premium Nova ${sub.name.toLowerCase()}.`
      },
      {
        name: `Lite ${sub.name} Basic`,
        sku: `${prefix}-LTE-03`,
        description: `Affordable and straightforward Lite ${sub.name.toLowerCase()} Basic. Simple design with all key essential functions included.`,
        short_description: `Essential ${sub.name.toLowerCase()} at a budget price.`
      }
    ];

    templates.forEach((t, index) => {
      const price = getPriceRange(sub.slug, index);
      const salePrice = index === 1 ? parseFloat((price * 0.9).toFixed(2)) : null; // discount on the premium one
      
      const payload = {
        sku: t.sku,
        name: t.name,
        description: t.description,
        short_description: t.short_description,
        category_id: sub.parent_id,
        subcategory_id: sub.id,
        brand: index === 0 ? 'Apex' : (index === 1 ? 'Nova' : 'Lite'),
        price: price,
        sale_price: salePrice,
        stock_quantity: 50 + (index * 25),
        status: 'published',
        is_featured: index === 1,
        attributes: {}
      };

      // Handle Smartphones required RAM attribute
      if (sub.slug === 'smartphones' || sub.id === '4e1fff46-13ce-4203-995e-c997ce9969e1') {
        const ramValues = ['8GB', '12GB', '6GB'];
        payload.attributes = {
          'RAM': ramValues[index]
        };
      }

      uploadPayloads.push(payload);
    });
  }

  console.log(`Generated ${uploadPayloads.length} product upload payloads.`);

  // Save payloads to JSON file for user reference
  const jsonPath = path.join(__dirname, 'catalog-products-seed.json');
  fs.writeFileSync(jsonPath, JSON.stringify(uploadPayloads, null, 2));
  console.log(`✓ Saved JSON payload file to: ${jsonPath}`);

  // 2. Upload products sequentially
  console.log('\nStarting database upload... (this may take a few moments)');
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uploadPayloads.length; i++) {
    const payload = uploadPayloads[i];
    try {
      // Check if product with this SKU already exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', payload.sku)
        .maybeSingle();

      if (existing) {
        console.log(`[${i + 1}/${uploadPayloads.length}] Sku "${payload.sku}" already exists. Skipping.`);
        successCount++;
        continue;
      }

      await productService.createProduct(ADMIN_ID, payload);
      successCount++;
      if (successCount % 20 === 0 || i === uploadPayloads.length - 1) {
        console.log(`Uploaded ${successCount}/${uploadPayloads.length} products...`);
      }
    } catch (err) {
      console.error(`✗ Failed to upload product "${payload.sku}":`, err.message);
      failCount++;
    }
  }

  console.log(`\n=== Seeder Finished ===`);
  console.log(`Successfully seeded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  
  process.exit(0);
}

seed();
