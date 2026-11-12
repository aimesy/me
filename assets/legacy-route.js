// Keep shared links and bookmarks working after the move to directory URLs.
(() => {
  const route = document.documentElement.dataset.redirectTo;
  if (!route) return;
  window.location.replace(`${route}${window.location.search}${window.location.hash}`);
})();
