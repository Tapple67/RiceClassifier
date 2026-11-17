# React 프론트엔드

슬라이더로 쌀알의 측정값 7개를 조정하고 Spring Boot로 보내 SSE로 받은 품종 분류 결과를 보여 주는 화면입니다. 화면은 왼쪽에서 오른쪽으로 `측정값 → 검사 라인(컨베이어) → 분류 결과` 순서로 이어집니다.

```text
React(axios) ⇄ HTTP / SSE ⇄ Spring Boot(WebClient) ⇄ HTTP ⇄ FastAPI(LightGBM)
```

## 실행

Node.js 18 이상이 필요합니다. `front/`에서 실행합니다.

```powershell
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다. Spring의 `app.frontend-origin` 기본값과 같은 포트입니다. 개발 서버는 `/api` 요청을 `http://localhost:8080`으로 프록시합니다. Spring 주소가 다르면 `$env:VITE_BACKEND_URL = 'http://localhost:8081'`을 설정한 뒤 실행합니다.

## 화면 흐름

| 단계 | 내용 |
| --- | --- |
| 01 쌀알 측정값 | 슬라이더 값을 바꾸면 위쪽 쌀알 그림이 바로 바뀝니다. 실수 값은 소수점 3자리까지 다룹니다. `형태 연동`을 켜면 장축·단축을 바꿀 때 면적, 둘레, 이심률, 볼록 껍질 면적이 타원 공식으로 함께 맞춰집니다. `현재 값 보내기`는 슬라이더 값 1건을, `무작위 보내기`는 1~100개의 무작위 샘플을 보냅니다. |
| 02 검사 라인 | 쌀알이 컨베이어를 따라 스캐너로 이동하고, 응답을 기다리는 동안 스캐너가 작동합니다. 여러 건은 최대 4건씩 동시에 요청하며 진행률을 표시합니다. |
| 03 분류 결과 | 1건이면 예측 품종과 확률을, 여러 건이면 품종별 개수·비율, 평균 확신도, 오류 수, 샘플별 격자를 요약합니다. |
| 04 세부 결과 | 검사 라인 아래에서 쌀알별 예측과 확신도를 봅니다. 품종·오류로 거르고, 행을 펼치면 측정값 7개와 확률을 볼 수 있으며 슬라이더로 불러올 수 있습니다. |

쌀알 그림은 장축·단축으로 크기, 면적으로 배율, 외접 사각형 비율로 모서리의 각진 정도, 이심률로 양 끝의 뾰족함, 볼록 껍질 면적과 면적의 차이로 배아 쪽 홈의 깊이, 둘레로 외곽선의 울퉁불퉁함을 표현합니다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `src/App.jsx` | 슬라이더 값, 검사 실행(`idle → running → done/stopped`), 쌀알별 단계(`spawn → enter → scan → exit`)를 관리합니다. |
| `src/api/predict.js` | axios(`adapter: 'fetch'`, `responseType: 'stream'`)로 `POST /api/predictions/stream`을 호출하고 SSE 이벤트를 나눠 읽습니다. |
| `src/features.js` | 특성 7개의 슬라이더 범위, 예시 샘플, 형태 연동 계산, 무작위 샘플 생성을 정의합니다. |
| `src/components/RiceGrain.jsx` | 측정값으로 쌀알 SVG 윤곽선을 만듭니다. |
| `src/components/FeatureSliders.jsx` | 특성 슬라이더 목록입니다. |
| `src/components/Conveyor.jsx` | 컨베이어 벨트와 스캐너로 로딩 상태를 표현합니다. |
| `src/components/ResultPanel.jsx` | FastAPI 이벤트의 `result.prediction`, `result.probabilities`를 읽고 결과 요약을 표시합니다. |
| `src/components/DetailsPanel.jsx` | 쌀알별 세부 결과 목록입니다. |

브라우저 기본 XHR 어댑터는 응답을 모두 받은 뒤 넘겨 주기 때문에 SSE를 이벤트 단위로 읽으려면 axios 1.7 이상의 fetch 어댑터가 필요합니다. `probabilities`는 LightGBM `classes_` 순서(알파벳순)인 `[Cammeo, Osmancik]`로 해석합니다.
