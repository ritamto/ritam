// Small shortcut so we can write $("id") instead of document.getElementById("id")
function $(id) { return document.getElementById(id); }

// Saves a number in the visitor's own browser (for "best" scores).
// If the browser blocks saving, the page still works.
var memory = {
  get: function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set: function (key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
};

// Respect people who turned off animations in their device settings
var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
