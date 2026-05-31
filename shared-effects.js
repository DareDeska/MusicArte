(function () {
  const root = document.getElementById("impress");
  if (!root || typeof impress !== "function") {
    return;
  }

  // Leggi la cartella immagini dal data attribute del root
  const IMAGES_FOLDER = root.dataset.imagesFolder || 'immagini_1/';
  
  // Popola automaticamente gli src dalle data-image
  document.querySelectorAll('img[data-image]').forEach(function (img) {
    img.src = IMAGES_FOLDER + img.dataset.image;
  });

  const api = impress();
  api.init();

  // Navigazione mobile: tap sullo schermo => step successivo
  const tapToNextEnabled = root.dataset.tapToNext !== "false";
  let lastTouchAdvanceAt = 0;

  // Nasconde il cursore dopo 3 secondi di inattività del mouse (funziona sempre,
  // in qualsiasi browser e modalità, perché non dipende dal rilevamento del fullscreen).
  let cursorHideTimer = null;

  function hideCursor() {
    document.body.style.cursor = "none";
  }

  function resetCursorTimer() {
    document.body.style.cursor = "";
    clearTimeout(cursorHideTimer);
    cursorHideTimer = setTimeout(hideCursor, 3000);
  }

  document.addEventListener("mousemove", resetCursorTimer);
  cursorHideTimer = setTimeout(hideCursor, 3000);

  function isInteractiveTarget(target) {
    return !!target?.closest("a, button, input, textarea, select, label, [data-no-tap-next]");
  }

  function advanceFromTap(event) {
    if (!tapToNextEnabled || isInteractiveTarget(event.target)) {
      return;
    }

    lastTouchAdvanceAt = Date.now();
    api.next();
  }

  if (globalThis.PointerEvent) {
    document.addEventListener("pointerup", function (event) {
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        advanceFromTap(event);
      }
    }, { passive: true });
  } else {
    document.addEventListener("touchend", advanceFromTap, { passive: true });
    document.addEventListener("click", function (event) {
      if (Date.now() - lastTouchAdvanceAt < 500) {
        return;
      }
      advanceFromTap(event);
    }, { passive: true });
  }

  root.addEventListener("impress:stepleave", function (event) {
    const step = event.target;
    if (step.classList.contains("zoom-step") || step.classList.contains("reverse-zoom-step")) {
      step.classList.add("animation-finished");
    }
    event.target.classList.add("leaving");

    // Rimuovi leaving dopo la finestra di overlap visivo
    const leavingStep = event.target;
    setTimeout(function () {
      leavingStep.classList.remove("leaving");
    }, 200);
  });

  // Controllo remoto da schermo 1 tramite postMessage
  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data.cmd !== 'string') return;
    if (event.data.cmd === 'next') api.next();
    if (event.data.cmd === 'prev') api.prev();
  });

  root.addEventListener("impress:stepenter", function (event) {
    const enteringStep = event.target;
    const leavingSteps = root.querySelectorAll(".step.leaving");
    leavingSteps.forEach(function (step) {
      if (step !== enteringStep) {
        step.classList.remove("leaving");
      }
    });

    // Auto-next dichiarativo: lo step decide via attributi data-*
    if (enteringStep.dataset.autoNextOnAnimationEnd === "true") {
      const targetSelector = enteringStep.dataset.autoNextTarget || "img";
      const animationTarget = enteringStep.querySelector(targetSelector);
      const delay = Number(enteringStep.dataset.autoNextDelay || 0);

      if (animationTarget) {
        function onAnimationEnd() {
          // Guard: se lo step non è più attivo (es. navigazione manuale anticipata o
          // Firefox che spara un secondo animationend alla rimozione della classe .active)
          // non avanzare, altrimenti si salta lo step successivo.
          if (!enteringStep.classList.contains("active")) {
            return;
          }

          animationTarget.removeEventListener("animationcancel", onAnimationCancel);

          // Mantiene il transform durante il fade-out.
          // Se c'è un delay, animation-finished viene rimossa dal cleanup
          // sull'impress:stepenter del prossimo step (non con un timeout fisso,
          // che scadrebbe mentre lo step è ancora attivo).
          enteringStep.classList.add("animation-finished");

          if (delay > 0) {
            setTimeout(function () {
              api.next();
            }, delay);
          } else {
            setTimeout(function () {
              enteringStep.classList.remove("animation-finished");
            }, 1000);
            api.next();
          }
        }

        function onAnimationCancel() {
          // L'animazione è stata annullata (es. classe .active rimossa): rimuove
          // il listener animationend per evitare un avanzamento spurio.
          animationTarget.removeEventListener("animationend", onAnimationEnd);
        }

        animationTarget.addEventListener("animationend", onAnimationEnd, { once: true });
        animationTarget.addEventListener("animationcancel", onAnimationCancel, { once: true });
      }
    }

    // Pulisci la classe animation-finished dai precedenti step
    const finishedSteps = root.querySelectorAll(".step.animation-finished");
    finishedSteps.forEach(function (step) {
      if (step !== enteringStep) {
        step.classList.remove("animation-finished");
      }
    });
  });
})();
