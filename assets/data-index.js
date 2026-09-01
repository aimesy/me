(() => {
  "use strict";
  const prefix = "amyc:data-index:";
  const sections = [...document.querySelectorAll("details[data-persist-open]")];

  function target() {
    if (!window.location.hash) return null;
    try {
      return document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    } catch {
      return null;
    }
  }

  function read(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function write(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* Optional persistence. */ }
  }

  const initialTarget = target();
  for (const section of sections) {
    const key = `${prefix}${section.id}`;
    const saved = read(key);
    if (saved === "open") section.open = true;
    if (saved === "closed") section.open = false;
    if (initialTarget === section || initialTarget?.closest("details") === section) section.open = true;
    section.addEventListener("toggle", () => write(key, section.open ? "open" : "closed"));
  }

  window.addEventListener("hashchange", () => {
    const current = target();
    const owner = current?.matches("details") ? current : current?.closest("details");
    if (owner) owner.open = true;
  });
})();
