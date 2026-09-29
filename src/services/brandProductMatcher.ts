import { Product } from '../types';

/**
 * Known Brands Directory across Indian Kirana, FMCG, and Retail
 */
export const KNOWN_BRANDS: Record<string, string[]> = {
  // Dairy & Milk brands
  'gayatri': ['gayatri', 'gayatridevi', 'గాయత్రి', 'गायत्री', 'ಗಾಯತ್ರಿ'],
  'amul': ['amul', 'ammul', 'అముల్', 'అమూల్', 'अमुल', 'अमूल', 'ಅಮುಲ್', 'ಅಮೂಲ್'],
  'heritage': ['heritage', 'హెరిటేజ్', 'हेरिटेज', 'ಹೆರಿಟೇಜ್'],
  'nandini': ['nandini', 'నందిని', 'नंदिनी', 'ನಂದಿನಿ'],
  'mother dairy': ['mother dairy', 'motherdairy', 'మదర్ డెయిరీ', 'मदर डेयरी', 'ಮದರ್ ಡೈರಿ'],
  'jersey': ['jersey', 'జెర్సీ', 'जर्सी', 'ಜರ್ಸಿ'],
  'vijaya': ['vijaya', 'విజయ', 'विजया', 'ವಿಜಯ'],
  'sangam': ['sangam', 'సంగం', 'संगम', 'ಸಂಗಮ'],
  'tirumala': ['tirumala', 'తిరుమల', 'तिरुपति', 'ತಿರುಮಲ'],
  'dodla': ['dodla', 'దొడ్ల', 'ದೊಡ್ಲ'],
  'milky mist': ['milky mist', 'milkymist'],
  'country delight': ['country delight', 'countrydelight'],

  // Biscuits & Confectionery
  'parle-g': ['parle-g', 'parleg', 'parle', 'పార్లే', 'पारले', 'ಪಾರ್ಲೆ', 'parle g'],
  'britannia': ['britannia', 'britania', 'బ్రిటానియా', 'ब्रिटानिया', 'ಬ್ರಿಟಾನಿಯಾ'],
  'sunfeast': ['sunfeast', 'సన్‌ఫీస్ట్', 'सनफीस्ट', 'ಸನ್‌ಫೀಸ್ಟ್'],
  'oreo': ['oreo', 'ఓరియో', 'ओरियो', 'ಓರಿಯೊ'],
  'cadbury': ['cadbury', 'cadburys', 'క్యాడ్‌బరీ', 'कैटबरी', 'ಕ್ಯಾಡ್ಬರಿ'],
  'good day': ['good day', 'goodday', 'గుడ్ డే', 'गुड डे'],
  'marie': ['marie', 'marie gold', 'మేరీ', 'मारी'],
  'bourbon': ['bourbon', 'బోర్బన్', 'बोरबन'],
  'monaco': ['monaco', 'మోనాకో'],

  // Atta / Flour
  'aashirvaad': ['aashirvaad', 'ashirvaad', 'ashirvad', 'ashirwad', 'ఆశీర్వాద్', 'आशीर्वाद', 'ಆಶೀರ್ವಾದ್'],
  'pillsbury': ['pillsbury', 'పిల్స్‌బరీ', 'पिल्सबरी', 'ಪಿಲ್ಸ್‌ಬರಿ'],
  'annapurna': ['annapurna', 'అన్నపూర్ణ', 'अन्नपूर्णा'],

  // Salt & Spices
  'tata': ['tata', 'tata salt', 'టాటా', 'टाटा', 'ಟಾಟಾ'],
  'catch': ['catch', 'క్యాచ్'],
  'everest': ['everest', 'ఎవరెస్ట్', 'एवरेस्ट'],
  'mdh': ['mdh', 'ఎండీహెచ్'],

  // Edible Oil
  'fortune': ['fortune', 'ఫార్చ్యూన్', 'फॉर्च्यून', 'ಫಾರ್ಚೂನ್'],
  'freedom': ['freedom', 'ఫ్రీడమ్', 'फ्रीडम', 'ಫ್ರೀಡಮ್'],
  'gemini': ['gemini', 'జెమిని', 'जेमिनी', 'ಜೆಮಿನಿ'],
  'dhara': ['dhara', 'ధార', 'धारा'],
  'saffola': ['saffola', 'సఫోలా', 'सफोला'],
  'gold drop': ['gold drop', 'golddrop'],
  'sunpure': ['sunpure', 'సన్‌ప్యూర్'],

  // Detergent & Household
  'surf excel': ['surf excel', 'surfexcel', 'surf', 'సర్ఫ్ ఎక్సెల్', 'सर्फ़ एक्सेल', 'ಸರ್ಫ್ ಎಕ್ಸೆಲ್'],
  'tide': ['tide', 'టైడ్', 'टाइड', 'ಟೈಡ್'],
  'ariel': ['ariel', 'ఏరియల్', 'एरियल', 'ಏರಿಯಲ್'],
  'rin': ['rin', 'రిన్', 'रिन', 'ರಿನ್'],
  'wheel': ['wheel', 'వీల్', 'व्हील', 'ವ್ಹೀಲ್'],
  'ghadi': ['ghadi', 'ఘడీ', 'घड़ी'],

  // Toothpaste & Personal Care
  'colgate': ['colgate', 'kolgate', 'కోల్గేట్', 'कोलगेट', 'ಕೋಲ್ಗೇಟ್'],
  'close up': ['close up', 'closeup', 'క్లోజ్ అప్'],
  'pepsodent': ['pepsodent', 'పెప్సోడెంట్'],
  'sensodyne': ['sensodyne', 'సెన్సోడైన్'],
  'dabur': ['dabur', 'డాబర్', 'डाबर', 'ಡಾಬರ್'],
  'patanjali': ['patanjali', 'పతంజలి', 'पतंजलि', 'ಪತಂಜಲಿ'],

  // Soaps
  'dettol': ['dettol', 'డెట్టాల్', 'डेटॉल', 'ಡೆಟ್ಟಾಲ್'],
  'lifebuoy': ['lifebuoy', 'లైఫ్‌బాయ్', 'लाइफबॉय', 'ಲೈಫ್ಬಾಯ್'],
  'lux': ['lux', 'లక్స్', 'लक्स', 'ಲಕ್ಸ್'],
  'dove': ['dove', 'డవ్', 'डव', 'ಡವ್'],
  'santoor': ['santoor', 'సంతూర్', 'संतूर', 'ಸಂತೂರ್'],
  'medimix': ['medimix', 'మేడిమిక్స్'],
  'cinthol': ['cinthol', 'సింథాల్'],
  'mysore sandal': ['mysore sandal', 'మైసూర్ శాండల్', 'ಮೈಸೂರ್ ಸ್ಯಾಂಡಲ್'],

  // Soft Drinks & Beverages
  'thums up': ['thums up', 'thumbs up', 'thumbsup', 'thumsup', 'థమ్స్ అప్', 'थम्स अप', 'ಥಮ್ಸ್ ಅಪ್'],
  'coca-cola': ['coca-cola', 'coca cola', 'cocacola', 'coke', 'కోకాకోలా', 'कोका कोला', 'ಕೋಕಾ ಕೋಲಾ'],
  'pepsi': ['pepsi', 'పెప్సీ', 'पेप्सी', 'ಪೆಪ್ಸಿ'],
  'sprite': ['sprite', 'స్ప్రైట్', 'स्प्राइट', 'ಸ್ಪ್ರೈಟ್'],
  'fanta': ['fanta', 'ఫాంటా', 'फैंटा', 'ಫ್ಯಾಂಟಾ'],
  'frooti': ['frooti', 'ఫ్రూటీ', 'फ्रूटी', 'ಫ್ರೂಟಿ'],
  'maaza': ['maaza', 'మాజా', 'माज़ा', 'ಮಾಝಾ'],

  // Instant Foods & Noodles
  'maggi': ['maggi', 'meggi', 'maggie', 'మ్యాగీ', 'मैगी', 'ಮ್ಯಾಗಿ'],
  'yippee': ['yippee', 'యిప్పీ', 'यिप्पी', 'ಯಿಪ್ಪಿ'],
  'top ramen': ['top ramen', 'టాప్ రామెన్'],
};

/**
 * Category/Product Type Base Nouns across English, Telugu, Hindi, and Kannada
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'milk': [
    'milk', 'milks', 'paalu', 'palu', 'paal', 'doodh', 'dudh', 'dudha', 'haalu', 'halu',
    'పాలు', 'పాల', 'పాల ప్యాకెట్', 'పాల ప్యాకెట్లు', 'పాలప్యాకెట్',
    'दूध', 'दूध पैकेट',
    'ಹಾಲು', 'ಹಾಲಿನ ಪ್ಯಾಕೆಟ್'
  ],
  'biscuits': [
    'biscuit', 'biscuits', 'biskit', 'biskits', 'biskut', 'biskoot', 'cookies',
    'బిస్కెట్లు', 'బిస్కెట్', 'బిస్కట్',
    'बिस्कुट', 'बिस्किट',
    'ಬಿಸ್ಕತ್ತು', 'ಬಿಸ್ಕಟ್'
  ],
  'atta': [
    'atta', 'aata', 'flour', 'wheat', 'gehun', 'godhuma', 'pindi', 'hittu',
    'గోధుమ పిండి', 'పిండి', 'ఆటా',
    'आटा', 'गेहूं का आटा',
    'ಗೋಧಿ ಹಿಟ್ಟು', 'ಹಿಟ್ಟು'
  ],
  'salt': [
    'salt', 'namak', 'uppu', 'solt',
    'ఉప్పు',
    'नमक',
    'ಉಪ್ಪು'
  ],
  'bread': [
    'bread', 'loaf', 'double roti', 'bun', 'pao', 'pav',
    'బ్రెడ్', 'రొట్టె',
    'ब्रेड', 'डबल रोटी', 'पाव',
    'ಬ್ರೆಡ್', 'ರೊಟ್ಟಿ'
  ],
  'oil': [
    'oil', 'oyil', 'aayil', 'taila', 'tel', 'nune', 'yenne', 'enne',
    'నూనె', 'తైలం',
    'तेल',
    'ಎಣ್ಣೆ'
  ],
  'ghee': [
    'ghee', 'neyyi', 'tuppa',
    'నెయ్యి',
    'घी',
    'ತುಪ್ಪ'
  ],
  'soap': [
    'soap', 'soaps', 'sabun', 'sabbu', 'sope',
    'సబ్బు', 'సబ్బులు',
    'साबुन',
    'ಸೋಪು', 'ಸಾಬೂನು'
  ],
  'toothpaste': [
    'toothpaste', 'tooth paste', 'paste', 'dant manjan', 'manjan',
    'టూత్‌పేస్ట్', 'పేస్ట్',
    'टूथपेस्ट', 'दंत मंजन',
    'ಟೂತ್ಪೇಸ್ಟ್'
  ],
  'detergent': [
    'detergent', 'washing powder', 'detergent powder',
    'సర్ఫ్', 'డిటర్జెంట్',
    'डिटर्जेंट', 'सर्फ',
    'ಡಿಟರ್ಜೆಂಟ್'
  ],
  'tea': [
    'tea', 'chai', 'cha', 'tea powder',
    'టీ', 'టీ పొడి', 'చాయ్',
    'चाय', 'चाय पत्ती',
    'ಚಹಾ', 'ಟೀ ಪುಡಿ'
  ],
  'sugar': [
    'sugar', 'chini', 'cheeni', 'panchadara', 'sakkare', 'chakkera',
    'పంచదార', 'చక్కెర',
    'चीनी', 'शक्कर',
    'ಸಕ್ಕರೆ'
  ],
  'rice': [
    'rice', 'chawal', 'biyyam', 'akki',
    'బియ్యం',
    'चावल',
    'ಅಕ್ಕಿ'
  ],
  'noodles': [
    'noodles', 'noodle', 'nudle', 'nudles',
    'నూడుల్స్',
    'नूडल्स',
    'ನೂಡಲ್ಸ್'
  ]
};

/**
 * Extracts recognized brand from a text string (in English, Telugu, Hindi, or Kannada)
 */
export function extractBrandFromText(text: string): { canonicalBrand: string; matchedAlias: string } | null {
  const clean = ' ' + text.toLowerCase().trim() + ' ';

  for (const [canonical, aliases] of Object.entries(KNOWN_BRANDS)) {
    for (const alias of aliases) {
      // Word boundary check (for English) or direct inclusion (for native scripts)
      const isAscii = /^[a-z0-9\s-]+$/i.test(alias);
      if (isAscii) {
        const regex = new RegExp(`(^|\\s|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|[^a-z0-9])`, 'i');
        if (regex.test(clean)) {
          return { canonicalBrand: canonical, matchedAlias: alias };
        }
      } else {
        if (clean.includes(alias)) {
          return { canonicalBrand: canonical, matchedAlias: alias };
        }
      }
    }
  }

  // Dynamic brand extraction: check if the first capitalized/unique word matches a product in store
  return null;
}

/**
 * Extracts recognized category/base noun from a text string
 */
export function extractCategoryFromText(text: string): { canonicalCategory: string; matchedAlias: string } | null {
  const clean = ' ' + text.toLowerCase().trim() + ' ';

  for (const [canonical, aliases] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const alias of aliases) {
      const isAscii = /^[a-z0-9\s-]+$/i.test(alias);
      if (isAscii) {
        const regex = new RegExp(`(^|\\s|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|[^a-z0-9])`, 'i');
        if (regex.test(clean)) {
          return { canonicalCategory: canonical, matchedAlias: alias };
        }
      } else {
        if (clean.includes(alias)) {
          return { canonicalCategory: canonical, matchedAlias: alias };
        }
      }
    }
  }

  return null;
}

/**
 * Extracts brand and item category from a product object
 */
export function analyzeProductIdentity(product: Product): { brand: string | null; category: string | null } {
  const nameAnalysis = extractBrandFromText(product.name);
  const catAnalysis = extractCategoryFromText(product.name) || extractCategoryFromText(product.category);

  // If brand is not in known dictionary, look at the first word of the product name as candidate brand
  let dynamicBrand: string | null = nameAnalysis ? nameAnalysis.canonicalBrand : null;
  if (!dynamicBrand) {
    const tokens = product.name.trim().split(/\s+/);
    if (tokens.length >= 2) {
      dynamicBrand = tokens[0].toLowerCase();
    }
  }

  return {
    brand: dynamicBrand,
    category: catAnalysis ? catAnalysis.canonicalCategory : null
  };
}

export interface MatchResult {
  product: Product | null;
  score: number;
  reason: 'EXACT_MATCH' | 'BRAND_AND_ITEM_MATCH' | 'GENERIC_ITEM_MATCH' | 'BRAND_MISMATCH_REJECTED' | 'NOT_FOUND';
  feedback?: string;
  requestedBrand?: string;
  requestedItem?: string;
  conflictingProducts?: Product[];
}

/**
 * Advanced Brand-Aware Multilingual Product Matcher
 * 
 * Rules:
 * 1. If user query specifies a brand (e.g. "Gayatri"), and candidate product is a different brand (e.g. "Amul"),
 *    it will REJECT that candidate completely! Brand conflict is a hard veto.
 * 2. If user specifies "Gayatri Milk", and "Gayatri Milk" is in stock, it matches with score 1.0.
 * 3. If user specifies "Gayatri Milk", but store ONLY has "Amul Milk":
 *    It returns product: null with reason: 'BRAND_MISMATCH_REJECTED', clearly stating Gayatri Milk is not in stock.
 * 4. If user query has no brand (e.g. "Milk packets"):
 *    It matches available milk products.
 */
export function matchProductWithBrandGuard(
  query: string,
  products: Product[]
): MatchResult {
  if (!query || products.length === 0) {
    return { product: null, score: 0, reason: 'NOT_FOUND' };
  }

  const rawQ = query.trim();
  const lowerQ = rawQ.toLowerCase();

  // 1. Analyze user query
  const queryBrandInfo = extractBrandFromText(rawQ);
  const queryCatInfo = extractCategoryFromText(rawQ);

  const queryBrand = queryBrandInfo ? queryBrandInfo.canonicalBrand : null;
  const queryCategory = queryCatInfo ? queryCatInfo.canonicalCategory : null;

  // Check for dynamic brand token if query starts with a capitalized or distinctive word
  // e.g. "Gayatri milk packets" -> if "gayatri" is not recognized yet, treat first token before "milk" as brand
  let effectiveQueryBrand = queryBrand;
  if (!effectiveQueryBrand && queryCategory) {
    const wordsBeforeCat = lowerQ.split(new RegExp(`\\b${queryCategory}\\b|${queryCatInfo?.matchedAlias}`, 'i'))[0].trim().split(/\s+/);
    const candidate = wordsBeforeCat.find(w => w.length > 2 && !['add', 'remove', 'to', 'for', 'the', 'give', 'two', 'three', 'one', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].includes(w));
    if (candidate) {
      effectiveQueryBrand = candidate;
    }
  }

  // 2. Direct exact full string match
  for (const p of products) {
    const pName = p.name.toLowerCase().trim();
    if (pName === lowerQ) {
      return { product: p, score: 1.0, reason: 'EXACT_MATCH' };
    }
  }

  // 3. Score all products in inventory
  interface ScoredCandidate {
    product: Product;
    score: number;
    hasBrandConflict: boolean;
    brandMatch: boolean;
    categoryMatch: boolean;
  }

  const scoredCandidates: ScoredCandidate[] = [];

  for (const p of products) {
    const pIdentity = analyzeProductIdentity(p);
    const pName = p.name.toLowerCase();

    let score = 0;
    let hasBrandConflict = false;
    let brandMatch = false;
    let categoryMatch = false;

    // Check Brand Compatibility
    if (effectiveQueryBrand) {
      if (pIdentity.brand) {
        if (pIdentity.brand === effectiveQueryBrand || pName.includes(effectiveQueryBrand)) {
          brandMatch = true;
          score += 60; // Strong positive for brand match
        } else {
          // BRAND CONFLICT! The user asked for "Gayatri", but this product is "Amul"
          hasBrandConflict = true;
          score = -100; // Hard rejection
        }
      } else {
        // Product has no known brand; does its name include the requested brand?
        if (pName.includes(effectiveQueryBrand)) {
          brandMatch = true;
          score += 50;
        } else {
          hasBrandConflict = true;
          score = -50;
        }
      }
    }

    // Check Category / Item Noun Compatibility
    if (queryCategory) {
      if (pIdentity.category === queryCategory || pName.includes(queryCategory) || p.category.toLowerCase().includes(queryCategory)) {
        categoryMatch = true;
        score += 35;
      }
    }

    // Check raw substring match if no brand conflict
    if (!hasBrandConflict) {
      const qTokens = lowerQ.split(/\s+/).filter(w => w.length > 2 && !['packet', 'packets', 'pack', 'pcs', 'bottle', 'kilo', 'kg'].includes(w));
      const pTokens = pName.split(/\s+/);

      for (const qt of qTokens) {
        if (pTokens.some(pt => pt === qt)) {
          score += 15;
        } else if (pTokens.some(pt => pt.includes(qt) || qt.includes(pt))) {
          score += 8;
        }
      }
    }

    scoredCandidates.push({
      product: p,
      score,
      hasBrandConflict,
      brandMatch,
      categoryMatch
    });
  }

  // Filter out any candidates with brand conflict
  const validCandidates = scoredCandidates
    .filter(c => !c.hasBrandConflict && c.score > 25)
    .sort((a, b) => b.score - a.score);

  // If user requested a specific brand, but all matching products of that category belong to a DIFFERENT brand:
  if (effectiveQueryBrand && validCandidates.length === 0) {
    const sameCategoryDiffBrand = products.filter(p => {
      const ident = analyzeProductIdentity(p);
      return queryCategory && (ident.category === queryCategory || p.name.toLowerCase().includes(queryCategory));
    });

    const requestedName = `${effectiveQueryBrand.charAt(0).toUpperCase() + effectiveQueryBrand.slice(1)} ${queryCategory ? queryCategory.charAt(0).toUpperCase() + queryCategory.slice(1) : 'Product'}`;
    const altNames = sameCategoryDiffBrand.map(p => p.name).join(', ');

    return {
      product: null,
      score: 0,
      reason: 'BRAND_MISMATCH_REJECTED',
      requestedBrand: effectiveQueryBrand,
      requestedItem: queryCategory || undefined,
      conflictingProducts: sameCategoryDiffBrand,
      feedback: sameCategoryDiffBrand.length > 0 
        ? `"${requestedName}" is not in your inventory. In stock: ${altNames}.`
        : `"${requestedName}" is not found in your inventory.`
    };
  }

  if (validCandidates.length > 0) {
    const top = validCandidates[0];
    return {
      product: top.product,
      score: top.score,
      reason: top.brandMatch ? 'BRAND_AND_ITEM_MATCH' : 'GENERIC_ITEM_MATCH'
    };
  }

  return { product: null, score: 0, reason: 'NOT_FOUND' };
}
