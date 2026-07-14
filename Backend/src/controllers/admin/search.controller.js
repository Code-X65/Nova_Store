const supabase = require('../../config/supabase');

class SearchController {
  async globalSearch(req, res, next) {
    try {
      const q = req.query.q || '';
      if (q.length < 2) {
        return res.status(200).json({
          success: true,
          data: { products: [], orders: [], customers: [], staff: [], categories: [], brands: [], coupons: [] }
        });
      }

      const searchQuery = `%${q}%`;
      const storeId = req.store?.id;

      // Extract roles/permissions
      const roles = req.user.roles || [];
      const isOwner = roles.includes('store_owner') || roles.includes('STORE_OWNER');
      const isManager = roles.includes('manager') || roles.includes('MANAGER');
      const isOrderStaff = roles.includes('order_staff') || roles.includes('ORDER_STAFF');
      const isInventoryStaff = roles.includes('inventory_staff') || roles.includes('INVENTORY_STAFF');
      
      const canReadProducts = isOwner || isManager || isInventoryStaff; // or explicitly check req.user.permissions
      const canReadOrders = isOwner || isManager || isOrderStaff;
      const canReadCustomers = isOwner || isManager;
      const canReadStaff = isOwner;
      const canReadCoupons = isOwner || isManager;

      const promises = [];
      const resultKeys = [];

      // 1. Products
      if (canReadProducts) {
        promises.push(
          supabase.from('products')
            .select('id, name, sku, slug, images, status')
            .or(`name.ilike.${searchQuery},sku.ilike.${searchQuery}`)
            .limit(5)
        );
        resultKeys.push('products');
      }

      // 2. Orders
      if (canReadOrders) {
        promises.push(
          supabase.from('orders')
            .select('id, order_number, status, total_amount, email, user_id ( first_name, last_name )')
            .or(`order_number.ilike.${searchQuery},email.ilike.${searchQuery}`)
            .limit(5)
        );
        resultKeys.push('orders');
      }

      // 3. Customers
      if (canReadCustomers) {
        promises.push(
          supabase.from('users')
            .select('id, first_name, last_name, email, role')
            .eq('role', 'user')
            .or(`first_name.ilike.${searchQuery},last_name.ilike.${searchQuery},email.ilike.${searchQuery}`)
            .limit(5)
        );
        resultKeys.push('customers');
      }

      // 4. Staff
      if (canReadStaff) {
        promises.push(
          supabase.from('users')
            .select('id, first_name, last_name, email, role')
            .neq('role', 'user')
            .or(`first_name.ilike.${searchQuery},last_name.ilike.${searchQuery},email.ilike.${searchQuery}`)
            .limit(5)
        );
        resultKeys.push('staff');
      }

      // 5. Categories
      if (canReadProducts) {
        promises.push(
          supabase.from('product_categories')
            .select('id, name, slug')
            .ilike('name', searchQuery)
            .limit(5)
        );
        resultKeys.push('categories');
      }

      // 6. Brands
      if (canReadProducts) {
        promises.push(
          supabase.from('product_brands')
            .select('id, name, slug')
            .ilike('name', searchQuery)
            .limit(5)
        );
        resultKeys.push('brands');
      }

      // 7. Coupons
      if (canReadCoupons) {
        promises.push(
          supabase.from('coupons')
            .select('id, code, discount_type, discount_value')
            .ilike('code', searchQuery)
            .limit(5)
        );
        resultKeys.push('coupons');
      }

      const results = await Promise.all(promises);

      const finalData = {
        products: [],
        orders: [],
        customers: [],
        staff: [],
        categories: [],
        brands: [],
        coupons: []
      };

      results.forEach((res, index) => {
        const key = resultKeys[index];
        if (!res.error && res.data) {
          finalData[key] = res.data;
        } else if (res.error) {
           console.error(`Search error for ${key}:`, res.error);
        }
      });

      res.status(200).json({
        success: true,
        data: finalData
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SearchController();
