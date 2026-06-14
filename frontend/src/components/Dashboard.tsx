import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  ShoppingBag,
  Layers,
  AlertTriangle,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Package
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.get('/reports/dashboard');
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-400">Loading business metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md text-center p-6 border border-red-500/30 bg-red-500/10 rounded-xl">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-red-200">Error Loading Dashboard</h3>
          <p className="text-sm text-red-400 mt-1">{error}</p>
          <button onClick={fetchDashboardData} className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Fallbacks for empty states
  const {
    totalPurchaseAmt = 0,
    totalSalesAmt = 0,
    stockValuation = 0,
    todaySales = 0,
    monthlySales = 0,
    lowStockCount = 0,
    lowStockItems = [],
    topProducts = [],
    recentTransactions = []
  } = stats || {};

  // Mock chart data representing recent months sales and purchases
  const trendData = [
    { name: 'Jan', Sales: totalSalesAmt * 0.12, Purchases: totalPurchaseAmt * 0.15 },
    { name: 'Feb', Sales: totalSalesAmt * 0.14, Purchases: totalPurchaseAmt * 0.12 },
    { name: 'Mar', Sales: totalSalesAmt * 0.18, Purchases: totalPurchaseAmt * 0.16 },
    { name: 'Apr', Sales: totalSalesAmt * 0.15, Purchases: totalPurchaseAmt * 0.18 },
    { name: 'May', Sales: totalSalesAmt * 0.20, Purchases: totalPurchaseAmt * 0.22 },
    { name: 'Jun', Sales: totalSalesAmt * 0.21, Purchases: totalPurchaseAmt * 0.17 }
  ];

  const barColors = ['#f59e0b', '#d97706', '#b45309', '#78350f', '#451a03'];

  return (
    <div className="flex-1 bg-slate-950 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Jai Maa Chintpurni Fabricators</h1>
          <p className="text-sm text-slate-400 mt-1">
            Logged in as <span className="font-semibold text-amber-500 capitalize">{user?.name}</span> ({user?.role})
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400">
          <Calendar className="h-4 w-4 text-amber-500" />
          <span>System Date: {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Total Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition-all relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
            <TrendingUp className="h-32 w-32" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Sales</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 mt-3">₹{totalSalesAmt.toLocaleString('en-IN')}</h2>
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Cumulative sales revenue</span>
          </p>
        </div>

        {/* Metric 2: Total Purchases (Restricted to Admin) */}
        {isAdmin ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition-all relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
              <ShoppingBag className="h-32 w-32" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Purchases</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100 mt-3">₹{totalPurchaseAmt.toLocaleString('en-IN')}</h2>
            <p className="text-xs text-amber-400 flex items-center gap-1 mt-1 font-medium">
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Cumulative procurement value</span>
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Procurements</span>
              <div className="p-2 bg-slate-800 text-slate-500 rounded-lg border border-slate-700/50">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <h2 className="text-sm font-bold text-slate-500 mt-4 italic">Hidden for Partners</h2>
            <p className="text-[10px] text-slate-600 mt-2 font-medium">Requires Admin role to view valuations</p>
          </div>
        )}

        {/* Metric 3: Current Stock Value (Restricted to Admin) */}
        {isAdmin ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition-all relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
              <Layers className="h-32 w-32" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Stock Asset Value</span>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100 mt-3">₹{stockValuation.toLocaleString('en-IN')}</h2>
            <p className="text-xs text-blue-400 flex items-center gap-1 mt-1 font-medium">
              <Activity className="h-3.5 w-3.5" />
              <span>Valued at average rates</span>
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Stock Assets</span>
              <div className="p-2 bg-slate-800 text-slate-500 rounded-lg border border-slate-700/50">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <h2 className="text-sm font-bold text-slate-500 mt-4 italic">Hidden for Partners</h2>
            <p className="text-[10px] text-slate-600 mt-2 font-medium">Requires Admin role to view valuations</p>
          </div>
        )}

        {/* Metric 4: Low Stock Alerts */}
        <div className={`border rounded-xl p-5 hover:border-slate-700/80 transition-all relative overflow-hidden group ${
          lowStockCount > 0 ? 'bg-amber-950/20 border-amber-600/40 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
            <AlertTriangle className="h-32 w-32" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Low Stock Alerts</span>
            <div className={`p-2 rounded-lg border ${
              lowStockCount > 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-slate-700/50'
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold mt-3">{lowStockCount} items</h2>
          <p className={`text-xs mt-1 font-medium ${lowStockCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
            {lowStockCount > 0 ? 'Action required immediately' : 'Inventory levels healthy'}
          </p>
        </div>
      </div>

      {/* Sub-Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Sales</span>
            <h3 className="text-xl font-extrabold text-slate-100 mt-1">₹{todaySales.toLocaleString('en-IN')}</h3>
          </div>
          <div className="text-[10px] text-slate-500 font-semibold bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            DAILY TICKER
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">This Month's Sales</span>
            <h3 className="text-xl font-extrabold text-slate-100 mt-1">₹{monthlySales.toLocaleString('en-IN')}</h3>
          </div>
          <div className="text-[10px] text-slate-500 font-semibold bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            MONTHLY ACCUMULATOR
          </div>
        </div>
      </div>

      {/* Interactive Charts & Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend (Restricted to Admin since it contains purchases) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[340px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-500" />
            {isAdmin ? 'Procurement & Sales Trend' : 'Sales Volume Trend'}
          </h3>
          <div className="flex-1 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="purchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#475569" />
                <YAxis stroke="#475569" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} />
                <Area type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                {isAdmin && <Area type="monotone" dataKey="Purchases" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#purchGrad)" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[340px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-500" />
            Top Selling Materials (Qty)
          </h3>
          {topProducts.length > 0 ? (
            <div className="flex-1 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis type="number" stroke="#475569" hide />
                  <YAxis dataKey="name" type="category" stroke="#cbd5e1" width={75} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} />
                  <Bar dataKey="quantity" fill="#f59e0b" barSize={12} radius={[0, 4, 4, 0]}>
                    {topProducts.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-600 italic">
              No sales data recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Low Stock Alerts + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Items List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[320px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
            Low Stock Alerts ({lowStockItems.length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-950 border border-amber-900/30 rounded-lg flex items-center justify-between">
                  <div>
                    <h5 className="font-semibold text-slate-200">{item.name}</h5>
                    <span className="text-[10px] text-slate-500">Threshold: {item.minStockLevel} {item.unit}</span>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                      {item.currentStock} {item.unit}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                All inventory quantities are above minimum limits.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity / Transactions */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[320px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-amber-500" />
            Recent Business Transactions
          </h3>
          <div className="flex-1 overflow-y-auto text-xs">
            {recentTransactions.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Type</th>
                    <th className="py-2.5">Party</th>
                    <th className="py-2.5">Details</th>
                    <th className="py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {recentTransactions.map((tx: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/10">
                      <td className="py-2.5 text-slate-400 font-medium">{tx.date}</td>
                      <td className="py-2.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tx.type === 'Sale' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-200 truncate max-w-[120px]">{tx.partyName}</td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[150px]">{tx.details}</td>
                      <td className="py-2.5 text-right font-extrabold text-slate-100">₹{tx.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                No purchases or sales transactions found in ledger.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
