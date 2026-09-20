# CAROL CHARACTER CHAT BINGO

팬덤 빙고 퀴즈 이벤트용 정적 웹사이트입니다. 칸을 누르는 즉시 완료되지 않고, 문제를 읽고 답을 제출해 통과해야 칸이 채워집니다.

SAFETY(4×4)와 UNSAFETY(6×6)는 완전히 분리된 게임이며 진행도가 서로 영향을 주지 않습니다.

플레이어마다 빙고 칸 배치가 무작위로 섞입니다. 한 번 정해진 배치는 localStorage에 저장되어 새로고침해도 유지되고, RESET 시에만 다시 섞입니다.

같은 칸의 답을 3번 틀리면 해당 칸은 빨간색 SIGNAL LOST 상태가 되고, 더 이상 답을 입력할 수 없습니다. 실패한 칸은 빙고 줄로 세지 않습니다.

## 1. Project structure

```text
/
  index.html
  README.md
  /css
    reset.css
    variables.css
    global.css
    home.css
    bingo.css
    modal.css
    completion.css
    animations.css
    responsive.css
  /js
    app.js
    bingo.js
    validator.js
    modal.js
    storage.js
    ui.js
    completion.js
  /data
    all-age.json
    age-15.json
    config.json
  /assets
    /logo
      README.txt
      main-logo.png   (optional, added later)
    /svg
      alien-normal.svg
      alien-happy.svg
      alien-error.svg
      alien-party.svg
      ufo.svg
      shooting-star.svg
      sparkle.svg
      pixel-star.svg
      star.svg
      heart.svg
      orbit.svg
```

npm 없이 동작하는 정적 사이트입니다.

## 2. Run locally

JSON을 `fetch`로 불러오기 때문에 로컬 HTTP 서버가 필요합니다.

Python:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

VS Code / Cursor Live Server도 가능합니다.

## 3. Why `index.html` as a file may fail

`index.html`을 탐색기에서 더블클릭해 `file://`로 열면, 브라우저가 로컬 JSON fetch를 막을 수 있습니다. 빈 화면이나 `SIGNAL LOST`가 보이면 서버로 열어 주세요.

## 4. Local HTTP server

가장 단순한 방법:

```bash
python -m http.server 5500
```

또는 Live Server 확장.

프로덕션 GitHub Pages에는 별도 서버 코드가 필요 없습니다.

## 5. Deploy to GitHub Pages

1. 이 저장소를 GitHub에 푸시합니다.
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: `main` (or `master`), folder: `/ (root)`
5. 저장 후 `https://<user>.github.io/<repo>/` 로 접속합니다.

모든 자산 경로는 상대 경로입니다. 프로젝트 사이트 하위 경로에서도 CSS/JSON/JS가 깨지지 않도록 `js` 모듈 기준 `import.meta.url`로 데이터를 불러옵니다.

## 6. Replace the logo

최종 로고 파일을 여기에 올리면 됩니다.

```text
assets/logo/main-logo.png
```

파일이 없거나 로드에 실패하면 텍스트 폴백이 보입니다:

```text
CAROL
CHARACTER CHAT
BINGO
```

PNG가 정상 로드되면 폴백은 자동으로 사라집니다. 깨진 이미지 아이콘은 보이지 않습니다.

## 7. Edit questions

- SAFETY: `data/all-age.json`
- UNSAFETY: `data/age-15.json`

각 항목:

- `id`
- `workTitle` (칸 배지)
- `title` (칸에 보이는 문장, 데이터는 자르지 않음)
- `question` (모달 질문)
- `acceptedAnswers`
- 필요 시 `validationType`, `requiredTerms`

JSON 파일의 문항 내용은 고정입니다. 화면에 보이는 칸 위치는 플레이어마다 셔플됩니다.

## 8. Edit Google Form URLs

`data/config.json`:

```json
{
  "allAgeFormUrl": "https://docs.google.com/forms/...",
  "age15FormUrl": "https://docs.google.com/forms/...",
  "favFormUrl": "https://docs.google.com/forms/..."
}
```

이벤트 폼 URL을 비우면 버튼이 깨진 링크로 나가지 않고 `EVENT FORM OFFLINE` 처리됩니다. `favFormUrl`은 빙고 화면 UFO 위젯(`#MYFAV`) 링크입니다.

## 9. localStorage keys

- SAFETY: `fandomBingo_all_progress`
- UNSAFETY: `fandomBingo_15_progress`

저장 형태:

```json
{
  "completedIds": ["all-01"],
  "order": ["all-05", "all-01"],
  "failCounts": { "all-02": 3 },
  "updatedAt": "2026-09-16T15:00:00.000Z"
}
```

제출한 답 텍스트는 저장하지 않습니다.

## 10. Bingo line calculation

한 변 길이가 N인 보드에서 가능한 줄:

- N개의 가로 줄
- N개의 세로 줄
- 주 대각선 1개
- 부 대각선 1개

따라서:

- 4×4 = 10줄, 이벤트 해제 조건 5줄
- 6×6 = 14줄, 이벤트 해제 조건 7줄

같은 줄은 두 번 세지 않습니다. 완성된 줄에 속한 칸은 더 강하게 강조됩니다.

## Event screenshot

목표 줄 수에 도달하면 `인증 화면 보기`가 열립니다. 토큰/코드/QR은 없습니다. 완성된 빙고 화면을 캡처해 구글 폼에 업로드하면 됩니다.
