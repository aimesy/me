// Temporary: switches preview.html between category bar options.
// ?bar=current|a|b|c|d|e&sticky=on|off keeps a choice across reloads and tabs.
(() => {
  const OPTIONS = [
    ["current", "Now", "Current branch: underline tabs"],
    ["a", "A", "Segmented buttons"],
    ["b", "B", "Label and rule, quiet links on the right"],
    ["c", "C", "Dark strip"],
    ["d", "D", "Serif title, small links on the right"],
    ["e", "E", "One bar under the header, plain group labels"],
  ];
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const state = {
    bar: OPTIONS.some(([key]) => key === params.get("bar")) ? params.get("bar") : "current",
    sticky: params.get("sticky") === "off" ? "off" : "on",
  };

  function apply() {
    root.dataset.bar = state.bar;
    root.dataset.sticky = state.sticky;
    const url = new URL(location.href);
    url.searchParams.set("bar", state.bar);
    url.searchParams.set("sticky", state.sticky);
    history.replaceState(null, "", url);
    document.querySelectorAll("[data-pv-bar]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.pvBar === state.bar));
    });
    const sticky = document.querySelector("[data-pv-sticky]");
    if (sticky) {
      sticky.setAttribute("aria-pressed", String(state.sticky === "on"));
      sticky.textContent = state.sticky === "on" ? "Sticky: on" : "Sticky: off";
    }
    const note = document.querySelector("[data-pv-note]");
    if (note) note.textContent = OPTIONS.find(([key]) => key === state.bar)[2];
    updateSubnav();
  }

  // Option E's single bar, highlighting the group in view.
  const subnav = document.createElement("nav");
  subnav.className = "pv-subnav";
  subnav.setAttribute("aria-label", "Project categories");
  subnav.innerHTML = '<span class="pv-subnav-label">Jump to</span>'
    + [...document.querySelectorAll(".project-group")]
      .map((group) => `<a href="#${group.id}">${group.querySelector(".project-group-head").textContent}</a>`)
      .join("");
  document.querySelector("header").after(subnav);

  function updateSubnav() {
    if (state.bar !== "e") return;
    // A group is current once its top reaches just under the bar; the last,
    // short group can't scroll that far, so the page bottom selects it.
    const line = subnav.getBoundingClientRect().bottom + 16;
    const groups = [...document.querySelectorAll(".project-group")];
    let current = groups[0];
    groups.forEach((group) => {
      if (group.getBoundingClientRect().top <= line) current = group;
    });
    if (Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2) current = groups.at(-1);
    subnav.querySelectorAll("a").forEach((link) => {
      if (link.getAttribute("href") === `#${current.id}`) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }
  addEventListener("scroll", updateSubnav, { passive: true });
  addEventListener("resize", updateSubnav);

  const switcher = document.createElement("div");
  switcher.className = "pv-switcher";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "Bar preview");
  switcher.innerHTML = `
    <div class="pv-head"><span>Bar preview</span><button type="button" data-pv-collapse aria-expanded="true">Hide</button></div>
    <div class="pv-row">${OPTIONS.map(([key, label, title]) => `<button type="button" data-pv-bar="${key}" title="${title}">${label}</button>`).join("")}</div>
    <div class="pv-row"><button type="button" data-pv-sticky></button><span class="pv-note" data-pv-note></span></div>`;
  document.body.append(switcher);
  switcher.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.pvBar) state.bar = button.dataset.pvBar;
    if (button.hasAttribute("data-pv-sticky")) state.sticky = state.sticky === "on" ? "off" : "on";
    if (button.hasAttribute("data-pv-collapse")) {
      const collapsed = switcher.dataset.collapsed !== "true";
      switcher.dataset.collapsed = String(collapsed);
      button.textContent = collapsed ? "Show" : "Hide";
      button.setAttribute("aria-expanded", String(!collapsed));
      return;
    }
    apply();
  });

  apply();
})();
