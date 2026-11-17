# 쌀알의 크기와 모양으로 품종 분류하기

쌀알의 면적, 둘레, 장축·단축 길이, 이심률, 볼록 껍질 면적, 외접 사각형 대비 면적 비율로 Cammeo와 Osmancik 품종을 분류하는 실습 프로젝트입니다. [UCI Rice 데이터셋](https://archive.ics.uci.edu/dataset/545/rice-cammeo-and-osmancik)은 3,810행이며, 7개 측정값이 입력이고 `Class`가 정답입니다.

## 폴더 구조

| 폴더 | 역할 | 상태 |
| --- | --- | --- |
| `back/` | Spring Boot 및 WebFlux. WebClient로 FastAPI를 호출하고 결과를 SSE로 전달 | SSE 중계 구현 |
| `front/` | React 화면과 샘플별 분류 결과 표시 | 구현 예정 |
| `python/` | LightGBM 학습, Optuna 튜닝, 모델 저장, FastAPI 추론 | 구현 예정 |

```text
React ← HTTP / SSE → Spring Boot ← HTTP → FastAPI · LightGBM
```

## Spring Boot 실행

JDK 17이 필요합니다. Gradle Wrapper는 Gradle 버전을 지정하고, `back/gradle/gradle-daemon-jvm.properties`는 IDE와 터미널에서 Gradle을 실행할 JDK를 17로 지정합니다. 설치된 Gradle과 의존성 캐시가 없다면 첫 실행 시 다운로드가 필요합니다.

저장소 루트에서 PowerShell로 실행합니다.

```powershell
Set-Location -LiteralPath .\back
.\gradlew.bat bootRun
```

기본 포트는 `8080`입니다. 다른 포트가 필요하면 같은 PowerShell 창에서 `$env:SERVER_PORT = '8081'`를 실행한 뒤 서버를 시작합니다. 서버가 시작되었다는 로그와 포트가 출력되면 초기 실행이 정상입니다.

실행 가능한 JAR을 만들려면 `back/`에서 `.\gradlew.bat bootJar`를 실행합니다.

VS Code에서 Gradle을 불러오는 도중 `Unsupported class file major version 69`가 표시되면 JDK 17이 설치되어 있는지 확인하고, 명령 팔레트에서 `Developer: Reload Window`를 실행해 프로젝트 설정을 다시 읽습니다. 터미널에서는 `back/`에서 `.\gradlew.bat --version`으로 Gradle 데몬의 JVM 설정을 확인할 수 있습니다.

## 예측 SSE API

| 파일 | 역할 |
| --- | --- |
| `controller/PredictionController.java` | React의 `POST /api/predictions/stream` 요청을 받고 SSE 응답을 엽니다. |
| `service/PredictionService.java` | FastAPI 클라이언트에 예측을 요청하고 전송 중 오류를 SSE 이벤트로 바꿉니다. |
| `client/FastApiPredictionClient.java` | WebClient로 FastAPI의 `POST /predict/stream`을 호출하고 응답을 이벤트 단위로 읽습니다. 호출 예외도 이 파일에서 정의합니다. |
| `dto/RicePredictionRequest.java` | React에서 받고 FastAPI로 보내는 쌀알 한 건의 JSON 필드와 타입을 정의합니다. |
| `config/FastApiConfig.java` | 앱 시작 시 WebClient를 만들고 FastAPI 클라이언트를 빈으로 등록합니다. |
| `common/ApiExceptionHandler.java` | 스트림 시작 전 빠져나온 호출 예외를 공통 HTTP 오류 응답으로 바꿉니다. |

```text
요청 JSON   React → PredictionController → PredictionService → FastApiPredictionClient → FastAPI
예측 이벤트 FastAPI → FastApiPredictionClient → PredictionService → PredictionController → React
```

React는 쌀알 한 건의 특성 7개를 아래 JSON으로 보냅니다. Spring이 `RicePredictionRequest`로 읽은 뒤 FastAPI에 같은 키로 전달합니다. 샘플 필드의 필수값과 범위 검증은 FastAPI에서 처리합니다.

Gradle 컴파일 시 Lombok의 `@Getter`와 `@Setter`가 DTO의 접근 메서드를 생성하고, `@RequiredArgsConstructor`가 컨트롤러, 서비스, FastAPI 클라이언트의 생성자를 생성합니다.

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

### FastAPI 연동 참고

Spring은 FastAPI의 `POST /predict/stream`에 `Content-Type: application/json`과 `Accept: text/event-stream` 헤더로 요청합니다. FastAPI는 이 요청에 `Content-Type: text/event-stream`으로 응답하고, `prediction` 이벤트에 예측 품종과 확률을 담은 뒤 `complete` 이벤트로 종료를 알립니다. Python 모델을 교체하거나 재학습할 때도 이 입출력 계약을 유지합니다.

`FastApiPredictionClient`는 FastAPI의 SSE 응답을 `bodyToFlux(SSE_TYPE)`로 읽습니다. Spring은 같은 이벤트 이름과 본문을 `text/event-stream` 응답으로 React에 전송합니다.

설정은 `back/src/main/resources/application.properties`에서 바꿀 수 있습니다. `fastapi.base-url`의 기본값은 `http://localhost:8000`, `fastapi.event-timeout-seconds`의 기본값은 30초입니다. 타임아웃은 첫 이벤트와 후속 이벤트를 기다리는 시간에 적용됩니다. `app.frontend-origin`에는 React가 실행되는 주소를 지정합니다. 기본값은 `http://localhost:5173`입니다.

FastAPI의 입력 거절(400 또는 422)은 Spring의 400으로 변환됩니다. 스트림 시작 전 연결 실패나 응답 형식 오류는 502, 이벤트 대기 시간 초과는 504입니다. 이 응답은 공통 `ApiExceptionHandler`에서 생성합니다. 첫 이벤트 이후 감지한 중계 오류는 `prediction_error` 이벤트로 전송합니다. React에서는 `complete` 없이 연결이 종료되면 미완료로 처리합니다.

### 연동 검증

위 JSON을 `sample.json`으로 저장하고, Spring과 실제 또는 모의 FastAPI를 실행한 뒤 PowerShell에서 호출합니다.

```powershell
curl.exe -i -N "http://localhost:8080/api/predictions/stream" `
  -H "Content-Type: application/json" `
  -H "Accept: text/event-stream" `
  --data-binary "@sample.json"
```

- 모의 FastAPI가 시간차를 두고 이벤트를 보내면 Spring에서도 순서대로 즉시 출력되는지 확인합니다.
- FastAPI가 입력을 거절하거나 서버가 내려가면 각각 400, 502가 오는지 확인합니다.
- 첫 이벤트를 보내기 전과 후에 대기 시간을 초과시키고 각각 504, `prediction_error`가 오는지 확인합니다.
- React에서 호출할 때 설정한 Origin의 요청이 허용되는지 확인합니다. 인증을 추가하면 권한 오류도 검증합니다.

Java에서 흐름 설명은 `// *`, 보안·데이터 제약은 `// !`, 실제 남은 작업은 `// TODO`, 미정 설계 질문은 `// ?`로 표시합니다. properties 파일에서는 같은 태그에 `#` 주석 문법을 사용합니다.

데이터 출처는 [UCI Machine Learning Repository](https://doi.org/10.24432/C5MW4Z)이며 CC BY 4.0으로 제공됩니다.
