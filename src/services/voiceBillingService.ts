import { Product } from '../types';

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
  // English
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'dozen': 12, 'twenty': 20,
  'half': 1, 'single': 1, 'double': 2, 'couple': 2,

  // Hindi
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,

  // Telugu
  'okati': 1, 'oka': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4,
  'aidu': 5, 'aaru': 6, 'yedu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,

  // Kannada
  'ondu': 1, 'ondhu': 1, 'eradu': 2, 'mooru': 3, 'naalku': 4,
  'entu': 8, 'ombattu': 9, 'hattu': 10
};

// Common shop packaging / filler terms to strip from product queries
const NOISE_WORDS = [
  'packets', 'packet', 'pack', 'packs', 'pouch', 'pouches',
  'bottle', 'bottles', 'piece', 'pieces', 'pcs', 'pc',
  'litres', 'litre', 'liter', 'liters', 'ltr',
  'kilo', 'kilos', 'kg', 'kgs', 'gram', 'grams', 'gm',
  'box', 'boxes', 'can', 'cans', 'dabba', 'dappe',
  'items', 'item', 'unit', 'units',
  'of', 'for', 'to', 'in', 'please', 'kripya', 'doyacheyisi',
  'chahiye', 'kavali', 'beku', 'hai', 'undi', 'ide',
  'add', 'jodo', 'seri', 'chalao'
];

// Product name aliases/synonyms for Kirana items
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  'biscuit': ['biscuits', 'biscuit', 'buiscet', 'buiscets', 'biuscet', 'biuscets', 'biskit', 'biskits', 'biskoot', 'biskut', 'parle', 'parleg', 'parle-g'],
  'milk': ['paal', 'doodh', 'haalu', 'amul milk', 'amul', 'dudha', 'milk packets', 'milk packet'],
  'noodles': ['noodle', 'noodles', 'maggi', 'meggi', '2 minute', 'yippee'],
  'salt': ['namak', 'uppu', 'tata', 'tata salt'],
  'atta': ['flour', 'aashirvaad', 'gehun', 'godhuma', 'aata'],
  'bread': ['loaf', 'britannia', 'bun', 'double roti'],
  'coke': ['coca-cola', 'coca cola', 'cocacola', 'cold drink', 'soft drink'],
  'thums up': ['thumbs up', 'thumbsup', 'thumsup', 'thumbs'],
  'detergent': ['surf', 'surf excel', 'detergent powder', 'washing powder', 'surfexcel'],
  'colgate': ['toothpaste', 'paste', 'tooth paste', 'dant manjan']
};

/**
 * Normalizes speech text: converts word numbers to digits and cleans filler words
 */
function normalizeSpokenText(raw: string): string {
  let text = raw.toLowerCase().trim();

  // Replace spoken number words with digits (e.g. "two" -> "2")
  Object.entries(NUMBER_WORDS).forEach(([word, num]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    text = text.replace(regex, num.toString());
  });

  return text;
}

/**
 * Searches for best matching product from user's actual inventory
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

  return null;
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
      feedback: 'Cart has been cleared.',
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
      const existing = recognizedItems.find(i => i.product.id === matchedProduct.id);
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
