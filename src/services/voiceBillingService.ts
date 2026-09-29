import { Product } from '../types';

export interface VoiceBillingItem {
  product: Product;
  quantity: number;
}

export interface VoiceBillingResult {
  action: 'ADD_ITEMS' | 'COMPLETE_BILL' | 'CLEAR_CART' | 'NOT_UNDERSTOOD' | 'NO_ITEMS_FOUND' | 'OUT_OF_STOCK';
  items: VoiceBillingItem[];
  shouldCompleteBill: boolean;
  feedback: string;
  unmatchedTerms: string[];
  outOfStockTerms?: string[];
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
const NOISE_WORDS = [
  'packets', 'packet', 'pack', 'packs', 'pouch', 'pouches', 'pkts', 'pkt', 'peket', 'peketu',
  'bottle', 'bottles', 'piece', 'pieces', 'pcs', 'pc', 'peice', 'peices',
  'litres', 'litre', 'liter', 'liters', 'ltr', 'l',
  'kilo', 'kilos', 'kg', 'kgs', 'gram', 'grams', 'gm', 'gms',
  'box', 'boxes', 'can', 'cans', 'dabba', 'dappe', 'bags', 'bag',
  'items', 'item', 'unit', 'units',
  'of', 'in', 'please', 'kripya', 'doyacheyisi', 'dayavittu',
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
 * Strips billing destination / prepositional phrases like:
 * - "to the bill", "to bill", "in bill", "to cart", "bill me add karo"
 * so that they do not get confused with numbers or product queries.
 */
function stripBillingPhrases(text: string): string {
  let cleaned = ' ' + text.toLowerCase().trim() + ' ';

  const billingDirectives = [
    /(\b(?:add|put)\s+)?\b(?:to|into|in|on)\s+(?:the\s+|my\s+)?(?:bill|cart|receipt)\b/gi,
    /\b(?:for\s+the\s+|for\s+)(?:bill|cart)\b/gi,
    /\b(?:in|to)\s+(?:the\s+|my\s+)?(?:bill|cart)\b/gi,
    /\b(?:the\s+)?(?:bill|cart)\s+(?:me\s+add\s+karo|me\s+daalo|lo\s+veyyi|alli\s+haaku)\b/gi,
    /\b(?:the\s+)?(?:bill|cart)\s+(?:me|mein|lo|alli|ke\s+andar)\b/gi,
    /\b(?:in|to)\s+bill\b/gi,
    /\b(?:in|to)\s+cart\b/gi,
    /\b(?:into|onto)\s+bill\b/gi,
  ];

  billingDirectives.forEach(regex => {
    cleaned = cleaned.replace(regex, ' ');
  });

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes speech text:
 * Converts homophones ("to" -> 2, "for" -> 4) and number words to digits.
 * Protects prepositions from being converted to numbers.
 */
function normalizeSpokenText(raw: string): string {
  // 1. Strip billing phrases first
  const preStripped = stripBillingPhrases(raw);
  let text = ' ' + preStripped.toLowerCase().trim() + ' ';

  // 2. Convert common speech recognition homophones for numbers ONLY when preceding a noun (not articles/prepositions)
  // e.g. "to biscuits" -> "2 biscuits", but NOT "to the"
  text = text.replace(/\b(?:to|too)\b(?=\s+(?!the\b|my\b|our\b|a\b|an\b|this\b|that\b|cart\b|bill\b|inventory\b)[a-z])/gi, ' 2 ');
  text = text.replace(/\b(?:for|fore)\b(?=\s+(?!the\b|my\b|our\b|a\b|an\b|this\b|that\b|cart\b|bill\b|inventory\b)[a-z])/gi, ' 4 ');
  text = text.replace(/\b(?:ate)\b(?=\s+[a-z])/gi, ' 8 ');
  text = text.replace(/\b(?:tree|free)\b(?=\s+[a-z])/gi, ' 3 ');
  text = text.replace(/\b(?:won|wan)\b(?=\s+[a-z])/gi, ' 1 ');

  // 3. Replace spoken number words with digits (longest words first)
  Object.entries(NUMBER_WORDS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([word, num]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      text = text.replace(regex, ` ${num} `);
    });

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the user-facing product name requested by the user,
 * keeping words like "oil packet" or "sunflower oil" while stripping command verbs.
 */
function extractRequestedItemName(rawChunk: string): string {
  let name = rawChunk.toLowerCase();
  // Strip numbers
  name = name.replace(/\b\d+\b/g, ' ');
  // Strip action and destination filler words
  const stripWords = [
    'add', 'jodo', 'seri', 'chalao', 'put', 'daalo', 'veyyi', 'haaku',
    'please', 'kripya', 'doyacheyisi', 'dayavittu',
    'i want', 'give me', 'give', 'chahiye', 'kavali', 'beku', 'hai', 'undi', 'ide',
    'to the bill', 'to bill', 'in the bill', 'in bill', 'into bill', 'to the cart', 'to cart', 'in cart',
    'bill me', 'bill mein', 'bill lo', 'bill alli', 'bill', 'cart',
    'the', 'a', 'an'
  ];
  stripWords.forEach(w => {
    name = name.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
  });
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Cleans packaging and filler words from an item phrase for database inventory matching
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
 * Strictly searches for matching product from user's ACTUAL inventory (products).
 * NEVER falls back to external/dummy catalogs for billing.
 */
function matchProductInInventory(queryText: string, products: Product[]): Product | null {
  const cleanQ = queryText.toLowerCase().trim();
  if (!cleanQ || products.length === 0) return null;

  // 1. Direct match on product name or category
  const directMatch = products.find(p => 
    p.name.toLowerCase() === cleanQ ||
    p.name.toLowerCase().includes(cleanQ) ||
    cleanQ.includes(p.name.toLowerCase())
  );
  if (directMatch) return directMatch;

  // 2. Check synonyms against actual inventory products
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
 * Parses spoken billing commands like:
 * - "add 1 oil packet to the bill"
 * - "2 biscuits and 3 milk packets"
 * - "give bill" / "print receipt"
 * 
 * Accurately detects items that do NOT exist in the store inventory
 * and generates appropriate voice feedback.
 */
export function parseVoiceBillingCommand(
  rawSpeech: string,
  products: Product[],
  language: string = 'en'
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

  const shouldCompleteBill = billKeywords.some(keyword => normalized.includes(keyword));

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
  const missingItems: string[] = [];
  const outOfStockItems: { product: Product; requestedQty: number }[] = [];

  // Helper to process an individual chunk like "add 1 oil packet" or "2 biscuits"
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

    const requestedName = extractRequestedItemName(itemPhrase);
    const cleanedQuery = cleanItemPhrase(itemPhrase);

    if (!requestedName && !cleanedQuery) return;

    // Query inventory using cleaned token first, then requestedName
    const matchedProduct = matchProductInInventory(cleanedQuery || requestedName, products) ||
                           matchProductInInventory(requestedName, products);

    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        outOfStockItems.push({ product: matchedProduct, requestedQty: qty });
      } else {
        // Check if we already recognized this product in the same command
        const existing = recognizedItems.find(i => i.product.id === matchedProduct.id || i.product.name.toLowerCase() === matchedProduct.name.toLowerCase());
        if (existing) {
          existing.quantity += qty;
        } else {
          recognizedItems.push({ product: matchedProduct, quantity: qty });
        }
      }
    } else {
      // Product NOT in inventory!
      const missingName = requestedName || cleanedQuery || 'product';
      if (!missingItems.includes(missingName)) {
        missingItems.push(missingName);
      }
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

  // CASE 1: No products were added to cart
  if (recognizedItems.length === 0) {
    if (shouldCompleteBill) {
      return {
        action: 'COMPLETE_BILL',
        items: [],
        shouldCompleteBill: true,
        feedback: 'Generating bill for current cart items...',
        unmatchedTerms: missingItems
      };
    }

    // 1A: Products requested do not exist in inventory
    if (missingItems.length > 0) {
      let feedback = '';
      if (missingItems.length === 1) {
        const item = missingItems[0];
        const isPlural = item.endsWith('s');
        const verb = isPlural ? 'are no' : 'is no';
        if (language === 'te' || language === 'te-IN') {
          feedback = `ఇన్వెంటరీలో ${item} లేదు.`;
        } else if (language === 'hi' || language === 'hi-IN') {
          feedback = `इन्वेंटरी में कोई ${item} नहीं है।`;
        } else if (language === 'kn' || language === 'kn-IN') {
          feedback = `ಇನ್ವೆಂಟರಿಯಲ್ಲಿ ${item} ಇಲ್ಲ.`;
        } else {
          feedback = `There ${verb} ${item} in the inventory.`;
        }
      } else {
        const itemsList = missingItems.join(' or ');
        feedback = `There is no ${itemsList} in the inventory.`;
      }

      return {
        action: 'NO_ITEMS_FOUND',
        items: [],
        shouldCompleteBill: false,
        feedback,
        unmatchedTerms: missingItems
      };
    }

    // 1B: Product is in inventory, but stock is 0
    if (outOfStockItems.length > 0) {
      const names = outOfStockItems.map(i => i.product.name).join(', ');
      const feedback = `${names} is currently out of stock in the inventory.`;
      return {
        action: 'OUT_OF_STOCK',
        items: [],
        shouldCompleteBill: false,
        feedback,
        unmatchedTerms: [],
        outOfStockTerms: outOfStockItems.map(i => i.product.name)
      };
    }

    return {
      action: 'NOT_UNDERSTOOD',
      items: [],
      shouldCompleteBill: false,
      feedback: `Could not find that product in the inventory. Try saying e.g. "2 biscuits and 3 milk packets".`,
      unmatchedTerms: []
    };
  }

  // CASE 2: Some or all products were found and recognized
  const itemsSummary = recognizedItems.map(i => `${i.quantity}x ${i.product.name}`).join(', ');
  let feedback = `Added ${itemsSummary} to bill.`;

  // Append note if any requested items were not found in inventory
  if (missingItems.length > 0) {
    const missingSummary = missingItems.join(', ');
    const verb = missingItems.length === 1 && !missingItems[0].endsWith('s') ? 'is no' : 'are no';
    feedback += ` Note: There ${verb} ${missingSummary} in the inventory.`;
  }

  // Append note if any requested items were out of stock
  if (outOfStockItems.length > 0) {
    const oosSummary = outOfStockItems.map(i => i.product.name).join(', ');
    feedback += ` Note: ${oosSummary} is currently out of stock.`;
  }

  if (shouldCompleteBill) {
    feedback += ` Generating bill now!`;
  }

  return {
    action: 'ADD_ITEMS',
    items: recognizedItems,
    shouldCompleteBill,
    feedback,
    unmatchedTerms: missingItems,
    outOfStockTerms: outOfStockItems.map(i => i.product.name)
  };
}
