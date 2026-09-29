// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  window.lessonGame = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});
