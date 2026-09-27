<div align="center">

# 🍰 Sarah's Bakery

**A live-priced cake storefront for a home bakery in Dhaka, built with plain HTML, CSS and vanilla JavaScript.**

A complete shop experience with no framework and no build step: a product catalog streamed from Google Sheets, a persistent cart, bKash / Nagad / COD checkout, order tracking, and a printable invoice. Five static pages, one JavaScript file, one stylesheet.

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css&logoColor=white)](https://developer.mozilla.org/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Google Apps Script](https://img.shields.io/badge/Google_Apps_Script-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://script.google.com)
[![Google Sheets](https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=googlesheets&logoColor=white)](https://sheets.google.com)
[![Font Awesome](https://img.shields.io/badge/Font_Awesome-528DD7?style=for-the-badge&logo=fontawesome&logoColor=white)](https://fontawesome.com)
![No Build Step](https://img.shields.io/badge/Build_Step-None-8A7563?style=for-the-badge)

Repo: [Mahmudul-Hasan-Shawon/Latest-Sarahs-Bakery](https://github.com/Mahmudul-Hasan-Shawon/Latest-Sarahs-Bakery)

</div>

---

## ✨ Features

### 🛍️ Storefront & Catalog

| Feature | Details |
| --- | --- |
| Live catalog | Products, prices, stock and site config load from a Google Apps Script endpoint ([assets/site.js](assets/site.js)) |
| Category pills | Built dynamically from the product data; footer category links too |
| Search | Matches title, brand, category and SKU, with a "Clear Filter" chip |
| Brand & category panels | Slide-in side panels fed by the mobile bottom nav |
| Stock awareness | In Stock / Low Stock (threshold 10) / Out of Stock tags, discount % badges, quantity clamped to real stock |
| Product modal | Image, SKU, size description, discount badge, qty stepper capped at stock |
| Hero | Auto-scrolling cake image marquee, floating petals, spark particles, count-up stats |
| Fallback images | Keyword-based Unsplash fallbacks per flavor (cheesecake, cupcake, red velvet...) plus an `onerror` safety net |

### 🛒 Cart & Checkout

| Feature | Details |
| --- | --- |
| Persistent cart | Lives in `localStorage` (`sgc_cart`); survives reloads and private-mode failures gracefully |
| Cart reconciliation | On every catalog load, deleted products are dropped, prices refreshed, quantities clamped, and the customer notified via toast |
| Flicker-free updates | Quantity changes patch a single cart row instead of re-rendering the list |
| Delivery zones | Inside Dhaka (Ashkona / Uttara area, ৳60 default) and Outside Dhaka (৳120 default), driven by backend config |
| Payment methods | Cash On Delivery, bKash, Nagad; mobile wallet orders require account number + transaction ID |
| Validation | Required fields, phone digit count, address length, wallet details, inline error display |
| WhatsApp integration | Config-driven `wa.me` deep links; Bangladeshi numbers normalized to international format automatically |

### 📦 Orders, Tracking & Invoicing

| Feature | Details |
| --- | --- |
| Order placement | Posted to Apps Script; returns an order number and a tracking code |
| Success screen | Confetti burst, both codes, and a fallback note if the confirmation email failed |
| Order tracking | Lookup by order ID or tracking code; six-step timeline (Processing, Confirmed, Packed, Shipped, Out for Delivery, Delivered) plus a Cancelled state |
| Printable invoice | Client-rendered invoice that mirrors the backend PDF field for field; print CSS targets only the invoice |
| Silent refresh | Stock levels re-fetch after an order so a just-placed order is reflected immediately |

### 📄 Pages

| Page | Contents |
| --- | --- |
| [index.html](index.html) | Hero, live shop grid, cart drawer, checkout, tracking, invoice |
| [about.html](about.html) | The bakery's story and values |
| [gallery.html](gallery.html) | Filterable cake gallery (All, Birthday, Wedding, Cheesecake, Cupcakes, Custom) |
| [faq.html](faq.html) | Accordion FAQ with 8 answers |
| [contact.html](contact.html) | Contact details, hours and a validated contact form |

Every page shares the same navbar, cart drawer, Track Order modal, mobile bottom nav and footer.

### 💎 Polish & Accessibility

| Detail | Where |
| --- | --- |
| `prefers-reduced-motion` disables animations, confetti and count-ups site-wide | [assets/site.js](assets/site.js) |
| `Escape` closes only the topmost overlay, never everything at once | keydown handler |
| All external data (titles, addresses, categories) is HTML-escaped before `innerHTML` | `esc()` / `jsStr()` helpers |
| Background scroll locks while any drawer or modal is open | `syncOverlayLock()` |
| Reveal-on-scroll, fly-to-cart animation, toast notifications, scroll progress bar, back-to-top | IntersectionObserver + CSS |
| Semantic buttons, ARIA labels, `role="alert"` error regions, `aria-live` toast | throughout the markup |

---

## 🏗️ Architecture

```
┌──────────────────────────── BROWSER ────────────────────────────┐
│                                                                 │
│  index.html  about.html  gallery.html  faq.html  contact.html   │
│       └──────────┴───────────┴───────────┴──────────┘           │
│                     assets/site.js                              │
│   (catalog, cart, checkout, tracking, invoice, UI effects)      │
│                     assets/styles.css                           │
│   (design tokens, layout, animations, print styles)             │
└──────────────┬───────────────────────────────┬──────────────────┘
               │ fetch (JSON)                  │ deep links
               ▼                               ▼
    Google Apps Script Web App       wa.me / tel: links
    (Code.gs, lives outside this     (WhatsApp chat,
     repo; URL set in site.js)        phone orders)
         │                │
         ▼                ▼
   Google Sheets      Gmail + PDF
   (products,         (order emails,
    orders)            invoices)
```

The frontend is 100% static: open it from any web server and it works. All dynamic behavior flows through one endpoint, `API_URL` in [assets/site.js](assets/site.js), which fronts a Google Spreadsheet. The spreadsheet is the CMS (products, prices, stock, currency symbol, payment account numbers, delivery charges) and the order database at the same time. Orders trigger server-side confirmation emails and a PDF invoice generated in `Code.gs`.

A few decisions worth knowing before you touch the code:

- **No CORS preflight:** the order POST deliberately sends no `Content-Type` header, which keeps it a "simple" request. Apps Script web apps cannot answer `OPTIONS` requests, so avoiding the preflight is what makes checkout work at all.
- **Locale-proof money formatting:** amounts are formatted with a hand-rolled `money()` function instead of `toLocaleString()`, so a phone set to Bangla still shows Latin numerals matching the emailed invoice.
- **Cart is a client-side cache:** because `localStorage` can hold deleted, repriced or sold-out items, `reconcileCart()` runs after every catalog fetch and quietly repairs the bag.

---

## 📁 Project Structure

```
Sarah Bakery/
├── index.html          # Storefront: hero, live shop, checkout, tracking, invoice
├── about.html          # Story + values (reuses cart/tracking overlays)
├── gallery.html        # Filterable cake gallery
├── faq.html            # Accordion FAQ
├── contact.html        # Contact info + form
├── assets/
│   ├── site.js         # All behavior: catalog, cart, orders, tracking, UI FX
│   └── styles.css      # Design system: tokens, layout, animations, print CSS
└── .vscode/
    └── settings.json   # Live Server port (5501)
```

No `package.json`, no dependencies, no bundler, no test suite. The backend (`Code.gs` + Google Sheet) is maintained separately and is not in this repository.

---

## 🧰 Tech Stack

| Layer | Technology |
| --- | --- |
| Markup | HTML5, 5 hand-written pages |
| Styling | CSS3: custom properties, grid/flex, keyframe animations, print stylesheet (~4,800 lines) |
| Behavior | Vanilla JavaScript (ES5-friendly, no libraries, ~950 lines) |
| Backend | Google Apps Script Web App (JSON over `fetch`) |
| Database | Google Sheets: catalog + orders |
| Fonts | Cormorant Garamond, Manrope, Cinzel, Bodoni Moda, Hind Siliguri (Google Fonts) |
| Icons | Font Awesome 6.5.2 (CDN) |
| Storage | `localStorage` for the cart |
| Dev server | VS Code Live Server extension |

---

## 🚀 Getting Started

### Prerequisites

- Any modern browser
- A static file server for local development (the stylesheet is linked as `/assets/styles.css`, so opening `index.html` directly via `file://` will not load it)
- The catalog, checkout and tracking features need the Google Apps Script endpoint to be reachable; `API_URL` is set at the top of [assets/site.js](assets/site.js)

### Install

Nothing to install. Clone and serve:

```bash
git clone https://github.com/Mahmudul-Hasan-Shawon/Latest-Sarahs-Bakery.git
cd Latest-Sarahs-Bakery
```

### Run locally

Pick any one option:

```bash
# Option A: VS Code Live Server (configured for port 5501)
# Install the Live Server extension, then: right-click index.html > Open with Live Server

# Option B: Python
python -m http.server 8000

# Option C: Node
npx serve .
```

| Service | URL | Notes |
| --- | --- | --- |
| Storefront | `http://127.0.0.1:5501` (Live Server) or `http://localhost:8000` | Serve the repo root |
| Backend | `script.google.com/.../exec` | Remote Apps Script endpoint, hardcoded in `site.js` |

### First-run notes

- The product grid fetches `?action=getAll` on load; a slow connection shows a spinner, a failure shows a retry-friendly error box.
- Add to cart, browse and gallery work even if the backend is down; only checkout and tracking need it.
- Currency (৳ by default), delivery charges and bKash/Nagad account numbers all come from the backend `config` payload, so the frontend needs no edits to rebrand.

There are no typecheck, lint or test commands: the project has no toolchain.

---

## 📦 Deployment

The site is pure static files, so any static host works:

1. Upload or push the folder as-is (no build step).
2. Serve it from a **domain root**. Asset links are root-absolute (`/assets/styles.css`, `/assets/site.js`), so hosting under a subpath (e.g. `user.github.io/repo-name/`) requires changing those links to relative paths first.
3. Verify `API_URL` in [assets/site.js](assets/site.js) points at the Apps Script deployment you intend to use; each Apps Script "Deploy" creates a new URL.
4. Orders, stock changes and confirmation emails flow through the Apps Script project + Google Sheet, which are administered outside this repo.

---

## 🔌 Backend API Overview

All calls go to `API_URL` (the Apps Script web app). The frontend's calls are:

| Action | Method | Used by | Returns |
| --- | --- | --- | --- |
| `getAll` | GET | Homepage load | `{ products: [...], config: {...} }` |
| `getProducts` | GET | Silent stock refresh | `[...]` product array |
| `submitOrder` | POST | Checkout | `{ orderNumber, trackingCode, emailSent }` |
| `trackOrder&id=...` | GET | Track Order modal | `{ found, shippingStatus, orderNumber, ... }` |

<details>
<summary><strong>Full payload and field reference</strong></summary>

**Product object** (consumed by the frontend): `id`, `title`, `brand`, `category`, `size`, `sku`, `oldPrice`, `offerPrice`, `displayPrice`, `hasDiscount`, `discountPct`, `inStock`, `stockQty`, `imageUrl`.

**Site config** (consumed by `applyConfig()`): `siteTitle`, `currencySymbol`, `whatsAppNumber`, `insideDhakaCharge`, `outsideDhakaCharge`, `bKashAccount`, `nagadAccount`, `happyOrders`, `totalProducts`.

**`submitOrder` payload** (built in `placeOrder()`): `firstname`, `lastname`, `fullname`, `contactnumber`, `address`, `delivery_location` (`inside` / `outside`), `services` (payment method), `account_number`, `transaction_id`, `subtotal` / `delivery_charge` / `total` (formatted and numeric), `products` (display list), `quantities`, `quantitiesArray` (one slot per product ID), `totalItems`.

**`trackOrder` response** (rendered in `renderTrackResult()`): `found`, `shippingStatus`, `orderNumber`, `date`, `payment`, `trackingCode`, `fullName`, `contact`, `address`, `delivery`, `items`, `subtotal`, `deliveryCharge`, `total`.

The source of truth for all four calls is [assets/site.js](assets/site.js): `loadData()`, `refreshProducts()`, `placeOrder()` and `doTrack()`. The server side is `Code.gs`, not included in this repository.

</details>

---

## 🎂 Why This Exists

Sarah's Bakery is a real home bakery in Dhaka. Off-the-shelf e-commerce is overkill (and recurring cost) for a one-kitchen operation, so this site borrows infrastructure the bakery already had: a Google Sheet becomes the product catalog and order book, Apps Script becomes the server, and the customer gets live prices, real stock, instant orders and door-step tracking. The whole storefront fits in a folder you can read in an afternoon, and that is the point.

<div align="center">
<sub>© 2026 Sarah's Bakery · Developed by <a href="https://wa.me/8801764640824">mhshan7</a></sub>
</div>
