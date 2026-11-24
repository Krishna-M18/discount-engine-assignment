# ⚡ Discount Engine

### Intelligent Cart Pricing · AI-Powered Discount Rules · PDF Cart Processing

<p align="center">
  A full-stack discount calculation application that intelligently applies promotional offers, generates discount rules using natural language, and extracts shopping cart data from PDF files.
</p>

<p align="center">
  <a href="https://discount-engine-assignment-alpha.vercel.app/"><strong>🚀 Live Demo</strong></a>
  &nbsp; · &nbsp;
  <a href="https://www.loom.com/share/9c42afab65524fc8907b4d92cee47142"><strong>▶ Watch Walkthrough</strong></a>
  &nbsp; · &nbsp;
  <a href="https://github.com/Krishna-M18/discount-engine-assignment"><strong>💻 Source Code</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq_AI-F55036?style=for-the-badge&logo=groq&logoColor=white" />
</p>

---

## 📌 Overview

Discount Engine is a full-stack application developed as part of the **Opptra FDE Intern Assignment**.

It simplifies promotional pricing by evaluating multiple discount rules, selecting eligible offers, and calculating the final payable amount.

Beyond traditional discount calculations, the application introduces AI-powered rule creation through natural language and automated cart extraction from PDF documents.

**The goal:** Make discount calculations accurate, transparent, and easy to manage.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧮 Discount Engine | Calculates percentage-based and flat discounts. |
| 🏷️ Multiple Rule Scopes | Supports brand, platform, and cart-level offers. |
| 🔗 Stackable Discounts | Combines eligible stackable offers with the winning non-stackable offer. |
| 🛒 Cart-Level Offers | Applies discounts after item-level calculations and checks minimum cart value. |
| 🤖 AI Rule Generation | Converts plain-English instructions into structured discount rules using Groq AI. |
| ✅ Rule Confirmation | Allows users to review, confirm, or discard AI-generated rules. |
| 💬 Ambiguity Handling | Requests clarification for incomplete discount instructions. |
| 📄 PDF Cart Upload | Extracts product details and replaces the current cart. |
| 📊 Transparent Results | Displays final prices, savings, applied offers, and cart totals. |

---

## 🧠 How the Discount Engine Works

The engine follows a structured calculation process:

1. Identify all rules applicable to each cart item.
2. Compare eligible non-stackable rules and select the one providing the highest saving.
3. Apply eligible stackable discounts on top of the selected offer.
4. Retain the base price when no discount applies.
5. Calculate the subtotal after item-level discounts.
6. Check the minimum cart value condition.
7. Apply the eligible cart-level discount and calculate the final total.

### 🧾 Verified Sample Result

Using the assignment's sample cart and discount rules:

| Calculation | Amount |
|---|---:|
| Cart subtotal after item discounts | ₹5,932 |
| Cart-level discount (10%) | −₹593 |
| **Final cart total** | **₹5,339** |

<p align="center">
  <strong>🎯 Expected sample result successfully verified.</strong>
</p>

---

## 🤖 AI-Powered Discount Rule Creation

Users can describe promotions in plain English instead of manually creating structured rules.

**Example input:**

```text
Give 20% off on Natura Casa products,
stackable with other offers.
```

**Generated rule preview:**

| Property | Parsed Value |
|---|---|
| Scope | Brand |
| Applies To | Natura Casa |
| Discount Type | Percentage |
| Discount Value | 20% |
| Stackable | Yes |

The generated rule is added only after user confirmation.

The application also handles ambiguous instructions, such as:

```text
Give a discount for big orders.
```

Instead of generating an incomplete rule, the AI requests additional information.

---

## 🏗️ Application Architecture

```text
                 ┌──────────────────────┐
                 │         User         │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   React + Vite UI    │
                 └──────────┬───────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
     CSV Upload         PDF Upload        AI Rule Input
          │                 │                 │
          ▼                 ▼                 ▼
     CSV Parser        PDF Parser       Express Backend
          │                 │                 │
          │                 │                 ▼
          │                 │              Groq AI
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Discount Engine     │
                 │                      │
                 │  • Item Discounts    │
                 │  • Stackable Offers  │
                 │  • Cart Discounts    │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   Cart Summary       │
                 │   Final Price        │
                 │   Savings Breakdown  │
                 └──────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| AI Integration | Groq API |
| PDF Processing | pdfjs-dist |
| CSV Processing | PapaParse |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |

---

## 📂 Project Structure

```text
discount-engine-assignment/
│
├── server/
│   └── index.js
│
├── src/
│   ├── components/
│   ├── engine/
│   │   ├── csvParser.js
│   │   ├── discountEngine.js
│   │   └── pdfParser.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
│
├── sample-data/
│   ├── cart.csv
│   └── rules.csv
│
├── .env.example
├── .gitignore
├── package.json
└── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Groq API key for AI-powered rule generation

### Installation & Setup

**1. Clone the repository and install dependencies**

```bash
git clone https://github.com/Krishna-M18/discount-engine-assignment.git

cd discount-engine-assignment

npm install
```

**2. Configure environment variables**

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
```

Keep your actual API key private. Never commit `.env` to GitHub.

**3. Start the application**

Open two terminals in the project directory.

Frontend:

```bash
npm run dev
```

Backend:

```bash
node server/index.js
```

Open the application at:

```text
http://localhost:5173
```

---

## ⚙️ Environment Variables

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Authenticates requests to Groq AI. |
| `PORT` | Backend port. Defaults to `3001`. |
| `FRONTEND_URL` | Configures the permitted frontend origin for CORS. |

---

## 🌐 Live Deployment

| Service | Deployment |
|---|---|
| Frontend | [Vercel Application](https://discount-engine-assignment-alpha.vercel.app/) |
| Backend | [Render API](https://discount-engine-assignment-dk1r.onrender.com/health) |

---

## 🔮 Potential Improvements

- Automated unit and integration testing.
- More advanced discount conditions.
- Improved malformed PDF handling.
- Additional discount analytics and reporting.

---

## 👨‍💻 Author

**Krishna M18**

Developed as part of the **Opptra FDE Intern Assignment**.

<p align="left">
  <a href="https://github.com/Krishna-M18">
    <img src="https://img.shields.io/badge/GitHub-Krishna--M18-181717?style=for-the-badge&logo=github" />
  </a>
  <a href="https://www.loom.com/share/9c42afab65524fc8907b4d92cee47142">
    <img src="https://img.shields.io/badge/Watch-Demo-625DF5?style=for-the-badge&logo=loom&logoColor=white" />
  </a>
</p>

---

<p align="center">
  <strong>Built with curiosity, engineering, and a focus on practical problem-solving.</strong>
  <br/>
  ⭐ Thank you for visiting this project!
</p>
