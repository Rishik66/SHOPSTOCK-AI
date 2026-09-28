import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Upload, X, Check, FileText, Barcode, Plus, Minus, 
  CheckCircle2, AlertTriangle, ArrowRight, Package, ShoppingCart
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { tr } from '../i18n';
import { Product } from '../types';
import { 
  identifyProductByBarcode, 
  playBarcodeBeep, 
  BarcodeRecognitionResult 
} from '../services/barcodeService';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

interface DetectedItem {
  product: Product;
  quantity: number;
}

export function InvoiceScanner() {
  const { products, setProducts, language, addNotification, setCurrentPage } = useApp();
  
  // Tab state: 'barcode' or 'invoice'
  const [activeTab, setActiveTab] = useState<'barcode' | 'invoice'>('barcode');

  // ==========================================
  // TAB 1: BARCODE WORKSTATION STATE
  // ==========================================
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScannedResult, setLastScannedResult] = useState<BarcodeRecognitionResult | null>(null);
  const [stockAddQty, setStockAddQty] = useState(5);
  const [scanHistory, setScanHistory] = useState<Array<{
    code: string;
    productName: string;
    quantityAdded: number;
    timestamp: string;
  }>>([]);

  const handleBarcodeLookup = (codeToLookup: string) => {
    const clean = codeToLookup.trim();
    if (!clean) return;

    playBarcodeBeep();
    const result = identifyProductByBarcode(clean, products);
    setLastScannedResult(result);
  };

  const handleApplyBarcodeStock = (product: Product, qty: number) => {
    let updatedProducts: Product[];
    const existingIndex = products.findIndex(p => p.id === product.id);

    if (existingIndex >= 0) {
      updatedProducts = products.map((p, idx) => 
        idx === existingIndex 
          ? { ...p, stock: p.stock + qty, barcode: p.barcode || product.barcode } 
          : p
      );
    } else {
      updatedProducts = [{ ...product, stock: qty }, ...products];
    }

    setProducts(updatedProducts);
    addNotification({
      type: 'success',
      message: `Stock updated: +${qty} ${product.name} (Total: ${(product.stock || 0) + qty})`
    });

    setScanHistory(prev => [
      {
        code: product.barcode || 'N/A',
        productName: product.name,
        quantityAdded: qty,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev.slice(0, 9)
    ]);

    setLastScannedResult(null);
    setBarcodeInput('');
    setStockAddQty(5);
  };

  // ==========================================
  // TAB 2: INVOICE OCR STATE
  // ==========================================
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
      // Simulate OCR result from current products
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

  const handleConfirmInvoice = () => {
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

  const handleCancelInvoice = () => {
    setImage(null);
    setDetectedItems([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateQuantity = (id: string, qty: number) => {
    setDetectedItems(prev => prev.map(item => item.product.id === id ? { ...item, quantity: qty } : item));
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              {activeTab === 'barcode' ? <Barcode size={24} /> : <FileText size={24} />}
            </span>
            <span>Barcode & Invoice Scanner</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {activeTab === 'barcode'
              ? 'Scan barcodes with camera, barcode gun, or image upload to quickly recognize products and add stock.'
              : 'Upload supplier invoices or receipts to automatically extract products and update stock.'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('barcode')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'barcode'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Barcode size={16} />
            <span>Barcode Workstation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'invoice'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText size={16} />
            <span>Invoice OCR</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: BARCODE SCANNER WORKSTATION                   */}
      {/* ==================================================== */}
      {activeTab === 'barcode' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Scanner Console */}
          <div className="lg:col-span-2 space-y-5">
            {/* Live Camera Launch Card */}
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Barcode size={180} />
              </div>
              <div className="relative z-10 space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                  <Camera size={14} /> Live Barcode Recognition
                </div>
                <h2 className="text-2xl font-black">Supermarket Barcode Workstation</h2>
                <p className="text-sm text-slate-300">
                  Instantly scan any standard 13-digit EAN-13 barcode or QR code with your device camera, 
                  USB handheld barcode scanner gun, or image upload. Automatic recognition from your inventory 
                  or standard Indian FMCG catalog!
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsScannerModalOpen(true)}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Camera size={18} />
                    <span>Open Live Camera Scanner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage('billing')}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-sm backdrop-blur-sm flex items-center gap-2 transition-all"
                  >
                    <ShoppingCart size={18} />
                    <span>Go to Billing Barcode Scanner</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Barcode Number Input / USB Scanner Gun Form */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Barcode size={18} className="text-blue-600" />
                  <span>USB Barcode Reader Gun / Manual Code Lookup</span>
                </h3>
                <span className="text-xs text-gray-400 font-medium">Press Enter after scanning</span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBarcodeLookup(barcodeInput);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan with USB gun or enter barcode (e.g. 8901719101038)..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!barcodeInput.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md disabled:opacity-40 transition-all flex items-center gap-2"
                >
                  <span>Identify Product</span>
                </button>
              </form>


            </div>

            {/* Recognized Product Card */}
            {lastScannedResult && (
              <div className="bg-emerald-50/90 border-2 border-emerald-400 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <CheckCircle2 size={26} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black text-gray-900">{lastScannedResult.product.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800">
                          {lastScannedResult.product.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-mono mt-1">
                        Barcode: <span className="font-bold text-gray-900">{lastScannedResult.barcode}</span> • 
                        Source: <span className="capitalize">{lastScannedResult.source.replace('_', ' ')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-gray-900">₹{lastScannedResult.product.sellingPrice}</div>
                    <div className="text-xs text-gray-500">
                      Current Stock: <strong className="text-gray-900">{lastScannedResult.product.stock} units</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span>Select quantity to add to inventory:</span>
                    <span className="text-emerald-700 font-bold">
                      New Stock will be: {lastScannedResult.product.stock + stockAddQty} units
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center border border-gray-200 rounded-xl bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setStockAddQty(Math.max(1, stockAddQty - 1))}
                        className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={stockAddQty}
                        onChange={(e) => setStockAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 text-center bg-transparent font-black text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setStockAddQty(stockAddQty + 1)}
                        className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {[5, 10, 20, 50, 100].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setStockAddQty(qty)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          stockAddQty === qty
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        +{qty}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleApplyBarcodeStock(lastScannedResult.product, stockAddQty)}
                      className="ml-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all"
                    >
                      <Package size={16} />
                      <span>Confirm & Update Stock</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Recent Scans History */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <h3 className="font-bold text-gray-900 text-base flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="flex items-center gap-2">
                <Package size={18} className="text-emerald-600" />
                <span>Barcode Stock In Log</span>
              </span>
              <span className="text-xs bg-slate-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                {scanHistory.length}
              </span>
            </h3>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {scanHistory.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-gray-400 p-4">
                  <Barcode size={36} className="text-gray-300 mb-2" />
                  <p className="text-xs font-medium">No barcode scans recorded yet this session.</p>
                  <p className="text-[11px] text-gray-400 mt-1">Use the camera or USB scanner gun to add stock.</p>
                </div>
              ) : (
                scanHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-gray-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-gray-900">{item.productName}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {item.code} • {item.timestamp}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        +{item.quantityAdded} units
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCurrentPage('inventory')}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <span>View Full Inventory</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: INVOICE OCR SCANNER                           */}
      {/* ==================================================== */}
      {activeTab === 'invoice' && (
        <div className="h-full flex flex-col lg:flex-row gap-6">
          {/* Upload Panel */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-14rem)]">
            <div className="p-4 bg-amber-50 border-b border-amber-200 text-center">
              <p className="font-bold text-amber-800 uppercase tracking-wider text-xs">{tr(language, 'inv_scanner_demo')}</p>
              <p className="text-amber-700 text-xs mt-0.5">{tr(language, 'inv_scanner_note')}</p>
            </div>
            
            <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-y-auto">
              {image ? (
                <div className="relative max-h-full max-w-full">
                  <img src={image} alt="Invoice preview" className="max-w-full max-h-[460px] object-contain rounded-xl shadow-sm border border-gray-200" />
                  <button onClick={handleCancelInvoice} className="absolute -top-3 -right-3 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div 
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-md aspect-square max-h-[380px] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors bg-gray-50/50"
                >
                  <Camera size={44} className="text-gray-400 mb-3" />
                  <p className="text-gray-700 font-bold text-center px-4">{tr(language, 'inv_scanner_upload')}</p>
                  <p className="text-xs text-gray-400 mt-1">Upload supplier bill or receipt photo</p>
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
          <div className="w-full lg:w-[450px] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-14rem)]">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <FileText size={20} className="text-gray-500" />
              <h2 className="font-bold text-base text-gray-900">{tr(language, 'inv_scanner_detected')}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {!image ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-6">
                  <FileText size={40} className="text-gray-300 mb-2" />
                  <p className="text-sm font-medium">{tr(language, 'inv_scanner_select')}</p>
                  <p className="text-xs text-gray-400 mt-1">OCR will extract item names and suggested restock quantities.</p>
                </div>
              ) : analyzing ? (
                <div className="h-full flex flex-col items-center justify-center text-blue-600 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="font-semibold text-sm">Analyzing invoice text and line items...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detectedItems.map(item => (
                    <div key={item.product.id} className="p-3.5 border border-gray-200 rounded-xl bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-sm text-gray-900">{item.product.name}</div>
                          <div className="text-xs text-gray-500">{item.product.category}</div>
                        </div>
                        <span className="text-xs font-semibold text-gray-500">
                          Stock: {item.product.stock}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <label className="text-xs font-bold text-gray-700">{tr(language, 'inv_scanner_edit')}:</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity} 
                          onChange={e => updateQuantity(item.product.id, parseInt(e.target.value) || 0)}
                          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-right font-bold text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
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
                  type="button"
                  onClick={handleCancelInvoice}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-xs"
                >
                  {tr(language, 'inv_scanner_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInvoice}
                  className="flex-[2] py-2.5 px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                >
                  <Check size={18} />
                  <span>{tr(language, 'inv_scanner_confirm')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal (Camera / Upload / Manual) */}
      <BarcodeScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        mode="inventory"
        onScannedForInventory={(product, qty) => {
          handleApplyBarcodeStock(product, qty);
        }}
      />
    </div>
  );
}
