import { Product } from '../types';
import { normalizeSlangSpeech, matchProductPhonetically } from './speechAccentService';
import { matchProductWithBrandGuard } from './brandProductMatcher';

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

// Multi-language number word mapper (English, Hindi, Telugu, Kannada)
const NUMBER_WORDS: Record<string, number> = {
  // English
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'dozen': 12, 'fifteen': 15,
  'twenty': 20, 'twenty five': 25, 'thirty': 30, 'forty': 40,
  'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80,
  'ninety': 90, 'hundred': 100,

  // Hindi (Romanized & Devanagari)
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'pandrah': 15, 'bees': 20, 'pachees': 25, 'tees': 30,
  'chalis': 40, 'pachaas': 50, 'saath': 60, 'sau': 100,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'पंद्रह': 15, 'बीस': 20, 'तीस': 30,
  'चालीस': 40, 'पचास': 50, 'साठ': 60, 'सौ': 100,

  // Telugu (Romanized & Telugu Script)
  'okati': 1, 'oka': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4,
  'aidu': 5, 'aaru': 6, 'yedu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,
  'padakondu': 11, 'pennendu': 12, 'padiheynu': 15, 'iravai': 20,
  'iravai aidu': 25, 'muppai': 30, 'nalabhai': 40, 'yabhai': 50,
  'aravai': 60, 'vanda': 100,
  'ఒకటి': 1, 'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4,
  'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
  'పదకొండు': 11, 'పన్నెండు': 12, 'పదిహేను': 15, 'ఇరవై': 20,
  'ముప్పై': 30, 'నలభై': 40, 'యాభై': 50, 'అరవై': 60, 'వంద': 100,

  // Kannada (Romanized & Kannada Script)
  'ondu': 1, 'ondhu': 1, 'eradu': 2, 'mooru': 3, 'naalku': 4,
  'yelu': 7, 'entu': 8, 'ombattu': 9, 'hattu': 10,
  'ippattu': 20, 'moovattu': 30, 'nalavattu': 40, 'aivattu': 50,
  'aravattu': 60, 'nooru': 100,
  'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5,
  'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10,
  'ಇಪ್ಪತ್ತು': 20, 'ಮೂವತ್ತು': 30, 'ನಲವತ್ತು': 40, 'ಐವತ್ತು': 50, 'ನೂರು': 100
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
  'karo', 'cheyi', 'kodi', 'jodo', 'seri', 'chalao',
  'ప్యాకెట్', 'ప్యాకెట్లు', 'బాటిల్', 'డబ్బా', 'కిలో', 'లీటర్'
];

interface KiranaCatalogItem {
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  aliases: string[];
}

// Built-in Indian Kirana Catalog with extensive phonetic aliases (Generic templates ONLY)
const KIRANA_CATALOG: Record<string, KiranaCatalogItem> = {
  biscuit: {
    name: 'Biscuits',
    category: 'Biscuits',
    purchasePrice: 8,
    sellingPrice: 10,
    minimumStock: 20,
    aliases: [
      'biscuit', 'biscuits', 'buiscet', 'buiscets', 'biuscet', 'biuscets', 
      'biskit', 'biskits', 'biskoot', 'biskut', 'cookie', 'cookies',
      'బిస్కెట్లు', 'బిస్కెట్', 'बिस्कुट', 'ಬಿಸ್ಕತ್ತು'
    ]
  },
  milk: {
    name: 'Milk',
    category: 'Dairy',
    purchasePrice: 54,
    sellingPrice: 60,
    minimumStock: 10,
    aliases: [
      'milk', 'milk packet', 'milk packets', 'paal', 'paalu', 'palu', 'doodh', 'dudha', 
      'haalu', 'పాలు', 'పాల', 'పాల ప్యాకెట్', 'పాల ప్యాకెట్లు', 'दूध', 'ಹಾಲು'
    ]
  },
  noodles: {
    name: 'Maggi',
    category: 'Noodles',
    purchasePrice: 12,
    sellingPrice: 14,
    minimumStock: 10,
    aliases: ['maggi', 'meggi', 'maggie', 'noodle', 'noodles', '2 minute', 'yippee', 'top ramen', 'మ్యాగీ', 'मैगी']
  },
  salt: {
    name: 'Tata Salt',
    category: 'Spices',
    purchasePrice: 20,
    sellingPrice: 25,
    minimumStock: 15,
    aliases: ['salt', 'tata salt', 'namak', 'uppu', 'iodized salt', 'ఉప్పు', 'नमक']
  },
  atta: {
    name: 'Aashirvaad Atta',
    category: 'Flour',
    purchasePrice: 55,
    sellingPrice: 65,
    minimumStock: 10,
    aliases: ['atta', 'aata', 'flour', 'wheat', 'gehun', 'godhuma', 'chakki atta', 'పిండి', 'ఆటా', 'आटा']
  },
  bread: {
    name: 'Bread',
    category: 'Bakery',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 10,
    aliases: ['bread', 'loaf', 'bun', 'double roti', 'pav', 'brown bread', 'white bread', 'బ్రెడ్', 'రొట్టె', 'ब्रेड']
  },
  coke: {
    name: 'Coca-Cola',
    category: 'Beverages',
    purchasePrice: 38,
    sellingPrice: 45,
    minimumStock: 12,
    aliases: ['coke', 'coca-cola', 'coca cola', 'cocacola', 'cold drink', 'soft drink']
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

function normalizeSpokenText(raw: string): string {
  const slangNormalized = normalizeSlangSpeech(raw);
  let text = ' ' + slangNormalized.toLowerCase().trim() + ' ';

  // Convert common speech recognition homophones for numbers
  text = text.replace(/\b(?:to|too)\b(?=\s+[a-z])/gi, ' 2 ');
  text = text.replace(/\b(?:for|fore)\b(?=\s+[a-z])/gi, ' 4 ');
  text = text.replace(/\b(?:ate)\b(?=\s+[a-z])/gi, ' 8 ');
  text = text.replace(/\b(?:tree|free)\b(?=\s+[a-z])/gi, ' 3 ');
  text = text.replace(/\b(?:won|wan)\b(?=\s+[a-z])/gi, ' 1 ');

  // Replace spoken number words with digits (Unicode-safe for Telugu, Hindi, Kannada, English)
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
 * Cleans packaging and filler words from an item phrase
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
 * Matches an item query to an existing product in inventory OR auto-creates a product template.
 * Strictly respects brands: saying "Gayatri Milk" will NEVER match "Amul Milk"!
 * Instead, if "Gayatri Milk" is not yet in the store, it auto-creates "Gayatri Milk" as a new product!
 */
function matchOrMakeProduct(queryText: string, products: Product[]): { product: Product; isNew: boolean } {
  const cleanQ = queryText.toLowerCase().trim();

  // 1. BRAND-GUARD MATCH FIRST
  const brandGuarded = matchProductWithBrandGuard(cleanQ, products);
  if (brandGuarded.product) {
    return { product: brandGuarded.product, isNew: false };
  }

  // 2. If user requested a SPECIFIC brand that is NOT yet in inventory (e.g. "Gayatri Milk" when only "Amul Milk" exists)
  if (brandGuarded.reason === 'BRAND_MISMATCH_REJECTED' || brandGuarded.requestedBrand) {
    const brandCapitalized = brandGuarded.requestedBrand 
      ? brandGuarded.requestedBrand.charAt(0).toUpperCase() + brandGuarded.requestedBrand.slice(1)
      : '';
    const itemCapitalized = brandGuarded.requestedItem 
      ? brandGuarded.requestedItem.charAt(0).toUpperCase() + brandGuarded.requestedItem.slice(1)
      : 'Product';

    const formattedName = `${brandCapitalized} ${itemCapitalized}`.trim() || cleanQ.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const category = brandGuarded.requestedItem === 'milk' ? 'Dairy' 
                   : brandGuarded.requestedItem === 'oil' ? 'Edible Oil' 
                   : brandGuarded.requestedItem === 'biscuits' ? 'Biscuits' 
                   : 'General Store';

    const newProduct: Product = {
      id: 'prod_' + Date.now().toString() + Math.random().toString(36).slice(2, 6),
      name: formattedName,
      category,
      stock: 0,
      purchasePrice: brandGuarded.requestedItem === 'milk' ? 50 : 20,
      sellingPrice: brandGuarded.requestedItem === 'milk' ? 56 : 25,
      minimumStock: 10
    };
    return { product: newProduct, isNew: true };
  }

  // 3. Direct exact match on product name in current inventory
  const directMatch = products.find(p => p.name.toLowerCase() === cleanQ);
  if (directMatch) return { product: directMatch, isNew: false };

  // 4. Check Kirana catalog templates and aliases (only when NO brand was specified)
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

  // 5. Phonetic Soundex and fuzzy similarity match
  const phoneticMatch = matchProductPhonetically(cleanQ, products);
  if (phoneticMatch) {
    return { product: phoneticMatch.product, isNew: false };
  }

  // 6. Auto-create as new custom product so voice restock never fails
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
    normalized.includes('subtract') ||
    normalized.includes('తీసివేయి') ||
    normalized.includes('తొలగించు') ||
    normalized.includes('हटाओ') ||
    normalized.includes('ತೆಗೆದುಹಾಕಿ')
  );
  const actionType: 'ADD' | 'REMOVE' = isRemove ? 'REMOVE' : 'ADD';

  // Strip inventory context phrases
  let workingText = normalized;
  [
    'to the inventory', 'to inventory', 'in the inventory', 'in inventory', 
    'from the inventory', 'from inventory', 'into the inventory', 'into inventory',
    'ఇన్వెంటరీలో', 'స్టాక్‌లో', 'ఇన్వెంటరీకి'
  ].forEach(phrase => {
    workingText = workingText.replace(new RegExp(phrase, 'gi'), ' ');
  });

  // Strip action prefixes: 'add', 'remove', 'reduce'
  workingText = workingText.replace(/\b(add|remove|reduce|plus|minus)\b/gi, ' ');
  workingText = workingText.replace(/(జోడించు|కలపండి|తీసివేయి|తొలగించు|వేయి|जोड़ो|हटाओ|डालो|ಸೇರಿಸಿ|ತೆಗೆದುಹಾಕಿ)/g, ' ');

  // Split on conjunctions: 'and', 'aur', 'mariyu', 'mattu', commas, plus
  const rawSegments = workingText
    .split(/(?:\band\b|\baur\b|\bmariyu\b|\bmattu\b|,|\+|\&|మరియు|మరియును|औ|ఔర్)/gi)
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
    const multiItemPattern = /(\d+\s+[^\d]+?)(?=\s*\d+\s+|$)/g;
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
