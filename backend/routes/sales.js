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
    productName,
    quantity,
    unit,
    rate,
    discount,
    gstPercent,
    totalAmount,
    paymentMethod
  } = req.body;

  if (!customerName || !productName || !quantity || !rate || !totalAmount || !paymentMethod) {
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
      productName: productName.trim(),
      quantity: Number(quantity),
      unit: unit || 'Kg',
      rate: Number(rate),
      discount: Number(discount || 0),
      gstPercent: Number(gstPercent || 0),
      totalAmount: Number(totalAmount),
      paymentMethod: paymentMethod || 'Cash',
      createdBy: req.user.username,
      createdById: req.user.id
    });

    // Deduct stock from inventory (applying unit)
    await updateInventoryForSale(productName, quantity, unit || 'Kg');

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
    await logActivity(
      req.user,
      'SALE_CREATE',
      `Created invoice ${invoiceNumber} for ${customerName}. Product: ${productName}, Qty: ${quantity} ${unit || 'Kg'}, Total: ₹${totalAmount}.`
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
    productName,
    quantity,
    unit,
    rate,
    discount,
    gstPercent,
    totalAmount,
    paymentMethod
  } = req.body;

  try {
    const oldSale = await db.findOne('sales', { _id: id });
    if (!oldSale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }

    // 1. Revert old stock deduction
    await revertInventoryForSale(oldSale.productName, oldSale.quantity, oldSale.unit || 'Kg');

    // 2. Revert old customer ledger outstanding
    await revertCustomerLedger(oldSale.customerName, oldSale.totalAmount, oldSale.paymentMethod);

    // 3. Update the sale document
    const updatedFields = {
      saleDate: saleDate || oldSale.saleDate,
      customerName: customerName ? customerName.trim() : oldSale.customerName,
      customerMobile: customerMobile !== undefined ? customerMobile : oldSale.customerMobile,
      customerAddress: customerAddress !== undefined ? customerAddress : oldSale.customerAddress,
      customerGST: customerGST !== undefined ? customerGST : oldSale.customerGST,
      productName: productName ? productName.trim() : oldSale.productName,
      quantity: quantity !== undefined ? Number(quantity) : oldSale.quantity,
      unit: unit || oldSale.unit || 'Kg',
      rate: rate !== undefined ? Number(rate) : oldSale.rate,
      discount: discount !== undefined ? Number(discount) : oldSale.discount,
      gstPercent: gstPercent !== undefined ? Number(gstPercent) : oldSale.gstPercent,
      totalAmount: totalAmount !== undefined ? Number(totalAmount) : oldSale.totalAmount,
      paymentMethod: paymentMethod || oldSale.paymentMethod
    };

    const result = await db.updateOne('sales', { _id: id }, updatedFields);

    // 4. Apply new stock deduction and customer ledger outstanding
    await updateInventoryForSale(updatedFields.productName, updatedFields.quantity, updatedFields.unit);
    await updateCustomerLedger(
      updatedFields.customerName,
      updatedFields.customerMobile,
      updatedFields.customerAddress,
      updatedFields.customerGST,
      updatedFields.totalAmount,
      updatedFields.paymentMethod
    );

    // Log Activity
    await logActivity(
      req.user,
      'SALE_UPDATE',
      `Modified invoice ${oldSale.invoiceNumber} (Customer: ${updatedFields.customerName}, Product: ${updatedFields.productName}).`
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

    // 1. Revert inventory
    await revertInventoryForSale(sale.productName, sale.quantity, sale.unit || 'Kg');

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
