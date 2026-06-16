const supabase = require('../config/supabase');
const ProductModel = require('../models/product.model');

class RecommendationService {
  /**
   * Retrieves personalized product recommendations for a user.
   * Uses a hybrid Content-Based + Interaction-Affinity algorithm.
   * Falls back to popular/best-selling products if user history is insufficient.
   * 
   * @param {string} userId - UUID of the authenticated user (optional)
   * @param {number} limit - Maximum number of recommendations to return
   */
  async getPersonalizedRecommendations(userId, limit = 10) {
    try {
      // 1. Fetch all active published products to build the scoring catalog
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null);

      if (productsError) throw productsError;
      if (!products || products.length === 0) return [];

      // If user is guest/anonymous, return top-rated fallback recommendations immediately
      if (!userId) {
        return this.getPopularFallback(products, limit);
      }

      // 2. Fetch user's search history (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: searchLogs, error: searchError } = await supabase
        .from('user_search_logs')
        .select('search_query')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchError) throw searchError;

      // 3. Fetch user's product view history (last 30 days)
      const { data: viewLogs, error: viewError } = await supabase
        .from('user_product_views')
        .select('product_id, view_duration, products(category_id, brand_id)')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(30);

      if (viewError) throw viewError;

      // If user has no interaction history, return fallback
      if ((!searchLogs || searchLogs.length === 0) && (!viewLogs || viewLogs.length === 0)) {
        return this.getPopularFallback(products, limit);
      }

      // 4. Aggregate user profile search terms & category/brand preferences
      const searchTerms = searchLogs.map(log => log.search_query.toLowerCase().trim()).filter(Boolean);
      
      const categoryViewWeights = {};
      const brandViewWeights = {};
      const viewedProductIds = new Set();

      viewLogs.forEach(log => {
        if (!log.products) return;
        viewedProductIds.add(log.product_id);

        const catId = log.products.category_id;
        const brandId = log.products.brand_id;
        const weight = 1 + Math.min(Math.floor(log.view_duration / 10), 5); // view duration weight boost (max +5)

        if (catId) {
          categoryViewWeights[catId] = (categoryViewWeights[catId] || 0) + weight;
        }
        if (brandId) {
          brandViewWeights[brandId] = (brandViewWeights[brandId] || 0) + weight;
        }
      });

      // 5. Score each product based on matches
      const scoredProducts = products.map(product => {
        let score = 0;

        // Skip product if already viewed recently to keep suggestions fresh
        if (viewedProductIds.has(product.id)) {
          score -= 5;
        }

        // Feature: Content-based search matching (TF-IDF approximation)
        searchTerms.forEach(term => {
          const name = (product.name || '').toLowerCase();
          const description = (product.description || '').toLowerCase();

          if (name.includes(term)) {
            score += 15; // Strong boost for exact/partial title match
          } else {
            // Check individual words
            const words = term.split(/\s+/);
            words.forEach(word => {
              if (word.length > 2 && name.includes(word)) score += 5;
            });
          }

          if (description.includes(term)) {
            score += 5; // Moderate boost for description match
          }
        });

        // Feature: Category interaction affinity
        if (product.category_id && categoryViewWeights[product.category_id]) {
          score += categoryViewWeights[product.category_id] * 6;
        }

        // Feature: Brand interaction affinity
        if (product.brand_id && brandViewWeights[product.brand_id]) {
          score += brandViewWeights[product.brand_id] * 3;
        }

        // Feature: Product quality/popularity scaling
        score += (Number(product.average_rating) || 0) * 2;
        score += Math.log1p(Number(product.review_count) || 0);

        return { product, score };
      });

      // 6. Sort by score descending and extract products
      scoredProducts.sort((a, b) => b.score - a.score);

      // Return the top items
      return scoredProducts.slice(0, limit).map(item => item.product);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  }

  /**
   * Helper to return top-rated/featured products as fallback recommendations
   */
  getPopularFallback(products, limit) {
    return [...products]
      .sort((a, b) => {
        // Sort by average rating descending, then reviews count descending
        const ratingDiff = (Number(b.average_rating) || 0) - (Number(a.average_rating) || 0);
        if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
        return (Number(b.review_count) || 0) - (Number(a.review_count) || 0);
      })
      .slice(0, limit);
  }
}

module.exports = new RecommendationService();
