// IMPORTANT: This file relies on Firebase SDKs being loaded globally via CDN in index.html.
// In a typical bundled React app, you'd import from 'firebase/app' and 'firebase/database'.

import { FIREBASE_CONFIG, EXPENSE_CATEGORIES, UI_COLORS, VAT_RATE } from '../constants'; 
import { Product, Sale, Purchase, Expense, Supplier, DashboardData, SaleTransactionItem, ProductMovementLogType, ProductMovementLog, FirebaseUser, Customer, SalePayment, StoreSettings, PurchaseOrder, PurchaseOrderItem, Promotion, ExchangeRates } from '../types'; 


// Declare Firebase types if not automatically available from global scope.
// This is a common workaround when using CDN-loaded libraries with TypeScript.
declare global {
  interface Window {
    firebase: any; // Adjust 'any' to specific Firebase App type if known
    // jsPDF removed from here
  }
}

let app: any; // Firebase App instance
let db: any; // Firebase Realtime Database service instance
let auth: any; // Firebase Authentication service instance

export const initializeFirebase = () => {
  if (typeof window.firebase === 'undefined' || typeof window.firebase.initializeApp !== 'function') {
    console.error("Firebase SDK not found or not loaded correctly. Ensure Firebase scripts are in index.html and loaded before this script.");
    return;
  }
  
  if (!window.firebase.apps.length) {
    app = window.firebase.initializeApp(FIREBASE_CONFIG);
  } else {
    app = window.firebase.app(); // Get default app if already initialized
  }

  if (app && typeof window.firebase.database === 'function') {
    db = window.firebase.database(app);
  } else if (app && typeof app.database === 'function') { // Fallback for some SDK structures
    db = app.database();
  } else {
    console.error("Firebase Database SDK not found or failed to initialize.");
  }

  if (app && typeof window.firebase.auth === 'function') {
    auth = window.firebase.auth(app);
  } else if (app && typeof app.auth === 'function') {
    auth = app.auth();
  } else {
    console.error("Firebase Authentication SDK not found or failed to initialize.");
  }
};


// Helper to get a reference to a Firebase path using the initialized 'db' instance
const getRef = (path: string) => {
  if (!db) {
    console.error("Firebase DB not initialized. Call initializeFirebase() first or check loading order.");
    // Attempt to initialize if not already, though this indicates a problem if db is still null
    initializeFirebase(); 
    if (!db) throw new Error("Firebase DB failed to initialize. Cannot create reference.");
  }
  return db.ref(path);
};

// Helper function to remove undefined properties from an object
const cleanUndefinedProps = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
};


// Helper for push with timestamp
const pushData = async <T,>(path: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const timestamp = new Date().toISOString();
  const cleanedData = cleanUndefinedProps(data); // Remove undefined props
  const fullData = { 
    ...cleanedData, 
    createdAt: timestamp, 
    updatedAt: timestamp 
  };
  const newRecordRef = getRef(path).push();
  await newRecordRef.set(fullData);
  if (!newRecordRef.key) {
    throw new Error("Failed to get key for new record");
  }
  return newRecordRef.key;
};

// Helper for update with timestamp
const updateData = async <T,>(path: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  const timestamp = new Date().toISOString();
  const cleanedData = cleanUndefinedProps(data); // Remove undefined props
  const updatePayload = { ...cleanedData, updatedAt: timestamp };
  await getRef(path).update(updatePayload);
};

// --- Authentication Service ---
export const signInWithEmailAndPassword = async (email: string, pass: string): Promise<FirebaseUser> => {
  if (!auth) throw new Error("Firebase Auth not initialized.");
  const userCredential = await auth.signInWithEmailAndPassword(email, pass);
  const firebaseUser = userCredential.user;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
  };
};

export const signOutUser = async (): Promise<void> => {
  if (!auth) throw new Error("Firebase Auth not initialized.");
  await auth.signOut();
};

export const onAuthStateChangedListener = (callback: (user: FirebaseUser | null) => void): (() => void) => {
  if (!auth) {
    console.error("Firebase Auth not initialized. Cannot listen for auth state changes.");
    return () => {}; // Return a no-op unsubscribe function
  }
  return auth.onAuthStateChanged((firebaseUser: any) => {
    if (firebaseUser) {
      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
      });
    } else {
      callback(null);
    }
  });
};


// --- Product Movement Log Service ---
const addProductMovementLogEntry = async (
  productId: string,
  logData: Omit<ProductMovementLog, 'id' | 'productId' | 'timestamp'>,
  updatesObject?: { [key: string]: any } // Optional: for multi-path updates
): Promise<string> => {
  const logRef = getRef(`productMovementLogs/${productId}`).push();
  const logId = logRef.key;
  if (!logId) throw new Error("Failed to generate log ID");

  const fullLogEntry: ProductMovementLog = {
    ...logData,
    id: logId,
    productId: productId,
    timestamp: new Date().toISOString(), // Use current server time for log entry
    userId: auth?.currentUser?.uid // Add current user ID if available
  };

  if (updatesObject) {
    updatesObject[`productMovementLogs/${productId}/${logId}`] = fullLogEntry;
  } else {
    await logRef.set(fullLogEntry);
  }
  return logId;
};

export const getProductMovementLogs = async (productId: string): Promise<ProductMovementLog[]> => {
  const snapshot = await getRef(`productMovementLogs/${productId}`).get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] } as ProductMovementLog))
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); 
  }
  return [];
};


// --- Product Service ---
export const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'profitPerUnit'>): Promise<string> => {
  const profitPerUnit = productData.sellingPrice - productData.costPrice;
  const timestamp = new Date().toISOString();
  
  const newProductRef = getRef('products').push();
  const productId = newProductRef.key;
  if (!productId) throw new Error("Failed to get key for new product");

  const fullProductData: Product = {
    ...productData,
    id: productId,
    profitPerUnit,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const updates: { [key: string]: any } = {};
  updates[`products/${productId}`] = fullProductData;

  // Log initial stock if any
  if (productData.stock > 0) {
    await addProductMovementLogEntry(productId, {
      type: ProductMovementLogType.INITIAL_STOCK,
      quantityChange: productData.stock,
      stockBefore: 0,
      stockAfter: productData.stock,
      costPriceAfter: productData.costPrice, // Assuming cost price is set at creation
      sellingPriceAfter: productData.sellingPrice, // Assuming selling price is set
      notes: "Initial stock added during product creation", 
      relatedDocumentId: productId, // Link to the product itself
    }, updates);
  }
  
  await db.ref('/').update(updates);
  return productId;
};

export const addMultipleProducts = async (productsData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'profitPerUnit'>[]): Promise<void> => {
  const updates: { [key: string]: any } = {};
  const currentTimestamp = new Date().toISOString();
  
  for (const productData of productsData) {
    const profitPerUnit = productData.sellingPrice - productData.costPrice;
    
    const newProductRef = getRef('products').push();
    const productId = newProductRef.key;
    if (!productId) {
        console.error("Failed to get key for new product:", productData.name);
        continue; // Skip this product
    }

    const fullProductData: Product = {
      ...productData,
      id: productId,
      profitPerUnit,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
    };

    updates[`products/${productId}`] = fullProductData;

    // Log initial stock
    if (productData.stock > 0) {
      const logRef = getRef(`productMovementLogs/${productId}`).push();
      const logId = logRef.key;
      if (logId) {
        const fullLogEntry: ProductMovementLog = {
          id: logId,
          productId: productId,
          timestamp: currentTimestamp,
          type: ProductMovementLogType.INITIAL_STOCK,
          quantityChange: productData.stock,
          stockBefore: 0,
          stockAfter: productData.stock,
          costPriceAfter: productData.costPrice,
          sellingPriceAfter: productData.sellingPrice,
          notes: "Initial stock from Excel import",
          relatedDocumentId: 'excel_import',
          userId: auth?.currentUser?.uid,
        };
        updates[`productMovementLogs/${productId}/${logId}`] = fullLogEntry;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.ref('/').update(updates);
  }
};

export interface ProductUpdatePayload {
    identifier: { field: 'id' | 'barcode', value: string };
    changes: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>;
    rowNumber: number;
}

export interface UpdateMultipleProductsResult {
    successCount: number;
    skipped: { rowNumber: number, reason: string }[];
    errors: { rowNumber: number, reason: string }[];
}

export const updateMultipleProducts = async (payloads: ProductUpdatePayload[]): Promise<UpdateMultipleProductsResult> => {
    const products = await getProducts();
    const productMapById = new Map(products.map(p => [p.id, p]));
    const productMapByBarcode = new Map(products.filter(p => p.barcode).map(p => [p.barcode!, p]));

    const firebaseUpdates: { [key: string]: any } = {};
    const result: UpdateMultipleProductsResult = { successCount: 0, skipped: [], errors: [] };
    const updateTimestamp = new Date().toISOString();

    for (const payload of payloads) {
        let productToUpdate: Product | undefined;
        if (payload.identifier.field === 'id') {
            productToUpdate = productMapById.get(payload.identifier.value);
        } else {
            productToUpdate = productMapByBarcode.get(payload.identifier.value);
        }

        if (!productToUpdate) {
            result.skipped.push({ rowNumber: payload.rowNumber, reason: 'Product not found' });
            continue;
        }

        const { changes } = payload;
        
        if (changes.barcode && changes.barcode !== productToUpdate.barcode) {
            const existingProductWithNewBarcode = productMapByBarcode.get(changes.barcode);
            if (existingProductWithNewBarcode && existingProductWithNewBarcode.id !== productToUpdate.id) {
                result.errors.push({ rowNumber: payload.rowNumber, reason: `Barcode '${changes.barcode}' already exists.` });
                continue;
            }
        }
        
        const productPath = `products/${productToUpdate.id}`;
        
        const updatePayloadForFirebase: any = { ...changes, updatedAt: updateTimestamp };
        
        const newCostPrice = changes.costPrice !== undefined ? changes.costPrice : productToUpdate.costPrice;
        const newSellingPrice = changes.sellingPrice !== undefined ? changes.sellingPrice : productToUpdate.sellingPrice;
        if (changes.costPrice !== undefined || changes.sellingPrice !== undefined) {
          updatePayloadForFirebase.profitPerUnit = newSellingPrice - newCostPrice;
        }

        for (const key in updatePayloadForFirebase) {
             firebaseUpdates[`${productPath}/${key}`] = updatePayloadForFirebase[key];
        }

        if (changes.stock !== undefined && changes.stock !== productToUpdate.stock) {
            const quantityChange = changes.stock - productToUpdate.stock;
            await addProductMovementLogEntry(productToUpdate.id, {
                type: quantityChange > 0 ? ProductMovementLogType.ADJUSTMENT_ADD : ProductMovementLogType.ADJUSTMENT_REMOVE,
                quantityChange,
                stockBefore: productToUpdate.stock,
                stockAfter: changes.stock,
                costPriceBefore: productToUpdate.costPrice,
                costPriceAfter: newCostPrice,
                sellingPriceBefore: productToUpdate.sellingPrice,
                sellingPriceAfter: newSellingPrice,
                relatedDocumentId: 'excel_update',
                notes: `Stock updated via Excel. Row: ${payload.rowNumber}`
            }, firebaseUpdates);
        }
        result.successCount++;
    }

    if (Object.keys(firebaseUpdates).length > 0) {
        await db.ref('/').update(firebaseUpdates);
    }

    return result;
};


export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await getRef('products').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
  }
  return [];
};

export const getProductById = async (id: string): Promise<Product | null> => {
    const snapshot = await getRef(`products/${id}`).get();
    return snapshot.exists() ? { id, ...snapshot.val() } : null;
};

export const updateProduct = async (id: string, productData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  const currentProduct = await getProductById(id);
  if (!currentProduct) throw new Error(`Product with ID ${id} not found.`);

  const updates: { [key: string]: any } = {};
  const updateTimestamp = new Date().toISOString(); // Use a consistent timestamp for all updates in this op
  let dataToUpdate: any = { ...productData, updatedAt: updateTimestamp }; 

  const newCostPrice = productData.costPrice !== undefined ? productData.costPrice : currentProduct.costPrice;
  const newSellingPrice = productData.sellingPrice !== undefined ? productData.sellingPrice : currentProduct.sellingPrice;
  if (productData.costPrice !== undefined || productData.sellingPrice !== undefined) {
    dataToUpdate.profitPerUnit = newSellingPrice - newCostPrice;
  }
  
  let logType = ProductMovementLogType.ADJUSTMENT_UPDATE;
  let quantityChange = 0;
  const stockBefore = currentProduct.stock;
  let stockAfter = currentProduct.stock;

  if (productData.stock !== undefined && productData.stock !== currentProduct.stock) {
    quantityChange = productData.stock - currentProduct.stock;
    stockAfter = productData.stock; 
    logType = quantityChange > 0 ? ProductMovementLogType.ADJUSTMENT_ADD : ProductMovementLogType.ADJUSTMENT_REMOVE;
  }
  
  const logNote = productData.notes !== currentProduct.notes && productData.notes !== undefined 
    ? `Product notes updated. ${quantityChange !== 0 ? 'Stock also adjusted.' : ''}` 
    : (quantityChange !== 0 ? "Manual stock adjustment" : "Product details updated"); 

  updates[`products/${id}`] = cleanUndefinedProps({ ...updates[`products/${id}`], ...dataToUpdate });

  await addProductMovementLogEntry(id, {
      type: logType,
      quantityChange: quantityChange,
      stockBefore: stockBefore,
      stockAfter: stockAfter, 
      costPriceBefore: currentProduct.costPrice,
      costPriceAfter: newCostPrice, 
      sellingPriceBefore: currentProduct.sellingPrice,
      sellingPriceAfter: newSellingPrice, 
      notes: logNote,
      relatedDocumentId: 'manual_update', 
  }, updates); 
  
  await db.ref('/').update(updates); 
};

export const deleteProduct = async (id: string): Promise<void> => {
  await getRef(`products/${id}`).remove();
};

export const deleteMultipleProducts = async (productIds: string[]): Promise<void> => {
  const updates: { [key: string]: null } = {};
  productIds.forEach(id => {
    updates[`products/${id}`] = null;
    // Note: This does not remove associated movement logs, consistent with single delete.
  });
  if (Object.keys(updates).length > 0) {
    await db.ref('/').update(updates);
  }
};

export const updateMultipleProductsStatus = async (productIds: string[], newStatus: boolean): Promise<void> => {
  const updates: { [key: string]: any } = {};
  const timestamp = new Date().toISOString();

  for (const id of productIds) {
    const productSnapshot = await getRef(`products/${id}`).get();
    if (productSnapshot.exists()) {
      const currentProduct: Product = { id, ...productSnapshot.val() };
      
      updates[`products/${id}/showInPOS`] = newStatus;
      updates[`products/${id}/updatedAt`] = timestamp;

      // Add movement log for status change
      await addProductMovementLogEntry(id, {
          type: ProductMovementLogType.ADJUSTMENT_UPDATE,
          quantityChange: 0,
          stockBefore: currentProduct.stock,
          stockAfter: currentProduct.stock, 
          notes: newStatus ? 'Product activated via bulk action' : 'Product deactivated via bulk action',
          relatedDocumentId: 'manual_batch_update',
      }, updates);
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.ref('/').update(updates);
  }
};


// --- Customer Service ---
export const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const dataWithDebt = { ...customerData, totalDebtAmount: customerData.totalDebtAmount || 0 };
  return pushData<Customer>('customers', dataWithDebt);
};

export const getCustomers = async (): Promise<Customer[]> => {
  const snapshot = await getRef('customers').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
  }
  return [];
};

export const updateCustomer = async (id: string, customerData: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  return updateData<Customer>(`customers/${id}`, customerData);
};

export const deleteCustomer = async (id: string): Promise<void> => {
  return getRef(`customers/${id}`).remove();
};


// --- Sale Service ---
export const addSale = async (saleData: Omit<Sale, 'id' | 'receiptNumber'>): Promise<Sale> => {
  const saleTimestamp = new Date(saleData.transactionDate).toISOString(); 
  const currentProcessingTimestamp = new Date().toISOString(); // For customer updatedAt
  const uniqueSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const receiptNumber = `RCPT-${new Date(saleData.transactionDate).getTime()}-${uniqueSuffix}`;
  
  const updates: {[key: string]: any} = {};

  for (const item of saleData.items) {
    const productSnapshot = await getRef(`products/${item.productId}`).get();
    if (!productSnapshot.exists()) throw new Error(`Product ${item.productId} (${item.productName}) not found during sale.`);
    
    const currentProductData = productSnapshot.val();
    const currentProduct: Product = { id: item.productId, ...currentProductData };

    const stockBefore = currentProduct.stock;
    const stockAfter = stockBefore - item.quantity;

    if (stockAfter < 0) {
      throw new Error(`Not enough stock for product ${currentProduct.name}. Requested: ${item.quantity}, Available: ${stockBefore}`);
    }

    updates[`products/${item.productId}/stock`] = stockAfter; 
    updates[`products/${item.productId}/updatedAt`] = saleTimestamp; 

    await addProductMovementLogEntry(item.productId, {
        type: ProductMovementLogType.SALE,
        quantityChange: -item.quantity,
        stockBefore: stockBefore,
        stockAfter: stockAfter,
        costPriceBefore: currentProduct.costPrice, 
        costPriceAfter: currentProduct.costPrice, 
        sellingPriceBefore: currentProduct.sellingPrice, 
        sellingPriceAfter: item.unitPriceAfterItemDiscount, 
        relatedDocumentId: `temp_sale_id_placeholder`, 
        notes: `Sold: ${item.productName} (Qty: ${item.quantity}) Receipt: ${receiptNumber.slice(-12)}`, 
    }, updates);
  }

  // Update customer's total debt if it's a credit sale
  if (saleData.paymentMethod === 'credit' && saleData.customerId) {
    const customerRefPath = `customers/${saleData.customerId}`;
    const customerSnapshot = await getRef(customerRefPath).get();
    if (customerSnapshot.exists()) {
      const currentCustomerData: Customer = customerSnapshot.val();
      const previousTotalDebt = currentCustomerData.totalDebtAmount || 0;
      const newTotalDebt = previousTotalDebt + saleData.grandTotal; // Add current sale's grand total
      
      updates[`${customerRefPath}/totalDebtAmount`] = newTotalDebt;
      updates[`${customerRefPath}/updatedAt`] = currentProcessingTimestamp; // Reflect customer record update time
    } else {
      console.warn(`Customer ${saleData.customerId} not found for updating total debt.`);
      // Decide if sale should proceed or throw error - for now, it proceeds
    }
  }


  const newSaleRef = getRef('sales').push();
  const saleId = newSaleRef.key;
  if (!saleId) throw new Error("Failed to generate sale ID");
  
  for (const key in updates) {
      if (key.startsWith('productMovementLogs') && updates[key].relatedDocumentId === `temp_sale_id_placeholder`) {
          updates[key].relatedDocumentId = saleId; 
      }
  }

  const fullSaleData: Sale = { 
    ...saleData,
    id: saleId, 
    receiptNumber,
  };
  updates[`sales/${saleId}`] = cleanUndefinedProps(fullSaleData); 
  
  await db.ref('/').update(updates); 
  return fullSaleData;
};

export const getSales = async (): Promise<Sale[]> => {
  const snapshot = await getRef('sales').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
  }
  return [];
};

export const recordSalePaymentAndUpdateSale = async (
  saleId: string,
  paymentDetails: Omit<SalePayment, 'id' | 'createdAt' | 'recordedBy'>
): Promise<string> => {
  const updates: { [key: string]: any } = {};
  const paymentTimestamp = new Date().toISOString();

  const saleSnapshot = await getRef(`sales/${saleId}`).get();
  if (!saleSnapshot.exists()) {
    throw new Error(`Sale with ID ${saleId} not found.`);
  }
  const currentSale: Sale = {id: saleId, ...saleSnapshot.val()};

  const newPaymentRef = getRef(`salePayments/${saleId}`).push();
  const paymentId = newPaymentRef.key;
  if (!paymentId) throw new Error("Failed to generate payment ID");

  const fullPaymentData: SalePayment = {
    ...paymentDetails,
    id: paymentId,
    createdAt: paymentTimestamp,
    recordedBy: auth?.currentUser?.uid || undefined,
  };
  updates[`salePayments/${saleId}/${paymentId}`] = cleanUndefinedProps(fullPaymentData);

  const newPaidAmount = (currentSale.paidAmount || 0) + paymentDetails.amountPaid;
  const newOutstandingAmount = currentSale.grandTotal - newPaidAmount;
  let newStatus: 'paid' | 'unpaid' | 'partially_paid' = 'partially_paid';

  if (newOutstandingAmount <= 0) {
    newStatus = 'paid';
  } else if (newPaidAmount === 0) {
    newStatus = 'unpaid';
  }
  
  updates[`sales/${saleId}/paidAmount`] = newPaidAmount;
  updates[`sales/${saleId}/outstandingAmount`] = Math.max(0, newOutstandingAmount); 
  updates[`sales/${saleId}/status`] = newStatus;
  updates[`sales/${saleId}/updatedAt`] = paymentTimestamp; 

  // If the sale is fully paid, update the customer's totalDebtAmount
  if (newStatus === 'paid' && currentSale.customerId && currentSale.paymentMethod === 'credit') {
      const customerRefPath = `customers/${currentSale.customerId}`;
      const customerSnapshot = await getRef(customerRefPath).get();
      if (customerSnapshot.exists()) {
          const customerData: Customer = customerSnapshot.val();
          const currentTotalDebt = customerData.totalDebtAmount || 0;
          // Reduce debt by the original outstanding amount of THIS sale,
          // as this sale is now fully paid.
          const updatedDebt = currentTotalDebt - currentSale.outstandingAmount; 
          updates[`${customerRefPath}/totalDebtAmount`] = Math.max(0, updatedDebt);
          updates[`${customerRefPath}/updatedAt`] = paymentTimestamp;
      }
  }

  await db.ref('/').update(updates);
  return paymentId;
};

export const getSalePayments = async (saleId: string): Promise<SalePayment[]> => {
    const snapshot = await getRef(`salePayments/${saleId}`).get();
    if(snapshot.exists()){
        const data = snapshot.val();
        return Object.keys(data).map(key => ({id: key, ...data[key]})).sort((a,b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    }
    return [];
}


// --- Purchase (Stock-In) Service ---
export const addPurchaseAndProcess = async (
  purchaseInput: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>,
  expenseCategoryText: string, 
  expenseDescriptionTemplate: string
): Promise<string> => {
  const newPurchaseRef = getRef('purchases').push(); // This is a Stock-In document
  const purchaseId = newPurchaseRef.key;
  if (!purchaseId) throw new Error("Failed to generate purchase (stock-in) ID");

  const purchaseTimestamp = new Date(purchaseInput.purchaseDate).toISOString();
  const purchaseData: Purchase = {
    ...purchaseInput,
    id: purchaseId,
    createdAt: purchaseTimestamp, 
    updatedAt: purchaseTimestamp,
  };

  const updates: { [key: string]: any } = {};
  updates[`purchases/${purchaseId}`] = cleanUndefinedProps(purchaseData);

  for (const item of purchaseInput.items) {
    const productRefPath = `products/${item.productId}`;
    const productSnapshot = await getRef(productRefPath).get();
    if (!productSnapshot.exists()) throw new Error(`Product ${item.productId} (${item.productName}) not found during stock-in.`);
    const currentProduct: Product = { id: item.productId, ...productSnapshot.val() };
    
    const stockBefore = currentProduct.stock;
    const newStock = stockBefore + item.quantity;
    const newProfitPerUnit = item.calculatedSellingPrice - item.totalCostPricePerUnit;

    updates[`${productRefPath}/stock`] = newStock; 
    updates[`${productRefPath}/costPrice`] = item.totalCostPricePerUnit; 
    updates[`${productRefPath}/sellingPrice`] = item.calculatedSellingPrice; 
    updates[`${productRefPath}/profitPerUnit`] = newProfitPerUnit;
    updates[`${productRefPath}/updatedAt`] = purchaseTimestamp; 

    await addProductMovementLogEntry(item.productId, {
        type: purchaseInput.relatedPoId ? ProductMovementLogType.STOCK_IN_FROM_PO : ProductMovementLogType.PURCHASE,
        quantityChange: item.quantity,
        stockBefore: stockBefore,
        stockAfter: newStock,
        costPriceBefore: currentProduct.costPrice,
        costPriceAfter: item.totalCostPricePerUnit,
        sellingPriceBefore: currentProduct.sellingPrice,
        sellingPriceAfter: item.calculatedSellingPrice,
        relatedDocumentId: purchaseId, // Link to this stock-in document
        notes: `Stock-in via ${purchaseInput.purchaseOrderNumber ? 'Ref ' + purchaseInput.purchaseOrderNumber : 'ID ' + purchaseId.substring(purchaseId.length-6)}${purchaseInput.relatedPoId ? ` (PO: ${purchaseInput.relatedPoId.substring(purchaseInput.relatedPoId.length-6)})` : ''}`, 
    }, updates);
  }
  
  // Create an expense for this purchase/stock-in, based on the subtotal (cost of goods).
  const expenseDescription = expenseDescriptionTemplate.replace('{purchaseId}', purchaseInput.purchaseOrderNumber || purchaseId.substring(purchaseId.length - 6));
  const expenseData: Omit<Expense, 'id' | 'createdAt'> = {
    date: purchaseInput.purchaseDate, 
    category: expenseCategoryText,
    amount: purchaseInput.subtotal, 
    description: expenseDescription,
    supplierId: purchaseInput.supplierId,
    relatedPurchaseId: purchaseId, // Link expense to this stock-in document
  };
  const newExpenseRef = getRef('expenses').push();
  const expenseId = newExpenseRef.key;
  if (!expenseId) throw new Error("Failed to generate expense ID for purchase");
  updates[`expenses/${expenseId}`] = { ...cleanUndefinedProps(expenseData), id: expenseId, createdAt: purchaseTimestamp };

  // If related to a PO, update the PO status and item received quantities
  if (purchaseInput.relatedPoId) {
    const poSnapshot = await getRef(`purchaseOrders/${purchaseInput.relatedPoId}`).get();
    if (poSnapshot.exists()) {
      const poToUpdate: PurchaseOrder = { id: purchaseInput.relatedPoId, ...poSnapshot.val() };
      let allItemsFullyReceived = true;
      let anyItemPartiallyReceived = false;

      poToUpdate.items = poToUpdate.items.map(poItem => {
        const receivedNow = purchaseInput.items.find(pi => pi.productId === poItem.productId);
        let newReceivedQty = poItem.quantityReceived || 0;
        if (receivedNow) {
          newReceivedQty += receivedNow.quantity;
        }
        
        if (newReceivedQty < poItem.quantityOrdered) {
          allItemsFullyReceived = false;
        }
        if (newReceivedQty > 0) {
          anyItemPartiallyReceived = true;
        }
        return { ...poItem, quantityReceived: newReceivedQty };
      });

      if (allItemsFullyReceived) {
        poToUpdate.status = 'received';
      } else if (anyItemPartiallyReceived) {
        poToUpdate.status = 'partial';
      }
      
      updates[`purchaseOrders/${purchaseInput.relatedPoId}/items`] = poToUpdate.items;
      updates[`purchaseOrders/${purchaseInput.relatedPoId}/status`] = poToUpdate.status;
      updates[`purchaseOrders/${purchaseInput.relatedPoId}/updatedAt`] = purchaseTimestamp;
    }
  }


  await db.ref('/').update(updates);
  return purchaseId;
};

export const getPurchases = async (): Promise<Purchase[]> => { // Stock-In History
  const snapshot = await getRef('purchases').get();
   if (snapshot.exists()) {
    const data = snapshot.val();
    const purchasesArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    return purchasesArray.sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }
  return [];
};

export const deletePurchaseAndAssociatedRecords = async (purchaseId: string, logNoteTemplate: string): Promise<void> => {
  const purchaseSnapshot = await getRef(`purchases/${purchaseId}`).get();
  if (!purchaseSnapshot.exists()) {
    throw new Error(`Purchase (Stock-In) with ID ${purchaseId} not found.`);
  }
  const purchaseToDelete: Purchase = { id: purchaseId, ...purchaseSnapshot.val() };

  const updates: { [key: string]: any } = {};
  const reversalTimestamp = new Date().toISOString(); 

  const expensesSnapshot = await getRef('expenses').orderByChild('relatedPurchaseId').equalTo(purchaseId).get();
  if (expensesSnapshot.exists()) {
    const expensesData = expensesSnapshot.val();
    for (const expenseId in expensesData) {
      updates[`expenses/${expenseId}`] = null; 
    }
  }

  for (const item of purchaseToDelete.items) {
    const productSnapshot = await getRef(`products/${item.productId}`).get();
    if (productSnapshot.exists()) {
      const currentProduct: Product = { id: item.productId, ...productSnapshot.val() };
      const stockBeforeReversal = currentProduct.stock;
      const newStockAfterReversal = stockBeforeReversal - item.quantity; 

      updates[`products/${item.productId}/stock`] = newStockAfterReversal;
      updates[`products/${item.productId}/updatedAt`] = reversalTimestamp; 
      
      const filledLogNote = logNoteTemplate.replace('{purchaseId}', purchaseId.substring(purchaseId.length-6));

      await addProductMovementLogEntry(item.productId, {
        type: ProductMovementLogType.PURCHASE_REVERSAL,
        quantityChange: -item.quantity, 
        stockBefore: stockBeforeReversal,
        stockAfter: newStockAfterReversal,
        costPriceBefore: currentProduct.costPrice, 
        costPriceAfter: currentProduct.costPrice, 
        sellingPriceBefore: currentProduct.sellingPrice,
        sellingPriceAfter: currentProduct.sellingPrice, 
        relatedDocumentId: purchaseId,
        notes: filledLogNote,
      }, updates);
    }
  }

  // If this purchase was linked to a PO, revert the received quantities on the PO
  if (purchaseToDelete.relatedPoId) {
    const poSnapshot = await getRef(`purchaseOrders/${purchaseToDelete.relatedPoId}`).get();
    if (poSnapshot.exists()) {
      const poToUpdate: PurchaseOrder = { id: purchaseToDelete.relatedPoId, ...poSnapshot.val() };
      
      poToUpdate.items = poToUpdate.items.map(poItem => {
        const deletedStockInItem = purchaseToDelete.items.find(si => si.productId === poItem.productId);
        if (deletedStockInItem) {
          return { ...poItem, quantityReceived: Math.max(0, (poItem.quantityReceived || 0) - deletedStockInItem.quantity) };
        }
        return poItem;
      });

      let allItemsFullyReceived = true;
      let anyItemPartiallyReceived = false;
      poToUpdate.items.forEach(poItem => {
        if ((poItem.quantityReceived || 0) < poItem.quantityOrdered) {
          allItemsFullyReceived = false;
        }
        if ((poItem.quantityReceived || 0) > 0) {
          anyItemPartiallyReceived = true;
        }
      });

      if (allItemsFullyReceived) {
        poToUpdate.status = 'received';
      } else if (anyItemPartiallyReceived) {
        poToUpdate.status = 'partial';
      } else {
        poToUpdate.status = 'pending'; // If all received quantities are now zero
      }
      
      updates[`purchaseOrders/${purchaseToDelete.relatedPoId}/items`] = poToUpdate.items;
      updates[`purchaseOrders/${purchaseToDelete.relatedPoId}/status`] = poToUpdate.status;
      updates[`purchaseOrders/${purchaseToDelete.relatedPoId}/updatedAt`] = reversalTimestamp;
    }
  }

  updates[`purchases/${purchaseId}`] = null; 
  await db.ref('/').update(updates); 
};


// --- Expense Service ---
export const addExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt'>): Promise<string> => {
  const expenseTimestamp = new Date(expenseData.date).toISOString(); 
  const cleanedExpenseData = cleanUndefinedProps(expenseData);
  const fullExpenseData = {
    ...cleanedExpenseData,
    createdAt: expenseTimestamp, 
  };
  const newRecordRef = getRef('expenses').push();
  const expenseId = newRecordRef.key;
  if (!expenseId) {
    throw new Error("Failed to get key for new expense record");
  }
  await newRecordRef.set({ ...fullExpenseData, id: expenseId });
  return expenseId;
};


export const getExpenses = async (): Promise<Expense[]> => {
  const snapshot = await getRef('expenses').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
  }
  return [];
};

export const updateExpense = async (id: string, expenseData: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<void> => {
  await getRef(`expenses/${id}`).update(cleanUndefinedProps(expenseData));
};


export const deleteExpense = async (id: string): Promise<void> => {
  return getRef(`expenses/${id}`).remove();
};


// --- Supplier Service ---
export const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  return pushData<Supplier>('suppliers', supplierData);
};

export const getSuppliers = async (): Promise<Supplier[]> => {
  const snapshot = await getRef('suppliers').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
  }
  return [];
};

export const updateSupplier = async (id: string, supplierData: Partial<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  return updateData<Supplier>(`suppliers/${id}`, supplierData);
};

export const deleteSupplier = async (id: string): Promise<void> => {
  return getRef(`suppliers/${id}`).remove();
};

// --- Purchase Order Service ---
export const addPurchaseOrder = async (poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  return pushData<PurchaseOrder>('purchaseOrders', poData);
};

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  const snapshot = await getRef('purchaseOrders').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }
  return [];
};

export const getPurchaseOrderById = async (id: string): Promise<PurchaseOrder | null> => {
  const snapshot = await getRef(`purchaseOrders/${id}`).get();
  return snapshot.exists() ? { id, ...snapshot.val() } : null;
};

export const updatePurchaseOrder = async (id: string, poData: Partial<Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  return updateData<PurchaseOrder>(`purchaseOrders/${id}`, poData);
};

export const deletePurchaseOrder = async (id: string): Promise<void> => {
  return getRef(`purchaseOrders/${id}`).remove();
};


// --- Store Settings Service ---
export const getStoreSettings = async (): Promise<StoreSettings | null> => {
  const snapshot = await getRef('appSettings/storeConfig').get();
  if (snapshot.exists()) {
    return snapshot.val() as StoreSettings;
  }
  return null;
};

export const saveStoreSettings = async (settings: StoreSettings): Promise<void> => {
  const cleanedSettings = cleanUndefinedProps(settings);
  await getRef('appSettings/storeConfig').set(cleanedSettings);
};


// --- Promotion Service ---
export const addPromotion = async (promotionData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  return pushData<Promotion>('promotions', promotionData);
};

export const getPromotions = async (): Promise<Promotion[]> => {
  const snapshot = await getRef('promotions').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(key => ({ id: key, ...data[key] }));
  }
  return [];
};

export const getActivePromotions = async (): Promise<Promotion[]> => {
  const snapshot = await getRef('promotions').get(); // Fetch all promotions
  if (snapshot.exists()) {
    const data = snapshot.val();
    const allPromos = Object.keys(data).map(key => ({ id: key, ...data[key] } as Promotion));
    
    // Client-side filtering for 'active' status and date range
    return allPromos.filter(promo => {
        const now = new Date();
        const startDate = new Date(promo.startDate);
        const endDate = new Date(promo.endDate);
        endDate.setHours(23, 59, 59, 999); // Ensure end date includes the whole day
        
        return promo.status === 'active' && startDate <= now && now <= endDate;
    });
  }
  return [];
};

export const updatePromotion = async (id: string, promotionData: Partial<Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  return updateData<Promotion>(`promotions/${id}`, promotionData);
};

export const deletePromotion = async (id: string): Promise<void> => {
  return getRef(`promotions/${id}`).remove();
};


// --- Dashboard Data Fetching (NEW Comprehensive Version) ---
export const getDashboardSummary = async (): Promise<DashboardData> => {
    const [allSales, allExpenses, allProducts, allPurchases, allSuppliers] = await Promise.all([
        getSales(),
        getExpenses(),
        getProducts(),
        getPurchases(), 
        getSuppliers()
    ]);

    const todayISO = new Date().toISOString().split('T')[0];
    const currentMonthISO = new Date().toISOString().substring(0, 7); 
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    const salesToday = allSales
        .filter(s => s.transactionDate && s.transactionDate.startsWith(todayISO))
        .reduce((sum, s) => sum + s.grandTotal, 0); 

    const expensesToday = allExpenses
        .filter(e => e.date && e.date.startsWith(todayISO))
        .reduce((sum, e) => sum + e.amount, 0);

    const totalStockValue = allProducts.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);

    const latestPurchases = allPurchases.slice(0, 5).map(p => ({ // These are stock-ins now
        id: p.id,
        purchaseOrderNumber: p.purchaseOrderNumber, // This can be PO number or other ref
        supplierName: p.supplierName,
        totalAmount: p.totalAmount,
        purchaseDate: p.purchaseDate, // Stock-in date
    }));

    const salesThisMonth = allSales.filter(s => s.transactionDate && s.transactionDate.startsWith(currentMonthISO));
    const productSalesMap: { [productId: string]: { name: string; totalQuantitySold: number } } = {};
    
    salesThisMonth.forEach(sale => {
        sale.items.forEach(item => {
            if (!productSalesMap[item.productId]) {
                const productInfo = allProducts.find(p => p.id === item.productId);
                productSalesMap[item.productId] = { 
                    name: productInfo ? productInfo.name : 'Unknown Product', 
                    totalQuantitySold: 0 
                };
            }
            productSalesMap[item.productId].totalQuantitySold += item.quantity;
        });
    });

    const topSellingProducts = Object.entries(productSalesMap)
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
        .slice(0, 5);

    const activeProductsCount = allProducts.filter(p => p.stock > 0 && p.showInPOS).length; 
    const suppliersCount = allSuppliers.length;
    const customerIdentifiersThisMonth = new Set(
        salesThisMonth.map(s => s.customerId || `walkin-${s.customerName.toLowerCase()}`)
    );
    const customersThisMonthCount = customerIdentifiersThisMonth.size;

    const dailySalesData = Array(daysInMonth).fill(0);
    const monthLabels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    salesThisMonth.forEach(sale => {
        const dayOfMonth = new Date(sale.transactionDate).getDate() -1; 
        if (dayOfMonth >= 0 && dayOfMonth < daysInMonth) {
            dailySalesData[dayOfMonth] += sale.grandTotal; 
        }
    });
    const monthlySalesChart = { labels: monthLabels, data: dailySalesData };
    
    const expensesThisMonth = allExpenses.filter(e => e.date && e.date.startsWith(currentMonthISO));
    const expenseCategoryMap: { [category: string]: number } = {};
    EXPENSE_CATEGORIES.forEach(cat => expenseCategoryMap[cat] = 0); 

    expensesThisMonth.forEach(expense => {
        if (!expenseCategoryMap[expense.category]) {
            expenseCategoryMap[expense.category] = 0; 
        }
        expenseCategoryMap[expense.category] += expense.amount;
    });
    
    const expenseLabels = Object.keys(expenseCategoryMap).filter(cat => expenseCategoryMap[cat] > 0); 
    const expenseData = expenseLabels.map(label => expenseCategoryMap[label]);

    const chartColors = [
        UI_COLORS.primary, UI_COLORS.secondary, UI_COLORS.accent, 
        UI_COLORS.chartGreen, UI_COLORS.chartOrange, UI_COLORS.chartRed, 
        UI_COLORS.chartTeal, UI_COLORS.chartPink, UI_COLORS.chartIndigo, '#607D8B' 
    ];
    const backgroundColors = expenseLabels.map((_, i) => chartColors[i % chartColors.length]);
    const expenseBreakdownChart = { labels: expenseLabels, data: expenseData, backgroundColors };

    return {
        salesToday,
        expensesToday,
        profitToday: salesToday - expensesToday, 
        totalStockValue,
        latestPurchases,
        topSellingProducts,
        activeProductsCount,
        suppliersCount,
        customersThisMonthCount,
        monthlySalesChart,
        expenseBreakdownChart,
    } as DashboardData; 
};

// --- Exchange Rate Service ---
export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
  const snapshot = await getRef('appSettings/exchangeRates').get();
  if (snapshot.exists()) {
    return snapshot.val() as ExchangeRates;
  }
  return null;
};

export const saveExchangeRates = async (rates: Omit<ExchangeRates, 'updatedAt'>): Promise<void> => {
  const dataToSave = {
    ...rates,
    updatedAt: new Date().toISOString(),
  };
  await getRef('appSettings/exchangeRates').set(dataToSave);
};


// Initialize Firebase on load (when this module is imported)
initializeFirebase();

// Helper to check if Firebase is initialized.
export const isFirebaseInitialized = (): boolean => !!app && !!db && !!auth;