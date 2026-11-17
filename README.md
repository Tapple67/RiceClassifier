# 쌀알의 크기와 모양으로 품종 분류하기

쌀알의 면적, 둘레, 장축·단축 길이, 이심률, 볼록 껍질 면적, 외접 사각형 대비 면적 비율로 Cammeo와 Osmancik 품종을 분류하는 실습 프로젝트입니다. [UCI Rice 데이터셋](https://archive.ics.uci.edu/dataset/545/rice-cammeo-and-osmancik)은 3,810행이며, 7개 측정값이 입력이고 `Class`가 정답입니다.

## 폴더 구조

| 폴더 | 역할 | 상태 |
| --- | --- | --- |
| `back/` | Spring Boot 및 WebFlux. FastAPI 호출에 WebClient를 사용하고, 결과를 React에 SSE로 전달할 예정입니다. | 초기 설정 완료 |
| `front/` | React 화면과 샘플별 분류 결과 표시 | 구현 예정 |
| `python/` | LightGBM 학습, Optuna 튜닝, 모델 저장, FastAPI 추론 | 구현 예정 |

```text
React ← HTTP / SSE → Spring Boot ← HTTP → FastAPI · LightGBM
```

## Spring Boot 실행

JDK 17이 필요합니다. Gradle Wrapper가 빌드에 사용할 Gradle 버전을 지정합니다. 설치된 Gradle과 의존성 캐시가 없다면 첫 실행 시 다운로드가 필요합니다.

저장소 루트에서 PowerShell로 실행합니다.

```powershell
Set-Location -LiteralPath .\back
.\gradlew.bat bootRun
```

기본 포트는 `8080`입니다. 다른 포트가 필요하면 같은 PowerShell 창에서 `$env:SERVER_PORT = '8081'`를 실행한 뒤 서버를 시작합니다. 서버가 시작되었다는 로그와 포트가 출력되면 초기 실행이 정상입니다.

실행 가능한 JAR을 만들려면 `back/`에서 `.\gradlew.bat bootJar`를 실행합니다.

## 연동을 추가할 때

Spring의 FastAPI 주소와 타임아웃은 설정으로 주입하고, HTTP 호출은 전용 WebClient 구성 요소에 둡니다. Python에서는 7개 입력 필드의 계약과 검증, 모델 로딩, 추론 로직을 분리합니다. 모델 교체나 재학습 시 같은 입력 필드와 품종 응답을 유지하는지 계약 테스트로 확인합니다.

예상 가능한 입력·업무 예외의 HTTP 응답은 공통 `@RestControllerAdvice`에서 변환합니다. 흐름 설명은 `// *`, 보안·데이터 제약은 `// !`, 실제 남은 작업은 `// TODO`, 미정 설계 질문은 `// ?`로 표시합니다. API와 SSE 구현 시 정상 응답, 잘못된 입력, FastAPI 호출 실패, 권한이 필요한 경우 권한 오류를 회귀 검증에 추가합니다.

데이터 출처는 [UCI Machine Learning Repository](https://doi.org/10.24432/C5MW4Z)이며 CC BY 4.0으로 제공됩니다.
