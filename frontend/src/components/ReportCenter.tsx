import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Calendar,
  Filter,
  Download,
  Printer,
  TrendingUp,
  Layers,
  Truck,
  User,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const ReportCenter: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [reportType, setReportType] = useState<'sales' | 'purchases' | 'inventory' | 'pandl' | 'partner'>('sales');
  
  // Data lists
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [plReport, setPlReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedPartner, setSelectedPartner] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sRes, cRes, pRes] = await Promise.all([
        api.get('/sales'),
        api.get('/contacts/customers'),
        api.get('/inventory')
      ]);

      if (sRes.success) setSales(sRes.sales);
      if (cRes.success) setCustomers(cRes.customers);
      if (pRes.success) setProducts(pRes.products);

      if (isAdmin) {
        const [purRes, supRes, plRes] = await Promise.all([
          api.get('/purchases'),
          api.get('/contacts/suppliers'),
          api.get('/reports/profit-loss')
        ]);
        if (purRes.success) setPurchases(purRes.purchases);
        if (supRes.success) setSuppliers(supRes.suppliers);
        if (plRes.success) setPlReport(plRes.report);
      }
    } catch (err) {
      console.error('Error fetching reporting lists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Default tabs for non-admins
    if (!isAdmin && (reportType === 'purchases' || reportType === 'pandl')) {
      setReportType('sales');
    }
  }, [isAdmin]);

  // Filter computations
  const getFilteredSales = () => {
    let list = [...sales];
    if (!isAdmin) {
      // Partners only see their own sales report
      list = list.filter(s => s.createdBy === user?.username || s.createdById === user?.id);
    }
    
    return list.filter(s => {
      const matchStart = startDate ? s.saleDate >= startDate : true;
      const matchEnd = endDate ? s.saleDate <= endDate : true;
      const matchProd = selectedProduct ? s.productName === selectedProduct : true;
      const matchCust = selectedCustomer ? s.customerName === selectedCustomer : true;
      const matchPartner = selectedPartner ? s.createdBy === selectedPartner : true;
      return matchStart && matchEnd && matchProd && matchCust && matchPartner;
    });
  };

  const getFilteredPurchases = () => {
    if (!isAdmin) return [];
    return purchases.filter(p => {
      const matchStart = startDate ? p.purchaseDate >= startDate : true;
      const matchEnd = endDate ? p.purchaseDate <= endDate : true;
      const matchProd = selectedProduct ? p.materialName === selectedProduct : true;
      const matchSup = selectedSupplier ? p.supplierName === selectedSupplier : true;
      return matchStart && matchEnd && matchProd && matchSup;
    });
  };

  const getFilteredInventory = () => {
    return products.filter(p => {
      const matchProd = selectedProduct ? p.name === selectedProduct : true;
      return matchProd;
    });
  };

  const getPartnerSalesSummary = () => {
    const list = getFilteredSales();
    const partnersObj: Record<string, { name: string, count: number, total: number }> = {};
    
    list.forEach(s => {
      const creator = s.createdBy || 'Admin';
      if (!partnersObj[creator]) {
        partnersObj[creator] = { name: creator, count: 0, total: 0 };
      }
      partnersObj[creator].count++;
      partnersObj[creator].total += Number(s.totalAmount) || 0;
    });

    return Object.values(partnersObj);
  };

  // Excel/CSV Exports
  const handleExport = (format: 'xlsx' | 'csv') => {
    let exportData: any[] = [];
    let fileName = `JMCF_${reportType}_Report`;

    if (reportType === 'sales') {
      exportData = getFilteredSales().map(s => ({
        'Invoice Number': s.invoiceNumber,
        'Sale Date': s.saleDate,
        'Customer Name': s.customerName,
        'Customer Phone': s.customerMobile,
        'Product Details': s.productName,
        'Quantity': s.quantity,
        'Unit Rate': s.rate,
        'Discount': s.discount,
        'GST %': s.gstPercent,
        'Total Invoice Value': s.totalAmount,
        'Payment Method': s.paymentMethod,
        'Billed By': s.createdBy
      }));
    } else if (reportType === 'purchases') {
      exportData = getFilteredPurchases().map(p => ({
        'Purchase Date': p.purchaseDate,
        'Supplier Name': p.supplierName,
        'Phone Number': p.supplierMobile,
        'GST Number': p.supplierGST,
        'Material Description': p.materialName,
        'Category': p.category,
        'Quantity': p.quantity,
        'Unit': p.unit,
        'Purchase Rate': p.rate,
        'GST %': p.gstPercent,
        'Transport Charges': p.transportCharges,
        'Total Order Value': p.totalAmount,
        'Payment Status': p.paymentStatus
      }));
    } else if (reportType === 'inventory') {
      exportData = getFilteredInventory().map(p => ({
        'Material Name': p.name,
        'Category': p.category,
        'Opening Stock': p.openingStock,
        'Total Procured': p.purchasedQty,
        'Total Sold': p.soldQty,
        'Current Stock Balance': p.currentStock,
        'Unit Measure': p.unit,
        'Catalog Rate': p.rate,
        'Stock Valuation Asset': p.valuation,
        'Status': p.lowStockAlert ? 'LOW STOCK' : 'Healthy'
      }));
    } else if (reportType === 'partner') {
      exportData = getPartnerSalesSummary().map(p => ({
        'User/Partner Name': p.name,
        'Total Invoices Created': p.count,
        'Total Sales Registered (₹)': p.total
      }));
    } else if (reportType === 'pandl' && plReport) {
      exportData = [
        { Metric: 'Gross Sales Revenue', Value: plReport.totalSales },
        { Metric: 'Gross Purchase Procurement', Value: plReport.totalPurchases },
        { Metric: 'Procurement Freight (Transport)', Value: plReport.totalTransport },
        { Metric: 'Opening Inventory Valuation', Value: plReport.openingStockValuation },
        { Metric: 'Closing Inventory Valuation', Value: plReport.closingStockValuation },
        { Metric: 'Cost of Goods Sold (COGS)', Value: plReport.costOfGoodsSold },
        { Metric: 'Net Financial Statement Profit/Loss', Value: plReport.netProfit }
      ];
    }

    if (exportData.length === 0) {
      alert('No data matches the selected filters to generate report.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    if (format === 'xlsx') {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${fileName}.csv`, { bookType: 'csv' });
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = ' '; // Completely remove page title from browser print header
    window.print();
    document.title = originalTitle;
  };

  const partnersList = Array.from(new Set(sales.map(s => s.createdBy || 'Admin')));

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-500" />
            Accounting & Report Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate, filter, and export tax summaries, stock valuation ledgers, and partner sales charts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all outline-none"
            title="Download Excel sheet"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            Export Excel (.xlsx)
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all outline-none"
            title="Download CSV"
          >
            <Download className="h-4 w-4 text-blue-400" />
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all outline-none"
            title="Print sheet"
          >
            <Printer className="h-4 w-4 text-amber-500" />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex border-b border-slate-800 no-print">
        <button
          onClick={() => setReportType('sales')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            reportType === 'sales'
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Sales Report
        </button>
        {isAdmin && (
          <button
            onClick={() => setReportType('purchases')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
              reportType === 'purchases'
                ? 'border-amber-500 text-amber-400 bg-slate-900/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Purchases Report
          </button>
        )}
        <button
          onClick={() => setReportType('inventory')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            reportType === 'inventory'
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Stock Ledger Valuations
        </button>
        <button
          onClick={() => setReportType('partner')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            reportType === 'partner'
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Partner Sales Sheet
        </button>
        {isAdmin && (
          <button
            onClick={() => setReportType('pandl')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
              reportType === 'pandl'
                ? 'border-amber-500 text-amber-400 bg-slate-900/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Profit & Loss Summary
          </button>
        )}
      </div>

      {/* Advanced Filters Drawer */}
      {reportType !== 'pandl' && (
        <div className="bg-slate-900/50 p-4 border border-slate-900 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded text-slate-200 text-xs outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded text-slate-200 text-xs outline-none focus:border-amber-500"
            />
          </div>

          {/* Dynamic contextual filters depending on report */}
          {reportType === 'sales' && (
            <>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select Customer</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded text-slate-300 text-xs outline-none focus:border-amber-500"
                >
                  <option value="">All Customers</option>
                  {customers.map((c, idx) => <option key={idx} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select Billed By</label>
                  <select
                    value={selectedPartner}
                    onChange={(e) => setSelectedPartner(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded text-slate-300 text-xs outline-none focus:border-amber-500"
                  >
                    <option value="">All Staff</option>
                    {partnersList.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {reportType === 'purchases' && isAdmin && (
            <>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select Supplier</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded text-slate-300 text-xs outline-none focus:border-amber-500"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s, idx) => <option key={idx} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded text-slate-300 text-xs outline-none focus:border-amber-500"
                >
                  <option value="">All Products</option>
                  {products.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}

          {(reportType === 'inventory' || reportType === 'partner') && (
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Material Filter</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded text-slate-300 text-xs outline-none focus:border-amber-500"
              >
                <option value="">All Products</option>
                {products.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500">Evaluating accounting parameters...</span>
        </div>
      ) : (
        /* Report Sheets Display */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl print:border-none print:shadow-none">
          {/* Print Title Header */}
          <div className="hidden print:block text-center border-b border-black pb-4 mb-6 text-black">
            <h1 className="text-xl font-bold uppercase">Jai Maa Chintpurni Fabricators</h1>
            <h2 className="text-xs font-semibold capitalize mt-1">{reportType} Audit statement</h2>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Period: {startDate || 'Beginning'} &mdash; {endDate || 'Today'}
            </p>
          </div>

          {/* ================= SALES SHEET ================= */}
          {reportType === 'sales' && (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider print:bg-transparent print:border-black print:text-black">
                    <th className="p-4">Invoice No</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Customer Name</th>
                    <th className="p-4">Product Details</th>
                    <th className="p-4 text-center">Quantity</th>
                    <th className="p-4 text-right">Invoice Rate</th>
                    <th className="p-4 text-right">Tax GST</th>
                    <th className="p-4 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 print:divide-slate-300 print:text-black">
                  {getFilteredSales().length > 0 ? (
                    getFilteredSales().map((s) => (
                      <tr key={s._id} className="hover:bg-slate-800/20 text-slate-350 print:hover:bg-transparent">
                        <td className="p-4 font-mono font-bold text-amber-500 print:text-black">{s.invoiceNumber}</td>
                        <td className="p-4">{s.saleDate}</td>
                        <td className="p-4 font-semibold text-slate-200 print:text-black">{s.customerName}</td>
                        <td className="p-4">{s.productName}</td>
                        <td className="p-4 text-center font-semibold">{s.quantity}</td>
                        <td className="p-4 text-right">₹{s.rate}</td>
                        <td className="p-4 text-right">{s.gstPercent}%</td>
                        <td className="p-4 text-right font-extrabold text-slate-100 print:text-black">₹{Number(s.totalAmount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-650 italic">
                        No transactions match query filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= PURCHASES SHEET ================= */}
          {reportType === 'purchases' && isAdmin && (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider print:bg-transparent print:border-black print:text-black">
                    <th className="p-4">Date</th>
                    <th className="p-4">Supplier Name</th>
                    <th className="p-4">Material Details</th>
                    <th className="p-4 text-center">Qty / Unit</th>
                    <th className="p-4 text-right">Unit Rate</th>
                    <th className="p-4 text-right">Transport</th>
                    <th className="p-4 text-right">Tax GST</th>
                    <th className="p-4 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 print:divide-slate-300 print:text-black">
                  {getFilteredPurchases().length > 0 ? (
                    getFilteredPurchases().map((p) => (
                      <tr key={p._id} className="hover:bg-slate-800/20 text-slate-350 print:hover:bg-transparent">
                        <td className="p-4 font-semibold text-slate-400 print:text-black">{p.purchaseDate}</td>
                        <td className="p-4 font-bold text-slate-200 print:text-black">{p.supplierName}</td>
                        <td className="p-4">{p.materialName}</td>
                        <td className="p-4 text-center">{p.quantity} {p.unit}</td>
                        <td className="p-4 text-right">₹{p.rate}</td>
                        <td className="p-4 text-right">₹{p.transportCharges}</td>
                        <td className="p-4 text-right">{p.gstPercent}%</td>
                        <td className="p-4 text-right font-extrabold text-slate-100 print:text-black">₹{Number(p.totalAmount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-650 italic">
                        No purchases found matching date / vendor parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= INVENTORY SHEET ================= */}
          {reportType === 'inventory' && (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider print:bg-transparent print:border-black print:text-black">
                    <th className="p-4">Material Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-center">Opening Stock</th>
                    <th className="p-4 text-center">Purchased</th>
                    <th className="p-4 text-center">Sold Qty</th>
                    <th className="p-4 text-center">Closing Stock</th>
                    <th className="p-4 text-right">Catalog Rate</th>
                    {isAdmin && <th className="p-4 text-right">Asset Valuation</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 print:divide-slate-300 print:text-black">
                  {getFilteredInventory().length > 0 ? (
                    getFilteredInventory().map((p) => (
                      <tr key={p._id} className="hover:bg-slate-800/20 text-slate-350 print:hover:bg-transparent">
                        <td className="p-4 font-bold text-slate-200 print:text-black">{p.name}</td>
                        <td className="p-4">{p.category}</td>
                        <td className="p-4 text-center text-slate-400">{p.openingStock}</td>
                        <td className="p-4 text-center text-emerald-400 font-bold">{p.purchasedQty || 0}</td>
                        <td className="p-4 text-center text-red-400 font-bold">{p.soldQty || 0}</td>
                        <td className="p-4 text-center font-extrabold text-slate-100 print:text-black">{p.currentStock} {p.unit}</td>
                        <td className="p-4 text-right font-bold">₹{p.rate}/{p.unit}</td>
                        {isAdmin && (
                          <td className="p-4 text-right font-extrabold text-slate-100 print:text-black">
                            ₹{Number(p.valuation || 0).toLocaleString('en-IN')}
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="p-10 text-center text-slate-650 italic">
                        No product items matched filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= PARTNER SALES SUMMARY ================= */}
          {reportType === 'partner' && (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider print:bg-transparent print:border-black print:text-black">
                    <th className="p-4">Staff / Partner Username</th>
                    <th className="p-4 text-center">Total Invoices Created</th>
                    <th className="p-4 text-right">Sum Sales Volume (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 print:divide-slate-300 print:text-black">
                  {getPartnerSalesSummary().length > 0 ? (
                    getPartnerSalesSummary().map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20 text-slate-355 print:hover:bg-transparent">
                        <td className="p-4 font-bold text-slate-200 capitalize print:text-black">{p.name}</td>
                        <td className="p-4 text-center font-extrabold">{p.count} bills</td>
                        <td className="p-4 text-right font-extrabold text-slate-100 print:text-black">₹{Number(p.total).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-10 text-center text-slate-650 italic">
                        No partner accounts have logged sales transactions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= PROFIT & LOSS TRADING STATEMENT ================= */}
          {reportType === 'pandl' && isAdmin && plReport && (
            <div className="p-6 md:p-8 space-y-6 text-slate-300 print:text-black">
              <div className="border-b border-slate-800 pb-4 print:border-black">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Trading & Profit-Loss Account</h3>
                <span className="text-[10px] text-slate-500">FISCAL OVERVIEW (ACCUMULATED VALUES)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                {/* Debits side (Expenses) */}
                <div className="space-y-3.5">
                  <h4 className="font-bold text-red-400 uppercase tracking-wide border-b border-red-950/40 pb-2 print:text-black print:border-black">Debits (Expenses / Procurements)</h4>
                  <div className="flex justify-between">
                    <span>Opening Stock Valuation Asset:</span>
                    <span className="font-semibold text-slate-250 print:text-black">₹{plReport.openingStockValuation.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Material Purchases:</span>
                    <span className="font-semibold text-slate-250 print:text-black">₹{plReport.totalPurchases.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping & Freight Carriage (Transport):</span>
                    <span className="font-semibold text-slate-250 print:text-black">₹{plReport.totalTransport.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-slate-800/80 my-3 pt-3 flex justify-between font-bold text-slate-400 print:border-black print:text-black">
                    <span>Total Procurement Debits:</span>
                    <span className="text-slate-100 print:text-black">₹{(plReport.openingStockValuation + plReport.totalPurchases + plReport.totalTransport).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Credits side (Revenues) */}
                <div className="space-y-3.5">
                  <h4 className="font-bold text-emerald-400 uppercase tracking-wide border-b border-emerald-950/40 pb-2 print:text-black print:border-black">Credits (Revenues / Assets)</h4>
                  <div className="flex justify-between">
                    <span>Gross Sales Revenue:</span>
                    <span className="font-semibold text-slate-250 print:text-black">₹{plReport.totalSales.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Closing Stock Valuation Asset:</span>
                    <span className="font-semibold text-slate-250 print:text-black">₹{plReport.closingStockValuation.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-slate-800/80 my-3 pt-3 flex justify-between font-bold text-slate-400 print:border-black print:text-black">
                    <span>Total Revenue Credits:</span>
                    <span className="text-slate-100 print:text-black">₹{(plReport.totalSales + plReport.closingStockValuation).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* COGS calculation details */}
              <div className="bg-slate-950/50 p-4 border border-slate-800 rounded-lg flex items-center justify-between text-xs mt-4 print:border-black print:bg-transparent">
                <div>
                  <h5 className="font-bold text-slate-350">Cost of Goods Sold (COGS)</h5>
                  <p className="text-[10px] text-slate-500">Formula: Opening Stock + Purchases + Transport - Closing Stock</p>
                </div>
                <span className="font-extrabold text-slate-200 print:text-black">₹{plReport.costOfGoodsSold.toLocaleString('en-IN')}</span>
              </div>

              {/* Net profits layout */}
              <div className={`p-5 rounded-xl border flex flex-col items-center justify-center text-center ${
                plReport.isProfit ? 'bg-emerald-950/20 border-emerald-600/30' : 'bg-red-950/20 border-red-600/30'
              } print:border-black print:bg-transparent`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Statement Net Business Performance</span>
                <h3 className={`text-2xl font-black mt-1 ${plReport.isProfit ? 'text-emerald-450' : 'text-red-400'} print:text-black`}>
                  {plReport.isProfit ? 'NET PROFIT' : 'NET LOSS'} of ₹{Math.abs(plReport.netProfit).toLocaleString('en-IN')}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Calculated as (Total Revenue Credits) - (Total Procurement Debits)</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
