import { Product } from '../types';

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
 * Indian accent, slang, and dialect word mappings
 */
export const ACCENT_SLANG_MAP: Record<string, string> = {
  // Common grocery mishearings & slang in Indian English / Hinglish / Tanglish / Kanglish
  'meggi': 'maggi',
  'meggie': 'maggi',
  'maggie': 'maggi',
  'maggy': 'maggi',
  'magic': 'maggi',
  'maggies': 'maggi',
  'nudle': 'noodles',
  'nudles': 'noodles',
  'noodel': 'noodles',

  // Oil variations (crucial: speech engines frequently hear "all" or "hole" when user says "oil" or "oyil")
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
  'yenne': 'oil',
  'enne': 'oil',
  'ghee': 'oil',

  // Biscuits variations
  'biskit': 'biscuits',
  'biskits': 'biscuits',
  'biskut': 'biscuits',
  'biskuts': 'biscuits',
  'biskoot': 'biscuits',
  'biscute': 'biscuits',
  'biscutes': 'biscuits',
  'bisket': 'biscuits',
  'parley': 'parle-g',
  'parly': 'parle-g',
  'palley': 'parle-g',
  'parleg': 'parle-g',
  'barley': 'parle-g',

  // Milk variations
  'milku': 'milk',
  'melk': 'milk',
  'dudh': 'milk',
  'doodh': 'milk',
  'dudha': 'milk',
  'haalu': 'milk',
  'paal': 'milk',
  'amul': 'amul milk',
  'ammul': 'amul milk',

  // Atta / Flour variations
  'aata': 'atta',
  'ata': 'atta',
  'attavu': 'atta',
  'gehun': 'atta',
  'godhuma': 'atta',
  'flour': 'atta',
  'ashirvad': 'aashirvaad',
  'ashirwaad': 'aashirvaad',
  'ashirwad': 'aashirvaad',

  // Salt variations
  'solt': 'salt',
  'sult': 'salt',
  'soltu': 'salt',
  'saltu': 'salt',
  'namak': 'salt',
  'uppu': 'salt',
  'tatasalt': 'tata salt',
  'tatasolt': 'tata salt',

  // Bread variations
  'bred': 'bread',
  'bredu': 'bread',
  'double roti': 'bread',
  'loaf': 'bread',
  'bun': 'bread',
  'pao': 'bread',
  'pav': 'bread',

  // Drinks variations
  'coke': 'coca-cola',
  'koke': 'coca-cola',
  'koka kola': 'coca-cola',
  'coco cola': 'coca-cola',
  'cold drink': 'coca-cola',
  'thumbs up': 'thums up',
  'thumbsup': 'thums up',
  'thumps up': 'thums up',
  'tums up': 'thums up',
  'toofan': 'thums up',

  // Detergents variations
  'self excel': 'surf excel',
  'serve excel': 'surf excel',
  'surface cell': 'surf excel',
  'sarf excel': 'surf excel',
  'surf': 'surf excel',
  'sarf': 'surf excel',
  'washing powder': 'surf excel',

  // Toothpaste variations
  'kolgate': 'colgate',
  'kolgat': 'colgate',
  'colgat': 'colgate',
  'paste': 'colgate',
  'peyste': 'colgate',
  'toothpaste': 'colgate',
  'tooth paste': 'colgate',
  'dant manjan': 'colgate',

  // Soap variations
  'sope': 'soap',
  'soapu': 'soap',
  'sabun': 'soap',

  // Rice / Sugar / Tea
  'chawal': 'rice',
  'biyyam': 'rice',
  'akki': 'rice',
  'chini': 'sugar',
  'cheeni': 'sugar',
  'sakkare': 'sugar',
  'panchadara': 'sugar',
  'chai': 'tea',
  'cha': 'tea',
  'tea powder': 'tea',
};

/**
 * Multilingual Numbers & Homophones (handles accents like "tree" for 3, "won/van" for 1, "for" for 4)
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

  // Hindi numbers
  'ek': 1, 'do': 2, 'teen': 3, 'tin': 3, 'char': 4, 'chaar': 4, 'paanch': 5, 'panch': 5,
  'chhe': 6, 'che': 6, 'saat': 7, 'sat': 7, 'aath': 8, 'ath': 8, 'nau': 9, 'das': 10,
  'gyarah': 11, 'barah': 12, 'pandrah': 15, 'bees': 20, 'pachees': 25, 'tees': 30, 'chalis': 40, 'pachaas': 50, 'sau': 100,

  // Telugu numbers
  'okati': 1, 'oka': 1, 'okate': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4,
  'aidu': 5, 'eidu': 5, 'aaru': 6, 'yedu': 7, 'elu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,
  'padakondu': 11, 'pennendu': 12, 'padiheynu': 15, 'iravai': 20, 'vanda': 100,

  // Kannada numbers
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

  // 3. Convert multi-language number words
  Object.entries(PHONETIC_NUMBERS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([word, num]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      normalized = normalized.replace(regex, ` ${num} `);
    });

  // 4. Normalize slang words into canonical retail terminology
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const mappedTokens = tokens.map(token => {
    const cleanToken = token.replace(/[^a-z0-9-]/gi, '');
    const stripped = stripRegionalSuffixes(cleanToken);
    return ACCENT_SLANG_MAP[stripped] || ACCENT_SLANG_MAP[cleanToken] || stripped;
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
 */
export function matchProductPhonetically(
  query: string,
  products: Product[]
): { product: Product; matchScore: number; reason: string } | null {
  if (!query || products.length === 0) return null;

  const rawQ = query.toLowerCase().trim();
  const normalizedQ = normalizeSlangSpeech(rawQ);

  // 1. Direct Exact or Substring match on product name
  for (const p of products) {
    const pName = p.name.toLowerCase();
    if (pName === rawQ || pName === normalizedQ) {
      return { product: p, matchScore: 1.0, reason: 'exact' };
    }
    if (pName.includes(normalizedQ) || normalizedQ.includes(pName)) {
      return { product: p, matchScore: 0.95, reason: 'substring' };
    }
  }

  // 2. Token-level Substring & Accent Match
  const qWords = normalizedQ.split(/\s+/).filter(w => w.length > 2 && !['packet', 'packets', 'pack', 'pcs', 'bottle'].includes(w));
  for (const p of products) {
    const pTokens = p.name.toLowerCase().split(/\s+/);
    for (const qw of qWords) {
      if (pTokens.some(pt => pt === qw || pt.includes(qw) || qw.includes(pt))) {
        return { product: p, matchScore: 0.85, reason: 'token_match' };
      }
    }
  }

  // 3. Phonetic Soundex Matching (sounds identical to ear)
  const qSoundexList = qWords.map(w => getSoundex(w));
  for (const p of products) {
    const pSoundexList = p.name.toLowerCase().split(/\s+/).map(w => getSoundex(w));
    for (const qs of qSoundexList) {
      if (pSoundexList.includes(qs)) {
        return { product: p, matchScore: 0.80, reason: 'soundex' };
      }
    }
  }

  // 4. Fuzzy Levenshtein Distance Matching (handles spelling variations, slang letters)
  let bestFuzzyProduct: Product | null = null;
  let highestSim = 0;

  for (const p of products) {
    // Compare full strings
    const fullSim = getLevenshteinSimilarity(normalizedQ, p.name);
    if (fullSim > highestSim) {
      highestSim = fullSim;
      bestFuzzyProduct = p;
    }

    // Compare with each word token
    const pTokens = p.name.toLowerCase().split(/\s+/);
    for (const qw of qWords) {
      for (const pt of pTokens) {
        const tokenSim = getLevenshteinSimilarity(qw, pt);
        if (tokenSim > highestSim) {
          highestSim = tokenSim;
          bestFuzzyProduct = p;
        }
      }
    }
  }

  // 70% similarity threshold accepts accents and slang while preventing false positives
  if (bestFuzzyProduct && highestSim >= 0.68) {
    return { product: bestFuzzyProduct, matchScore: highestSim, reason: 'fuzzy' };
  }

  return null;
}
