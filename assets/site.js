/* ==============================================================
   Endpoint. NOTE: this used to be declared as `var URL`, which
   overwrote the browser's global URL constructor for the whole
   page — a landmine for any library added later.
   ============================================================== */
var API_URL = "https://script.google.com/macros/s/AKfycbxZVBebev50J6u8ZPuHlqWfGxjbkgxfu32puoONeKeHitkb4rkZM9hKTAOpl0rUJw-Bng/exec";

var ALL = [], FILTERED = [], CFG = { totalProducts: 13 },
    ACTIVE_CAT = "All", SEARCH = "", MOD_PROD = null, MOD_QTY = 1, LAST_ORDER = null;

/* localStorage can throw (private mode, blocked storage) and a
   corrupted value used to kill the whole script at parse time,
   leaving a blank page. */
function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* storage unavailable */ } }

var CART = (function () {
    try {
        var v = JSON.parse(lsGet("sgc_cart") || "[]");
        return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
})();

var LOW_STOCK_THRESHOLD = 10;
function getStockInfo(p) {
    if (!p.inStock || p.stockQty <= 0) {
        return {
            cls: "out",
            label: "Out of Stock",
            icon: '<i class="fa-solid fa-circle-xmark" style="color: #B94A48;"></i>'
        };
    }

    if (p.stockQty <= LOW_STOCK_THRESHOLD) {
        return {
            cls: "low",
            label: "Low Stock",
            icon: ""
        };
    }

    return {
        cls: "in",
        label: "In Stock",
        icon: '<i class="fa-solid fa-circle-check" style="color: #228748;"></i>'
    };
}

var IMGS = { d: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format", s: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=500&auto=format", c: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500&auto=format", cl: "https://images.unsplash.com/photo-1587248720327-8eb72564be1e?w=500&auto=format", t: "https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=500&auto=format", sun: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=500&auto=format", bb: "https://images.unsplash.com/photo-1519869325930-281384150729?w=500&auto=format" };
function getImg(p) { if (p.imageUrl && p.imageUrl.indexOf("http") === 0) return p.imageUrl; var t = (p.title + " " + p.category).toLowerCase(); if (t.indexOf("cheesecake") !== -1) return IMGS.s; if (t.indexOf("cupcake") !== -1) return IMGS.c; if (t.indexOf("chocolate") !== -1) return IMGS.cl; if (t.indexOf("red velvet") !== -1) return IMGS.t; if (t.indexOf("wedding") !== -1) return IMGS.sun; if (t.indexOf("custom") !== -1) return IMGS.bb; if (t.indexOf("birthday") !== -1) return IMGS.s; return IMGS.d; }
/* Grouped manually rather than via toLocaleString(), whose digits
   follow the device locale — a phone set to Bangla rendered Bengali
   numerals here while the emailed invoice used Latin ones. */
function money(n) {
    n = Math.round(Number(n) || 0);
    var neg = n < 0, s = String(Math.abs(n)), out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? "-" : "") + s + out;
}
function fmt(n) { var sym = CFG.currencySymbol || "\u09F3"; return sym + money(n); }
function $(i) { return document.getElementById(i); }
function show(i) { $(i).classList.remove("hidden"); }
function hide(i) { $(i).classList.add("hidden"); }

/* ── Escaping ────────────────────────────────────────────────
   Everything below is written into innerHTML. Product titles,
   categories and — on the tracking screen — customer-entered
   addresses all come from outside this page, so they get escaped
   before they touch the DOM. */
var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s) {
    return String(s === null || s === undefined ? "" : s)
        .replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
}
// For values dropped inside a single-quoted JS string in an inline
// handler: escape for JS first, then for HTML.
function jsStr(s) {
    return esc(String(s === null || s === undefined ? "" : s)
        .replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
}
function trunc(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Background scroll lock ──────────────────────────────────
   Without this the page scrolled behind every open drawer/modal. */
var LOCK_IDS = ["cart", "side-panel", "modal-veil", "checkout-veil", "success-veil", "track-veil", "inv-veil"];
function syncOverlayLock() {
    var open = LOCK_IDS.some(function (id) {
        var el = $(id);
        return el && el.classList.contains("on");
    });
    document.documentElement.classList.toggle("ovl-open", open);
    document.body.classList.toggle("ovl-open", open);
}

/* ── Motion helpers ─────────────────────────────── */
var _revealObs = null;
function initReveal() {
    if (REDUCED || !("IntersectionObserver" in window)) {
        document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
        return;
    }
    _revealObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            _revealObs.unobserve(el);
            var d = parseInt(el.getAttribute("data-delay"), 10) || 0;
            if (d > 0) setTimeout(function () { el.classList.add("in"); }, d);
            else el.classList.add("in");
        });
    }, { threshold: .12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { _revealObs.observe(el); });
}
function observeNew(nodes) {
    if (REDUCED || !_revealObs) { nodes.forEach(function (n) { n.classList.add("in"); }); return; }
    nodes.forEach(function (n) { _revealObs.observe(n); });
}

function countUp(el, target, dur) {
    if (!el) return;
    target = Number(target) || 0;
    if (REDUCED) { el.textContent = target; return; }
    var start = 0, t0 = performance.now(); dur = dur || 1400;
    function step(now) {
        var p = Math.min((now - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function makeSparks() {
    if (REDUCED) return;
    var host = $("sparks"); if (!host) return;
    var h = "";
    for (var i = 0; i < 14; i++) {
        var size = 4 + Math.random() * 8;
        var left = Math.random() * 100;
        var dur = 9 + Math.random() * 10;
        var delay = Math.random() * 12;
        h += '<span class="spark" style="width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;left:' + left.toFixed(1) + '%;animation-duration:' + dur.toFixed(1) + 's;animation-delay:-' + delay.toFixed(1) + 's;opacity:' + (0.25 + Math.random() * 0.4).toFixed(2) + '"></span>';
    }
    host.innerHTML = h;
}

function initScrollFx() {
    var bar = $("scroll-bar"), nav = $("navbar"), top = $("to-top"), ticking = false;
    if (!bar || !nav || !top) return;
    function onScroll() {
        if (ticking) return; ticking = true;
        requestAnimationFrame(function () {
            var y = window.scrollY || document.documentElement.scrollTop;
            var max = document.documentElement.scrollHeight - window.innerHeight;
            bar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
            nav.classList.toggle("stuck", y > 24);
            top.classList.toggle("on", y > 620);
            ticking = false;
        });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
}

function flyToCart(srcEl) {
    if (REDUCED || !srcEl) return;
    // Target the cart button itself — the count badge is hidden while
    // the bag is empty, so the very first add had no animation.
    var target = window.innerWidth <= 768 ? $("mbn-cart") : $("cart-btn");
    if (!target) return;
    var a = srcEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!b.width || !a.width) return;
    var dot = document.createElement("div");
    dot.style.cssText = "position:fixed;left:" + (a.left + a.width / 2 - 9) + "px;top:" + (a.top + a.height / 2 - 9) + "px;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#7A3D28,#B8674F);z-index:999;pointer-events:none;box-shadow:0 6px 18px rgba(184,103,79,.6);transition:transform .75s cubic-bezier(.55,-.2,.35,1),opacity .75s ease";
    document.body.appendChild(dot);
    requestAnimationFrame(function () {
        dot.style.transform = "translate(" + (b.left + b.width / 2 - a.left - a.width / 2) + "px," + (b.top + b.height / 2 - a.top - a.height / 2) + "px) scale(.3)";
        dot.style.opacity = "0";
    });
    setTimeout(function () { dot.remove(); }, 800);
}

function bumpCartIcon() {
    var els = [$("cart-cnt"), $("mbn-cart-cnt")];
    els.forEach(function (el) {
        if (!el || el.classList.contains("hidden")) return;
        el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    });
}

document.addEventListener("DOMContentLoaded", function () {
    renderBadge(); makeSparks(); initReveal(); initScrollFx();
    if ($("product-grid")) loadData();
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        // Close only the topmost layer so Escape doesn't nuke everything.
        if ($("inv-veil") && $("inv-veil").classList.contains("on")) { closeInvoice(); return; }
        if ($("track-veil") && $("track-veil").classList.contains("on")) { closeTrack(); return; }
        if ($("success-veil") && $("success-veil").classList.contains("on")) { closeSuccess(); return; }
        if ($("checkout-veil") && $("checkout-veil").classList.contains("on")) { closeCheckout(); return; }
        if ($("modal-veil") && $("modal-veil").classList.contains("on")) { closeModal(); return; }
        if ($("side-panel") && $("side-panel").classList.contains("on")) { closeSidePanel(); return; }
        if ($("cart") && $("cart").classList.contains("on")) { closeCart(); }
    });
});

/* ── Networking ────────────────────────────────────────────── */
function fetchJson(url, opts, ms) {
    opts = opts || {};
    opts.redirect = "follow";
    ms = ms || 25000;
    var ctl = ("AbortController" in window) ? new AbortController() : null;
    if (ctl) opts.signal = ctl.signal;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);

    return fetch(url, opts)
        .then(function (r) { return r.text(); })
        .then(function (t) {
            clearTimeout(timer);
            var d;
            try { d = JSON.parse(t); }
            catch (e) { throw new Error("The server returned an unexpected response. Please try again."); }
            if (d && d.error) throw new Error(d.error);
            return d;
        })
        .catch(function (e) {
            clearTimeout(timer);
            if (e && e.name === "AbortError") throw new Error("Request timed out. Please check your connection.");
            throw e;
        });
}

function loadData() {
    show("loading-state"); hide("error-state"); hide("empty-state"); hide("product-grid");
    fetchJson(API_URL + "?action=getAll").then(function (d) {
        ALL = (d && d.products) || [];
        CFG = (d && d.config) || { totalProducts: 13 };
        if (!CFG.totalProducts || CFG.totalProducts < 1) CFG.totalProducts = 13;
        applyConfig(); buildPills(); reconcileCart(); applyFilters(); hide("loading-state");
    }).catch(function (e) {
        hide("loading-state");
        $("err-msg").textContent = (e && e.message) || "Connection failed.";
        show("error-state");
    });
}

// Silent refresh so stock levels reflect a just-placed order.
function refreshProducts() {
    fetchJson(API_URL + "?action=getProducts").then(function (d) {
        if (!Array.isArray(d)) return;
        ALL = d;
        reconcileCart();
        applyFilters();
    }).catch(function () { /* non-critical */ });
}

/* The cart lives in localStorage, so it can hold products that were
   deleted, repriced, or sold out since the last visit. */
function reconcileCart() {
    if (!CART.length || !ALL.length) return;
    var byId = {};
    ALL.forEach(function (p) { byId[p.id] = p; });
    var changed = false, removed = 0, clamped = 0;

    CART = CART.filter(function (i) {
        var p = byId[i.id];
        if (!p || !p.inStock || p.stockQty <= 0) { removed++; changed = true; return false; }
        var price = p.displayPrice || p.offerPrice || p.oldPrice;
        if (i.offerPrice !== price) { i.offerPrice = price; changed = true; }
        i.title = p.title; i.brand = p.brand; i.size = p.size; i.sku = p.sku;
        i.oldPrice = p.oldPrice; i.hasDiscount = p.hasDiscount; i.imageUrl = getImg(p);
        if (i.qty > p.stockQty) { i.qty = p.stockQty; clamped++; changed = true; }
        return true;
    });

    if (!changed) return;
    saveCart(); renderBadge();
    if ($("cart") && $("cart").classList.contains("on")) renderCartUI(); else updateCartFooter();
    if (removed || clamped) showToast("Your bag was updated to match current stock", true);
}

function waLink(num) {
    var d = String(num || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.indexOf("880") === 0) return "https://wa.me/" + d;
    if (d.charAt(0) === "0") return "https://wa.me/88" + d;      // 01XXXXXXXXX
    if (d.length <= 10) return "https://wa.me/88" + d;
    return "https://wa.me/" + d;                                  // already international
}

function applyConfig() {
    var c = CFG;
    if (c.siteTitle && $("site-logo")) {
        document.title = c.siteTitle;
        $("site-logo").textContent = c.siteTitle;
    }

    var wa = c.whatsAppNumber || c.whatsappNumber;
    var href = waLink(wa);
    if (href) {
        if ($("wa-btn")) $("wa-btn").href = href;
        if ($("mbn-chat")) $("mbn-chat").href = href;
        var wf = $("wa-footer"); if (wf) wf.href = href;
    }

    var brands = {}; ALL.forEach(function (p) { if (p.brand) brands[p.brand] = 1; });
    countUp($("s-products"), ALL.length);
    countUp($("s-brands"), Object.keys(brands).length);
    var orders = document.querySelectorAll(".hero-stat strong[data-count]")[1];
    if (orders) countUp(orders, Number(c.happyOrders) || 56);
}

function buildPills() {
    if (!$("cat-pills")) return;
    var cats = ["All"], seen = {};
    ALL.forEach(function (p) { if (p.category && !seen[p.category]) { cats.push(p.category); seen[p.category] = 1; } });
    var h = "";
    cats.forEach(function (c) {
        h += '<button class="pill' + (c === "All" ? " on" : "") + '" data-cat="' + esc(c) +
             '" onclick="setCat(\'' + jsStr(c) + '\')">' + esc(c) + '</button>';
    });
    $("cat-pills").innerHTML = h;

    var fh = "";
    cats.slice(1, 7).forEach(function (c) {
        fh += '<li><a href="index.html#shop" onclick="selectCategory(\'' + jsStr(c) + '\');return false;">' + esc(c) + '</a></li>';
    });
    if (fh && $("footer-cats")) $("footer-cats").innerHTML = fh;
}

function setCat(cat) {
    ACTIVE_CAT = cat;
    document.querySelectorAll(".pill").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-cat") === cat); });
    applyFilters(); updateClearFilterBtn();
}
function scrollToShop() {
    if ($("shop")) { $("shop").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); }
    else { window.location.href = "index.html#shop"; }
}
function openContact() {
    window.location.href = "contact.html";
}

function openSidePanel() {
    closeCart();                       // both drawers share z-index 301
    $("side-panel").classList.add("on"); $("sp-veil").classList.add("on"); syncOverlayLock();
}
function closeSidePanel() { $("side-panel").classList.remove("on"); $("sp-veil").classList.remove("on"); syncOverlayLock(); }

function openBrandPanel() {
    var seen = {}, brands = [];
    ALL.forEach(function (p) { if (p.brand && !seen[p.brand]) { seen[p.brand] = 1; brands.push(p.brand); } });
    brands.sort(function (a, b) { return a.localeCompare(b); });
    $("sp-title").textContent = "Brands";
    if (!brands.length) { $("sp-body").innerHTML = '<p class="sp-empty">No brands available.</p>'; }
    else {
        var h = "";
        brands.forEach(function (b) {
            h += '<button class="sp-pill" onclick="selectBrand(\'' + jsStr(b) + '\')">' + esc(b) + '</button>';
        });
        $("sp-body").innerHTML = h;
    }
    openSidePanel();
}

function openCategoryPanel() {
    var seen = {}, cats = [];
    ALL.forEach(function (p) { if (p.category && !seen[p.category]) { seen[p.category] = 1; cats.push(p.category); } });
    cats.sort(function (a, b) { return a.localeCompare(b); });
    $("sp-title").textContent = "Categories";
    if (!cats.length) { $("sp-body").innerHTML = '<p class="sp-empty">No categories available.</p>'; }
    else {
        var h = "";
        cats.forEach(function (c) {
            h += '<button class="sp-pill" onclick="selectCategory(\'' + jsStr(c) + '\')">' + esc(c) + '</button>';
        });
        $("sp-body").innerHTML = h;
    }
    openSidePanel();
}

function selectBrand(brand) {
    SEARCH = String(brand).toLowerCase().trim();
    $("search-inp").value = brand;
    ACTIVE_CAT = "All";
    document.querySelectorAll(".pill").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-cat") === "All"); });
    applyFilters(); updateClearFilterBtn(); closeSidePanel(); scrollToShop();
}

function selectCategory(cat) { setCat(cat); closeSidePanel(); scrollToShop(); }
function onSearch() { SEARCH = $("search-inp").value.toLowerCase().trim(); applyFilters(); updateClearFilterBtn(); }
function updateClearFilterBtn() { $("search-wrap").classList.toggle("has-filter", !!SEARCH || ACTIVE_CAT !== "All"); }
function clearFilter() { $("search-inp").value = ""; SEARCH = ""; setCat("All"); updateClearFilterBtn(); }

function applyFilters() {
    FILTERED = ALL.filter(function (p) {
        var mc = ACTIVE_CAT === "All" || p.category === ACTIVE_CAT;
        if (!mc) return false;
        if (!SEARCH) return true;
        var hay = (p.title + " " + p.brand + " " + p.category + " " + p.sku).toLowerCase();
        return hay.indexOf(SEARCH) !== -1;
    });
    renderGrid();
}

function renderGrid() {
    if (!$("product-grid")) return;
    $("prod-count").textContent = FILTERED.length + " product" + (FILTERED.length !== 1 ? "s" : "");
    if (!FILTERED.length) { hide("product-grid"); show("empty-state"); return; }
    hide("empty-state"); show("product-grid");
    var h = "";
    FILTERED.forEach(function (p, idx) {
        var px = p.displayPrice || p.offerPrice || p.oldPrice;
        var dis = p.inStock ? "" : "disabled";
        var si = getStockInfo(p);
        var delay = Math.min(idx, 11) * 55;
        h += '<div class="card reveal" data-delay="' + delay + '" onclick="openModal(' + p.id + ')">';
        h += '<div class="card-img"><img src="' + esc(getImg(p)) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + IMGS.d + '\'"/>';
        h += '<div class="card-badges">';
        if (p.hasDiscount) h += '<span class="badge badge-sale">-' + p.discountPct + '%</span>';
        else if (si.cls === "low") h += '<span class="badge badge-low">Low Stock</span>';
        h += '</div><button class="card-quick" aria-label="Add to bag" onclick="event.stopPropagation();quickAdd(' + p.id + ',this)" ' + dis + '><i class="fa-solid fa-cart-plus"></i></button></div>';
        h += '<div class="card-body"><span class="card-brand">' + esc(p.brand) + '</span><p class="card-name">' + esc(p.title) + '</p><p class="card-size">' + esc(p.size) + '</p>';
        h += '<div class="card-pricing"><span class="p-new">' + fmt(px) + '</span>';
        if (p.hasDiscount) h += '<span class="p-old">' + fmt(p.oldPrice) + '</span>';
        h += '</div><div class="card-foot"><span class="stock-tag ' + si.cls + '">' + si.label + '</span>';
        h += '<button class="add-btn" aria-label="Add to bag" onclick="event.stopPropagation();quickAdd(' + p.id + ',this)" ' + dis + '><i class="fa-solid fa-cart-plus"></i></button></div></div></div>';
    });
    $("product-grid").innerHTML = h;
    observeNew(Array.prototype.slice.call($("product-grid").querySelectorAll(".card")));
}

function findProduct(id) {
    for (var i = 0; i < ALL.length; i++) { if (ALL[i].id === id) return ALL[i]; }
    return null;
}
function findCartItem(id) {
    for (var i = 0; i < CART.length; i++) { if (CART[i].id === id) return CART[i]; }
    return null;
}

var _modalUnlockT;

function openModal(id) {
    MOD_PROD = findProduct(id);
    if (!MOD_PROD) return;
    MOD_QTY = 1;
    var p = MOD_PROD;
    var px = p.displayPrice || p.offerPrice || p.oldPrice;
    $("m-img").src = getImg(p); $("m-img").alt = p.title;
    $("m-brand").textContent = p.brand + " \xb7 " + p.category;
    $("m-name").textContent = p.title;
    $("m-sku").textContent = p.sku ? "SKU: " + p.sku : "";
    $("m-desc").textContent = p.size;
    $("m-price").textContent = fmt(px);
    $("m-old").textContent = p.hasDiscount ? fmt(p.oldPrice) : "";
    $("m-qty").textContent = 1;
    var db = $("m-disc");
    if (p.hasDiscount) { db.textContent = "-" + p.discountPct + "%"; db.classList.remove("hidden"); }
    else { db.classList.add("hidden"); }
    var si = getStockInfo(p);
    var st = $("m-stock");
    st.innerHTML = (si.icon || "") + " " + si.label;
    st.className = "modal-stock " + si.cls;
    $("m-add").disabled = !p.inStock;

    // Children animate in from translateY(26px); that transform counts
    // toward this pane's scroll overflow and flashes a scrollbar. Clip
    // until the stagger lands (.55s duration + .42s max delay).
    var info = document.querySelector(".modal-info");
    info.scrollTop = 0;
    info.classList.add("locked");
    clearTimeout(_modalUnlockT);
    _modalUnlockT = setTimeout(function () { info.classList.remove("locked"); }, REDUCED ? 0 : 1000);

    $("modal-veil").classList.add("on");
    syncOverlayLock();
}

function closeModal() {
    clearTimeout(_modalUnlockT);
    document.querySelector(".modal-info").classList.remove("locked");
    $("modal-veil").classList.remove("on");
    syncOverlayLock();
}
function onModalVeilClick(e) { if (e.target === $("modal-veil")) closeModal(); }

function mQty(d) {
    if (!MOD_PROD) return;
    var prev = MOD_QTY;
    MOD_QTY = Math.max(1, Math.min(MOD_QTY + d, MOD_PROD.stockQty || 99));
    var el = $("m-qty"); el.textContent = MOD_QTY;
    if (prev !== MOD_QTY && !REDUCED) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = "popIn .35s cubic-bezier(.34,1.56,.64,1) both"; }
}
function addFromModal() { if (MOD_PROD) { flyToCart($("m-add")); addToCart(MOD_PROD.id, MOD_QTY); closeModal(); } }

function quickAdd(id, el) { if (el) flyToCart(el); addToCart(id, 1); }

function addToCart(id, qty) {
    qty = qty || 1;
    var p = findProduct(id);
    if (!p || !p.inStock) { showToast("Out of stock!", true); return; }
    var ex = findCartItem(id);
    var nq = (ex ? ex.qty : 0) + qty;
    if (nq > p.stockQty) { showToast("Only " + p.stockQty + " available", true); return; }
    if (ex) { ex.qty = nq; }
    else {
        CART.push({
            id: p.id, title: p.title, brand: p.brand,
            offerPrice: p.displayPrice || p.offerPrice, oldPrice: p.oldPrice,
            hasDiscount: p.hasDiscount, imageUrl: getImg(p), sku: p.sku, size: p.size, qty: qty
        });
    }
    saveCart();
    if (ex && $("cart-body") && $("cart-body").querySelector('.ci[data-id="' + id + '"]')) { patchCartRow(id); updateCartFooter(); renderBadge(); }
    else { renderCartUI(); }
    bumpCartIcon();
    showToast(trunc(p.title, 30) + " added!");
}

function changeQty(id, d) {
    var item = findCartItem(id), prod = findProduct(id);
    if (!item) return;
    var nq = item.qty + d;
    if (nq <= 0) { removeItem(id); return; }
    if (prod && nq > prod.stockQty) { showToast("Not enough stock", true); return; }
    item.qty = nq; saveCart();
    // Patch just this row — rebuilding innerHTML would replay the entry
    // animation and force the thumbnails to repaint (the flicker).
    patchCartRow(id); updateCartFooter(); renderBadge();
}

function patchCartRow(id) {
    var row = $("cart-body").querySelector('.ci[data-id="' + id + '"]');
    if (!row) return false;
    var item = findCartItem(id);
    if (!item) return false;
    var qn = row.querySelector(".q-n"), tot = row.querySelector(".ci-tot");
    if (qn) { qn.textContent = item.qty; flash(qn); }
    if (tot) { tot.textContent = fmt(item.offerPrice * item.qty); flash(tot); }
    return true;
}

function flash(el) {
    if (REDUCED || !el) return;
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
}

function updateCartFooter() {
    var foot = $("cart-foot");
    if (!foot) return;
    if (!CART.length) { foot.style.display = "none"; return; }
    var t = getTotals();
    $("cf-sub").textContent = fmt(t.sub);
    $("cf-del").textContent = "Calculated at checkout";
    $("cf-tot").textContent = fmt(t.sub);
    foot.style.display = "";
}

function removeItem(id) {
    CART = CART.filter(function (c) { return c.id !== id; });
    saveCart(); renderBadge(); updateCartFooter();
    var row = $("cart-body").querySelector('.ci[data-id="' + id + '"]');
    if (!row) { renderCartUI(); return; }
    if (REDUCED) { row.remove(); if (!CART.length) renderCartUI(); return; }
    row.style.maxHeight = row.offsetHeight + "px";
    requestAnimationFrame(function () {
        row.classList.add("removing");
        setTimeout(function () {
            row.remove();
            if (!CART.length) renderCartUI();
        }, 340);
    });
}

function saveCart() { lsSet("sgc_cart", JSON.stringify(CART)); }
function getDelivery(loc) { if (!loc) return 0; return loc === "inside" ? (Number(CFG.insideDhakaCharge) || 60) : (Number(CFG.outsideDhakaCharge) || 120); }
function getTotals(loc) { var sub = 0; CART.forEach(function (i) { sub += i.offerPrice * i.qty; }); var del = getDelivery(loc); return { sub: sub, del: del, tot: sub + del }; }

function renderCartUI() {
    renderBadge();
    var body = $("cart-body"), foot = $("cart-foot");
    if (!body) return;
    if (!CART.length) {
        body.innerHTML = '<div class="cart-empty"><i class="fa fa-bag-shopping"></i><p>Your bag is empty</p><button class="btn-shop" onclick="closeCart()">Continue Shopping</button></div>';
        foot.style.display = "none";
        return;
    }
    var h = "";
    CART.forEach(function (i) {
        h += '<div class="ci" data-id="' + i.id + '"><img class="ci-img" src="' + esc(i.imageUrl) + '" alt="' + esc(i.title) + '" onerror="this.onerror=null;this.src=\'' + IMGS.d + '\'"/>';
        h += '<div class="ci-info"><p class="ci-name">' + esc(i.title) + '</p><p><span class="ci-price">' + fmt(i.offerPrice) + '</span>';
        if (i.hasDiscount) h += '<span class="ci-price-old">' + fmt(i.oldPrice) + '</span>';
        h += '</p><div class="ci-row"><button class="q-btn" aria-label="Decrease quantity" onclick="changeQty(' + i.id + ',-1)">\u2212</button><span class="q-n">' + i.qty + '</span><button class="q-btn" aria-label="Increase quantity" onclick="changeQty(' + i.id + ',1)">+</button><button class="ci-rm" onclick="removeItem(' + i.id + ')">Remove</button></div></div>';
        h += '<span class="ci-tot">' + fmt(i.offerPrice * i.qty) + '</span></div>';
    });
    body.innerHTML = h;
    updateCartFooter();
}

function renderBadge() {
    var n = 0; CART.forEach(function (i) { n += i.qty; });
    var b = $("cart-cnt");
    if (b) { b.textContent = n; b.classList.toggle("hidden", n <= 0); }
    var mb = $("mbn-cart-cnt");
    if (mb) { mb.textContent = n; mb.classList.toggle("hidden", n <= 0); }
}

function openCart() {
    closeSidePanel();
    renderCartUI();
    $("cart").classList.add("on"); $("cart-veil").classList.add("on");
    syncOverlayLock();
}
function closeCart() {
    $("cart").classList.remove("on"); $("cart-veil").classList.remove("on");
    syncOverlayLock();
}
function toggleCart() { if ($("cart").classList.contains("on")) closeCart(); else openCart(); }

function openCheckout() {
    if (!CART.length) return;
    closeCart();
    updateCoTotals();
    $("checkout-veil").classList.add("on");
    syncOverlayLock();
}
function closeCheckout() { $("checkout-veil").classList.remove("on"); syncOverlayLock(); }
function onCoVeilClick(e) { if (e.target === $("checkout-veil")) closeCheckout(); }
function onLocChange() { updateCoTotals(); }

function updateCoTotals() {
    var loc = $("co-loc").value; var t = getTotals(loc);
    $("co-sub").textContent = fmt(t.sub);
    $("co-del").textContent = t.del > 0 ? fmt(t.del) : "TBD";
    $("co-del-lbl").textContent = loc === "outside" ? "Delivery (Outside)" : loc === "inside" ? "Delivery (Inside)" : "Delivery";
    $("co-tot").textContent = fmt(t.tot);
}

function onPayChange() {
    var m = $("co-pay").value;
    var info = $("pay-info"), txn = $("txn-wrap");
    if (m === "bKash" || m === "Nagad") {
        $("pi-title").textContent = m + " Payment";
        $("pi-num").textContent = (m === "bKash" ? (CFG.bKashAccount || CFG.bkashAccount) : CFG.nagadAccount) || "01XXXXXXXXX";
        info.classList.remove("hidden"); txn.classList.remove("hidden");
    } else {
        info.classList.add("hidden"); txn.classList.add("hidden");
    }
}

function placeOrder() {
    var fn = $("co-fn").value.trim(), ln = $("co-ln").value.trim(),
        ph = $("co-phone").value.trim(), addr = $("co-addr").value.trim(),
        loc = $("co-loc").value, pay = $("co-pay").value;
    var acc = $("co-acc").value.trim(), txn = $("co-txn").value.trim();
    var errEl = $("co-err"); errEl.classList.remove("on");

    function fail(msg) { errEl.textContent = msg; errEl.classList.add("on"); }

    if (!CART.length) { fail("Your bag is empty."); return; }
    if (!fn || !ln || !ph || !addr || !loc || !pay) { fail("Please fill in all required fields."); return; }
    if (ph.replace(/\D/g, "").length < 10) { fail("Please enter a valid contact number."); return; }
    if (addr.length < 10) { fail("Please enter a complete delivery address."); return; }
    // Mobile-wallet orders are unverifiable without these.
    if ((pay === "bKash" || pay === "Nagad") && (!acc || !txn)) {
        fail("Please enter your " + pay + " account number and transaction ID.");
        return;
    }

    var totalProds = parseInt(CFG.totalProducts, 10) || 13;
    // Never let a stale "Total Products" value truncate the array —
    // that silently dropped the sale for any higher-numbered product.
    CART.forEach(function (i) { if (i.id > totalProds) totalProds = i.id; });

    var t = getTotals(loc);
    var fullname = fn + " " + ln;
    var productsArr = [], quantities = [], totalItems = 0;
    var qtyArr = [];
    for (var z = 0; z < totalProds; z++) { qtyArr.push(0); }

    CART.forEach(function (item, x) {
        productsArr.push((x + 1) + ". " + item.title + " - " + fmt(item.offerPrice));
        quantities.push("Q-" + item.qty);
        if (item.id >= 1 && item.id <= totalProds) { qtyArr[item.id - 1] = item.qty; }
        totalItems += item.qty;
    });

    var payload = {
        action: "submitOrder", firstname: fn, lastname: ln, fullname: fullname,
        contactnumber: ph, address: addr, delivery_location: loc, services: pay,
        account_number: acc, transaction_id: txn,
        subtotal: fmt(t.sub), delivery_charge: fmt(t.del), total: fmt(t.tot),
        subtotalNum: t.sub, deliveryNum: t.del, totalNum: t.tot, calcTotal: t.tot,
        products: productsArr.join(", "), quantities: quantities,
        quantitiesArray: qtyArr,
        totalItems: totalItems, offerSubtotal: t.sub,
        formattedData: CART.map(function (i) { return i.qty; }).join(", ")
    };

    var btn = $("btn-place");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Placing Order...';
    var snap = CART.slice();

    // No Content-Type header on purpose: it keeps this a "simple"
    // request so the browser skips the CORS preflight that Apps
    // Script web apps cannot answer.
    fetchJson(API_URL, { method: "POST", body: JSON.stringify(payload) }, 40000).then(function (d) {
        LAST_ORDER = {
            orderNumber: d.orderNumber, trackingCode: d.trackingCode, fullname: fullname,
            contactnumber: ph, address: addr, delivery_location: loc, services: pay,
            account_number: acc, transaction_id: txn,
            sub: t.sub, del: t.del, tot: t.tot, snap: snap
        };
        closeCheckout();
        showSuccess(d.orderNumber, d.trackingCode, d.emailSent);
        CART = []; saveCart(); renderCartUI();
        refreshProducts();
    }).catch(function (e) {
        fail(((e && e.message) || "Could not place order.") +
             " If this keeps happening, message us on WhatsApp before re-ordering so we don't duplicate it.");
    }).then(function () {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-check-circle"></i> Place Order';
    });
}

function showSuccess(orderNum, tracking, emailSent) {
    $("succ-order-id").textContent = orderNum;
    $("succ-tracking").textContent = tracking;
    var note = $("succ-note");
    if (emailSent === false) {
        note.textContent = "Your order is saved, but our confirmation email didn't go out. Please keep your tracking code and message us on WhatsApp to confirm.";
        note.classList.remove("hidden");
    } else {
        note.classList.add("hidden");
    }
    $("success-veil").classList.add("on");
    syncOverlayLock();
    confetti();
}
function closeSuccess() { $("success-veil").classList.remove("on"); syncOverlayLock(); }
function openTrackFromSuccess() { closeSuccess(); openTrack(LAST_ORDER ? LAST_ORDER.trackingCode : ""); }
// Invoice sits above the success card (z-index 650 vs 600), so the
// tracking code is still there when the customer closes it.
function openInvoiceFromSuccess() { if (LAST_ORDER) showInvoice(LAST_ORDER); }

function confetti() {
    if (REDUCED) return;
    var colors = ["#B8674F", "#D99B7C", "#C08A3E", "#FFFFFF", "#7A3D28"];
    for (var i = 0; i < 40; i++) {
        (function (i) {
            var el = document.createElement("div");
            var size = 6 + Math.random() * 7;
            el.style.cssText = "position:fixed;left:50%;top:34%;width:" + size + "px;height:" + (size * .5) + "px;background:" + colors[i % colors.length] + ";z-index:999;pointer-events:none;border-radius:2px;opacity:1;transition:transform 1.5s cubic-bezier(.2,.6,.35,1),opacity 1.5s ease";
            document.body.appendChild(el);
            requestAnimationFrame(function () {
                var x = (Math.random() - .5) * 620, y = (Math.random() - .35) * 560;
                el.style.transform = "translate(" + x + "px," + y + "px) rotate(" + (Math.random() * 900 - 450) + "deg)";
                el.style.opacity = "0";
            });
            setTimeout(function () { el.remove(); }, 1700);
        })(i);
    }
}

/* ── Track ─────────────────────────────────────────────────── */
var STATUS_ORDER = ["Processing", "Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"];
function normStatus(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, ""); }

function openTrack(prefill) {
    $("track-err").classList.remove("on");
    $("track-result").classList.remove("on");
    $("track-inp").value = (typeof prefill === "string" ? prefill : "");
    $("track-veil").classList.add("on");
    syncOverlayLock();
    if (typeof prefill === "string" && prefill) doTrack();
}
function closeTrack() { $("track-veil").classList.remove("on"); syncOverlayLock(); }
function onTrackVeilClick(e) { if (e.target === $("track-veil")) closeTrack(); }

function doTrack() {
    var id = $("track-inp").value.trim();
    $("track-err").classList.remove("on"); $("track-result").classList.remove("on");
    if (!id) { $("track-err").textContent = "Please enter an Order ID or Tracking Code."; $("track-err").classList.add("on"); return; }
    var btn = $("btn-search");
    btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
    fetchJson(API_URL + "?action=trackOrder&id=" + encodeURIComponent(id)).then(function (d) {
        if (!d.found) throw new Error(d.error || "Order not found.");
        renderTrackResult(d);
    }).catch(function (e) {
        $("track-err").textContent = (e && e.message) || "Could not connect. Please try again.";
        $("track-err").classList.add("on");
    }).then(function () {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-magnifying-glass"></i> Search';
    });
}

function renderTrackResult(d) {
    var status = d.shippingStatus || "Processing";
    var key = normStatus(status);
    var cancelled = (key === "cancelled" || key === "canceled");

    var chip = $("tr-status-chip");
    chip.textContent = status;
    chip.className = "status-chip sc-" + (cancelled ? "cancelled" : key);

    // Status matching is now case/space insensitive, and a cancelled
    // order no longer lights up "Processing" as if it were live.
    var statusIdx = -1;
    STATUS_ORDER.forEach(function (s, i) { if (normStatus(s) === key) statusIdx = i; });
    $("tr-steps").style.display = cancelled ? "none" : "";
    if (!cancelled) {
        if (statusIdx === -1) statusIdx = 0;
        STATUS_ORDER.forEach(function (s, i) {
            var el = $("step-" + normStatus(s));
            if (!el) return;
            var dot = el.querySelector(".step-dot"), lbl = el.querySelector(".step-lbl");
            setTimeout(function () {
                if (i < statusIdx) { dot.className = "step-dot done"; lbl.className = "step-lbl done"; }
                else if (i === statusIdx) { dot.className = "step-dot active"; lbl.className = "step-lbl active"; }
                else { dot.className = "step-dot"; lbl.className = "step-lbl"; }
            }, REDUCED ? 0 : i * 120);
        });
    }

    $("tr-order-info").innerHTML = "<strong>" + esc(d.orderNumber) + "</strong><br/>" + esc(d.date) +
        "<br/>Payment: " + esc(d.payment) +
        (d.trackingCode ? "<br/>Tracking: <strong>" + esc(d.trackingCode) + "</strong>" : "");
    $("tr-delivery-info").innerHTML = "<strong>" + esc(d.fullName) + "</strong><br/>" + esc(d.contact) +
        "<br/>" + esc(d.address) + "<br/>" + esc(d.delivery);

    var items = String(d.items || "").split(", ");
    var iHtml = "";
    items.forEach(function (item) { if (String(item).trim()) iHtml += "\u2022 " + esc(item) + "<br/>"; });
    $("tr-items-list").innerHTML = iHtml || "\u2014";

    $("tr-sub").textContent = d.subtotal;
    $("tr-del").textContent = d.deliveryCharge;
    $("tr-tot").textContent = d.total;
    $("track-result").classList.add("on");
}

/* ── Invoice ───────────────────────────────────────────────── */
/* Mirrors generatePDF() in Code.gs field for field, so the invoice the
   customer prints is the same document that lands in your inbox. */
function showInvoice(o) {
    if (!o) return;
    var sym = CFG.currencySymbol || "\u09F3";
    var now = new Date();
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var hr = now.getHours(), ampm = hr >= 12 ? "PM" : "AM";
    hr = hr % 12; if (hr === 0) hr = 12;
    var date = pad(now.getDate()) + " " + MON[now.getMonth()] + " " + now.getFullYear() +
        ", " + pad(hr) + ":" + pad(now.getMinutes()) + " " + ampm;

    var oh = "<b>Order No:</b> " + esc(o.orderNumber) + "<br/>";
    if (o.trackingCode) oh += "<b>Tracking:</b> <span class='inv-trk'>" + esc(o.trackingCode) + "</span><br/>";
    oh += "<b>Date:</b> " + date + "<br/>";
    oh += "<b>Payment:</b> " + esc(o.services);
    if (o.account_number) oh += "<br/><b>Account:</b> " + esc(o.account_number);
    if (o.transaction_id) oh += "<br/><b>Txn:</b> " + esc(o.transaction_id);
    $("inv-order").innerHTML = oh;

    $("inv-cust").innerHTML = "<b>" + esc(o.fullname) + "</b><br/>" + esc(o.contactnumber) +
        "<br/>" + esc(o.address) + "<br/><b>Delivery:</b> " +
        (o.delivery_location === "inside" ? "Inside Dhaka" : "Outside Dhaka");

    var rows = "";
    (o.snap || []).forEach(function (i) {
        rows += "<tr><td>" + esc(i.title) + "</td><td style=\"text-align:center\">" + i.qty +
            "</td><td style=\"text-align:right\">" + sym + money(i.offerPrice) +
            "</td><td style=\"text-align:right;font-weight:700\">" + sym + money(i.offerPrice * i.qty) + "</td></tr>";
    });
    $("inv-rows").innerHTML = rows ||
        "<tr><td colspan='4' style='text-align:center;color:var(--slate)'>No items recorded</td></tr>";

    $("inv-sub").textContent = sym + money(o.sub);
    $("inv-del").textContent = sym + money(o.del);
    $("inv-tot").textContent = sym + money(o.tot);
    $("inv-veil").classList.add("on");
    syncOverlayLock();
}
function closeInvoice() { $("inv-veil").classList.remove("on"); syncOverlayLock(); }

// Print only the invoice — this used to send the entire storefront
// (hero, product grid and all) to the printer.
function printInvoice() {
    document.body.classList.add("printing-invoice");
    var cleanup = function () { document.body.classList.remove("printing-invoice"); };
    window.addEventListener("afterprint", function h() {
        window.removeEventListener("afterprint", h); cleanup();
    });
    setTimeout(function () {
        window.print();
        setTimeout(cleanup, 800);   // fallback for browsers without afterprint
    }, 60);
}

/* ── Toast ─────────────────────────────────────────────────── */
var _tt;
function showToast(msg, isErr) {
    var el = $("toast"), ic = $("toast-ic");
    if (!el) return;
    $("toast-msg").textContent = msg;
    el.style.background = isErr ? "rgba(185,74,72,.95)" : "rgba(43,30,20,.95)";
    ic.className = isErr ? "fa fa-triangle-exclamation" : "fa fa-check-circle";
    el.classList.add("on");
    clearTimeout(_tt);
    _tt = setTimeout(function () { el.classList.remove("on"); }, 2800);
}

/* ── FAQ accordion (used on faq.html) ─────────────────────────────── */
function toggleFaq(el) {
    var item = el.closest(".faq-item");
    var ans = item.querySelector(".faq-a");
    var isOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach(function (o) {
        if (o !== item) { o.classList.remove("open"); o.querySelector(".faq-a").style.maxHeight = null; }
    });
    if (isOpen) { item.classList.remove("open"); ans.style.maxHeight = null; }
    else { item.classList.add("open"); ans.style.maxHeight = ans.scrollHeight + "px"; }
}

/* ── Contact form (used on contact.html) ─────────────────────────────── */
function submitContactForm(e) {
    e.preventDefault();
    var name = $("cf-name").value.trim(), email = $("cf-email").value.trim(),
        phone = $("cf-phone").value.trim(), msg = $("cf-message").value.trim();
    var errEl = $("cf-err");
    errEl.classList.remove("on");
    if (!name || !phone || !msg) {
        errEl.textContent = "Please fill in your name, phone number, and message.";
        errEl.classList.add("on");
        return false;
    }
    document.getElementById("contact-form").classList.add("hidden");
    $("contact-success").classList.add("on");
    return false;
}
