/**
 * Square API Routes
 * OAuth 2.0 flow, catalog sync, orders, payments, inventory management
 */

import { Router } from "express";
import { requireAuth } from "./auth";
import { z } from "zod";
import {
  generateOAuthUrl,
  validateOAuthState,
  exchangeOAuthCode,
  revokeSquareToken,
  isSquareConnected,
  listLocations,
  setLocation,
  syncCatalog,
  createSquareOrder,
  getSquareOrder,
  searchSquareOrders,
  updateSquareOrderState,
  createExternalPayment,
  listSquarePayments,
  getInventoryCounts,
  adjustInventory,
  setInventoryCount,
  getMerchantProfile,
  getSquareToken,
  getSquareLocationId,
} from "./square";
import { storage } from "./storage";

const router = Router();

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

// ==================== OAuth 2.0 ====================

/**
 * GET /api/square/oauth/authorize
 * Initiates Square OAuth flow. Returns the authorization URL.
 */
router.get("/api/square/oauth/authorize", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const url = generateOAuthUrl(user.organizationId);
    return res.json({ url });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/square/oauth/callback
 * Square redirects here after user authorizes. Exchanges code for tokens.
 */
router.get("/api/square/oauth/callback", async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.status(400).send(`
        <html><body><script>
          window.opener?.postMessage({ type: 'square-oauth-error', error: '${oauthError}' }, '*');
          window.close();
        </script><p>Authorization denied. You can close this window.</p></body></html>
      `);
    }

    if (!code || !state) {
      return res.status(400).send("Missing code or state parameter");
    }

    const orgId = validateOAuthState(state as string);
    if (!orgId) {
      return res.status(400).send(`
        <html><body><script>
          window.opener?.postMessage({ type: 'square-oauth-error', error: 'Invalid or expired state' }, '*');
          window.close();
        </script><p>Invalid or expired authorization. Please try again.</p></body></html>
      `);
    }

    const { accessToken, merchantId } = await exchangeOAuthCode(code as string, orgId);

    // Auto-select the first location
    try {
      const locations = await listLocations(orgId);
      if (locations.length > 0) {
        await setLocation(orgId, locations[0].id);
      }
    } catch {
      // Location selection can be done manually later
    }

    return res.send(`
      <html><body><script>
        window.opener?.postMessage({
          type: 'square-oauth-success',
          merchantId: '${merchantId}'
        }, '*');
        window.close();
      </script><p>Square connected successfully! You can close this window.</p></body></html>
    `);
  } catch (error: any) {
    console.error("Square OAuth callback error:", error);
    return res.send(`
      <html><body><script>
        window.opener?.postMessage({ type: 'square-oauth-error', error: 'Token exchange failed' }, '*');
        window.close();
      </script><p>Connection failed. Please try again.</p></body></html>
    `);
  }
});

/**
 * GET /api/square/status
 * Check current Square connection status.
 */
router.get("/api/square/status", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const connected = !!(org.squareAccessToken && org.squareMerchantId);

    const result: any = {
      connected,
      merchantId: org.squareMerchantId || null,
      locationId: org.squareLocationId || null,
      environment: org.squareEnvironment || "production",
    };

    if (connected) {
      try {
        const merchant = await getMerchantProfile(user.organizationId);
        result.businessName = merchant.business_name;
        result.country = merchant.country;
        result.currency = merchant.currency;
      } catch {
        // Merchant profile fetch is best-effort
      }
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/square/disconnect
 * Revoke Square access and clear stored tokens.
 */
router.post("/api/square/disconnect", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    await revokeSquareToken(user.organizationId);
    return res.json({ success: true, message: "Square disconnected" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Locations ====================

/**
 * GET /api/square/locations
 * List all merchant locations. Required to set the active location.
 */
router.get("/api/square/locations", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const locations = await listLocations(user.organizationId);
    const org = await storage.getOrganization(user.organizationId);
    return res.json({
      locations: locations.map((l: any) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        status: l.status,
        timezone: l.timezone,
      })),
      activeLocationId: org?.squareLocationId || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/square/locations/set
 * Set the active location for this tenant.
 */
router.post("/api/square/locations/set", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { locationId } = req.body;
    if (!locationId) return res.status(400).json({ error: "locationId is required" });

    await setLocation(user.organizationId, locationId);
    return res.json({ success: true, locationId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Catalog ====================

/**
 * GET /api/square/catalog
 * Sync and return the full Square catalog for this tenant.
 */
router.get("/api/square/catalog", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const items = await syncCatalog(user.organizationId);
    return res.json({
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        category: i.category,
        variationId: i.variationId,
        variationName: i.variationName,
        price: i.price / 100, // Convert cents to dollars
        imageUrl: i.imageUrl,
      })),
      count: items.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Orders ====================

/**
 * POST /api/square/orders
 * Create a new order in Square (completed + external payment for pre-paid events).
 */
router.post("/api/square/orders", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      items: z.array(z.object({
        catalogObjectId: z.string().optional(),
        variationId: z.string(),
        quantity: z.number().min(1),
        name: z.string(),
        price: z.number(), // in cents
      })).min(1),
      state: z.enum(["OPEN", "COMPLETED"]).default("COMPLETED"),
      createPayment: z.boolean().default(true),
      paymentSource: z.string().default("Pre-paid Event Package"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const order = await createSquareOrder(
      user.organizationId,
      parsed.data.items,
      parsed.data.state
    );

    let payment = null;
    if (parsed.data.createPayment && parsed.data.state === "COMPLETED") {
      const totalCents = order.total_money?.amount || 0;
      if (totalCents > 0) {
        payment = await createExternalPayment(
          user.organizationId,
          order.id,
          totalCents,
          parsed.data.paymentSource
        );
      }
    }

    // Also create a local order record for dashboard tracking
    const totalDollars = (order.total_money?.amount || 0) / 100;
    const localItems = parsed.data.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price / 100,
    }));

    await storage.createOrder({
      items: localItems,
      total: totalDollars.toFixed(2),
      status: parsed.data.state === "COMPLETED" ? "completed" : "pending",
      paymentStatus: payment ? "paid" : "unpaid",
      paymentMethod: payment ? "external" : undefined,
      organizationId: user.organizationId,
    });

    return res.json({
      success: true,
      order: {
        id: order.id,
        state: order.state,
        totalMoney: order.total_money,
        lineItems: order.line_items,
        createdAt: order.created_at,
      },
      payment: payment ? {
        id: payment.id,
        status: payment.status,
        amountMoney: payment.amount_money,
      } : null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/square/orders
 * Search recent Square orders.
 */
router.get("/api/square/orders", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const limit = parseInt(req.query.limit as string) || 20;
    const orders = await searchSquareOrders(user.organizationId, { limit });
    return res.json({
      orders: orders.map((o: any) => ({
        id: o.id,
        state: o.state,
        totalMoney: o.total_money,
        lineItems: o.line_items?.map((li: any) => ({
          name: li.name,
          quantity: li.quantity,
          totalMoney: li.total_money,
        })),
        createdAt: o.created_at,
      })),
      count: orders.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/square/orders/:orderId
 * Get a specific Square order.
 */
router.get("/api/square/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const orderId = param(req.params.orderId);
    const order = await getSquareOrder(user.organizationId, orderId);
    return res.json({ order });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/square/orders/:orderId/complete
 * Mark a Square order as completed.
 */
router.post("/api/square/orders/:orderId/complete", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const orderId = param(req.params.orderId);
    const order = await updateSquareOrderState(user.organizationId, orderId, "COMPLETED");
    return res.json({ success: true, order });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/square/orders/:orderId/cancel
 * Cancel a Square order.
 */
router.post("/api/square/orders/:orderId/cancel", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const orderId = param(req.params.orderId);
    const order = await updateSquareOrderState(user.organizationId, orderId, "CANCELED");
    return res.json({ success: true, order });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Payments ====================

/**
 * POST /api/square/payments
 * Create an external payment for an order.
 */
router.post("/api/square/payments", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      orderId: z.string(),
      amountCents: z.number().min(1),
      source: z.string().default("Pre-paid Event Package"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const payment = await createExternalPayment(
      user.organizationId,
      parsed.data.orderId,
      parsed.data.amountCents,
      parsed.data.source
    );

    return res.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amountMoney: payment.amount_money,
        orderId: payment.order_id,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/square/payments
 * List recent Square payments.
 */
router.get("/api/square/payments", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const limit = parseInt(req.query.limit as string) || 20;
    const payments = await listSquarePayments(user.organizationId, { limit });
    return res.json({
      payments: payments.map((p: any) => ({
        id: p.id,
        status: p.status,
        amountMoney: p.amount_money,
        orderId: p.order_id,
        createdAt: p.created_at,
        sourceType: p.source_type,
      })),
      count: payments.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Inventory ====================

/**
 * POST /api/square/inventory/counts
 * Get inventory counts for specified catalog items.
 */
router.post("/api/square/inventory/counts", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { catalogObjectIds } = req.body;
    if (!catalogObjectIds?.length) {
      return res.status(400).json({ error: "catalogObjectIds array is required" });
    }
    const counts = await getInventoryCounts(user.organizationId, catalogObjectIds);
    return res.json({
      counts: counts.map((c: any) => ({
        catalogObjectId: c.catalog_object_id,
        state: c.state,
        quantity: c.quantity,
        calculatedAt: c.calculated_at,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/square/inventory/adjust
 * Adjust inventory for a catalog item (receive stock, record waste, etc.).
 */
router.post("/api/square/inventory/adjust", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      catalogObjectId: z.string(),
      quantity: z.number(),
      fromState: z.string().default("NONE"),
      toState: z.string().default("IN_STOCK"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const counts = await adjustInventory(
      user.organizationId,
      parsed.data.catalogObjectId,
      parsed.data.quantity,
      parsed.data.fromState,
      parsed.data.toState
    );
    return res.json({ success: true, counts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/square/inventory/set
 * Set absolute inventory count (physical count) for a catalog item.
 */
router.post("/api/square/inventory/set", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      catalogObjectId: z.string(),
      quantity: z.number().min(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const counts = await setInventoryCount(
      user.organizationId,
      parsed.data.catalogObjectId,
      parsed.data.quantity
    );
    return res.json({ success: true, counts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export { router as squareRouter };
