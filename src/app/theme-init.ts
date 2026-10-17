export const themeInitScript = `(function () {
  try {
    var KEY = "soli-theme";
    var root = document.documentElement;
    var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    var stored = null;
    try {
      var value = window.localStorage.getItem(KEY);
      if (value === "light" || value === "dark") {
        stored = value;
      }
    } catch (error) {
      // localStorage access can throw in private browsing.
    }
    var theme = stored !== null ? stored : (darkQuery.matches ? "dark" : "light");
    function apply(next) {
      root.dataset.theme = next;
      root.style.colorScheme = next;
    }
    apply(theme);
    if (stored === null) {
      var onChange = function (event) {
        apply(event.matches ? "dark" : "light");
      };
      darkQuery.addEventListener("change", onChange);
    }
  } catch (error) {
    // Never block first paint on theme setup failures.
  }
})();`;
