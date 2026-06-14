const express = require('express');
const router = express.Router();
const db = require('../config/dbService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

// ================= CUSTOMERS =================

// Get all customers
router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await db.find('customers');
    // For each customer, let's fetch their sales count
    const enriched = await Promise.all(customers.map(async customer => {
      const sales = await db.find('sales', { customerName: customer.name });
      return {
        ...customer,
        purchaseCount: sales.length,
        totalSalesVal: sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0)
      };
    }));
    res.json({ success: true, customers: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add customer (Partners and Admin can do this)
router.post('/customers', authenticateToken, async (req, res) => {
  const { name, mobile, address, gstNumber, outstandingBalance } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Customer name is required' });
  }

  try {
    const normName = name.trim();
    const existing = await db.findOne('customers', { name: normName });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Customer already exists with this name' });
    }

    const newCustomer = await db.insertOne('customers', {
      name: normName,
      mobile: mobile || '',
      address: address || '',
      gstNumber: gstNumber || '',
      outstandingBalance: Number(outstandingBalance || 0)
    });

    await logActivity(req.user, 'CUSTOMER_CREATE', `Added customer ${normName}.`);
    res.status(201).json({ success: true, customer: newCustomer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Edit customer (Admin only)
router.put('/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, mobile, address, gstNumber, outstandingBalance } = req.body;

  try {
    const customer = await db.findOne('customers', { _id: id });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (mobile !== undefined) updates.mobile = mobile;
    if (address !== undefined) updates.address = address;
    if (gstNumber !== undefined) updates.gstNumber = gstNumber;
    if (outstandingBalance !== undefined) updates.outstandingBalance = Number(outstandingBalance);

    const result = await db.updateOne('customers', { _id: id }, updates);
    await logActivity(req.user, 'CUSTOMER_UPDATE', `Updated details for customer ${customer.name}.`);

    res.json({ success: true, customer: result.doc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete customer (Admin only)
router.delete('/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await db.findOne('customers', { _id: id });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Check if they have sales history
    const sales = await db.find('sales', { customerName: customer.name });
    if (sales.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer: They have associated sales invoices.'
      });
    }

    await db.deleteOne('customers', { _id: id });
    await logActivity(req.user, 'CUSTOMER_DELETE', `Deleted customer record for ${customer.name}.`);

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ================= SUPPLIERS =================

// Get all suppliers (Admin only)
router.get('/suppliers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const suppliers = await db.find('suppliers');
    const enriched = await Promise.all(suppliers.map(async supplier => {
      const purchases = await db.find('purchases', { supplierName: supplier.name });
      return {
        ...supplier,
        purchaseCount: purchases.length,
        totalPurchasesVal: purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0)
      };
    }));
    res.json({ success: true, suppliers: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add supplier (Admin only)
router.post('/suppliers', authenticateToken, requireAdmin, async (req, res) => {
  const { name, mobile, address, gstNumber, outstandingPayments } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Supplier name is required' });
  }

  try {
    const normName = name.trim();
    const existing = await db.findOne('suppliers', { name: normName });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Supplier already exists with this name' });
    }

    const newSupplier = await db.insertOne('suppliers', {
      name: normName,
      mobile: mobile || '',
      address: address || '',
      gstNumber: gstNumber || '',
      outstandingPayments: Number(outstandingPayments || 0)
    });

    await logActivity(req.user, 'SUPPLIER_CREATE', `Added supplier ${normName}.`);
    res.status(201).json({ success: true, supplier: newSupplier });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Edit supplier (Admin only)
router.put('/suppliers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, mobile, address, gstNumber, outstandingPayments } = req.body;

  try {
    const supplier = await db.findOne('suppliers', { _id: id });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (mobile !== undefined) updates.mobile = mobile;
    if (address !== undefined) updates.address = address;
    if (gstNumber !== undefined) updates.gstNumber = gstNumber;
    if (outstandingPayments !== undefined) updates.outstandingPayments = Number(outstandingPayments);

    const result = await db.updateOne('suppliers', { _id: id }, updates);
    await logActivity(req.user, 'SUPPLIER_UPDATE', `Updated details for supplier ${supplier.name}.`);

    res.json({ success: true, supplier: result.doc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete supplier (Admin only)
router.delete('/suppliers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await db.findOne('suppliers', { _id: id });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Check if they have purchases history
    const purchases = await db.find('purchases', { supplierName: supplier.name });
    if (purchases.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete supplier: They have associated purchase records.'
      });
    }

    await db.deleteOne('suppliers', { _id: id });
    await logActivity(req.user, 'SUPPLIER_DELETE', `Deleted supplier record for ${supplier.name}.`);

    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
