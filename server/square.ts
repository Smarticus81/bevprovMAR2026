/**
 * Square API Client Module
 * Handles all Square API interactions: OAuth, Catalog, Orders, Payments, Inventory
 *
 * Square API Version: 2024-12-18 (pinned)
 * Docs: https://developer.squareup.com/docs
 */

import crypto from "crypto";
import { storage } from "./storage";

const SQUARE_API_VERSION = "2024-12-18";
const SQUARE_BASE_URL = "https://connect.squareup.com";

// OAuth CSRF state tokens with 10-minute TTL
const pendingOAuthStates = new Map<string, { orgId: number; createdAt: number }>();
// One-time token pickup for popup callback
const pendingTokens = new Map<string, { accessToken: string; refreshToken: string; merchantId: string; expiresAt: string }>();

// Cleanup expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingOAuthStates) {
    if (now - value.createdAt > 10 * 60 * 1000) pendingOAuthStates.delete(key);
  }
  for (const [key] of pendingTokens) {
    // Pending tokens expire after 2 minutes
    if (now - parseInt(key.split("-")[0] || "0") > 2 * 60 * 1000) pendingTokens.delete(key);
  }
}, 5 * 60 * 1000);

// ==================== HELPERS ====================

function getSquareAppId(): string {
  const id = process.env.SQUARE_APPLICATION_ID;
  if (!id) throw new Error("SQUARE_APPLICATION_ID not configured");
  return id;
}

function getSquareAppSecret(): string {
  const secret = process.env.SQUARE_APPLICATION_SECRET;
  if (!secret) throw new Error("SQUARE_APPLICATION_SECRET not configured");
  return secret;
}

function getBaseUrl(): string {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : "http://localhost:5000";
}

async function squareFetch(
  path: string,
  accessToken: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<any> {
  const { method = "GET", body } = options;
  const url = `${SQUARE_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Square-Version": SQUARE_API_VERSION,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    let detail = `Square API error ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.errors?.[0]?.detail) detail = errJson.errors[0].detail;
    } catch {}
    throw new Error(detail);
  }

  return res.json();
}

// ==================== TOKEN REFRESH ====================

async function refreshSquareToken(orgId: number): Promise<string> {
  const org = await storage.getOrganization(orgId);
  if (!org?.squareRefreshToken) throw new Error("No Square refresh token available");

  // Check if token is still valid (has > 5 minutes remaining)
  if (org.squareTokenExpiresAt) {
    const expiresAt = new Date(org.squareTokenExpiresAt).getTime();
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return org.squareAccessToken!;
    }
  }

  const res = await fetch(`${SQUARE_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_API_VERSION },
    body: JSON.stringify({
      client_id: getSquareAppId(),
      client_secret: getSquareAppSecret(),
      refresh_token: org.squareRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to refresh Square token: ${errText}`);
  }

  const data = await res.json();
  await storage.updateOrganization(orgId, {
    squareAccessToken: data.access_token,
    squareRefreshToken: data.refresh_token,
    squareTokenExpiresAt: new Date(data.expires_at),
  });

  return data.access_token;
}

/** Get a valid access token for an organization, refreshing if needed */
export async function getSquareToken(orgId: number): Promise<string> {
  const org = await storage.getOrganization(orgId);
  if (!org?.squareAccessToken) throw new Error("Square not connected. Please authorize via OAuth first.");
  return refreshSquareToken(orgId);
}

/** Check if organization has Square connected */
export async function isSquareConnected(orgId: number): Promise<boolean> {
  const org = await storage.getOrganization(orgId);
  return !!(org?.squareAccessToken && org?.squareMerchantId);
}

/** Get the Square location ID for an organization */
export async function getSquareLocationId(orgId: number): Promise<string> {
  const org = await storage.getOrganization(orgId);
  if (!org?.squareLocationId) throw new Error("No Square location configured");
  return org.squareLocationId;
}

// ==================== OAUTH ====================

export function generateOAuthUrl(orgId: number): string {
  const state = crypto.randomUUID();
  pendingOAuthStates.set(state, { orgId, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: getSquareAppId(),
    scope: [
      "MERCHANT_PROFILE_READ",
      "ITEMS_READ",
      "ITEMS_WRITE",
      "ORDERS_WRITE",
      "ORDERS_READ",
      "PAYMENTS_WRITE",
      "PAYMENTS_READ",
      "INVENTORY_READ",
      "INVENTORY_WRITE",
    ].join(" "),
    redirect_uri: `${getBaseUrl()}/api/square/oauth/callback`,
    state,
    session: "false",
  });

  return `${SQUARE_BASE_URL}/oauth2/authorize?${params.toString()}`;
}

export function validateOAuthState(state: string): number | null {
  const entry = pendingOAuthStates.get(state);
  if (!entry) return null;
  pendingOAuthStates.delete(state);
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) return null;
  return entry.orgId;
}

export async function exchangeOAuthCode(code: string, orgId: number): Promise<{ accessToken: string; merchantId: string }> {
  const res = await fetch(`${SQUARE_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_API_VERSION },
    body: JSON.stringify({
      client_id: getSquareAppId(),
      client_secret: getSquareAppSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: `${getBaseUrl()}/api/square/oauth/callback`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Square token exchange failed: ${errText}`);
  }

  const data = await res.json();

  await storage.updateOrganization(orgId, {
    squareAccessToken: data.access_token,
    squareRefreshToken: data.refresh_token,
    squareMerchantId: data.merchant_id,
    squareTokenExpiresAt: new Date(data.expires_at),
  });

  return { accessToken: data.access_token, merchantId: data.merchant_id };
}

export function storePendingToken(accessToken: string, refreshToken: string, merchantId: string, expiresAt: string): string {
  const ts = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  pendingTokens.set(ts, { accessToken, refreshToken, merchantId, expiresAt });
  return ts;
}

export function retrievePendingToken(ts: string) {
  const token = pendingTokens.get(ts);
  if (token) pendingTokens.delete(ts);
  return token;
}

export async function revokeSquareToken(orgId: number): Promise<void> {
  const org = await storage.getOrganization(orgId);
  if (!org?.squareAccessToken) return;

  try {
    await fetch(`${SQUARE_BASE_URL}/oauth2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": SQUARE_API_VERSION },
      body: JSON.stringify({
        client_id: getSquareAppId(),
        access_token: org.squareAccessToken,
      }),
    });
  } catch {
    // Best effort revocation
  }

  await storage.updateOrganization(orgId, {
    squareAccessToken: null,
    squareRefreshToken: null,
    squareMerchantId: null,
    squareLocationId: null,
    squareTokenExpiresAt: null,
  });
}

// ==================== LOCATIONS ====================

export async function listLocations(orgId: number): Promise<any[]> {
  const token = await getSquareToken(orgId);
  const data = await squareFetch("/v2/locations", token);
  return data.locations || [];
}

export async function setLocation(orgId: number, locationId: string): Promise<void> {
  await storage.updateOrganization(orgId, { squareLocationId: locationId });
}

// ==================== CATALOG ====================

export interface SquareCatalogItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  variationId: string;
  variationName?: string;
  price: number; // in cents
  imageUrl?: string;
}

export async function syncCatalog(orgId: number): Promise<SquareCatalogItem[]> {
  const token = await getSquareToken(orgId);

  // Fetch items
  let cursor: string | undefined;
  const rawItems: any[] = [];
  do {
    const params = new URLSearchParams({ types: "ITEM" });
    if (cursor) params.set("cursor", cursor);
    const data = await squareFetch(`/v2/catalog/list?${params}`, token);
    if (data.objects) rawItems.push(...data.objects);
    cursor = data.cursor;
  } while (cursor);

  // Fetch images
  const imageMap = new Map<string, string>();
  try {
    const imgData = await squareFetch("/v2/catalog/list?types=IMAGE", token);
    if (imgData.objects) {
      for (const img of imgData.objects) {
        if (img.image_data?.url) {
          imageMap.set(img.id, img.image_data.url);
        }
      }
    }
  } catch {
    // Images are optional
  }

  // Flatten into simple items
  const items: SquareCatalogItem[] = [];
  for (const obj of rawItems) {
    if (obj.type !== "ITEM" || !obj.item_data) continue;
    const itemData = obj.item_data;
    const variations = itemData.variations || [];

    for (const v of variations) {
      const vData = v.item_variation_data;
      if (!vData) continue;
      const priceMoney = vData.price_money;

      items.push({
        id: obj.id,
        name: itemData.name,
        description: itemData.description || undefined,
        category: itemData.category?.name || itemData.category_id || undefined,
        variationId: v.id,
        variationName: vData.name !== "Regular" ? vData.name : undefined,
        price: priceMoney?.amount || 0,
        imageUrl: itemData.image_ids?.[0] ? imageMap.get(itemData.image_ids[0]) : undefined,
      });
    }
  }

  return items;
}

// ==================== ORDERS ====================

export interface CreateSquareOrderItem {
  catalogObjectId?: string;
  variationId: string;
  quantity: number;
  name: string;
  price: number; // in cents
}

export async function createSquareOrder(
  orgId: number,
  items: CreateSquareOrderItem[],
  state: "OPEN" | "COMPLETED" = "COMPLETED"
): Promise<any> {
  const token = await getSquareToken(orgId);
  const locationId = await getSquareLocationId(orgId);

  const lineItems = items.map((item) => ({
    catalog_object_id: item.variationId,
    quantity: String(item.quantity),
    item_type: "ITEM",
  }));

  const data = await squareFetch("/v2/orders", token, {
    method: "POST",
    body: {
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: locationId,
        line_items: lineItems,
        state,
      },
    },
  });

  return data.order;
}

export async function getSquareOrder(orgId: number, orderId: string): Promise<any> {
  const token = await getSquareToken(orgId);
  const data = await squareFetch(`/v2/orders/${orderId}`, token);
  return data.order;
}

export async function searchSquareOrders(
  orgId: number,
  options: {
    limit?: number;
    states?: string[];
    dateStart?: string;
    dateEnd?: string;
  } = {}
): Promise<any[]> {
  const token = await getSquareToken(orgId);
  const locationId = await getSquareLocationId(orgId);

  const query: any = {
    filter: {
      location_ids: [locationId],
    },
    sort: { sort_field: "CREATED_AT", sort_order: "DESC" },
    limit: options.limit || 20,
  };

  if (options.states?.length) {
    query.filter.state_filter = { states: options.states };
  }

  if (options.dateStart || options.dateEnd) {
    query.filter.date_time_filter = { created_at: {} };
    if (options.dateStart) query.filter.date_time_filter.created_at.start_at = options.dateStart;
    if (options.dateEnd) query.filter.date_time_filter.created_at.end_at = options.dateEnd;
  }

  const data = await squareFetch("/v2/orders/search", token, {
    method: "POST",
    body: { query },
  });

  return data.orders || [];
}

export async function updateSquareOrderState(
  orgId: number,
  orderId: string,
  state: "COMPLETED" | "CANCELED"
): Promise<any> {
  const token = await getSquareToken(orgId);

  // Get current order version
  const currentOrder = await getSquareOrder(orgId, orderId);

  const data = await squareFetch(`/v2/orders/${orderId}`, token, {
    method: "PUT",
    body: {
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: currentOrder.location_id,
        version: currentOrder.version,
        state,
      },
    },
  });

  return data.order;
}

// ==================== PAYMENTS ====================

export async function createExternalPayment(
  orgId: number,
  orderId: string,
  amountCents: number,
  source: string = "Pre-paid Event Package"
): Promise<any> {
  const token = await getSquareToken(orgId);
  const locationId = await getSquareLocationId(orgId);

  const data = await squareFetch("/v2/payments", token, {
    method: "POST",
    body: {
      idempotency_key: crypto.randomUUID(),
      source_id: "EXTERNAL",
      amount_money: {
        amount: amountCents,
        currency: "USD",
      },
      location_id: locationId,
      order_id: orderId,
      external_details: {
        type: "OTHER",
        source,
      },
    },
  });

  return data.payment;
}

export async function listSquarePayments(
  orgId: number,
  options: { limit?: number; beginTime?: string; endTime?: string } = {}
): Promise<any[]> {
  const token = await getSquareToken(orgId);
  const locationId = await getSquareLocationId(orgId);

  const params = new URLSearchParams({ location_id: locationId });
  if (options.limit) params.set("limit", String(options.limit));
  if (options.beginTime) params.set("begin_time", options.beginTime);
  if (options.endTime) params.set("end_time", options.endTime);
  params.set("sort_order", "DESC");

  const data = await squareFetch(`/v2/payments?${params}`, token);
  return data.payments || [];
}

// ==================== INVENTORY ====================

export async function getInventoryCounts(
  orgId: number,
  catalogObjectIds: string[]
): Promise<any[]> {
  const token = await getSquareToken(orgId);
  const locationId = await getSquareLocationId(orgId);

  const data = await squareFetch("/v2/inventory/counts/batch-retrieve", token, {
    method: "POST",
    body: {
      catalog_object_ids: catalogObjectIds,
      location_ids: [locationId],
    },
  });

  return data.counts || [];
}

export async function adjustInventory(
  orgId: number,
  catalogObjectId: string,
  quantity: number,
  fromState: string = "NONE",
  toState: string = "IN_STOCK"
): Promise<any> {
  const token = await getSquareToken(orgId);
  const locationId = await getSquareLocationId(orgId);

  const data = await squareFetch("/v2/inventory/changes/batch-create", token, {
    method: "POST",
    body: {
      idempotency_key: crypto.randomUUID(),
      changes: [
        {
          type: "ADJUSTMENT",
          adjustment: {
            catalog_object_id: catalogObjectId,
            location_id: locationId,
            from_state: fromState,
            to_state: toState,
            quantity: String(Math.abs(quantity)),
            occurred_at: new Date().toISOString(),
          },
        },
      ],
    },
  });

  return data.counts || [];
}

export async function setInventoryCount(
  orgId: number,
  catalogObjectId: string,
  quantity: number
): Promise<any> {
  const token = await getSquareToken(orgId);
  const locationId = await getSquareLocationId(orgId);

  const data = await squareFetch("/v2/inventory/changes/batch-create", token, {
    method: "POST",
    body: {
      idempotency_key: crypto.randomUUID(),
      changes: [
        {
          type: "PHYSICAL_COUNT",
          physical_count: {
            catalog_object_id: catalogObjectId,
            location_id: locationId,
            state: "IN_STOCK",
            quantity: String(quantity),
            occurred_at: new Date().toISOString(),
          },
        },
      ],
    },
  });

  return data.counts || [];
}

// ==================== MERCHANT PROFILE ====================

export async function getMerchantProfile(orgId: number): Promise<any> {
  const token = await getSquareToken(orgId);
  const org = await storage.getOrganization(orgId);
  if (!org?.squareMerchantId) throw new Error("No merchant ID");

  const data = await squareFetch(`/v2/merchants/${org.squareMerchantId}`, token);
  return data.merchant;
}

// ==================== FUZZY MATCHING ====================

/**
 * Fuzzy-match an item name against the Square catalog.
 * Uses case-insensitive substring matching first, then Levenshtein distance.
 */
export function fuzzyMatchCatalogItem(
  searchName: string,
  catalog: SquareCatalogItem[]
): SquareCatalogItem | null {
  const lower = searchName.toLowerCase().trim();

  // Exact match
  const exact = catalog.find((i) => i.name.toLowerCase() === lower);
  if (exact) return exact;

  // Substring match
  const substring = catalog.find((i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()));
  if (substring) return substring;

  // Levenshtein distance matching
  let bestMatch: SquareCatalogItem | null = null;
  let bestDistance = Infinity;

  for (const item of catalog) {
    const d = levenshtein(lower, item.name.toLowerCase());
    const threshold = Math.max(3, Math.floor(item.name.length * 0.4));
    if (d < bestDistance && d <= threshold) {
      bestDistance = d;
      bestMatch = item;
    }
  }

  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
