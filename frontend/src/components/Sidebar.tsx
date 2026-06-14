import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Package,
  Users,
  Truck,
  FileBarChart,
  Settings,
  LogOut,
  UserCheck,
  Hammer
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const { user, logout, isAdmin } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'partner'] },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart, roles: ['admin'] },
    { id: 'sales', label: 'Sales Invoices', icon: TrendingUp, roles: ['admin', 'partner'] },
    { id: 'inventory', label: 'Inventory Stock', icon: Package, roles: ['admin', 'partner'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'partner'] },
    { id: 'suppliers', label: 'Suppliers', icon: Truck, roles: ['admin'] },
    { id: 'reports', label: 'Report Center', icon: FileBarChart, roles: ['admin', 'partner'] },
    { id: 'settings', label: 'Settings & Logs', icon: Settings, roles: ['admin'] }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 no-print select-none">
      {/* Title Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3 bg-slate-950/40">
        <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded text-slate-950">
          <Hammer className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold text-sm tracking-tight text-slate-100 uppercase">JMC Fabricators</h2>
          <p className="text-[10px] text-slate-400 font-medium tracking-wider">BUSINESS MANAGER</p>
        </div>
      </div>

      {/* User Information Badge */}
      <div className="p-4 mx-3 mt-4 mb-2 rounded-lg bg-slate-950/50 border border-slate-800/80 flex items-center gap-3">
        <div className={`p-2 rounded-full shrink-0 ${isAdmin ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'}`}>
          <UserCheck className="h-4 w-4" />
        </div>
        <div className="overflow-hidden">
          <h4 className="text-xs font-semibold text-slate-200 truncate">{user?.name}</h4>
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
            isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
          }`}>
            {user?.role}
          </span>
        </div>
      </div>

      {/* Navigation Menu Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {menuItems
          .filter(item => item.roles.includes(user?.role || ''))
          .map(item => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all outline-none ${
                  active
                    ? 'bg-gradient-to-r from-amber-600/10 to-orange-700/10 border-l-2 border-amber-500 text-amber-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-l-2 border-transparent'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${active ? 'text-amber-500' : 'text-slate-500'}`} />
                {item.label}
              </button>
            );
          })}
      </nav>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/20 transition-all outline-none"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
