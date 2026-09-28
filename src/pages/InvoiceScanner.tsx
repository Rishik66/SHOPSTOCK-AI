import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product } from '../types';

interface DetectedItem {
  product: Product;
  quantity: number;
}

export function InvoiceScanner() {
  const { products, setProducts, language, addNotification } = useApp();
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const url = URL.createObjectURL(file);
    setImage(url);
    setAnalyzing(true);
    setDetectedItems([]);

    setTimeout(() => {
      // Simulate OCR result
      const shuffled = [...products].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(4, products.length));
      
      const items = selected.map(p => ({
        product: p,
        quantity: Math.floor(Math.random() * 25) + 15
      }));
      
      setDetectedItems(items);
      setAnalyzing(false);
    }, 1500);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = () => {
    const newProducts = products.map(p => {
      const detected = detectedItems.find(d => d.product.id === p.id);
      if (detected) {
        return { ...p, stock: p.stock + detected.quantity };
      }
      return p;
    });
    
    setProducts(newProducts);
    addNotification({ type: 'success', message: tr(language, 'inv_scanner_success') });
    
    setImage(null);
    setDetectedItems([]);
  };

  const handleCancel = () => {
    setImage(null);
    setDetectedItems([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateQuantity = (id: string, qty: number) => {
    setDetectedItems(prev => prev.map(item => item.product.id === id ? { ...item, quantity: qty } : item));
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Upload Panel */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-8rem)]">
        <div className="p-4 bg-amber-100 border-b border-amber-200 text-center">
          <p className="font-bold text-amber-800 uppercase tracking-wider text-sm">{tr(language, 'inv_scanner_demo')}</p>
          <p className="text-amber-700 text-xs mt-1">{tr(language, 'inv_scanner_note')}</p>
        </div>
        
        <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-y-auto">
          {image ? (
            <div className="relative max-h-full max-w-full">
              <img src={image} alt="Invoice preview" className="max-w-full max-h-[500px] object-contain rounded-lg shadow-sm border border-gray-200" />
              <button onClick={handleCancel} className="absolute -top-3 -right-3 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-md aspect-square max-h-[400px] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors bg-gray-50/50"
            >
              <Camera size={48} className="text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium text-center px-4">{tr(language, 'inv_scanner_upload')}</p>
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={e => e.target.files && handleFile(e.target.files[0])} 
              />
            </div>
          )}
        </div>
      </div>

      {/* Results Panel */}
      <div className="w-full lg:w-[450px] flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <FileText size={20} className="text-gray-500" />
          <h2 className="font-semibold text-lg">{tr(language, 'inv_scanner_detected')}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {!image ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <p>{tr(language, 'inv_scanner_select')}</p>
            </div>
          ) : analyzing ? (
            <div className="h-full flex flex-col items-center justify-center text-blue-600 space-y-4">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="font-medium">Analyzing invoice...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {detectedItems.map(item => (
                <div key={item.product.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{item.product.name}</div>
                      <div className="text-sm text-gray-500">{item.product.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">{tr(language, 'inv_scanner_edit')}:</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={item.quantity} 
                      onChange={e => updateQuantity(item.product.id, parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-right focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {detectedItems.length > 0 && !analyzing && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium"
            >
              {tr(language, 'inv_scanner_cancel')}
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-2.5 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium flex items-center justify-center gap-2"
            >
              <Check size={20} />
              {tr(language, 'inv_scanner_confirm')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
