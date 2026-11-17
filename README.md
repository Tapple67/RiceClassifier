# 쌀알 품종 분류

쌀알의 형태 측정값 7개로 Cammeo와 Osmancik을 분류하는 프로젝트입니다. 학습에 쓰는 UCI Rice 데이터셋은 3,810행이며 정답 컬럼은 `Class`입니다. [UCI Rice 데이터셋 (CC BY 4.0)](https://archive.ics.uci.edu/dataset/545/rice-cammeo-and-osmancik)

## 구성

```text
요청   React ── JSON ──▶ Spring Boot ── JSON ──▶ FastAPI
응답   React ◀── SSE ─── Spring Boot ◀── SSE ─── FastAPI · LightGBM
```

| 폴더 | 역할 |
| --- | --- |
| `front/` | React와 axios로 입력을 보내고 컨베이어, 쌀알별 결과, 품종별 집계를 표시합니다. |
| `back/` | Spring WebFlux의 WebClient로 FastAPI를 논블로킹 호출하고, 받은 이벤트를 React에 SSE로 중계합니다. |
| `python/` | Optuna로 LightGBM을 튜닝하고 모델을 저장합니다. FastAPI가 저장된 모델을 불러와 예측합니다. |

## 로컬 실행

JDK 17, Python, Node.js 20 이상이 필요합니다. 저장소 루트(`RiceClassifier`)에서 PowerShell 창을 세 개 열고 아래 순서로 실행합니다.

### 1. FastAPI

```powershell
Set-Location -LiteralPath .\python
python -m pip install fastapi uvicorn pandas joblib lightgbm scikit-learn
python .\day19\AppStart.py
```

FastAPI는 `http://127.0.0.1:8000`에서 실행됩니다. 제공된 모델 파일을 `./day19/lgbm_insurance_model.pkl`에서 읽으므로 `python/`을 현재 디렉터리로 둡니다.

### 2. Spring Boot

`back/src/main/resources/application.properties`는 Git에서 제외되어 있습니다. 새로 내려받았다면 해당 경로에 아래 설정을 저장합니다.

```properties
spring.application.name=rice-classifier-back
fastapi.base-url=http://localhost:8000
fastapi.event-timeout-seconds=30
app.frontend-origin=http://localhost:5173
```

```powershell
Set-Location -LiteralPath .\back
.\gradlew.bat bootRun
```

Spring은 기본적으로 `8080`에서 실행됩니다. `fastapi.base-url`은 Python 서버 주소, `fastapi.event-timeout-seconds`는 첫 이벤트 및 후속 이벤트 사이의 대기 시간, `app.frontend-origin`은 허용할 브라우저 출처입니다. 같은 폴더에서 `.\gradlew.bat bootJar`를 실행하면 실행 가능한 JAR을 만들 수 있습니다.

### 3. React

```powershell
Set-Location -LiteralPath .\front
npm ci
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다. Vite가 개발 중 `/api` 요청을 `http://localhost:8080`으로 전달합니다. Spring 주소가 다르면 Vite 실행 전 PowerShell에서 `$env:VITE_BACKEND_URL = 'http://localhost:8081'`처럼 지정합니다.

## 예측 요청과 결과

`현재 값 보내기`는 슬라이더 측정값 한 건을 보냅니다. `무작위 보내기`는 브라우저에서 장축과 이심률을 무작위로 뽑고, 타원 공식을 이용해 나머지 측정값을 조합합니다. 샘플을 1~100개 만들어 배열에 넣고, 비동기 작업 최대 4개가 배열에서 순서대로 한 건씩 가져갑니다. 각 작업이 끝나는 대로 다음 샘플을 보냅니다. 기본 선택 개수는 20개입니다. [React 대기열](front/src/App.jsx) · [무작위 샘플 생성](front/src/features.js)

| 구간 | 엔드포인트 |
| --- | --- |
| React → Spring | `POST http://localhost:8080/api/predictions/stream` |
| Spring → FastAPI | `POST http://127.0.0.1:8000/api/check` |

두 요청은 쌀알 한 건을 `Content-Type: application/json` 본문에 담고 `Accept: text/event-stream` 헤더를 보냅니다. `Area`와 `Convex_Area`는 정수이고 나머지는 실수입니다.

```json
{
  "Area": 15231,
  "Perimeter": 525.5789794921875,
  "Major_Axis_Length": 229.7498779296875,
  "Minor_Axis_Length": 85.09378814697266,
  "Eccentricity": 0.9288820028305054,
  "Convex_Area": 15617,
  "Extent": 0.5728955268859863
}
```

FastAPI는 `Content-Type: text/event-stream`으로 예측 이벤트 한 건을 보내고 연결을 닫습니다. React는 각 이벤트의 `result.prediction`과 `result.probabilities`를 읽습니다. 현재 확률 배열의 순서는 `[Cammeo, Osmancik]`입니다. 아래 확률은 응답 형식 예시입니다.

```text
data: {"result":{"prediction":["Cammeo"],"probabilities":[0.99,0.01]}}

```

Spring은 `bodyToFlux(SSE_TYPE)`으로 이벤트를 읽고, 컨트롤러가 `Flux<ServerSentEvent<String>>`를 반환하면 WebFlux가 준비된 이벤트를 React에 전송합니다. 응답 시작 전 FastAPI의 400·422는 Spring의 400, 연결 실패나 잘못된 응답 형식은 502, 이벤트 대기 시간 초과는 504가 됩니다. 이미 SSE 전송을 시작했다면 Spring은 `prediction_error` 이벤트로 중계 오류를 알립니다.

## Spring 코드 구조

아래 경로는 `back/src/main/java/com/riceclassifier/back/` 기준입니다.

| 파일 | 역할 |
| --- | --- |
| `controller/PredictionController.java` | React의 JSON 요청을 받고 SSE를 반환합니다. 응답 시작 후 오류는 SSE로 알립니다. |
| `service/PredictionService.java` | FastAPI 클라이언트에 예측을 요청하고 받은 스트림을 반환합니다. |
| `client/FastApiPredictionClient.java` | WebClient 요청을 보내고, HTTP 상태와 SSE 형식을 확인한 뒤 이벤트를 읽습니다. |
| `dto/RicePredictionRequest.java` | Java 필드와 API의 JSON 키를 `@JsonProperty`로 연결합니다. |
| `config/FastApiConfig.java` | 설정값으로 WebClient를 만들고 FastAPI 클라이언트를 Spring 빈으로 등록합니다. |
| `common/ApiExceptionHandler.java` | SSE 시작 전 호출 예외를 공통 HTTP 오류 응답으로 변환합니다. |

Lombok의 `@Getter`, `@Setter`가 DTO 접근 메서드를 만들고, `@RequiredArgsConstructor`가 의존성 주입에 사용하는 생성자를 만듭니다. Java 주석은 흐름 설명에 `// *`, 보안·데이터 제약에 `// !`, 실제 남은 작업에 `// TODO`, 미정 설계 질문에 `// ?`를 씁니다. properties 파일에서는 `#` 주석 문법으로 같은 태그를 씁니다.

## 모델 재학습 또는 교체

저장소에 추론용 모델이 포함되어 있어 바로 FastAPI를 실행할 수 있습니다. 재학습할 때는 `python/`에서 아래 명령으로 UCI의 7개 특성과 `Class`를 CSV로 저장합니다. 현재 저장소에는 학습 CSV가 포함되어 있지 않습니다. [UCI 데이터 불러오기](https://archive.ics.uci.edu/dataset/545/rice-cammeo-and-osmancik)

```powershell
python -m pip install numpy optuna ucimlrepo
python -c "import pandas as pd; from ucimlrepo import fetch_ucirepo; rice = fetch_ucirepo(id=545); pd.concat([rice.data.features, rice.data.targets], axis=1).to_csv('day19/Rice_Cammeo_Osmancik.csv', index=False)"
python .\day19\project.py
```

[학습 스크립트](python/day19/project.py)는 소수점 세 자리로 반올림한 데이터를 학습·테스트로 나누고, Optuna TPE 20회와 5겹 교차 검증으로 macro F1을 기준으로 튜닝합니다. 학습이 끝나면 `day19/lgbm_insurance_model.pkl`에 모델과 테스트 macro F1을 저장합니다.

[추론 코드](python/day19/Service.py)는 `model.feature_name_`으로 입력 컬럼을 학습 순서에 맞춥니다. 모델을 바꾼 뒤 FastAPI를 다시 실행하고, JSON 키 7개와 확률 배열 순서가 기존 계약과 일치하는지 확인합니다.

## 연동 검증

위 요청 JSON을 `sample.json`으로 저장한 위치에서 PowerShell로 실행합니다. 첫 번째 명령은 모델의 직접 응답, 두 번째 명령은 Spring 중계를 확인합니다.

```powershell
curl.exe -i -N "http://127.0.0.1:8000/api/check" -H "Content-Type: application/json" -H "Accept: text/event-stream" --data-binary "@sample.json"
curl.exe -i -N "http://localhost:8080/api/predictions/stream" -H "Content-Type: application/json" -H "Accept: text/event-stream" --data-binary "@sample.json"
```

- 두 호출에서 `200 OK`와 `text/event-stream`이 오고, 예측 품종과 확률이 일치하는지 확인합니다. JSON 키 순서만 바꿔도 결과가 같은지 확인합니다.
- React에서 `현재 값 보내기`와 `무작위 보내기`를 시험합니다. 브라우저의 Network 탭에서 쌀알별 POST 요청과 동시 진행 최대 4건을 확인할 수 있습니다.
- FastAPI가 꺼져 있을 때 Spring이 502를 반환하는지 확인합니다. 모의 응답으로 첫 이벤트 전후의 대기 시간을 초과시키면 각각 HTTP 504와 `prediction_error`가 전달되는지 확인합니다.
