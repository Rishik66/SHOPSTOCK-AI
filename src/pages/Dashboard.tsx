import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, Package, AlertTriangle, ShoppingCart, Bot, RefreshCw, 
  Camera, Plus, Star, X, Search, CheckCircle2, ArrowRight 
} from 'lucide-react';

export function Dashboard() {
  const { products, transactions, language, setCurrentPage } = useApp();

  const [modalType, setModalType] = useState<'total' | 'lowStock' | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  const { todaySales, todayProfit, lowStockCount, chartData, bestSellers, recentSales } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let tSales = 0, tProfit = 0;
    
    const salesByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      salesByDay[d.toISOString().slice(0, 10)] = 0;
    }

    const sellerMap: Record<string, { name: string, qty: number }> = {};
    const rSales: any[] = [];

    transactions.forEach(t => {
      const d = t.date.slice(0, 10);
      if (d === today) {
        tSales += t.total;
        tProfit += t.profit;
        rSales.push(t);
      }
      if (salesByDay[d] !== undefined) {
        salesByDay[d] += t.total;
      }
      
      t.items.forEach(item => {
        if (!sellerMap[item.productId]) {
          sellerMap[item.productId] = { name: item.productName, qty: 0 };
        }
        sellerMap[item.productId].qty += item.quantity;
      });
    });

    const lCount = products.filter(p => p.stock <= p.minimumStock).length;
    
    const cData = Object.entries(salesByDay).map(([date, sales]) => {
      const dayStr = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
      return { day: dayStr, sales };
    });

    const bSellers = Object.values(sellerMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
    
    rSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { todaySales: tSales, todayProfit: tProfit, lowStockCount: lCount, chartData: cData, bestSellers: bSellers, recentSales: rSales.slice(0, 5) };
  }, [products, transactions]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= p.minimumStock);
  }, [products]);

  const modalProducts = useMemo(() => {
    const baseList = modalType === 'lowStock' ? lowStockProducts : products;
    if (!modalSearch.trim()) return baseList;
    const q = modalSearch.toLowerCase().trim();
    return baseList.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q)
    );
  }, [modalType, lowStockProducts, products, modalSearch]);

  return (
    <div className="space-y-6">
      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24} /></div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{tr(language, 'todaySales')}</p>
            <p className="text-2xl font-black text-gray-900">₹{todaySales}</p>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl"><TrendingUp size={24} /></div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{tr(language, 'todayProfit')}</p>
            <p className="text-2xl font-black text-gray-900">₹{todayProfit}</p>
          </div>
        </div>

        {/* Total Products (Clickable) */}
        <button
          type="button"
          onClick={() => { setModalType('total'); setModalSearch(''); }}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md flex items-center justify-between text-left transition-all group active:scale-[0.99] cursor-pointer"
          title="Click to view all products in your inventory"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Package size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{tr(language, 'totalProducts')}</p>
              <p className="text-2xl font-black text-gray-900">{products.length}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg group-hover:bg-purple-100 transition-colors">
            View All →
          </span>
        </button>

        {/* Low Stock (Clickable) */}
        <button
          type="button"
          onClick={() => { setModalType('lowStock'); setModalSearch(''); }}
          className={`p-4 rounded-xl shadow-sm border text-left flex items-center justify-between transition-all group active:scale-[0.99] cursor-pointer ${
            lowStockCount > 0 
              ? 'bg-red-50/30 border-red-200 hover:border-red-400 hover:shadow-md' 
              : 'bg-white border-gray-100 hover:border-gray-300'
          }`}
          title="Click to view low stock items needing restock"
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-colors ${
              lowStockCount > 0 
                ? 'bg-red-100 text-red-600 group-hover:bg-red-600 group-hover:text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{tr(language, 'lowStock')}</p>
              <p className={`text-2xl font-black ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStockCount}</p>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
            lowStockCount > 0 
              ? 'text-red-700 bg-red-100 group-hover:bg-red-200' 
              : 'text-gray-500 bg-gray-100'
          }`}>
            {lowStockCount > 0 ? 'View Alerts →' : 'Healthy ✓'}
          </span>
        </button>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{tr(language, 'quickActions')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <button onClick={() => setCurrentPage('inventory')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2 transition-all">
            <Plus size={24} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'addProduct')}</span>
          </button>
          <button onClick={() => setCurrentPage('billing')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2 transition-all">
            <ShoppingCart size={24} className="text-green-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'newSale')}</span>
          </button>
          <button onClick={() => setCurrentPage('ai-assistant')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2 transition-all">
            <Bot size={24} className="text-purple-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'askAI')}</span>
          </button>
          <button onClick={() => setCurrentPage('smart-restock')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2 transition-all">
            <RefreshCw size={24} className="text-orange-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'viewRestock')}</span>
          </button>
          <button onClick={() => setCurrentPage('invoice-scanner')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2 transition-all">
            <Camera size={24} className="text-teal-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'scanInvoice')}</span>
          </button>
        </div>
      </div>

      {/* Charts & Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">{tr(language, 'salesChart')}</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: '#e5e7eb', strokeWidth: 2 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="#eff6ff" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">{tr(language, 'bestSelling')}</h2>
            {bestSellers.length === 0 ? (
              <p className="text-sm text-gray-500">{tr(language, 'noSalesData')}</p>
            ) : (
              <ul className="space-y-3">
                {bestSellers.map((s, i) => (
                  <li key={i} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 font-medium">{i + 1}. {s.name}</span>
                    <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{s.qty} {tr(language, 'sold')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">{tr(language, 'recentSales')}</h2>
            {recentSales.length === 0 ? (
              <p className="text-sm text-gray-500">{tr(language, 'noRecentSales')}</p>
            ) : (
              <ul className="space-y-4">
                {recentSales.map(t => (
                  <li key={t.id} className="text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-800">₹{t.total}</span>
                      <span className="text-xs text-gray-500">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-gray-500 text-xs truncate">
                      {t.items.map((i: any) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Reviews & Feedback Banner at Bottom */}
      <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
            <Star size={24} className="fill-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">How is your experience with ShopStock AI?</h3>
            <p className="text-xs text-gray-600">Rate our billing, voice assistant, and inventory system or view shopkeeper reviews.</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentPage('reviews')}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 shrink-0 transition-all flex items-center gap-1.5"
        >
          <span>Reviews & Ratings</span> ⭐
        </button>
      </div>

      {/* 📦 Modal for Total Products & Low Stock Alerts */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Header */}
            <div className={`p-5 border-b flex items-center justify-between ${
              modalType === 'lowStock' ? 'bg-red-50/80 border-red-200' : 'bg-slate-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  modalType === 'lowStock' ? 'bg-red-600 text-white shadow-md shadow-red-500/20' : 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                }`}>
                  {modalType === 'lowStock' ? <AlertTriangle size={22} /> : <Package size={22} />}
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    {modalType === 'lowStock' ? 'Low Stock Alerts' : 'Total Inventory Products'}
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                      modalType === 'lowStock' ? 'bg-red-200 text-red-900' : 'bg-purple-100 text-purple-900'
                    }`}>
                      {modalType === 'lowStock' ? lowStockProducts.length : products.length} Items
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    {modalType === 'lowStock' 
                      ? 'Items that have reached or dropped below their minimum stock threshold' 
                      : 'Complete catalog of all items currently tracked in your shop'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalType(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Filter Inside Modal */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Filter by product name or category..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                />
              </div>
            </div>

            {/* Products List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50">
              {modalProducts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  {modalType === 'lowStock' ? (
                    <>
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 size={24} />
                      </div>
                      <p className="font-bold text-gray-800 text-sm">All items well stocked!</p>
                      <p className="text-xs text-gray-500">None of your products are currently below minimum thresholds.</p>
                    </>
                  ) : (
                    <>
                      <Package size={36} className="mx-auto text-gray-300" />
                      <p className="font-bold text-gray-700 text-sm">No products found</p>
                      <p className="text-xs text-gray-400">Try a different search term or add products in Inventory.</p>
                    </>
                  )}
                </div>
              ) : (
                modalProducts.map(p => {
                  const isLow = p.stock <= p.minimumStock;
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 bg-white rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isLow ? 'border-red-200 shadow-sm' : 'border-gray-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 truncate">{p.name}</span>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                            {p.category}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-3">
                          <span>Selling: <strong className="text-gray-900">₹{p.sellingPrice}</strong></span>
                          <span>Purchase: <span className="text-gray-600">₹{p.purchasePrice}</span></span>
                          <span className="text-emerald-700 font-medium">Profit: +₹{p.sellingPrice - p.purchasePrice}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <div className={`text-xs font-bold ${isLow ? 'text-red-600 font-black' : 'text-gray-900'}`}>
                            {p.stock} units
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Min: {p.minimumStock}
                          </div>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          isLow ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isLow ? `Low Stock` : `In Stock`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                Showing {modalProducts.length} of {modalType === 'lowStock' ? lowStockProducts.length : products.length} products
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {modalType === 'lowStock' ? (
                  <button
                    type="button"
                    onClick={() => { setModalType(null); setCurrentPage('smart-restock'); }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RefreshCw size={14} /> Open Smart Restock
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setModalType(null); setCurrentPage('inventory'); }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Package size={14} /> Manage in Inventory
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
