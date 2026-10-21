import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { COLORS } from './src/constants/theme';
import { INITIAL_MENU_ITEMS, CATEGORIES as DEFAULT_CATEGORIES } from './src/data/mockData';

// Navigation screens
import LoginScreen from './src/components/LoginScreen';
import TableSelectionScreen from './src/components/TableSelectionScreen';
import CustomerListScreen from './src/components/CustomerListScreen';
import TableBillingModal from './src/components/TableBillingModal';
import ActiveCustomerOrderScreen from './src/components/ActiveCustomerOrderScreen';
import CustomerBillingModal from './src/components/CustomerBillingModal';
import LiveOrdersScreen from './src/components/LiveOrdersScreen';

// Ordering UI components
import Header from './src/components/Header';
import TabBar from './src/components/TabBar';
import CodeAddBar from './src/components/CodeAddBar';
import SearchBar from './src/components/SearchBar';
import CategoryChips from './src/components/CategoryChips';
import ItemList from './src/components/ItemList';
import OrderView from './src/components/OrderView';
import BottomOrderBar from './src/components/BottomOrderBar';
import ServerConfigModal from './src/components/ServerConfigModal';

import {
  checkBackendHealth,
  fetchCategories,
  fetchMenuItems,
  placeOrder,
  placeOrderForTable,
  fetchOrderStatus,
  settleOrderPayment,
  getActiveBaseUrl,
  setAuthToken,
  setActiveRestaurantId,
  verifyCurrentSession,
  logoutUser,
} from './src/services/api';
import { getAuthSession } from './src/services/storage';

/**
 * App Navigation Screens
 *
 *  'table_select'  – Table grid (select a table or Takeaway)
 *  'customer_list' – Per-table customer list (add customers, tap to order)
 *  'ordering'      – Full ordering screen for one customer at a table
 *
 * For Takeaway, the flow skips straight to 'ordering' with
 * activeTable=null, activeCustomer=null (legacy single-customer mode).
 */

// Generates a stable unique ID for a customer slot
let _cid = 1;
const makeCustomerId = () => String(_cid++);

export default function App() {
  // ── MENU & BACKEND ──────────────────────────────────────────────────
  const [menuItems, setMenuItems] = useState(INITIAL_MENU_ITEMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendUrl, setBackendUrl] = useState(getActiveBaseUrl());
  const [activeRestaurant, setActiveRestaurant] = useState(null);

  // ── NAVIGATION ───────────────────────────────────────────────────────
  // screen: 'login' | 'table_select' | 'customer_list' | 'ordering'
  const [screen, setScreen] = useState('login');
  const [mainTab, setMainTab] = useState('tables'); // 'tables' | 'live_orders'

  // Logged-in cashier user info
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Currently selected table { id, table_number, capacity, status } or null (takeaway)
  const [activeTable, setActiveTable] = useState(null);

  // Currently active customer id (for 'ordering' screen), or null (takeaway)
  const [activeCustomerId, setActiveCustomerId] = useState(null);

  // ── MULTI-CUSTOMER TABLE STATE ────────────────────────────────────────
  // tableOrders: { [tableId]: [ { id, phone, label, cartItems:{} } ] }
  const [tableOrders, setTableOrders] = useState({});

  // ── TAKEAWAY (LEGACY SINGLE-CUSTOMER) STATE ──────────────────────────
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [cartItems, setCartItems] = useState({});

  // ── MENU FILTERS ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('items');

  // ── MODALS ────────────────────────────────────────────────────────────
  const [isCustomerBillingVisible, setIsCustomerBillingVisible] = useState(false);
  const [selectedBillingCustomer, setSelectedBillingCustomer] = useState(null);
  const [isServerConfigVisible, setIsServerConfigVisible] = useState(false);
  const [isTableBillingVisible, setIsTableBillingVisible] = useState(false);
  const [ordersHistory, setOrdersHistory] = useState([]);

  // ── BACKEND MENU LOAD ─────────────────────────────────────────────────
  const loadBackendMenu = useCallback(async (targetRestId) => {
    setIsLoadingMenu(true);
    try {
      const health = await checkBackendHealth();
      setIsBackendConnected(health.connected);
      setBackendUrl(getActiveBaseUrl());

      const effectiveRestId = targetRestId || loggedInUser?.restaurant_id || activeRestaurant?.id || getActiveRestaurantId();

      if (health.connected && health.restaurants && effectiveRestId) {
        const matching = health.restaurants.find(r => r.id === effectiveRestId);
        if (matching) {
          setActiveRestaurant(matching);
        } else if (loggedInUser?.restaurant_name) {
          setActiveRestaurant({ id: effectiveRestId, name: loggedInUser.restaurant_name });
        }
      }

      const [liveCategories, liveItems] = await Promise.all([
        fetchCategories(effectiveRestId),
        fetchMenuItems(effectiveRestId),
      ]);
      if (liveCategories && liveCategories.length > 0) setCategories(liveCategories);
      if (liveItems && liveItems.length > 0) setMenuItems(liveItems);
    } catch (err) {
      console.warn('[App] Backend check error:', err);
    } finally {
      setIsLoadingMenu(false);
    }
  }, [loggedInUser?.restaurant_id, loggedInUser?.restaurant_name, activeRestaurant?.id]);

  // On mount: check backend health and restore persisted session (persistent login)
  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      try {
        const health = await checkBackendHealth();
        if (!isMounted) return;
        setIsBackendConnected(health.connected);
        setBackendUrl(getActiveBaseUrl());

        // Restore persisted login session (persists across app closes, restarts, screen lock)
        const session = await getAuthSession();
        if (session && session.token && session.user && isMounted) {
          setAuthToken(session.token);
          const restId = session.user.restaurant_id;
          if (restId) {
            setActiveRestaurantId(restId);
            const matching = (health.restaurants || []).find(r => r.id === restId);
            setActiveRestaurant(matching || { id: restId, name: session.user.restaurant_name || `Hotel #${restId}` });
          }
          setLoggedInUser(session.user);
          setScreen('table_select');
          await loadBackendMenu(restId);

          // Refresh user profile / permissions in background
          verifyCurrentSession().then(freshUser => {
            if (freshUser && isMounted) {
              setLoggedInUser(freshUser);
              if (freshUser.restaurant_id) {
                setActiveRestaurantId(freshUser.restaurant_id);
                if (health.restaurants) {
                  const m = health.restaurants.find(r => r.id === freshUser.restaurant_id);
                  if (m) setActiveRestaurant(m);
                }
              }
            }
          }).catch(() => {});
        } else if (health.connected && health.activeRestaurant) {
          setActiveRestaurant(health.activeRestaurant);
        }
      } catch (err) {
        console.warn('[App] Mount initialization error:', err);
      }
    }

    initApp();
    return () => { isMounted = false; };
  }, [loadBackendMenu]);

  // ── AUTH ───────────────────────────────────────────────────────────────
  const handleLoginSuccess = useCallback((token, user) => {
    setAuthToken(token);
    const restId = user?.restaurant_id;
    if (restId) {
      setActiveRestaurantId(restId);
      setActiveRestaurant({
        id: restId,
        name: user.restaurant_name || `Hotel #${restId}`,
      });
    }
    setLoggedInUser(user);
    // Clear old state from previous session to avoid any cross-restaurant leak
    setTableOrders({});
    setCartItems({});
    setActiveTable(null);
    setActiveCustomerId(null);
    setCategories(DEFAULT_CATEGORIES);
    setMenuItems([]);
    setMainTab('tables');
    setScreen('table_select');
    // Load menu exclusively for this assigned restaurant
    loadBackendMenu(restId);
  }, [loadBackendMenu]);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setLoggedInUser(null);
    setActiveRestaurant(null);
    setActiveTable(null);
    setActiveCustomerId(null);
    setTableOrders({});
    setCartItems({});
    setMenuItems(INITIAL_MENU_ITEMS);
    setCategories(DEFAULT_CATEGORIES);
    setPhoneNumber('');
    setMainTab('tables');
    setScreen('login');
  }, []);

  // ── COMPUTED ───────────────────────────────────────────────────────────
  // Active customer cart (table mode) or takeaway cart
  const activeCustomer = useMemo(() => {
    if (!activeTable || !activeCustomerId) return null;
    const customers = tableOrders[activeTable.id] || [];
    return customers.find(c => c.id === activeCustomerId) || null;
  }, [activeTable, activeCustomerId, tableOrders]);

  const currentCartItems = useMemo(() => {
    if (activeCustomer) return activeCustomer.cartItems || {};
    return cartItems;
  }, [activeCustomer, cartItems]);

  const cartList = Object.values(currentCartItems);
  const totalItemCount = cartList.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = totalAmount;

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        (item.category && item.category.toLowerCase() === selectedCategory.toLowerCase());
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.code && item.code.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // ── CART ACTIONS ───────────────────────────────────────────────────────
  const setCart = useCallback((updater) => {
    if (activeCustomer) {
      // Update specific customer's cart in tableOrders
      setTableOrders(prev => {
        const tableCustomers = (prev[activeTable.id] || []).map(c => {
          if (c.id !== activeCustomerId) return c;
          const newCart = typeof updater === 'function' ? updater(c.cartItems || {}) : updater;
          return { ...c, cartItems: newCart };
        });
        return { ...prev, [activeTable.id]: tableCustomers };
      });
    } else {
      // Takeaway mode
      setCartItems(updater);
    }
  }, [activeCustomer, activeTable, activeCustomerId]);

  const handleAddToCart = useCallback((item) => {
    setCart(prev => {
      const existing = prev[item.id];
      if (existing) {
        return { ...prev, [item.id]: { ...existing, quantity: existing.quantity + 1 } };
      }
      return { ...prev, [item.id]: { ...item, quantity: 1 } };
    });
  }, [setCart]);

  const handleAddByCode = useCallback((code) => {
    const clean = String(code).trim().toUpperCase();
    const found = menuItems.find(
      item => item.code && String(item.code).trim().toUpperCase() === clean
    );
    if (found) { handleAddToCart(found); return true; }
    return false;
  }, [menuItems, handleAddToCart]);

  const handleUpdateQuantity = useCallback((itemId, newQuantity) => {
    setCart(prev => {
      if (newQuantity <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: { ...prev[itemId], quantity: newQuantity } };
    });
  }, [setCart]);

  const handleClearOrder = useCallback(() => {
    setCart({});
  }, [setCart]);

  // ── TABLE NAVIGATION ───────────────────────────────────────────────────
  const handleSelectTable = useCallback((table) => {
    setActiveTable(table);
    if (table?.restaurant_id) {
      setActiveRestaurantId(table.restaurant_id);
    }
    setScreen('customer_list');
  }, []);

  const handleBackToTables = useCallback(() => {
    setActiveTable(null);
    setActiveCustomerId(null);
    setScreen('table_select');
  }, []);

  const handleBackToCustomers = useCallback(() => {
    setActiveCustomerId(null);
    setScreen('customer_list');
  }, []);

  // ── CUSTOMER MANAGEMENT ────────────────────────────────────────────────
  const handleAddCustomer = useCallback((phone) => {
    if (!activeTable) return;
    const newCustomer = {
      id: makeCustomerId(),
      phone,
      label: `Customer ${(tableOrders[activeTable.id] || []).length + 1}`,
      cartItems: {},
    };
    setTableOrders(prev => ({
      ...prev,
      [activeTable.id]: [...(prev[activeTable.id] || []), newCustomer],
    }));
    // Immediately navigate into this customer's ordering screen
    setActiveCustomerId(newCustomer.id);
    setScreen('ordering');
    setActiveTab('items');
  }, [activeTable, tableOrders]);

  const handleSelectCustomer = useCallback((customerId) => {
    setActiveCustomerId(customerId);
    const cust = (tableOrders[activeTable?.id] || []).find(c => c.id === customerId);
    if (cust && cust.activeOrders && cust.activeOrders.length > 0) {
      setScreen('customer_active_order');
    } else {
      setScreen('ordering');
      setActiveTab('items');
    }
  }, [activeTable, tableOrders]);

  const handleAddMoreItemsForCustomer = useCallback((customerId) => {
    setActiveCustomerId(customerId);
    setScreen('ordering');
    setActiveTab('items');
  }, []);

  const handleOpenCustomerBill = useCallback((customer) => {
    setSelectedBillingCustomer(customer || activeCustomer);
    setIsCustomerBillingVisible(true);
  }, [activeCustomer]);

  // ── KOT ORDER SUBMISSION (No payment upfront, appends to running bill) ──
  const handleSendToKot = async () => {
    if (totalItemCount === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before sending to kitchen.');
      return;
    }

    try {
      const customerPhone = activeCustomer?.phone || phoneNumber || '0000000000';
      const targetRestaurantId = loggedInUser?.restaurant_id || activeRestaurant?.id || activeTable?.restaurant_id;
      const backendResult = await placeOrderForTable({
        restaurantId: targetRestaurantId,
        customerPhone,
        cartItems: currentCartItems,
        tableNumber: activeTable?.table_number,
        paymentMethod: 'Pay at Counter',
        totalAmount,
      });

      if (backendResult && backendResult.success) {
        const placedItems = Object.values(currentCartItems);
        const newOrder = {
          dbOrderId: backendResult.dbOrderId,
          orderId: backendResult.orderId,
          items: placedItems,
          totalAmount,
          status: 'PENDING',
          placedAt: new Date().toISOString(),
        };

        // Append to customer's activeOrders and clear unplaced cart
        setTableOrders(prev => {
          const tableCustomers = (prev[activeTable.id] || []).map(c =>
            c.id === activeCustomerId
              ? {
                  ...c,
                  cartItems: {},
                  activeOrders: [...(c.activeOrders || []), newOrder],
                }
              : c
          );
          return { ...prev, [activeTable.id]: tableCustomers };
        });

        // Navigate to the active customer order screen with running total
        setScreen('customer_active_order');
        Alert.alert(
          'Sent to Kitchen (KOT)',
          `Order #${backendResult.orderId || backendResult.dbOrderId} has been sent to the Kitchen!\n\nAdded to ${activeCustomer?.label || 'Customer'}'s running bill.`
        );
      } else {
        Alert.alert('Submission Error', backendResult?.error || 'Failed to submit KOT to kitchen. Please try again.');
      }
    } catch (err) {
      Alert.alert('Network Error', err.message || 'Unable to submit KOT to backend.');
    }
  };

  // ── FINAL BILL SETTLEMENT FOR A SINGLE CUSTOMER ──
  const handleConfirmCustomerSettlement = async ({ customer, method, amountPaid }) => {
    try {
      for (const ord of (customer.activeOrders || [])) {
        if (ord.dbOrderId) {
          await settleOrderPayment(ord.dbOrderId, method, ord.totalAmount);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleCustomerSettlementSuccess = (settledCustomer) => {
    setIsCustomerBillingVisible(false);
    setSelectedBillingCustomer(null);

    // Remove settled customer from active table
    setTableOrders(prev => {
      const remaining = (prev[activeTable?.id] || []).filter(c => c.id !== settledCustomer.id);
      const next = { ...prev };
      if (remaining.length === 0) {
        delete next[activeTable?.id];
      } else {
        next[activeTable?.id] = remaining;
      }
      return next;
    });

    const remainingAfter = (tableOrders[activeTable?.id] || []).filter(c => c.id !== settledCustomer.id);
    if (remainingAfter.length === 0) {
      setActiveTable(null);
      setActiveCustomerId(null);
      setScreen('table_select');
      Alert.alert('Table Cleared', `Table ${activeTable?.table_number} is now vacant and ready for new guests.`);
    } else {
      setActiveCustomerId(null);
      setScreen('customer_list');
    }
  };

  // ── LIVE KDS STATUS POLLING (Updates PENDING -> PREPARING -> READY -> SERVED) ──
  useEffect(() => {
    const activeOrderIds = [];
    Object.values(tableOrders).forEach(custList => {
      (custList || []).forEach(c => {
        (c.activeOrders || []).forEach(o => {
          if (o.dbOrderId && o.status !== 'SERVED' && o.status !== 'COMPLETED' && o.status !== 'CANCELLED') {
            activeOrderIds.push(o.dbOrderId);
          }
        });
      });
    });

    if (activeOrderIds.length === 0) return;

    let isMounted = true;
    const pollStatuses = async () => {
      const statusMap = {};
      for (const id of activeOrderIds) {
        try {
          const liveOrder = await fetchOrderStatus(id);
          if (liveOrder && liveOrder.status) {
            statusMap[id] = liveOrder.status;
          }
        } catch {
          // silent network catch
        }
      }

      if (!isMounted) return;

      setTableOrders(prev => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach(tblId => {
          const updatedCusts = (next[tblId] || []).map(cust => {
            const updatedOrds = (cust.activeOrders || []).map(ord => {
              const freshStatus = statusMap[ord.dbOrderId];
              if (freshStatus && freshStatus !== ord.status) {
                changed = true;
                return { ...ord, status: freshStatus };
              }
              return ord;
            });
            return { ...cust, activeOrders: updatedOrds };
          });
          next[tblId] = updatedCusts;
        });
        return changed ? next : prev;
      });
    };

    const interval = setInterval(pollStatuses, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [tableOrders]);

  // Table billing: settle active orders & place unplaced cart items
  const handleConfirmTablePayment = async ({ customers: billedCustomers, globalMethod }) => {
    const results = [];
    for (const customer of billedCustomers) {
      try {
        // 1. Settle all already placed active orders on backend
        for (const ord of (customer.activeOrders || [])) {
          if (ord.dbOrderId) {
            await settleOrderPayment(ord.dbOrderId, globalMethod, ord.totalAmount);
          }
        }

        // 2. If customer has unplaced items in cart, place and settle them
        if (customer.cartItems && Object.keys(customer.cartItems).length > 0) {
          const custSubtotal = Object.values(customer.cartItems).reduce(
            (s, i) => s + i.price * i.quantity, 0
          );
          const custTotal = custSubtotal;
          const targetRestaurantId = loggedInUser?.restaurant_id || activeRestaurant?.id || activeTable?.restaurant_id;
          const res = await placeOrderForTable({
            restaurantId: targetRestaurantId,
            customerPhone: customer.phone,
            cartItems: customer.cartItems,
            tableNumber: activeTable?.table_number,
            paymentMethod: globalMethod,
            totalAmount: custTotal,
          });

          if (res.dbOrderId) {
            await settleOrderPayment(res.dbOrderId, globalMethod, custTotal);
          }

          results.push({
            phone: customer.phone,
            orderId: res.orderId,
            success: res.success,
            error: res.error,
          });
        } else {
          results.push({
            phone: customer.phone,
            orderId: customer.activeOrders?.[0]?.orderId || 'Settled',
            success: true,
          });
        }
      } catch (err) {
        results.push({ phone: customer.phone, success: false, error: err.message });
      }
    }
    return results;
  };

  const handleTablePaymentSuccess = () => {
    // Clear this table's orders from local state
    if (activeTable) {
      setTableOrders(prev => {
        const copy = { ...prev };
        delete copy[activeTable.id];
        return copy;
      });
    }
    setIsTableBillingVisible(false);
    setActiveTable(null);
    setActiveCustomerId(null);
    setScreen('table_select');
  };

  // ── CONFIG ─────────────────────────────────────────────────────────────
  const handleConfigUpdated = (health) => {
    setIsBackendConnected(health.connected);
    setBackendUrl(health.url);
    if (health.activeRestaurant) setActiveRestaurant(health.activeRestaurant);
    loadBackendMenu();
  };

  const assignedHotelName = loggedInUser?.restaurant_name || activeRestaurant?.name;
  const terminalTitle = assignedHotelName
    ? `${assignedHotelName} · Terminal 01`
    : 'Counter – Cashier · Terminal 01';

  const sessionLabel = loggedInUser
    ? `${loggedInUser.name || loggedInUser.email || 'Staff'} · ${loggedInUser.role || 'CASHIER'}`
    : 'POS-4402';

  // Customers of the currently active table
  const activeTableCustomers = activeTable ? (tableOrders[activeTable.id] || []) : [];

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ExpoStatusBar style="dark" />

        {/* ── LOGIN SCREEN ── */}
        {screen === 'login' && (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            isBackendConnected={isBackendConnected}
            backendUrl={backendUrl}
          />
        )}

        {/* ── TABLE SELECTION / LIVE ORDERS SCREEN ── */}
        {screen === 'table_select' && (
          <View style={styles.container}>
            <Header
              terminalName={terminalTitle}
              sessionCode={sessionLabel}
              itemCount={0}
              isBackendConnected={isBackendConnected}
              backendUrl={backendUrl}
              onLogout={handleLogout}
              onPressStatus={() => setIsServerConfigVisible(true)}
              currentView={mainTab}
              onChangeView={(v) => setMainTab(v)}
            />
            {mainTab === 'live_orders' ? (
              <LiveOrdersScreen
                loggedInUser={loggedInUser}
                activeRestaurant={activeRestaurant}
                onGoToTables={() => setMainTab('tables')}
              />
            ) : (
              <TableSelectionScreen
                onSelectTable={handleSelectTable}
                tableOrders={tableOrders}
                activeRestaurant={activeRestaurant}
                loggedInUser={loggedInUser}
                isBackendConnected={isBackendConnected}
              />
            )}
          </View>
        )}

        {/* ── CUSTOMER LIST SCREEN ── */}
        {screen === 'customer_list' && activeTable && (
          <View style={styles.container}>
            <Header
              terminalName={terminalTitle}
              sessionCode={`TBL-${activeTable.table_number}`}
              itemCount={activeTableCustomers.reduce(
                (s, c) => s + Object.values(c.cartItems || {}).reduce((q, i) => q + i.quantity, 0), 0
              )}
              isBackendConnected={isBackendConnected}
              backendUrl={backendUrl}
              onLogout={handleLogout}
              onPressStatus={() => setIsServerConfigVisible(true)}
            />
            <CustomerListScreen
              table={activeTable}
              customers={activeTableCustomers}
              onAddCustomer={handleAddCustomer}
              onSelectCustomer={handleSelectCustomer}
              onAddMoreItems={handleAddMoreItemsForCustomer}
              onSendCustomerBill={handleOpenCustomerBill}
              onViewBill={() => setIsTableBillingVisible(true)}
              onBack={handleBackToTables}
            />

            {/* Table Billing Modal */}
            <TableBillingModal
              visible={isTableBillingVisible}
              onClose={() => setIsTableBillingVisible(false)}
              table={activeTable}
              customers={activeTableCustomers}
              onConfirmTablePayment={handleConfirmTablePayment}
              onPaymentSuccess={handleTablePaymentSuccess}
            />
          </View>
        )}

        {/* ── ACTIVE CUSTOMER ORDER & RUNNING BILL SCREEN ── */}
        {screen === 'customer_active_order' && activeTable && activeCustomer && (
          <View style={styles.container}>
            <ActiveCustomerOrderScreen
              table={activeTable}
              customer={activeCustomer}
              onAddMoreItems={() => handleAddMoreItemsForCustomer(activeCustomer.id)}
              onSendBill={() => handleOpenCustomerBill(activeCustomer)}
              onBack={() => {
                setActiveCustomerId(null);
                setScreen('customer_list');
              }}
            />
          </View>
        )}

        {/* ── ORDERING SCREEN ── */}
        {screen === 'ordering' && (
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Header
              terminalName={
                activeCustomer
                  ? `${activeTable?.table_number?.startsWith('T') ? '' : 'T'}${activeTable?.table_number || ''} · ${activeCustomer.label}`
                  : terminalTitle
              }
              sessionCode={
                activeCustomer
                  ? `C-${activeCustomer.phone}`
                  : 'POS-4402'
              }
              itemCount={totalItemCount}
              isBackendConnected={isBackendConnected}
              backendUrl={backendUrl}
              onLogout={handleLogout}
              onPressStatus={() => setIsServerConfigVisible(true)}
            />

            {/* Back button strip for dine-in mode */}
            {activeCustomer && (
              <View style={styles.breadcrumbBar}>
                <View style={styles.breadcrumb}>
                  <Text
                    style={styles.breadcrumbLink}
                    onPress={handleBackToTables}
                  >
                    Tables
                  </Text>
                  <Text style={styles.breadcrumbSep}> › </Text>
                  <Text
                    style={styles.breadcrumbLink}
                    onPress={handleBackToCustomers}
                  >
                    Table {activeTable?.table_number}
                  </Text>
                  {activeCustomer?.activeOrders?.length > 0 ? (
                    <>
                      <Text style={styles.breadcrumbSep}> › </Text>
                      <Text
                        style={styles.breadcrumbLink}
                        onPress={() => setScreen('customer_active_order')}
                      >
                        Active Bill
                      </Text>
                      <Text style={styles.breadcrumbSep}> › </Text>
                      <Text style={styles.breadcrumbCurrent}>+ Add Items</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.breadcrumbSep}> › </Text>
                      <Text style={styles.breadcrumbCurrent}>
                        {activeCustomer.label}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Navigation Tabs */}
            <TabBar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              cartItemCount={totalItemCount}
            />

            {/* Code Add Bar */}
            <CodeAddBar onAddByCode={handleAddByCode} />

            {/* Tab Views */}
            {activeTab === 'items' ? (
              <View style={styles.mainTabContent}>
                <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                <CategoryChips
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
                {isLoadingMenu ? (
                  <View style={styles.loadingBanner}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading live menu from backend...</Text>
                  </View>
                ) : null}
                <ItemList
                  items={filteredItems}
                  onAddToCart={handleAddToCart}
                  cartItems={currentCartItems}
                />
                <BottomOrderBar
                  cartItems={currentCartItems}
                  onChargePress={handleSendToKot}
                  onViewOrderPress={() => setActiveTab('order')}
                />
              </View>
            ) : (
              <OrderView
                cartItems={currentCartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onClearOrder={handleClearOrder}
                onChargePress={handleSendToKot}
              />
            )}
          </KeyboardAvoidingView>
        )}

        {/* Global Modals (available from any screen) */}
        <CustomerBillingModal
          visible={isCustomerBillingVisible}
          onClose={() => {
            setIsCustomerBillingVisible(false);
            setSelectedBillingCustomer(null);
          }}
          table={activeTable}
          customer={selectedBillingCustomer || activeCustomer}
          onConfirmSettlement={handleConfirmCustomerSettlement}
          onSettlementSuccess={handleCustomerSettlementSuccess}
        />
        <ServerConfigModal
          visible={isServerConfigVisible}
          onClose={() => setIsServerConfigVisible(false)}
          isBackendConnected={isBackendConnected}
          activeRestaurant={activeRestaurant}
          onConfigUpdated={handleConfigUpdated}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  mainTabContent: {
    flex: 1,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.chipBg,
  },
  loadingText: {
    fontSize: 11,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  breadcrumbBar: {
    backgroundColor: COLORS.chipBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbLink: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
  },
  breadcrumbSep: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 1,
  },
  breadcrumbCurrent: {
    fontSize: 12,
    color: COLORS.textDark,
    fontWeight: '700',
  },
});
