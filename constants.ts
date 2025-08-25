
import { StoreSettings, Language } from './types';

// --- Firebase Configuration ---
// This configuration is now set up to connect to your Firebase project.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB55YITgXyJtGqQUBj1uXlu141uIeITlIY",
  authDomain: "sales-and-expense-management.firebaseapp.com",
  databaseURL: "https://sales-and-expense-management-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sales-and-expense-management",
  storageBucket: "sales-and-expense-management.appspot.com",
  messagingSenderId: "708012781693",
  appId: "1:708012781693:web:c9c5a73a9e3c1e5d268114"
};

export const APP_NAME = "NBD Shop POS";
export const VAT_RATE = 0.07; // 7% VAT, adjust as needed for Sales POS

export const UI_COLORS = {
  primary: '#9C27B0', // Purple
  secondary: '#2196F3', // Blue
  accent: '#FFC107', // Amber for highlights
  textPrimary: '#212121',
  textSecondary: '#757575',
  backgroundLight: '#FFFFFF',
  backgroundDark: '#f0f2f5', // Main app background
  danger: '#F44336', // Red
  success: '#4CAF50', // Green
  warning: '#FF9800', // Orange
  info: '#00BCD4', // Cyan
  // Chart specific colors or more palette options
  chartBlue: '#2196F3',
  chartGreen: '#4CAF50',
  chartPurple: '#9C27B0',
  chartOrange: '#FF9800',
  chartRed: '#F44336',
  chartTeal: '#009688',
  chartPink: '#E91E63',
  chartIndigo: '#3F51B5',
};

export const DEFAULT_LANGUAGE = 'lo';

export const DEFAULT_PRODUCT_CATEGORIES = ["ເຄື່ອງດື່ມ", "ຂະໜົມ", "ຂອງໃຊ້ສ່ວນຕົວ", "ເຄື່ອງຂຽນ", "ອື່ນໆ"]; // Lao Categories
export const EXPENSE_CATEGORIES = ["ຄ່າເຊົ່າ", "ຄ່າສິນຄ້າ", "ຄ່າເດີນທາງ", "ຄ່າການຕະຫຼາດ", "ຄ່າສາທາລະນຸປະໂພກ", "ອື່ນໆ"]; // Lao Categories

export const ACCOUNTING_EXPENSE_CATEGORIES = [
  { code: 1, labelKey: 'accountingCategory_cost' }, // ต้นทุน
  { code: 2, labelKey: 'accountingCategory_selling' }, // ค่าใช้จ่ายในการจำหน่าย
  { code: 3, labelKey: 'accountingCategory_admin' }, // ค่าใช้จ่ายในการบริหาร
];

export const CUSTOMER_TYPES = [
  { value: 'cash', labelKey: 'customerTypeCash' },
  { value: 'credit', labelKey: 'customerTypeCredit' },
];

export const SALES_CHANNELS = [
  { value: 'storefront', labelKey: 'salesChannelStorefront' },
  { value: 'line', labelKey: 'salesChannelLine' },
  { value: 'facebook', labelKey: 'salesChannelFacebook' },
  { value: 'phone', labelKey: 'salesChannelPhone' },
  { value: 'other', labelKey: 'salesChannelOther' },
];

export const VAT_STRATEGIES = [
  { value: 'none', labelKey: 'vatStrategyNone' },      // ບໍ່ມີ VAT
  { value: 'add', labelKey: 'vatStrategyAdd' },       // VAT ເພີ່ມຈາກຍອດ
  { value: 'included', labelKey: 'vatStrategyIncluded' } // VAT ລວມໃນລາຄາແລ້ວ
];

export const PAYMENT_METHODS_OPTIONS = [
  { value: 'cash', labelKey: 'paymentCash' },
  { value: 'qr', labelKey: 'paymentQR' },
  { value: 'transfer', labelKey: 'paymentTransfer' },
  { value: 'credit_card', labelKey: 'paymentCreditCard' },
  { value: 'credit', labelKey: 'paymentCreditSaleType' }, // Added new credit payment type
];

export const PURCHASE_PAYMENT_METHODS_OPTIONS = [
  { value: 'credit', labelKey: 'paymentMethodCredit' },
  { value: 'cash', labelKey: 'paymentMethodCash' },
  { value: 'transfer', labelKey: 'paymentMethodTransfer' },
];

export const PURCHASE_CATEGORIES = ["ສັ່ງຈາກຜູ້ສະໜອງ", "ຊື້ອອນລາຍ", "ຊື້ໜ้าร้าน/ตลาด", "ອື່ນໆ"]; // Lao Categories

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "ຊື່ຮ້ານຄ້າ (ຕົວຢ່າງ)",
  address: "ທີ່ຢູ່ຮ້ານຄ້າ (ຕົວຢ່າງ)",
  phone: "020-123-4567", 
  taxId: "ເລກປະຈຳຕົວຜູ້ເສຍພາສີ (ຕົວຢ່າງ)",
  logoUrl: "",
  qrPaymentUrl: "",
  footerNote: "ຂອບໃຈທີ່ໃຊ້ບໍລິການ",
  defaultLanguage: Language.LO,
  defaultVatRateForPO: 7, // Default 7% VAT for Purchase Orders
};

export const PO_STATUSES = [
  { value: 'pending', labelKey: 'statusPendingPO', className: 'bg-gray-200 text-gray-800', baseColor: 'gray' },
  { value: 'partial', labelKey: 'statusPartialReceiptPO', className: 'bg-orange-200 text-orange-800', baseColor: 'orange' },
  { value: 'received', labelKey: 'statusReceivedFullPO', className: 'bg-green-200 text-green-800', baseColor: 'green' },
];


// --- IMPORTANT: PDF FONT DATA ---
// For Lao and Thai text to render correctly in PDFs, you MUST replace the placeholder strings
// (e.g., NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER, NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER)
// with the actual Base64 encoded content of your .ttf font files.
//
// Example for Lao: Noto Sans Lao or Phetsarath OT.
// Example for Thai: Noto Sans Thai.
// Online tools can convert .ttf files to Base64 strings.
//
// These constants are defined directly WITHIN the respective .tsx files where PDF generation occurs:
// - components/pos/POSPage.tsx
// - components/salesHistory/SalesHistoryPage.tsx
// - components/creditTracking/CreditTrackingPage.tsx
// - components/reports/ProfitLossPage.tsx
//
// FAILURE TO REPLACE THESE PLACEHOLDERS WILL RESULT IN GARBLED LAO/THAI TEXT IN PDFs.
// The application will attempt to fall back to Helvetica, which does not support these scripts.
//
// The application code checks if the font data string starts with "PLACEHOLDER_"
// and will warn in the console if it attempts to use it without replacement.
// This global comment serves as a high-level reminder of this CRITICAL step.
//
// To get Base64 data for a .ttf font:
// 1. Download the .ttf file (e.g., NotoSansLao-Regular.ttf from Google Fonts).
// 2. Use an online TTF to Base64 converter, or a command-line tool like:
//    base64 -w 0 NotoSansLao-Regular.ttf > noto_sans_lao_base64.txt
//    (For Windows, you might need `certutil -encodehex -f NotoSansLao-Regular.ttf temp.hex && certutil -decodehex temp.hex noto_sans_lao_base64.txt` or use WSL's base64)
// 3. Copy the entire Base64 string from the output file.
// 4. In the relevant .tsx file, replace the placeholder string with this copied Base64 string.
//    Example inside a .tsx file:
//    const NOTO_SANS_LAO_REGULAR_TTF_BASE64 = "AAEAAAAPAIAAAwBwRkZUTWFk.... (very long string) ..."; // Actual Base64 data here
// --- END IMPORTANT PDF FONT DATA INSTRUCTIONS ---
