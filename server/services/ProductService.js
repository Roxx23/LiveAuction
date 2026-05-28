const shopify = require('../shopify/shopifyClient');

class ProductService {
  /**
   * Fetch a random product from a Shopify store
   */
  static async fetchRandomProduct(shopDomain, accessToken) {
    const apiVersion = shopify.config.apiVersion;

    // Fetch up to 250 products (covers most stores)
    const productsRes = await fetch(
      `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=250&status=active`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    if (!productsRes.ok) {
      const errText = await productsRes.text();
      throw new Error(`Failed to fetch products: ${productsRes.status} — ${errText}`);
    }

    const { products } = await productsRes.json();
    if (!products || products.length === 0) {
      throw new Error('This store has no products to auction.');
    }

    // Pick a random product
    const product = products[Math.floor(Math.random() * products.length)];

    return {
      shopifyProductId: String(product.id),
      title: product.title,
      description: product.body_html || '',
      imageUrl: product.images?.[0]?.src || null,
      originalPrice: product.variants?.[0]?.price || '0.00',
      variants: product.variants?.map((v) => ({
        id: String(v.id),
        title: v.title,
        price: v.price,
        sku: v.sku,
      })) || [],
    };
  }

  /**
   * Fetch a specific product by Shopify ID
   */
  static async fetchProductById(shopDomain, accessToken, productId) {
    const apiVersion = shopify.config.apiVersion;

    const res = await fetch(
      `https://${shopDomain}/admin/api/${apiVersion}/products/${productId}.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch product ${productId}: ${res.status}`);
    }

    const { product } = await res.json();
    return {
      shopifyProductId: String(product.id),
      title: product.title,
      description: product.body_html || '',
      imageUrl: product.images?.[0]?.src || null,
      originalPrice: product.variants?.[0]?.price || '0.00',
      variants: product.variants?.map((v) => ({
        id: String(v.id),
        title: v.title,
        price: v.price,
        sku: v.sku,
      })) || [],
    };
  }

  /**
   * Create a draft order on Shopify for the auction winner
   */
  static async createDraftOrder(shopDomain, accessToken, { email, productVariantId, winningBid, productTitle }) {
    const apiVersion = shopify.config.apiVersion;

    const draftOrder = {
      draft_order: {
        line_items: [
          {
            variant_id: parseInt(productVariantId, 10),
            quantity: 1,
            applied_discount: {
              description: 'LiveAuction winning bid price',
              value_type: 'fixed_amount',
              value: '0.00', // will be overridden by price
              title: 'Auction Price',
            },
            price: winningBid.toString(),
          },
        ],
        email,
        note: `Won via LiveAuction — Product: ${productTitle}, Winning bid: $${winningBid}`,
        tags: 'LiveAuction',
      },
    };

    const res = await fetch(
      `https://${shopDomain}/admin/api/${apiVersion}/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftOrder),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Failed to create draft order: ${res.status} — ${errBody}`);
    }

    const { draft_order } = await res.json();
    return {
      draftOrderId: draft_order.id,
      invoiceUrl: draft_order.invoice_url,
      status: draft_order.status,
    };
  }
}

module.exports = ProductService;
