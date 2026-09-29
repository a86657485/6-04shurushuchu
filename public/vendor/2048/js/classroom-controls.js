document.querySelectorAll("[data-move]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (window.lessonGame) window.lessonGame.inputManager.emit("move", Number(button.dataset.move));
  });
});

window.addEventListener("message", function (event) {
  if (event.source !== window.parent || event.origin !== window.location.origin) return;
  var data = event.data;
  if (data && data.type === "lesson4-2048-command" && Number.isInteger(data.direction) && data.direction >= 0 && data.direction <= 3 && window.lessonGame) {
    window.lessonGame.inputManager.emit("move", data.direction);
  }
});
