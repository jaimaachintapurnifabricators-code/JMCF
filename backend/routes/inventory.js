const express = require('express');
const router = express.Router();
const db = require('../config/dbService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

// Get all inventory items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const products = await db.find('products');
    
    // Add dynamic properties: valuation, alerts
    const enrichedProducts = products.map(product => {
      const openingStock = Number(product.openingStock) || 0;
      const purchasedQty = Number(product.purchasedQty) || 0;
      const soldQty = Number(product.soldQty) || 0;
      const currentStock = Number(product.currentStock) !== undefined 
        ? Number(product.currentStock) 
        : (openingStock + purchasedQty - soldQty);
      
      const rate = Number(product.rate) || 0;
      const minStockLevel = Number(product.minStockLevel) || 0;

      return {
        ...product,
        currentStock,
        valuation: currentStock * rate,
        lowStockAlert: currentStock < minStockLevel
      };
    });

    res.json({ success: true, products: enrichedProducts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add new product manual creation (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { name, category, openingStock, rate, unit, minStockLevel } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Product name is required' });
  }

  try {
    const normName = name.trim();
    const existing = await db.findOne('products', { name: normName });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Product already exists' });
    }

    const openQty = Number(openingStock || 0);
    const newProduct = await db.insertOne('products', {
      name: normName,
      category: category || 'General',
      openingStock: openQty,
      purchasedQty: 0,
      soldQty: 0,
      currentStock: openQty,
      unit: unit || 'Kg',
      rate: Number(rate || 0),
      minStockLevel: Number(minStockLevel || 5)
    });

    await logActivity(req.user, 'PRODUCT_CREATE', `Manually added product ${normName} (Opening Stock: ${openQty} ${unit}).`);
    res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Adjust stock / Modify product (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { category, openingStock, rate, unit, minStockLevel, name } = req.body;

  try {
    const product = await db.findOne('products', { _id: id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (category !== undefined) updates.category = category;
    if (unit !== undefined) updates.unit = unit;
    if (rate !== undefined) updates.rate = Number(rate);
    if (minStockLevel !== undefined) updates.minStockLevel = Number(minStockLevel);
    
    if (openingStock !== undefined) {
      updates.openingStock = Number(openingStock);
      const purchasedQty = Number(product.purchasedQty) || 0;
      const soldQty = Number(product.soldQty) || 0;
      updates.currentStock = Number(openingStock) + purchasedQty - soldQty;
    }

    const result = await db.updateOne('products', { _id: id }, updates);

    await logActivity(req.user, 'PRODUCT_UPDATE', `Updated settings/stock for product ${product.name}.`);
    res.json({ success: true, product: result.doc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete product (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.findOne('products', { _id: id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if product has transaction history
    const purchases = await db.find('purchases', { materialName: product.name });
    const sales = await db.find('sales', { productName: product.name });

    if (purchases.length > 0 || sales.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete product: It has associated purchase or sale transaction history.'
      });
    }

    await db.deleteOne('products', { _id: id });
    await logActivity(req.user, 'PRODUCT_DELETE', `Deleted product ${product.name}.`);

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
