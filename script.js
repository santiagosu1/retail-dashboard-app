// script.js (ESM)
document.addEventListener("DOMContentLoaded", async () => {
  // =========================
  // Helpers: Cart (localStorage)
  // =========================
  const CART_KEY = "arcane_cart_v1";

  const getCart = () => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  };

  const saveCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  };

  const clearCart = () => saveCart([]);

  const addToCart = (item) => {
    const cart = getCart();
    const idx = cart.findIndex((x) => x.id === item.id && x.size === item.size);
    if (idx >= 0) cart[idx].qty += item.qty;
    else cart.push(item);
    saveCart(cart);
  };

  const removeFromCart = (id, size) => {
    const cart = getCart().filter((x) => !(x.id === id && x.size === size));
    saveCart(cart);
  };

  const incQty = (id, size) => {
    const cart = getCart();
    const it = cart.find((x) => x.id === id && x.size === size);
    if (it) it.qty += 1;
    saveCart(cart);
  };

  // =========================
  // Helpers: Products API
  // =========================
  async function fetchProducts() {
    const res = await fetch("/api/products");
    if (!res.ok) return [];
    return res.json();
  }

  async function fetchProductById(id) {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  }

  // =========================
  // Helpers: Sales (localStorage)  ✅ (no necesitas /api/sales)
  // =========================
  const SALES_KEY = "arcane_sales_v1";

  function getSales() {
    try {
      return JSON.parse(localStorage.getItem(SALES_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSales(sales) {
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  }

  function addSalesFromCheckoutItems(items) {
    const sales = getSales();
    items.forEach((it) => {
      const id = String(it.id || "").trim();
      const qty = Number(it.qty || 0);
      if (!id || !Number.isFinite(qty) || qty <= 0) return;
      sales[id] = Number(sales[id] || 0) + qty;
    });
    saveSales(sales);
  }

  // =========================
  // UI: Cart Overlay
  // =========================
  const cartOverlay = document.getElementById("cartOverlay");
  const cartBackdrop = document.getElementById("cartBackdrop");
  const cartCloseBtn = document.getElementById("cartCloseBtn");
  const cartBody = document.getElementById("cartBody");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartItemTemplate = document.getElementById("cartItemTemplate");
  const headerCartBtn = document.querySelector(".shopping-car-button");
  const checkoutBtn = document.querySelector(".cart-checkout-btn");

  function openCart() {
    if (!cartOverlay || !cartBackdrop) return;
    cartOverlay.classList.add("is-open");
    cartOverlay.setAttribute("aria-hidden", "false");
    cartBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    if (!cartOverlay || !cartBackdrop) return;
    cartOverlay.classList.remove("is-open");
    cartOverlay.setAttribute("aria-hidden", "true");
    cartBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  headerCartBtn?.addEventListener("click", () => {
    if (!cartOverlay) return;
    const isOpen = cartOverlay.classList.contains("is-open");
    if (isOpen) closeCart();
    else {
      renderCart();
      openCart();
    }
  });

  cartCloseBtn?.addEventListener("click", closeCart);
  cartBackdrop?.addEventListener("click", closeCart);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cartOverlay?.classList.contains("is-open")) {
      closeCart();
    }
  });

  // =========================
  // Render Cart
  // =========================
  async function renderCart() {
    if (!cartBody || !cartItemTemplate) return;

    const cart = getCart();
    cartBody.innerHTML = "";

    if (!cart.length) {
      cartBody.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
      if (cartTotalEl) cartTotalEl.textContent = "$0.00";
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    // enable checkout (validaremos stock al hacer checkout)
    if (checkoutBtn) checkoutBtn.disabled = false;

    const detailed = await Promise.all(
      cart.map(async (c) => {
        const product = await fetchProductById(c.id);
        return { ...c, product };
      })
    );

    let total = 0;

    detailed.forEach((item) => {
      if (!item.product) return;

      const clone = cartItemTemplate.content.cloneNode(true);

      const root = clone.querySelector("[data-cart-item]");
      const img = clone.querySelector("[data-cart-image]");
      const name = clone.querySelector("[data-cart-name]");
      const price = clone.querySelector("[data-cart-price]");
      const size = clone.querySelector("[data-cart-size]");
      const qty = clone.querySelector("[data-cart-qty]");
      const btnRemove = clone.querySelector("[data-cart-remove]");
      const btnInc = clone.querySelector("[data-cart-inc]");

      root.dataset.id = item.id;
      root.dataset.size = item.size;

      img.src = item.product.image;
      img.alt = item.product.name;

      name.textContent = item.product.name;
      price.textContent = `$${Number(item.product.price).toFixed(2)}`;
      size.textContent = item.size || "S";
      qty.textContent = String(item.qty);

      total += Number(item.product.price) * Number(item.qty);

      btnRemove?.addEventListener("click", () => {
        removeFromCart(item.id, item.size);
        renderCart();
        // charts / gallery might depend on cart? not necessary
      });

      btnInc?.addEventListener("click", () => {
        incQty(item.id, item.size);
        renderCart();
      });

      cartBody.appendChild(clone);
    });

    if (cartTotalEl) cartTotalEl.textContent = `$${total.toFixed(2)}`;
  }

  // =========================
  // Checkout: RESTA STOCK en server + guarda "ventas" local
  // =========================
  async function checkout() {
    const items = getCart();
    if (!items.length) return;

    try {
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = "Processing...";
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Checkout failed:", data);

        // Mensaje simple (si quieres, luego lo hacemos UI bonito)
        const msg =
          data?.error ||
          "Checkout failed. Please check stock and try again.";
        alert(msg);
        return;
      }

      // ✅ ventas (local)
      addSalesFromCheckoutItems(items);

      // ✅ limpiar carrito
      clearCart();

      // ✅ refrescar UI
      await renderCart();

      // ✅ refrescar stock en páginas (si estás en products.html)
      await refreshProductPageAfterCheckout();

      // ✅ refrescar galería (si estás en index.html)
      await refreshGalleryAfterCheckout();

      // ✅ refrescar charts (si existen)
      await renderChartsOnIndex();

      alert("Checkout successful!");
      closeCart();
    } finally {
      if (checkoutBtn) {
        checkoutBtn.disabled = getCart().length === 0;
        checkoutBtn.textContent = "Checkout";
      }
    }
  }

  checkoutBtn?.addEventListener("click", checkout);

  // =========================
  // Gallery (index.html)
  // =========================
  const gallery = document.getElementById("merchGallery");
  const merchTemplate = document.getElementById("merchCardTemplate");

  async function renderGallery() {
    if (!gallery || !merchTemplate) return;

    try {
      const products = await fetchProducts();
      gallery.innerHTML = "";

      products.forEach((product) => {
        const clone = merchTemplate.content.cloneNode(true);

        const card = clone.querySelector(".card-design");
        const nameEl = clone.querySelector("[data-name]");
        const priceEl = clone.querySelector("[data-price]");
        const imgEl = clone.querySelector("[data-image]");
        const tagsEl = clone.querySelector("[data-tags]");
        const addBtn = clone.querySelector("[data-add-to-cart]");

        card.dataset.productId = product.id;
        nameEl.textContent = product.name;
        priceEl.textContent = `$${Number(product.price).toFixed(2)}`;
        imgEl.src = product.image;
        imgEl.alt = product.name;

        tagsEl.innerHTML = "";
        (product.tags || []).forEach((tag) => {
          const span = document.createElement("span");
          const t = String(tag).toLowerCase();

          if (t === "new") {
            span.className = "new-tag-dashboard-style";
            span.textContent = "New";
          } else if (t === "retired") {
            span.className = "retired-tag-style-dashboard";
            span.textContent = "Retired";
          } else if (t === "preorder") {
            span.className = "preorder-tag-dashboard-style";
            span.textContent = "Preorder";
          } else {
            span.className = "preorder-tag-dashboard-style";
            span.textContent = tag;
          }

          tagsEl.appendChild(span);
        });

        const inStock = Number(product.stock) > 0;
        addBtn.disabled = !inStock;
        addBtn.title = inStock ? "Add to cart" : "Out of stock";

        card.style.cursor = "pointer";
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-add-to-cart]")) return;
          window.location.href = `products.html?id=${encodeURIComponent(product.id)}`;
        });

        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!inStock) return;

          addToCart({ id: product.id, size: "S", qty: 1 });
          renderCart();
          openCart();
        });

        gallery.appendChild(clone);
      });
    } catch (err) {
      console.error(err);
      gallery.innerHTML = `<p style="padding: 2rem; font-family: Inter, sans-serif;">Error loading products.</p>`;
    }
  }

  async function refreshGalleryAfterCheckout() {
    // Solo si existe la galería
    if (!gallery || !merchTemplate) return;
    await renderGallery();
  }

  if (gallery && merchTemplate) {
    await renderGallery();
  }

  // =========================
  // Products page (products.html)
  // =========================
  const url = new URL(window.location.href);
  const productId = url.searchParams.get("id");

  async function renderProductPage(product) {
    // Referencias
    const breadcrumbStrong = document.querySelector(".name-product strong");
    const leftImg = document.querySelector(".left-retail-side img");
    const typeSpan = document.querySelector("[data-product-type]");
    const titleH1 = document.querySelector(".r-top-retail-side h1");
    const priceSpan = document.querySelector(".r-mid-retail-side > span");
    const productTags = document.querySelector(".product-tags");
    const stockText = document.querySelector(".stock-style .out-stock-style");
    const fulfillmentEl = document.querySelector("[data-product-fulfillment]");
    const descEl = document.querySelector("[data-product-description]");
    const stockInfoEl = document.querySelector("[data-product-stock-info]");

    if (breadcrumbStrong) breadcrumbStrong.textContent = product.name;

    if (leftImg) {
      leftImg.src = product.image;
      leftImg.alt = product.name;
    }

    if (typeSpan) typeSpan.textContent = product.typeLine || "";

    if (titleH1) titleH1.textContent = product.name;

    if (priceSpan) priceSpan.textContent = `$${Number(product.price).toFixed(2)}`;

    if (descEl) descEl.textContent = product.description || "";

    if (fulfillmentEl) fulfillmentEl.textContent = product.fulfillment || "";

    // Tags
    if (productTags) {
      productTags.innerHTML = "";
      (product.tags || []).forEach((tag) => {
        const t = String(tag).toLowerCase();
        const span = document.createElement("span");

        if (t === "new") {
          span.className = "new-tag-style";
          span.textContent = "New";
        } else if (t === "retired") {
          span.className = "retired-tag-style";
          span.textContent = "Retired";
        } else if (t === "preorder") {
          span.className = "preorder-tag-style";
          span.textContent = "Preorder";
        } else {
          span.className = "preorder-tag-style";
          span.textContent = tag;
        }

        productTags.appendChild(span);
      });
    }

    // Stock labels + info
    const stockNum = Number(product.stock || 0);
    const inStock = stockNum > 0;

    if (stockText) stockText.textContent = inStock ? "Add To Cart" : "Out Of Stock";

    if (stockInfoEl) stockInfoEl.textContent = inStock ? `In Stock: ${stockNum}` : "In Stock: 0";

    // Click to add (span out-stock-style)
    if (stockText) {
      stockText.style.cursor = inStock ? "pointer" : "not-allowed";

      // evita acumular listeners si re-renderizas
      stockText.replaceWith(stockText.cloneNode(true));
      const newStockText = document.querySelector(".stock-style .out-stock-style");

      newStockText.style.cursor = inStock ? "pointer" : "not-allowed";
      newStockText.addEventListener("click", () => {
        if (!inStock) return;

        const selectedSize = document.querySelector('input[name="size"]:checked')?.value || "S";
        addToCart({ id: product.id, size: selectedSize, qty: 1 });
        renderCart();
        openCart();
      });
    }
  }

  async function refreshProductPageAfterCheckout() {
    const productPage = document.querySelector(".main-retail-content");
    if (!productPage || !productId) return;

    const fresh = await fetchProductById(productId);
    if (!fresh) return;

    await renderProductPage(fresh);
  }

  const productPage = document.querySelector(".main-retail-content");
  if (productPage && productId) {
    const product = await fetchProductById(productId);

    if (!product) {
      productPage.innerHTML = `<p style="padding:2rem;font-family:Inter,sans-serif;">Product not found.</p>`;
      return;
    }

    await renderProductPage(product);
  }

  // =========================
  // Selected size text (#selectedSize strong)
  // =========================
  const selectedSizeStrong = document.querySelector("#selectedSize strong");
  const sizeRadios = document.querySelectorAll('input[name="size"]');

  function updateSelectedSize() {
    const checked = document.querySelector('input[name="size"]:checked');
    if (!checked || !selectedSizeStrong) return;
    selectedSizeStrong.textContent = checked.value;
  }

  sizeRadios.forEach((radio) => {
    radio.addEventListener("change", updateSelectedSize);
  });

  updateSelectedSize();

  // =========================
  // Reviews (products.html) - localStorage por producto
  // =========================
  const reviewsForm = document.getElementById("reviewForm");
  const reviewsList = document.getElementById("reviewsList");
  const reviewsEmpty = document.getElementById("reviewsEmpty");
  const reviewComment = document.getElementById("reviewComment");
  const reviewError = document.getElementById("reviewError");

  const avgRatingEl = document.getElementById("avgRating");
  const avgStarsEl = document.getElementById("avgStars");
  const reviewsCountEl = document.getElementById("reviewsCount");
  const ratingHint = document.getElementById("ratingHint");

  const REVIEWS_KEY_PREFIX = "arcane_reviews_v1_";

  function getReviewsKey(productId) {
    return `${REVIEWS_KEY_PREFIX}${productId}`;
  }

  function getReviews(productId) {
    try {
      return JSON.parse(localStorage.getItem(getReviewsKey(productId))) || [];
    } catch {
      return [];
    }
  }

  function saveReviews(productId, reviews) {
    localStorage.setItem(getReviewsKey(productId), JSON.stringify(reviews));
  }

  function starsText(n) {
    const full = "★★★★★".slice(0, n);
    const empty = "☆☆☆☆☆".slice(0, 5 - n);
    return full + empty;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderReviews(productId) {
    if (!reviewsList || !avgRatingEl || !avgStarsEl || !reviewsCountEl) return;

    const reviews = getReviews(productId);
    const count = reviews.length;
    const avg = count ? (reviews.reduce((a, r) => a + r.rating, 0) / count) : 0;

    avgRatingEl.textContent = avg.toFixed(1);
    avgStarsEl.textContent = starsText(Math.round(avg));
    reviewsCountEl.textContent = `${count} review${count === 1 ? "" : "s"}`;

    reviewsList.innerHTML = "";
    if (!count) {
      if (reviewsEmpty) reviewsList.appendChild(reviewsEmpty);
      return;
    }

    reviews.forEach((r) => {
      const card = document.createElement("div");
      card.className = "review-card";

      card.innerHTML = `
        <div class="review-card-top">
          <div class="review-card-stars">${starsText(r.rating)}</div>
          <div class="review-card-date">${formatDate(r.createdAt)}</div>
        </div>
        <div class="review-card-text"></div>
      `;

      card.querySelector(".review-card-text").textContent = r.comment;
      reviewsList.appendChild(card);
    });
  }

  function getSelectedRating() {
    const checked = document.querySelector('input[name="rating"]:checked');
    return checked ? Number(checked.value) : 0;
  }

  function updateRatingHint() {
    if (!ratingHint) return;
    const r = getSelectedRating();
    ratingHint.textContent = r ? `You selected ${r} star${r === 1 ? "" : "s"}` : "Select a rating";
  }

  document.querySelectorAll('input[name="rating"]').forEach((r) => {
    r.addEventListener("change", updateRatingHint);
  });

  if (productId && reviewsForm && reviewsList) {
    renderReviews(productId);
    updateRatingHint();

    reviewsForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const rating = getSelectedRating();
      const comment = (reviewComment?.value || "").trim();

      if (!rating) {
        if (reviewError) reviewError.hidden = false;
        return;
      }
      if (reviewError) reviewError.hidden = true;

      const reviews = getReviews(productId);

      reviews.unshift({
        rating,
        comment,
        createdAt: Date.now(),
      });

      saveReviews(productId, reviews);

      reviewsForm.reset();
      updateRatingHint();
      if (reviewComment) reviewComment.value = "";

      renderReviews(productId);
    });
  }

  // =========================
  // Charts.js (index.html)
  // =========================
  let stockChartInstance = null;
  let salesChartInstance = null;
  let reviewsChartInstance = null;

  function getAvgRating(productId) {
    const reviews = getReviews(productId);
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    return sum / reviews.length;
  }

  async function renderChartsOnIndex() {
    const stockCanvas = document.getElementById("stockChart");
    const salesCanvas = document.getElementById("salesChart");
    const reviewsCanvas = document.getElementById("reviewsChart");

    // Solo corre si estamos en index.html (existen los canvas)
    if (!stockCanvas || !salesCanvas || !reviewsCanvas) return;

    if (typeof Chart === "undefined") {
      console.warn("Chart.js not loaded. Add: <script src='https://cdn.jsdelivr.net/npm/chart.js'></script> before script.js");
      return;
    }

    const products = await fetchProducts();
    const sales = getSales();

    const labels = products.map((p) => p.name);
    const stockData = products.map((p) => Number(p.stock || 0));
    const soldData = products.map((p) => Number(sales[p.id] || 0));
    const avgRatings = products.map((p) => Number(getAvgRating(p.id).toFixed(2)));

    if (stockChartInstance) stockChartInstance.destroy();
    if (salesChartInstance) salesChartInstance.destroy();
    if (reviewsChartInstance) reviewsChartInstance.destroy();

    stockChartInstance = new Chart(stockCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Stock", data: stockData }],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
      },
    });

    salesChartInstance = new Chart(salesCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Units Sold", data: soldData }],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
      },
    });

    reviewsChartInstance = new Chart(reviewsCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Avg Rating (0–5)", data: avgRatings }],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, max: 5 } },
      },
    });
  }

  // pinta charts si estás en index
  await renderChartsOnIndex();

  // Inicial render cart button state
  await renderCart();
});
