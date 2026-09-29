import { Product } from '../types';
import { normalizeSlangSpeech, matchProductPhonetically } from './speechAccentService';

export interface VoiceStockChange {
  product: Product;
  quantity: number;
  previousStock: number;
  newStock: number;
  type: 'ADD' | 'REMOVE';
  isNew?: boolean;
}

export interface VoiceInventoryResult {
  success: boolean;
  changes: VoiceStockChange[];
  feedback: string;
  unmatched: string[];
}

// Multi-language number word mapper
const NUMBER_WORDS: Record<string, number> = {
  // English
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'dozen': 12, 'fifteen': 15,
  'twenty': 20, 'twenty five': 25, 'thirty': 30, 'forty': 40,
  'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80,
  'ninety': 90, 'hundred': 100,

  // Hindi
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'pandrah': 15, 'bees': 20, 'pachees': 25, 'tees': 30,
  'chalis': 40, 'pachaas': 50, 'saath': 60, 'sau': 100,

  // Telugu
  'okati': 1, 'oka': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4,
  'aidu': 5, 'aaru': 6, 'yedu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,
  'iravai': 20, 'muppai': 30, 'nalabhai': 40, 'yabhai': 50, 'aravai': 60, 'vanda': 100,

  // Kannada
  'ondu': 1, 'ondhu': 1, 'eradu': 2, 'mooru': 3, 'naalku': 4,
  'yelu': 7, 'entu': 8, 'ombattu': 9, 'hattu': 10,
  'ippattu': 20, 'moovattu': 30, 'nalavattu': 40, 'aivattu': 50, 'aravattu': 60, 'nooru': 100
};

// Common inventory and packaging filler words
const NOISE_WORDS = [
  'to the inventory', 'to inventory', 'in the inventory', 'in inventory', 'from the inventory', 'from inventory',
  'stock', 'stocks', 'packets', 'packet', 'pack', 'packs', 'pouch', 'pouches',
  'bottle', 'bottles', 'piece', 'pieces', 'pcs', 'pc',
  'litres', 'litre', 'liter', 'liters', 'ltr',
  'kilo', 'kilos', 'kg', 'kgs', 'gram', 'grams', 'gm',
  'box', 'boxes', 'can', 'cans', 'dabba', 'dappe', 'bags', 'bag',
  'items', 'item', 'unit', 'units',
  'of', 'in', 'please', 'kripya', 'doyacheyisi',
  'chahiye', 'kavali', 'beku', 'hai', 'undi', 'ide',
  'karo', 'cheyi', 'kodi', 'jodo', 'seri', 'chalao'
];

interface KiranaCatalogItem {
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  aliases: string[];
}

// Built-in Indian Kirana Catalog with extensive phonetic aliases
const KIRANA_CATALOG: Record<string, KiranaCatalogItem> = {
  biscuit: {
    name: 'Parle-G Biscuits',
    category: 'Biscuits',
    purchasePrice: 8,
    sellingPrice: 10,
    minimumStock: 20,
    aliases: [
      'biscuit', 'biscuits', 'buiscet', 'buiscets', 'biuscet', 'biuscets', 
      'biskit', 'biskits', 'biskoot', 'biskut', 'parle', 'parleg', 'parle-g', 
      'cookie', 'cookies', 'britannia biscuit', 'marie', 'oreo', 'monaco', '50-50'
    ]
  },
  milk: {
    name: 'Amul Milk',
    category: 'Dairy',
    purchasePrice: 54,
    sellingPrice: 60,
    minimumStock: 10,
    aliases: [
      'milk', 'milk packet', 'milk packets', 'paal', 'doodh', 'dudha', 
      'haalu', 'amul milk', 'amul', 'nandini', 'mother dairy', 'taaza', 'gold'
    ]
  },
  noodles: {
    name: 'Maggi',
    category: 'Noodles',
    purchasePrice: 12,
    sellingPrice: 14,
    minimumStock: 10,
    aliases: ['maggi', 'meggi', 'maggie', 'noodle', 'noodles', '2 minute', 'yippee', 'top ramen']
  },
  salt: {
    name: 'Tata Salt',
    category: 'Spices',
    purchasePrice: 20,
    sellingPrice: 25,
    minimumStock: 15,
    aliases: ['salt', 'tata salt', 'tata', 'namak', 'uppu', 'iodized salt']
  },
  atta: {
    name: 'Aashirvaad Atta',
    category: 'Flour',
    purchasePrice: 55,
    sellingPrice: 65,
    minimumStock: 10,
    aliases: ['atta', 'aata', 'flour', 'wheat', 'gehun', 'aashirvaad', 'godhuma', 'chakki atta']
  },
  bread: {
    name: 'Britannia Bread',
    category: 'Bakery',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 10,
    aliases: ['bread', 'britannia', 'loaf', 'bun', 'double roti', 'pav', 'brown bread', 'white bread']
  },
  coke: {
    name: 'Coca-Cola',
    category: 'Beverages',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 12,
    aliases: ['coke', 'coca-cola', 'coca cola', 'cocacola', 'cold drink', 'soft drink', 'pepsi', 'sprite', 'fanta']
  },
  thumsup: {
    name: 'Thums Up',
    category: 'Beverages',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 12,
    aliases: ['thums up', 'thumbs up', 'thumbsup', 'thumsup', 'thumbs', 'toofan']
  },
  detergent: {
    name: 'Surf Excel',
    category: 'Detergent',
    purchasePrice: 55,
    sellingPrice: 65,
    minimumStock: 8,
    aliases: ['surf', 'surf excel', 'detergent', 'washing powder', 'surfexcel', 'tide', 'ariel', 'rin', 'wheel']
  },
  colgate: {
    name: 'Colgate',
    category: 'Personal Care',
    purchasePrice: 75,
    sellingPrice: 90,
    minimumStock: 10,
    aliases: ['colgate', 'toothpaste', 'paste', 'tooth paste', 'dant manjan', 'pepsodent', 'closeup', 'sensodyne']
  },
  oil: {
    name: 'Cooking Oil',
    category: 'Oils & Ghee',
    purchasePrice: 110,
    sellingPrice: 130,
    minimumStock: 10,
    aliases: ['oil', 'tel', 'enne', 'taila', 'sunflower oil', 'mustard oil', 'fortune', 'refined oil', 'ghee']
  },
  rice: {
    name: 'Basmati Rice',
    category: 'Grains',
    purchasePrice: 60,
    sellingPrice: 75,
    minimumStock: 15,
    aliases: ['rice', 'chawal', 'biyyam', 'akki', 'basmati', 'sona masoori']
  },
  sugar: {
    name: 'Sugar',
    category: 'Groceries',
    purchasePrice: 40,
    sellingPrice: 46,
    minimumStock: 20,
    aliases: ['sugar', 'chini', 'cheeni', 'sakkare', 'panchadara']
  },
  tea: {
    name: 'Tea (Chai)',
    category: 'Beverages',
    purchasePrice: 70,
    sellingPrice: 85,
    minimumStock: 10,
    aliases: ['tea', 'chai', 'cha', 'tea powder', 'taj mahal', 'red label', 'wagh bakri', 'tata tea']
  },
  soap: {
    name: 'Bath Soap',
    category: 'Personal Care',
    purchasePrice: 28,
    sellingPrice: 35,
    minimumStock: 15,
    aliases: ['soap', 'sabun', 'lifebuoy', 'dettol', 'lux', 'dove', 'santoor']
  }
};

/**
 * Normalizes speech text: converts word numbers to digits
 */
function normalizeSpokenText(raw: string): string {
  const slangNormalized = normalizeSlangSpeech(raw);
  let text = ' ' + slangNormalized.toLowerCase().trim() + ' ';

  // Convert common speech recognition homophones for numbers
  text = text.replace(/\b(?:to|too)\b(?=\s+[a-z])/gi, ' 2 ');
  text = text.replace(/\b(?:for|fore)\b(?=\s+[a-z])/gi, ' 4 ');
  text = text.replace(/\b(?:ate)\b(?=\s+[a-z])/gi, ' 8 ');
  text = text.replace(/\b(?:tree|free)\b(?=\s+[a-z])/gi, ' 3 ');
  text = text.replace(/\b(?:won|wan)\b(?=\s+[a-z])/gi, ' 1 ');

  Object.entries(NUMBER_WORDS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([word, num]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      text = text.replace(regex, ` ${num} `);
    });

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Cleans packaging and filler words from an item phrase
 */
function cleanItemPhrase(phrase: string): string {
  let cleaned = phrase.toLowerCase();
  NOISE_WORDS.forEach(noise => {
    const regex = new RegExp(`\\b${noise}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  });
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Matches an item query to an existing product in inventory OR auto-creates a product template
 */
function matchOrMakeProduct(queryText: string, products: Product[]): { product: Product; isNew: boolean } {
  const cleanQ = queryText.toLowerCase().trim();

  // 1. Direct match on product name or category in current inventory
  const directMatch = products.find(p => 
    p.name.toLowerCase() === cleanQ ||
    p.name.toLowerCase().includes(cleanQ) ||
    cleanQ.includes(p.name.toLowerCase())
  );
  if (directMatch) return { product: directMatch, isNew: false };

  // 2. Check Kirana catalog templates and aliases
  for (const [key, template] of Object.entries(KIRANA_CATALOG)) {
    const isCatalogMatch = (
      cleanQ === key ||
      cleanQ.includes(key) ||
      cleanQ.startsWith(key.slice(0, 4)) ||
      template.aliases.some(alias => cleanQ === alias || cleanQ.includes(alias) || alias.includes(cleanQ))
    );

    if (isCatalogMatch) {
      // Check if user already has an item matching this catalog template
      const existingInInventory = products.find(p => {
        const pName = p.name.toLowerCase();
        const tName = template.name.toLowerCase();
        return (
          pName.includes(key) ||
          pName.includes(tName) ||
          tName.includes(pName) ||
          template.aliases.some(a => pName.includes(a))
        );
      });

      if (existingInInventory) {
        return { product: existingInInventory, isNew: false };
      }

      // If product not yet in user inventory, auto-create it from Kirana template!
      const newFromCatalog: Product = {
        id: 'prod_' + Date.now().toString() + Math.random().toString(36).slice(2, 6),
        name: template.name,
        category: template.category,
        stock: 0,
        purchasePrice: template.purchasePrice,
        sellingPrice: template.sellingPrice,
        minimumStock: template.minimumStock
      };
      return { product: newFromCatalog, isNew: true };
    }
  }

  // 3. Token-based word match in existing inventory
  const tokens = cleanQ.split(/\s+/).filter(w => w.length >= 3 && !NOISE_WORDS.includes(w));
  for (const token of tokens) {
    const tokenMatch = products.find(p => 
      p.name.toLowerCase().includes(token) || 
      p.category.toLowerCase().includes(token)
    );
    if (tokenMatch) return { product: tokenMatch, isNew: false };
  }

  // 4. Phonetic Soundex and fuzzy similarity match (handles regional Indian accents & slang)
  const phoneticMatch = matchProductPhonetically(cleanQ, products);
  if (phoneticMatch) {
    return { product: phoneticMatch.product, isNew: false };
  }

  // 5. Auto-create as new custom product so voice restock never fails
  const formattedName = cleanQ
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const customProduct: Product = {
    id: 'prod_' + Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name: formattedName || 'New Product',
    category: 'General Store',
    stock: 0,
    purchasePrice: 20,
    sellingPrice: 25,
    minimumStock: 10
  };

  return { product: customProduct, isNew: true };
}

/**
 * Parses spoken inventory commands like:
 * - "add 60 biuscet packets and 6 milk packets to the inventory"
 * - "add 20 Maggi and 10 Tata Salt"
 * - "remove 5 biscuits and 2 milk"
 */
export function parseVoiceInventoryCommand(
  rawSpeech: string,
  products: Product[]
): VoiceInventoryResult {
  const normalized = normalizeSpokenText(rawSpeech);

  // Determine if adding or removing
  const isRemove = (
    normalized.includes('remove') || 
    normalized.includes('reduce') || 
    normalized.includes('delete') || 
    normalized.includes('hatao') || 
    normalized.includes('teesey') || 
    normalized.includes('minus') || 
    normalized.includes('subtract')
  );
  const actionType: 'ADD' | 'REMOVE' = isRemove ? 'REMOVE' : 'ADD';

  // Strip inventory context phrases
  let workingText = normalized;
  [
    'to the inventory', 'to inventory', 'in the inventory', 'in inventory', 
    'from the inventory', 'from inventory', 'into the inventory', 'into inventory'
  ].forEach(phrase => {
    workingText = workingText.replace(new RegExp(phrase, 'gi'), ' ');
  });

  // Strip action prefixes: 'add', 'remove', 'reduce'
  workingText = workingText.replace(/\b(add|remove|reduce|plus|minus)\b/gi, ' ');

  // Split on conjunctions: 'and', 'aur', 'mariyu', 'mattu', commas, plus
  const rawSegments = workingText
    .split(/(?:\band\b|\baur\b|\bmariyu\b|\bmattu\b|,|\+|\&)/gi)
    .map(s => s.trim())
    .filter(Boolean);

  const changes: VoiceStockChange[] = [];
  const unmatched: string[] = [];

  const processChunk = (chunk: string) => {
    if (!chunk.trim()) return;

    // Look for quantity
    const qtyMatch = chunk.match(/\b(\d+)\b/);
    let qty = 1;
    let itemPhrase = chunk;

    if (qtyMatch) {
      qty = parseInt(qtyMatch[1], 10);
      if (isNaN(qty) || qty <= 0) qty = 1;
      itemPhrase = chunk.replace(qtyMatch[0], ' ');
    }

    const cleanedQuery = cleanItemPhrase(itemPhrase);
    if (!cleanedQuery) return;

    const { product, isNew } = matchOrMakeProduct(cleanedQuery, products);

    const existingChange = changes.find(c => c.product.name.toLowerCase() === product.name.toLowerCase());
    if (existingChange) {
      existingChange.quantity += qty;
      existingChange.newStock = actionType === 'ADD' 
        ? existingChange.previousStock + existingChange.quantity 
        : Math.max(0, existingChange.previousStock - existingChange.quantity);
    } else {
      const previousStock = isNew ? 0 : product.stock;
      const newStock = actionType === 'ADD' 
        ? previousStock + qty 
        : Math.max(0, previousStock - qty);

      changes.push({
        product,
        quantity: qty,
        previousStock,
        newStock,
        type: actionType,
        isNew
      });
    }
  };

  if (rawSegments.length > 1) {
    rawSegments.forEach(seg => processChunk(seg));
  } else {
    // If not separated by "and", check for multiple numbers: e.g. "60 biscuits 6 milk"
    const multiItemPattern = /(\d+\s+[a-zA-Z\s-]+?)(?=\b\d+\s+[a-zA-Z]|$)/g;
    const matches = workingText.match(multiItemPattern);

    if (matches && matches.length > 1) {
      matches.forEach(m => processChunk(m));
    } else {
      processChunk(workingText);
    }
  }

  if (changes.length === 0) {
    return {
      success: false,
      changes: [],
      feedback: `Could not identify product names from "${rawSpeech}". Try saying e.g. "Add 60 biscuit packets and 6 milk packets to the inventory".`,
      unmatched
    };
  }

  const summary = changes.map(c => 
    `${c.quantity}x ${c.product.name} (${c.previousStock} → ${c.newStock})`
  ).join(', ');

  const verb = actionType === 'ADD' ? 'Added' : 'Removed';
  const feedback = `Successfully ${verb.toLowerCase()} ${summary} in inventory!`;

  return {
    success: true,
    changes,
    feedback,
    unmatched
  };
}
