import { Product } from '../types';

export interface VoiceStockChange {
  product: Product;
  quantity: number;
  previousStock: number;
  newStock: number;
  type: 'ADD' | 'REMOVE';
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
  'of', 'for', 'to', 'in', 'please', 'kripya', 'doyacheyisi',
  'chahiye', 'kavali', 'beku', 'hai', 'undi', 'ide',
  'karo', 'cheyi', 'kodi', 'jodo', 'seri', 'chalao'
];

// Product name aliases/synonyms for Kirana items
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  'biscuit': ['biscuits', 'buiscet', 'buiscets', 'biskit', 'biskoot', 'parle', 'parleg', 'parle-g'],
  'milk': ['paal', 'doodh', 'haalu', 'amul milk', 'amul'],
  'noodles': ['noodle', 'maggi', 'meggi', '2 minute'],
  'salt': ['namak', 'uppu', 'tata', 'tata salt'],
  'atta': ['flour', 'aashirvaad', 'gehun', 'godhuma', 'aata'],
  'bread': ['loaf', 'britannia', 'bun', 'double roti'],
  'coke': ['coca-cola', 'coca cola', 'cocacola', 'cold drink', 'soft drink'],
  'thums up': ['thumbs up', 'thumbsup', 'thumsup', 'thumbs'],
  'detergent': ['surf', 'surf excel', 'detergent powder', 'washing powder', 'surfexcel'],
  'colgate': ['toothpaste', 'paste', 'tooth paste', 'dant manjan']
};

/**
 * Normalizes speech text: converts word numbers to digits
 */
function normalizeSpokenText(raw: string): string {
  let text = raw.toLowerCase().trim();

  // Replace multi-word numbers first (e.g. "twenty five")
  Object.entries(NUMBER_WORDS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([word, num]) => {
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

  // Strip initial action indicators and trailing context
  let workingText = normalized;
  NOISE_WORDS.forEach(noise => {
    const regex = new RegExp(`\\b${noise}\\b`, 'gi');
    workingText = workingText.replace(regex, ' ');
  });

  // Strip explicit action words: 'add', 'remove', 'reduce'
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

    const matchedProduct = matchProduct(cleanedQuery, products);
    if (matchedProduct) {
      const existing = changes.find(c => c.product.id === matchedProduct.id);
      if (existing) {
        existing.quantity += qty;
        existing.newStock = actionType === 'ADD' 
          ? existing.previousStock + existing.quantity 
          : Math.max(0, existing.previousStock - existing.quantity);
      } else {
        const previousStock = matchedProduct.stock;
        const newStock = actionType === 'ADD' 
          ? previousStock + qty 
          : Math.max(0, previousStock - qty);
        changes.push({
          product: matchedProduct,
          quantity: qty,
          previousStock,
          newStock,
          type: actionType
        });
      }
    } else {
      unmatched.push(cleanedQuery);
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
      feedback: `Could not identify products from "${rawSpeech}". Try saying e.g. "Add 60 biscuits and 6 milk packets".`,
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
