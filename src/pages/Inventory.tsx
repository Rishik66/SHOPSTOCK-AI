import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, PlusCircle, MinusCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product } from '../types';

export function Inventory() {
  const { products, setProducts, language, addNotification } = useApp();
  const [search, setSearch] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  
  const [adjustStock, setAdjustStock] = useState<{ id: string, type: 'add' | 'remove', name: string, stock: number } | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, search]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, category, stock, purchasePrice, sellingPrice, minimumStock } = formData;
    if (!name || !category || stock === undefined || purchasePrice === undefined || sellingPrice === undefined || minimumStock === undefined) return;
    
    if (editingId) {
      setProducts(products.map(p => p.id === editingId ? { ...p, ...formData as Product } : p));
      addNotification({ type: 'success', message: tr(language, 'notif_updated', { name }) });
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        name, category, stock, purchasePrice, sellingPrice, minimumStock
      };
      setProducts([...products, newProduct]);
      addNotification({ type: 'success', message: tr(language, 'notif_added', { name }) });
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({});
  };

  const handleEdit = (p: Product) => {
    setFormData(p);
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(tr(language, 'inv_confirmDelete'))) {
      setProducts(products.filter(p => p.id !== id));
      addNotification({ type: 'info', message: tr(language, 'notif_deleted', { name }) });
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustStock || adjustQty <= 0) return;
    const { id, type, name, stock } = adjustStock;
    if (type === 'remove' && adjustQty > stock) return;

    const newStock = type === 'add' ? stock + adjustQty : stock - adjustQty;
    setProducts(products.map(p => p.id === id ? { ...p, stock: newStock } : p));
    
    addNotification({ type: 'success', message: tr(language, type === 'add' ? 'notif_stockAdded' : 'notif_stockRemoved', { qty: adjustQty, name }) });
    setAdjustStock(null);
    setAdjustQty(0);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={tr(language, 'inv_search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={() => { setFormData({}); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus size={20} /> {tr(language, 'inv_add')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="p-4 font-medium">{tr(language, 'inv_product')}</th>
                <th className="p-4 font-medium">{tr(language, 'inv_category')}</th>
                <th className="p-4 font-medium">{tr(language, 'inv_stock')}</th>
                <th className="p-4 font-medium">{tr(language, 'inv_purchase')}</th>
                <th className="p-4 font-medium">{tr(language, 'inv_selling')}</th>
                <th className="p-4 font-medium">{tr(language, 'inv_status')}</th>
                <th className="p-4 font-medium">{tr(language, 'inv_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">{tr(language, 'inv_empty')}</td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-medium text-gray-900">{p.name}</td>
                    <td className="p-4 text-gray-600">{p.category}</td>
                    <td className="p-4">
                      <span className="font-semibold text-gray-900">{p.stock}</span>
                      <span className="text-xs text-gray-500 ml-1">/ min {p.minimumStock}</span>
                    </td>
                    <td className="p-4">₹{p.purchasePrice}</td>
                    <td className="p-4">₹{p.sellingPrice}</td>
                    <td className="p-4">
                      {p.stock <= p.minimumStock ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          🔴 {tr(language, 'inv_lowstock')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          🟢 {tr(language, 'inv_instock')}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(p)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title={tr(language, 'inv_edit')}><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1 text-red-600 hover:bg-red-50 rounded" title={tr(language, 'inv_delete')}><Trash2 size={16} /></button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <button onClick={() => setAdjustStock({ id: p.id, type: 'add', name: p.name, stock: p.stock })} className="p-1 text-green-600 hover:bg-green-50 rounded" title={tr(language, 'inv_addstock')}><PlusCircle size={16} /></button>
                        <button onClick={() => setAdjustStock({ id: p.id, type: 'remove', name: p.name, stock: p.stock })} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title={tr(language, 'inv_removestock')}><MinusCircle size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">{editingId ? tr(language, 'inv_edit') : tr(language, 'inv_add')}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'inv_name')}*</label>
                <input required type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'inv_category')}*</label>
                <input required type="text" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'inv_stock')}*</label>
                  <input required type="number" min="0" value={formData.stock ?? ''} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'inv_minstock')}*</label>
                  <input required type="number" min="1" value={formData.minimumStock ?? ''} onChange={e => setFormData({ ...formData, minimumStock: parseInt(e.target.value) })} className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'inv_purchase')}*</label>
                  <input required type="number" min="0" step="0.01" value={formData.purchasePrice ?? ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })} className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'inv_selling')}*</label>
                  <input required type="number" min="0" step="0.01" value={formData.sellingPrice ?? ''} onChange={e => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })} className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700">{tr(language, 'cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tr(language, 'save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adjustStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">{tr(language, adjustStock.type === 'add' ? 'inv_addstock' : 'inv_removestock')}</h2>
              <button onClick={() => setAdjustStock(null)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-4 space-y-4">
              <p className="text-sm text-gray-600">Product: <span className="font-medium text-gray-900">{adjustStock.name}</span></p>
              <p className="text-sm text-gray-600">Current Stock: <span className="font-medium text-gray-900">{adjustStock.stock}</span></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'inv_qty')}</label>
                <input autoFocus required type="number" min="1" max={adjustStock.type === 'remove' ? adjustStock.stock : undefined} value={adjustQty || ''} onChange={e => setAdjustQty(parseInt(e.target.value))} className="w-full border-gray-300 rounded-lg p-2 border focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-2 pt-2 mt-4">
                <button type="button" onClick={() => setAdjustStock(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700">{tr(language, 'cancel')}</button>
                <button type="submit" className={`px-4 py-2 text-white rounded-lg ${adjustStock.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>{tr(language, 'confirm')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
