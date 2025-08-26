

export enum Language {
  LO = 'lo',
  TH = 'th',
}

// For i18n
export type TranslationKey = string;
export type Translations = {
  [key: string]: string | Translations;
};

export interface LanguageContextType {
  language: Language;
  t: (key: TranslationKey, replacements?: Record<string, string>) => string;
}

// Add FirebaseUser for the legacy auth listener - This can be deprecated
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// @google/genai-api-fix: Added missing AuthContextType definition to resolve import error.
export interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  hasPermission: (allowedRoles: UserRole[]) => boolean;
}

// --- NEW App User & Auth System ---
export type UserRole = 'admin' | 'manager' | 'sales' | 'purchasing' | 'gr';

export interface AppUser {
  uid: string; // Firebase Auth UID, will be the key in RTDB
  email: string;
  role: UserRole;
  displayName?: string; // Optional
  createdAt: string;
  updatedAt: string;
}

// --- NEW Internal User Management System ---
export type Permission = 'create_user' | 'edit_user' | 'delete_user' | 'suspend_user' | 'view_reports' | 'manage_sales';
export type InternalUserRole = 'Sales' | 'Manager' | 'Purchasing' | 'GR';

export interface InternalUser {
  id: string;
  fullname: string;
  username: string;
  password?: string; // Stored insecurely. Hashing should be done server-side in a real app.
  role: InternalUserRole;
  permissions: Permission[];
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}
// --- END Internal User Management System ---


export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userLogin: string; // Denormalized for easier display
  action: string; // e.g., 'create_sale', 'update_product', 'delete_user'
  targetId?: string; // e.g., saleId, productId, userId
  details?: string; // e.g., "Updated stock from 10 to 5"
}
// --- END NEW App User & Auth System ---

export interface Customer {
  id: string;
  name: string;
  customerType: 'cash' | 'credit';
  creditDays?: number;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  totalDebtAmount?: number; // New field for total outstanding balance
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}

export interface Product {
  id: string;
  name: string;
  secondName?: string;
  barcode?: string;
  productType?: string;
  category: string;
  brand?: string;
  supplierId?: string;
  costPrice: number;
  sellingPrice: number; // This will be Selling Price 1
  sellingPrice2?: number; // New: Selling Price 2
  sellingPrice3?: number; // New: Selling Price 3
  unit: string;
  stock: number;
  hasSerialNumber?: boolean;
  hasExpiryDate?: boolean;
  showInPOS: boolean;
  profitPerUnit?: number;
  notes?: string;
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}

export enum ProductMovementLogType {
  INITIAL_STOCK = 'initial_stock',
  PURCHASE = 'purchase', // Generic stock-in
  STOCK_IN_FROM_PO = 'stock_in_from_po', // Specific stock-in from a PO
  SALE = 'sale',
  ADJUSTMENT_ADD = 'adjustment_add',
  ADJUSTMENT_REMOVE = 'adjustment_remove',
  ADJUSTMENT_UPDATE = 'adjustment_update',
  PURCHASE_REVERSAL = 'purchase_reversal',
}

export interface ProductMovementLog {
  id: string;
  productId: string;
  timestamp: string; // ISO Date string
  type: ProductMovementLogType;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  costPriceBefore?: number;
  costPriceAfter?: number;
  sellingPriceBefore?: number;
  sellingPriceAfter?: number;
  relatedDocumentId?: string; // Could be SaleID, PurchaseID, PO_ID, or 'manual_update'
  userId?: string;
  notes?: string;
}

export interface CartItem extends Product {
  quantityInCart: number;
  activeUnitPrice: number; // The price currently used for this item in the cart
  itemDiscountType: 'none' | 'percent' | 'fixed';
  itemDiscountValue: number;
  unitPriceAfterDiscount: number; // Selling price after item-specific discount
  appliedPromotionId?: string; // ID of the promotion applied
  originalUnitPriceBeforePromo?: number; // Original sellingPrice before promotion
  isFreeGift?: boolean; // New flag for free promotional items
}

export interface SaleTransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  originalUnitPrice: number; // Product.sellingPrice at the time of sale (could be promo price or original)
  itemDiscountType: 'none' | 'percent' | 'fixed'; // This reflects discount AFTER promotion potentially
  itemDiscountValue: number; // Value of the discount AFTER promotion potentially
  unitPriceAfterItemDiscount: number; // Price after item-specific discount (or promotional price)
  totalPrice: number; // quantity * unitPriceAfterItemDiscount
  appliedPromotionId?: string; // Store which promotion was applied
  isFreeGift?: boolean; // New flag for free promotional items
}

export interface Sale {
  id: string; // Firebase key or LocalStorage temporary ID
  receiptNumber: string; // User-facing receipt number
  items: SaleTransactionItem[];
  customerId?: string;
  customerName: string;
  customerType: 'cash' | 'credit';
  customerCreditDays?: number;
  customerPhone?: string;
  transactionDate: string; // ISO date string
  dueDate?: string; // ISO date string, for credit sales
  userId?: string; // ID of the user who made the sale
  salespersonName?: string; // Denormalized for easier display
  salesChannel?: string;
  
  totalCartOriginalPrice: number; // Sum of (item.originalUnitPriceBeforePromo or item.originalUnitPrice) * quantity
  totalCartItemDiscountAmount: number; // Sum of discounts applied at item level (promotional or manual)
  subtotalAfterItemDiscounts: number; // totalCartOriginalPrice - totalCartItemDiscountAmount
  
  overallSaleDiscountType: 'none' | 'percent' | 'fixed';
  overallSaleDiscountValueInput: number; // The raw value entered by user for % or fixed
  overallSaleDiscountAmountCalculated: number;
  
  subtotalAfterOverallSaleDiscount: number;
  
  couponCodeApplied?: string;
  couponDiscountAmountApplied?: number;
  
  totalSaleLevelDiscountAmount: number; // overallSaleDiscountAmountCalculated + couponDiscountAmountApplied
  subtotalBeforeEditableVAT: number;
  
  editableVatRate: number; // The VAT rate used for this sale (e.g., 0.07 for 7%)
  vatAmountFromEditableRate: number;
  
  grandTotal: number;
  
  paymentMethod: string;
  receivedAmount?: number; // Amount received for cash sales
  changeGiven?: number; // Change given for cash sales
  
  status: 'paid' | 'unpaid' | 'partially_paid'; 
  paidAmount: number; 
  outstandingAmount: number; 

  notes?: string;
  
  vatStrategy: 'none' | 'add' | 'included';
  vatRateApplied?: number; // The actual VAT rate if applicable (e.g., 0.07)
  vatAmount: number; // Actual VAT amount (should be same as vatAmountFromEditableRate)
  
  isOffline?: boolean; // Flag for sales saved locally
}

export interface PurchaseItemDetail { // This is for Stock-In page
  productId: string;
  productName: string;
  productCategory: string;
  quantity: number; // Quantity received in this stock-in
  buyPrice: number; // Actual buy price for this stock-in (in specified currency)
  hiddenCost: number; // Hidden cost in base currency (LAK)
  totalCostPricePerUnit: number; // Total cost in base currency (LAK)
  gpPercentApplied?: number;
  calculatedSellingPrice: number;
  relatedPoId?: string; // If this stock-in item is from a PO
  originalPoQuantity?: number; // Original quantity ordered in the PO for this item
  quantityPreviouslyReceived?: number; // New field for PO context
}

export type PurchasePaidStatus = 'unpaid' | 'partial' | 'paid';

export interface Purchase {
  id: string;
  docNo?: string;
  invoiceNo?: string;
  purchaseDate: string;
  supplierId?: string;
  supplierName?: string;
  purchaseCategory: string;
  purchaseOrderNumber?: string;
  relatedPoId?: string;
  items: PurchaseItemDetail[];
  paymentMethod?: 'credit' | 'cash' | 'transfer';
  currency: 'LAK' | 'THB' | 'USD';
  exchangeRate: number;
  taxType: 'exempt' | 'calculate';
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  grandTotal: number; // Replaces totalAmount for clarity
  creditDays?: number;
  dueDate?: string;
  paidAmount?: number;
  outstanding?: number;
  paidStatus?: PurchasePaidStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createOfficerId?: string;
  createOfficerName?: string;
  updateOfficerId?: string;
  updateOfficerName?: string;
  isDeleted?: boolean;
}

export interface PurchasePayment {
  id: string;
  purchaseId: string;
  payDate: string;
  payAmount: number;
  method: 'cash' | 'transfer' | 'cheque' | 'other';
  remark?: string;
  officerId: string;
  officerName: string;
  createdAt: string;
  isCancelled?: boolean;
}

export type PurchaseOrderStatus = 'pending' | 'partial' | 'received';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  productCategory: string; // For context at time of PO
  unit: string; // Unit of the product at time of PO
  quantityOrdered: number;
  unitPrice: number; // Agreed price with supplier for this PO
  totalPrice: number; // quantityOrdered * unitPrice
  quantityReceived: number; // Cumulative quantity received against this item
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // Auto-generated, e.g., PO-YYYYMMDD-HHMMSS
  orderDate: string; // ISO date string
  supplierId?: string;
  supplierName?: string; // Denormalized
  items: PurchaseOrderItem[];
  notes?: string;
  subtotalBeforeVAT: number;
  vatRate: number; // Percentage, e.g., 7 for 7%
  vatAmount: number;
  grandTotal: number;
  status: PurchaseOrderStatus;
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  userId?: string;
}


export interface Expense {
  id: string;
  date: string; // ISO Date string
  category: string;
  accountingCategoryCode?: number;
  accountingCategoryName?: string;
  amount: number;
  description: string;
  supplierId?: string;
  relatedPurchaseId?: string; // ID of the Stock-In document if expense is auto-generated
  createdAt: string; // ISO Date string, typically matches 'date' for new expenses
  userId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  creditDays?: number;
  taxInfo?: string; // Address
  taxId?: string; // New field for Tax ID
  notes?: string;
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}

export interface LatestPurchaseInfo {
  id: string;
  purchaseOrderNumber?: string;
  supplierName?: string;
  totalAmount: number;
  purchaseDate: string;
}

export interface TopSellingProductInfo {
  productId: string;
  name: string;
  totalQuantitySold: number;
}

export interface ChartData {
  labels: string[];
  data: number[];
  backgroundColors?: string[];
}

export interface DashboardData {
  salesToday: number;
  expensesToday: number;
  profitToday: number;
  totalStockValue: number;
  latestPurchases: LatestPurchaseInfo[];
  topSellingProducts: TopSellingProductInfo[];
  activeProductsCount: number;
  suppliersCount: number;
  customersThisMonthCount: number;
  monthlySalesChart: ChartData;
  expenseBreakdownChart: ChartData;
}

// New Types for Credit Tracking
export interface SalePayment {
  id: string; // Firebase key
  paymentDate: string; // ISO Date string
  amountPaid: number;
  paymentMethod: 'cash' | 'transfer' | 'qr' | 'check'; // Specific payment methods for recording
  notes?: string;
  recordedBy?: string; // User ID
  createdAt: string; // ISO Date string, when the payment record was created
}

export type CreditInvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'due_soon' | 'pending';


export interface CreditCustomerSummary {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  openInvoicesCount: number;
  totalOutstandingAmount: number;
  earliestDueDate?: string; // ISO Date string
  overallStatus: CreditInvoiceStatus; // Derived status for the customer summary row
}

// Store Settings (Simplified)
export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  taxId: string;
  logoUrl: string; 
  qrPaymentUrl?: string;
  footerNote: string;
  defaultLanguage: Language;
  defaultVatRateForPO?: number; // Optional default VAT rate for Purchase Orders
}

// Promotion Types
export type PromotionStatus = 'active' | 'inactive';
export type PromotionDiscountType = 'fixed' | 'percent';
export type PromotionType = 'discount' | 'free_product';

export interface Promotion {
  id: string;
  name: string;
  promotionType: PromotionType;
  productIds: string[]; // For 'discount': products getting discount. For 'free_product': the main products to buy.
  
  // Fields for 'discount' type
  discountType?: PromotionDiscountType;
  discountValue?: number;

  // Fields for 'free_product' type
  freeProductId?: string;
  quantityToBuy?: number;
  quantityToGetFree?: number;
  
  startDate: string; // ISO Date string
  endDate: string; // ISO Date string
  status: PromotionStatus;
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}

export interface ExchangeRates {
  thb: number;
  usd: number;
  cny: number;
  vatRate?: number;
  updatedAt?: string;
}
