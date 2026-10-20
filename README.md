# Counter POS - Cashier Mobile App

A React Native mobile application for restaurant cashier counters, built with Expo. Designed and optimized for responsiveness across all smartphone screens (iOS and Android).

## Features & Screen Layouts

1. **Header & Shift Session**:
   - Terminal identifier (`Counter – Cashier · Terminal 01`)
   - Active session badge (`Active Session: POS-4402`)
   - Current date & live cart counter
   - Interactive Cash Drawer & shift revenue modal (`cash-register` button)

2. **Mandatory Customer Phone Number** *(User Requirement)*:
   - Dedicated, prominent phone card on the first page
   - Format: `+91` 10-digit mobile number input
   - Instant validation badge (`MANDATORY *` -> `Verified ✓`)
   - Prevents charging/checkout if phone number is missing, directing cashier attention immediately
   - Used for digital receipts and kitchen order token (KOT) alerts

3. **Fast Navigation & Item Addition**:
   - Segmented tabs: `Items` and `Current order (N)`
   - Fast Code Adder: Enter item code (e.g. `R01`, `R02`, `N02`, `B02`) and tap **Add**
   - Real-time search filter by item name or code
   - Category pill filters: `All`, `Fried Rice`, `Noodles`, `Biryani`, `Starters`, `Drinks`
   - Item row with diet indicator (veg/non-veg), code, price, and instant quantity feedback

4. **Current Order Tab & Bottom Cart Drawer**:
   - Line and item counter (`N lines · N items`)
   - Quantity stepper controls (`[-]  qty  [+]`)
   - Real-time calculation: Subtotal, Tax (8%), and Total
   - Clear order option with confirmation safeguard
   - Primary `Charge R.S.XX` action button

5. **Complete Payment Flow**:
   - **Payment Modal**: Displays large amount due card
   - **Payment Methods**: `Cash`, `UPI / QR`, `Card`
   - **Cash Tendered**: Real-time change calculation with quick denomination suggestion chips
   - **UPI / QR**: Live QR code simulator with UPI app shortcuts (GPay, PhonePe, Paytm, BHIM)
   - **Card**: POS reader tap/insert prompt
   - **Processing Screen**: Radial loader spinner with "Processing payment... Please wait"
   - **Success & Receipt Screen**:
     - Receipt Token: `POS-4402-XXXX`
     - Customer mobile confirmation
     - Print receipt action
     - "New Order" reset button for immediate next transaction

## How to Run the App

### Prerequisites
- Node.js installed

### Start Dev Server
Inside `Cashier_Mobile_App`:
```bash
npx expo start
```
or
```bash
.\node_modules\.bin\expo start
```

### Run on your Phone
1. Install **Expo Go** from Google Play Store or Apple App Store.
2. Scan the QR code displayed in the terminal.
3. The cashier app will load instantly on your phone with live reloading enabled!
