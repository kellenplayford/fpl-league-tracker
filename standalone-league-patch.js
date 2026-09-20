/* v3.6.1 standalone league support */
if (window.FPL_FIXED_LEAGUE) {
  active = String(window.FPL_FIXED_LEAGUE);
  const originalTabs = tabs;
  tabs = function () {
    active = String(window.FPL_FIXED_LEAGUE);
    const nav = document.querySelector("#tabs");
    if (nav) {
      nav.innerHTML = "";
      nav.style.display = "none";
    }
  };
}
