document.addEventListener("DOMContentLoaded", () => {
  // Overlay cart (header)
  initCartOverlay();

  // Ejecuta lo que corresponda según la página
  initGalleryPage();
  initProductDetailsPage();
});

/* =========================
   CART OVERLAY (LEFT)
   ========================= */
function initCartOverlay() {
  const openBtn = document.querySelector(".shopping-car-button");
  const overlay = document.getElementById("cartOverlay");
  const backdrop = document.getElementById("cartBackdrop");
  const closeBtn = document.getElementById("cartCloseBtn");

  // Si en esta página no existe el botón/overlay, no hace nada
  if (!openBtn || !overlay || !backdrop || !closeBtn) return;

  const openCart = () => {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;

    // Evita scroll del body
    document.body.style.overflow = "hidden";
  };

  const closeCart = () => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;

    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openCart();
  });

  closeBtn.addEventListener("click", closeCart);

  backdrop.addEventListener("click", closeCart);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) {
      closeCart();
    }
  });
}

/* =========================
   GALERÍA (index.html)
   ========================= */
async function initGalleryPage() {
  const gallery = document.getElementById("merchGallery");
  const template = document.getElementById("merchCardTemplate");

  if (!gallery || !template) return;

  try {
    const res = await fetch("/api/products");
    if (!res.ok) throw new Error("Failed to fetch products");

    const products = await res.json();
    gallery.innerHTML = "";

    products.forEach((product) => {
      const clone = template.content.cloneNode(true);

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
          span.className = "retired-tag-style";
          span.textContent = "Retired";
        } else if (t === "preorder") {
          span.className = "preorder-tag-style";
          span.textContent = "Preorder";
        } else if (t === "special edition") {
          span.className = "preorder-tag-style";
          span.textContent = "Special Edition";
        } else {
          span.className = "preorder-tag-style";
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
        console.log("Add to cart:", product.id);
      });

      gallery.appendChild(clone);
    });
  } catch (err) {
    console.error(err);
    gallery.innerHTML = `<p style="padding: 2rem; font-family: Inter, sans-serif;">Error loading products.</p>`;
  }
}

/* =========================
   DETALLE (products.html)
   ========================= */
async function initProductDetailsPage() {
  const mainRetail = document.querySelector(".main-retail-content");
  if (!mainRetail) return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  if (!productId) return;

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`);
    if (!res.ok) throw new Error("Product not found");
    const product = await res.json();

    const breadcrumbStrong = document.querySelector(".name-product strong");
    if (breadcrumbStrong) breadcrumbStrong.textContent = product.name;

    const leftImg = document.querySelector(".left-retail-side img");
    if (leftImg) {
      leftImg.src = product.image;
      leftImg.alt = product.name;
    }

    const typeLineEl = document.querySelector(".type-style");
    if (typeLineEl && product.typeLine) typeLineEl.textContent = product.typeLine;

    const h1 = document.querySelector(".r-top-retail-side h1");
    if (h1) h1.textContent = product.name;

    const priceSpan = document.querySelector(".r-mid-retail-side > span");
    if (priceSpan) priceSpan.textContent = `$${Number(product.price).toFixed(2)}`;

    const tagsContainer = document.querySelector(".product-tags");
    if (tagsContainer) {
      tagsContainer.innerHTML = "";
      (product.tags || []).forEach((tag) => {
        const span = document.createElement("span");
        const t = String(tag).toLowerCase();

        if (t === "new") {
          span.className = "new-tag-style";
          span.textContent = "New";
        } else if (t === "special edition") {
          span.className = "special-edition-tag";
          span.textContent = "Special Edition";
        } else {
          span.className = "special-edition-tag";
          span.textContent = tag;
        }

        tagsContainer.appendChild(span);
      });
    }

    const fulfillmentStrong = document.querySelector(".stock-main-container strong");
    if (fulfillmentStrong && product.fulfillment) fulfillmentStrong.textContent = product.fulfillment;

    const stockText = document.querySelector(".out-stock-style");
    const fastCart = document.querySelector(".fast-shopping-car");
    const inStock = Number(product.stock) > 0;

    if (stockText) stockText.textContent = inStock ? "Add To Cart" : "Out Of Stock";
    if (fastCart) fastCart.style.display = inStock ? "flex" : "none";

    const descP = document.querySelector(".description-style p");
    if (descP && product.description) descP.textContent = product.description;
  } catch (err) {
    console.error(err);
  }
}
