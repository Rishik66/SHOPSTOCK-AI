import React, { useState, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product, CartItem } from '../types';

export function Billing() {
  const { products, setProducts, transactions, setTransactions, language, addNotification, currentUser } = useApp();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showReceipt, setShowReceipt] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, search]);

  const addToCart = (product: Product) => {
    if (product.stock === 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return { ...item, quantity: 0 }; // handled by filter below
          if (newQty > item.product.stock) return item;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);

  const completeSale = () => {
    if (cart.length === 0) return;
    
    // Validate stock
    for (const item of cart) {
      const p = products.find(x => x.id === item.product.id);
      if (!p || p.stock < item.quantity) {
        addNotification({ type: 'error', message: `Only ${p?.stock || 0} ${item.product.name} available` });
        return;
      }
    }

    const txId = 'TXN-' + Date.now().toString().slice(-6);
    const date = new Date().toISOString();
    
    const profit = cart.reduce((sum, item) => sum + ((item.product.sellingPrice - item.product.purchasePrice) * item.quantity), 0);

    const newTxn = {
      id: txId,
      date,
      items: cart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        sellingPrice: i.product.sellingPrice,
        purchasePrice: i.product.purchasePrice
      })),
      total: subtotal,
      profit
    };

    setTransactions([newTxn, ...transactions]);

    const newProducts = products.map(p => {
      const cItem = cart.find(i => i.product.id === p.id);
      if (cItem) {
        return { ...p, stock: p.stock - cItem.quantity };
      }
      return p;
    });
    setProducts(newProducts);
    
    addNotification({ type: 'success', message: tr(language, 'notif_sale') });
    setShowReceipt(txId);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={tr(language, 'bill_search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock === 0}
                className={`relative p-3 border rounded-xl text-left transition-all ${
                  p.stock === 0 ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md'
                }`}
              >
                {p.stock === 0 && (
                  <div className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded uppercase">Out</div>
                )}
                <div className="text-sm text-gray-500 mb-1">{p.category}</div>
                <div className="font-medium text-gray-900 mb-2 truncate">{p.name}</div>
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg">₹{p.sellingPrice}</span>
                  <span className="text-xs text-gray-500">Stock: {p.stock}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Panel */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2"><ShoppingCart size={20} /> {tr(language, 'bill_cart')}</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{cart.length} items</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <ShoppingCart size={48} className="opacity-20" />
              <p>{tr(language, 'bill_empty')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex justify-between items-center pb-4 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="font-medium text-gray-900 truncate">{item.product.name}</div>
                    <div className="text-sm text-gray-500">₹{item.product.sellingPrice}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-100 rounded-lg">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1.5 text-gray-600 hover:text-gray-900"><Minus size={16} /></button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1.5 text-gray-600 hover:text-gray-900"><Plus size={16} /></button>
                    </div>
                    <div className="font-medium text-gray-900 w-16 text-right">₹{item.product.sellingPrice * item.quantity}</div>
                    <button onClick={() => updateQuantity(item.product.id, -item.quantity)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">{tr(language, 'bill_subtotal')}</span>
            <span className="font-medium">₹{subtotal}</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold">
            <span>{tr(language, 'bill_total')}</span>
            <span className="text-blue-600">₹{subtotal}</span>
          </div>
          <button
            onClick={completeSale}
            disabled={cart.length === 0}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle size={20} />
            {tr(language, 'bill_complete')}
          </button>
        </div>
      </div>

      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-full">
            <div className="p-6 overflow-y-auto print:p-0">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold mb-1">{currentUser?.shopName || 'ShopStock Store'}</h2>
                <p className="text-sm text-gray-500">{tr(language, 'bill_receipt')}</p>
                <div className="text-xs text-gray-400 mt-2 flex justify-between">
                  <span>{tr(language, 'bill_date')}: {new Date().toLocaleDateString()}</span>
                  <span>Inv: {showReceipt}</span>
                </div>
              </div>
              
              <div className="border-t border-b border-dashed border-gray-300 py-4 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-2 font-normal">Item</th>
                      <th className="pb-2 font-normal text-right">Qty</th>
                      <th className="pb-2 font-normal text-right">Price</th>
                      <th className="pb-2 font-normal text-right">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.product.id}>
                        <td className="py-1 pr-2 truncate max-w-[120px] font-medium">{item.product.name}</td>
                        <td className="py-1 text-right">{item.quantity}</td>
                        <td className="py-1 text-right">{item.product.sellingPrice}</td>
                        <td className="py-1 text-right">{item.product.sellingPrice * item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-between items-center text-lg font-bold mb-6">
                <span>{tr(language, 'bill_total')}</span>
                <span>₹{subtotal}</span>
              </div>
              
              <div className="text-center text-sm text-gray-500 font-medium">
                {tr(language, 'bill_thank')}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
              >
                {tr(language, 'bill_print')}
              </button>
              <button
                onClick={() => { setShowReceipt(null); setCart([]); }}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {tr(language, 'bill_newSale')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
