/* =====================================================
   7. SCRATCHPAD
   Saves automatically in this browser (not on a server).
   ===================================================== */
var notes = $("notes");
var saveTimer;

// Count words and show a status line
function updateInfo(message) {
  var text = notes.value.trim();
  var words = text === "" ? 0 : text.split(/\s+/).length;
  $("notesInfo").textContent = words + (words === 1 ? " word" : " words") + (message ? " | " + message : "");
}

// Bring back whatever was saved last time
notes.value = memory.get("scratchpad") || "";
updateInfo("");

// Save shortly after you stop typing
notes.addEventListener("input", function () {
  updateInfo("saving...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    memory.set("scratchpad", notes.value);
    updateInfo("saved");
  }, 500);
});

$("copyNotes").onclick = function () {
  if (!navigator.clipboard) { updateInfo("copy not supported here"); return; }
  navigator.clipboard.writeText(notes.value).then(
    function () { updateInfo("copied"); },
    function () { updateInfo("couldn't copy"); }
  );
};

$("downloadNotes").onclick = function () {
  var file = new Blob([notes.value], { type: "text/plain" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "scratchpad.txt";
  link.click();
  URL.revokeObjectURL(link.href);
};

$("clearNotes").onclick = function () {
  if (notes.value === "") return;
  if (confirm("Clear everything in the scratchpad? This can't be undone.")) {
    notes.value = "";
    memory.set("scratchpad", "");
    updateInfo("cleared");
  }
};
