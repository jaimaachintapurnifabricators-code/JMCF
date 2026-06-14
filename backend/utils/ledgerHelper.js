const db = require('../config/dbService');

/**
 * Helper to convert transaction quantity to product catalog unit
 */
function getQuantityInProductUnit(txQty, txUnit, prodUnit) {
  const tUnit = (txUnit || 'Kg').toLowerCase().trim();
  const pUnit = (prodUnit || 'Kg').toLowerCase().trim();
  
  if (tUnit === 'ton' && pUnit === 'kg') {
    return Number(txQty) * 1000;
  }
  if (tUnit === 'kg' && pUnit === 'ton') {
    return Number(txQty) / 1000;
  }
  return Number(txQty);
}

/**
 * Adjust stock when a purchase is made
 */
async function updateInventoryForPurchase(materialName, category, quantity, unit, rate) {
  const normName = materialName.trim();
  const product = await db.findOne('products', { name: normName });

  if (product) {
    const convertedQty = getQuantityInProductUnit(quantity, unit, product.unit);
    const purchasedQty = (Number(product.purchasedQty) || 0) + convertedQty;
    const openingStock = Number(product.openingStock) || 0;
    const soldQty = Number(product.soldQty) || 0;
    const currentStock = openingStock + purchasedQty - soldQty;

    await db.updateOne('products', { _id: product._id }, {
      category: category || product.category,
      purchasedQty,
      currentStock,
      rate: Number(rate), // Update last rate
      unit: product.unit // Keep product catalog unit
    });
  } else {
    // Create new product
    // Default to the logged transaction unit (if it's Ton, keep it or convert, let's keep it)
    await db.insertOne('products', {
      name: normName,
      category: category || 'General',
      openingStock: 0,
      purchasedQty: Number(quantity),
      soldQty: 0,
      currentStock: Number(quantity),
      unit: unit || 'Kg',
      rate: Number(rate),
      minStockLevel: 5 // Default threshold
    });
  }
}

/**
 * Revert stock when a purchase is deleted or edited
 */
async function revertInventoryForPurchase(materialName, quantity, unit) {
  const normName = materialName.trim();
  const product = await db.findOne('products', { name: normName });

  if (product) {
    const convertedQty = getQuantityInProductUnit(quantity, unit, product.unit);
    const purchasedQty = Math.max(0, (Number(product.purchasedQty) || 0) - convertedQty);
    const openingStock = Number(product.openingStock) || 0;
    const soldQty = Number(product.soldQty) || 0;
    const currentStock = openingStock + purchasedQty - soldQty;

    await db.updateOne('products', { _id: product._id }, {
      purchasedQty,
      currentStock
    });
  }
}

/**
 * Adjust stock when a sale is made
 */
async function updateInventoryForSale(materialName, quantity, unit) {
  const normName = materialName.trim();
  const product = await db.findOne('products', { name: normName });

  if (product) {
    const convertedQty = getQuantityInProductUnit(quantity, unit, product.unit);
    const soldQty = (Number(product.soldQty) || 0) + convertedQty;
    const openingStock = Number(product.openingStock) || 0;
    const purchasedQty = Number(product.purchasedQty) || 0;
    const currentStock = openingStock + purchasedQty - soldQty;

    await db.updateOne('products', { _id: product._id }, {
      soldQty,
      currentStock
    });
  } else {
    // If selling something not previously purchased (back-order allowed)
    await db.insertOne('products', {
      name: normName,
      category: 'General',
      openingStock: 0,
      purchasedQty: 0,
      soldQty: Number(quantity),
      currentStock: -Number(quantity),
      unit: unit || 'Kg',
      rate: 0,
      minStockLevel: 5
    });
  }
}

/**
 * Revert stock when a sale is deleted or edited
 */
async function revertInventoryForSale(materialName, quantity, unit) {
  const normName = materialName.trim();
  const product = await db.findOne('products', { name: normName });

  if (product) {
    const convertedQty = getQuantityInProductUnit(quantity, unit, product.unit);
    const soldQty = Math.max(0, (Number(product.soldQty) || 0) - convertedQty);
    const openingStock = Number(product.openingStock) || 0;
    const purchasedQty = Number(product.purchasedQty) || 0;
    const currentStock = openingStock + purchasedQty - soldQty;

    await db.updateOne('products', { _id: product._id }, {
      soldQty,
      currentStock
    });
  }
}

/**
 * Adjust supplier outstanding payments
 */
async function updateSupplierLedger(name, mobile, address, gst, totalAmount, paymentStatus) {
  const normName = name.trim();
  const supplier = await db.findOne('suppliers', { name: normName });
  const isUnpaid = paymentStatus.toLowerCase() !== 'paid';
  const outstandingDelta = isUnpaid ? Number(totalAmount) : 0;

  if (supplier) {
    const outstandingPayments = (Number(supplier.outstandingPayments) || 0) + outstandingDelta;
    await db.updateOne('suppliers', { _id: supplier._id }, {
      mobile: mobile || supplier.mobile,
      address: address || supplier.address,
      gstNumber: gst || supplier.gstNumber,
      outstandingPayments
    });
  } else {
    await db.insertOne('suppliers', {
      name: normName,
      mobile: mobile || '',
      address: address || '',
      gstNumber: gst || '',
      outstandingPayments: outstandingDelta
    });
  }
}

/**
 * Revert supplier outstanding payments
 */
async function revertSupplierLedger(name, totalAmount, paymentStatus) {
  const normName = name.trim();
  const supplier = await db.findOne('suppliers', { name: normName });
  const isUnpaid = paymentStatus.toLowerCase() !== 'paid';
  const outstandingDelta = isUnpaid ? Number(totalAmount) : 0;

  if (supplier) {
    const outstandingPayments = Math.max(0, (Number(supplier.outstandingPayments) || 0) - outstandingDelta);
    await db.updateOne('suppliers', { _id: supplier._id }, {
      outstandingPayments
    });
  }
}

/**
 * Adjust customer outstanding balance
 */
async function updateCustomerLedger(name, mobile, address, gst, totalAmount, paymentMethod) {
  const normName = name.trim();
  const customer = await db.findOne('customers', { name: normName });
  
  // Credit sales go to outstanding balance
  const isCredit = paymentMethod.toLowerCase() === 'credit';
  const outstandingDelta = isCredit ? Number(totalAmount) : 0;

  if (customer) {
    const outstandingBalance = (Number(customer.outstandingBalance) || 0) + outstandingDelta;
    await db.updateOne('customers', { _id: customer._id }, {
      mobile: mobile || customer.mobile,
      address: address || customer.address,
      gstNumber: gst || customer.gstNumber,
      outstandingBalance
    });
  } else {
    await db.insertOne('customers', {
      name: normName,
      mobile: mobile || '',
      address: address || '',
      gstNumber: gst || '',
      outstandingBalance: outstandingDelta
    });
  }
}

/**
 * Revert customer outstanding balance
 */
async function revertCustomerLedger(name, totalAmount, paymentMethod) {
  const normName = name.trim();
  const customer = await db.findOne('customers', { name: normName });
  const isCredit = paymentMethod.toLowerCase() === 'credit';
  const outstandingDelta = isCredit ? Number(totalAmount) : 0;

  if (customer) {
    const outstandingBalance = Math.max(0, (Number(customer.outstandingBalance) || 0) - outstandingDelta);
    await db.updateOne('customers', { _id: customer._id }, {
      outstandingBalance
    });
  }
}

module.exports = {
  updateInventoryForPurchase,
  revertInventoryForPurchase,
  updateInventoryForSale,
  revertInventoryForSale,
  updateSupplierLedger,
  revertSupplierLedger,
  updateCustomerLedger,
  revertCustomerLedger
};
