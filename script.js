/* NOVA STORE - version propre et sans dépendance externe.
   IMPORTANT : cette version est une démo front-end.
   Les comptes et commandes sont stockés dans le navigateur.
   Pour un vrai site, il faudra un serveur + une vraie authentification.
*/

/** @typedef {{id:number, name:string, category:'argent'|'vip', price:number, description:string, icon:string}} Product */
/** @typedef {{productId:number, quantity:number}} CartItem */
/** @typedef {{id:string, date:string, total:number, payment:string, phone:string, items:CartItem[], status:string, email:string}} Order */
/** @typedef {{name:string, email:string, password:string}} User */

const PRODUCTS = [
  { id: 1, name: "100 000 Argent RP", category: "argent", price: 1000, description: "Pack de 100 000 en argent RP.", icon: "💰" },
  { id: 2, name: "200 000 Argent RP", category: "argent", price: 2000, description: "Pack de 200 000 en argent RP.", icon: "💰" },
  { id: 3, name: "300 000 Argent RP", category: "argent", price: 3000, description: "Pack de 300 000 en argent RP.", icon: "💰" },
  { id: 4, name: "400 000 Argent RP", category: "argent", price: 4000, description: "Pack de 400 000 en argent RP.", icon: "💰" },
  { id: 5, name: "500 000 Argent RP", category: "argent", price: 5000, description: "Pack de 500 000 en argent RP.", icon: "💰" },
  { id: 6, name: "600 000 Argent RP", category: "argent", price: 6000, description: "Pack de 600 000 en argent RP.", icon: "💰" },
  { id: 7, name: "700 000 Argent RP", category: "argent", price: 7000, description: "Pack de 700 000 en argent RP.", icon: "💰" },
  { id: 8, name: "800 000 Argent RP", category: "argent", price: 8000, description: "Pack de 800 000 en argent RP.", icon: "💰" },
  { id: 9, name: "900 000 Argent RP", category: "argent", price: 9000, description: "Pack de 900 000 en argent RP.", icon: "💰" },
  { id: 10, name: "1 000 000 Argent RP", category: "argent", price: 10000, description: "Pack de 1 000 000 en argent RP.", icon: "💰" },
  { id: 11, name: "VIP Fer", category: "vip", price: 2000, description: "Accès VIP Fer.", icon: "⚙️" },
  { id: 12, name: "VIP Bronze", category: "vip", price: 5000, description: "Accès VIP Bronze.", icon: "🥉" },
  { id: 13, name: "VIP Haut de gamme", category: "vip", price: 10000, description: "Accès VIP Haut de gamme.", icon: "💎" }
];

/*
  Les codes promo sont désormais gérés depuis le panel admin
  (admin.html), pas ici. Ce fichier interroge le serveur pour
  vérifier chaque code en temps réel.
*/

const STORAGE_KEYS = {
  cart: "nova_store_cart",
  favorites: "nova_store_favorites",
  users: "nova_store_users",
  currentUser: "nova_store_current_user",
  orders: "nova_store_orders",
  theme: "nova_store_theme"
};

/** @type {CartItem[]} */
let cart = loadJSON(STORAGE_KEYS.cart, []);

/** @type {number[]} */
let favorites = loadJSON(STORAGE_KEYS.favorites, []);

/** @type {User[]} */
let users = loadJSON(STORAGE_KEYS.users, []);

/** @type {string|null} */
let currentUserEmail = localStorage.getItem(STORAGE_KEYS.currentUser);

/** @type {Order[]} */
let orders = loadJSON(STORAGE_KEYS.orders, []);

/** @type {{code:string, percent:number}} */
let appliedPromo = { code: "", percent: 0 };

let selectedCategory = "all";

/**
 * @param {string} key
 * @param {unknown} fallback
 * @returns {any}
 */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatPrice(value) {
  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

/**
 * @param {number} productId
 * @returns {Product|undefined}
 */
function getProduct(productId) {
  return PRODUCTS.find((product) => product.id === productId);
}

/**
 * @param {number} productId
 * @returns {number}
 */
function getCartQuantity(productId) {
  const item = cart.find((entry) => entry.productId === productId);
  return item ? item.quantity : 0;
}

/**
 * @param {number} productId
 */
function addToCart(productId) {
  const item = cart.find((entry) => entry.productId === productId);

  if (item) {
    item.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }

  saveJSON(STORAGE_KEYS.cart, cart);
  renderAll();
  showToast("Produit ajouté au panier 🛒");
}

/**
 * @param {number} productId
 * @param {number} amount
 */
function changeQuantity(productId, amount) {
  const item = cart.find((entry) => entry.productId === productId);

  if (!item) {
    return;
  }

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter((entry) => entry.productId !== productId);
  }

  saveJSON(STORAGE_KEYS.cart, cart);
  renderAll();
}

/**
 * @param {number} productId
 */
function removeFromCart(productId) {
  cart = cart.filter((entry) => entry.productId !== productId);
  saveJSON(STORAGE_KEYS.cart, cart);
  renderAll();
  showToast("Produit retiré du panier.");
}

/**
 * @param {number} productId
 */
function toggleFavorite(productId) {
  if (favorites.includes(productId)) {
    favorites = favorites.filter((id) => id !== productId);
  } else {
    favorites.push(productId);
  }

  saveJSON(STORAGE_KEYS.favorites, favorites);
  renderAll();
}

/**
 * @param {Product} product
 * @returns {string}
 */
function productCardHTML(product) {
  const isFavorite = favorites.includes(product.id);
  const favoriteSymbol = isFavorite ? "❤️" : "♡";

  return `
    <article class="product-card">
      <button
        class="favorite-btn"
        type="button"
        data-action="favorite"
        data-product-id="${product.id}"
        aria-label="Ajouter ou retirer des favoris"
      >${favoriteSymbol}</button>

      <div class="product-icon">${product.icon}</div>
      <p class="eyebrow">${product.category === "vip" ? "VIP" : "ARGENT RP"}</p>
      <h3>${escapeHTML(product.name)}</h3>
      <p>${escapeHTML(product.description)}</p>
      <div class="product-price">${formatPrice(product.price)}</div>

      <div class="product-actions">
        <button
          class="btn primary full"
          type="button"
          data-action="add"
          data-product-id="${product.id}"
        >Ajouter au panier</button>
      </div>
    </article>
  `;
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * @param {string} category
 */
function renderProducts(category = selectedCategory) {
  const grid = document.getElementById("productGrid");

  if (!grid) {
    return;
  }

  const products = category === "all"
    ? PRODUCTS
    : PRODUCTS.filter((product) => product.category === category);

  grid.innerHTML = products.map(productCardHTML).join("");
}

/**
 * @returns {number}
 */
function getSubtotal() {
  return cart.reduce((total, item) => {
    const product = getProduct(item.productId);
    return product ? total + product.price * item.quantity : total;
  }, 0);
}

/**
 * @returns {number}
 */
function getDiscount() {
  return Math.round(getSubtotal() * (appliedPromo.percent / 100));
}

/**
 * @returns {number}
 */
function getTotal() {
  return Math.max(0, getSubtotal() - getDiscount());
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const subtotalElement = document.getElementById("subtotal");
  const discountElement = document.getElementById("discount");
  const totalElement = document.getElementById("total");
  const cartCount = document.getElementById("cartCount");

  if (!container || !subtotalElement || !discountElement || !totalElement || !cartCount) {
    return;
  }

  const validItems = cart.filter((item) => Boolean(getProduct(item.productId)));

  if (validItems.length === 0) {
    container.innerHTML = `<div class="empty-box">Votre panier est vide.</div>`;
  } else {
    container.innerHTML = validItems.map((item) => {
      const product = getProduct(item.productId);

      if (!product) {
        return "";
      }

      return `
        <div class="cart-item">
          <div class="cart-item-icon">${product.icon}</div>

          <div class="cart-item-info">
            <h3>${escapeHTML(product.name)}</h3>
            <p>${formatPrice(product.price)} l'unité</p>
          </div>

          <div class="quantity">
            <button type="button" data-action="quantity" data-product-id="${product.id}" data-amount="-1">−</button>
            <strong>${item.quantity}</strong>
            <button type="button" data-action="quantity" data-product-id="${product.id}" data-amount="1">+</button>
          </div>

          <strong>${formatPrice(product.price * item.quantity)}</strong>

          <button
            class="remove-btn"
            type="button"
            data-action="remove"
            data-product-id="${product.id}"
          >Supprimer</button>
        </div>
      `;
    }).join("");
  }

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  cartCount.textContent = String(totalQuantity);
  subtotalElement.textContent = formatPrice(getSubtotal());
  discountElement.textContent = appliedPromo.percent > 0 ? `− ${formatPrice(getDiscount())}` : "0 FCFA";
  totalElement.textContent = formatPrice(getTotal());
}

function renderFavorites() {
  const grid = document.getElementById("favoriteGrid");
  const empty = document.getElementById("favoriteEmpty");
  const favoriteCount = document.getElementById("favoriteCount");

  if (!grid || !empty || !favoriteCount) {
    return;
  }

  const favoriteProducts = favorites
    .map((id) => getProduct(id))
    .filter((product) => Boolean(product));

  favoriteCount.textContent = String(favoriteProducts.length);

  if (favoriteProducts.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    grid.innerHTML = favoriteProducts.map(productCardHTML).join("");
  }
}

function renderAccount() {
  const loggedOut = document.getElementById("accountLoggedOut");
  const loggedIn = document.getElementById("accountLoggedIn");
  const nameElement = document.getElementById("accountName");
  const emailElement = document.getElementById("accountEmail");

  if (!loggedOut || !loggedIn || !nameElement || !emailElement) {
    return;
  }

  const user = users.find((entry) => entry.email === currentUserEmail);

  if (!user) {
    currentUserEmail = null;
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    loggedOut.classList.remove("hidden");
    loggedIn.classList.add("hidden");
    return;
  }

  loggedOut.classList.add("hidden");
  loggedIn.classList.remove("hidden");
  nameElement.textContent = user.name;
  emailElement.textContent = user.email;
}

function renderOrders() {
  const list = document.getElementById("ordersList");

  if (!list) {
    return;
  }

  const userOrders = orders.filter((order) => order.email === currentUserEmail);

  if (userOrders.length === 0) {
    list.innerHTML = `<div class="empty-box">Aucune commande pour le moment.</div>`;
    return;
  }

  list.innerHTML = userOrders.slice().reverse().map((order) => {
    const date = new Date(order.date).toLocaleString("fr-FR");

    return `
      <div class="order">
        <div class="order-head">
          <strong>Commande #${escapeHTML(order.id)}</strong>
          <strong>${formatPrice(order.total)}</strong>
        </div>
        <p class="muted">${escapeHTML(date)} • ${escapeHTML(order.status)} • ${escapeHTML(order.payment)}</p>
        <p class="muted">Téléphone : ${escapeHTML(order.phone)}</p>
      </div>
    `;
  }).join("");
}

function renderAll() {
  renderProducts();
  renderCart();
  renderFavorites();
  renderAccount();
}

async function applyPromo() {
  const input = document.getElementById("promoInput");
  const message = document.getElementById("promoMessage");

  if (!input || !message) {
    return;
  }

  const code = input.value.trim().toUpperCase();

  if (!code) {
    appliedPromo = { code: "", percent: 0 };
    message.textContent = "Entrez un code promo.";
    renderCart();
    return;
  }

  message.textContent = "Vérification...";

  try {
    const response = await fetch(`app.php/api/promo-check?code=${encodeURIComponent(code)}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Code promo invalide.");
    }

    appliedPromo = { code: data.code, percent: data.percent };
    message.textContent = `Code appliqué : −${data.percent} %.`;
    renderCart();
    showToast("Code promo appliqué 🎟️");
  } catch (error) {
    appliedPromo = { code: "", percent: 0 };
    message.textContent = error instanceof Error ? error.message : "Code promo invalide.";
    renderCart();
  }
}

function openPayment() {
  if (cart.length === 0) {
    showToast("Votre panier est vide.");
    return;
  }

  const paymentSection = document.getElementById("payment");
  const paymentTotal = document.getElementById("paymentTotal");

  if (!paymentSection || !paymentTotal) {
    return;
  }

  paymentTotal.textContent = formatPrice(getTotal());
  paymentSection.classList.remove("hidden");
  paymentSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitPayment() {
  if (!currentUserEmail) {
    showToast("Connectez-vous avant de commander.");
    document.getElementById("compte")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (cart.length === 0) {
    showToast("Votre panier est vide.");
    return;
  }

  const phoneInput = document.getElementById("customerPhone");
  const message = document.getElementById("paymentMessage");

  if (!(phoneInput instanceof HTMLInputElement) || !message) {
    return;
  }

  const phone = phoneInput.value.trim();

  if (!/^[0-9]{8,15}$/.test(phone)) {
    message.textContent = "Entrez un numéro valide composé uniquement de chiffres.";
    return;
  }

  const submitButton = document.querySelector("#paymentForm button[type='submit']");
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
    submitButton.textContent = "Création de la commande…";
  }

  try {
    const response = await fetch("app.php/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentUserEmail,
        phone: phone,
        promo: appliedPromo.code || "",
        items: cart.map((item) => ({
          id: item.productId,
          quantity: item.quantity
        }))
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Impossible de créer la commande.");
    }

    const order = {
      id: data.order_id,
      date: new Date().toISOString(),
      total: data.total,
      payment: "Orange Money",
      phone: phone,
      items: cart.map((item) => ({ ...item })),
      status: "Paiement à vérifier",
      email: currentUserEmail
    };

    orders.push(order);
    saveJSON(STORAGE_KEYS.orders, orders);

    cart = [];
    appliedPromo = { code: "", percent: 0 };
    saveJSON(STORAGE_KEYS.cart, cart);

    phoneInput.value = "";

    const hasLink = typeof data.orange_link === "string" && data.orange_link.trim() !== "";

    message.innerHTML =
      `Commande <strong>${escapeHTML(data.order_id)}</strong> créée.<br>` +
      `💰 Montant : <strong>${formatPrice(data.total)}</strong><br>` +
      (hasLink
        ? `🟠 Clique sur le bouton ci-dessous pour payer via Orange Money.<br>`
        : `🟠 Envoie exactement ce montant au numéro Orange Money : ` +
          `<strong>${escapeHTML(data.orange_number)}</strong><br>`) +
      `Puis clique sur <strong>« J'ai effectué le paiement »</strong> après ton transfert.`;

    const oldPayLink = document.querySelector('[data-transient="orange-pay-link"]');
    oldPayLink?.remove();

    if (hasLink) {
      const payLink = document.createElement("a");
      payLink.href = data.orange_link;
      payLink.target = "_blank";
      payLink.rel = "noopener noreferrer";
      payLink.className = "btn primary full";
      payLink.style.marginTop = "10px";
      payLink.style.display = "block";
      payLink.style.textAlign = "center";
      payLink.textContent = "🟠 Payer via Orange Money";
      payLink.dataset.transient = "orange-pay-link";
      message.after(payLink);
    }

    const paymentForm = document.getElementById("paymentForm");
    if (paymentForm) {
      const oldConfirm = paymentForm.querySelector(".manual-orange-confirm");
      oldConfirm?.remove();

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "btn secondary full manual-orange-confirm";
      confirm.textContent = "✅ J'ai effectué le paiement";
      confirm.addEventListener("click", async () => {
        confirm.disabled = true;
        confirm.textContent = "Envoi…";

        try {
          const r = await fetch("app.php/api/mark-paid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: data.order_id })
          });
          const result = await r.json();

          if (!r.ok || !result.success) {
            throw new Error(result.error || "Erreur.");
          }

          const localOrder = orders.find((o) => o.id === data.order_id);
          if (localOrder) {
            localOrder.status = "Paiement à vérifier";
            saveJSON(STORAGE_KEYS.orders, orders);
          }

          message.innerHTML =
            `📩 <strong>Paiement signalé.</strong><br>` +
            `Commande : <strong>${escapeHTML(data.order_id)}</strong><br>` +
            `L'administration va vérifier le paiement sur Orange Money avant de valider la commande.`;

          confirm.remove();
          document.querySelector('[data-transient="orange-pay-link"]')?.remove();
          renderOrders();
          showToast("Paiement signalé 📩");
        } catch (error) {
          confirm.disabled = false;
          confirm.textContent = "✅ J'ai effectué le paiement";
          message.textContent = error instanceof Error ? error.message : "Une erreur est survenue.";
        }
      });

      paymentForm.appendChild(confirm);
    }

    renderAll();
    renderOrders();
    showToast("Commande créée 📦");
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "Une erreur est survenue.";
    showToast("Impossible de créer la commande.");
  } finally {
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
      submitButton.textContent = "Créer la commande";
    }
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function loginUser() {
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const message = document.getElementById("loginMessage");

  if (!(emailInput instanceof HTMLInputElement) ||
      !(passwordInput instanceof HTMLInputElement) ||
      !message) {
    return;
  }

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  const user = users.find((entry) => entry.email === email && entry.password === password);

  if (!user) {
    message.textContent = "Email ou mot de passe incorrect.";
    return;
  }

  currentUserEmail = user.email;
  localStorage.setItem(STORAGE_KEYS.currentUser, user.email);

  message.textContent = "";
  emailInput.value = "";
  passwordInput.value = "";

  renderAll();
  showToast(`Bienvenue ${user.name} 👋`);
}

function registerUser() {
  const nameInput = document.getElementById("registerName");
  const emailInput = document.getElementById("registerEmail");
  const passwordInput = document.getElementById("registerPassword");
  const message = document.getElementById("registerMessage");

  if (!(nameInput instanceof HTMLInputElement) ||
      !(emailInput instanceof HTMLInputElement) ||
      !(passwordInput instanceof HTMLInputElement) ||
      !message) {
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (password.length < 6) {
    message.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
    return;
  }

  if (users.some((entry) => entry.email === email)) {
    message.textContent = "Un compte existe déjà avec cet email.";
    return;
  }

  /** @type {User} */
  const user = { name, email, password };

  users.push(user);
  saveJSON(STORAGE_KEYS.users, users);

  currentUserEmail = email;
  localStorage.setItem(STORAGE_KEYS.currentUser, email);

  nameInput.value = "";
  emailInput.value = "";
  passwordInput.value = "";
  message.textContent = "";

  renderAll();
  showToast("Compte créé avec succès ✅");
}

function logoutUser() {
  currentUserEmail = null;
  localStorage.removeItem(STORAGE_KEYS.currentUser);
  document.getElementById("ordersPanel")?.classList.add("hidden");
  renderAll();
  showToast("Vous êtes déconnecté.");
}

function toggleOrders() {
  const panel = document.getElementById("ordersPanel");

  if (!panel) {
    return;
  }

  renderOrders();
  panel.classList.toggle("hidden");
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem(STORAGE_KEYS.theme, isLight ? "light" : "dark");

  const themeButton = document.getElementById("themeBtn");
  if (themeButton) {
    themeButton.textContent = isLight ? "☀️" : "🌙";
  }
}

function loadTheme() {
  const theme = localStorage.getItem(STORAGE_KEYS.theme);
  const themeButton = document.getElementById("themeBtn");

  if (theme === "light") {
    document.body.classList.add("light");
  }

  if (themeButton) {
    themeButton.textContent = theme === "light" ? "☀️" : "🌙";
  }
}

function setupEvents() {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const actionElement = event.target.closest("[data-action]");

    if (!actionElement) {
      return;
    }

    const action = actionElement.getAttribute("data-action");
    const productId = Number(actionElement.getAttribute("data-product-id"));

    if (!Number.isInteger(productId)) {
      return;
    }

    if (action === "add") {
      addToCart(productId);
    }

    if (action === "favorite") {
      toggleFavorite(productId);
    }

    if (action === "remove") {
      removeFromCart(productId);
    }

    if (action === "quantity") {
      const amount = Number(actionElement.getAttribute("data-amount"));
      if (Number.isInteger(amount)) {
        changeQuantity(productId, amount);
      }
    }
  });

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.getAttribute("data-category");

      if (!category) {
        return;
      }

      selectedCategory = category;

      document.querySelectorAll(".filter-btn").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      renderProducts();
    });
  });

  document.getElementById("promoBtn")?.addEventListener("click", applyPromo);
  document.getElementById("checkoutBtn")?.addEventListener("click", openPayment);
  document.getElementById("paymentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitPayment();
  });

  document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    loginUser();
  });

  document.getElementById("registerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    registerUser();
  });

  document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);
  document.getElementById("ordersBtn")?.addEventListener("click", toggleOrders);
  document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);

  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("mainNav")?.classList.toggle("open");
  });

  document.querySelectorAll(".nav a").forEach((link) => {
    link.addEventListener("click", () => {
      document.getElementById("mainNav")?.classList.remove("open");
    });
  });
}

function init() {
  loadTheme();
  setupEvents();
  renderAll();
  renderOrders();

  const year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
}

document.addEventListener("DOMContentLoaded", init);
