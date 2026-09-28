# 🛒 SHOPSTOCK AI

> **"Scan. Speak. Sell. ShopStock handles the rest."**

An AI-powered, multi-language inventory management, POS billing, and smart restocking assistant designed specifically for small Indian grocery/general-store (Kirana) owners.

---

## 🌟 Key Features

- **📊 Real-time Dashboard**: Today's sales, profit margins, active product counts, low-stock alerts, 7-day revenue trend charts (Recharts), best-sellers, and recent transactions.
- **📦 Inventory Management**: Add, edit, delete, and search products with automated unit profit and margin calculation. Color-coded stock level indicators (🔴 Low Stock / 🟢 In Stock).
- **🧾 POS Billing**: Fast point-of-sale checkout with instant stock deduction, prevention of overselling, automated profit calculations, and print-ready digital receipts.
- **🤖 Conversational AI Shop Assistant**: Natural language voice and text queries for checking stock levels, sales, and profits. Supports voice-guided stock adjustments with explicit user confirmation.
- **📦 Smart Restock**: Automated calculation of average daily sales and days of remaining stock. Classifies urgency (Urgent, Soon, Healthy) and generates one-click copyable supplier order lists.
- **📷 Invoice Scanner (Demo OCR)**: Camera / image upload simulation that extracts line items from paper invoices and adds quantities directly into inventory upon review.
- **🌐 4 Indian Languages (i18n)**: Full UI localization for **English**, **Telugu (తెలుగు)**, **Hindi (हिन्दी)**, and **Kannada (ಕನ್ನಡ)** with instant switching.
- **🎙️ Voice Assistant**: Web Speech API integration (`SpeechRecognition` & `SpeechSynthesis`) localized for Indian accents (`en-IN`, `te-IN`, `hi-IN`, `kn-IN`).
- **💾 LocalStorage Persistence**: 100% client-side persistence—no external database setup required. Comes pre-populated with realistic demo data for *Ravi General Store*.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Running Locally

```bash
# Clone the repository
git clone https://github.com/Rishik66/SHOPSTOCK-AI.git

# Navigate into the project folder
cd SHOPSTOCK-AI

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be live at `http://localhost:5173/`.

### Production Build

```bash
npm run build
```

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 8
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Voice APIs**: Web Speech API (`webkitSpeechRecognition` / `speechSynthesis`)
- **Persistence**: Browser LocalStorage

---

## 📄 License

MIT License. Built for hackathons and local retail empowerment.
