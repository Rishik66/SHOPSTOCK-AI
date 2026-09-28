import { Product, Transaction, Language, AIAction } from '../types';
import { tr } from '../i18n';

export interface AIResponse {
  text: string;
  action?: AIAction;
}

function findProduct(name: string, products: Product[]): Product | null {
  const q = name.toLowerCase().trim();
  return products.find(p => 
    p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())
  ) || products.find(p => 
    p.name.toLowerCase().split(' ').some(w => q.includes(w) && w.length > 3)
  ) || null;
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

export function processQuery(
  query: string,
  products: Product[],
  transactions: Transaction[],
  language: Language
): AIResponse {
  const q = query.toLowerCase().trim();

  // GREETINGS
  if (['hello', 'hi', 'hey', 'namaste', 'namaskaram', 'namaskara', 'good morning', 'good evening', 'good afternoon'].some(g => q === g || q.startsWith(g + ' ') || q.endsWith(' ' + g))) {
    return { text: tr(language, 'ai_greeting') };
  }

  // HELP / CAPABILITIES
  if (q.includes('help') || q.includes('what can you do') || q.includes('kya kar sakte') || q.includes('em cheyaglavu')) {
    const helpMsg = language === 'te' 
      ? 'నేను మీకు స్టాక్ లెక్కింపు, నేటి అమ్మకాలు, లాభాలు, బెస్ట్ సెల్లర్లు మరియు స్టాక్ జోడించడంలో సహాయం చేయగలను. ఉదాహరణకు: "How many Maggi do I have?" లేదా "Today sales".'
      : language === 'hi'
      ? 'मैं आपको स्टॉक की जांच, आज की बिक्री, लाभ, सबसे ज्यादा बिकने वाले सामान और स्टॉक जोड़ने/हटाने में मदद कर सकता हूँ। उदाहरण: "How many Maggi do I have?" या "Today sales"।'
      : language === 'kn'
      ? 'ನಾನು ನಿಮಗೆ ದಾಸ್ತಾನು ಪರಿಶೀಲನೆ, ಇಂದಿನ ಮಾರಾಟ, ಲಾಭ ಮತ್ತು ದಾಸ್ತಾನು ಸೇರಿಸಲು/ತೆಗೆದುಹಾಕಲು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ಉದಾಹರಣೆಗೆ: "How many Maggi do I have?" ಅಥವಾ "Today sales".'
      : 'I can help you check product stock, view today\'s sales and profits, see top sellers, or add/remove stock. Try asking: "How many Maggi do I have?", "Today sales", or "Add 10 Maggi".';
    return { text: helpMsg };
  }

  // ADD_STOCK intent
  const addMatch = q.match(/(?:add|jodo|seri|chalao)\s+(\d+)\s+(.+)/i) ||
                   q.match(/(\d+)\s+(.+?)\s+(?:add|jodo|seri)/i) ||
                   q.match(/(\d+)\s+(.+?)\s+(?:joḍisu|joḍi)/i);
  if (addMatch) {
    const qty = parseInt(addMatch[1]);
    const productQuery = addMatch[2].trim();
    const product = findProduct(productQuery, products);
    if (product && qty > 0) {
      const action: AIAction = {
        type: 'ADD_STOCK',
        productId: product.id,
        productName: product.name,
        quantity: qty,
        currentStock: product.stock,
        newStock: product.stock + qty,
      };
      return {
        text: tr(language, 'ai_addConfirm', { name: product.name, qty, current: product.stock, new: product.stock + qty }),
        action,
      };
    }
  }

  // REMOVE_STOCK intent
  const removeMatch = q.match(/(?:remove|hatao|teesey|tisey)\s+(\d+)\s+(.+)/i) ||
                      q.match(/(\d+)\s+(.+?)\s+(?:remove|hatao|teesey)/i);
  if (removeMatch) {
    const qty = parseInt(removeMatch[1]);
    const productQuery = removeMatch[2].trim();
    const product = findProduct(productQuery, products);
    if (product && qty > 0) {
      if (qty > product.stock) {
        return { text: tr(language, 'ai_insufficientStock', { name: product.name, qty, current: product.stock }) };
      }
      const action: AIAction = {
        type: 'REMOVE_STOCK',
        productId: product.id,
        productName: product.name,
        quantity: qty,
        currentStock: product.stock,
        newStock: product.stock - qty,
      };
      return {
        text: tr(language, 'ai_removeConfirm', { name: product.name, qty, current: product.stock, new: product.stock - qty }),
        action,
      };
    }
  }

  // TODAY_PROFIT
  if (q.includes('profit') || q.includes('labham') || q.includes('munafa') || q.includes('laabha') || q.includes('laabham')) {
    const { profit } = getTodaySales(transactions);
    if (profit === 0 && transactions.filter(t => t.date.slice(0,10) === getTodayStr()).length === 0) {
      return { text: tr(language, 'ai_noSalesToday') };
    }
    return { text: tr(language, 'ai_todayProfit', { amount: profit }) };
  }

  // TODAY_SALES
  if (q.includes('today') || q.includes('sales') || q.includes('aaj') || q.includes('neti') || q.includes('indina') || q.includes('ammakalu') || q.includes('sell') || q.includes('vikray')) {
    const { total } = getTodaySales(transactions);
    if (total === 0 && transactions.filter(t => t.date.slice(0,10) === getTodayStr()).length === 0) {
      return { text: tr(language, 'ai_noSalesToday') };
    }
    return { text: tr(language, 'ai_todaySales', { amount: total }) };
  }

  // BEST_SELLERS
  if (q.includes('best') || q.includes('most sold') || q.includes('popular') || q.includes('top')) {
    const sellers = getBestSellers(transactions);
    if (sellers.length === 0) return { text: tr(language, 'ai_noSalesData') };
    const list = sellers.map((s, i) => `${i + 1}. ${s.name} — ${s.qty} units`).join('\n');
    return { text: `${tr(language, 'ai_bestSellers')}\n${list}` };
  }

  // LOW_STOCK
  if (q.includes('low stock') || q.includes('low') || q.includes('kam stock') || q.includes('takkuva') || q.includes('kaḍime') || q.includes('restock needed')) {
    const lowItems = products.filter(p => p.stock <= p.minimumStock);
    if (lowItems.length === 0) return { text: tr(language, 'ai_noLowStock') };
    const list = lowItems.map(p => `• ${p.name}: ${p.stock} units (min: ${p.minimumStock})`).join('\n');
    return { text: `${tr(language, 'ai_lowStockList')}\n${list}` };
  }

  // RESTOCK
  if (q.includes('restock') || q.includes('order') || q.includes('buy more') || q.includes('what should') || q.includes('kya order')) {
    const urgent = products
      .filter(p => p.stock <= p.minimumStock * 1.5)
      .sort((a, b) => (a.stock / a.minimumStock) - (b.stock / b.minimumStock))
      .slice(0, 5);
    if (urgent.length === 0) return { text: tr(language, 'ai_noLowStock') };
    const list = urgent.map(p => `• ${p.name}: Stock ${p.stock}, recommend ordering ${Math.max(p.minimumStock * 2 - p.stock, 10)}`).join('\n');
    return { text: `${tr(language, 'ai_restockSuggestion')}\n${list}\n\n${tr(language, 'rst_estimated')}` };
  }

  // CHECK_STOCK (for specific product)
  for (const product of products) {
    if (q.includes(product.name.toLowerCase()) || product.name.toLowerCase().split(' ').some(w => w.length > 3 && q.includes(w.toLowerCase()))) {
      return { text: tr(language, 'ai_stockResponse', { name: product.name, count: product.stock }) };
    }
  }

  // Generic product search
  const words = q.split(' ').filter(w => w.length > 3);
  for (const word of words) {
    const p = findProduct(word, products);
    if (p) return { text: tr(language, 'ai_stockResponse', { name: p.name, count: p.stock }) };
  }

  return { text: tr(language, 'ai_unknown') };
}
