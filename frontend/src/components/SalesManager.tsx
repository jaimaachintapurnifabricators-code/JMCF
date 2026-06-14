import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Printer,
  FileText,
  Calendar,
  X,
  User,
  Users,
  TrendingUp,
  DollarSign,
  Download,
  Share2
} from 'lucide-react';

export const SalesManager: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'ledgers'>('records');

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState<any>(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Print Mode State
  const [printingInvoice, setPrintingInvoice] = useState<any>(null);

  // Form Fields
  const [saleDate, setSaleDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGST, setCustomerGST] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('Kg');
  const [rate, setRate] = useState(0);
  const [rateBasis, setRateBasis] = useState<'per_kg' | 'per_unit'>('per_kg');
  const [discount, setDiscount] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank' | 'Credit'>('Cash');

  // Selected product stock availability
  const [selectedProductStock, setSelectedProductStock] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sData, cData, pData] = await Promise.all([
        api.get('/sales'),
        api.get('/contacts/customers'),
        api.get('/inventory')
      ]);
      if (sData.success) setSales(sData.sales);
      if (cData.success) setCustomers(cData.customers);
      if (pData.success) setProducts(pData.products);
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
  const taxableAmount = Math.max(0, subtotal - Number(discount));
  const gstAmount = taxableAmount * (gstPercent / 100);
  const totalAmount = Math.round((taxableAmount + gstAmount) * 100) / 100;

  const resetForm = () => {
    setSaleDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setCustomerMobile('');
    setCustomerAddress('');
    setCustomerGST('');
    setProductName('');
    setQuantity(0);
    setUnit('Kg');
    setRate(0);
    setRateBasis('per_kg');
    setDiscount(0);
    setGstPercent(18);
    setPaymentMethod('Cash');
    setEditingId(null);
    setSelectedProductStock(null);
    setError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: any) => {
    setEditingId(s._id);
    setSaleDate(s.saleDate);
    setCustomerName(s.customerName);
    setCustomerMobile(s.customerMobile);
    setCustomerAddress(s.customerAddress);
    setCustomerGST(s.customerGST);
    setProductName(s.productName);
    setQuantity(s.quantity);
    setUnit(s.unit || 'Kg');
    setRate(s.rate);
    setRateBasis(s.rateBasis || 'per_kg');
    setDiscount(s.discount);
    setGstPercent(s.gstPercent);
    setPaymentMethod(s.paymentMethod);

    // Set stock indicator
    const prod = products.find(p => p.name === s.productName);
    if (prod) {
      setSelectedProductStock(prod.currentStock);
    }

    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerName || !productName || quantity <= 0 || rate <= 0) {
      setError('Please fill in all mandatory fields (Customer, Product, Quantity, Rate).');
      return;
    }

    if (selectedProductStock !== null && quantity > selectedProductStock && !editingId) {
      if (!window.confirm(`Warning: Requested quantity (${quantity}) exceeds current available stock (${selectedProductStock}). Continue with invoice generation?`)) {
        return;
      }
    }

    const payload = {
      saleDate,
      customerName,
      customerMobile,
      customerAddress,
      customerGST,
      productName,
      quantity,
      unit,
      rate,
      rateBasis,
      discount,
      gstPercent,
      totalAmount,
      paymentMethod
    };

    try {
      if (editingId) {
        await api.put(`/sales/${editingId}`, payload);
      } else {
        await api.post('/sales', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate invoice.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice? Stock counts and customer ledger will be recalculated.')) {
      return;
    }

    try {
      await api.delete(`/sales/${id}`);
      fetchData();
      if (selectedLedgerCustomer) {
        setSelectedLedgerCustomer(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete sale invoice.');
    }
  };

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    const existing = customers.find(c => c.name.toLowerCase().trim() === val.toLowerCase().trim());
    if (existing) {
      setCustomerMobile(existing.mobile);
      setCustomerAddress(existing.address);
      setCustomerGST(existing.gstNumber);
    }
  };

  const handleProductSelect = (val: string) => {
    setProductName(val);
    const prod = products.find(p => p.name === val);
    if (prod) {
      setSelectedProductStock(prod.currentStock);
      setRate(prod.rate || 0); // Suggest catalog price
      setUnit(prod.unit || 'Kg'); // Auto-set product unit (e.g. Kg, Ton)
      setRateBasis('per_kg'); // Reset to default
      setGstPercent(18); // Default standard
    } else {
      setSelectedProductStock(null);
    }
  };

  const handlePrint = (invoice: any) => {
    setPrintingInvoice(invoice);
    setTimeout(() => {
      window.print();
      setPrintingInvoice(null);
    }, 300);
  };

  const filteredSales = sales.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      s.invoiceNumber.toLowerCase().includes(query) ||
      s.customerName.toLowerCase().includes(query) ||
      s.productName.toLowerCase().includes(query) ||
      (s.customerMobile && s.customerMobile.includes(query))
    );
  });

  const getLedgerSales = (name: string) => {
    return sales.filter(s => s.customerName === name);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Printable Area Wrapper */}
      {printingInvoice && (
        <div className="print-area hidden p-8 max-w-2xl bg-white text-black text-xs font-mono">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold uppercase tracking-wide">Jai Maa Chintpurni Fabricators</h1>
            <p className="text-[10px] mt-1 text-slate-700">
              Iron, Steel, Fabrication, TMT Bars, Pipes, Angles & Hardware Materials
            </p>
            <p className="text-[10px] text-slate-700">
              Address: Gaggal Road, Near Shiv Temple, Kangra, HP - 176209
            </p>
            <p className="text-[10px] text-slate-700">
              GSTIN: 02AMNPC8975K1Z8 | Mobile: +91 98160-55444, +91 94180-22111
            </p>
          </div>

          <div className="border-t border-b border-black py-3 my-4 grid grid-cols-2 gap-4">
            <div>
              <p><strong>Invoice Number:</strong> {printingInvoice.invoiceNumber}</p>
              <p><strong>Sale Date:</strong> {printingInvoice.saleDate}</p>
              <p><strong>Payment Method:</strong> {printingInvoice.paymentMethod}</p>
            </div>
            <div className="text-right">
              <p><strong>Billed To:</strong> {printingInvoice.customerName}</p>
              {printingInvoice.customerMobile && <p><strong>Mobile:</strong> {printingInvoice.customerMobile}</p>}
              {printingInvoice.customerAddress && <p><strong>Address:</strong> {printingInvoice.customerAddress}</p>}
              {printingInvoice.customerGST && <p><strong>GSTIN:</strong> {printingInvoice.customerGST}</p>}
            </div>
          </div>

          <table className="w-full text-left my-4">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="py-2">Material Description</th>
                <th className="py-2 text-center">Quantity</th>
                <th className="py-2 text-right">Rate (₹)</th>
                <th className="py-2 text-right">Discount (₹)</th>
                <th className="py-2 text-right">GST %</th>
                <th className="py-2 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-3 font-semibold">{printingInvoice.productName}</td>
                <td className="py-3 text-center">{printingInvoice.quantity} {printingInvoice.unit || 'Kg'}</td>
                <td className="py-3 text-right">₹{printingInvoice.rate} / {printingInvoice.rateBasis === 'per_kg' ? 'Kg' : (printingInvoice.unit || 'Kg')}</td>
                <td className="py-3 text-right">₹{printingInvoice.discount || 0}</td>
                <td className="py-3 text-right">{printingInvoice.gstPercent}%</td>
                <td className="py-3 text-right font-bold">₹{printingInvoice.totalAmount}</td>
              </tr>
            </tbody>
          </table>

          <div className="w-64 ml-auto border-t border-black pt-3 mt-8 text-right space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span>Gross Subtotal:</span>
              <span>₹{(printingInvoice.unit === 'Ton' && printingInvoice.rateBasis === 'per_kg' ? printingInvoice.quantity * 1000 * printingInvoice.rate : printingInvoice.quantity * printingInvoice.rate).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Less Discount:</span>
              <span>- ₹{printingInvoice.discount || 0}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Tax (GST {printingInvoice.gstPercent}%):</span>
              <span>₹{Math.round(((printingInvoice.unit === 'Ton' && printingInvoice.rateBasis === 'per_kg' ? printingInvoice.quantity * 1000 * printingInvoice.rate : printingInvoice.quantity * printingInvoice.rate - (printingInvoice.discount || 0)) * (printingInvoice.gstPercent / 100)) * 100) / 100}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold border-t border-black pt-1.5">
              <span>Grand Total:</span>
              <span>₹{printingInvoice.totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="mt-16 text-center text-[10px] text-slate-500 border-t border-slate-300 pt-4">
            Thank you for shopping with Jai Maa Chintpurni Fabricators!
            <br />
            Subject to Kangra jurisdiction. E. & O.E.
          </div>
        </div>
      )}

      {/* Main Screen Layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-amber-500" />
            Sales & Invoices
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate GST tax invoices and track outstanding customer balances.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-sm transition-all focus:outline-none shadow-lg shadow-orange-950/20"
        >
          <Plus className="h-4 w-4" />
          Create Invoice (GST Bill)
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 no-print">
        <button
          onClick={() => {
            setActiveTab('records');
            setSelectedLedgerCustomer(null);
          }}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            activeTab === 'records' && !selectedLedgerCustomer
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Sales Invoices
        </button>
        <button
          onClick={() => setActiveTab('ledgers')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all outline-none ${
            activeTab === 'ledgers' || selectedLedgerCustomer
              ? 'border-amber-500 text-amber-400 bg-slate-900/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Customer Ledger Statements
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 no-print">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500">Retrieving invoices...</span>
        </div>
      ) : activeTab === 'records' && !selectedLedgerCustomer ? (
        /* ================= INVOICES LIST VIEW ================= */
        <div className="space-y-4 no-print">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/50 p-4 border border-slate-900 rounded-lg">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by invoice number, customer, product or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all placeholder:text-slate-650"
              />
            </div>
          </div>

          {/* Grid Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="p-4">Invoice No</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Product Specs</th>
                    <th className="p-4 text-right">Tax & Disc</th>
                    <th className="p-4 text-right">Grand Total</th>
                    <th className="p-4">Method</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredSales.length > 0 ? (
                    filteredSales.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-800/20 text-slate-350">
                        <td className="p-4 font-mono font-bold text-amber-500">{s.invoiceNumber}</td>
                        <td className="p-4 text-slate-400">{s.saleDate}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-200">{s.customerName}</div>
                          <div className="text-[10px] text-slate-500">{s.customerMobile || 'No Mobile'}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-300">{s.productName}</div>
                          <div className="text-[10px] text-slate-500">{s.quantity} units @ ₹{s.rate}/unit</div>
                        </td>
                        <td className="p-4 text-right">
                          <div>Discount: ₹{s.discount}</div>
                          <div className="text-[10px] text-slate-500">GST: {s.gstPercent}%</div>
                        </td>
                        <td className="p-4 text-right font-extrabold text-slate-100 text-sm">₹{Number(s.totalAmount).toLocaleString('en-IN')}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.paymentMethod === 'Credit' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handlePrint(s)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-500 rounded transition-all"
                              title="Print Invoice"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleOpenEditModal(s)}
                                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-all"
                                  title="Edit"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(s._id)}
                                  className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-650 italic">
                        No sales invoices found matching search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= CUSTOMER LEDGERS / DRILLDOWN VIEW ================= */
        <div className="space-y-4 no-print">
          {!selectedLedgerCustomer ? (
            /* Customers list */
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Mobile & Address</th>
                      <th className="p-4">GST Number</th>
                      <th className="p-4">Invoices count</th>
                      <th className="p-4">Total Purchases Val</th>
                      <th className="p-4 text-right">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {customers.length > 0 ? (
                      customers.map((c) => (
                        <tr
                          key={c._id}
                          onClick={() => setSelectedLedgerCustomer(c)}
                          className="hover:bg-slate-800/20 text-slate-350 cursor-pointer transition-all"
                        >
                          <td className="p-4 font-bold text-amber-500 hover:underline">{c.name}</td>
                          <td className="p-4">
                            <div>{c.mobile || '---'}</div>
                            <div className="text-[10px] text-slate-500">{c.address || 'No Address'}</div>
                          </td>
                          <td className="p-4 text-slate-400 font-mono">{c.gstNumber || '---'}</td>
                          <td className="p-4 font-bold text-center">{c.purchaseCount || 0}</td>
                          <td className="p-4 font-semibold text-slate-300">₹{(c.totalSalesVal || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right text-sm">
                            <span className={`font-extrabold ${c.outstandingBalance > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              ₹{Number(c.outstandingBalance || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-650 italic">
                          No customer registry found in system database.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Customer statement */
            <div className="space-y-5">
              {/* Ledger Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <div>
                  <button
                    onClick={() => setSelectedLedgerCustomer(null)}
                    className="text-xs font-semibold text-amber-500 hover:underline mb-2 block"
                  >
                    &larr; Back to Customers list
                  </button>
                  <h3 className="text-lg font-bold text-slate-200">{selectedLedgerCustomer.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    GST: {selectedLedgerCustomer.gstNumber || '---'} | Mobile: {selectedLedgerCustomer.mobile || '---'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Debit Balance</span>
                  <span className="text-xl font-extrabold text-red-400">
                    ₹{Number(selectedLedgerCustomer.outstandingBalance || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Transactions List */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Statement of Accounts</h4>
                  <span className="text-[10px] text-slate-500">AUDITED TRANSACTIONS</span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="p-4">Invoice No</th>
                        <th className="p-4">Sale Date</th>
                        <th className="p-4">Product Details</th>
                        <th className="p-4">Specs (Qty / Rate / Disc)</th>
                        <th className="p-4">Payment Method</th>
                        <th className="p-4 text-right">Invoice total</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {getLedgerSales(selectedLedgerCustomer.name).length > 0 ? (
                        getLedgerSales(selectedLedgerCustomer.name).map((tx) => (
                          <tr key={tx._id} className="hover:bg-slate-800/10 text-slate-350">
                            <td className="p-4 font-mono font-bold text-amber-500">{tx.invoiceNumber}</td>
                            <td className="p-4">{tx.saleDate}</td>
                            <td className="p-4 font-bold text-slate-200">{tx.productName}</td>
                            <td className="p-4">
                              {tx.quantity} units @ ₹{tx.rate}/unit (Less: ₹{tx.discount})
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                tx.paymentMethod === 'Credit' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {tx.paymentMethod}
                              </span>
                            </td>
                            <td className="p-4 text-right font-extrabold text-slate-100 text-sm">₹{Number(tx.totalAmount).toLocaleString('en-IN')}</td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handlePrint(tx)}
                                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-500 rounded"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDelete(tx._id)}
                                    className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-600 italic">
                            No billing invoice transactions registered under this customer ledger.
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

      {/* Invoice Generator Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">
                {editingId ? 'Modify Billing Invoice' : 'Create Sales Invoice (Tax Invoice)'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Grid 1: Date & Customer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Sale Date *
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                    placeholder="Enter customer name / firm"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                    list="customers-datalist"
                  />
                  <datalist id="customers-datalist">
                    {customers.map((c, idx) => (
                      <option key={idx} value={c.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Grid 2: Mobile, Address & GST */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Customer Mobile Number
                  </label>
                  <input
                    type="text"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    placeholder="10 digit mobile"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Customer Address
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Enter destination/address"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Customer GST (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerGST}
                    onChange={(e) => setCustomerGST(e.target.value)}
                    placeholder="15-digit GSTIN"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-250 text-xs outline-none focus:border-amber-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Grid 3: Product Name selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/60 pt-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Select Material Product *
                  </label>
                  <select
                    value={productName}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-250 text-xs outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p, idx) => (
                      <option key={idx} value={p.name}>
                        {p.name} (Stock: {p.currentStock} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Current Stock Alert</span>
                  <span className={`text-xs font-extrabold mt-0.5 ${selectedProductStock !== null && selectedProductStock <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedProductStock !== null ? `${selectedProductStock} units available` : 'Select a product'}
                  </span>
                </div>
              </div>

              {/* Grid 4: Quantity, Rate, Discount, Tax */}
              <div className={`grid grid-cols-2 gap-4 ${unit === 'Ton' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Sale Quantity *
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
                    Selling Rate (₹) *
                  </label>
                  <input
                    type="number"
                    value={rate || ''}
                    onChange={(e) => setRate(Number(e.target.value))}
                    placeholder="Selling price"
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
                    Discount Deduction (₹)
                  </label>
                  <input
                    type="number"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    placeholder="Flat discount"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                </div>
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
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18% (Standard)</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {/* Grid 5: Shipping, Total, Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs outline-none focus:border-amber-500"
                  >
                    <option value="Cash">Cash Sale</option>
                    <option value="Bank">UPI / Bank Transfer</option>
                    <option value="Card">Credit Card / Debit Card</option>
                    <option value="Credit">Credit Ledger (Outstanding)</option>
                  </select>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice Grand Total</span>
                  <span className="text-lg font-extrabold text-emerald-400">₹{totalAmount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-650 italic">Taxable ₹{taxableAmount} + Tax GST ₹{gstAmount}</span>
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
                  {editingId ? 'Save Updates' : 'Generate & Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
