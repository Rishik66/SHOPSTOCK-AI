import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, TrendingDown, Package, AlertTriangle, ShoppingCart, Bot, RefreshCw, 
  Camera, Plus, Star, X, Search, CheckCircle2, ArrowRight, DollarSign,
  Receipt, Clock, Percent, ArrowUpRight
} from 'lucide-react';

export function Dashboard() {
  const { products, transactions, language, setCurrentPage } = useApp();

  const [modalType, setModalType] = useState<'total' | 'lowStock' | 'todaySales' | 'todayProfit' | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [salesViewTab, setSalesViewTab] = useState<'products' | 'invoices'>('products');

  const { todaySales, todayProfit, lowStockCount, chartData, bestSellers, leastSellers, recentSales } = useMemo(() => {
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

    // CRITICAL: For freshers who signed up for the first time (transactions.length === 0),
    // both bestSellers and leastSellers sections MUST BE EMPTY!
    let bSellers: { name: string; qty: number }[] = [];
    let lSellers: { name: string; qty: number }[] = [];

    if (transactions.length > 0) {
      // Best sellers: items with highest sales volume
      bSellers = Object.values(sellerMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

      // Least sellers: slow-moving products (lowest sales volume)
      const allProductSalesMap: Record<string, { name: string; qty: number }> = {};

      // Initialize with all current inventory products
      products.forEach(p => {
        allProductSalesMap[p.id] = { name: p.name, qty: 0 };
      });

      // Aggregate total units sold across all transactions
      transactions.forEach(t => {
        t.items.forEach(item => {
          if (!allProductSalesMap[item.productId]) {
            allProductSalesMap[item.productId] = { name: item.productName, qty: 0 };
          }
          allProductSalesMap[item.productId].qty += item.quantity;
        });
      });

      // Sort ascending (least units sold first)
      lSellers = Object.values(allProductSalesMap)
        .sort((a, b) => a.qty - b.qty)
        .slice(0, 5);
    }
    
    rSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { 
      todaySales: tSales, 
      todayProfit: tProfit, 
      lowStockCount: lCount, 
      chartData: cData, 
      bestSellers: bSellers, 
      leastSellers: lSellers,
      recentSales: rSales.slice(0, 5) 
    };
  }, [products, transactions]);

  // Today's date string
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Today's transactions list
  const todayTransactions = useMemo(() => {
    return transactions
      .filter(t => t.date.slice(0, 10) === todayStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, todayStr]);

  // Aggregate item breakdown for today's sales and profits
  const todayItemBreakdown = useMemo(() => {
    const map: Record<string, {
      productId: string;
      productName: string;
      category: string;
      quantity: number;
      sellingPrice: number;
      purchasePrice: number;
      totalRevenue: number;
      totalProfit: number;
    }> = {};

    todayTransactions.forEach(t => {
      t.items.forEach(item => {
        if (!map[item.productId]) {
          const prod = products.find(p => p.id === item.productId);
          map[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            category: prod?.category || 'General',
            quantity: 0,
            sellingPrice: item.sellingPrice,
            purchasePrice: item.purchasePrice,
            totalRevenue: 0,
            totalProfit: 0,
          };
        }
        map[item.productId].quantity += item.quantity;
        map[item.productId].totalRevenue += item.sellingPrice * item.quantity;
        map[item.productId].totalProfit += (item.sellingPrice - item.purchasePrice) * item.quantity;
      });
    });

    return Object.values(map);
  }, [todayTransactions, products]);

  const todayTotalUnits = useMemo(() => {
    return todayItemBreakdown.reduce((sum, item) => sum + item.quantity, 0);
  }, [todayItemBreakdown]);

  const marginPercent = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;
  const costOfGoods = Math.max(0, todaySales - todayProfit);

  // Filtered lists for Today's Sales modal
  const filteredSalesItems = useMemo(() => {
    const sorted = [...todayItemBreakdown].sort((a, b) => b.totalRevenue - a.totalRevenue);
    if (!modalSearch.trim()) return sorted;
    const q = modalSearch.toLowerCase().trim();
    return sorted.filter(item => 
      item.productName.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    );
  }, [todayItemBreakdown, modalSearch]);

  const filteredSalesTransactions = useMemo(() => {
    if (!modalSearch.trim()) return todayTransactions;
    const q = modalSearch.toLowerCase().trim();
    return todayTransactions.filter(t => 
      t.id.toLowerCase().includes(q) ||
      t.items.some(i => i.productName.toLowerCase().includes(q))
    );
  }, [todayTransactions, modalSearch]);

  // Filtered lists for Today's Profit modal
  const filteredProfitItems = useMemo(() => {
    const sorted = [...todayItemBreakdown].sort((a, b) => b.totalProfit - a.totalProfit);
    if (!modalSearch.trim()) return sorted;
    const q = modalSearch.toLowerCase().trim();
    return sorted.filter(item => 
      item.productName.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    );
  }, [todayItemBreakdown, modalSearch]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= p.minimumStock);
  }, [products]);

  // Filtered products for Total and LowStock modals
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
      {/* 4 Top Metric Cards (All Clickable with Deep-Dive Modals) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales (Clickable) */}
        <button
          type="button"
          onClick={() => { setModalType('todaySales'); setModalSearch(''); setSalesViewTab('products'); }}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md flex items-center justify-between text-left transition-all group active:scale-[0.99] cursor-pointer"
          title="Click to view products sold today and total amount received"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{tr(language, 'todaySales')}</p>
              <p className="text-2xl font-black text-gray-900">₹{todaySales}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg group-hover:bg-blue-100 transition-colors">
            Breakdown →
          </span>
        </button>

        {/* Today's Profit (Clickable) */}
        <button
          type="button"
          onClick={() => { setModalType('todayProfit'); setModalSearch(''); }}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-emerald-300 hover:shadow-md flex items-center justify-between text-left transition-all group active:scale-[0.99] cursor-pointer"
          title="Click to view profit summary and per-item profit breakdown"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{tr(language, 'todayProfit')}</p>
              <p className="text-2xl font-black text-emerald-700">₹{todayProfit}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg group-hover:bg-emerald-100 transition-colors">
            Breakdown →
          </span>
        </button>

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

      {/* Charts & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{tr(language, 'salesChart')}</h2>
            <span className="text-xs text-gray-500 font-medium">Last 7 Days</span>
          </div>
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

        {/* Recent Sales Activity */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{tr(language, 'recentSales')}</h2>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">Today</span>
          </div>
          {recentSales.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-gray-400 space-y-1">
              <ShoppingCart size={28} className="mx-auto text-gray-300 mb-1" />
              <p className="text-sm font-bold text-gray-600">{tr(language, 'noRecentSales')}</p>
              <p className="text-xs text-gray-400">Completed sales from Billing will appear here in real-time.</p>
            </div>
          ) : (
            <ul className="space-y-3 overflow-y-auto max-h-72 pr-1">
              {recentSales.map(t => (
                <li key={t.id} className="text-sm p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50/40 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-gray-900">₹{t.total}</span>
                    <span className="text-xs text-gray-500 font-mono">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-gray-600 text-xs truncate">
                    {t.items.map((i: any) => `${i.quantity}x ${i.productName}`).join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Row 2: Product Performance Insights (Best Sellers & Least Sellers) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 🔥 Best Selling Products */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{tr(language, 'bestSelling')}</h2>
                  <p className="text-xs text-gray-500">Top moving items in your store</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                High Demand
              </span>
            </div>

            {bestSellers.length === 0 ? (
              <div className="py-8 text-center text-gray-400 space-y-1.5 border border-dashed border-gray-200 rounded-xl bg-slate-50/50">
                <TrendingUp size={28} className="mx-auto text-gray-300" />
                <p className="text-sm font-bold text-gray-600">{tr(language, 'noSalesData')}</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Start selling products in the Billing section to view your best-performing inventory here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {bestSellers.map((s, i) => (
                  <li key={i} className="flex justify-between items-center text-sm p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-emerald-50/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-gray-900 font-bold truncate">{s.name}</span>
                    </div>
                    <span className="text-emerald-700 font-black text-xs bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                      {s.qty} {tr(language, 'sold')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 📉 Least Selling Products */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <TrendingDown size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{tr(language, 'leastSelling')}</h2>
                  <p className="text-xs text-gray-500">Slow-moving products that need attention</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                Slow Moving
              </span>
            </div>

            {leastSellers.length === 0 ? (
              <div className="py-8 text-center text-gray-400 space-y-1.5 border border-dashed border-gray-200 rounded-xl bg-slate-50/50">
                <TrendingDown size={28} className="mx-auto text-gray-300" />
                <p className="text-sm font-bold text-gray-600">{tr(language, 'noLeastSelling')}</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Start selling products in the Billing section to identify slow-moving items that may need discounts.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {leastSellers.map((s, i) => (
                  <li key={i} className="flex justify-between items-center text-sm p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-amber-50/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-gray-900 font-bold truncate">{s.name}</span>
                    </div>
                    <span className="text-amber-800 font-black text-xs bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0">
                      {s.qty} {tr(language, 'sold')}
                    </span>
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

      {/* 📦 Interactive Modals for Metrics */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden border border-gray-200">
            
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-center justify-between ${
              modalType === 'todaySales'
                ? 'bg-blue-50/90 border-blue-200'
                : modalType === 'todayProfit'
                ? 'bg-emerald-50/90 border-emerald-200'
                : modalType === 'lowStock'
                ? 'bg-red-50/90 border-red-200'
                : 'bg-purple-50/90 border-purple-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  modalType === 'todaySales'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : modalType === 'todayProfit'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : modalType === 'lowStock'
                    ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                    : 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                }`}>
                  {modalType === 'todaySales' && <ShoppingCart size={22} />}
                  {modalType === 'todayProfit' && <TrendingUp size={22} />}
                  {modalType === 'lowStock' && <AlertTriangle size={22} />}
                  {modalType === 'total' && <Package size={22} />}
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    {modalType === 'todaySales' && "Today's Sales Breakdown"}
                    {modalType === 'todayProfit' && "Today's Profit Analysis"}
                    {modalType === 'lowStock' && "Low Stock Alerts"}
                    {modalType === 'total' && "Total Inventory Products"}

                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                      modalType === 'todaySales'
                        ? 'bg-blue-200 text-blue-900'
                        : modalType === 'todayProfit'
                        ? 'bg-emerald-200 text-emerald-900'
                        : modalType === 'lowStock'
                        ? 'bg-red-200 text-red-900'
                        : 'bg-purple-100 text-purple-900'
                    }`}>
                      {modalType === 'todaySales' && `₹${todaySales} Received`}
                      {modalType === 'todayProfit' && `+₹${todayProfit} Profit`}
                      {modalType === 'lowStock' && `${lowStockProducts.length} Items`}
                      {modalType === 'total' && `${products.length} Items`}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    {modalType === 'todaySales' && "List of products sold today and the revenue amount received"}
                    {modalType === 'todayProfit' && "Summary of profits and item-by-item profit breakdown for today"}
                    {modalType === 'lowStock' && "Items that have reached or dropped below their minimum stock threshold"}
                    {modalType === 'total' && "Complete catalog of all items currently tracked in your shop"}
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

            {/* Top Summary Metrics Strip for Sales & Profit */}
            {modalType === 'todaySales' && (
              <div className="grid grid-cols-3 gap-2 p-3.5 bg-blue-50/50 border-b border-blue-100 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Received</p>
                  <p className="text-lg font-black text-blue-600">₹{todaySales}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Units Sold Today</p>
                  <p className="text-lg font-black text-gray-900">{todayTotalUnits} units</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Bills Created</p>
                  <p className="text-lg font-black text-gray-900">{todayTransactions.length} bills</p>
                </div>
              </div>
            )}

            {modalType === 'todayProfit' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3.5 bg-emerald-50/50 border-b border-emerald-100 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Today's Profit</p>
                  <p className="text-lg font-black text-emerald-600">+₹{todayProfit}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Sales</p>
                  <p className="text-lg font-black text-gray-900">₹{todaySales}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Cost of Goods</p>
                  <p className="text-lg font-black text-gray-700">₹{costOfGoods}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Profit Margin</p>
                  <p className="text-lg font-black text-emerald-700">{marginPercent}%</p>
                </div>
              </div>
            )}

            {/* Sub-Tabs for Today's Sales: Products vs Invoices */}
            {modalType === 'todaySales' && (
              <div className="flex items-center gap-2 px-4 pt-3 pb-1 border-b border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setSalesViewTab('products')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    salesViewTab === 'products'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  Sold Products ({todayItemBreakdown.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSalesViewTab('invoices')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    salesViewTab === 'invoices'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  Bills & Receipts ({todayTransactions.length})
                </button>
              </div>
            )}

            {/* Search Filter Inside Modal */}
            <div className="p-3.5 border-b border-gray-100 bg-white">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder={
                    modalType === 'todaySales' && salesViewTab === 'invoices'
                      ? "Search by Bill ID or product name..."
                      : "Filter by product name or category..."
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                />
              </div>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50">
              
              {/* VIEW 1: TODAY'S SALES - PRODUCTS TAB */}
              {modalType === 'todaySales' && salesViewTab === 'products' && (
                filteredSalesItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <ShoppingCart size={36} className="mx-auto text-gray-300" />
                    <p className="font-bold text-gray-700 text-sm">No products sold today</p>
                    <p className="text-xs text-gray-400">Complete sales in Billing / POS to see them listed here.</p>
                  </div>
                ) : (
                  filteredSalesItems.map((item) => (
                    <div
                      key={item.productId}
                      className="p-3.5 bg-white rounded-xl border border-gray-200 hover:border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 truncate">{item.productName}</span>
                          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded uppercase">
                            {item.category}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-3">
                          <span>Rate: <strong className="text-gray-800">₹{item.sellingPrice}</strong> / unit</span>
                          <span>Units Sold: <strong className="text-blue-700 font-bold">{item.quantity}</strong></span>
                          <span className="text-emerald-700 font-medium">Profit: +₹{item.totalProfit}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] text-gray-400 font-bold uppercase">Amount Received</div>
                          <div className="text-base font-black text-blue-600">
                            ₹{item.totalRevenue}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                          {item.quantity} sold
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* VIEW 2: TODAY'S SALES - INVOICES / BILLS TAB */}
              {modalType === 'todaySales' && salesViewTab === 'invoices' && (
                filteredSalesTransactions.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <Receipt size={36} className="mx-auto text-gray-300" />
                    <p className="font-bold text-gray-700 text-sm">No bills recorded today</p>
                    <p className="text-xs text-gray-400">Complete a sale in the Billing section to generate receipts.</p>
                  </div>
                ) : (
                  filteredSalesTransactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="p-3.5 bg-white rounded-xl border border-gray-200 hover:border-blue-200 shadow-xs space-y-2 transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-700 bg-slate-100 px-2 py-0.5 rounded">
                            #{txn.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(txn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-blue-600">₹{txn.total}</span>
                          <span className="text-[10px] text-emerald-600 font-bold ml-2">(+₹{txn.profit} profit)</span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-600 flex flex-wrap gap-1.5">
                        {txn.items.map((i, idx) => (
                          <span key={idx} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
                            <strong className="text-gray-900">{i.quantity}x</strong> {i.productName} (₹{i.sellingPrice * i.quantity})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )
              )}

              {/* VIEW 3: TODAY'S PROFIT - ITEM BREAKDOWN */}
              {modalType === 'todayProfit' && (
                filteredProfitItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <TrendingUp size={36} className="mx-auto text-gray-300" />
                    <p className="font-bold text-gray-700 text-sm">No profits recorded today</p>
                    <p className="text-xs text-gray-400">Sell products in Billing to see individual profit margins.</p>
                  </div>
                ) : (
                  filteredProfitItems.map((item) => {
                    const unitProfit = item.sellingPrice - item.purchasePrice;
                    const itemMargin = item.sellingPrice > 0 ? Math.round((unitProfit / item.sellingPrice) * 100) : 0;
                    const profitShare = todayProfit > 0 ? Math.round((item.totalProfit / todayProfit) * 100) : 0;

                    return (
                      <div
                        key={item.productId}
                        className="p-3.5 bg-white rounded-xl border border-gray-200 hover:border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900 truncate">{item.productName}</span>
                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded uppercase">
                              {item.category}
                            </span>
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                              {profitShare}% of today's profit
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-3">
                            <span>Cost: ₹{item.purchasePrice}</span>
                            <span>Selling: ₹{item.sellingPrice}</span>
                            <span className="text-gray-700">Profit / unit: <strong className="text-emerald-700">+₹{unitProfit}</strong> ({itemMargin}% margin)</span>
                            <span>Units Sold: <strong>{item.quantity}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          <div className="text-right">
                            <div className="text-[10px] text-gray-400 font-bold uppercase">Total Item Profit</div>
                            <div className="text-base font-black text-emerald-600">
                              +₹{item.totalProfit}
                            </div>
                          </div>
                          <div className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            ₹{item.totalRevenue} sold
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* VIEW 4: TOTAL INVENTORY & LOW STOCK (EXISTING) */}
              {(modalType === 'total' || modalType === 'lowStock') && (
                modalProducts.length === 0 ? (
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
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                {modalType === 'todaySales' && (
                  salesViewTab === 'products'
                    ? `Showing ${filteredSalesItems.length} products sold today`
                    : `Showing ${filteredSalesTransactions.length} bills today`
                )}
                {modalType === 'todayProfit' && `Showing ${filteredProfitItems.length} profit-generating products`}
                {modalType === 'lowStock' && `Showing ${modalProducts.length} of ${lowStockProducts.length} low stock products`}
                {modalType === 'total' && `Showing ${modalProducts.length} of ${products.length} products`}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {modalType === 'todaySales' && (
                  <button
                    type="button"
                    onClick={() => { setModalType(null); setCurrentPage('billing'); }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ShoppingCart size={14} /> New Sale (POS)
                  </button>
                )}

                {modalType === 'todayProfit' && (
                  <button
                    type="button"
                    onClick={() => { setModalType(null); setCurrentPage('billing'); }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ShoppingCart size={14} /> Create New Sale
                  </button>
                )}

                {modalType === 'lowStock' && (
                  <button
                    type="button"
                    onClick={() => { setModalType(null); setCurrentPage('smart-restock'); }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RefreshCw size={14} /> Open Smart Restock
                  </button>
                )}

                {modalType === 'total' && (
                  <button
                    type="button"
                    onClick={() => { setModalType(null); setCurrentPage('inventory'); }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 transition-all"
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
