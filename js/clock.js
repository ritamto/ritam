/* =====================================================
   LIVE DATE AND TIME (top of the page)
   ===================================================== */
function updateTime() {
  var now = new Date();
  $("dateTime").textContent = now.toLocaleString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit"
  });
}
updateTime();
setInterval(updateTime, 1000);   // refresh every second
