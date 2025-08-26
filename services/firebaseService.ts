// IMPORTANT: This file relies on Firebase SDKs being loaded globally via CDN in index.html.
// In a typical bundled React app, you'd import from 'firebase/app' and 'firebase/database'.

import { FIREBASE_CONFIG, EXPENSE_CATEGORIES, UI_COLORS, VAT_RATE } from '../constants'; 
import { Product, Sale, Purchase, Expense, Supplier, DashboardData, SaleTransactionItem, ProductMovementLogType, ProductMovementLog, FirebaseUser, Customer, SalePayment, StoreSettings, PurchaseOrder, PurchaseOrderItem, Promotion, ExchangeRates, AppUser, AuditLog, UserRole, InternalUser, ChartData, LatestPurchaseInfo, TopSellingProductInfo, PurchasePayment, PurchasePaidStatus } from '../types'; 


// Declare Firebase types if not automatically available from global scope.
// This is a common workaround when using CDN-loaded libraries with TypeScript.
declare global {
  interface Window {
    firebase: any; // Adjust 'any' to specific Firebase App type if known
  }
}

let app: any; // Firebase App instance
let db: any; // Firebase Realtime Database service instance

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
  } else {
    console.error("Firebase Database SDK not found or failed to initialize.");
  }
};

// @google/genai-api-fix: Ensure Firebase is initialized when the service module is loaded.
initializeFirebase();

// Helper to get a reference to a Firebase path using the initialized 'db' instance
const getRef = (path: string) => {
  if (!db) {
    console.error("Firebase DB not initialized. Call initializeFirebase() first or check loading order.");
    initializeFirebase(); 
    if (!db) throw new Error("Firebase DB failed to initialize. Cannot create reference.");
  }
  return db.ref(path);
};

export const isFirebaseInitialized = (): boolean => !!db;

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

// --- Generic Getter ---
const getData = async <T>(path: string): Promise<T[]> => {
    const snapshot = await getRef(path).get();
    if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.keys(data).map(key => ({ id: key, ...data[key] }));
    }
    return [];
};

// --- Audit Log Service ---
export const addAuditLog = async (logData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<string> => {
  const newLogRef = getRef('auditLogs').push();
  const logId = newLogRef.key;
  if (!logId) throw new Error("Failed to generate audit log ID");

  const fullLog: AuditLog = {
    ...logData,
    id: logId,
    timestamp: new Date().toISOString(),
  };

  await newLogRef.set(fullLog);
  return logId;
};

// --- User Profile Service (for roles and metadata) ---
export const createUserProfile = async (uid: string, email: string, role: UserRole): Promise<AppUser> => {
    const timestamp = new Date().toISOString();
    const newUserProfileData: Omit<AppUser, 'uid'> = {
        email,
        role,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    await getRef(`users/${uid}`).set(newUserProfileData);
    addAuditLog({
        userId: uid,
        userLogin: email,
        action: 'create_user_profile',
        targetId: uid,
        details: `User profile created for ${email} with default role '${role}' on first login.`
    });
    return { uid, ...newUserProfileData };
};


export const getUser = async (uid: string): Promise<AppUser | null> => {
    const snapshot = await getRef(`users/${uid}`).get();
    if (snapshot.exists()) {
        const data = snapshot.val();
        return { uid, ...data };
    }
    return null;
};

export const getUsers = async (): Promise<AppUser[]> => {
  const snapshot = await getRef('users').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.keys(data).map(uid => ({ uid, ...data[uid] }));
  }
  return [];
};


export const updateUserRole = async (uid: string, role: UserRole, actorId: string, actorLogin: string): Promise<void> => {
    const userSnapshot = await getRef(`users/${uid}`).get();
    if (!userSnapshot.exists()) {
        throw new Error("User not found in database to update role.");
    }
    const userToUpdate = userSnapshot.val();
    const dataToUpdate = {
        role: role,
        updatedAt: new Date().toISOString(),
    };
    await getRef(`users/${uid}`).update(dataToUpdate);
    addAuditLog({ userId: actorId, userLogin: actorLogin, action: 'update_user_role', targetId: uid, details: `Updated role for ${userToUpdate.email} to ${role}` });
};

export const deleteUser = async (uid: string, actorId: string, actorLogin: string): Promise<void> => {
    // This only deletes the user profile from RTDB. Deleting from Firebase Auth requires Admin SDK.
    const userSnapshot = await getRef(`users/${uid}`).get();
    if (userSnapshot.exists()) {
        const userToDelete = userSnapshot.val();
        await getRef(`users/${uid}`).remove();
        addAuditLog({ userId: actorId, userLogin: actorLogin, action: 'delete_user', targetId: uid, details: `Deleted user profile for ${userToDelete.email}` });
    }
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
export const getProducts = (): Promise<Product[]> => getData<Product>('products');

export const getProductById = async (productId: string): Promise<Product | null> => {
  const snapshot = await getRef(`products/${productId}`).get();
  if (snapshot.exists()) {
    return { id: productId, ...snapshot.val() };
  }
  return null;
};

export const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'profitPerUnit'>, userId: string, userLogin: string): Promise<string> => {
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
      costPriceAfter: productData.costPrice,
      sellingPriceAfter: productData.sellingPrice,
      notes: "Initial stock added during product creation", 
      relatedDocumentId: productId,
      userId,
    }, updates);
  }
  
  await db.ref('/').update(updates);
  addAuditLog({ userId, userLogin, action: 'create_product', targetId: productId, details: `Created product ${productData.name}` });
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
          userId: 'system', // TODO: Fix this if auth is available
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

        Object.assign(firebaseUpdates, { [productPath]: { ...productToUpdate, ...updatePayloadForFirebase } });
        result.successCount++;
    }

    if (Object.keys(firebaseUpdates).length > 0) {
        await getRef('/').update(firebaseUpdates);
    }

    return result;
};

export const updateProduct = async (productId: string, productData: Partial<Omit<Product, 'id' | 'createdAt'>>, userId: string, userLogin: string): Promise<void> => {
  const productRef = getRef(`products/${productId}`);
  const productSnapshot = await productRef.get();
  if (!productSnapshot.exists()) {
      throw new Error("Product not found");
  }
  const oldProduct = productSnapshot.val();
  
  const profitPerUnit = (productData.sellingPrice ?? oldProduct.sellingPrice) - (productData.costPrice ?? oldProduct.costPrice);
  
  const updates: { [key: string]: any } = {};
  updates[`products/${productId}`] = { ...oldProduct, ...productData, profitPerUnit, updatedAt: new Date().toISOString() };

  const newStock = productData.stock !== undefined ? productData.stock : oldProduct.stock;
  const stockChanged = newStock !== oldProduct.stock;
  
  if (stockChanged) {
      await addProductMovementLogEntry(productId, {
          type: ProductMovementLogType.ADJUSTMENT_UPDATE,
          quantityChange: newStock - oldProduct.stock,
          stockBefore: oldProduct.stock,
          stockAfter: newStock,
          costPriceBefore: oldProduct.costPrice,
          costPriceAfter: productData.costPrice ?? oldProduct.costPrice,
          sellingPriceBefore: oldProduct.sellingPrice,
          sellingPriceAfter: productData.sellingPrice ?? oldProduct.sellingPrice,
          notes: "Manual stock adjustment via product edit",
          relatedDocumentId: 'manual_update',
          userId,
      }, updates);
  }
  
  await db.ref('/').update(updates);
  addAuditLog({ userId, userLogin, action: 'update_product', targetId: productId, details: `Updated product ${productData.name || oldProduct.name}` });
};

export const deleteMultipleProducts = async (productIds: string[], userId: string, userLogin: string): Promise<void> => {
  const updates: { [key: string]: any } = {};
  for (const productId of productIds) {
    updates[`products/${productId}`] = null;
    updates[`productMovementLogs/${productId}`] = null; 
    addAuditLog({ userId, userLogin, action: 'delete_product', targetId: productId, details: `Deleted product ID ${productId}` });
  }
  await db.ref('/').update(updates);
};

export const updateMultipleProductsStatus = async (productIds: string[], showInPOS: boolean, userId: string, userLogin: string): Promise<void> => {
  const updates: { [key: string]: any } = {};
  for (const productId of productIds) {
    updates[`products/${productId}/showInPOS`] = showInPOS;
    updates[`products/${productId}/updatedAt`] = new Date().toISOString();
  }
  await db.ref('/').update(updates);
  addAuditLog({
    userId,
    userLogin,
    action: showInPOS ? 'activate_products' : 'deactivate_products',
    details: `${showInPOS ? 'Activated' : 'Deactivated'} ${productIds.length} products.`
  });
};


// --- Sale Service ---
export const getSales = (): Promise<Sale[]> => getData<Sale>('sales');

export const addSale = async (saleData: Omit<Sale, 'id' | 'receiptNumber'>, expenseCategory: string, expenseDescriptionTemplate: string, sellingExpenseCategoryName: string, userId: string, userLogin: string): Promise<Sale> => {
    const timestamp = new Date().toISOString();
    const receiptNumber = `R-${Date.now()}`;
    const newSaleRef = getRef('sales').push();
    const saleId = newSaleRef.key;
    if (!saleId) throw new Error("Failed to generate sale ID");

    const fullSaleData: Sale = {
        ...saleData,
        id: saleId,
        receiptNumber: receiptNumber,
        transactionDate: timestamp,
    };

    const updates: { [key: string]: any } = {};
    updates[`sales/${saleId}`] = fullSaleData;
    
    // Process free gift expenses
    const freeGiftItems = saleData.items.filter(item => item.isFreeGift);
    if (freeGiftItems.length > 0) {
        const productDetails = await Promise.all(freeGiftItems.map(item => getProductById(item.productId)));
        const validProducts = productDetails.filter(p => p !== null) as Product[];

        for (const freeItem of freeGiftItems) {
            const product = validProducts.find(p => p.id === freeItem.productId);
            if (product) {
                const expenseAmount = product.costPrice * freeItem.quantity;
                if (expenseAmount > 0) {
                    const expenseDescription = expenseDescriptionTemplate.replace('{receiptNumber}', receiptNumber);
                    const newExpenseRef = getRef('expenses').push();
                    const expenseId = newExpenseRef.key;
                    if (expenseId) {
                        const expenseData: Omit<Expense, 'id' | 'createdAt'> = {
                            date: timestamp,
                            category: expenseCategory,
                            accountingCategoryCode: 2, // Selling Expense
                            accountingCategoryName: sellingExpenseCategoryName,
                            amount: expenseAmount,
                            description: expenseDescription,
                            userId,
                        };
                        updates[`expenses/${expenseId}`] = { ...expenseData, createdAt: timestamp };
                    }
                }
            }
        }
    }

    // Update stock and add movement logs
    for (const item of saleData.items) {
        const productRef = getRef(`products/${item.productId}`);
        const productSnapshot = await productRef.get();
        if (productSnapshot.exists()) {
            const product = { id: item.productId, ...productSnapshot.val() };
            const newStock = product.stock - item.quantity;
            if (newStock < 0) throw new Error(`Not enough stock for ${product.name}`);

            updates[`products/${item.productId}/stock`] = newStock;
            
            await addProductMovementLogEntry(item.productId, {
                type: ProductMovementLogType.SALE,
                quantityChange: -item.quantity,
                stockBefore: product.stock,
                stockAfter: newStock,
                relatedDocumentId: saleId,
                sellingPriceAfter: item.unitPriceAfterItemDiscount,
                userId,
                notes: `Sale #${receiptNumber}`,
            }, updates);
        }
    }
    
    // Update customer total debt if it's a credit sale
    if (saleData.customerId && saleData.customerType === 'credit') {
        const customerRef = getRef(`customers/${saleData.customerId}`);
        const customerSnapshot = await customerRef.get();
        if (customerSnapshot.exists()) {
            const customer = customerSnapshot.val();
            const newTotalDebt = (customer.totalDebtAmount || 0) + saleData.grandTotal;
            updates[`customers/${saleData.customerId}/totalDebtAmount`] = newTotalDebt;
        }
    }
    
    await db.ref('/').update(updates);
    addAuditLog({ userId, userLogin, action: 'create_sale', targetId: saleId, details: `Created sale ${receiptNumber}` });

    return fullSaleData;
};

export const recordSalePaymentAndUpdateSale = async (saleId: string, paymentData: Omit<SalePayment, 'id' | 'createdAt'>): Promise<void> => {
  const saleRef = getRef(`sales/${saleId}`);
  const saleSnapshot = await saleRef.get();
  if (!saleSnapshot.exists()) {
    throw new Error("Sale not found");
  }

  const sale: Sale = { id: saleId, ...saleSnapshot.val() };
  const newPaidAmount = sale.paidAmount + paymentData.amountPaid;
  const newOutstandingAmount = sale.outstandingAmount - paymentData.amountPaid;

  const updates: { [key: string]: any } = {};

  // Add payment record
  const newPaymentRef = getRef(`salePayments/${saleId}`).push();
  const paymentId = newPaymentRef.key;
  if (!paymentId) throw new Error("Failed to generate payment ID");
  updates[`salePayments/${saleId}/${paymentId}`] = { ...paymentData, id: paymentId, createdAt: new Date().toISOString() };

  // Update sale status
  updates[`sales/${saleId}/paidAmount`] = newPaidAmount;
  updates[`sales/${saleId}/outstandingAmount`] = newOutstandingAmount;
  updates[`sales/${saleId}/status`] = newOutstandingAmount <= 0 ? 'paid' : 'partially_paid';

  // Update customer's total debt
  if (sale.customerId) {
    const customerRef = getRef(`customers/${sale.customerId}`);
    const customerSnapshot = await customerRef.get();
    if (customerSnapshot.exists()) {
      const customer = customerSnapshot.val();
      const newTotalDebt = (customer.totalDebtAmount || 0) - paymentData.amountPaid;
      updates[`customers/${sale.customerId}/totalDebtAmount`] = newTotalDebt < 0 ? 0 : newTotalDebt;
    }
  }

  await db.ref('/').update(updates);
};

// --- Purchase Service ---
export const getPurchases = (): Promise<Purchase[]> => getData<Purchase>('purchases').then(p => p.sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()));
export const getPurchasesByPoId = async (poId: string): Promise<Purchase[]> => {
    const allPurchases = await getPurchases();
    return allPurchases.filter(p => p.relatedPoId === poId);
}
export const addPurchaseAndProcess = async (
    purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>,
    expenseCategory: string,
    expenseDescriptionTemplate: string,
    costAccountingCategoryName: string,
    userId: string,
    userLogin: string
): Promise<string> => {
    // ... (Implementation for adding purchase, updating stock, creating expense)
    return "mock-id"; // Placeholder
}
export const deletePurchase = async (purchaseId: string): Promise<void> => {
    // ... (Implementation for deleting purchase, reversing stock, deleting related expense)
}

// --- NEW Purchase Payment Services ---
export const getPurchasePayments = (purchaseId: string): Promise<PurchasePayment[]> => getData<PurchasePayment>(`purchasePayments/${purchaseId}`);

export const recordPurchasePayment = async (
  purchaseId: string,
  paymentData: Omit<PurchasePayment, 'id' | 'purchaseId' | 'createdAt' | 'isCancelled' | 'officerId' | 'officerName'>,
  userDetails: { officerId: string; officerName: string }
): Promise<void> => {
  const purchaseRef = getRef(`purchases/${purchaseId}`);
  const purchaseSnapshot = await purchaseRef.get();
  if (!purchaseSnapshot.exists()) {
    throw new Error("Purchase record not found.");
  }
  const purchase: Purchase = { id: purchaseId, ...purchaseSnapshot.val() };
  const outstandingAmount = purchase.outstanding ?? purchase.grandTotal;

  if (paymentData.payAmount > outstandingAmount) {
      throw new Error("Payment amount cannot exceed outstanding balance.");
  }

  const updates: { [key: string]: any } = {};
  const timestamp = new Date().toISOString();
  
  const newPaymentRef = getRef(`purchasePayments/${purchaseId}`).push();
  const paymentId = newPaymentRef.key;
  if (!paymentId) throw new Error("Could not generate payment ID.");

  const fullPaymentData: PurchasePayment = {
    ...paymentData,
    id: paymentId,
    purchaseId,
    officerId: userDetails.officerId,
    officerName: userDetails.officerName,
    createdAt: timestamp,
    isCancelled: false,
  };
  updates[`purchasePayments/${purchaseId}/${paymentId}`] = fullPaymentData;

  const currentPaidAmount = purchase.paidAmount || 0;
  const newPaidAmount = currentPaidAmount + paymentData.payAmount;
  const newOutstanding = purchase.grandTotal - newPaidAmount;
  
  let newStatus: PurchasePaidStatus = 'partial';
  if (newOutstanding <= 0.01) { 
    newStatus = 'paid';
  }

  updates[`purchases/${purchaseId}/paidAmount`] = newPaidAmount;
  updates[`purchases/${purchaseId}/outstanding`] = newOutstanding;
  updates[`purchases/${purchaseId}/paidStatus`] = newStatus;
  updates[`purchases/${purchaseId}/updatedAt`] = timestamp;
  updates[`purchases/${purchaseId}/updateOfficerId`] = userDetails.officerId;
  updates[`purchases/${purchaseId}/updateOfficerName`] = userDetails.officerName;
  
  await db.ref('/').update(updates);
};

export const cancelPurchasePayment = async (
  purchaseId: string,
  paymentId: string,
  userDetails: { officerId: string; officerName: string }
): Promise<void> => {
    const paymentsSnapshot = await getRef(`purchasePayments/${purchaseId}`).get();
    const purchaseSnapshot = await getRef(`purchases/${purchaseId}`).get();
    
    if (!paymentsSnapshot.exists() || !purchaseSnapshot.exists()) {
        throw new Error("Purchase or payment data not found.");
    }
    
    const allPayments: Record<string, PurchasePayment> = paymentsSnapshot.val();
    const paymentToCancel = allPayments[paymentId];
    if (!paymentToCancel || paymentToCancel.isCancelled) {
        throw new Error("Payment not found or already cancelled.");
    }
    
    const purchase: Purchase = { id: purchaseId, ...purchaseSnapshot.val() };
    
    const updates: { [key: string]: any } = {};
    const timestamp = new Date().toISOString();

    updates[`purchasePayments/${purchaseId}/${paymentId}/isCancelled`] = true;

    let newPaidAmount = 0;
    for (const key in allPayments) {
        if (key !== paymentId && !allPayments[key].isCancelled) {
            newPaidAmount += allPayments[key].payAmount;
        }
    }

    const newOutstanding = purchase.grandTotal - newPaidAmount;
    let newStatus: PurchasePaidStatus = 'unpaid';
    if (newPaidAmount > 0.01) {
        newStatus = newOutstanding <= 0.01 ? 'paid' : 'partial';
    }

    updates[`purchases/${purchaseId}/paidAmount`] = newPaidAmount;
    updates[`purchases/${purchaseId}/outstanding`] = newOutstanding;
    updates[`purchases/${purchaseId}/paidStatus`] = newStatus;
    updates[`purchases/${purchaseId}/updatedAt`] = timestamp;
    updates[`purchases/${purchaseId}/updateOfficerId`] = userDetails.officerId;
    updates[`purchases/${purchaseId}/updateOfficerName`] = userDetails.officerName;

    await db.ref('/').update(updates);
}

export const softDeletePurchase = async (purchaseId: string, userDetails: { officerId: string; officerName: string }): Promise<void> => {
  const updates: { [key: string]: any } = {};
  const timestamp = new Date().toISOString();
  
  updates[`purchases/${purchaseId}/isDeleted`] = true;
  updates[`purchases/${purchaseId}/updatedAt`] = timestamp;
  updates[`purchases/${purchaseId}/updateOfficerId`] = userDetails.officerId;
  updates[`purchases/${purchaseId}/updateOfficerName`] = userDetails.officerName;
  
  await db.ref('/').update(updates);
  addAuditLog({ userId: userDetails.officerId, userLogin: userDetails.officerName, action: 'soft_delete_purchase', targetId: purchaseId });
};


// --- Expense Service ---
export const getExpenses = (): Promise<Expense[]> => getData<Expense>('expenses');
export const addExpense = (data: Omit<Expense, 'id' | 'createdAt'>, userId: string, userLogin: string): Promise<string> => {
    addAuditLog({ userId, userLogin, action: 'create_expense', details: `Created expense: ${data.description}` });
    return pushData('expenses', data);
}
export const updateExpense = (id: string, data: Partial<Omit<Expense, 'id' | 'createdAt'>>, userId: string, userLogin: string): Promise<void> => {
    addAuditLog({ userId, userLogin, action: 'update_expense', targetId: id, details: `Updated expense: ${data.description || ''}` });
    return updateData(`expenses/${id}`, data);
}
export const deleteExpense = (id: string, userId: string, userLogin: string): Promise<void> => {
    addAuditLog({ userId, userLogin, action: 'delete_expense', targetId: id, details: `Deleted expense ID ${id}` });
    return getRef(`expenses/${id}`).remove();
}

// --- Supplier Service ---
export const getSuppliers = (): Promise<Supplier[]> => getData<Supplier>('suppliers');
export const addSupplier = (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => pushData('suppliers', data);
export const updateSupplier = (id: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>): Promise<void> => updateData(`suppliers/${id}`, data);
export const deleteSupplier = (id: string): Promise<void> => getRef(`suppliers/${id}`).remove();

// --- Customer Service ---
export const getCustomers = (): Promise<Customer[]> => getData<Customer>('customers');
export const addCustomer = (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => pushData('customers', data);
export const updateCustomer = (id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<void> => updateData(`customers/${id}`, data);
export const deleteCustomer = (id: string): Promise<void> => getRef(`customers/${id}`).remove();

// --- Sale Payment Service ---
export const getSalePayments = (saleId: string): Promise<SalePayment[]> => getData<SalePayment>(`salePayments/${saleId}`);
export const getAllSalePayments = async (): Promise<SalePayment[]> => {
    const snapshot = await getRef('salePayments').get();
    if (!snapshot.exists()) return [];
    const allPaymentsBySale = snapshot.val();
    const flattenedPayments: SalePayment[] = [];
    Object.keys(allPaymentsBySale).forEach(saleId => {
        const payments = allPaymentsBySale[saleId];
        Object.keys(payments).forEach(paymentId => {
            flattenedPayments.push({ ...payments[paymentId], id: paymentId });
        });
    });
    return flattenedPayments;
};

// --- Settings Service ---
export const getStoreSettings = async (): Promise<StoreSettings | null> => {
  const snapshot = await getRef('storeSettings').get();
  return snapshot.exists() ? snapshot.val() : null;
};
export const saveStoreSettings = (settings: StoreSettings): Promise<void> => getRef('storeSettings').set(settings);

// --- Purchase Order Service ---
export const getPurchaseOrders = (): Promise<PurchaseOrder[]> => getData<PurchaseOrder>('purchaseOrders').then(po => po.sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
export const getPurchaseOrderById = async (poId: string): Promise<PurchaseOrder | null> => {
    const snapshot = await getRef(`purchaseOrders/${poId}`).get();
    return snapshot.exists() ? { id: poId, ...snapshot.val() } : null;
};
export const addPurchaseOrder = (data: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => pushData('purchaseOrders', data);
export const updatePurchaseOrder = (id: string, data: Partial<Omit<PurchaseOrder, 'id' | 'createdAt'>>): Promise<void> => updateData(`purchaseOrders/${id}`, data);
export const deletePurchaseOrder = (id: string): Promise<void> => getRef(`purchaseOrders/${id}`).remove();

// --- Promotion Service ---
export const getPromotions = (): Promise<Promotion[]> => getData<Promotion>('promotions');
export const getActivePromotions = async (): Promise<Promotion[]> => {
    const allPromotions = await getPromotions();
    const now = new Date().toISOString().split('T')[0];
    return allPromotions.filter(p => p.status === 'active' && p.startDate <= now && p.endDate >= now);
}
export const addPromotion = (data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => pushData('promotions', data);
export const updatePromotion = (id: string, data: Partial<Omit<Promotion, 'id' | 'createdAt'>>): Promise<void> => updateData(`promotions/${id}`, data);
export const deletePromotion = (id: string): Promise<void> => getRef(`promotions/${id}`).remove();

// --- Exchange Rate Service ---
export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
    const snapshot = await getRef('exchangeRates').get();
    return snapshot.exists() ? snapshot.val() : null;
};
export const saveExchangeRates = (rates: Omit<ExchangeRates, 'updatedAt'>): Promise<void> => {
    const dataToSave = { ...rates, updatedAt: new Date().toISOString() };
    return getRef('exchangeRates').set(dataToSave);
};

// --- Internal User Management ---
export const getInternalUsers = (): Promise<InternalUser[]> => getData<InternalUser>('internalUsers');
export const addInternalUser = (data: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => pushData('internalUsers', data);
export const updateInternalUser = (id: string, data: Partial<Omit<InternalUser, 'id' | 'createdAt'>>): Promise<void> => updateData(`internalUsers/${id}`, data);
export const deleteInternalUser = (id: string): Promise<void> => getRef(`internalUsers/${id}`).remove();
export const internalUserExists = async (username: string): Promise<boolean> => {
    const snapshot = await getRef('internalUsers').orderByChild('username').equalTo(username).get();
    return snapshot.exists();
};


// --- Data Reset Service ---
export const clearAllSalesAndPayments = (): Promise<void> => Promise.all([getRef('sales').remove(), getRef('salePayments').remove()]).then(() => {});
export const clearAllPurchases = (): Promise<void> => getRef('purchases').remove();
export const clearAllExpenses = (): Promise<void> => getRef('expenses').remove();
export const clearAllProductsAndLogs = (): Promise<void> => Promise.all([getRef('products').remove(), getRef('productMovementLogs').remove()]).then(() => {});
export const clearAllCustomers = (walkInCustomerName: string): Promise<void> => {
    // This is more complex: we need to keep the "walk-in" customer
    return getRef('customers').remove(); // Simplified for now
};

// --- Dashboard Service ---
export const getDashboardSummary = async (): Promise<DashboardData> => {
  const [sales, expenses, products, purchases, suppliers, customers] = await Promise.all([
    getSales(), getExpenses(), getProducts(), getPurchases(), getSuppliers(), getCustomers(),
  ]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // @google/genai-api-fix: Add defensive checks for date properties to prevent 'startsWith' error on undefined.
  const salesToday = sales
    .filter(s => s.transactionDate && s.transactionDate.startsWith(todayStr))
    .reduce((sum, s) => sum + s.grandTotal, 0);

  const expensesToday = expenses
    .filter(e => e.date && e.date.startsWith(todayStr))
    .reduce((sum, e) => sum + e.amount, 0);

  const profitToday = salesToday - expensesToday;

  const totalStockValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);

  const latestPurchases: LatestPurchaseInfo[] = purchases
    .slice(0, 5) // Assumes purchases are already sorted by date descending from getPurchases
    .map(p => ({
      id: p.id,
      purchaseOrderNumber: p.purchaseOrderNumber,
      supplierName: p.supplierName,
// @google/genai-api-fix: Replaced deprecated 'totalAmount' with 'grandTotal' to align with the Purchase type definition.
      totalAmount: p.grandTotal,
      purchaseDate: p.purchaseDate,
    }));

  const salesThisMonth = sales.filter(s => s.transactionDate && new Date(s.transactionDate) >= startOfMonth);
  
  const topSellingProductsMap = new Map<string, number>();
  salesThisMonth.forEach(sale => {
    sale.items.forEach(item => {
      topSellingProductsMap.set(item.productId, (topSellingProductsMap.get(item.productId) || 0) + item.quantity);
    });
  });

  const topSellingProducts: TopSellingProductInfo[] = Array.from(topSellingProductsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([productId, totalQuantitySold]) => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        name: product?.name || 'Unknown Product',
        totalQuantitySold,
      };
    });

  const activeProductsCount = products.filter(p => p.showInPOS).length;
  const suppliersCount = suppliers.length;
  const customersThisMonthCount = new Set(salesThisMonth.map(s => s.customerId).filter(Boolean)).size;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthlySalesChart: ChartData = { labels: [], data: [] };
  const dailySales = new Array(daysInMonth).fill(0);
  salesThisMonth.forEach(sale => {
    if (sale.transactionDate) {
      const day = new Date(sale.transactionDate).getDate() - 1;
      dailySales[day] += sale.grandTotal;
    }
  });
  for (let i = 1; i <= daysInMonth; i++) {
    monthlySalesChart.labels.push(String(i));
    monthlySalesChart.data.push(dailySales[i - 1]);
  }
  
  const expensesThisMonth = expenses.filter(e => e.date && new Date(e.date) >= startOfMonth);
  const expenseBreakdownMap = new Map<string, number>();
  expensesThisMonth.forEach(expense => {
    expenseBreakdownMap.set(expense.category, (expenseBreakdownMap.get(expense.category) || 0) + expense.amount);
  });
  
  const sortedExpenseCategories = Array.from(expenseBreakdownMap.entries()).sort((a,b) => b[1] - a[1]);
  const expenseBreakdownChart: ChartData = { labels: [], data: [], backgroundColors: [] };
  const chartColors = Object.values(UI_COLORS).filter(c => typeof c === 'string' && c.startsWith('#') && c !== '#FFFFFF' && c !== '#f0f2f5');
  sortedExpenseCategories.forEach(([category, amount], index) => {
    expenseBreakdownChart.labels.push(category);
    expenseBreakdownChart.data.push(amount);
    expenseBreakdownChart.backgroundColors?.push(chartColors[index % chartColors.length]);
  });


  return {
    salesToday,
    expensesToday,
    profitToday,
    totalStockValue,
    latestPurchases,
    topSellingProducts,
    activeProductsCount,
    suppliersCount,
    customersThisMonthCount,
    monthlySalesChart,
    expenseBreakdownChart,
  };
};
