/**
 * shiprocketService.js — BrainyGrasp
 * ─────────────────────────────────────────────────────────────────────────────
 * Service layer wrapping the Shiprocket V2 API.
 *
 * Auth strategy:
 *   - Shiprocket tokens are valid for 10 days.
 *   - We store the token in module-level memory (survives the process lifetime).
 *   - getToken() auto-refreshes if the token is absent or expires within 30 min.
 *   - On Render cold-start (process restart), a fresh token is fetched automatically.
 *
 * All functions throw descriptive Error objects on failure so callers can
 * decide whether to retry, log silently, or return an error response.
 *
 * Environment variables (add to .env / .env.example):
 *   SHIPROCKET_EMAIL           — Shiprocket account email
 *   SHIPROCKET_PASSWORD        — Shiprocket account password
 *   SHIPROCKET_CHANNEL_ID      — channel ID from Shiprocket settings
 *   SHIPROCKET_PICKUP_LOCATION — pickup location name (e.g. "Primary")
 */

'use strict';

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';

// ── Module-level token cache ────────────────────────────────────────────────
let _tokenCache = {
  token: null,
  expiresAt: 0 // Unix ms
};

// ── Internal: fetch a fresh token from Shiprocket ───────────────────────────
async function _login() {
  const email    = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error('Shiprocket credentials not set. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to .env');
  }

  const res = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok || !data.token) {
    throw new Error(`Shiprocket login failed (${res.status}): ${data.message || JSON.stringify(data)}`);
  }

  // Token is valid for 10 days; we refresh 30 minutes before expiry.
  _tokenCache.token     = data.token;
  _tokenCache.expiresAt = Date.now() + (10 * 24 * 60 * 60 * 1000) - (30 * 60 * 1000);

  console.log('✅ Shiprocket token refreshed successfully');
  return data.token;
}

// ── Public: get a valid token (refresh if needed) ───────────────────────────
async function getToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }
  return _login();
}

// ── Internal: authenticated fetch helper ────────────────────────────────────
async function _srFetch(path, options = {}) {
  const token   = await getToken();
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers || {})
  };

  const res = await fetch(`${SHIPROCKET_API}${path}`, {
    ...options,
    headers
  });

  // If Shiprocket returns 401 the token might have been revoked — clear cache
  // so the next call triggers a fresh login.
  if (res.status === 401) {
    _tokenCache.token     = null;
    _tokenCache.expiresAt = 0;
    throw new Error('Shiprocket token expired or revoked. Will re-authenticate on next call.');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Shiprocket API error (${res.status}) ${path}: ${data.message || JSON.stringify(data)}`);
  }

  return data;
}

// ── Status map: Shiprocket → BrainyGrasp internal status ────────────────────
const SHIPROCKET_STATUS_MAP = {
  'NEW':                  'Placed',
  'PENDING PICKUP':       'Confirmed',
  'PICKUP GENERATED':     'Confirmed',
  'PICKUP SCHEDULED':     'Confirmed',
  'PICKUP QUEUED':        'Confirmed',
  'PICKED UP':            'Shipped',
  'IN TRANSIT':           'Shipped',
  'REACHED DESTINATION':  'Shipped',
  'OUT FOR DELIVERY':     'Out for Delivery',
  'DELIVERED':            'Delivered',
  'CANCELLED':            'Cancelled',
  'RTO INITIATED':        'RTO',
  'RTO IN TRANSIT':       'RTO',
  'RTO DELIVERED':        'RTO',
  'LOST':                 'RTO',
  'DAMAGED':              'RTO'
};

function mapShiprocketStatus(srStatus) {
  if (!srStatus) return null;
  const upper = String(srStatus).toUpperCase();
  return SHIPROCKET_STATUS_MAP[upper] || null;
}

// ── 1. Serviceability check ──────────────────────────────────────────────────
/**
 * Check if a pincode is serviceable.
 * @param {object} params
 * @param {string} params.pickupPostcode  — warehouse pincode
 * @param {string} params.deliveryPostcode — customer pincode
 * @param {number} params.weight           — in kg (e.g. 0.5)
 * @param {boolean} params.cod             — true for COD orders
 * @returns {Promise<Array>} array of available courier objects
 */
async function checkServiceability({ pickupPostcode, deliveryPostcode, weight, cod }) {
  const qs = new URLSearchParams({
    pickup_postcode:   pickupPostcode,
    delivery_postcode: deliveryPostcode,
    weight:            String(weight || 0.5),
    cod:               cod ? '1' : '0'
  });

  const data = await _srFetch(`/courier/serviceability/?${qs.toString()}`);
  return data?.data?.available_courier_companies || [];
}

// ── 2. Create shipment ────────────────────────────────────────────────────────
/**
 * Create an order + shipment on Shiprocket.
 * @param {object} orderData — the BrainyGrasp order object from DB
 * @param {object} address   — the delivery address row from DB
 * @param {object} user      — the user row (name, email, phone)
 * @param {Array}  items     — parsed order items array
 * @returns {Promise<{shipmentId: string, orderId: string}>}
 */
async function createShipment(orderData, address, user, items) {
  const channelId      = process.env.SHIPROCKET_CHANNEL_ID;
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';

  if (!channelId) {
    throw new Error('SHIPROCKET_CHANNEL_ID not set in .env');
  }

  // Build Shiprocket order payload
  const payload = {
    order_id:          String(orderData.id),
    order_date:        new Date(orderData.created_at).toISOString().split('T')[0],
    pickup_location:   pickupLocation,
    channel_id:        Number(channelId),
    comment:           `BrainyGrasp Order #${orderData.id}`,
    billing_customer_name: address.full_name || user.name,
    billing_last_name:     '',
    billing_address:       address.line1,
    billing_address_2:     address.line2 || '',
    billing_city:          address.city,
    billing_pincode:       address.pincode,
    billing_state:         address.state,
    billing_country:       'India',
    billing_email:         user.email || '',
    billing_phone:         address.phone || user.phone || '',
    shipping_is_billing:   true,
    order_items: items.map(item => ({
      name:        item.name,
      sku:         `SKU-${item.id || item.name?.replace(/\s+/g, '-') || 'PROD'}`,
      units:       item.quantity || 1,
      selling_price: String(item.price),
      discount:    '0',
      tax:         '0',
      hsn:         ''
    })),
    payment_method: orderData.payment_method === 'razorpay' ? 'Prepaid' : 'COD',
    sub_total:      orderData.subtotal,
    length:         20,   // cm — default dimensions; override per product if needed
    breadth:        15,
    height:         10,
    weight:         0.5   // kg — default; override per order if needed
  };

  const data = await _srFetch('/orders/create/adhoc', {
    method: 'POST',
    body:   JSON.stringify(payload)
  });

  const shipmentId = data?.payload?.shipment_id || data?.shipment_id;
  const srOrderId  = data?.payload?.order_id    || data?.order_id;

  if (!shipmentId) {
    throw new Error(`Shiprocket createShipment returned no shipment_id: ${JSON.stringify(data)}`);
  }

  return { shipmentId: String(shipmentId), orderId: String(srOrderId || '') };
}

// ── 3. Assign AWB ─────────────────────────────────────────────────────────────
/**
 * Assign an AWB number to a shipment using the best auto-selected courier.
 * @param {string} shipmentId
 * @returns {Promise<{awb: string, courierName: string}>}
 */
async function assignAWB(shipmentId) {
  const data = await _srFetch('/courier/assign/awb', {
    method: 'POST',
    body:   JSON.stringify({ shipment_id: String(shipmentId) })
  });

  const awb         = data?.response?.data?.awb_code     || data?.awb_code;
  const courierName = data?.response?.data?.courier_name || data?.courier_name || '';

  if (!awb) {
    throw new Error(`Shiprocket AWB assignment returned no AWB for shipment ${shipmentId}: ${JSON.stringify(data)}`);
  }

  return { awb: String(awb), courierName: String(courierName) };
}

// ── 4. Generate pickup request ────────────────────────────────────────────────
/**
 * Request pickup for one or more shipments.
 * @param {string[]} shipmentIds
 * @returns {Promise<object>} Shiprocket response
 */
async function generatePickup(shipmentIds) {
  const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
  return _srFetch('/courier/generate/pickup', {
    method: 'POST',
    body:   JSON.stringify({ shipment_id: ids.map(String) })
  });
}

// ── 5. Get tracking status ────────────────────────────────────────────────────
/**
 * Fetch live tracking info for an AWB.
 * @param {string} awb
 * @returns {Promise<{
 *   currentStatus: string,       // BrainyGrasp internal status string
 *   srStatus: string,            // raw Shiprocket status string
 *   estimatedDelivery: string|null,  // ISO date string or null
 *   courierName: string
 * }>}
 */
async function getTracking(awb) {
  const data = await _srFetch(`/courier/track/awb/${awb}`);

  const trackingData  = data?.tracking_data;
  const shipmentTrack = trackingData?.shipment_track?.[0] || {};
  const srStatus      = shipmentTrack.current_status || trackingData?.track_url || '';
  const courierName   = shipmentTrack.courier_name   || '';

  // Estimated delivery: ETD field if available
  let estimatedDelivery = null;
  if (shipmentTrack.etd) {
    try {
      estimatedDelivery = new Date(shipmentTrack.etd).toISOString().split('T')[0];
    } catch { /* ignore parse error */ }
  }

  const currentStatus = mapShiprocketStatus(srStatus);

  return {
    currentStatus,
    srStatus,
    estimatedDelivery,
    courierName: String(courierName)
  };
}

// ── 6. Full booking helper (createShipment + assignAWB + generatePickup) ─────
/**
 * Convenience function that combines steps 2–4 in sequence.
 * Used by the order creation flow in server.js.
 *
 * @returns {Promise<{shipmentId: string, awb: string, courierName: string}>}
 */
async function bookShipment(orderData, address, user, items) {
  const { shipmentId } = await createShipment(orderData, address, user, items);
  const { awb, courierName } = await assignAWB(shipmentId);
  await generatePickup([shipmentId]);
  return { shipmentId, awb, courierName };
}

module.exports = {
  getToken,
  checkServiceability,
  createShipment,
  assignAWB,
  generatePickup,
  bookShipment,
  getTracking,
  mapShiprocketStatus
};
