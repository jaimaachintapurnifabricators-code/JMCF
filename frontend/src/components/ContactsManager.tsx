import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  User,
  MapPin,
  Phone,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

interface ContactsManagerProps {
  type: 'customer' | 'supplier';
}

export const ContactsManager: React.FC<ContactsManagerProps> = ({ type }) => {
  const { user, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Fields
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [outstandingBalance, setOutstandingBalance] = useState(0);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const endpoint = type === 'customer' ? '/contacts/customers' : '/contacts/suppliers';
      const data = await api.get(endpoint);
      if (data.success) {
        setContacts(type === 'customer' ? data.customers : data.suppliers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [type]);

  const resetForm = () => {
    setName('');
    setMobile('');
    setAddress('');
    setGstNumber('');
    setOutstandingBalance(0);
    setEditingId(null);
    setError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: any) => {
    setEditingId(c._id);
    setName(c.name);
    setMobile(c.mobile);
    setAddress(c.address);
    setGstNumber(c.gstNumber);
    setOutstandingBalance(type === 'customer' ? c.outstandingBalance : c.outstandingPayments);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name) {
      setError('Name is required.');
      return;
    }

    const payload: any = {
      name,
      mobile,
      address,
      gstNumber
    };

    if (type === 'customer') {
      payload.outstandingBalance = outstandingBalance;
    } else {
      payload.outstandingPayments = outstandingBalance;
    }

    try {
      const endpoint = type === 'customer' ? '/contacts/customers' : '/contacts/suppliers';
      if (editingId) {
        await api.put(`${endpoint}/${editingId}`, payload);
      } else {
        await api.post(endpoint, payload);
      }
      setIsModalOpen(false);
      fetchContacts();
    } catch (err: any) {
      setError(err.message || 'Failed to save contact.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}? This will fail if they have transaction records.`)) {
      return;
    }

    try {
      const endpoint = type === 'customer' ? `/contacts/customers/${id}` : `/contacts/suppliers/${id}`;
      await api.delete(endpoint);
      fetchContacts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete contact.');
    }
  };

  const filteredContacts = contacts.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.mobile && c.mobile.includes(query)) ||
      (c.gstNumber && c.gstNumber.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query))
    );
  });

  const isCustomer = type === 'customer';

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <User className="h-6 w-6 text-amber-500" />
            {isCustomer ? 'Customer Registry' : 'Supplier Registry'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isCustomer
              ? 'Manage clients, details, purchase frequencies, and outstanding billing balances.'
              : 'Manage steel/TMT vendors, GSTIN credentials, and outstanding ledger payments.'}
          </p>
        </div>
        {(isCustomer || isAdmin) && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-sm transition-all focus:outline-none shadow-lg shadow-orange-950/20"
          >
            <Plus className="h-4 w-4" />
            Add {isCustomer ? 'Customer' : 'Supplier'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500">Querying registry...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex bg-slate-900/50 p-4 border border-slate-900 rounded-lg">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder={`Search ${isCustomer ? 'customers' : 'suppliers'} by name, phone, address or GST...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all placeholder:text-slate-650"
              />
            </div>
          </div>

          {/* Grid list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="p-4">{isCustomer ? 'Customer Name' : 'Supplier Name'}</th>
                    <th className="p-4">Contact Mobile</th>
                    <th className="p-4">Business Address</th>
                    <th className="p-4">GSTIN Number</th>
                    <th className="p-4 text-center">Invoiced Orders</th>
                    <th className="p-4 text-right">{isCustomer ? 'Outstanding Debit' : 'Outstanding Credit'}</th>
                    {isAdmin && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredContacts.length > 0 ? (
                    filteredContacts.map((c) => {
                      const balance = isCustomer ? c.outstandingBalance : c.outstandingPayments;
                      return (
                        <tr key={c._id} className="hover:bg-slate-800/20 text-slate-350 transition-all">
                          <td className="p-4 font-bold text-slate-200">{c.name}</td>
                          <td className="p-4 flex items-center gap-1 text-slate-300 font-mono">
                            <Phone className="h-3 w-3 text-slate-500" />
                            {c.mobile || '---'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1 max-w-[200px] truncate" title={c.address}>
                              <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                              {c.address || '---'}
                            </div>
                          </td>
                          <td className="p-4 text-slate-400 font-mono uppercase">{c.gstNumber || '---'}</td>
                          <td className="p-4 text-center font-bold text-slate-350">{c.purchaseCount || 0}</td>
                          <td className="p-4 text-right text-sm">
                            <span className={`font-extrabold ${balance > 0 ? 'text-red-400 animate-pulse' : 'text-slate-450'}`}>
                              ₹{Number(balance || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditModal(c)}
                                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-all"
                                  title="Edit contact info"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(c._id)}
                                  className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-all"
                                  title="Delete record"
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
                      <td colSpan={isAdmin ? 7 : 6} className="p-10 text-center text-slate-650 italic">
                        No matches found in {type} registry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">
                {editingId ? `Update Contact Details` : `Register New ${isCustomer ? 'Customer' : 'Supplier'}`}
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
                  Name / Business Title *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g. Sharma Steel, Rajesh Kumar"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10 digit mobile"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  GST Number
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="15-digit GSTIN (e.g. 02AMNPC...)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-255 text-xs outline-none focus:border-amber-500 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Office / Shipping Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, State, Zipcode"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Outstanding Ledger Balance (₹)
                  </label>
                  <input
                    type="number"
                    value={outstandingBalance || ''}
                    onChange={(e) => setOutstandingBalance(Number(e.target.value))}
                    placeholder="Initial ledger balance"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-amber-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    Adjusts outstanding debit/credit fields inside the system databases.
                  </p>
                </div>
              )}

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
                  {editingId ? 'Save Changes' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
