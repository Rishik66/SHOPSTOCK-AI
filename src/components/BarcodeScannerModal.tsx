import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, X, Flashlight, Upload, CheckCircle2, AlertTriangle, 
  RefreshCw, Barcode, Plus, Minus, ArrowRight, ShoppingCart, Package
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { 
  identifyProductByBarcode, 
  playBarcodeBeep, 
  BarcodeRecognitionResult 
} from '../services/barcodeService';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'billing' | 'inventory';
  onScannedForBilling?: (product: Product) => void;
  onScannedForInventory?: (product: Product, quantityToAdd: number) => void;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  mode,
  onScannedForBilling,
  onScannedForInventory
}: BarcodeScannerModalProps) {
  const { products } = useApp();

  const [scanMethod, setScanMethod] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [canToggleTorch, setCanToggleTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastScannedResult, setLastScannedResult] = useState<BarcodeRecognitionResult | null>(null);
  const [inventoryQty, setInventoryQty] = useState(1);
  const [recentScans, setRecentScans] = useState<{ code: string; name: string; time: string }[]>([]);
  const [continuousScan, setContinuousScan] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop scanner safely
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Scanner stop warning:", e);
      }
      scannerRef.current = null;
    }
  };

  // Start camera scanner
  const startCamera = async () => {
    await stopScanner();
    setCameraError(null);

    const element = document.getElementById("barcode-camera-view");
    if (!element) return;

    try {
      const html5QrCode = new Html5Qrcode("barcode-camera-view");
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.3333,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        () => {
          // ignore intermediate frames
        }
      );

      // Check if torch/flashlight is supported
      try {
        // @ts-ignore
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setCanToggleTorch(true);
        }
      } catch {}

    } catch (err: any) {
      console.warn("Camera start error:", err);
      setCameraError(
        "Camera permission was blocked or unavailable on this device. You can still scan using Image Upload, USB Barcode Scanner, or the Test Barcodes below."
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLastScannedResult(null);
      setInventoryQty(1);
      if (scanMethod === 'camera') {
        const timer = setTimeout(() => {
          startCamera();
        }, 150);
        return () => clearTimeout(timer);
      }
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen, scanMethod]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !scannerRef.current.isScanning) return;
    try {
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn("Torch toggle error:", e);
    }
  };

  // Handle scanned/entered code
  const handleDetectedCode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    // Throttle duplicate reads within 1.5 seconds
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1500) {
      return;
    }
    lastScanTimeRef.current = now;

    // Play instant supermarket POS beep
    playBarcodeBeep();

    // Recognize product
    const result = identifyProductByBarcode(clean, products);
    setLastScannedResult(result);

    // Add to recent scans list
    setRecentScans(prev => [
      { code: clean, name: result.product.name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
      ...prev.slice(0, 4)
    ]);

    if (mode === 'billing') {
      // Immediately add to bill automatically!
      onScannedForBilling?.(result.product);
      if (!continuousScan) {
        onClose();
      }
    }
  };

  // Image Upload Barcode Scanning
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      await stopScanner();
      const html5QrCode = new Html5Qrcode("barcode-file-scan-temp");
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleDetectedCode(decodedText);
    } catch (e) {
      alert("Could not detect a clear barcode in this image. Please ensure the barcode is sharp, well-lit, and unobstructed.");
    }
  };

  // Inventory update action
  const handleConfirmInventoryUpdate = () => {
    if (!lastScannedResult) return;
    onScannedForInventory?.(lastScannedResult.product, inventoryQty);
    if (!continuousScan) {
      onClose();
    } else {
      setLastScannedResult(null);
      setInventoryQty(1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          mode === 'billing' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md">
              <Barcode size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                {mode === 'billing' ? 'Barcode POS Scanner' : 'Inventory Barcode Scanner'}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-white/20 text-white">
                  {mode === 'billing' ? 'Auto-Add to Bill' : 'Update Stock'}
                </span>
              </h2>
              <p className="text-xs text-white/80">
                {mode === 'billing' 
                  ? 'Scan any product barcode to automatically add it to the bill.'
                  : 'Scan product barcode to identify and update inventory stock.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner Methods Switcher (Camera | Upload | Manual) */}
        <div className="p-2.5 bg-slate-100 border-b border-gray-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScanMethod('camera')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                scanMethod === 'camera' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera size={14} /> Live Camera
            </button>
            <button
              type="button"
              onClick={() => { stopScanner(); setScanMethod('upload'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                scanMethod === 'upload' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload size={14} /> Upload Image
            </button>
            <button
              type="button"
              onClick={() => { stopScanner(); setScanMethod('manual'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                scanMethod === 'manual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Barcode size={14} /> Barcode Gun / Keypad
            </button>
          </div>

          <label className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={continuousScan}
              onChange={(e) => setContinuousScan(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Continuous Scan</span>
          </label>
        </div>

        {/* Viewfinder / Input Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/60">
          
          {/* METHOD 1: LIVE CAMERA VIEWFINDER */}
          {scanMethod === 'camera' && (
            <div className="space-y-3">
              <div className="relative bg-black rounded-2xl overflow-hidden shadow-inner aspect-[4/3] max-h-72 w-full mx-auto flex items-center justify-center border-2 border-slate-800">
                <div id="barcode-camera-view" className="w-full h-full object-cover"></div>

                {/* Laser scan animation overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center p-6">
                  <div className="w-64 h-36 border-2 border-dashed border-red-500/80 rounded-xl relative shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center">
                    <div className="w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse"></div>
                    <span className="absolute bottom-2 text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded uppercase tracking-wider font-bold">
                      Align Barcode Inside Box
                    </span>
                  </div>
                </div>

                {/* Flashlight button if supported */}
                {canToggleTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-all shadow-md ${
                      torchOn ? 'bg-amber-400 text-slate-900' : 'bg-black/60 text-white hover:bg-black/80'
                    }`}
                    title="Toggle Flashlight"
                  >
                    <Flashlight size={18} />
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Camera note:</span> {cameraError}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* METHOD 2: UPLOAD BARCODE IMAGE */}
          {scanMethod === 'upload' && (
            <div className="space-y-3">
              <div id="barcode-file-scan-temp" className="hidden"></div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800">Click to Select Barcode Photo</p>
                  <p className="text-xs text-slate-500 mt-0.5">Supports PNG, JPG, or WEBP photo of product packaging</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* METHOD 3: MANUAL INPUT / USB BARCODE SCANNER GUN */}
          {scanMethod === 'manual' && (
            <div className="space-y-3">
              <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Barcode size={16} className="text-blue-600" />
                  <span>Scan with USB Barcode Scanner Gun or Type Barcode Number:</span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualCode.trim()) {
                      handleDetectedCode(manualCode);
                      setManualCode('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Scan or type barcode (e.g. 8901719101038)"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 transition-all"
                  >
                    Lookup
                  </button>
                </form>
              </div>
            </div>
          )}


          {/* SCANNED PRODUCT RESULT CARD */}
          {lastScannedResult && (
            <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl shadow-sm animate-fade-in space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-base">{lastScannedResult.product.name}</h3>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">
                        {lastScannedResult.product.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Barcode: {lastScannedResult.barcode}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-black text-slate-900">
                    ₹{lastScannedResult.product.sellingPrice}
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold">
                    Current Stock: <strong className="text-slate-800">{lastScannedResult.product.stock}</strong>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {mode === 'billing' ? (
                <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <ShoppingCart size={15} className="text-emerald-600" />
                  <span>Added automatically to your current bill!</span>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Quantity to add to inventory stock:</span>
                    <span className="text-emerald-700">
                      New Stock will be: {lastScannedResult.product.stock + inventoryQty} units
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setInventoryQty(Math.max(1, inventoryQty - 1))}
                        className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={inventoryQty}
                        onChange={(e) => setInventoryQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 text-center bg-transparent font-black text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setInventoryQty(inventoryQty + 1)}
                        className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {[5, 10, 25, 50].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setInventoryQty(qty)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          inventoryQty === qty 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                        }`}
                      >
                        +{qty}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={handleConfirmInventoryUpdate}
                      className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                    >
                      <Package size={14} /> Update Stock
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent Scans Strip */}
          {recentScans.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Recent Scans this session:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentScans.map((s, idx) => (
                  <span key={idx} className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 shadow-2xs">
                    <span className="font-bold text-slate-900">{s.name}</span>
                    <span className="text-[10px] text-slate-400">({s.time})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Scanner active and ready</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            Done / Close
          </button>
        </div>

      </div>
    </div>
  );
}
