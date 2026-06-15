const express = require('express');
const router = express.Router();
const db = require('../config/dbService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get Dashboard Summary Stats
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const thisMonthStr = todayStr.substring(0, 7); // YYYY-MM

    const sales = await db.find('sales');
    const purchases = await db.find('purchases');
    const products = await db.find('products');

    // 1. Total Purchases Amount
    const totalPurchaseAmt = purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

    // 2. Total Sales Amount
    const totalSalesAmt = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

    // 3. Current Stock Value (Asset Valuation)
    const stockValuation = products.reduce((sum, p) => {
      const opening = Number(p.openingStock) || 0;
      const bought = Number(p.purchasedQty) || 0;
      const sold = Number(p.soldQty) || 0;
      const stock = Number(p.currentStock) !== undefined ? Number(p.currentStock) : (opening + bought - sold);
      const rate = Number(p.rate) || 0;
      return sum + (stock > 0 ? stock * rate : 0);
    }, 0);

    // 4. Today's Sales
    // Check if sales matches today's date
    const todaySales = sales.filter(s => s.saleDate === todayStr)
      .reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

    // 5. Monthly Sales
    const monthlySales = sales.filter(s => s.saleDate.startsWith(thisMonthStr))
      .reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

    // 6. Low Stock Alerts count
    const lowStockAlerts = products.filter(p => {
      const opening = Number(p.openingStock) || 0;
      const bought = Number(p.purchasedQty) || 0;
      const sold = Number(p.soldQty) || 0;
      const stock = Number(p.currentStock) !== undefined ? Number(p.currentStock) : (opening + bought - sold);
      return stock < (Number(p.minStockLevel) || 0);
    });

    // 7. Top Selling Products
    const salesGroup = {};
    sales.forEach(s => {
      const items = s.items && s.items.length > 0 ? s.items : [{ productName: s.productName, quantity: s.quantity }];
      items.forEach(it => {
        salesGroup[it.productName] = (salesGroup[it.productName] || 0) + Number(it.quantity);
      });
    });
    const topProducts = Object.keys(salesGroup).map(name => ({
      name,
      quantity: salesGroup[name]
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    // 8. Recent Transactions (unified sales & purchases)
    const formattedSales = sales.map(s => {
      let details = `${s.productName} (${s.quantity} units)`;
      if (s.items && s.items.length > 1) {
        details = `${s.items.length} items: ${s.items.map(it => it.productName).join(', ')}`;
      }
      return {
        id: s._id,
        type: 'Sale',
        date: s.saleDate,
        partyName: s.customerName,
        details,
        amount: s.totalAmount,
        status: s.paymentMethod
      };
    });

    const formattedPurchases = purchases.map(p => ({
      id: p._id,
      type: 'Purchase',
      date: p.purchaseDate,
      partyName: p.supplierName,
      details: `${p.materialName} (${p.quantity} units)`,
      amount: p.totalAmount,
      status: p.paymentStatus
    }));

    const recentTransactions = [...formattedSales, ...formattedPurchases]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    res.json({
      success: true,
      stats: {
        totalPurchaseAmt,
        totalSalesAmt,
        stockValuation,
        todaySales,
        monthlySales,
        lowStockCount: lowStockAlerts.length,
        lowStockItems: lowStockAlerts.map(p => ({
          name: p.name,
          currentStock: p.currentStock,
          minStockLevel: p.minStockLevel,
          unit: p.unit
        })),
        topProducts,
        recentTransactions
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Profit & Loss Report (Admin Only)
router.get('/profit-loss', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sales = await db.find('sales');
    const purchases = await db.find('purchases');
    const products = await db.find('products');

    const totalSales = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
    const totalTransport = purchases.reduce((sum, p) => sum + (Number(p.transportCharges) || 0), 0);
    
    // Ending Stock Valuation
    const stockValuation = products.reduce((sum, p) => {
      const opening = Number(p.openingStock) || 0;
      const bought = Number(p.purchasedQty) || 0;
      const sold = Number(p.soldQty) || 0;
      const stock = Number(p.currentStock) !== undefined ? Number(p.currentStock) : (opening + bought - sold);
      const rate = Number(p.rate) || 0;
      return sum + (stock > 0 ? stock * rate : 0);
    }, 0);

    // Traditional trading account P&L:
    // Net Profit = (Sales + Closing Stock) - (Opening Stock + Purchases + Transport)
    // For simplicity, we assume Opening Stock is the sum of products opening stock value
    const openingStockValuation = products.reduce((sum, p) => {
      return sum + ((Number(p.openingStock) || 0) * (Number(p.rate) || 0));
    }, 0);

    const costOfGoodsSold = openingStockValuation + totalPurchases + totalTransport - stockValuation;
    const netProfit = totalSales - costOfGoodsSold;

    res.json({
      success: true,
      report: {
        totalSales,
        totalPurchases,
        totalTransport,
        openingStockValuation,
        closingStockValuation: stockValuation,
        costOfGoodsSold,
        netProfit,
        isProfit: netProfit >= 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Partner Sales Report
router.get('/partner-sales', authenticateToken, async (req, res) => {
  try {
    const sales = await db.find('sales');
    let partnerSales = [];

    if (req.user.role === 'admin') {
      // Admin can see sales broken down by partner
      partnerSales = sales.map(s => ({
        invoiceNumber: s.invoiceNumber,
        saleDate: s.saleDate,
        customerName: s.customerName,
        productName: s.productName,
        totalAmount: s.totalAmount,
        createdBy: s.createdBy,
        createdById: s.createdById
      }));
    } else {
      // Partners can only see their own sales
      partnerSales = sales
        .filter(s => s.createdById === req.user.id || s.createdBy === req.user.username)
        .map(s => ({
          invoiceNumber: s.invoiceNumber,
          saleDate: s.saleDate,
          customerName: s.customerName,
          productName: s.productName,
          totalAmount: s.totalAmount,
          createdBy: s.createdBy
        }));
    }

    res.json({ success: true, sales: partnerSales });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
