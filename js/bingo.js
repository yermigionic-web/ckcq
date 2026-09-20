import { padNumber, svgPath } from "./ui.js";

export const GAMES = {
  all: {
    id: "all",
    route: "safety",
    size: 4,
    targetLines: 5,
    totalLines: 10,
    missionCount: 16,
    dataPath: "../data/all-age.json",
    storageKey: "fandomBingo_all_progress",
    formKey: "allAgeFormUrl",
    signal: "SAFETY SIGNAL",
    shortLabel: "SAFETY",
    category: "SAFETY BINGO",
    ageLabel: "SAFETY",
    missionsLabel: "16 MISSIONS",
    unlockCopy: "Complete 5 Bingo Lines",
    unlockCopyKo: "빙고 라인 5개를 완성하면 이벤트가 열립니다.",
  },
  age15: {
    id: "age15",
    route: "unsafety",
    size: 6,
    targetLines: 7,
    totalLines: 14,
    missionCount: 36,
    dataPath: "../data/age-15.json",
    storageKey: "fandomBingo_15_progress",
    formKey: "age15FormUrl",
    signal: "UNSAFETY SIGNAL",
    shortLabel: "UNSAFETY",
    category: "UNSAFETY BINGO",
    ageLabel: "UNSAFETY",
    missionsLabel: "36 MISSIONS",
    unlockCopy: "Complete 7 Bingo Lines",
    unlockCopyKo: "빙고 라인 7개를 완성하면 이벤트가 열립니다.",
    note: "UNSAFETY 작품 설정이 포함되어 있습니다.",
  },
};

export function getGameByRoute(route) {
  if (route === "all" || route === "safety") return GAMES.all;
  if (route === "15" || route === "unsafety") return GAMES.age15;
  return null;
}

export function shuffleList(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function orderMissions(missions, order) {
  if (!Array.isArray(missions) || !Array.isArray(order) || order.length !== missions.length) {
    return null;
  }
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  if (order.some((id) => !byId.has(id)) || new Set(order).size !== order.length) {
    return null;
  }
  return order.map((id) => byId.get(id));
}

export function resolveMissionOrder(missions, savedOrder) {
  if (orderMissions(missions, savedOrder)) return savedOrder;
  return shuffleList(missions.map((mission) => mission.id));
}

export function calculateLines(size, completedIndexes) {
  const completed = new Set(completedIndexes);
  const lines = [];

  const pushIfComplete = (id, cells) => {
    if (cells.length && cells.every((index) => completed.has(index))) {
      lines.push({ id, cells });
    }
  };

  for (let row = 0; row < size; row += 1) {
    pushIfComplete(
      `row-${row}`,
      Array.from({ length: size }, (_, col) => row * size + col)
    );
  }

  for (let col = 0; col < size; col += 1) {
    pushIfComplete(
      `col-${col}`,
      Array.from({ length: size }, (_, row) => row * size + col)
    );
  }

  pushIfComplete(
    "diag-main",
    Array.from({ length: size }, (_, i) => i * size + i)
  );

  pushIfComplete(
    "diag-anti",
    Array.from({ length: size }, (_, i) => i * size + (size - 1 - i))
  );

  const lineCellIndexes = new Set(lines.flatMap((line) => line.cells));

  return {
    count: lines.length,
    lines,
    lineCellIndexes,
  };
}

export function completedIndexesFromIds(missions, completedIds) {
  const set = new Set(completedIds);
  return missions.reduce((list, mission, index) => {
    if (set.has(mission.id)) list.push(index);
    return list;
  }, []);
}

export function getBoardState(game, missions, completedIds) {
  const completedIndexes = completedIndexesFromIds(missions, completedIds);
  const lines = calculateLines(game.size, completedIndexes);
  return {
    cellCount: completedIds.length,
    cellTotal: missions.length,
    lineCount: lines.count,
    lineTotal: game.totalLines,
    targetLines: game.targetLines,
    unlocked: lines.count >= game.targetLines,
    lines,
    completedIndexes,
  };
}

export const FAIL_LIMIT = 3;

function cellLabel(mission, index, complete, onLine, lost) {
  const number = padNumber(index + 1);
  let state = "미완료";
  if (lost) state = "실패, 입력 잠김";
  else if (complete && onLine) state = "완료, 빙고 라인";
  else if (complete) state = "완료";
  return `미션 ${number}. ${mission.workTitle}. ${mission.title}. ${state}`;
}

export function renderBoard(container, options) {
  const {
    game,
    missions,
    completedIds,
    failedIds = [],
    interactive = true,
    onSelect,
  } = options;

  const completed = new Set(completedIds);
  const failed = new Set(failedIds);
  const board = getBoardState(game, missions, completedIds);
  const lineCells = board.lines.lineCellIndexes;

  container.innerHTML = "";
  container.className = `bingo-board${interactive ? "" : " is-static"}`;
  container.dataset.size = String(game.size);
  container.setAttribute("role", interactive ? "grid" : "img");
  container.setAttribute(
    "aria-label",
    `${game.signal} 빙고판, ${board.cellCount}칸 완료, ${board.lineCount}줄 완료`
  );

  missions.forEach((mission, index) => {
    const complete = completed.has(mission.id);
    const lost = !complete && failed.has(mission.id);
    const onLine = complete && lineCells.has(index);
    const number = padNumber(index + 1);
    const el = document.createElement(interactive ? "button" : "div");
    el.className = "bingo-cell";
    if (complete) el.classList.add("is-complete");
    if (lost) el.classList.add("is-lost");
    if (onLine) el.classList.add("is-line");
    el.dataset.id = mission.id;
    el.dataset.index = String(index);
    if (interactive) {
      el.type = "button";
      el.setAttribute("aria-pressed", complete ? "true" : "false");
      el.addEventListener("click", () => onSelect?.(mission, index, el));
    } else {
      el.setAttribute("aria-hidden", "true");
    }
    el.setAttribute("aria-label", cellLabel(mission, index, complete, onLine, lost));
    el.innerHTML = `
      <span class="cell-meta">
        <span class="cell-num">${number}</span>
        <span class="cell-work">${escapeHtml(mission.workTitle)}</span>
      </span>
      <span class="cell-title">${escapeHtml(mission.title)}</span>
      <span class="cell-done">${lost ? "SIGNAL LOST!" : "SIGNAL FOUND"}</span>
      <img class="cell-stamp" src="${svgPath(lost ? "alien-error.svg" : "sparkle.svg")}" alt="">
    `;
    container.appendChild(el);
  });

  return board;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function findCellButton(container, missionId) {
  return container.querySelector(`[data-id="${CSS.escape(missionId)}"]`);
}
