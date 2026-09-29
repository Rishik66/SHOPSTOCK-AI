import { Product } from '../types';
import { normalizeSlangSpeech, matchProductPhonetically } from './speechAccentService';
import { matchProductWithBrandGuard } from './brandProductMatcher';

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

// Multi-language number word mapper (English, Hindi, Telugu, Kannada)
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

  // Hindi (Romanized & Devanagari)
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'gyarah': 11, 'barah': 12, 'pandrah': 15, 'bees': 20,
  'pachees': 25, 'tees': 30, 'chalis': 40, 'pachaas': 50,
  'saath': 60, 'sattar': 70, 'assi': 80, 'nabbe': 90, 'sau': 100,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'पंद्रह': 15, 'बीस': 20, 'पच्चीस': 25,
  'तीस': 30, 'चालीस': 40, 'पचास': 50, 'साठ': 60, 'सौ': 100,

  // Telugu (Romanized & Telugu Script)
  'okati': 1, 'oka': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4,
  'aidu': 5, 'aaru': 6, 'yedu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,
  'padakondu': 11, 'pennendu': 12, 'padiheynu': 15, 'iravai': 20,
  'iravai aidu': 25, 'muppai': 30, 'nalabhai': 40, 'yabhai': 50,
  'aravai': 60, 'debbhai': 70, 'yenabhai': 80, 'tombhai': 90, 'vanda': 100,
  'ఒకటి': 1, 'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4,
  'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
  'పదకొండు': 11, 'పన్నెండు': 12, 'పదిహేను': 15, 'ఇరవై': 20,
  'ఇరవై ఐదు': 25, 'ముప్పై': 30, 'నలభై': 40, 'యాభై': 50,
  'అరవై': 60, 'డెబ్బై': 70, 'ఎనభై': 80, 'తొంభై': 90, 'వంద': 100,

  // Kannada (Romanized & Kannada Script)
  'ondu': 1, 'ondhu': 1, 'eradu': 2, 'mooru': 3, 'naalku': 4,
  'yelu': 7, 'entu': 8, 'ombattu': 9, 'hattu': 10,
  'hannondu': 11, 'hanneradu': 12, 'hadinaidu': 15, 'ippattu': 20,
  'ippattaidu': 25, 'moovattu': 30, 'nalavattu': 40, 'aivattu': 50,
  'aravattu': 60, 'eppattu': 70, 'enbattu': 80, 'tombattu': 90, 'nooru': 100,
  'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5,
  'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10,
  'ಹನ್ನೆರಡು': 12, 'ಇಪ್ಪತ್ತು': 20, 'ಮೂವತ್ತು': 30, 'ನಲವತ್ತು': 40, 'ಐವತ್ತು': 50, 'ನೂರು': 100
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
  'add', 'jodo', 'seri', 'chalao', 'put', 'daalo', 'veyyi', 'haaku',
  'ప్యాకెట్', 'ప్యాకెట్లు', 'బాటిల్', 'డబ్బా', 'కిలో', 'లీటర్'
];

// Product name aliases/synonyms for Kirana items (Generic categories ONLY; NO hardcoded brand names!)
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  'biscuit': [
    'biscuits', 'biscuit', 'buiscet', 'buiscets', 'biuscet', 'biuscets', 
    'biskit', 'biskits', 'biskoot', 'biskut', 'cookies', 'cookie', 
    'biscutes', 'biscut', 'bisket', 'biskets', 'బిస్కెట్లు', 'బిస్కెట్', 'बिस्कुट', 'ಬಿಸ್ಕತ್ತು'
  ],
  'milk': [
    'milk', 'milks', 'paal', 'paalu', 'palu', 'doodh', 'dudh', 'haalu', 
    'dudha', 'milk packets', 'milk packet', 'పాలు', 'పాల', 'పాల ప్యాకెట్', 'పాల ప్యాకెట్లు', 'दूध', 'ಹಾಲು'
  ],
  'noodles': [
    'noodle', 'noodles', 'nudles', 'nudle', 'నూడుల్స్', 'नूडल्स', 'ನೂಡಲ್ಸ್'
  ],
  'salt': [
    'salt', 'namak', 'uppu', 'solt', 'sendha namak', 'ఉప్పు', 'नमक', 'ಉಪ್ಪು'
  ],
  'atta': [
    'atta', 'aata', 'flour', 'wheat', 'gehun', 'godhuma', 'pindi', 'chakki atta', 
    'గోధుమ పిండి', 'పిండి', 'आटा', 'ಹಿಟ್ಟು'
  ],
  'bread': [
    'bread', 'loaf', 'bun', 'double roti', 'bred', 'pao', 'pav', 'బ్రెడ్', 'రొట్టె', 'ब्रेड', 'ಬ್ರೆಡ್'
  ],
  'coke': [
    'coke', 'cold drink', 'soft drink', 'కూల్ డ్రింక్'
  ],
  'thums up': [
    'thums up', 'thumbs up', 'thumbsup', 'thumsup', 'toofan', 'థమ్స్ అప్'
  ],
  'detergent': [
    'detergent', 'detergent powder', 'washing powder', 'సర్ఫ్', 'డిటర్జెంట్', 'डिटर्जेंट', 'ಡಿಟರ್ಜೆಂಟ್'
  ],
  'colgate': [
    'toothpaste', 'paste', 'tooth paste', 'dant manjan', 'టూత్‌పేస్ట్', 'పేస్ట్', 'टूथपेस्ट', 'ಟೂತ್ಪೇಸ್ಟ್'
  ],
  'soap': [
    'soap', 'soaps', 'sabun', 'sabbu', 'సబ్బు', 'సబ్బులు', 'साबुन', 'ಸೋಪು'
  ],
  'tea': [
    'tea', 'chai', 'cha', 'tea powder', 'టీ', 'టీ పొడి', 'చాయ్', 'चाय', 'ಚಹಾ'
  ],
  'sugar': [
    'sugar', 'chini', 'cheeni', 'sakkare', 'panchadara', 'chakkera', 'పంచదార', 'చక్కెర', 'चीनी', 'ಸಕ್ಕರೆ'
  ],
  'rice': [
    'rice', 'chawal', 'biyyam', 'akki', 'బియ్యం', 'चावल', 'ಅಕ್ಕಿ'
  ],
  'oil': [
    'oil', 'tel', 'enne', 'taila', 'cooking oil', 'nune', 'నూనె', 'तेल', 'ಎಣ್ಣೆ'
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
  // 2. Normalize Indian regional accents and retail slang
  const slangNormalized = normalizeSlangSpeech(preStripped);
  let text = ' ' + slangNormalized.toLowerCase().trim() + ' ';

  // 2. Convert common speech recognition homophones for numbers ONLY when preceding a noun (not articles/prepositions)
  // e.g. "to biscuits" -> "2 biscuits", but NOT "to the"
  text = text.replace(/\b(?:to|too)\b(?=\s+(?!the\b|my\b|our\b|a\b|an\b|this\b|that\b|cart\b|bill\b|inventory\b)[a-z])/gi, ' 2 ');
  text = text.replace(/\b(?:for|fore)\b(?=\s+(?!the\b|my\b|our\b|a\b|an\b|this\b|that\b|cart\b|bill\b|inventory\b)[a-z])/gi, ' 4 ');
  text = text.replace(/\b(?:ate)\b(?=\s+[a-z])/gi, ' 8 ');
  text = text.replace(/\b(?:tree|free)\b(?=\s+[a-z])/gi, ' 3 ');
  text = text.replace(/\b(?:won|wan)\b(?=\s+[a-z])/gi, ' 1 ');

  // 3. Replace spoken number words with digits (Unicode-safe for Telugu, Hindi, Kannada, English)
  Object.entries(NUMBER_WORDS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([word, num]) => {
      const isAscii = /^[a-z0-9\s-]+$/i.test(word);
      if (isAscii) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        text = text.replace(regex, ` ${num} `);
      } else {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9\u0C00-\u0C7F\u0900-\u097F\u0C80-\u0CFF])${escaped}($|\\s|[^a-zA-Z0-9\u0C00-\u0C7F\u0900-\u097F\u0C80-\u0CFF])`, 'g');
        text = text.replace(regex, `$1 ${num} $2`);
      }
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
    'the', 'a', 'an',
    'జోడించు', 'కలపండి', 'వేయి', 'కావాలి', 'బిల్లులో', 'బిల్లు', 'కార్ట్‌లో', 'దయచేసి',
    'जोड़ो', 'डालो', 'चाहिए', 'बिल में', 'बिल'
  ];
  stripWords.forEach(w => {
    const isAscii = /^[a-z0-9\s-]+$/i.test(w);
    if (isAscii) {
      name = name.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    } else {
      name = name.replace(new RegExp(w, 'g'), ' ');
    }
  });
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Cleans packaging and filler words from an item phrase for database inventory matching
 */
function cleanItemPhrase(phrase: string): string {
  let cleaned = phrase.toLowerCase();
  NOISE_WORDS.forEach(noise => {
    const isAscii = /^[a-z0-9\s-]+$/i.test(noise);
    if (isAscii) {
      cleaned = cleaned.replace(new RegExp(`\\b${noise}\\b`, 'gi'), ' ');
    } else {
      cleaned = cleaned.replace(new RegExp(noise, 'g'), ' ');
    }
  });
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Strictly searches for matching product from user's ACTUAL inventory (products).
 * Uses Brand-Guard so "Gayatri Milk" NEVER matches "Amul Milk"!
 */
function matchProductInInventory(queryText: string, products: Product[]): Product | null {
  const cleanQ = queryText.toLowerCase().trim();
  if (!cleanQ || products.length === 0) return null;

  // 1. BRAND-GUARD MATCH FIRST (Absolute brand differentiation)
  const brandGuarded = matchProductWithBrandGuard(cleanQ, products);
  if (brandGuarded.product) {
    return brandGuarded.product;
  }
  // If the user specified a brand that is absent or conflicts with inventory, DO NOT match another brand!
  if (brandGuarded.reason === 'BRAND_MISMATCH_REJECTED') {
    return null;
  }

  // 2. Direct exact match on product name
  const exactMatch = products.find(p => p.name.toLowerCase() === cleanQ);
  if (exactMatch) return exactMatch;

  // 3. Check generic synonyms ONLY if no brand conflict
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

  // 4. Phonetic Soundex and fuzzy similarity match
  const phoneticMatch = matchProductPhonetically(cleanQ, products);
  if (phoneticMatch) {
    return phoneticMatch.product;
  }

  // 5. Prefix or boundary match (ONLY if no brand conflict)
  const directMatch = products.find(p => 
    p.name.toLowerCase().startsWith(cleanQ) || 
    cleanQ.startsWith(p.name.toLowerCase())
  );
  if (directMatch) return directMatch;

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
    'bill ready', 'print receipt', 'give receipt', 'బిల్లు ఇవ్వండి', 'బిల్లు చెయ్యి', 'రసీదు'
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
    itemsStringToParse = itemsStringToParse.replace(new RegExp(k, 'gi'), ' ');
  });

  // Split on conjunctions: 'and', 'aur', 'mariyu', 'mattu', commas, plus
  const rawSegments = itemsStringToParse
    .split(/(?:\band\b|\baur\b|\bmariyu\b|\bmattu\b|,|\+|\&|మరియు|మరియును|औ|ఔర్)/gi)
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

    // First check Brand-Guard to catch brand mismatch immediately
    const guardCheck = matchProductWithBrandGuard(cleanedQuery || requestedName, products);
    if (guardCheck.reason === 'BRAND_MISMATCH_REJECTED') {
      const descriptiveMsg = guardCheck.feedback || `"${requestedName || cleanedQuery}" is not in your inventory`;
      if (!missingItems.includes(descriptiveMsg)) {
        missingItems.push(descriptiveMsg);
      }
      return;
    }

    // Query inventory using cleaned token first, then requestedName
    const matchedProduct = guardCheck.product ||
                           matchProductInInventory(cleanedQuery || requestedName, products) ||
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
    const multiItemPattern = /(\d+\s+[^\d]+?)(?=\s*\d+\s+|$)/g;
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
        if (item.includes('not in your inventory') || item.includes('లేదు') || item.includes('नहीं है')) {
          feedback = item;
        } else {
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
        }
      } else {
        const itemsList = missingItems.join('; ');
        feedback = `Items not available in inventory: ${itemsList}.`;
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
