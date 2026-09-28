import { Product } from '../types';
import { FMCG_BARCODE_CATALOG } from './barcodeService';

export interface VoiceBillingItem {
  product: Product;
  quantity: number;
}

export interface VoiceBillingResult {
  action: 'ADD_ITEMS' | 'COMPLETE_BILL' | 'CLEAR_CART' | 'NOT_UNDERSTOOD';
  items: VoiceBillingItem[];
  shouldCompleteBill: boolean;
  feedback: string;
  unmatchedTerms: string[];
}

// Multi-language number word mapper
const NUMBER_WORDS: Record<string, number> = {
  // English words & homophones
  'one': 1, 'single': 1, 'won': 1,
  'two': 2, 'double': 2, 'couple': 2,
  'three': 3, 'tree': 3, 'tri': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8, 'ate': 8,
  'nine': 9,
  'ten': 10,
  'eleven': 11, 'twelve': 12, 'dozen': 12, 'half dozen': 6,
  'fifteen': 15, 'twenty': 20, 'twenty five': 25,
  'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80,
  'ninety': 90, 'hundred': 100,

  // Hindi
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'gyarah': 11, 'barah': 12, 'pandrah': 15, 'bees': 20,
  'pachees': 25, 'tees': 30, 'chalis': 40, 'pachaas': 50,
  'saath': 60, 'sattar': 70, 'assi': 80, 'nabbe': 90, 'sau': 100,

  // Telugu
  'okati': 1, 'oka': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4,
  'aidu': 5, 'aaru': 6, 'yedu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,
  'padakondu': 11, 'pennendu': 12, 'padiheynu': 15, 'iravai': 20,
  'iravai aidu': 25, 'muppai': 30, 'nalabhai': 40, 'yabhai': 50,
  'aravai': 60, 'debbhai': 70, 'yenabhai': 80, 'tombhai': 90, 'vanda': 100,

  // Kannada
  'ondu': 1, 'ondhu': 1, 'eradu': 2, 'mooru': 3, 'naalku': 4,
  'yelu': 7, 'entu': 8, 'ombattu': 9, 'hattu': 10,
  'hannondu': 11, 'hanneradu': 12, 'hadinaidu': 15, 'ippattu': 20,
  'ippattaidu': 25, 'moovattu': 30, 'nalavattu': 40, 'aivattu': 50,
  'aravattu': 60, 'eppattu': 70, 'enbattu': 80, 'tombattu': 90, 'nooru': 100
};

// Packaging and filler terms to strip from product queries
// Note: We deliberately do NOT include 'to' or 'for' here because they can be number homophones (two/four)
const NOISE_WORDS = [
  'packets', 'packet', 'pack', 'packs', 'pouch', 'pouches', 'pkts', 'pkt', 'peket', 'peketu',
  'bottle', 'bottles', 'piece', 'pieces', 'pcs', 'pc', 'peice', 'peices',
  'litres', 'litre', 'liter', 'liters', 'ltr', 'l',
  'kilo', 'kilos', 'kg', 'kgs', 'gram', 'grams', 'gm', 'gms',
  'box', 'boxes', 'can', 'cans', 'dabba', 'dappe', 'bags', 'bag',
  'items', 'item', 'unit', 'units',
  'of', 'in', 'please', 'kripya', 'doyacheyisi',
  'chahiye', 'kavali', 'beku', 'hai', 'undi', 'ide',
  'add', 'jodo', 'seri', 'chalao', 'put', 'daalo', 'veyyi', 'haaku'
];

// Product name aliases/synonyms for Kirana items
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  'biscuit': [
    'biscuits', 'biscuit', 'buiscet', 'buiscets', 'biuscet', 'biuscets', 
    'biskit', 'biskits', 'biskoot', 'biskut', 'parle', 'parleg', 'parle-g', 
    'cookies', 'cookie', 'biscutes', 'biscut', 'bisket', 'biskets', 'marie', 
    'oreo', 'monaco', 'good day', 'bourbon'
  ],
  'milk': [
    'milk', 'milks', 'paal', 'doodh', 'dudh', 'haalu', 'amul milk', 'amul', 
    'dudha', 'milk packets', 'milk packet', 'nandini', 'mother dairy', 'taaza', 'gold'
  ],
  'noodles': [
    'noodle', 'noodles', 'maggi', 'meggi', 'maggie', 'meggie', '2 minute', 
    'yippee', 'top ramen', 'wai wai', 'nudles', 'nudle'
  ],
  'salt': [
    'salt', 'namak', 'uppu', 'tata', 'tata salt', 'solt', 'sendha namak'
  ],
  'atta': [
    'atta', 'aata', 'flour', 'wheat', 'gehun', 'godhuma', 'aashirvaad', 
    'ashirvad', 'ashirwaad', 'chakki atta'
  ],
  'bread': [
    'bread', 'loaf', 'britannia', 'bun', 'double roti', 'bred', 'pao', 'pav'
  ],
  'coke': [
    'coca-cola', 'coca cola', 'cocacola', 'coke', 'cold drink', 'soft drink', 
    'pepsi', 'sprite', 'fanta', 'frooti'
  ],
  'thums up': [
    'thums up', 'thumbs up', 'thumbsup', 'thumsup', 'thumbs', 'toofan'
  ],
  'detergent': [
    'surf', 'surf excel', 'detergent powder', 'washing powder', 'surfexcel', 
    'rin', 'tide', 'ariel', 'wheel', 'ghadi'
  ],
  'colgate': [
    'colgate', 'toothpaste', 'paste', 'tooth paste', 'dant manjan', 
    'pepsodent', 'closeup', 'sensodyne'
  ],
  'soap': [
    'soap', 'soaps', 'sabun', 'lifebuoy', 'dettol', 'lux', 'dove', 'santoor'
  ],
  'tea': [
    'tea', 'chai', 'cha', 'tea powder', 'taj mahal', 'red label', 'tata tea', 'wagh bakri'
  ],
  'sugar': [
    'sugar', 'chini', 'cheeni', 'sakkare', 'panchadara'
  ],
  'rice': [
    'rice', 'chawal', 'biyyam', 'akki', 'basmati', 'sona masoori'
  ],
  'oil': [
    'oil', 'tel', 'enne', 'taila', 'cooking oil', 'sunflower oil', 'fortune'
  ]
};

/**
 * Normalizes speech text:
 * Converts homophones ("to" -> 2, "for" -> 4) and number words to digits
 */
function normalizeSpokenText(raw: string): string {
  let text = ' ' + raw.toLowerCase().trim() + ' ';

  // 1. Convert common speech recognition homophones for numbers when preceding a noun
  // e.g. "to biscuits" -> "2 biscuits", "too milk" -> "2 milk"
  text = text.replace(/\b(?:to|too)\b(?=\s+[a-z])/gi, ' 2 ');
  // e.g. "for milk packets" -> "4 milk packets", "fore biscuits" -> "4 biscuits"
  text = text.replace(/\b(?:for|fore)\b(?=\s+[a-z])/gi, ' 4 ');
  // e.g. "ate biscuits" -> "8 biscuits"
  text = text.replace(/\b(?:ate)\b(?=\s+[a-z])/gi, ' 8 ');
  // e.g. "tree/free biscuits" -> "3 biscuits"
  text = text.replace(/\b(?:tree|free)\b(?=\s+[a-z])/gi, ' 3 ');
  // e.g. "won biscuit" -> "1 biscuit"
  text = text.replace(/\b(?:won|wan)\b(?=\s+[a-z])/gi, ' 1 ');

  // 2. Replace spoken number words with digits (longest words first)
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
 * Searches for best matching product from user's actual inventory
 * with fallback to built-in FMCG catalog
 */
function matchProduct(queryText: string, products: Product[]): Product | null {
  const cleanQ = queryText.toLowerCase().trim();
  if (!cleanQ) return null;

  // 1. Direct match on product name or category
  const directMatch = products.find(p => 
    p.name.toLowerCase() === cleanQ ||
    p.name.toLowerCase().includes(cleanQ) ||
    cleanQ.includes(p.name.toLowerCase())
  );
  if (directMatch) return directMatch;

  // 2. Check synonyms (e.g. "buiscets" -> "biscuit" -> "Parle-G Biscuits")
  for (const [key, aliases] of Object.entries(PRODUCT_SYNONYMS)) {
    if (cleanQ.includes(key) || aliases.some(alias => cleanQ.includes(alias) || alias.includes(cleanQ))) {
      // Find a product in inventory that matches this key or any alias
      const synMatch = products.find(p => {
        const pName = p.name.toLowerCase();
        const pCat = p.category.toLowerCase();
        return pName.includes(key) || pCat.includes(key) || aliases.some(a => pName.includes(a) || pCat.includes(a));
      });
      if (synMatch) return synMatch;
    }
  }

  // 3. Token-based word match (length >= 3)
  const qTokens = cleanQ.split(/\s+/).filter(w => w.length >= 3 && !NOISE_WORDS.includes(w));
  for (const token of qTokens) {
    const tokenMatch = products.find(p => 
      p.name.toLowerCase().includes(token) || 
      p.category.toLowerCase().includes(token)
    );
    if (tokenMatch) return tokenMatch;
  }

  // 4. Fallback: Check built-in Indian FMCG Catalog (Parle-G, Maggi, Amul Milk, Tata Salt, etc.)
  for (const catalogItem of FMCG_BARCODE_CATALOG) {
    const catName = catalogItem.name.toLowerCase();
    const catCat = catalogItem.category.toLowerCase();
    const catAliases = catalogItem.aliases?.map(a => a.toLowerCase()) || [];

    if (
      cleanQ.includes(catName) || 
      catName.includes(cleanQ) || 
      catAliases.some(a => cleanQ.includes(a) || a.includes(cleanQ))
    ) {
      // Return a generated product structure from catalog
      return {
        id: 'fmcg_' + catalogItem.barcode,
        name: catalogItem.name,
        category: catalogItem.category,
        stock: 50,
        purchasePrice: catalogItem.purchasePrice,
        sellingPrice: catalogItem.sellingPrice,
        minimumStock: catalogItem.minimumStock,
        barcode: catalogItem.barcode
      };
    }
  }

  return null;
}

/**
 * Parses spoken billing commands like:
 * - "2 buiscets and 3 milk packets"
 * - "2 Parle-G and 3 Amul Milk"
 * - "give bill" / "print receipt"
 * - "1 Maggi, 2 Coca Cola and give bill"
 */
export function parseVoiceBillingCommand(
  rawSpeech: string,
  products: Product[]
): VoiceBillingResult {
  const normalized = normalizeSpokenText(rawSpeech);

  // Check for clear cart
  if (
    normalized.includes('clear cart') || 
    normalized.includes('clear bill') || 
    normalized.includes('empty cart') ||
    normalized.includes('reset bill')
  ) {
    return {
      action: 'CLEAR_CART',
      items: [],
      shouldCompleteBill: false,
      feedback: 'Bill cleared.',
      unmatchedTerms: []
    };
  }

  // Check for bill completion keywords
  const billKeywords = [
    'give bill', 'give me the bill', 'give the bill', 'print bill', 'complete bill',
    'make bill', 'create bill', 'generate bill', 'finish bill', 'checkout', 'done billing',
    'bill do', 'bill banao', 'bill dedo', 'bill ivvu', 'bill kodi', 'bill cheyi',
    'bill ready', 'print receipt', 'give receipt'
  ];

  let shouldCompleteBill = billKeywords.some(keyword => normalized.includes(keyword));

  // If the command is ONLY to give bill
  const isOnlyBillCommand = billKeywords.some(k => normalized.trim() === k || normalized.trim() === 'bill' || normalized.trim() === 'done');
  if (isOnlyBillCommand) {
    return {
      action: 'COMPLETE_BILL',
      items: [],
      shouldCompleteBill: true,
      feedback: 'Generating your bill now...',
      unmatchedTerms: []
    };
  }

  // Remove the bill completion phrase from the item parsing string
  let itemsStringToParse = normalized;
  billKeywords.forEach(k => {
    itemsStringToParse = itemsStringToParse.replace(new RegExp(`\\b${k}\\b`, 'gi'), ' ');
  });

  // Split on conjunctions: 'and', 'aur', 'mariyu', 'mattu', commas, plus
  const rawSegments = itemsStringToParse
    .split(/(?:\band\b|\baur\b|\bmariyu\b|\bmattu\b|,|\+|\&)/gi)
    .map(s => s.trim())
    .filter(Boolean);

  const recognizedItems: VoiceBillingItem[] = [];
  const unmatched: string[] = [];

  // Helper to process an individual chunk like "2 biscuits" or "3 milk packets"
  const processChunk = (chunk: string) => {
    if (!chunk.trim()) return;

    // Try to extract quantity: look for digits
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

    const matchedProduct = matchProduct(cleanedQuery, products);
    if (matchedProduct) {
      // Check if we already recognized this product in the same command
      const existing = recognizedItems.find(i => i.product.id === matchedProduct.id || i.product.name.toLowerCase() === matchedProduct.name.toLowerCase());
      if (existing) {
        existing.quantity += qty;
      } else {
        recognizedItems.push({ product: matchedProduct, quantity: qty });
      }
    } else {
      unmatched.push(cleanedQuery);
    }
  };

  // If multiple segments were separated by conjunctions:
  if (rawSegments.length > 1) {
    rawSegments.forEach(seg => processChunk(seg));
  } else {
    // If not separated by "and", check if string contains multiple numbers: e.g. "2 biscuits 3 milk"
    const multiItemPattern = /(\d+\s+[a-zA-Z\s-]+?)(?=\b\d+\s+[a-zA-Z]|$)/g;
    const matches = itemsStringToParse.match(multiItemPattern);

    if (matches && matches.length > 1) {
      matches.forEach(m => processChunk(m));
    } else {
      processChunk(itemsStringToParse);
    }
  }

  if (recognizedItems.length === 0) {
    if (shouldCompleteBill) {
      return {
        action: 'COMPLETE_BILL',
        items: [],
        shouldCompleteBill: true,
        feedback: 'Generating bill for current cart items...',
        unmatchedTerms: unmatched
      };
    }
    return {
      action: 'NOT_UNDERSTOOD',
      items: [],
      shouldCompleteBill: false,
      feedback: `Could not identify product from "${rawSpeech}". Try saying e.g. "2 biscuits and 3 milk packets".`,
      unmatchedTerms: unmatched
    };
  }

  // Format confirmation feedback
  const itemsSummary = recognizedItems.map(i => `${i.quantity}x ${i.product.name}`).join(', ');
  let feedback = `Added ${itemsSummary} to bill.`;
  if (shouldCompleteBill) {
    feedback += ` Generating bill now!`;
  }

  return {
    action: 'ADD_ITEMS',
    items: recognizedItems,
    shouldCompleteBill,
    feedback,
    unmatchedTerms: unmatched
  };
}
