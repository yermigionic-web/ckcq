import { getGameByRoute, getBoardState, renderBoard, findCellButton, orderMissions, resolveMissionOrder, shuffleList, FAIL_LIMIT } from "./bingo.js";
import { validateAnswer } from "./validator.js";
import { createModalController } from "./modal.js";
import { loadProgress, saveProgress } from "./storage.js";
import { renderCompletion } from "./completion.js";
import {
  announce,
  hasFormUrl,
  initLogoFallbacks,
  loadJSON,
  openExternal,
  padNumber,
  prefersReducedMotion,
  qs,
  setHidden,
  svgPath,
} from "./ui.js";

const views = {
  home: qs("#view-home"),
  loading: qs("#view-loading"),
  error: qs("#view-error"),
  bingo: qs("#view-bingo"),
  completion: qs("#view-completion"),
};

const live = qs("#live-region");
const boardEl = qs("#bingo-board");
const quizOverlay = qs("#quiz-overlay");
const resetOverlay = qs("#reset-overlay");
const quizModal = createModalController(quizOverlay);
const resetModal = createModalController(resetOverlay);

const els = {
  signal: qs("#game-signal-label"),
  cells: qs("#stat-cells"),
  lines: qs("#stat-lines"),
  eventBar: qs("#event-bar"),
  eventTitle: qs("#event-title"),
  eventCopy: qs("#event-copy"),
  certBtn: qs("#btn-cert"),
  formBtn: qs("#btn-form"),
  retry: qs("#btn-retry"),
  answerForm: qs("#answer-form"),
  answerInput: qs("#answer-input"),
  modalWork: qs("#modal-work"),
  modalMission: qs("#modal-mission"),
  modalStatement: qs("#modal-statement"),
  modalQuestion: qs("#modal-question"),
  modalStatus: qs("#modal-status"),
  modalStatusImg: qs("#modal-status-img"),
  modalStatusTitle: qs("#modal-status-title"),
  modalStatusText: qs("#modal-status-text"),
  completePanel: qs("#complete-panel"),
  playPanel: qs("#play-panel"),
  favWidget: qs("#fav-widget"),
};

let config = null;
let configError = false;
let activeGame = null;
let sourceMissions = [];
let missions = [];
let missionOrder = [];
let completedIds = [];
let failCounts = {};
let activeMission = null;
let successTimer = 0;
let lastRoute = "";

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    setHidden(el, key !== name);
  });
  document.body.classList.toggle("capture-mode", name === "completion");
  syncFavWidget();
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash) return { view: "home" };
  const [route, screen] = hash.split("/");
  const game = getGameByRoute(route);
  if (!game) return { view: "home" };
  if (screen === "cert" || screen === "complete") {
    return { view: "completion", game };
  }
  return { view: "bingo", game };
}

function go(hash) {
  window.location.hash = hash;
}

async function loadConfig() {
  try {
    config = await loadJSON("../data/config.json");
    configError = false;
  } catch {
    config = { allAgeFormUrl: "", age15FormUrl: "", favFormUrl: "" };
    configError = true;
  }
}

function formUrlFor(game) {
  if (!config || !game) return "";
  return config[game.formKey] || "";
}

function favFormUrl() {
  return config?.favFormUrl || "";
}

function syncFavWidget() {
  const widget = els.favWidget;
  if (!widget) return;
  const url = favFormUrl().trim();
  const show = !views.bingo.hidden && hasFormUrl(url);
  widget.hidden = !show;
  if (show) {
    widget.href = url;
  } else {
    widget.removeAttribute("href");
  }
}

function currentState() {
  return getBoardState(activeGame, missions, completedIds);
}

function updateHud() {
  if (!activeGame) return;
  const state = currentState();
  els.signal.textContent = activeGame.signal;
  els.cells.textContent = `${padNumber(state.cellCount)} / ${padNumber(state.cellTotal)}`;
  els.lines.textContent = `${padNumber(state.lineCount)} / ${padNumber(activeGame.targetLines)}`;

  const unlocked = state.unlocked;
  els.eventBar.classList.toggle("is-open", unlocked);
  els.eventBar.classList.toggle("is-locked", !unlocked);
  els.eventTitle.textContent = unlocked ? "EVENT SIGNAL UNLOCKED ★" : "EVENT LOCKED";
  els.eventCopy.textContent = unlocked
    ? "인증 화면에서 빙고판을 캡처한 뒤 설문에 업로드해 주세요."
    : `${padNumber(state.lineCount)} / ${padNumber(activeGame.targetLines)} LINES`;
  const sep = qs(".event-sep", els.eventBar);
  if (sep) sep.hidden = unlocked;

  const url = formUrlFor(activeGame);
  els.certBtn.hidden = !unlocked;
  if (!unlocked) {
    els.formBtn.hidden = true;
  } else if (hasFormUrl(url)) {
    els.formBtn.hidden = false;
    els.formBtn.disabled = false;
    els.formBtn.textContent = "ENTER EVENT FORM";
  } else {
    els.formBtn.hidden = false;
    els.formBtn.disabled = true;
    els.formBtn.textContent = "EVENT FORM OFFLINE";
  }
}

function persist() {
  saveProgress(activeGame.storageKey, {
    completedIds,
    order: missionOrder,
    failCounts,
  });
}

function failedIdList() {
  return Object.entries(failCounts)
    .filter(([, count]) => count >= FAIL_LIMIT)
    .map(([id]) => id);
}

function isLost(id) {
  return (failCounts[id] || 0) >= FAIL_LIMIT && !completedIds.includes(id);
}

function setFormLocked(locked) {
  els.answerForm.classList.toggle("is-locked", locked);
  els.answerInput.disabled = locked;
  els.answerInput.required = !locked;
  const submit = els.answerForm.querySelector('button[type="submit"]');
  if (submit) submit.disabled = locked;
}

function paintBoard() {
  renderBoard(boardEl, {
    game: activeGame,
    missions,
    completedIds,
    failedIds: failedIdList(),
    interactive: true,
    onSelect: onCellSelect,
  });
  updateHud();
}

function resetQuizModal() {
  window.clearTimeout(successTimer);
  els.answerForm.classList.remove("is-shake");
  els.answerInput.value = "";
  els.modalStatus.className = "modal-status";
  els.modalStatusImg.src = svgPath("alien-normal.svg");
  els.modalStatusTitle.textContent = "";
  els.modalStatusText.textContent = "";
  setFormLocked(false);
}

function openResultModal(mission, trigger, lost) {
  activeMission = mission;
  resetQuizModal();
  els.completePanel.hidden = false;
  els.playPanel.hidden = true;
  qs("#complete-title").textContent = mission.title;
  qs("#complete-work").textContent = mission.workTitle;
  qs("#complete-mission").textContent = lost
    ? `SIGNAL LOST!  ${padNumber(missions.indexOf(mission) + 1)}`
    : `MISSION COMPLETE ★  ${padNumber(missions.indexOf(mission) + 1)}`;
  qs("#complete-mark-img").src = svgPath(lost ? "alien-error.svg" : "alien-party.svg");
  qs("#complete-mark-title").textContent = lost ? "SIGNAL LOST!" : "MISSION COMPLETE ★";
  els.completePanel.classList.toggle("is-lost", lost);
  qs("#complete-mark-copy").textContent = lost
    ? "기회를 모두 사용했습니다. 이 칸은 더 이상 풀 수 없습니다."
    : "이미 완료된 미션입니다. 정답은 다시 보여주지 않습니다.";
  quizModal.open({
    initialFocus: qs("#quiz-close"),
    onClose: () => trigger?.focus(),
  });
}

function openQuizModal(mission, trigger) {
  activeMission = mission;
  resetQuizModal();
  els.completePanel.hidden = true;
  els.playPanel.hidden = false;
  els.modalWork.textContent = mission.workTitle;
  els.modalMission.textContent = `MISSION ${padNumber(missions.indexOf(mission) + 1)}`;
  els.modalStatement.textContent = mission.title;
  els.modalQuestion.textContent = mission.question;
  quizModal.open({
    initialFocus: els.answerInput,
    onClose: () => trigger?.focus(),
  });
}

function onCellSelect(mission, _index, trigger) {
  if (completedIds.includes(mission.id)) {
    openResultModal(mission, trigger, false);
    return;
  }
  if (isLost(mission.id)) {
    openResultModal(mission, trigger, true);
    return;
  }
  openQuizModal(mission, trigger);
}

function markSuccess() {
  const mission = activeMission;
  if (!mission || completedIds.includes(mission.id) || isLost(mission.id)) return;

  completedIds = [...completedIds, mission.id];
  persist();
  paintBoard();

  const cell = findCellButton(boardEl, mission.id);
  cell?.classList.add("is-stamping");
  const state = currentState();
  if (state.unlocked) {
    announce("BINGO SIGNAL DETECTED. 이벤트 신호가 해제되었습니다.", live);
  }
}

function showStatus(ok, title, text, img, extraClass = "") {
  els.modalStatus.className = `modal-status is-on ${ok ? "is-ok" : "is-bad"}${extraClass ? ` ${extraClass}` : ""}`;
  els.modalStatusImg.src = svgPath(img);
  els.modalStatusTitle.textContent = title;
  els.modalStatusText.textContent = text;
  announce(`${title} ${text}`, live);
}

function handleSubmit(event) {
  event.preventDefault();
  if (!activeMission) return;
  if (completedIds.includes(activeMission.id) || isLost(activeMission.id)) return;

  const value = els.answerInput.value;
  const ok = validateAnswer(activeMission, value);

  if (ok) {
    els.answerForm.classList.remove("is-shake");
    showStatus(true, "SIGNAL FOUND!", "정답입니다. 미션이 완료됩니다.", "alien-happy.svg");
    markSuccess();
    const delay = prefersReducedMotion() ? 400 : 1200;
    successTimer = window.setTimeout(() => quizModal.close(), delay);
    return;
  }

  const id = activeMission.id;
  failCounts = { ...failCounts, [id]: (failCounts[id] || 0) + 1 };
  persist();

  if (isLost(id)) {
    setFormLocked(true);
    showStatus(false, "SIGNAL LOST!", "기회를 모두 사용했습니다. 이 칸은 더 이상 풀 수 없습니다.", "alien-error.svg", "is-lost");
    paintBoard();
    return;
  }

  const left = FAIL_LIMIT - (failCounts[id] || 0);
  showStatus(false, "SIGNAL NOT FOUND :P", `다시 입력해 보세요. 남은 기회 ${left}회`, "alien-error.svg");
  els.answerForm.classList.remove("is-shake");
  void els.answerForm.offsetWidth;
  els.answerForm.classList.add("is-shake");
  els.answerInput.focus();
  els.answerInput.select();
}

function openResetModal() {
  resetModal.open({
    initialFocus: qs("#btn-cancel-reset"),
  });
}

function confirmReset() {
  if (!activeGame) return;
  completedIds = [];
  failCounts = {};
  missionOrder = shuffleList(sourceMissions.map((mission) => mission.id));
  missions = orderMissions(sourceMissions, missionOrder) || sourceMissions;
  persist();
  paintBoard();
  resetModal.close();
  announce("진행 상황이 초기화되었습니다. 보드 배치가 다시 섞입니다.", live);
}

async function loadGame(game) {
  activeGame = game;
  showView("loading");
  qs("#loading-copy").textContent = "CONNECTING TO EARTH...";
  try {
    const data = await loadJSON(game.dataPath);
    sourceMissions = Array.isArray(data) ? data : [];
    const progress = loadProgress(game.storageKey);
    missionOrder = resolveMissionOrder(sourceMissions, progress.order);
    missions = orderMissions(sourceMissions, missionOrder) || sourceMissions;
    completedIds = progress.completedIds.filter((id) =>
      sourceMissions.some((mission) => mission.id === id)
    );
    failCounts = Object.fromEntries(
      Object.entries(progress.failCounts).filter(([id]) =>
        sourceMissions.some((mission) => mission.id === id)
      )
    );
    persist();
    paintBoard();
    showView("bingo");
  } catch {
    qs("#error-detail").textContent = "데이터를 불러오지 못했습니다.";
    showView("error");
  }
}

function renderCert() {
  showView("completion");
  renderCompletion({
    root: views.completion,
    game: activeGame,
    missions,
    completedIds,
    failedIds: failedIdList(),
    formUrl: formUrlFor(activeGame),
    onBack: () => go(activeGame.route),
    onForm: () => {
      const url = formUrlFor(activeGame);
      if (hasFormUrl(url)) openExternal(url);
    },
  });
}

async function handleRoute() {
  const route = parseRoute();
  const key = `${route.view}:${route.game?.id || ""}`;
  if (key === lastRoute && route.view !== "home") {
    if (route.view === "completion") renderCert();
    return;
  }
  lastRoute = key;

  quizModal.close();
  resetModal.close();

  if (route.view === "home") {
    activeGame = null;
    showView("home");
    return;
  }

  if (!missions.length || activeGame?.id !== route.game.id) {
    await loadGame(route.game);
  } else {
    showView("bingo");
    paintBoard();
  }

  if (route.view === "completion") {
    if (!currentState().unlocked) {
      go(route.game.route);
      return;
    }
    renderCert();
  }
}

function bindEvents() {
  els.answerForm.addEventListener("submit", handleSubmit);
  qs("#quiz-close").addEventListener("click", () => quizModal.close());
  qs("#complete-close").addEventListener("click", () => quizModal.close());
  qs("#btn-reset").addEventListener("click", openResetModal);
  qs("#btn-cancel-reset").addEventListener("click", () => resetModal.close());
  qs("#btn-cancel-reset-x").addEventListener("click", () => resetModal.close());
  qs("#btn-confirm-reset").addEventListener("click", confirmReset);
  qs("#btn-home").addEventListener("click", () => go(""));
  els.certBtn.addEventListener("click", () => go(`${activeGame.route}/cert`));
  els.formBtn.addEventListener("click", () => {
    const url = formUrlFor(activeGame);
    if (hasFormUrl(url)) openExternal(url);
  });
  els.retry.addEventListener("click", () => {
    lastRoute = "";
    handleRoute();
  });
  window.addEventListener("hashchange", handleRoute);
}

async function init() {
  initLogoFallbacks();
  bindEvents();
  if (window.location.hash.replace(/^#\/?/, "")) showView("loading");
  await loadConfig();
  if (configError) {
    announce("설정 파일을 불러오지 못했습니다. 이벤트 링크가 비활성화될 수 있습니다.", live);
  }
  await handleRoute();
}

init();
