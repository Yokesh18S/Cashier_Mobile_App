/**
 * Cashier Mobile App API Service
 * Connects directly to Food_Ordering_App_Backend
 *
 * Auth token is stored in memory after login and injected into all
 * authenticated requests (tables, order status, etc.).
 */

import { saveAuthSession, clearAuthSession } from './storage';

// Available backend endpoints
export const BACKEND_ENDPOINTS = [
  { label: 'Cloud Dev API (Default)', url: 'http://dev-api.dataudipi.com' },
  { label: 'Local LAN (10.127.18.176:8001)', url: 'http://10.127.18.176:8001' },
  { label: 'Localhost (Port 8001)', url: 'http://localhost:8001' },
  { label: 'Android Emulator (10.0.2.2:8001)', url: 'http://10.0.2.2:8001' },
];

// Default to Cloud Dev API so phones and emulators connect immediately without localhost timeout
let activeBaseUrl = 'http://dev-api.dataudipi.com';
let activeRestaurantId = 1; // 1 = Data Udipi - Mugalivakkam

export const getActiveBaseUrl = () => activeBaseUrl;
export const setActiveBaseUrl = (url) => {
  activeBaseUrl = url.replace(/\/$/, '');
};
export const getActiveRestaurantId = () => activeRestaurantId;
export const setActiveRestaurantId = (id) => {
  activeRestaurantId = id;
};

// Auth token for authenticated endpoints (tables, order status)
let authToken = null;
export const setAuthToken = (token) => { authToken = token; };
export const getAuthToken = () => authToken;

/**
 * Perform a fetch with a configurable timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const authHeaders = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Check backend health and automatically select reachable endpoint
 */
export async function checkBackendHealth() {
  const candidateUrls = [
    activeBaseUrl,
    'http://dev-api.dataudipi.com',
    'http://10.127.18.176:8001',
    'http://localhost:8001',
    'http://10.0.2.2:8001',
  ];

  const uniqueCandidates = [...new Set(candidateUrls)];

  for (const url of uniqueCandidates) {
    try {
      const res = await fetchWithTimeout(`${url}/api/v1/public/restaurants`, {}, 2500);
      if (res.ok) {
        activeBaseUrl = url;
        const restaurants = await res.json();
        return {
          connected: true,
          url,
          restaurants,
          activeRestaurant: restaurants.find(r => r.id === activeRestaurantId) || restaurants[0],
        };
      }
    } catch {
      // Continue to next candidate
    }
  }

  return {
    connected: false,
    url: activeBaseUrl,
    error: 'Backend is offline or unreachable',
  };
}

/**
 * Fetch public restaurants
 */
export async function fetchRestaurants() {
  try {
    const res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/public/restaurants`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Failed to fetch restaurants:', err.message);
    return [];
  }
}

/**
 * Log in a cashier user and store the returned auth token.
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, token?: string, user?: object, error?: string }}
 */
export async function loginCashier(email, password) {
  try {
    const res = await fetchWithTimeout(
      `${activeBaseUrl}/api/v1/auth/login`,
      {
        method: 'POST',
        body: JSON.stringify({ email, password, role: 'CASHIER' }),
      },
      6000
    );

    const data = await res.json();

    if (res.ok && data.access_token) {
      // Store token in memory so authenticated endpoints work
      setAuthToken(data.access_token);
      // Persist session to secure storage
      await saveAuthSession(data.access_token, data.user);
      // If the backend assigned a restaurant, use it
      if (data.user?.restaurant_id) {
        activeRestaurantId = data.user.restaurant_id;
      }
      return { success: true, token: data.access_token, user: data.user };
    }

    // Backend returned an HTTP error
    const detail = data.detail || data.message || 'Invalid credentials';
    return { success: false, error: detail };
  } catch (err) {
    console.warn('[API] loginCashier error:', err.message);
    return { success: false, error: 'Network error: ' + err.message };
  }
}

/**
 * Log in a waiter using phone number + password.
 * @param {string} phone
 * @param {string} password
 * @returns {{ success: boolean, token?: string, user?: object, error?: string, isPendingApproval?: boolean }}
 */
export async function loginWaiter(phone, password) {
  try {
    const res = await fetchWithTimeout(
      `${activeBaseUrl}/api/v1/auth/waiter/login`,
      {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      },
      6000
    );

    const data = await res.json();

    if (res.ok && data.access_token) {
      setAuthToken(data.access_token);
      await saveAuthSession(data.access_token, data.user);
      if (data.user?.restaurant_id) {
        activeRestaurantId = data.user.restaurant_id;
      }
      return { success: true, token: data.access_token, user: data.user };
    }

    const detail = data.detail || data.message || 'Invalid credentials';
    return {
      success: false,
      error: detail,
      isPendingApproval: res.status === 403,
    };
  } catch (err) {
    console.warn('[API] loginWaiter error:', err.message);
    return { success: false, error: 'Network error: ' + err.message };
  }
}

/**
 * Self-register a new waiter account.
 * Waiters register with Name, Phone, and Password.
 * Account starts in PENDING status until approved and assigned to a hotel by admin.
 *
 * @param {string} name
 * @param {string} phone
 * @param {string} password
 * @param {string} confirmPassword
 */
export async function registerWaiter(name, phone, password, confirmPassword) {
  try {
    const res = await fetchWithTimeout(
      `${activeBaseUrl}/api/v1/auth/waiter/register`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      },
      6000
    );

    const data = await res.json();

    if (res.ok) {
      return {
        success: true,
        message: data.message || 'Registration successful! Your account is pending admin approval.',
        status: data.status,
      };
    }

    const detail = data.detail || data.message || 'Registration failed';
    return { success: false, error: detail };
  } catch (err) {
    console.warn('[API] registerWaiter error:', err.message);
    return { success: false, error: 'Network error: ' + err.message };
  }
}

/**
 * Verify current session with the backend using the stored auth token.
 * Returns the fresh user profile or null if token is invalid/expired.
 */
export async function verifyCurrentSession() {
  try {
    if (!authToken) return null;
    const res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/auth/me`, {}, 4000);
    if (res.ok) {
      const user = await res.json();
      if (user.restaurant_id) {
        activeRestaurantId = user.restaurant_id;
      }
      return user;
    }
  } catch (err) {
    console.warn('[API] verifyCurrentSession error:', err.message);
  }
  return null;
}

/**
 * Explicit logout — clears in-memory auth token and persistent storage.
 */
export async function logoutUser() {
  setAuthToken(null);
  await clearAuthSession();
}


/**
 * Clean up category names
 */
function cleanCategoryName(rawName) {
  if (!rawName) return 'General';
  let name = rawName
    .replace(/\s*\(Mugalivakkam\)/i, '')
    .replace(/^mugalivakkam_/i, '')
    .replace(/Varities/i, 'Varieties')
    .trim();
  if (name.toLowerCase() === 'all') return 'General';
  return name;
}

/**
 * Fetch categories for the current restaurant
 */
export async function fetchCategories(restaurantId = activeRestaurantId) {
  const targetId = restaurantId || activeRestaurantId;
  try {
    let res = null;
    if (authToken) {
      res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/menu/categories?restaurant_id=${targetId}`);
    }
    if (!res || !res.ok) {
      res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/public/menu/categories?restaurant_id=${targetId}`);
    }
    if (!res || !res.ok) {
      res = await fetchWithTimeout(`${activeBaseUrl}/api/categories?restaurant_id=${targetId}`);
    }

    if (res && res.ok) {
      const data = await res.json();
      const cleaned = data
        .filter(c => !c.restaurant_id || c.restaurant_id === targetId)
        .map(c => cleanCategoryName(c.name))
        .filter(name => Boolean(name) && name.toLowerCase() !== 'all');
      const uniqueNames = Array.from(new Set(cleaned));
      return ['All', ...uniqueNames];
    }
  } catch (err) {
    console.warn('[API] Could not fetch categories from backend:', err.message);
  }
  return null;
}

/**
 * Fetch menu items for the current restaurant
 */
export async function fetchMenuItems(restaurantId = activeRestaurantId) {
  const targetId = restaurantId || activeRestaurantId;
  try {
    let res = null;
    if (authToken) {
      res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/menu/items?restaurant_id=${targetId}`);
    }
    if (!res || !res.ok) {
      res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/public/menu/items?restaurant_id=${targetId}`);
    }
    if (!res || !res.ok) {
      res = await fetchWithTimeout(`${activeBaseUrl}/api/items?restaurant_id=${targetId}`);
    }

    if (res && res.ok) {
      const rawItems = await res.json();
      
      // Also fetch categories to map category names properly
      const catRes = await fetchWithTimeout(
        `${activeBaseUrl}/api/v1/public/menu/categories?restaurant_id=${targetId}`
      ).catch(() => null);
      let catMap = {};
      if (catRes && catRes.ok) {
        const cats = await catRes.json();
        cats.forEach(c => {
          catMap[c.id] = cleanCategoryName(c.name);
        });
      }

      // STRICT ISOLATION: Guarantee no items from other restaurants leak in
      const isolatedItems = Array.isArray(rawItems)
        ? rawItems.filter(item => !item.restaurant_id || item.restaurant_id === targetId)
        : [];

      const items = isolatedItems.map(item => {
        const categoryName = catMap[item.category_id] || (item.category ? cleanCategoryName(item.category.name) : null) || 'General';
        const isVeg = item.ac_type !== 'Non-Veg';

        return {
          id: item.id,
          restaurant_id: targetId,
          code: item.item_code ? String(item.item_code).trim() : `C${item.id}`,
          name: (item.name || 'Unnamed Item').trim(),
          category: categoryName,
          price: parseFloat(item.price) || 0,
          isVeg: isVeg,
          imageUrl: item.image_url,
          isAvailable: item.is_available !== false,
        };
      });

      // Sort alphabetically by name
      items.sort((a, b) => a.name.localeCompare(b.name));
      return items;
    }
  } catch (err) {
    console.warn('[API] Could not fetch menu items from backend:', err.message);
  }
  return null;
}

/**
 * Place a new cashier order in the backend database.
 * Used for dine-in orders with table number.
 */
export async function placeOrder({
  restaurantId,
  customerPhone,
  cartItems,
  paymentMethod = 'Cash',
  subtotal,
  totalAmount,
  orderType = 'DINE_IN',
  tableNumber = '',
  billNo,
}) {
  const cartList = Object.values(cartItems);
  const effectiveRestId = restaurantId || activeRestaurantId;

  // 1. If staff/waiter is authenticated, use the dedicated POS order endpoint (/api/v1/orders)
  if (authToken) {
    try {
      const posPayload = {
        table_number: tableNumber || 'TB 1',
        order_type: orderType || 'DINE_IN',
        payment_method: paymentMethod || 'Pay at Counter',
        cart: cartList.map(item => ({
          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id).replace(/\D/g, '')) || 1,
          quantity: item.quantity,
          price: item.price,
        })),
        total_amount: totalAmount,
        bill_no: billNo || null,
        customer_phone: (customerPhone || '').trim() || null,
      };

      const res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/orders?restaurant_id=${effectiveRestId}`, {
        method: 'POST',
        body: JSON.stringify(posPayload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        return {
          success: true,
          orderId: data.branch_order_id ? `#${data.branch_order_id}` : (data.orderId ? `ORD-${data.orderId}` : 'Success'),
          dbOrderId: data.orderId,
          branchOrderId: data.branch_order_id,
          billNo: data.bill_no,
          totalAmount: totalAmount,
          status: 'PENDING',
          message: data.message || 'Order placed successfully and sent to Kitchen (KOT)',
        };
      }
    } catch (posErr) {
      console.warn('[API] /api/v1/orders failed, attempting fallback to /api/orders:', posErr.message);
    }
  }

  // 2. Fallback to /api/orders
  const payload = {
    phone: (customerPhone || '').trim(),
    table_number: tableNumber || 'TB 1',
    order_type: orderType,
    payment_method: paymentMethod,
    cart: cartList.map(item => ({
      id: typeof item.id === 'number' ? item.id : parseInt(String(item.id).replace(/\D/g, '')) || 1,
      quantity: item.quantity,
      price: item.price,
    })),
    subtotal: subtotal || totalAmount,
    total_amount: totalAmount,
    bill_no: billNo,
    customer_phone: (customerPhone || '').trim(),
  };

  try {
    const res = await fetchWithTimeout(`${activeBaseUrl}/api/orders?restaurant_id=${effectiveRestId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      
      return {
        success: true,
        orderId: data.orderId || `ORD-${data.dbOrderId}`,
        dbOrderId: data.dbOrderId,
        totalAmount: data.totalAmount || totalAmount,
        status: data.status || 'PENDING',
        message: data.message || 'Order placed successfully and sent to Kitchen (KOT)',
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server responded with ${res.status}`);
    }
  } catch (err) {
    console.error('[API] Order placement error:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Fetch all tables for the current restaurant.
 * Falls back to an unauthenticated public approach on 401, since the
 * cashier may not always have a token saved.
 */
export async function fetchTables(restaurantId = activeRestaurantId) {
  const targetId = restaurantId || activeRestaurantId;
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetchWithTimeout(
      `${activeBaseUrl}/api/v1/tables?restaurant_id=${targetId}`,
      { headers },
      5000
    );

    if (res.ok) {
      const tables = await res.json();
      // Strictly filter to this restaurant's tables
      const filtered = (Array.isArray(tables) ? tables : []).filter(
        t => !t.restaurant_id || t.restaurant_id === targetId
      );
      // Sort by table_number numerically where possible
      filtered.sort((a, b) => {
        const na = parseInt(String(a.table_number).replace(/\D/g, '')) || 0;
        const nb = parseInt(String(b.table_number).replace(/\D/g, '')) || 0;
        return na - nb || String(a.table_number).localeCompare(String(b.table_number));
      });
      return filtered;
    } else if (res.status === 401 || res.status === 403) {
      return [];
    }
  } catch (_err) {
    // Silent fallback
  }
  return [];
}

/**
 * Place a DINE_IN order for a single customer at a specific table.
 * Used by the multi-customer billing flow (TableBillingModal).
 *
 * @param {object} params
 * @param {string} params.customerPhone  — 10-digit phone
 * @param {object} params.cartItems      — { [id]: { id, name, price, quantity } }
 * @param {string} params.tableNumber    — table_number string, e.g. "T-4" or "5"
 * @param {string} params.paymentMethod  — 'Cash' | 'Upi' | 'Card'
 * @param {number} params.totalAmount    — total bill amount
 * @param {number} params.restaurantId
 * @returns {{ success, orderId, dbOrderId, error }}
 */
export async function placeOrderForTable({
  restaurantId = activeRestaurantId,
  customerPhone,
  cartItems,
  tableNumber,
  paymentMethod = 'Pay at Counter',
  totalAmount,
}) {
  return placeOrder({
    restaurantId,
    customerPhone,
    cartItems,
    paymentMethod,
    totalAmount,
    subtotal: totalAmount,
    orderType: 'DINE_IN',
    tableNumber: tableNumber || 'TB 1',
  });
}

/**
 * Fetch live order status from the backend.
 * Uses public endpoint /api/v1/public/orders/{id} so waiters can track
 * real-time status transitions: PENDING -> PREPARING -> READY -> SERVED.
 *
 * @param {number|string} orderId
 * @returns {object|null} { id, orderId, table_number, status, payment_status, total_amount, ... }
 */
export async function fetchOrderStatus(orderId) {
  try {
    const cleanId = String(orderId).replace(/\D/g, '') || orderId;
    const res = await fetchWithTimeout(`${activeBaseUrl}/api/v1/public/orders/${cleanId}`, {}, 4000);
    if (res.ok) {
      const data = await res.json();
      return data.order || null;
    }
  } catch (err) {
    console.warn('[API] fetchOrderStatus error:', err.message);
  }
  return null;
}

/**
 * Settle bill / payment for an order when customer finishes meal.
 * Sets payment_status = Paid and frees up table if completed.
 *
 * @param {number|string} orderId
 * @param {string} paymentMethod — 'Cash' | 'UPI' | 'Card'
 * @param {number} amountPaid
 */
export async function settleOrderPayment(orderId, paymentMethod = 'Cash', amountPaid) {
  try {
    const cleanId = String(orderId).replace(/\D/g, '') || orderId;
    const res = await fetchWithTimeout(
      `${activeBaseUrl}/api/orders/${cleanId}/settle-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method: paymentMethod,
          amount_paid: amountPaid,
        }),
      },
      5000
    );
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[API] settleOrderPayment error:', err.message);
  }
  return null;
}

/**
 * Fetch live orders for the assigned restaurant.
 * Strictly scoped to the authenticated user's hotel.
 *
 * @param {number} restaurantId
 * @returns {Promise<Array>} List of live order objects
 */
export async function fetchLiveOrders(restaurantId = activeRestaurantId) {
  try {
    const res = await fetchWithTimeout(
      `${activeBaseUrl}/api/v1/orders/live?restaurant_id=${restaurantId}`,
      {},
      5000
    );
    if (res.ok) {
      return await res.json();
    }
    console.warn('[API] fetchLiveOrders status:', res.status);
    return [];
  } catch (err) {
    console.warn('[API] fetchLiveOrders error:', err.message);
    return [];
  }
}


