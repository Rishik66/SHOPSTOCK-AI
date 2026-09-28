import { Product } from '../types';

export interface BarcodeCatalogItem {
  barcode: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  aliases?: string[];
}

/**
 * Standard Indian FMCG Barcode Catalog
 * Supports real 13-digit EAN-13 barcodes as well as quick mnemonic codes for rapid testing
 */
export const FMCG_BARCODE_CATALOG: BarcodeCatalogItem[] = [
  {
    barcode: '8901719101038',
    name: 'Parle-G Biscuits',
    category: 'Biscuits',
    purchasePrice: 8,
    sellingPrice: 10,
    minimumStock: 20,
    aliases: ['PARLEG', '8901719101038', 'PARLE-G', 'PARLE']
  },
  {
    barcode: '8901058852448',
    name: 'Maggi',
    category: 'Noodles',
    purchasePrice: 12,
    sellingPrice: 14,
    minimumStock: 10,
    aliases: ['MAGGI', '8901058852448', 'MAGGIE', 'NOODLES']
  },
  {
    barcode: '8901262010047',
    name: 'Amul Milk',
    category: 'Dairy',
    purchasePrice: 54,
    sellingPrice: 60,
    minimumStock: 10,
    aliases: ['MILK', '8901262010047', 'AMUL', 'AMULMILK']
  },
  {
    barcode: '8904043901005',
    name: 'Tata Salt',
    category: 'Spices',
    purchasePrice: 20,
    sellingPrice: 25,
    minimumStock: 15,
    aliases: ['TATASALT', '8904043901005', 'SALT', 'TATA']
  },
  {
    barcode: '8901725181222',
    name: 'Aashirvaad Atta',
    category: 'Flour',
    purchasePrice: 55,
    sellingPrice: 65,
    minimumStock: 10,
    aliases: ['ATTA', '8901725181222', 'AASHIRVAAD', 'FLOUR']
  },
  {
    barcode: '5449000000996',
    name: 'Coca-Cola',
    category: 'Beverages',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 12,
    aliases: ['COCACOLA', '5449000000996', 'COKE']
  },
  {
    barcode: '8901063012117',
    name: 'Britannia Bread',
    category: 'Bakery',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 10,
    aliases: ['BREAD', '8901063012117', 'BRITANNIA']
  },
  {
    barcode: '8901030383709',
    name: 'Surf Excel',
    category: 'Detergent',
    purchasePrice: 55,
    sellingPrice: 65,
    minimumStock: 8,
    aliases: ['SURFEXCEL', '8901030383709', 'SURF']
  },
  {
    barcode: '8901314010520',
    name: 'Colgate',
    category: 'Personal Care',
    purchasePrice: 75,
    sellingPrice: 90,
    minimumStock: 10,
    aliases: ['COLGATE', '8901314010520', 'TOOTHPASTE']
  },
  {
    barcode: '8901764012204',
    name: 'Thums Up',
    category: 'Beverages',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 12,
    aliases: ['THUMSUP', '8901764012204', 'THUMSUP250']
  }
];

/**
 * Supermarket POS Beep Sound Generator using Web Audio API
 */
export function playBarcodeBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High-pitched clear 1760Hz POS scanner beep
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export interface BarcodeRecognitionResult {
  barcode: string;
  product: Product;
  isExistingInInventory: boolean;
  source: 'inventory_barcode' | 'inventory_id' | 'fmcg_catalog' | 'auto_created';
}

/**
 * Recognises a scanned barcode against user's inventory or standard Indian FMCG catalog
 */
export function identifyProductByBarcode(
  rawBarcode: string,
  inventoryProducts: Product[]
): BarcodeRecognitionResult {
  const code = rawBarcode.trim();
  const upperCode = code.toUpperCase();

  // 1. Direct match by barcode in current inventory
  const byBarcode = inventoryProducts.find(p => p.barcode && p.barcode.trim() === code);
  if (byBarcode) {
    return {
      barcode: code,
      product: byBarcode,
      isExistingInInventory: true,
      source: 'inventory_barcode'
    };
  }

  // 2. Direct match by ID in current inventory
  const byId = inventoryProducts.find(p => p.id === code);
  if (byId) {
    return {
      barcode: code,
      product: byId,
      isExistingInInventory: true,
      source: 'inventory_id'
    };
  }

  // 3. Search built-in FMCG catalog
  const catalogItem = FMCG_BARCODE_CATALOG.find(item => 
    item.barcode === code ||
    (item.aliases && item.aliases.some(a => a.toUpperCase() === upperCode))
  );

  if (catalogItem) {
    // Check if an item with matching name exists in user's inventory
    const existingByName = inventoryProducts.find(p => 
      p.name.toLowerCase() === catalogItem.name.toLowerCase() ||
      p.name.toLowerCase().includes(catalogItem.name.toLowerCase()) ||
      catalogItem.name.toLowerCase().includes(p.name.toLowerCase())
    );

    if (existingByName) {
      // Return existing inventory product with the barcode attached
      return {
        barcode: code,
        product: { ...existingByName, barcode: code },
        isExistingInInventory: true,
        source: 'inventory_barcode'
      };
    }

    // Auto-create product structure from catalog template
    const newProduct: Product = {
      id: 'prod_' + Date.now().toString() + Math.random().toString(36).slice(2, 6),
      name: catalogItem.name,
      category: catalogItem.category,
      stock: 0,
      purchasePrice: catalogItem.purchasePrice,
      sellingPrice: catalogItem.sellingPrice,
      minimumStock: catalogItem.minimumStock,
      barcode: code
    };

    return {
      barcode: code,
      product: newProduct,
      isExistingInInventory: false,
      source: 'fmcg_catalog'
    };
  }

  // 4. Unknown barcode: create custom product template
  const newProduct: Product = {
    id: 'prod_' + Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name: `Item #${code.slice(-6) || code}`,
    category: 'General',
    stock: 0,
    purchasePrice: 10,
    sellingPrice: 15,
    minimumStock: 5,
    barcode: code
  };

  return {
    barcode: code,
    product: newProduct,
    isExistingInInventory: false,
    source: 'auto_created'
  };
}

/**
 * Generates an EAN-13 style random barcode for items without barcodes
 */
export function generateEAN13Barcode(): string {
  // Indian prefix 890 + 9 random digits + check digit
  const prefix = '890';
  let body = '';
  for (let i = 0; i < 9; i++) {
    body += Math.floor(Math.random() * 10).toString();
  }
  const digits = (prefix + body).split('').map(Number);
  
  // Calculate EAN-13 checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return prefix + body + checksum.toString();
}
