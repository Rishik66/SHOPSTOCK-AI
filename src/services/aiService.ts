import { Product, Transaction, Language, AIAction, UserAccount } from '../types';
import { tr } from '../i18n';
import { normalizeSlangSpeech, matchProductPhonetically } from './speechAccentService';
import { matchProductWithBrandGuard } from './brandProductMatcher';

export interface AIResponse {
  text: string;
  action?: AIAction;
  source?: 'gemini' | 'local';
}

const GEMINI_API_KEY_STORAGE = 'ss_gemini_api_key';
const DEFAULT_GEMINI_KEY_B64 = 'QVEuQWI4Uk42TGlYQVZkS20tSi04VWdHa0sxODBGaGNzUmNycy1wTnZjQlRJczg1NTZXVlE=';

function getDefaultKey(): string {
  try {
    if (typeof atob === 'function') {
      return atob(DEFAULT_GEMINI_KEY_B64);
    }
  } catch {}
  return '';
}

export const GEMINI_CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

/**
 * Retrieves the active Gemini API key (localStorage override > env key > default key)
 */
export function getGeminiApiKey(): string {
  try {
    const local = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (local && local.trim()) return local.trim();
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
    return getDefaultKey();
  } catch {
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || getDefaultKey();
  }
}

/**
 * Saves the Gemini API key to localStorage
 */
export function setGeminiApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    }
  } catch (e) {
    console.warn('Failed to save Gemini API key:', e);
  }
}

/**
 * Checks whether Real AI (Gemini) is configured with an API key
 */
export function isRealAIConfigured(): boolean {
  return !!getGeminiApiKey().trim();
}

/**
 * Tests a Gemini API key with a fast ping request
 */
export async function testGeminiApiKey(key: string): Promise<{ success: boolean; message: string }> {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { success: false, message: 'Please enter a valid Gemini API key.' };
  }

  const models = GEMINI_CANDIDATE_MODELS;
  let lastError = '';

  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: ACTIVE' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.candidates && data.candidates.length > 0) {
          return { success: true, message: `Connected successfully to Google Gemini (${model}) Real-Time AI!` };
        }
      } else {
        const err = await res.json().catch(() => null);
        lastError = err?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: any) {
      lastError = err?.message || 'Network error connecting to Gemini API.';
    }
  }

  return { success: false, message: `Gemini API Error: ${lastError}` };
}

function findProduct(name: string, products: Product[]): Product | null {
  const q = name.toLowerCase().trim();
  if (!q || products.length === 0) return null;

  // 1. BRAND-GUARD MATCH FIRST: strictly prevents brand collision (e.g. Gayatri vs Amul)
  const brandGuarded = matchProductWithBrandGuard(q, products);
  if (brandGuarded.product) return brandGuarded.product;
  if (brandGuarded.reason === 'BRAND_MISMATCH_REJECTED') {
    // Brand conflict! The user requested e.g. Gayatri Milk, but store only has Amul Milk.
    // Strictly reject so token or generic matches don't falsely return Amul Milk!
    return null;
  }

  // 2. Direct exact match
  const exact = products.find(p => p.name.toLowerCase() === q);
  if (exact) return exact;

  // 3. Phonetic Soundex & fuzzy similarity match for accents and slang
  const phonetic = matchProductPhonetically(q, products);
  if (phonetic) return phonetic.product;

  // 4. Prefix or substring match only if no brand conflict
  const direct = products.find(p => 
    p.name.toLowerCase().startsWith(q) || 
    q.startsWith(p.name.toLowerCase())
  );
  if (direct) return direct;

  return null;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTodaySales(transactions: Transaction[]): { total: number; profit: number } {
  const today = getTodayStr();
  const todayTxns = transactions.filter(t => t.date.slice(0, 10) === today);
  return {
    total: todayTxns.reduce((s, t) => s + t.total, 0),
    profit: todayTxns.reduce((s, t) => s + t.profit, 0),
  };
}

function getBestSellers(transactions: Transaction[]): { name: string; qty: number }[] {
  const map: Record<string, { name: string; qty: number }> = {};
  transactions.forEach(t => {
    t.items.forEach(item => {
      if (!map[item.productId]) map[item.productId] = { name: item.productName, qty: 0 };
      map[item.productId].qty += item.quantity;
    });
  });
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
}

function getLeastSellers(products: Product[], transactions: Transaction[]): { name: string; qty: number }[] {
  if (transactions.length === 0) return [];
  const map: Record<string, { name: string; qty: number }> = {};
  products.forEach(p => {
    map[p.id] = { name: p.name, qty: 0 };
  });
  transactions.forEach(t => {
    t.items.forEach(item => {
      if (!map[item.productId]) map[item.productId] = { name: item.productName, qty: 0 };
      map[item.productId].qty += item.quantity;
    });
  });
  return Object.values(map).sort((a, b) => a.qty - b.qty).slice(0, 5);
}

/**
 * Builds rich, real-time store context to feed into the Gemini LLM
 */
function buildStoreContext(
  products: Product[],
  transactions: Transaction[],
  language: Language,
  currentUser?: UserAccount | null
): string {
  const shopName = currentUser?.shopName || 'ShopStock Store';
  const ownerName = currentUser?.ownerName || 'Store Owner';
  const category = currentUser?.category || 'Retail / Kirana General Store';

  const today = getTodayStr();
  const todayTxns = transactions.filter(t => t.date.slice(0, 10) === today);
  const todaySales = todayTxns.reduce((s, t) => s + t.total, 0);
  const todayProfit = todayTxns.reduce((s, t) => s + t.profit, 0);
  const totalSales = transactions.reduce((s, t) => s + t.total, 0);
  const totalProfit = transactions.reduce((s, t) => s + t.profit, 0);

  // Sales map for best & slow sellers
  const salesMap: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
  products.forEach(p => {
    salesMap[p.id] = { name: p.name, qty: 0, revenue: 0, profit: 0 };
  });
  transactions.forEach(t => {
    t.items.forEach(item => {
      if (!salesMap[item.productId]) {
        salesMap[item.productId] = { name: item.productName, qty: 0, revenue: 0, profit: 0 };
      }
      salesMap[item.productId].qty += item.quantity;
      salesMap[item.productId].revenue += item.sellingPrice * item.quantity;
      salesMap[item.productId].profit += (item.sellingPrice - item.purchasePrice) * item.quantity;
    });
  });

  const productList = Object.entries(salesMap);
  const bestSellers = [...productList].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const leastSellers = [...productList].sort((a, b) => a[1].qty - b[1].qty).slice(0, 5);
  const lowStock = products.filter(p => p.stock <= p.minimumStock);
  const outOfStock = products.filter(p => p.stock === 0);

  const catalogSummary = products.slice(0, 25).map(p => 
    `- ${p.name} (${p.category}): Stock: ${p.stock}, Cost: ₹${p.purchasePrice}, Sell: ₹${p.sellingPrice}, Min: ${p.minimumStock}, Margin: ${Math.round(((p.sellingPrice - p.purchasePrice) / (p.sellingPrice || 1)) * 100)}%`
  ).join('\n');

  const langInstruction: Record<Language, string> = {
    en: 'Respond in clean, friendly English.',
    te: 'Respond in natural, fluent Telugu script (తెలుగు). Use clear retail terminology.',
    hi: 'Respond in natural, fluent Hindi script (हिन्दी). Use clear retail terminology.',
    kn: 'Respond in natural, fluent Kannada script (ಕನ್ನಡ). Use clear retail terminology.'
  };

  return `You are "SmartStock AI", an intelligent, empathetic, and experienced retail business advisor and co-pilot for Indian kirana / general retail stores.
You are interacting directly with the store owner in a real-time conversational chat.

STORE PROFILE:
- Shop Name: "${shopName}"
- Owner Name: "${ownerName}"
- Business Category: "${category}"
- Target Language: ${langInstruction[language]}

CURRENT LIVE METRICS:
- Total Products in Catalog: ${products.length}
- Today's Sales: ₹${todaySales} (${todayTxns.length} orders today)
- Today's Profit: ₹${todayProfit}
- Total Lifetime Revenue: ₹${totalSales} (${transactions.length} total orders)
- Total Lifetime Profit: ₹${totalProfit}
- Low Stock Items (${lowStock.length}): ${lowStock.map(p => `${p.name} (Qty: ${p.stock}, Min: ${p.minimumStock})`).join(', ') || 'None (Healthy)'}
- Out of Stock Items (${outOfStock.length}): ${outOfStock.map(p => p.name).join(', ') || 'None'}
- Top Best Sellers: ${bestSellers.map(s => `${s[1].name} (${s[1].qty} sold, ₹${s[1].revenue} rev)`).join(', ') || 'No sales recorded yet'}
- Slow-Moving / Least Sellers: ${leastSellers.map(s => `${s[1].name} (${s[1].qty} sold)`).join(', ') || 'None'}

STORE CATALOG HIGHLIGHTS:
${catalogSummary || 'Catalog empty'}

CRITICAL INSTRUCTIONS:
1. Act like a true retail consultant and co-pilot. You are not a generic bot.
2. When asked about improving sales, increasing profits, slow moving items, customer footfall, marketing, or business health:
   - DEEPLY analyze the real numbers given above.
   - Mention actual product names from their inventory!
   - Suggest concrete combo bundle ideas (e.g. bundle a popular item with a slow mover at a small discount).
   - Suggest eye-level counter placement for high-margin products.
   - Point out items running low on stock so the shopkeeper does not lose revenue due to stockouts.
   - Give practical tips on WhatsApp broadcasts, neighborhood customer credit (khata) reminders, and peak evening hours (6 PM - 9 PM) promotions.
3. If the user asks general store questions, business questions, or casual conversation, answer naturally, accurately, and politely.
4. If the user explicitly asks to add or remove stock (e.g., "Add 10 Maggi" or "Remove 2 Parle-G"), reply helpfully AND append an action tag at the very end of your response on a new line:
   [ACTION: {"type": "ADD_STOCK" | "REMOVE_STOCK", "productName": "Exact Product Name", "quantity": number}]
5. Keep answers well-formatted with bullet points, bold key terms, and rupee (₹) amounts so it is easy to read on mobile.
6. ACCENT, SLANG & SPEECH RECOGNITION TOLERANCE: The user speaks Indian English, Hinglish, Tanglish (Tamil+English), Kanglish (Kannada+English), or regional Indian languages. Their speech may be transcribed with regional accents, phonetic spelling (e.g., 'all' for 'oil', 'meggi' for 'maggi', 'biskut' for 'biscuit', 'milku' for 'milk', 'bredu' for 'bread', 'solt' for 'salt', 'self excel' for 'surf excel', 'kolgate' for 'colgate', 'tree' for 'three', 'won' for 'one'). Always understand their underlying intent regardless of dialect, slang, regional vowel suffixes (-u, -i), or dropped syllables.
7. BRAND DIFFERENTIATION & CATALOG INTEGRITY: Keep different brands of the same product type STRICTLY separate! For example, 'Gayatri Milk', 'Amul Milk', 'Heritage Milk', and 'Nandini Milk' are distinct products and distinct brands. NEVER confuse or substitute one brand for another. If a customer or shopkeeper asks about 'Gayatri Milk' and the catalog only lists 'Amul Milk', clearly state that Gayatri Milk is not in stock and note that Amul Milk is available.
8. FULL MULTILINGUAL SUPPORT (Telugu, Hindi, Kannada, English): The user may speak or write in Telugu (తెలుగు), Hindi (हिन्दी), Kannada (ಕನ್ನಡ), or English, including Romanized transliterations (Tanglish, Hinglish, Kanglish). Always understand their query in any of these languages and respond fluently in the requested target language.`;
}

/**
 * Calls Google Gemini REST API
 */
async function callGeminiAPI(
  query: string,
  products: Product[],
  transactions: Transaction[],
  language: Language,
  currentUser?: UserAccount | null,
  chatHistory?: { role: 'user' | 'assistant'; text: string }[]
): Promise<AIResponse> {
  const apiKey = getGeminiApiKey().trim();
  if (!apiKey) {
    throw new Error('No Gemini API key configured.');
  }

  const systemPrompt = buildStoreContext(products, transactions, language, currentUser);

  const contents: any[] = [];
  if (chatHistory && chatHistory.length > 0) {
    chatHistory.slice(-5).forEach(msg => {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      });
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: query }]
  });

  const body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 950
    }
  };

  const models = GEMINI_CANDIDATE_MODELS;
  let rawText = '';
  let lastError = '';

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );

      if (response.ok) {
        const data = await response.json();
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) break;
      } else {
        const err = await response.json().catch(() => null);
        lastError = err?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (e: any) {
      lastError = e?.message || 'Network request error';
    }
  }

  if (!rawText) {
    throw new Error(lastError || 'Empty response from Gemini.');
  }

  // Parse any action tag: [ACTION: {"type": "ADD_STOCK", ...}]
  const actionMatch = rawText.match(/\[ACTION:\s*({.*?})\]/i);
  let parsedAction: AIAction | undefined;
  let cleanText = rawText;

  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1]);
      const product = findProduct(parsed.productName || '', products);
      const qty = parseInt(parsed.quantity);
      if (product && qty > 0) {
        if (parsed.type === 'ADD_STOCK') {
          parsedAction = {
            type: 'ADD_STOCK',
            productId: product.id,
            productName: product.name,
            quantity: qty,
            currentStock: product.stock,
            newStock: product.stock + qty
          };
        } else if (parsed.type === 'REMOVE_STOCK') {
          parsedAction = {
            type: 'REMOVE_STOCK',
            productId: product.id,
            productName: product.name,
            quantity: Math.min(qty, product.stock),
            currentStock: product.stock,
            newStock: Math.max(0, product.stock - qty)
          };
        }
      }
    } catch (e) {
      console.warn('Action parse error:', e);
    }
    cleanText = rawText.replace(/\[ACTION:\s*{.*?}\]/gi, '').trim();
  }

  // Fallback regex detection for stock command if model omitted the action tag
  if (!parsedAction) {
    const directAction = detectStockAction(query, products);
    if (directAction) {
      parsedAction = directAction;
    }
  }

  return {
    text: cleanText,
    action: parsedAction,
    source: 'gemini'
  };
}

/**
 * Detects add/remove stock commands via regex
 */
function detectStockAction(query: string, products: Product[]): AIAction | null {
  const q = query.toLowerCase().trim();

  // ADD_STOCK intent
  const addMatch = q.match(/(?:add|jodo|seri|chalao|daalo|kalupu|veyyi|జోడించు|కలుపు|వేయి|जोड़ो|डालो|ಸೇರಿಸಿ)\s+(\d+)\s+(.+)/i) ||
                   q.match(/(\d+)\s+(.+?)\s+(?:add|jodo|seri|daalo|kalupu|veyyi|జోడించు|కలుపు|వేయి|जोड़ो|डालो|ಸೇರಿಸಿ)/i) ||
                   q.match(/(\d+)\s+(.+?)\s+(?:joḍisu|joḍi)/i);
  if (addMatch) {
    const qty = parseInt(addMatch[1]);
    const productQuery = addMatch[2].trim();
    const product = findProduct(productQuery, products);
    if (product && qty > 0) {
      return {
        type: 'ADD_STOCK',
        productId: product.id,
        productName: product.name,
        quantity: qty,
        currentStock: product.stock,
        newStock: product.stock + qty
      };
    }
  }

  // REMOVE_STOCK intent
  const removeMatch = q.match(/(?:remove|hatao|teesey|tisey|nikalo|తీసివేయి|తొలగించు|हटाओ|निकाले|ತೆಗೆದುಹಾಕಿ)\s+(\d+)\s+(.+)/i) ||
                      q.match(/(\d+)\s+(.+?)\s+(?:remove|hatao|teesey|nikalo|తీసివేయి|తొలగించు|हटाओ|ತೆಗೆದುಹಾಕಿ)/i);
  if (removeMatch) {
    const qty = parseInt(removeMatch[1]);
    const productQuery = removeMatch[2].trim();
    const product = findProduct(productQuery, products);
    if (product && qty > 0) {
      return {
        type: 'REMOVE_STOCK',
        productId: product.id,
        productName: product.name,
        quantity: Math.min(qty, product.stock),
        currentStock: product.stock,
        newStock: Math.max(0, product.stock - qty)
      };
    }
  }

  return null;
}

/**
 * Generates data-driven retail improvement ideas from the shopkeeper's actual numbers
 */
function generateRetailSalesInsights(
  products: Product[],
  transactions: Transaction[],
  language: Language,
  currentUser?: UserAccount | null
): string {
  const shopName = currentUser?.shopName || 'Your Store';
  const today = getTodayStr();
  const todayTxns = transactions.filter(t => t.date.slice(0, 10) === today);
  const todaySales = todayTxns.reduce((s, t) => s + t.total, 0);
  const todayProfit = todayTxns.reduce((s, t) => s + t.profit, 0);
  const totalSales = transactions.reduce((s, t) => s + t.total, 0);

  const bestSellers = getBestSellers(transactions);
  const leastSellers = getLeastSellers(products, transactions);
  const lowStock = products.filter(p => p.stock <= p.minimumStock);
  const highMargin = [...products]
    .sort((a, b) => ((b.sellingPrice - b.purchasePrice) / (b.sellingPrice || 1)) - ((a.sellingPrice - a.purchasePrice) / (a.sellingPrice || 1)))
    .slice(0, 3);

  const topItem = bestSellers[0]?.name || 'your popular grocery items';
  const slowItem = leastSellers[0]?.name || 'slow-moving items';
  const marginItem = highMargin[0]?.name || 'packaged goods';
  const lowItem = lowStock[0]?.name || null;

  if (language === 'te') {
    return `📊 **${shopName} సేల్స్ విశ్లేషణ & వ్యాపార అభివృద్ధి సూచనలు:**

• **నేటి అమ్మకాలు:** ₹${todaySales} (లాభం: ₹${todayProfit}) | మొత్తం అమ్మకాలు: ₹${totalSales}
• **అత్యధికంగా అమ్ముడవుతున్నవి:** ${bestSellers.map(b => b.name).slice(0, 3).join(', ') || 'డేటా లేదు'}
• **తక్కువగా అమ్ముడవుతున్నవి:** ${leastSellers.map(l => l.name).slice(0, 3).join(', ') || 'డేటా లేదు'}

💡 **సేల్స్ పెంచడానికి 4 ప్రాక్టికల్ ఐడియాలు:**
1. **స్మార్ట్ కాంబో ఆఫర్:** ఎక్కువ డిమాండ్ ఉన్న **${topItem}** తో నెమ్మదిగా అమ్ముడవుతున్న **${slowItem}** కలిపి ₹5 నుండి ₹10 తగ్గింపుతో కాంబో ప్యాక్‌గా అమ్మండి. దీనివల్ల డెడ్ స్టాక్ వెంటనే క్లియర్ అవుతుంది.
2. **హై-మార్జిన్ ప్రొడక్ట్స్ డిస్ప్లే:** మంచి లాభం ఇచ్చే **${marginItem}** ను కౌంటర్ దగ్గర, కస్టమర్ల కంటికి కనిపించేలా ఉంచండి (ఇంపల్స్ బైయింగ్ పెరుగుతుంది).
3. **స్టాకౌట్ కాకుండా చూడండి:** ${lowItem ? `మీ వద్ద **${lowItem}** స్టాక్ తక్కువగా ఉంది.` : 'తక్కువ స్టాక్ ఉన్న వస్తువులను వెంటనే రీస్టాక్ చేయండి.'} కస్టమర్లు కోరిన వస్తువు లేకపోతే పక్క షాపుకు వెళ్ళిపోతారు.
4. **వాట్సాప్ అప్‌డేట్స్:** స్థానిక కస్టమర్లతో వాట్సాప్ గ్రూప్ చేసి కొత్తగా వచ్చిన వస్తువుల సమాచారం అందించండి.

*(💡 గమనిక: సెట్టింగ్స్‌లో Google Gemini API Key కనెక్ట్ చేస్తే మీరు రియల్-టైమ్‌లో ఎలాంటి ప్రశ్న అయినా అడగవచ్చు!)*`;
  }

  if (language === 'hi') {
    return `📊 **${shopName} बिक्री विश्लेषण और व्यापार बढ़ाने के सुझाव:**

• **आज की बिक्री:** ₹${todaySales} (मुनाफा: ₹${todayProfit}) | कुल बिक्री: ₹${totalSales}
• **सबसे ज्यादा बिकने वाले सामान:** ${bestSellers.map(b => b.name).slice(0, 3).join(', ') || 'डेटा उपलब्ध नहीं'}
• **धीमी बिक्री वाले सामान:** ${leastSellers.map(l => l.name).slice(0, 3).join(', ') || 'डेटा उपलब्ध नहीं'}

💡 **बिक्री और मुनाफा बढ़ाने के 4 उपाय:**
1. **स्मार्ट कॉम्बो ऑफर:** सबसे ज्यादा बिकने वाले **${topItem}** के साथ धीमी बिक्री वाले **${slowItem}** को जोड़कर ₹5–₹10 की छूट पर कॉम्बो बनाएं। इससे रुका हुआ स्टॉक तेजी से बिकेगा।
2. **काउंटर पर सही डिस्प्ले:** सबसे अधिक मार्जिन देने वाले **${marginItem}** को बिलिंग काउंटर के पास रखें ताकि ग्राहक बिल बनवाते समय तुरंत खरीद लें।
3. **स्टॉक की कमी से बचें:** ${lowItem ? `आपके पास **${lowItem}** का स्टॉक कम है।` : 'कम स्टॉक वाले सामान को तुरंत ऑर्डर करें।'} सामान न मिलने पर ग्राहक दूसरी दुकान पर चले जाते हैं।
4. **ग्राहक संपर्क (WhatsApp):** नियमित ग्राहकों का व्हाट्सएप ब्रॉडकास्ट बनाकर नए स्टॉक और वीकेंड ऑफर्स की जानकारी दें।

*(💡 सुझाव: सेटिंग्स में Google Gemini API Key जोड़कर आप रियल-टाइम चैटबॉट से कुछ भी पूछ सकते हैं!)*`;
  }

  if (language === 'kn') {
    return `📊 **${shopName} ಮಾರಾಟ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ವ್ಯಾಪಾರ ವೃದ್ಧಿ ಸಲಹೆಗಳು:**

• **ಇಂದಿನ ಮಾರಾಟ:** ₹${todaySales} (ಲಾಭ: ₹${todayProfit}) | ಒಟ್ಟು ಮಾರಾಟ: ₹${totalSales}
• **ಅತಿ ಹೆಚ್ಚು ಮಾರಾಟವಾದವು:** ${bestSellers.map(b => b.name).slice(0, 3).join(', ') || 'ಲಭ್ಯವಿಲ್ಲ'}
• **ಕಡಿಮೆ ಮಾರಾಟವಾದವು:** ${leastSellers.map(l => l.name).slice(0, 3).join(', ') || 'ಲಭ್ಯವಿಲ್ಲ'}

💡 **ಮಾರಾಟ ಹೆಚ್ಚಿಸಲು 4 ಪ್ರಾಯೋಗಿಕ ಐಡಿಯಾಗಳು:**
1. **ಸ್ಮಾರ್ಟ್ ಕಾಂಬೊ ಆಫರ್:** ಹೆಚ್ಚು ಬೇಡಿಕೆಯಿರುವ **${topItem}** ಜೊತೆಗೆ ನಿಧಾನವಾಗಿ ಮಾರಾಟವಾಗುವ **${slowItem}** ಅನ್ನು ಸೇರಿಸಿ ₹5-₹10 ರಿಯಾಯಿತಿಯೊಂದಿಗೆ ಕಾಂಬೊ ಪ್ಯಾಕ್ ಮಾಡಿ.
2. **ಕೌಂಟರ್ ಪ್ರದರ್ಶನ:** ಹೆಚ್ಚು ಲಾಭ ತರುವ **${marginItem}** ಅನ್ನು ಬಿಲ್ಲಿಂಗ್ ಕೌಂಟರ್ ಬಳಿ ಪ್ರದರ್ಶಿಸಿ.
3. **ಸ್ಟಾಕ್ ಕೊರತೆ ತಪ್ಪಿಸಿ:** ${lowItem ? `ನಿಮ್ಮ ಬಳಿ **${lowItem}** ದಾಸ್ತಾನು ಕಡಿಮೆಯಾಗಿದೆ.` : 'ಕಡಿಮೆ ಇರುವ ಸರಕುಗಳನ್ನು ಕೂಡಲೇ ರಿಸ್ಟಾಕ್ ಮಾಡಿ.'}
4. **ಗ್ರಾಹಕರ ಸಂಪರ್ಕ:** ಗ್ರಾಹಕರಿಗೆ ವಾಟ್ಸಾಪ್ ಮೂಲಕ ಹೊಸ ಸರಕುಗಳ ಮಾಹಿತಿ ನೀಡಿ.

*(💡 ಸಲಹೆ: ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ Google Gemini API Key ಸೇರಿಸುವ ಮೂಲಕ ರಿಯಲ್-ಟೈಮ್ AI ಚಾಟ್‌ಬಾಟ್ ಬಳಸಬಹುದು!)*`;
  }

  return `📊 **Sales Analysis & Actionable Growth Ideas for ${shopName}:**

• **Today's Sales:** ₹${todaySales} (Profit: ₹${todayProfit}) across ${todayTxns.length} orders
• **Top Selling Items:** ${bestSellers.map(b => b.name).slice(0, 3).join(', ') || 'No transaction records yet'}
• **Slow-Moving Items:** ${leastSellers.map(l => l.name).slice(0, 3).join(', ') || 'None recorded'}
• **High-Margin Products:** ${highMargin.map(h => `${h.name} (~${Math.round(((h.sellingPrice - h.purchasePrice)/(h.sellingPrice||1))*100)}%)`).join(', ')}

💡 **4 Practical Growth Strategies to Boost Your Sales:**
1. **Smart Combo Bundling:** Pair your #1 best seller (**${topItem}**) with your slowest mover (**${slowItem}**) at a ₹5 to ₹10 bundle discount. Shoppers coming in for ${topItem} will gladly pick up ${slowItem}, immediately freeing up trapped capital.
2. **Prime Counter Placement:** Put your highest margin item (**${marginItem}**) right at eye-level near the cash counter. Keep low-margin staple items at the back so customers walk past high-margin impulse items.
3. **Prevent Lost Revenue from Stockouts:** ${lowItem ? `You are running critically low on **${lowItem}**.` : 'Ensure fast-selling essentials never hit 0 stock.'} In retail, 25% of customers go to a rival kirana store if their preferred item is unavailable.
4. **WhatsApp Customer Broadcast:** Create a broadcast list for local neighborhood families and announce fresh weekly arrivals or bundle deals every Friday evening.

*(💡 Pro-Tip: You can connect your free Google Gemini API key in Settings > AI Assistant to chat in real-time about any retail question!)*`;
}

/**
 * Local AI Query Processor (Fallback and Zero-Config Engine)
 */
function processQueryLocal(
  query: string,
  products: Product[],
  transactions: Transaction[],
  language: Language,
  currentUser?: UserAccount | null
): AIResponse {
  const rawQ = query.toLowerCase().trim();
  const q = normalizeSlangSpeech(rawQ);

  // GREETINGS (English, Telugu, Hindi, Kannada)
  if (['hello', 'hi', 'hey', 'namaste', 'namaskaram', 'namaskara', 'good morning', 'good evening', 'good afternoon', 'నమస్కారం', 'హలో', 'నమస్తే', 'नमस्ते', 'प्रणाम', 'ನಮಸ್ಕಾರ'].some(g => q === g || q.startsWith(g + ' ') || q.endsWith(' ' + g))) {
    return { text: tr(language, 'ai_greeting'), source: 'local' };
  }

  // HELP / CAPABILITIES
  if (q.includes('help') || q.includes('what can you do') || q.includes('kya kar sakte') || q.includes('em cheyaglavu') || q.includes('సహాయం') || q.includes('ఏమి చేయగలవు') || q.includes('మదత్') || q.includes('मदद') || q.includes('ಏನು ಮಾಡಬಹುದು')) {
    const helpMsg = language === 'te' 
      ? 'నేను మీకు స్టాక్ లెక్కింపు, నేటి అమ్మకాలు, లాభాలు, బెస్ట్ సెల్లర్లు, అమ్మకాలు పెంచే ఐడియాలు మరియు స్టాక్ జోడించడంలో సహాయం చేయగలను. ఉదాహరణకు: "అమ్మకాలు పెంచడం ఎలా?", "గాయత్రి పాలు ఎంత ఉన్నాయి?", "స్టాక్ ఎంత ఉంది?", లేదా "నేటి అమ్మకాలు".'
      : language === 'hi'
      ? 'मैं आपको स्टॉक की जांच, आज की बिक्री, लाभ, बेस्ट सेलर, बिक्री बढ़ाने के उपाय और स्टॉक जोड़ने/हटाने में मदद कर सकता हूँ। उदाहरण: "बिक्री कैसे बढ़ाएं?", "अमूल दूध कितना है?", या "आज की बिक्री"।'
      : language === 'kn'
      ? 'ನಾನು ನಿಮಗೆ ದಾಸ್ತಾನು ಪರಿಶೀಲನೆ, ಮಾರಾಟ, ಲಾಭ, ಮಾರಾಟ ಹೆಚ್ಚಿಸುವ ಸಲಹೆಗಳು ಮತ್ತು ಸರಕು ಸೇರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ಉದಾ: "ಮಾರಾಟ ಹೆಚ್ಚಿಸುವುದು ಹೇಗೆ?", "ಇಂದಿನ ಮಾರಾಟ".'
      : 'I can help you check product stock, analyze sales, suggest strategies to improve your profits, view top sellers, or add/remove stock. Try asking: "How to improve sales?", "Which products are low in stock?", or "How many Gayatri Milk do I have?".';
    return { text: helpMsg, source: 'local' };
  }

  // SALES IMPROVEMENT & BUSINESS GROWTH IDEAS
  if (
    q.includes('improve sales') || 
    q.includes('increase sales') || 
    q.includes('boost sales') || 
    q.includes('sales ideas') || 
    q.includes('more customers') || 
    q.includes('increase profit') || 
    q.includes('analyze sales') || 
    q.includes('analyse sales') || 
    q.includes('business advice') || 
    q.includes('how to improve') ||
    q.includes('ammakalu penchadam') ||
    q.includes('bikri kaise badhaye') ||
    q.includes('marata hecchisu') ||
    q.includes('అమ్మకాలు పెంచడం ఎలా') ||
    q.includes('అమ్మకాలు పెంచు') ||
    q.includes('వ్యాపారం') ||
    q.includes('बिक्री कैसे बढ़ाएं') ||
    q.includes('मुनाफा कैसे बढ़ाएं') ||
    q.includes('ಮಾರಾಟ ಹೆಚ್ಚಿಸುವುದು ಹೇಗೆ')
  ) {
    return {
      text: generateRetailSalesInsights(products, transactions, language, currentUser),
      source: 'local'
    };
  }

  // ADD_STOCK intent
  const addAction = detectStockAction(query, products);
  if (addAction && addAction.type === 'ADD_STOCK') {
    return {
      text: tr(language, 'ai_addConfirm', { 
        name: addAction.productName, 
        qty: addAction.quantity, 
        current: addAction.currentStock, 
        new: addAction.newStock 
      }),
      action: addAction,
      source: 'local'
    };
  }

  // REMOVE_STOCK intent
  if (addAction && addAction.type === 'REMOVE_STOCK') {
    if (addAction.quantity > addAction.currentStock) {
      return { 
        text: tr(language, 'ai_insufficientStock', { 
          name: addAction.productName, 
          qty: addAction.quantity, 
          current: addAction.currentStock 
        }),
        source: 'local'
      };
    }
    return {
      text: tr(language, 'ai_removeConfirm', { 
        name: addAction.productName, 
        qty: addAction.quantity, 
        current: addAction.currentStock, 
        new: addAction.newStock 
      }),
      action: addAction,
      source: 'local'
    };
  }

  // TODAY_PROFIT
  if (
    q.includes('profit') || q.includes('labham') || q.includes('munafa') || q.includes('laabha') || q.includes('laabham') ||
    q.includes('లాభం') || q.includes('నేటి లాభం') || q.includes('मुनाफा') || q.includes('लाभ') || q.includes('ಇಂದಿನ ಲಾಭ') || q.includes('ಲಾಭ')
  ) {
    const { profit } = getTodaySales(transactions);
    if (profit === 0 && transactions.filter(t => t.date.slice(0,10) === getTodayStr()).length === 0) {
      return { text: tr(language, 'ai_noSalesToday'), source: 'local' };
    }
    return { text: tr(language, 'ai_todayProfit', { amount: profit }), source: 'local' };
  }

  // TODAY_SALES
  if (
    q.includes('today') || q.includes('sales') || q.includes('aaj') || q.includes('neti') || q.includes('indina') || q.includes('ammakalu') || q.includes('sell') || q.includes('vikray') ||
    q.includes('అమ్మకాలు') || q.includes('నేటి అమ్మకాలు') || q.includes('बिक्री') || q.includes('आज की बिक्री') || q.includes('ಮಾರಾಟ') || q.includes('ಇಂದಿನ ಮಾರಾಟ')
  ) {
    const { total } = getTodaySales(transactions);
    if (total === 0 && transactions.filter(t => t.date.slice(0,10) === getTodayStr()).length === 0) {
      return { text: tr(language, 'ai_noSalesToday'), source: 'local' };
    }
    return { text: tr(language, 'ai_todaySales', { amount: total }), source: 'local' };
  }

  // BEST_SELLERS
  if (
    q.includes('best') || q.includes('most sold') || q.includes('popular') || q.includes('top') ||
    q.includes('బెస్ట్') || q.includes('ఎక్కువగా అమ్ముడైన') || q.includes('बेस्ट') || q.includes('ಹೆಚ್ಚು ಮಾರಾಟ')
  ) {
    const sellers = getBestSellers(transactions);
    if (sellers.length === 0) return { text: tr(language, 'ai_noSalesData'), source: 'local' };
    const list = sellers.map((s, i) => `${i + 1}. ${s.name} — ${s.qty} units`).join('\n');
    return { text: `${tr(language, 'ai_bestSellers')}\n${list}`, source: 'local' };
  }

  // LEAST_SELLERS
  if (
    q.includes('least') || q.includes('slow') || q.includes('worst') || q.includes('kam bikne') || q.includes('takkuva ammudav') || q.includes('kadime maratav') ||
    q.includes('తక్కువగా అమ్ముడైన') || q.includes('कम बिकने') || q.includes('ಕಡಿಮೆ ಮಾರಾಟ')
  ) {
    const least = getLeastSellers(products, transactions);
    if (least.length === 0) return { text: tr(language, 'noLeastSelling'), source: 'local' };
    const list = least.map((s, i) => `${i + 1}. ${s.name} — ${s.qty} units`).join('\n');
    return { text: `${tr(language, 'leastSelling')}:\n${list}`, source: 'local' };
  }

  // LOW_STOCK
  if (
    q.includes('low stock') || q.includes('low') || q.includes('kam stock') || q.includes('takkuva') || q.includes('kaḍime') || q.includes('restock needed') ||
    q.includes('తక్కువ స్టాక్') || q.includes('తక్కువ') || q.includes('స్టాక్ తక్కువ') || q.includes('కనిష్ట స్టాక్') || q.includes('कम स्टॉक') || q.includes('ಕಡಿಮೆ ಸ್ಟಾಕ್')
  ) {
    const lowItems = products.filter(p => p.stock <= p.minimumStock);
    if (lowItems.length === 0) return { text: tr(language, 'ai_noLowStock'), source: 'local' };
    const list = lowItems.map(p => `• ${p.name}: ${p.stock} units (min: ${p.minimumStock})`).join('\n');
    return { text: `${tr(language, 'ai_lowStockList')}\n${list}`, source: 'local' };
  }

  // RESTOCK
  if (
    q.includes('restock') || q.includes('order') || q.includes('buy more') || q.includes('what should') || q.includes('kya order') ||
    q.includes('రీస్టాక్') || q.includes('ఆర్డర్') || q.includes('కొత్త స్టాక్') || q.includes('రీస్టాకింగ్') || q.includes('रीस्टॉक') || q.includes('ಆರ್ಡರ್')
  ) {
    const urgent = products
      .filter(p => p.stock <= p.minimumStock * 1.5)
      .sort((a, b) => (a.stock / a.minimumStock) - (b.stock / b.minimumStock))
      .slice(0, 5);
    if (urgent.length === 0) return { text: tr(language, 'ai_noLowStock'), source: 'local' };
    const list = urgent.map(p => `• ${p.name}: Stock ${p.stock}, recommend ordering ${Math.max(p.minimumStock * 2 - p.stock, 10)}`).join('\n');
    return { text: `${tr(language, 'ai_restockSuggestion')}\n${list}\n\n${tr(language, 'rst_estimated')}`, source: 'local' };
  }

  // CHECK_STOCK (Strict Brand-Guarded Product Stock Lookup)
  const brandGuardedStock = matchProductWithBrandGuard(rawQ, products) || matchProductWithBrandGuard(q, products);
  if (brandGuardedStock.product) {
    return { 
      text: tr(language, 'ai_stockResponse', { name: brandGuardedStock.product.name, count: brandGuardedStock.product.stock }), 
      source: 'local' 
    };
  }

  // If the user requested a specific brand that does NOT exist (e.g. Gayatri Milk when store only has Amul Milk):
  if (brandGuardedStock.reason === 'BRAND_MISMATCH_REJECTED') {
    const reqBrand = brandGuardedStock.requestedBrand 
      ? brandGuardedStock.requestedBrand.charAt(0).toUpperCase() + brandGuardedStock.requestedBrand.slice(1) 
      : '';
    const reqItem = brandGuardedStock.requestedItem 
      ? brandGuardedStock.requestedItem.charAt(0).toUpperCase() + brandGuardedStock.requestedItem.slice(1) 
      : 'Product';
    const fullName = `${reqBrand} ${reqItem}`.trim();
    const conflicting = brandGuardedStock.conflictingProducts || [];

    let msg = '';
    if (language === 'te') {
      msg = `"${fullName}" మీ ఇన్వెంటరీలో లేదు.${conflicting.length > 0 ? ` ప్రస్తుతం స్టాక్‌లో ఉన్నవి: ${conflicting.map(p => `${p.name} (${p.stock} యూనిట్లు)`).join(', ')}.` : ''}`;
    } else if (language === 'hi') {
      msg = `"${fullName}" आपकी इन्वेंटरी में नहीं है।${conflicting.length > 0 ? ` वर्तमान में उपलब्ध: ${conflicting.map(p => `${p.name} (${p.stock} यूनिट)`).join(', ')}।` : ''}`;
    } else if (language === 'kn') {
      msg = `"${fullName}" ನಿಮ್ಮ ಇನ್ವೆಂಟರಿಯಲ್ಲಿ ಇಲ್ಲ.${conflicting.length > 0 ? ` ಪ್ರಸ್ತುತ ಲಭ್ಯವಿರುವುದು: ${conflicting.map(p => `${p.name} (${p.stock} ಯುನಿಟ್)`).join(', ')}.` : ''}`;
    } else {
      msg = `"${fullName}" is not in your inventory.${conflicting.length > 0 ? ` In stock: ${conflicting.map(p => `${p.name} (${p.stock} units)`).join(', ')}.` : ''}`;
    }

    return { text: msg, source: 'local' };
  }

  // Direct exact product name lookup if no brand conflict
  for (const product of products) {
    if (q === product.name.toLowerCase() || q.includes(product.name.toLowerCase())) {
      return { text: tr(language, 'ai_stockResponse', { name: product.name, count: product.stock }), source: 'local' };
    }
  }

  // Find product via findProduct (which also has brand-guard protection)
  const pFound = findProduct(rawQ, products) || findProduct(q, products);
  if (pFound) {
    return { text: tr(language, 'ai_stockResponse', { name: pFound.name, count: pFound.stock }), source: 'local' };
  }

  return { 
    text: `${tr(language, 'ai_unknown')}\n\n💡 *Tip: You can ask me "How to improve sales?", "స్టాక్ ఎంత ఉంది?", or connect a free Google Gemini API key for real-time open conversational answers!*`, 
    source: 'local' 
  };
}

/**
 * Main AI Query Entry Point: Calls Google Gemini LLM if configured; otherwise uses smart local engine
 */
export async function processQuery(
  query: string,
  products: Product[],
  transactions: Transaction[],
  language: Language,
  currentUser?: UserAccount | null,
  chatHistory?: { role: 'user' | 'assistant'; text: string }[]
): Promise<AIResponse> {
  const normalizedQuery = normalizeSlangSpeech(query);

  // If Google Gemini is configured and we are online, call real Gemini AI!
  if (isRealAIConfigured() && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      return await callGeminiAPI(normalizedQuery, products, transactions, language, currentUser, chatHistory);
    } catch (err: any) {
      console.warn('Gemini API call notice, falling back to local retail engine:', err?.message);
    }
  }

  // Fallback to local intelligent retail business intelligence engine
  return processQueryLocal(normalizedQuery, products, transactions, language, currentUser);
}
