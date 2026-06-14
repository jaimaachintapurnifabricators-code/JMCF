const express = require('express');
const router = express.Router();
const db = require('../config/dbService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const {
  updateInventoryForPurchase,
  revertInventoryForPurchase,
  updateSupplierLedger,
  revertSupplierLedger
} = require('../utils/ledgerHelper');

// Get all purchases (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const purchases = await db.find('purchases');
    // Sort descending by date
    purchases.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    res.json({ success: true, purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add purchase (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const {
    purchaseDate,
    supplierName,
    supplierMobile,
    supplierGST,
    materialName,
    category,
    quantity,
    unit,
    rate,
    gstPercent,
    transportCharges,
    totalAmount,
    paymentStatus
  } = req.body;

  if (!supplierName || !materialName || !quantity || !rate || !totalAmount) {
    return res.status(400).json({ success: false, message: 'Required fields are missing' });
  }

  try {
    const newPurchase = await db.insertOne('purchases', {
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
      supplierName: supplierName.trim(),
      supplierMobile: supplierMobile || '',
      supplierGST: supplierGST || '',
      materialName: materialName.trim(),
      category: category || 'General',
      quantity: Number(quantity),
      unit: unit || 'Kg',
      rate: Number(rate),
      gstPercent: Number(gstPercent || 0),
      transportCharges: Number(transportCharges || 0),
      totalAmount: Number(totalAmount),
      paymentStatus: paymentStatus || 'Unpaid',
      createdBy: req.user.username
    });

    // Automatically adjust inventory
    await updateInventoryForPurchase(materialName, category, quantity, unit, rate);

    // Automatically update supplier ledger
    await updateSupplierLedger(supplierName, supplierMobile, '', supplierGST, totalAmount, paymentStatus);

    // Activity log
    await logActivity(
      req.user,
      'PURCHASE_CREATE',
      `Registered purchase of ${quantity} ${unit} of ${materialName} from supplier ${supplierName}. Total: ₹${totalAmount}.`
    );

    res.status(201).json({ success: true, purchase: newPurchase });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Edit purchase (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    purchaseDate,
    supplierName,
    supplierMobile,
    supplierGST,
    materialName,
    category,
    quantity,
    unit,
    rate,
    gstPercent,
    transportCharges,
    totalAmount,
    paymentStatus
  } = req.body;

  try {
    const oldPurchase = await db.findOne('purchases', { _id: id });
    if (!oldPurchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    // 1. Revert old inventory changes
    await revertInventoryForPurchase(oldPurchase.materialName, oldPurchase.quantity, oldPurchase.unit);

    // 2. Revert old supplier ledger changes
    await revertSupplierLedger(oldPurchase.supplierName, oldPurchase.totalAmount, oldPurchase.paymentStatus);

    // 3. Apply updates to the purchase record
    const updatedFields = {
      purchaseDate: purchaseDate || oldPurchase.purchaseDate,
      supplierName: supplierName ? supplierName.trim() : oldPurchase.supplierName,
      supplierMobile: supplierMobile !== undefined ? supplierMobile : oldPurchase.supplierMobile,
      supplierGST: supplierGST !== undefined ? supplierGST : oldPurchase.supplierGST,
      materialName: materialName ? materialName.trim() : oldPurchase.materialName,
      category: category || oldPurchase.category,
      quantity: quantity !== undefined ? Number(quantity) : oldPurchase.quantity,
      unit: unit || oldPurchase.unit,
      rate: rate !== undefined ? Number(rate) : oldPurchase.rate,
      gstPercent: gstPercent !== undefined ? Number(gstPercent) : oldPurchase.gstPercent,
      transportCharges: transportCharges !== undefined ? Number(transportCharges) : oldPurchase.transportCharges,
      totalAmount: totalAmount !== undefined ? Number(totalAmount) : oldPurchase.totalAmount,
      paymentStatus: paymentStatus || oldPurchase.paymentStatus
    };

    const result = await db.updateOne('purchases', { _id: id }, updatedFields);

    // 4. Apply new inventory and ledger updates
    await updateInventoryForPurchase(
      updatedFields.materialName,
      updatedFields.category,
      updatedFields.quantity,
      updatedFields.unit,
      updatedFields.rate
    );
    await updateSupplierLedger(
      updatedFields.supplierName,
      updatedFields.supplierMobile,
      '',
      updatedFields.supplierGST,
      updatedFields.totalAmount,
      updatedFields.paymentStatus
    );

    // Activity log
    await logActivity(
      req.user,
      'PURCHASE_UPDATE',
      `Modified purchase record ${id} (Supplier: ${updatedFields.supplierName}, Material: ${updatedFields.materialName}).`
    );

    res.json({ success: true, purchase: result.doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete purchase (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const purchase = await db.findOne('purchases', { _id: id });
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    // 1. Revert inventory
    await revertInventoryForPurchase(purchase.materialName, purchase.quantity, purchase.unit);

    // 2. Revert supplier ledger
    await revertSupplierLedger(purchase.supplierName, purchase.totalAmount, purchase.paymentStatus);

    // 3. Delete from DB
    await db.deleteOne('purchases', { _id: id });

    // Activity log
    await logActivity(
      req.user,
      'PURCHASE_DELETE',
      `Deleted purchase record ${id} (Supplier: ${purchase.supplierName}, Material: ${purchase.materialName}, Qty: ${purchase.quantity}).`
    );

    res.json({ success: true, message: 'Purchase record deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
