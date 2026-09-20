import { getBoardState, renderBoard } from "./bingo.js";
import { hasFormUrl, qs } from "./ui.js";

export function renderCompletion({
  root,
  game,
  missions,
  completedIds,
  failedIds = [],
  formUrl,
  onBack,
  onForm,
}) {
  const boardState = getBoardState(game, missions, completedIds);
  const boardEl = qs("[data-cert-board]", root);
  const formBtn = qs("[data-enter-form]", root);

  qs("[data-cert-category]", root).textContent = game.category;
  qs("[data-cert-cells]", root).textContent = `${String(boardState.cellCount).padStart(2, "0")} / ${String(boardState.cellTotal).padStart(2, "0")}`;
  qs("[data-cert-lines]", root).textContent = `${boardState.lineCount} / ${boardState.lineTotal}`;
  qs("[data-cert-target]", root).textContent = `${game.targetLines} LINES`;

  renderBoard(boardEl, {
    game,
    missions,
    completedIds,
    failedIds,
    interactive: false,
  });

  const backBtn = qs("[data-back-bingo]", root);
  backBtn.onclick = onBack;

  if (hasFormUrl(formUrl)) {
    formBtn.hidden = false;
    formBtn.disabled = false;
    formBtn.textContent = "ENTER EVENT FORM";
    formBtn.onclick = onForm;
    qs("[data-form-offline]", root).hidden = true;
  } else {
    formBtn.hidden = true;
    qs("[data-form-offline]", root).hidden = false;
  }

  return boardState;
}