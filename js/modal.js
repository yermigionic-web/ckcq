const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[hidden]")) return false;
    return true;
  });
}

export function createModalController(overlay) {
  const dialog = overlay.querySelector("[role='dialog']");
  let lastFocus = null;
  let keyHandler = null;
  let openState = false;

  function trap(event) {
    if (event.key !== "Tab") return;
    const nodes = getFocusable(dialog);
    if (!nodes.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close() {
    if (!openState && overlay.hidden) return;
    openState = false;
    overlay.hidden = true;
    document.body.classList.remove("modal-open");
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
    if (typeof overlay.onModalClose === "function") {
      overlay.onModalClose();
      overlay.onModalClose = null;
    }
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function open({ initialFocus, onClose, onEscape } = {}) {
    lastFocus = document.activeElement;
    openState = true;
    overlay.hidden = false;
    document.body.classList.add("modal-open");
    overlay.onModalClose = onClose || null;

    keyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (typeof onEscape === "function") onEscape();
        else close();
        return;
      }
      trap(event);
    };

    document.addEventListener("keydown", keyHandler);

    window.requestAnimationFrame(() => {
      const target = initialFocus || getFocusable(dialog)[0] || dialog;
      target.focus();
    });
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  return { open, close, overlay, dialog };
}
