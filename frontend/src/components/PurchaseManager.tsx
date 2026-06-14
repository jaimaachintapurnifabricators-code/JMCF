import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  FileText,
  Calendar,
  X,
  User,
  Truck,
  TrendingDown,
  DollarSign
} from 'lucide-react';

export const PurchaseManager: React.FC = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'ledgers'>('records');

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedLedgerSupplier, setSelectedLedgerSupplier] = useState<any>(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Form Fields
  const [purchaseDate, setPurchaseDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierMobile, setSupplierMobile] = useState('');
  const [supplierGST, setSupplierGST] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('Kg');
  const [rate, setRate] = useState(0);
  const [rateBasis, setRateBasis] = useState<'per_kg' | 'per_unit'>('per_kg');
  const [gstPercent, setGstPercent] = useState(18); // Default to standard GST
  const [transportCharges, setTransportCharges] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pData, sData] = await Promise.all([
        api.get('/purchases'),
        api.get('/contacts/suppliers')
      ]);
      if (pData.success) setPurchases(pData.purchases);
      if (sData.success) setSuppliers(sData.suppliers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live total amount calculation
  const subtotal = (unit === 'Ton' && rateBasis === 'per_kg')
    ? quantity * 1000 * rate
    : quantity * rate;
  const gstAmount = subtotal * (gstPercent / 100);
  const totalAmount = Math.round((subtotal + gstAmount + Number(transportCharges)) * 100) / 100;

  const resetForm = () => {
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSupplierName('');
    setSupplierMobile('');
    setSupplierGST('');
    setMaterialName('');
    setCategory('Steel');
    setQuantity(0);
    setUnit('Kg');
    setRate(0);
    setRateBasis('per_kg');
    setGstPercent(18);
    setTransportCharges(0);
    setPaymentStatus('Unpaid');
    setEditingId(null);
    setError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: any) => {
    setEditingId(p._id);
    setPurchaseDate(p.purchaseDate);
    setSupplierName(p.supplierName);
    setSupplierMobile(p.supplierMobile);
    setSupplierGST(p.supplierGST);
    setMaterialName(p.materialName);
    setCategory(p.category);
    setQuantity(p.quantity);
    setUnit(p.unit);
    setRate(p.rate);
    setRateBasis(p.rateBasis || 'per_kg');
    setGstPercent(p.gstPercent);
    setTransportCharges(p.transportCharges);
    setPaymentStatus(p.paymentStatus);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supplierName || !materialName || quantity <= 0 || rate <= 0) {
      setError('Please fill in all mandatory fields (Supplier, Material, Quantity, Rate).');
      return;
    }

    const payload = {
      purchaseDate,
      supplierName,
      supplierMobile,
      supplierGST,
      materialName,
      category,
      quantity,
      unit,
      rate,
      rateBasis,
      gstPercent,
      transportCharges,
      totalAmount,
      paymentStatus
    };

    try {
      if (editingId) {
        await api.put(`/purchases/${editingId}`, payload);
      } else {
        await api.post('/purchases', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save purchase details.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this purchase record? Inventory stocks and supplier ledger balance will be reverted.')) {
      return;
    }

    try {
      await api.delete(`/purchases/${id}`);
      fetchData();
      if (selectedLedgerSupplier) {
        // Refresh details
        setSelectedLedgerSupplier(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete purchase.');
    }
  };

  // Autocomplete supplier fields if typing matches existing supplier name
  const handleSupplierNameChange = (val: string) => {
    setSupplierName(val);
    const existing = suppliers.find(s => s.name.toLowerCase().trim() === val.toLowerCase().trim());
    if (existing) {
      setSupplierMobile(existing.mobile);
      setSupplierGST(existing.gstNumber);
    }
  };

  const filteredPurchases = purchases.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      p.supplierName.toLowerCase().includes(query) ||
      p.materialName.toLowerCase().includes(query) ||
      (p.supplierMobile && p.supplierMobile.includes(query)) ||
      (p.supplierGST && p.supplierGST.toLowerCase().includes(query));

    const matchSupplier = selectedSupplier ? p.supplierName === selectedSupplier : true;

    return matchSearch && matchSupplier;
  });

  const getLedgerPurchases = (name: string) => {
    return purchases.filter(p => p.supplierName === name);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Truck className="h-6 w-6 text-amber-500" />
            Purchase Log & Suppliers
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Log raw iron, steel, angle, and TMT procurement orders. Adjusts inventory automatically.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-sm transition-all focus:outline-none shadow-lg shadow-orange-950/20"
        >
          <Plus className="h-4 w-4" />
          Log Purchase Order
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => {
            setActiveTab('records');
            setSelectedLedgerSupplier(null);
          }}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            activeTab === 'records' && !selectedLedgerSupplier
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Purchase Records
        </button>
        <button
          onClick={() => setActiveTab('ledgers')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            activeTab === 'ledgers' || selectedLedgerSupplier
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Supplier Ledger Statements
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500">Retrieving records...</span>
        </div>
      ) : activeTab === 'records' && !selectedLedgerSupplier ? (
        /* ================= PURCHASE RECORDS VIEW ================= */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/50 p-4 border border-slate-900 rounded-lg">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by supplier, material, phone or GST..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all placeholder:text-slate-650"
              />
            </div>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs outline-none focus:border-amber-500"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s, idx) => (
                <option key={idx} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Grid Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Material</th>
                    <th className="p-4">Qty & Rate</th>
                    <th className="p-4">GST & Transport</th>
                    <th className="p-4">Total Amt</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredPurchases.length > 0 ? (
                    filteredPurchases.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-800/20 text-slate-350">
                        <td className="p-4 font-semibold text-slate-400">{p.purchaseDate}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-200">{p.supplierName}</div>
                          <div className="text-[10px] text-slate-500">{p.supplierMobile || 'No Mobile'}</div>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-300">{p.materialName}</span>
                          <span className="ml-2 px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[9px] uppercase tracking-wider">{p.category}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold">{p.quantity} {p.unit}</div>
                          <div className="text-[10px] text-slate-500">@ ₹{p.rate}/{p.unit}</div>
                        </td>
                        <td className="p-4">
                          <div>GST: {p.gstPercent}%</div>
                          <div className="text-[10px] text-slate-550">Transport: ₹{p.transportCharges}</div>
                        </td>
                        <td className="p-4 font-extrabold text-slate-100 text-sm">₹{Number(p.totalAmount).toLocaleString('en-IN')}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-all"
                              title="Edit record"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p._id)}
                              className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-all"
                              title="Delete record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-650 italic">
                        No purchase invoices logged match the query parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= SUPPLIER LEDGERS / DRILLDOWN VIEW ================= */
        <div className="space-y-4">
          {!selectedLedgerSupplier ? (
            /* Suppliers list */
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="p-4">Supplier Name</th>
                      <th className="p-4">Contact Details</th>
                      <th className="p-4">GST Number</th>
                      <th className="p-4">Procurements Count</th>
                      <th className="p-4">Total Procured Val</th>
                      <th className="p-4 text-right">Outstanding Ledger Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {suppliers.length > 0 ? (
                      suppliers.map((s) => (
                        <tr
                          key={s._id}
                          onClick={() => setSelectedLedgerSupplier(s)}
                          className="hover:bg-slate-800/20 text-slate-350 cursor-pointer transition-all"
                        >
                          <td className="p-4 font-bold text-amber-500 hover:underline">{s.name}</td>
                          <td className="p-4">
                            <div>{s.mobile || '---'}</div>
                            <div className="text-[10px] text-slate-500">{s.address || 'No Address'}</div>
                          </td>
                          <td className="p-4 text-slate-400 font-mono">{s.gstNumber || '---'}</td>
                          <td className="p-4 font-bold text-center">{s.purchaseCount || 0}</td>
                          <td className="p-4 font-semibold text-slate-300">₹{(s.totalPurchasesVal || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right text-sm">
                            <span className={`font-extrabold ${s.outstandingPayments > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              ₹{Number(s.outstandingPayments || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-650 italic">
                          No supplier accounts found in database. Log a purchase to auto-create suppliers.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Supplier Statement drill down */
            <div className="space-y-5">
              {/* Ledger Summary Cards */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <div>
                  <button
                    onClick={() => setSelectedLedgerSupplier(null)}
                    className="text-xs font-semibold text-amber-500 hover:underline mb-2 block"
                  >
                    &larr; Back to Supplier Accounts
                  </button>
                  <h3 className="text-lg font-bold text-slate-200">{selectedLedgerSupplier.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    GST: {selectedLedgerSupplier.gstNumber || '---'} | Mobile: {selectedLedgerSupplier.mobile || '---'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Unpaid Balance</span>
                  <span className="text-xl font-extrabold text-red-400">
                    ₹{Number(selectedLedgerSupplier.outstandingPayments || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Transactions list */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Statement of Accounts</h4>
                  <span className="text-[10px] text-slate-500">AUDITED TRANSACTIONS</span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="p-4">Purchase Date</th>
                        <th className="p-4">Material Purchased</th>
                        <th className="p-4">Specs (Qty / Unit / Rate)</th>
                        <th className="p-4">Transport Charges</th>
                        <th className="p-4">Payment</th>
                        <th className="p-4 text-right">Invoice total</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {getLedgerPurchases(selectedLedgerSupplier.name).length > 0 ? (
                        getLedgerPurchases(selectedLedgerSupplier.name).map((tx) => (
                          <tr key={tx._id} className="hover:bg-slate-800/10 text-slate-350">
                            <td className="p-4">{tx.purchaseDate}</td>
                            <td className="p-4 font-bold text-slate-200">
                              {tx.materialName}
                              <span className="ml-2 text-[9px] bg-slate-800 text-slate-500 px-1 py-0.5 rounded uppercase tracking-wider">{tx.category}</span>
                            </td>
                            <td className="p-4">
                              {tx.quantity} {tx.unit} @ ₹{tx.rate}/{tx.unit} (GST {tx.gstPercent}%)
                            </td>
                            <td className="p-4">₹{tx.transportCharges}</td>
                            <td className="p-4">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                tx.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {tx.paymentStatus}
                              </span>
                            </td>
                            <td className="p-4 text-right font-extrabold text-slate-100 text-sm">₹{Number(tx.totalAmount).toLocaleString('en-IN')}</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDelete(tx._id)}
                                className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-all"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-600 italic">
                            No matching purchases registered under this supplier ledger.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Purchase Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">
                {editingId ? 'Edit Purchase Order' : 'Log New Procurement Order'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Grid 1: Date & Supplier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => handleSupplierNameChange(e.target.value)}
                    placeholder="Enter supplier company name"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                    list="suppliers-datalist"
                  />
                  <datalist id="suppliers-datalist">
                    {suppliers.map((s, idx) => (
                      <option key={idx} value={s.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Grid 2: Phone & GST */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Supplier Mobile Number
                  </label>
                  <input
                    type="text"
                    value={supplierMobile}
                    onChange={(e) => setSupplierMobile(e.target.value)}
                    placeholder="10 digit mobile"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Supplier GST Number
                  </label>
                  <input
                    type="text"
                    value={supplierGST}
                    onChange={(e) => setSupplierGST(e.target.value)}
                    placeholder="15-digit GSTIN (e.g. 07AAAAA1111A1Z1)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-250 text-xs outline-none focus:border-amber-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Grid 3: Material specs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/60 pt-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Material Name *
                  </label>
                  <input
                    type="text"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    placeholder="E.g. Steel Pipe 2 inch, TMT Bar 12mm"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs outline-none focus:border-amber-500"
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
              </div>

              {/* Grid 4: Quantities and Rates */}
              <div className={`grid grid-cols-2 gap-4 ${unit === 'Ton' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    placeholder="Quantity"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-355 text-xs outline-none focus:border-amber-500"
                  >
                    <option value="Kg">Kilograms (Kg)</option>
                    <option value="Ton">Tons (Ton)</option>
                    <option value="Pcs">Pieces (Pcs)</option>
                    <option value="Feet">Feet (Ft)</option>
                    <option value="Meters">Meters (M)</option>
                    <option value="Bags">Bags</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Purchase Rate (₹) *
                  </label>
                  <input
                    type="number"
                    value={rate || ''}
                    onChange={(e) => setRate(Number(e.target.value))}
                    placeholder="Rate per unit"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                {unit === 'Ton' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Rate Basis
                    </label>
                    <select
                      value={rateBasis}
                      onChange={(e) => setRateBasis(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-350 text-xs outline-none focus:border-amber-500"
                    >
                      <option value="per_kg">Rate per Kg</option>
                      <option value="per_unit">Rate per Ton</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    GST Tax %
                  </label>
                  <select
                    value={gstPercent}
                    onChange={(e) => setGstPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-350 text-xs outline-none focus:border-amber-500"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% (Slabs)</option>
                    <option value="12">12%</option>
                    <option value="18">18% (Standard)</option>
                    <option value="28">28% (Luxury)</option>
                  </select>
                </div>
              </div>

              {/* Grid 5: Shipping, Total, Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/60 pt-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Transport / Carriage Charges (₹)
                  </label>
                  <input
                    type="number"
                    value={transportCharges || ''}
                    onChange={(e) => setTransportCharges(Number(e.target.value))}
                    placeholder="Freight/Delivery"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs outline-none focus:border-amber-500"
                  >
                    <option value="Unpaid">Unpaid (Add to Ledger)</option>
                    <option value="Paid">Paid (Cash/Bank Settlement)</option>
                  </select>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Calculated Invoice Total</span>
                  <span className="text-lg font-extrabold text-amber-500">₹{totalAmount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-600 italic">Subtotal ₹{subtotal} + Tax ₹{gstAmount}</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950/20 border-t border-slate-800 flex items-center justify-end gap-3 mt-4">
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
                  {editingId ? 'Save Updates' : 'Confirm & Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
