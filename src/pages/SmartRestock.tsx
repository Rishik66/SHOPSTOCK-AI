import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { RefreshCw, Copy, Check } from 'lucide-react';

export function SmartRestock() {
  const { products, transactions, language } = useApp();
  const [copied, setCopied] = useState(false);

  const restockData = useMemo(() => {
    const data = products.map(product => {
      const salesByDay: Record<string, number> = {};
      transactions.forEach(t => {
        const day = t.date.slice(0, 10);
        t.items.filter(i => i.productId === product.id).forEach(i => {
          salesByDay[day] = (salesByDay[day] || 0) + i.quantity;
        });
      });
      
      const days = Object.keys(salesByDay).length;
      const totalSold = Object.values(salesByDay).reduce((s, v) => s + v, 0);
      const avgDailySales = days > 0 ? totalSold / days : 0.5; // default 0.5 if no data
      const daysRemaining = avgDailySales > 0 ? Math.floor(product.stock / avgDailySales) : 999;
      const recommendedQty = Math.ceil(avgDailySales * 14) - product.stock; // 2 weeks supply
      const status = daysRemaining <= 3 ? 'URGENT' : daysRemaining <= 7 ? 'SOON' : 'HEALTHY';

      return { product, avgDailySales, daysRemaining, recommendedQty, status };
    });

    return data.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [products, transactions]);

  const itemsToOrder = restockData.filter(d => d.recommendedQty > 0);

  const generateList = () => {
    let text = `${tr(language, 'rst_list')}\n\n`;
    itemsToOrder.forEach(d => {
      text += `${d.product.name} — ${d.recommendedQty} units\n`;
    });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><RefreshCw size={24} /></div>
          <div>
            <h2 className="font-semibold text-lg">{tr(language, 'rst_title')}</h2>
            <p className="text-sm text-gray-500">{tr(language, 'rst_estimated')}</p>
          </div>
        </div>
        
        <button
          onClick={generateList}
          disabled={itemsToOrder.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? tr(language, 'rst_copied') : tr(language, 'rst_generate')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="p-4 font-medium">{tr(language, 'rst_product')}</th>
                <th className="p-4 font-medium">{tr(language, 'inv_category')}</th>
                <th className="p-4 font-medium">{tr(language, 'rst_stock')}</th>
                <th className="p-4 font-medium">{tr(language, 'rst_avg')}</th>
                <th className="p-4 font-medium">{tr(language, 'rst_days')}</th>
                <th className="p-4 font-medium">{tr(language, 'rst_rec')}</th>
                <th className="p-4 font-medium">{tr(language, 'rst_status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {restockData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">{tr(language, 'inv_empty')}</td>
                </tr>
              ) : (
                restockData.map(d => (
                  <tr key={d.product.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-medium text-gray-900">{d.product.name}</td>
                    <td className="p-4 text-gray-600">{d.product.category}</td>
                    <td className="p-4 font-medium">{d.product.stock}</td>
                    <td className="p-4 text-gray-600">{d.avgDailySales.toFixed(1)}</td>
                    <td className="p-4 font-medium">{d.daysRemaining > 365 ? '365+' : d.daysRemaining}</td>
                    <td className="p-4 font-bold text-blue-600">{Math.max(d.recommendedQty, 0)}</td>
                    <td className="p-4">
                      {d.status === 'URGENT' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">{tr(language, 'rst_urgent')}</span>}
                      {d.status === 'SOON' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">{tr(language, 'rst_soon')}</span>}
                      {d.status === 'HEALTHY' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">{tr(language, 'rst_healthy')}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
