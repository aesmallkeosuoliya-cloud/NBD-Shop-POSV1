
import { StoreSettings, Language, Permission, InternalUserRole } from './types';

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

export const DEFAULT_PRODUCT_CATEGORIES = ["เครื่องดื่่ม", "ขะหนม", "ของใช้ส่วนตัว", "เครื่องเขียน", "อื่นๆ"]; // Lao Categories
export const EXPENSE_CATEGORIES = ["ค่าเช่า", "ค่าสินค้า", "ค่าเดินทาง", "ค่าการตลาด", "ค่าสาธารณูปโภค", "อื่นๆ"]; // Lao Categories

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

export const PURCHASE_CATEGORIES = ["สั่งจากผู้สะหนอง", "ซื้อออนไลน์", "ซื้อหน้าร้าน/ตลาด", "อื่นๆ"]; // Lao Categories

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "ชื่อร้านค้า (ตัวอย่าง)",
  address: "ที่อยู่ร้านค้า (ตัวอย่าง)",
  phone: "020-123-4567", 
  taxId: "เลขประจำตัวผู้เสียภาษี (ตัวอย่าง)",
  logoUrl: "",
  qrPaymentUrl: "",
  footerNote: "ขอบใจที่ใช้บริการ",
  defaultLanguage: Language.LO,
  defaultVatRateForPO: 7, // Default 7% VAT for Purchase Orders
};

export const PO_STATUSES = [
  { value: 'pending', labelKey: 'statusPendingPO', className: 'bg-gray-200 text-gray-800', baseColor: 'gray' },
  { value: 'partial', labelKey: 'statusPartialReceiptPO', className: 'bg-orange-200 text-orange-800', baseColor: 'orange' },
  { value: 'received', labelKey: 'statusReceivedFullPO', className: 'bg-green-200 text-green-800', baseColor: 'green' },
];

// --- NEW: Internal User Management Constants ---
export const ALL_PERMISSIONS: Permission[] = ['create_user', 'edit_user', 'delete_user', 'suspend_user', 'view_reports', 'manage_sales'];
export const INTERNAL_USER_ROLES: InternalUserRole[] = ['Manager', 'Sales', 'Purchasing', 'GR'];

export const ROLE_PERMISSIONS: Record<InternalUserRole, Permission[]> = {
  Manager: ['create_user', 'edit_user', 'delete_user', 'suspend_user', 'view_reports', 'manage_sales'],
  Sales: ['manage_sales'],
  Purchasing: ['view_reports'],
  GR: [],
};
// --- END: Internal User Management Constants ---


// --- IMPORTANT: PDF FONT DATA ---
// This is a global comment. The actual font data constants are defined directly within the
// respective .tsx files where PDF generation occurs to avoid cluttering this central constants file.
// FAILURE TO REPLACE THE PLACEHOLDER STRINGS IN THOSE FILES WILL RESULT IN GARBLED LAO/THAI TEXT IN PDFs.
// --- END IMPORTANT PDF FONT DATA INSTRUCTIONS ---
