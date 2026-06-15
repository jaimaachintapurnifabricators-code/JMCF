const express = require('express');
const router = express.Router();
const db = require('../config/dbService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const {
  updateInventoryForSale,
  revertInventoryForSale,
  updateCustomerLedger,
  revertCustomerLedger
} = require('../utils/ledgerHelper');

// Get all sales
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sales = await db.find('sales');
    // Sort descending by date
    sales.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

    // If partner, they can see all sales, but we can flag their own
    res.json({ success: true, sales });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create sales invoice
router.post('/', authenticateToken, async (req, res) => {
  const {
    saleDate,
    customerName,
    customerMobile,
    customerAddress,
    customerGST,
    paymentMethod,
    totalAmount
  } = req.body;

  let items = req.body.items;
  
  // Backward compatibility check
  if (!items || !Array.isArray(items) || items.length === 0) {
    items = [{
      productName: req.body.productName,
      quantity: Number(req.body.quantity),
      unit: req.body.unit || 'Kg',
      rate: Number(req.body.rate),
      rateBasis: req.body.rateBasis || 'per_kg',
      discount: Number(req.body.discount || 0),
      gstPercent: Number(req.body.gstPercent || 0)
    }];
  }

  // Validate required fields
  if (!customerName || !paymentMethod || !totalAmount || !items[0].productName || !items[0].quantity || !items[0].rate) {
    return res.status(400).json({ success: false, message: 'Required fields are missing' });
  }

  try {
    // Auto generate invoice number JMCF-INV-XXXX
    const sales = await db.find('sales');
    const invoiceSeq = 1001 + sales.length;
    const invoiceNumber = `JMCF-INV-${invoiceSeq}`;

    const newSale = await db.insertOne('sales', {
      invoiceNumber,
      saleDate: saleDate || new Date().toISOString().split('T')[0],
      customerName: customerName.trim(),
      customerMobile: customerMobile || '',
      customerAddress: customerAddress || '',
      customerGST: customerGST || '',
      // Legacy fields for backward compatibility
      productName: items[0].productName.trim(),
      quantity: Number(items[0].quantity),
      unit: items[0].unit || 'Kg',
      rate: Number(items[0].rate),
      rateBasis: items[0].rateBasis || 'per_kg',
      discount: Number(items[0].discount || 0),
      gstPercent: Number(items[0].gstPercent || 0),
      // Multi-item details
      items: items.map(item => ({
        productName: item.productName.trim(),
        quantity: Number(item.quantity),
        unit: item.unit || 'Kg',
        rate: Number(item.rate),
        rateBasis: item.rateBasis || 'per_kg',
        discount: Number(item.discount || 0),
        gstPercent: Number(item.gstPercent || 0)
      })),
      totalAmount: Number(totalAmount),
      paymentMethod: paymentMethod || 'Cash',
      createdBy: req.user.username,
      createdById: req.user.id
    });

    // Deduct stock from inventory for each item
    for (const item of items) {
      await updateInventoryForSale(item.productName, item.quantity, item.unit || 'Kg');
    }

    // Update customer ledger
    await updateCustomerLedger(
      customerName,
      customerMobile,
      customerAddress,
      customerGST,
      totalAmount,
      paymentMethod
    );

    // Activity log
    const itemsDesc = items.map(it => `${it.productName} (${it.quantity} ${it.unit || 'Kg'})`).join(', ');
    await logActivity(
      req.user,
      'SALE_CREATE',
      `Created invoice ${invoiceNumber} for ${customerName}. Items: ${itemsDesc}, Total: ₹${totalAmount}.`
    );

    res.status(201).json({ success: true, sale: newSale });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Edit invoice (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    saleDate,
    customerName,
    customerMobile,
    customerAddress,
    customerGST,
    totalAmount,
    paymentMethod
  } = req.body;

  try {
    const oldSale = await db.findOne('sales', { _id: id });
    if (!oldSale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }

    // 1. Revert old stock deduction for all old items
    const oldItems = oldSale.items || [{
      productName: oldSale.productName,
      quantity: oldSale.quantity,
      unit: oldSale.unit || 'Kg'
    }];
    for (const item of oldItems) {
      await revertInventoryForSale(item.productName, item.quantity, item.unit || 'Kg');
    }

    // 2. Revert old customer ledger outstanding
    await revertCustomerLedger(oldSale.customerName, oldSale.totalAmount, oldSale.paymentMethod);

    // 3. Parse updated items array or construct from single field parameters
    let items = req.body.items;
    if (!items) {
      if (req.body.productName || req.body.quantity) {
        items = [{
          productName: req.body.productName || oldSale.productName,
          quantity: Number(req.body.quantity !== undefined ? req.body.quantity : oldSale.quantity),
          unit: req.body.unit || oldSale.unit || 'Kg',
          rate: Number(req.body.rate !== undefined ? req.body.rate : oldSale.rate),
          rateBasis: req.body.rateBasis || oldSale.rateBasis || 'per_kg',
          discount: Number(req.body.discount !== undefined ? req.body.discount : oldSale.discount || 0),
          gstPercent: Number(req.body.gstPercent !== undefined ? req.body.gstPercent : oldSale.gstPercent || 0)
        }];
      } else {
        items = oldSale.items || [{
          productName: oldSale.productName,
          quantity: oldSale.quantity,
          unit: oldSale.unit || 'Kg',
          rate: oldSale.rate,
          rateBasis: oldSale.rateBasis || 'per_kg',
          discount: oldSale.discount || 0,
          gstPercent: oldSale.gstPercent || 0
        }];
      }
    }

    // 4. Update the sale document
    const updatedFields = {
      saleDate: saleDate || oldSale.saleDate,
      customerName: customerName ? customerName.trim() : oldSale.customerName,
      customerMobile: customerMobile !== undefined ? customerMobile : oldSale.customerMobile,
      customerAddress: customerAddress !== undefined ? customerAddress : oldSale.customerAddress,
      customerGST: customerGST !== undefined ? customerGST : oldSale.customerGST,
      // Legacy fields for backward compatibility
      productName: items[0].productName.trim(),
      quantity: Number(items[0].quantity),
      unit: items[0].unit || 'Kg',
      rate: Number(items[0].rate),
      rateBasis: items[0].rateBasis || 'per_kg',
      discount: Number(items[0].discount || 0),
      gstPercent: Number(items[0].gstPercent || 0),
      // Multi-item details
      items: items.map(item => ({
        productName: item.productName.trim(),
        quantity: Number(item.quantity),
        unit: item.unit || 'Kg',
        rate: Number(item.rate),
        rateBasis: item.rateBasis || 'per_kg',
        discount: Number(item.discount || 0),
        gstPercent: Number(item.gstPercent || 0)
      })),
      totalAmount: totalAmount !== undefined ? Number(totalAmount) : oldSale.totalAmount,
      paymentMethod: paymentMethod || oldSale.paymentMethod
    };

    const result = await db.updateOne('sales', { _id: id }, updatedFields);

    // 5. Apply new stock deduction for each item
    for (const item of updatedFields.items) {
      await updateInventoryForSale(item.productName, item.quantity, item.unit || 'Kg');
    }

    // 6. Update customer ledger
    await updateCustomerLedger(
      updatedFields.customerName,
      updatedFields.customerMobile,
      updatedFields.customerAddress,
      updatedFields.customerGST,
      updatedFields.totalAmount,
      updatedFields.paymentMethod
    );

    // Log Activity
    const itemsDesc = updatedFields.items.map(it => `${it.productName} (${it.quantity} ${it.unit || 'Kg'})`).join(', ');
    await logActivity(
      req.user,
      'SALE_UPDATE',
      `Modified invoice ${oldSale.invoiceNumber} for ${updatedFields.customerName}. Items: ${itemsDesc}, Total: ₹${updatedFields.totalAmount}.`
    );

    res.json({ success: true, sale: result.doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete invoice (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const sale = await db.findOne('sales', { _id: id });
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }

    // 1. Revert inventory for all items
    const oldItems = sale.items || [{
      productName: sale.productName,
      quantity: sale.quantity,
      unit: sale.unit || 'Kg'
    }];
    for (const item of oldItems) {
      await revertInventoryForSale(item.productName, item.quantity, item.unit || 'Kg');
    }

    // 2. Revert customer ledger balance
    await revertCustomerLedger(sale.customerName, sale.totalAmount, sale.paymentMethod);

    // 3. Delete invoice from DB
    await db.deleteOne('sales', { _id: id });

    // Activity log
    await logActivity(
      req.user,
      'SALE_DELETE',
      `Deleted invoice ${sale.invoiceNumber} for ${sale.customerName} (Product: ${sale.productName}, Qty: ${sale.quantity} ${sale.unit || 'Kg'}).`
    );

    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
