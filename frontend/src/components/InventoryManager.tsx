import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Plus,
  Package,
  Layers,
  ArrowRightLeft,
  X,
  TrendingUp,
  ShoppingCart
} from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductLog, setSelectedProductLog] = useState<any>(null);

  // Modal Dialogs
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [openingStock, setOpeningStock] = useState(0);
  const [rate, setRate] = useState(0);
  const [unit, setUnit] = useState('Kg');
  const [minStockLevel, setMinStockLevel] = useState(5);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, purRes, salRes] = await Promise.all([
        api.get('/inventory'),
        isAdmin ? api.get('/purchases') : Promise.resolve({ success: true, purchases: [] }),
        api.get('/sales')
      ]);

      if (prodRes.success) setProducts(prodRes.products);
      if (purRes.success) setPurchases(purRes.purchases);
      if (salRes.success) setSales(salRes.sales);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setName('');
    setCategory('Steel');
    setOpeningStock(0);
    setRate(0);
    setUnit('Kg');
    setMinStockLevel(5);
    setEditingId(null);
    setError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: any) => {
    setEditingId(p._id);
    setName(p.name);
    setCategory(p.category);
    setOpeningStock(p.openingStock);
    setRate(p.rate);
    setUnit(p.unit);
    setMinStockLevel(p.minStockLevel);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || rate < 0 || openingStock < 0 || minStockLevel < 0) {
      setError('Please fill in valid details.');
      return;
    }

    const payload = {
      name,
      category,
      openingStock,
      rate,
      unit,
      minStockLevel
    };

    try {
      if (editingId) {
        await api.put(`/inventory/${editingId}`, payload);
      } else {
        await api.post('/inventory', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product details.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this catalog item? This will fail if there are registered purchase/sales histories.')) {
      return;
    }

    try {
      await api.delete(`/inventory/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product.');
    }
  };

  const getProductHistory = (prodName: string) => {
    const matchingPurchases = purchases.filter(p => p.materialName === prodName).map(p => ({
      date: p.purchaseDate,
      type: 'Purchase',
      party: p.supplierName,
      qty: `+ ${p.quantity} ${p.unit}`,
      rate: `₹${p.rate}`,
      amount: `₹${p.totalAmount}`,
      status: p.paymentStatus
    }));

    const matchingSales = sales.filter(s => s.productName === prodName).map(s => ({
      date: s.saleDate,
      type: 'Sale',
      party: s.customerName,
      qty: `- ${s.quantity} units`,
      rate: `₹${s.rate}`,
      amount: `₹${s.totalAmount}`,
      status: s.paymentMethod
    }));

    return [...matchingPurchases, ...matchingSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory ? p.category === selectedCategory : true;
    return matchSearch && matchCategory;
  });

  const totalAssetValuation = filteredProducts.reduce((sum, p) => sum + (Number(p.valuation) || 0), 0);

  const categories = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Package className="h-6 w-6 text-amber-500" />
            Inventory Stock Records
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track material stock ledger, valuations, and low-level threshold alarms.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-sm transition-all focus:outline-none shadow-lg shadow-orange-950/20"
          >
            <Plus className="h-4 w-4" />
            Add Catalog Item
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500">Evaluating inventories...</span>
        </div>
      ) : !selectedProductLog ? (
        /* ================= CATALOG GRID ================= */
        <div className="space-y-4">
          {/* Stats strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Catalog Size</span>
                <h3 className="text-xl font-extrabold text-slate-250 mt-0.5">{products.length} Products</h3>
              </div>
              <Layers className="h-5 w-5 text-amber-500/80" />
            </div>

            {isAdmin && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Ending Stock Valuation</span>
                  <h3 className="text-xl font-extrabold text-emerald-400 mt-0.5">₹{totalAssetValuation.toLocaleString('en-IN')}</h3>
                </div>
                <Layers className="h-5 w-5 text-emerald-500/80" />
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Active Alerts</span>
                <h3 className="text-xl font-extrabold text-amber-400 mt-0.5">
                  {products.filter(p => p.lowStockAlert).length} low items
                </h3>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-500/80" />
            </div>
          </div>

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/50 p-4 border border-slate-900 rounded-lg">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search catalog items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all placeholder:text-slate-650"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-350 text-xs outline-none focus:border-amber-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Grid list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="p-4">Material Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-center">Opening Stock</th>
                    <th className="p-4 text-center">Total Bought</th>
                    <th className="p-4 text-center">Total Sold</th>
                    <th className="p-4 text-center">Closing Stock</th>
                    <th className="p-4 text-right">Catalog Rate</th>
                    {isAdmin && <th className="p-4 text-right">Valuation Asset</th>}
                    <th className="p-4 text-right">Stock logs</th>
                    {isAdmin && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => {
                      const isLow = p.lowStockAlert;
                      return (
                        <tr
                          key={p._id}
                          className={`hover:bg-slate-800/20 text-slate-350 transition-all ${
                            isLow ? 'bg-amber-500/[0.02]' : ''
                          }`}
                        >
                          <td className="p-4">
                            <div className="font-bold text-slate-200 flex items-center gap-1.5">
                              {p.name}
                              {isLow && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/25 animate-pulse"
                                  title={`Below minimum limit of ${p.minStockLevel}`}
                                >
                                  LOW STOCK
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">Unit: {p.unit} | Min Limit: {p.minStockLevel}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-slate-850 text-slate-400 rounded text-[9px] uppercase tracking-wider font-semibold">
                              {p.category}
                            </span>
                          </td>
                          <td className="p-4 text-center font-semibold text-slate-400">{p.openingStock}</td>
                          <td className="p-4 text-center text-emerald-450 font-bold">{p.purchasedQty || 0}</td>
                          <td className="p-4 text-center text-red-400 font-bold">{p.soldQty || 0}</td>
                          <td className="p-4 text-center">
                            <span className={`font-extrabold text-sm px-2 py-0.5 rounded ${
                              isLow ? 'text-amber-500 bg-amber-500/10' : 'text-slate-100 bg-slate-950/40'
                            }`}>
                              {p.currentStock} {p.unit}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-slate-300">₹{p.rate}/{p.unit}</td>
                          {isAdmin && (
                            <td className="p-4 text-right font-extrabold text-slate-100">
                              ₹{(p.valuation || 0).toLocaleString('en-IN')}
                            </td>
                          )}
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedProductLog(p)}
                              className="px-2.5 py-1 hover:bg-slate-800 text-slate-400 hover:text-amber-500 border border-slate-800 hover:border-amber-500/30 rounded text-[10px] font-semibold transition-all inline-flex items-center gap-1 outline-none"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              View Ledger
                            </button>
                          </td>
                          {isAdmin && (
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditModal(p)}
                                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-all"
                                  title="Edit settings"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(p._id)}
                                  className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-all"
                                  title="Delete Catalog Item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 8} className="p-10 text-center text-slate-650 italic">
                        No material catalog items match search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= MOVEMENT LOG DRILLDOWN ================= */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div>
              <button
                onClick={() => setSelectedProductLog(null)}
                className="text-xs font-semibold text-amber-500 hover:underline mb-2 block outline-none"
              >
                &larr; Back to Catalog list
              </button>
              <h3 className="text-lg font-bold text-slate-200">{selectedProductLog.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Category: {selectedProductLog.category} | Unit: {selectedProductLog.unit}
              </p>
            </div>
            <div className="flex items-center gap-5 text-right">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Opening Stock</span>
                <span className="text-base font-extrabold text-slate-450">{selectedProductLog.openingStock}</span>
              </div>
              <div className="border-l border-slate-800 pl-5">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Current Stock</span>
                <span className={`text-base font-extrabold ${selectedProductLog.lowStockAlert ? 'text-amber-550' : 'text-slate-200'}`}>
                  {selectedProductLog.currentStock} {selectedProductLog.unit}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Material Ledger / Movement logs</h4>
              <span className="text-[10px] text-slate-500">CHRONOLOGICAL ADJUSTMENTS</span>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="p-4">Date</th>
                    <th className="p-4">Transaction Type</th>
                    <th className="p-4">Associated Party</th>
                    <th className="p-4 text-center">Stock Adjustment</th>
                    <th className="p-4 text-right">Unit Rate</th>
                    <th className="p-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {getProductHistory(selectedProductLog.name).length > 0 ? (
                    getProductHistory(selectedProductLog.name).map((log, idx) => {
                      const isPur = log.type === 'Purchase';
                      return (
                        <tr key={idx} className="hover:bg-slate-800/10 text-slate-350">
                          <td className="p-4">{log.date}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              isPur ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            }`}>
                              {isPur ? <ShoppingCart className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                              {log.type}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-200">{log.party}</td>
                          <td className={`p-4 text-center font-extrabold ${isPur ? 'text-emerald-450' : 'text-red-400'}`}>
                            {log.qty}
                          </td>
                          <td className="p-4 text-right text-slate-400">{log.rate}</td>
                          <td className="p-4 text-right font-extrabold text-slate-100">{log.amount}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-600 italic">
                        No matching transactions found. Only opening stock has been recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal Dialog (Admin Only) */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">
                {editingId ? 'Edit Product Settings' : 'Create New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g. Pipe 2 inch MS, Angle 40x40x5"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  disabled={!!editingId} // Don't rename existing products to avoid losing history
                />
                {editingId && <p className="text-[10px] text-slate-500 mt-1 italic">Name cannot be changed after transactions are registered.</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-350 text-xs outline-none focus:border-amber-500"
                  >
                    <option value="Steel">Steel Materials</option>
                    <option value="Iron">Iron Fabrication</option>
                    <option value="TMT Bars">TMT Bars</option>
                    <option value="Pipes">Pipes & Tubes</option>
                    <option value="Angles">Angles & Channels</option>
                    <option value="Hardware">Hardware Fittings</option>
                    <option value="Other">General / Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Standard Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-350 text-xs outline-none focus:border-amber-500"
                  >
                    <option value="Kg">Kilograms (Kg)</option>
                    <option value="Ton">Tons (Ton)</option>
                    <option value="Pcs">Pieces (Pcs)</option>
                    <option value="Feet">Feet (Ft)</option>
                    <option value="Meters">Meters (M)</option>
                    <option value="Bags">Bags</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Opening Stock Qty
                  </label>
                  <input
                    type="number"
                    value={openingStock || ''}
                    onChange={(e) => setOpeningStock(Number(e.target.value))}
                    placeholder="E.g. 100"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Standard Rate (₹)
                  </label>
                  <input
                    type="number"
                    value={rate || ''}
                    onChange={(e) => setRate(Number(e.target.value))}
                    placeholder="Rate per unit"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Min Stock Level Threshold
                </label>
                <input
                  type="number"
                  value={minStockLevel || ''}
                  onChange={(e) => setMinStockLevel(Number(e.target.value))}
                  placeholder="E.g. 5"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                />
                <p className="text-[10px] text-slate-500 mt-1.5">Triggers warning flags when stock level drops below this count.</p>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950/20 border-t border-slate-800 flex items-center justify-end gap-3 mt-4 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-350 text-xs font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 text-xs font-bold rounded-lg transition-all"
                >
                  {editingId ? 'Save Adjustments' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
