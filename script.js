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
  // UI: Cart Overlay
  // =========================
  const cartOverlay = document.getElementById("cartOverlay");
  const cartBackdrop = document.getElementById("cartBackdrop");
  const cartCloseBtn = document.getElementById("cartCloseBtn");
  const cartBody = document.getElementById("cartBody");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartItemTemplate = document.getElementById("cartItemTemplate");
  const headerCartBtn = document.querySelector(".shopping-car-button");

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
  async function fetchProductById(id) {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  }

  async function renderCart() {
    if (!cartBody || !cartItemTemplate) return;

    const cart = getCart();
    cartBody.innerHTML = "";

    if (!cart.length) {
      cartBody.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
      if (cartTotalEl) cartTotalEl.textContent = "$0.00";
      return;
    }

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
  // Gallery (index.html)
  // =========================
  const gallery = document.getElementById("merchGallery");
  const merchTemplate = document.getElementById("merchCardTemplate");

  if (gallery && merchTemplate) {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const products = await res.json();

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

  // =========================
  // Products page (products.html) ✅ YA FUNCIONA
  // =========================
  const url = new URL(window.location.href);
  const productId = url.searchParams.get("id");

  const productPage = document.querySelector(".main-retail-content");
  if (productPage && productId) {
    const product = await fetchProductById(productId);

    if (!product) {
      productPage.innerHTML = `<p style="padding:2rem;font-family:Inter,sans-serif;">Product not found.</p>`;
      return;
    }

    // ✅ Referencias (usa tus clases actuales)
    const breadcrumbStrong = document.querySelector(".name-product strong");
    const leftImg = document.querySelector(".left-retail-side img");
    const titleH1 = document.querySelector(".r-top-retail-side h1");
    const priceSpan = document.querySelector(".r-mid-retail-side > span");
    const productTags = document.querySelector(".product-tags");
    const stockText = document.querySelector(".stock-style .out-stock-style");

    // ✅ set data
    if (breadcrumbStrong) breadcrumbStrong.textContent = product.name;
    if (leftImg) {
      leftImg.src = product.image;
      leftImg.alt = product.name;
    }
    if (titleH1) titleH1.textContent = product.name;
    if (priceSpan) priceSpan.textContent = `$${Number(product.price).toFixed(2)}`;

    // Tags arriba (reusa tus estilos)
    if (productTags) {
      productTags.innerHTML = "";
      (product.tags || []).forEach((tag) => {
        const t = String(tag).toLowerCase();
        const span = document.createElement("span");

        if (t === "new") {
          span.className = "new-tag-style";
          span.textContent = "New";
        } else if (t === "retired") {
          span.className = "retired-tag-style"; // si no tienes retired style aquí, puedes cambiarlo
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

    // Stock
    const inStock = Number(product.stock) > 0;
    if (stockText) stockText.textContent = inStock ? "Add To Cart" : "Out Of Stock";

    // ✅ BOTÓN "Out of stock / Add to cart" (tu span out-stock-style)
    // lo volvemos clickeable si hay stock
    if (stockText) {
      stockText.style.cursor = inStock ? "pointer" : "not-allowed";
      stockText.addEventListener("click", () => {
        if (!inStock) return;

        // Tamaño seleccionado
        const selectedSize = document.querySelector('input[name="size"]:checked')?.value || "S";

        addToCart({ id: product.id, size: selectedSize, qty: 1 });
        renderCart();
        openCart();
      });
    }
  }
  const selectedSizeStrong = document.querySelector("#selectedSize strong");
  const sizeRadios = document.querySelectorAll('input[name="size"]');

  function updateSelectedSize() {
    const checked = document.querySelector('input[name="size"]:checked');
    if (!checked || !selectedSizeStrong) return;
    selectedSizeStrong.textContent = checked.value;
  }

  // Cambia cuando seleccionas una talla
  sizeRadios.forEach((radio) => {
    radio.addEventListener("change", updateSelectedSize);
  });

  // Set inicial (por si el HTML viene ya con checked)
  updateSelectedSize();
});
