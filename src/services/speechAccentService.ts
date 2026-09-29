import { Product } from '../types';
import { matchProductWithBrandGuard } from './brandProductMatcher';

/**
 * Phonetic Soundex implementation for Indian retail speech
 * Maps consonants to phonetic codes so words that sound identical (e.g. meggi/maggi, solt/salt, kolgate/colgate)
 * produce matching sound signatures regardless of spelling or accent.
 */
export function getSoundex(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return '';

  const firstLetter = clean[0].toUpperCase();
  const map: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1', w: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6'
  };

  let soundex = firstLetter;
  let prevCode = map[clean[0]] || '';

  for (let i = 1; i < clean.length; i++) {
    const code = map[clean[i]];
    if (code) {
      if (code !== prevCode) {
        soundex += code;
        prevCode = code;
      }
    } else {
      prevCode = '';
    }
    if (soundex.length === 4) break;
  }

  while (soundex.length < 4) {
    soundex += '0';
  }

  return soundex;
}

/**
 * Normalized Levenshtein distance similarity (0.0 to 1.0)
 */
export function getLevenshteinSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1 === str2) return 1.0;
  if (!str1.length || !str2.length) return 0.0;

  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null)
  );

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = track[str2.length][str1.length];
  const maxLen = Math.max(str1.length, str2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Indian accent, slang, and dialect word mappings across all 4 languages (English, Telugu, Hindi, Kannada)
 */
export const ACCENT_SLANG_MAP: Record<string, string> = {
  // Brand normalizations (Crucial: Keep brands distinct!)
  'gayatri': 'gayatri',
  'gayatridevi': 'gayatri',
  'గాయత్రి': 'gayatri',
  'गायत्री': 'gayatri',
  'ಗಾಯತ್ರಿ': 'gayatri',
  'amul': 'amul',
  'ammul': 'amul',
  'అముల్': 'amul',
  'అమూల్': 'amul',
  'अमुल': 'amul',
  'अमूल': 'amul',
  'ಅಮುಲ್': 'amul',
  'ಅಮೂಲ್': 'amul',
  'heritage': 'heritage',
  'హెరిటేజ్': 'heritage',
  'nandini': 'nandini',
  'నందిని': 'nandini',
  'jersey': 'jersey',
  'జెర్సీ': 'jersey',
  'vijaya': 'vijaya',
  'విజయ': 'vijaya',

  // Common grocery mishearings & slang in Indian English / Hinglish / Tanglish / Kanglish
  'meggi': 'maggi',
  'meggie': 'maggi',
  'maggie': 'maggi',
  'maggy': 'maggi',
  'magic': 'maggi',
  'maggies': 'maggi',
  'మ్యాగీ': 'maggi',
  'मैगी': 'maggi',
  'ಮ್ಯಾಗಿ': 'maggi',
  'nudle': 'noodles',
  'nudles': 'noodles',
  'noodel': 'noodles',
  'నూడుల్స్': 'noodles',

  // Oil variations
  'all': 'oil',
  'al': 'oil',
  'hole': 'oil',
  'ill': 'oil',
  'oyil': 'oil',
  'aayil': 'oil',
  'ayil': 'oil',
  'oilu': 'oil',
  'tel': 'oil',
  'taila': 'oil',
  'nune': 'oil',
  'నూనె': 'oil',
  'తైలం': 'oil',
  'yenne': 'oil',
  'enne': 'oil',
  'ఎಣ್ಣೆ': 'oil',
  'तेल': 'oil',
  'ghee': 'ghee',
  'neyyi': 'ghee',
  'నెయ్యి': 'ghee',
  'घी': 'ghee',
  'ತುಪ್ಪ': 'ghee',

  // Biscuits variations
  'biskit': 'biscuits',
  'biskits': 'biscuits',
  'biskut': 'biscuits',
  'biskuts': 'biscuits',
  'biskoot': 'biscuits',
  'biscute': 'biscuits',
  'biscutes': 'biscuits',
  'bisket': 'biscuits',
  'బిస్కెట్లు': 'biscuits',
  'బిస్కెట్': 'biscuits',
  'బిస్కట్': 'biscuits',
  'बिस्कुट': 'biscuits',
  'बिस्किट': 'biscuits',
  'ಬಿಸ್ಕತ್ತು': 'biscuits',
  'parley': 'parle-g',
  'parly': 'parle-g',
  'palley': 'parle-g',
  'parleg': 'parle-g',
  'barley': 'parle-g',
  'పార్లే': 'parle-g',

  // Milk variations (Paalu in Telugu, Doodh in Hindi, Haalu in Kannada)
  'milku': 'milk',
  'melk': 'milk',
  'dudh': 'milk',
  'doodh': 'milk',
  'dudha': 'milk',
  'haalu': 'milk',
  'halu': 'milk',
  'paal': 'milk',
  'paalu': 'milk',
  'palu': 'milk',
  'పాలు': 'milk',
  'పాల': 'milk',
  'दूध': 'milk',
  'ಹಾಲು': 'milk',

  // Atta / Flour variations
  'aata': 'atta',
  'ata': 'atta',
  'attavu': 'atta',
  'gehun': 'atta',
  'godhuma': 'atta',
  'pindi': 'atta',
  'గోధుమ పిండి': 'atta',
  'పిండి': 'atta',
  'flour': 'atta',
  'आटा': 'atta',
  'ಹಿಟ್ಟು': 'atta',
  'ashirvad': 'aashirvaad',
  'ashirwaad': 'aashirvaad',
  'ashirwad': 'aashirvaad',
  'ఆశీర్వాద్': 'aashirvaad',

  // Salt variations
  'solt': 'salt',
  'sult': 'salt',
  'soltu': 'salt',
  'saltu': 'salt',
  'namak': 'salt',
  'uppu': 'salt',
  'ఉప్పు': 'salt',
  'नमक': 'salt',
  'ಉಪ್ಪು': 'salt',
  'tatasalt': 'tata salt',
  'tatasolt': 'tata salt',
  'టాటా': 'tata',

  // Bread variations
  'bred': 'bread',
  'bredu': 'bread',
  'double roti': 'bread',
  'loaf': 'bread',
  'bun': 'bread',
  'pao': 'bread',
  'pav': 'bread',
  'బ్రెడ్': 'bread',
  'రొట్టె': 'bread',
  'ब्रेड': 'bread',
  'ರೊಟ್ಟಿ': 'bread',

  // Drinks variations
  'coke': 'coca-cola',
  'koke': 'coca-cola',
  'koka kola': 'coca-cola',
  'coco cola': 'coca-cola',
  'cold drink': 'coca-cola',
  'కోకాకోలా': 'coca-cola',
  'thumbs up': 'thums up',
  'thumbsup': 'thums up',
  'thumps up': 'thums up',
  'tums up': 'thums up',
  'toofan': 'thums up',
  'థమ్స్ అప్': 'thums up',

  // Detergents variations
  'self excel': 'surf excel',
  'serve excel': 'surf excel',
  'surface cell': 'surf excel',
  'sarf excel': 'surf excel',
  'surf': 'surf excel',
  'sarf': 'surf excel',
  'washing powder': 'surf excel',
  'సర్ఫ్ ఎక్సెల్': 'surf excel',
  'సర్ఫ్': 'surf excel',

  // Toothpaste variations
  'kolgate': 'colgate',
  'kolgat': 'colgate',
  'colgat': 'colgate',
  'paste': 'colgate',
  'peyste': 'colgate',
  'toothpaste': 'colgate',
  'tooth paste': 'colgate',
  'dant manjan': 'colgate',
  'కోల్గేట్': 'colgate',

  // Soap variations
  'sope': 'soap',
  'soapu': 'soap',
  'sabun': 'soap',
  'sabbu': 'soap',
  'సబ్బు': 'soap',
  'సబ్బులు': 'soap',
  'साबुन': 'soap',
  'ಸೋಪು': 'soap',

  // Rice / Sugar / Tea
  'chawal': 'rice',
  'biyyam': 'rice',
  'akki': 'rice',
  'బియ్యం': 'rice',
  'चावल': 'rice',
  'ಅಕ್ಕಿ': 'rice',
  'chini': 'sugar',
  'cheeni': 'sugar',
  'sakkare': 'sugar',
  'panchadara': 'sugar',
  'chakkera': 'sugar',
  'పంచదార': 'sugar',
  'చక్కెర': 'sugar',
  'चीनी': 'sugar',
  'ಸಕ್ಕರೆ': 'sugar',
  'chai': 'tea',
  'cha': 'tea',
  'tea powder': 'tea',
  'టీ': 'tea',
  'టీ పొడి': 'tea',
  'చాయ్': 'tea',
  'चाय': 'tea',
  'ಚಹಾ': 'tea',

  // Packaging words
  'peket': 'packet',
  'peketu': 'packet',
  'peketlu': 'packets',
  'ప్యాకెట్': 'packet',
  'ప్యాకెట్లు': 'packets',
  'पैकेट': 'packet',
  'ಪ್ಯಾಕೆಟ್': 'packet',
};

/**
 * Multilingual Numbers & Homophones (English, Telugu, Hindi, Kannada)
 */
export const PHONETIC_NUMBERS: Record<string, number> = {
  // English words & common accented homophones
  'one': 1, 'won': 1, 'wan': 1, 'van': 1, 'single': 1,
  'two': 2, 'to': 2, 'too': 2, 'tu': 2, 'double': 2, 'couple': 2,
  'three': 3, 'tree': 3, 'tri': 3, 'free': 3,
  'four': 4, 'for': 4, 'fore': 4, 'foor': 4,
  'five': 5, 'fiv': 5, 'faiv': 5,
  'six': 6, 'sik': 6, 'siks': 6,
  'seven': 7, 'sevan': 7,
  'eight': 8, 'ate': 8, 'eyt': 8,
  'nine': 9, 'nain': 9,
  'ten': 10, 'den': 10, 'tan': 10,
  'eleven': 11, 'twelve': 12, 'dozen': 12, 'half dozen': 6,
  'fifteen': 15, 'twenty': 20, 'twenty five': 25, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100,

  // Telugu numbers (Script & Tanglish)
  'ఒకటి': 1, 'ఒక': 1, 'ఒకటే': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'నాలుగవ': 4,
  'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
  'పదకొండు': 11, 'పన్నెండు': 12, 'పదిహేను': 15, 'ఇరవై': 20, 'ముప్పై': 30, 'యాభై': 50, 'వంద': 100,
  'okati': 1, 'oka': 1, 'okate': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4,
  'aidu': 5, 'eidu': 5, 'aaru': 6, 'yedu': 7, 'elu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,
  'padakondu': 11, 'pennendu': 12, 'padiheynu': 15, 'iravai': 20, 'vanda': 100,

  // Hindi numbers (Script & Hinglish)
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'पंद्रह': 15, 'बीस': 20, 'पच्चीस': 25, 'पचास': 50, 'सौ': 100,
  'ek': 1, 'do': 2, 'teen': 3, 'tin': 3, 'char': 4, 'chaar': 4, 'paanch': 5, 'panch': 5,
  'chhe': 6, 'che': 6, 'saat': 7, 'sat': 7, 'aath': 8, 'ath': 8, 'nau': 9, 'das': 10,
  'gyarah': 11, 'barah': 12, 'pandrah': 15, 'bees': 20, 'pachees': 25, 'tees': 30, 'chalis': 40, 'pachaas': 50, 'sau': 100,

  // Kannada numbers (Script & Kanglish)
  'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5,
  'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10,
  'ಹನ್ನೆರಡು': 12, 'ಇಪ್ಪತ್ತು': 20, 'ಐವತ್ತು': 50, 'ನೂರು': 100,
  'ondu': 1, 'ondhu': 1, 'eradu': 2, 'mooru': 3, 'naalku': 4,
  'aivattu': 50, 'hattu': 10, 'ombattu': 9, 'entu': 8, 'nooru': 100
};

/**
 * Strips South Indian slang vowel endings (-u, -a, -i) for normalized matching
 * e.g. "milku" -> "milk", "bredu" -> "bread", "packetu" -> "packet", "oilu" -> "oil"
 */
export function stripRegionalSuffixes(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.length > 4 && (w.endsWith('u') || w.endsWith('i'))) {
    const candidate = w.slice(0, -1);
    if (['milk', 'bread', 'oil', 'salt', 'soap', 'packet', 'rice', 'coke', 'paste'].includes(candidate)) {
      return candidate;
    }
  }
  return w;
}

/**
 * Universal Speech Text Normalizer:
 * Takes raw transcript from any speech agent and normalizes slang, numbers, filler words, and phonetic variations.
 */
export function normalizeSlangSpeech(text: string): string {
  if (!text) return '';

  let normalized = ' ' + text.toLowerCase().trim() + ' ';

  // 1. Remove speech filler phrases and conversational slang
  const fillers = [
    /\b(?:please|plz|kripya|dayavittu|doyacheyisi)\b/gi,
    /\b(?:bhaiya|bhai|anna|boss|bro|sir|saar|ji|arey|yaar)\b/gi,
    /\b(?:konchem|zara|swalpa|thoda|thoda sa)\b/gi,
    /\b(?:i want|give me|de do|kodi|ivvandi|chahiye|kavali|beku|undi|hai|ide)\b/gi,
    /\b(?:to the bill|to bill|in the bill|in bill|into bill|onto bill|for the bill)\b/gi,
    /\b(?:bill lo veyyi|bill me daalo|bill me add karo|bill alli haaku|bill lo add cheyyi)\b/gi,
    /\b(?:to the cart|to cart|in cart|into cart)\b/gi
  ];
  fillers.forEach(regex => {
    normalized = normalized.replace(regex, ' ');
  });

  // 2. Map phonetic numbers when preceding a noun (e.g. "tree maggi" -> "3 maggi", "to bread" -> "2 bread")
  normalized = normalized.replace(/\b(?:to|too|tu)\b(?=\s+[a-z])/gi, ' 2 ');
  normalized = normalized.replace(/\b(?:tree|tri|free)\b(?=\s+[a-z])/gi, ' 3 ');
  normalized = normalized.replace(/\b(?:for|fore|foor)\b(?=\s+[a-z])/gi, ' 4 ');
  normalized = normalized.replace(/\b(?:won|wan|van)\b(?=\s+[a-z])/gi, ' 1 ');
  normalized = normalized.replace(/\b(?:ate|eyt)\b(?=\s+[a-z])/gi, ' 8 ');

  // 3. Convert multi-language number words (Unicode-safe for Telugu, Hindi, Kannada, and English)
  Object.entries(PHONETIC_NUMBERS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([word, num]) => {
      const isAscii = /^[a-z0-9\s-]+$/i.test(word);
      if (isAscii) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        normalized = normalized.replace(regex, ` ${num} `);
      } else {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9\u0C00-\u0C7F\u0900-\u097F\u0C80-\u0CFF])${escaped}($|\\s|[^a-zA-Z0-9\u0C00-\u0C7F\u0900-\u097F\u0C80-\u0CFF])`, 'g');
        normalized = normalized.replace(regex, `$1 ${num} $2`);
      }
    });

  // 4. Normalize slang words into canonical retail terminology
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const mappedTokens = tokens.map(token => {
    // Preserve English alphanumeric, hyphens, and Indic script characters (Telugu \u0C00-\u0C7F, Devanagari \u0900-\u097F, Kannada \u0C80-\u0CFF)
    const cleanToken = token.replace(/[^a-z0-9\-\u0C00-\u0C7F\u0900-\u097F\u0C80-\u0CFF]/gi, '');
    const stripped = stripRegionalSuffixes(cleanToken);
    return ACCENT_SLANG_MAP[cleanToken] || ACCENT_SLANG_MAP[stripped] || stripped;
  });

  return mappedTokens.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Intelligent Multi-Alternative Speech Extractor:
 * Web Speech API returns multiple interpretations in event.results[i] (alternatives 0, 1, 2, 3...).
 * This function inspects all alternatives against the shopkeeper's actual store products and picks
 * the alternative with the highest relevance to avoid accent misrecognition!
 */
export function extractBestSpeechAlternative(
  eventResults: any,
  knownProducts: Product[] = []
): { bestTranscript: string; allAlternatives: string[] } {
  const alternativesList: string[] = [];

  // 1. Gather all alternative combinations
  if (!eventResults || eventResults.length === 0) {
    return { bestTranscript: '', allAlternatives: [] };
  }

  // Build primary [0] transcript
  let primaryTranscript = '';
  for (let i = 0; i < eventResults.length; ++i) {
    const item = eventResults[i];
    if (item && item[0]?.transcript) {
      primaryTranscript += (primaryTranscript ? ' ' : '') + item[0].transcript.trim();
    }
  }

  alternativesList.push(primaryTranscript);

  // If there are multiple alternatives in the last result chunk, gather them
  for (let i = 0; i < eventResults.length; ++i) {
    const item = eventResults[i];
    for (let a = 1; a < Math.min(item.length, 5); a++) {
      if (item[a]?.transcript) {
        // Construct alternative full sentence
        let altSentence = '';
        for (let j = 0; j < eventResults.length; ++j) {
          if (j === i) {
            altSentence += (altSentence ? ' ' : '') + item[a].transcript.trim();
          } else {
            altSentence += (altSentence ? ' ' : '') + eventResults[j][0].transcript.trim();
          }
        }
        if (altSentence && !alternativesList.includes(altSentence)) {
          alternativesList.push(altSentence);
        }
      }
    }
  }

  if (knownProducts.length === 0 || alternativesList.length <= 1) {
    return {
      bestTranscript: primaryTranscript,
      allAlternatives: alternativesList
    };
  }

  // 2. Score each alternative against the shop's actual product catalog & numbers
  let bestScore = -1;
  let bestTranscript = primaryTranscript;

  const productNames = knownProducts.map(p => p.name.toLowerCase());
  const productTokens = productNames.flatMap(n => n.split(/\s+/)).filter(t => t.length > 2);

  alternativesList.forEach((rawAlt, index) => {
    const normalized = normalizeSlangSpeech(rawAlt);
    let score = 0;

    // Has numbers?
    if (/\b\d+\b/.test(normalized)) score += 20;

    // Direct product name match?
    for (const name of productNames) {
      if (normalized.includes(name)) {
        score += 50;
      }
    }

    // Token match?
    for (const token of productTokens) {
      if (normalized.includes(token)) {
        score += 15;
      }
    }

    // Common grocery keywords?
    const keywords = ['maggi', 'biscuit', 'milk', 'atta', 'salt', 'bread', 'oil', 'coke', 'surf', 'colgate', 'soap', 'packet'];
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        score += 15;
      }
    }

    // Primary alternative has a slight tie-breaker bias (+5)
    if (index === 0) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestTranscript = rawAlt;
    }
  });

  return {
    bestTranscript,
    allAlternatives: alternativesList
  };
}

/**
 * High-Tolerance Phonetic Product Matcher:
 * Matches any slang, accented, or mispronounced speech query against the shop's REAL inventory products.
 * Uses Brand-Guard to NEVER substitute different brands (e.g. Gayatri Milk vs Amul Milk).
 */
export function matchProductPhonetically(
  query: string,
  products: Product[]
): { product: Product; matchScore: number; reason: string } | null {
  if (!query || products.length === 0) return null;

  // 1. BRAND-GUARDED MATCHER (Strict Brand Differentiation)
  const brandGuarded = matchProductWithBrandGuard(query, products);
  if (brandGuarded.product) {
    return {
      product: brandGuarded.product,
      matchScore: brandGuarded.score,
      reason: brandGuarded.reason
    };
  }
  // If the user requested a specific brand that is not in inventory, REJECT immediately!
  // Never substitute a different brand like Amul Milk when the user asked for Gayatri Milk!
  if (brandGuarded.reason === 'BRAND_MISMATCH_REJECTED') {
    return null;
  }

  const rawQ = query.toLowerCase().trim();
  const normalizedQ = normalizeSlangSpeech(rawQ);

  // 2. Direct Exact or Substring match on product name
  for (const p of products) {
    const pName = p.name.toLowerCase();
    if (pName === rawQ || pName === normalizedQ) {
      return { product: p, matchScore: 1.0, reason: 'exact' };
    }
    if (pName.includes(normalizedQ) || normalizedQ.includes(pName)) {
      return { product: p, matchScore: 0.95, reason: 'substring' };
    }
  }

  // 3. Fuzzy Levenshtein Distance Matching
  let bestFuzzyProduct: Product | null = null;
  let highestSim = 0;

  for (const p of products) {
    const fullSim = getLevenshteinSimilarity(normalizedQ, p.name);
    if (fullSim > highestSim) {
      highestSim = fullSim;
      bestFuzzyProduct = p;
    }
  }

  if (bestFuzzyProduct && highestSim >= 0.72) {
    return { product: bestFuzzyProduct, matchScore: highestSim, reason: 'fuzzy' };
  }

  return null;
}
