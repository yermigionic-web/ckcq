export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export async function loadJSON(relativeFromModule, moduleUrl = import.meta.url) {
  const url = new URL(relativeFromModule, moduleUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url.pathname}`);
  }
  return response.json();
}

export function padNumber(value, size = 2) {
  return String(value).padStart(size, "0");
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function announce(message, region) {
  if (!region) return;
  region.textContent = "";
  window.requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export function asset(path) {
  return new URL(path, import.meta.url).href.replace("/js/", "/");
}

export function svgPath(name) {
  return new URL(`../assets/svg/${name}`, import.meta.url).href;
}

export function initLogoFallbacks(root = document) {
  qsa("[data-logo]", root).forEach((img) => {
    const wrap = img.closest(".brand") || img.parentElement;
    const fallback = wrap?.querySelector(".logo-fallback");
    if (!fallback) return;

    const showImage = () => {
      img.hidden = false;
      img.classList.remove("is-broken");
      fallback.hidden = true;
    };

    const showFallback = () => {
      img.hidden = true;
      img.classList.add("is-broken");
      fallback.hidden = false;
    };

    img.addEventListener("load", showImage);
    img.addEventListener("error", showFallback);

    if (img.complete) {
      if (img.naturalWidth > 0) showImage();
      else showFallback();
    }
  });
}

export function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = Boolean(hidden);
}

export function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function hasFormUrl(url) {
  return typeof url === "string" && /^https?:\/\//.test(url.trim());
}
