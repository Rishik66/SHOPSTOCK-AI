import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Package, AlertTriangle, ShoppingCart, Bot, RefreshCw, Camera, Plus } from 'lucide-react';

export function Dashboard() {
  const { products, transactions, language, setCurrentPage } = useApp();

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{tr(language, 'todaySales')}</p>
            <p className="text-2xl font-bold">₹{todaySales}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{tr(language, 'todayProfit')}</p>
            <p className="text-2xl font-bold">₹{todayProfit}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Package size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{tr(language, 'totalProducts')}</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{tr(language, 'lowStock')}</p>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : ''}`}>{lowStockCount}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">{tr(language, 'quickActions')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <button onClick={() => setCurrentPage('inventory')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2">
            <Plus size={24} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'addProduct')}</span>
          </button>
          <button onClick={() => setCurrentPage('billing')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2">
            <ShoppingCart size={24} className="text-green-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'newSale')}</span>
          </button>
          <button onClick={() => setCurrentPage('ai-assistant')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2">
            <Bot size={24} className="text-purple-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'askAI')}</span>
          </button>
          <button onClick={() => setCurrentPage('smart-restock')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2">
            <RefreshCw size={24} className="text-orange-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'viewRestock')}</span>
          </button>
          <button onClick={() => setCurrentPage('invoice-scanner')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 gap-2">
            <Camera size={24} className="text-teal-500" />
            <span className="text-sm font-medium text-gray-700">{tr(language, 'scanInvoice')}</span>
          </button>
        </div>
      </div>

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
    </div>
  );
}
