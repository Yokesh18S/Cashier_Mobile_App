/**
 * WhatsApp Cloud API & Direct Messaging Service for Cashier Mobile App
 *
 * Supports:
 * 1. Backend-Powered Meta WhatsApp Cloud API (Automated background sending with PDF attachment)
 * 2. Approved Meta Utility Template: dataudipi_restaurant_customer_reciept (with attached PDF)
 * 3. WhatsApp Direct App Integration (1-tap fallback via whatsapp://send and https://wa.me)
 * 4. Beautiful, professional bill receipt formatting with full itemization
 */

import { Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  sendWhatsAppBillBundleDirect,
  testWhatsAppTemplateBackend,
  getActiveBaseUrl,
} from './api';

// Public non-sensitive metadata for UI display
export const DEFAULT_PHONE_NUMBER_ID = '1384337098100833';
export const DEFAULT_SENDER_NUMBER = '+1 (555) 146-7518';
export const DEFAULT_WABA_ID = '1129207600021722';
export const DEFAULT_TEMPLATE_NAME = 'data_udipi_reciept';

const STORAGE_KEYS = {
  AUTO_SEND: 'whatsapp_auto_send',
  DEFAULT_COUNTRY: 'whatsapp_default_country',
};

// In-memory cache for fast access
let cachedConfig = {
  autoSend: true,
  defaultCountry: '91',
};

async function isSecureStoreAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    if (typeof SecureStore.isAvailableAsync === 'function') {
      return await SecureStore.isAvailableAsync();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Load WhatsApp configuration from secure storage.
 */
export async function getWhatsAppConfig() {
  try {
    const isAvailable = await isSecureStoreAvailable();
    if (isAvailable) {
      const storedAutoSend = await SecureStore.getItemAsync(STORAGE_KEYS.AUTO_SEND);
      const storedCountry = await SecureStore.getItemAsync(STORAGE_KEYS.DEFAULT_COUNTRY);

      cachedConfig = {
        autoSend: storedAutoSend !== null ? storedAutoSend === 'true' : true,
        defaultCountry: storedCountry || '91',
      };
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const storedAutoSend = window.localStorage.getItem(STORAGE_KEYS.AUTO_SEND);

      cachedConfig = {
        autoSend: storedAutoSend !== null ? storedAutoSend === 'true' : true,
        defaultCountry: window.localStorage.getItem(STORAGE_KEYS.DEFAULT_COUNTRY) || '91',
      };
    }
  } catch (err) {
    console.warn('[WhatsApp] Failed to read stored config:', err);
  }
  return { ...cachedConfig };
}

/**
 * Save updated WhatsApp settings.
 */
export async function saveWhatsAppConfig({ autoSend, defaultCountry }) {
  try {
    const isAvailable = await isSecureStoreAvailable();
    const newAutoSend = autoSend !== undefined ? Boolean(autoSend) : cachedConfig.autoSend;
    const newCountry = defaultCountry !== undefined ? defaultCountry : cachedConfig.defaultCountry;

    cachedConfig = {
      autoSend: newAutoSend,
      defaultCountry: newCountry,
    };

    if (isAvailable) {
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTO_SEND, String(newAutoSend));
      await SecureStore.setItemAsync(STORAGE_KEYS.DEFAULT_COUNTRY, newCountry || '91');
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.AUTO_SEND, String(newAutoSend));
      window.localStorage.setItem(STORAGE_KEYS.DEFAULT_COUNTRY, newCountry || '91');
    }
    return true;
  } catch (err) {
    console.warn('[WhatsApp] Failed to save config:', err);
    return false;
  }
}

/**
 * Normalizes phone numbers to standard international format (no +, no spaces).
 * Default country is India (+91) for 10-digit mobile numbers.
 */
export function normalizeWhatsAppPhone(phone, defaultCountry = '91') {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;

  if (cleaned.length === 10) {
    return `${defaultCountry}${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${defaultCountry}${cleaned.slice(1)}`;
  }
  if (cleaned.length >= 11) {
    return cleaned;
  }
  return cleaned;
}

/**
 * Formats a clean, professional, readable bill receipt text for WhatsApp.
 */
export function formatBillReceiptText({
  restaurantName = 'DATA UDIPI',
  tableNumber = '',
  customerName = 'Guest',
  customerPhone = '',
  billNo = '',
  orderId = '',
  items = [],
  subtotal = 0,
  tax = 0,
  discount = 0,
  totalAmount = 0,
  paymentMethod = 'Cash',
  date = new Date(),
}) {
  const formattedDate = date instanceof Date
    ? date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : String(date);

  const cleanTotal = (parseFloat(totalAmount) || 0).toFixed(2);
  const cleanSubtotal = (parseFloat(subtotal) || parseFloat(totalAmount) || 0).toFixed(2);
  const cleanTax = (parseFloat(tax) || 0).toFixed(2);
  const cleanDiscount = (parseFloat(discount) || 0).toFixed(2);

  const lines = [
    `🧾 *${restaurantName.toUpperCase()}*`,
    `*TAX INVOICE / CASH BILL*`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (tableNumber) {
    const tblLabel = String(tableNumber).toUpperCase().startsWith('T')
      ? tableNumber
      : `Table ${tableNumber}`;
    lines.push(`🍽️ *Table:* ${tblLabel}`);
  }

  if (customerPhone) {
    lines.push(`👤 *Customer:* ${customerName} (+91 ${String(customerPhone).replace(/\D/g, '').slice(-10)})`);
  }

  lines.push(`📅 *Date:* ${formattedDate}`);

  if (billNo) {
    lines.push(`🔢 *Bill No:* #${billNo}`);
  } else if (orderId) {
    lines.push(`🔢 *Ref ID:* ${orderId}`);
  }

  lines.push(`💳 *Payment:* ${String(paymentMethod).toUpperCase()} (PAID ✅)`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*ITEMS ORDERED:*`);

  if (Array.isArray(items) && items.length > 0) {
    items.forEach((it) => {
      if (!it) return;
      const name = it.name || it.item_name || 'Item';
      const qty = it.quantity || it.qty || 1;
      const price = parseFloat(it.price) || 0;
      const itemTotal = (price * qty).toFixed(2);
      lines.push(`• ${qty}× ${name} — ₹${itemTotal}`);
    });
  } else {
    lines.push(`• Dine-In Order Services — ₹${cleanTotal}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*Subtotal:* ₹${cleanSubtotal}`);
  if (parseFloat(cleanDiscount) > 0) {
    lines.push(`*Discount:* -₹${cleanDiscount}`);
  }
  lines.push(`*Taxes & Charges (0%):* ₹${cleanTax}`);
  lines.push(`*TOTAL PAID:* *₹${cleanTotal}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🙏 *Thank you for dining with us!*`);
  lines.push(`Please visit ${restaurantName} again soon.`);

  return lines.join('\n');
}

/**
 * Open WhatsApp directly on cashier's phone (App or Web) with the pre-filled bill message.
 * 100% reliable 1-tap fallback.
 */
export async function openWhatsAppDirect(phone, messageText) {
  const normalizedPhone = normalizeWhatsAppPhone(phone, cachedConfig.defaultCountry);
  if (!normalizedPhone) {
    throw new Error('Please provide a valid 10-digit mobile number for WhatsApp.');
  }

  const encodedText = encodeURIComponent(messageText);
  const nativeUrl = `whatsapp://send?phone=${normalizedPhone}&text=${encodedText}`;
  const webUrl = `https://wa.me/${normalizedPhone}?text=${encodedText}`;

  try {
    const canOpenNative = await Linking.canOpenURL(nativeUrl).catch(() => false);
    if (canOpenNative) {
      await Linking.openURL(nativeUrl);
      return { success: true, method: 'whatsapp_app' };
    }
  } catch (err) {
    console.warn('[WhatsApp] Could not open native WhatsApp app:', err);
  }

  // Fallback to web link (wa.me)
  try {
    await Linking.openURL(webUrl);
    return { success: true, method: 'whatsapp_web' };
  } catch (webErr) {
    console.error('[WhatsApp] Could not open wa.me link:', webErr);
    throw new Error('Could not open WhatsApp on this device.');
  }
}

/**
 * Opens WhatsApp chat with the Meta Sandbox Test Number (+1 555 146-7518)
 * and sends "Hi" to activate the 24-hour delivery window.
 */
export async function openTestNumberChat() {
  const cleanTestNumber = '15551467518';
  const url = `https://wa.me/${cleanTestNumber}?text=Hi`;
  try {
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('[WhatsApp] Could not open test number chat:', err);
    return false;
  }
}

/**
 * Master Bill Sender
 * Coordinates sending the bill:
 * 1. Generates the actual final bill PDF in the backend.
 * 2. Uploads the PDF to Meta's WhatsApp Media API.
 * 3. Sends the approved Utility Template (dataudipi_restaurant_customer_reciept)
 *    with the exact generated PDF attached directly in its DOCUMENT header.
 * 4. Returns delivery confirmation + PDF viewing link + 1-tap direct fallback.
 */
export async function sendWhatsAppBill(billData, { forceDirectApp = false } = {}) {
  await getWhatsAppConfig();

  const phone = billData.customerPhone || billData.phone;
  const billText = formatBillReceiptText(billData);

  if (!phone || String(phone).trim() === '' || String(phone) === '0000000000') {
    return {
      success: false,
      error: 'No customer phone number provided.',
      billText,
      noPhone: true,
    };
  }

  // If cashier explicitly requested direct WhatsApp app opening
  if (forceDirectApp) {
    try {
      const directRes = await openWhatsAppDirect(phone, billText);
      return {
        success: true,
        method: directRes.method,
        billText,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        billText,
      };
    }
  }

  // Primary: Dispatch Complete Template + Attached PDF Bundle via Backend
  try {
    const bundleRes = await sendWhatsAppBillBundleDirect(
      billData,
      phone,
      billData.orderId || billData.dbOrderId
    );

    if (bundleRes && bundleRes.success) {
      const fullPdfUrl = bundleRes.pdf_url
        ? `${getActiveBaseUrl()}${bundleRes.pdf_url}`
        : null;

      return {
        success: true,
        method: 'template_pdf_bundle',
        templateName: bundleRes.template_name || DEFAULT_TEMPLATE_NAME,
        messageId: bundleRes.message_id,
        phone: bundleRes.phone || phone,
        pdfUrl: fullPdfUrl,
        filename: bundleRes.filename,
        billText: bundleRes.bill_text || billText,
      };
    }

    if (bundleRes && !bundleRes.success) {
      return {
        success: false,
        error: bundleRes.error || 'Failed to dispatch WhatsApp PDF invoice',
        canFallbackToDirect: true,
        billText,
        phone,
      };
    }
  } catch (err) {
    console.warn('[WhatsApp] Backend bundle send failed:', err.message);
  }

  return {
    success: false,
    error: 'Could not connect to WhatsApp billing service. Tap "Send via WhatsApp App" below.',
    canFallbackToDirect: true,
    billText,
    phone,
  };
}

/**
 * Test approved WhatsApp Meta Template with attached PDF
 */
export async function sendWhatsAppTestTemplate(phone) {
  return await testWhatsAppTemplateBackend(phone);
}
