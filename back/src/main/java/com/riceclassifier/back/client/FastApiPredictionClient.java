package com.riceclassifier.back.client;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeoutException;

import com.riceclassifier.back.dto.RicePredictionRequest;

import lombok.RequiredArgsConstructor;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.codec.CodecException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientException;
import org.springframework.web.server.ResponseStatusException;

import reactor.core.publisher.Flux;

@RequiredArgsConstructor
public class FastApiPredictionClient {
    // * SSE의 이벤트 이름과 JSON 데이터 문자열을 함께 읽어 React로 전달한다.
    private static final ParameterizedTypeReference<ServerSentEvent<String>> SSE_TYPE =
            new ParameterizedTypeReference<>() {};

    private final WebClient webClient;
    private final Duration eventTimeout;

    public Flux<ServerSentEvent<String>> predict(RicePredictionRequest request) {
        return webClient.post()
                .uri("/api/check")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(request)
                // * FastAPI의 상태 코드와 Content-Type을 확인한 뒤 SSE 본문을 읽는다.
                .exchangeToFlux(response -> {
                    int status = response.statusCode().value();
                    if (status == 400 || status == 422) {
                        // ! FastAPI의 검증 응답 본문에는 요청값이 포함될 수 있다.
                        return response.releaseBody().thenMany(Flux.error(
                                new PredictionGatewayException(HttpStatus.BAD_REQUEST, "Invalid prediction input.")));
                    }
                    boolean isEventStream = response.headers().contentType()
                            .filter(MediaType.TEXT_EVENT_STREAM::isCompatibleWith)
                            .isPresent();
                    if (!response.statusCode().is2xxSuccessful() || !isEventStream) {
                        return response.releaseBody().thenMany(Flux.error(upstreamFailure()));
                    }
                    return response.bodyToFlux(SSE_TYPE);
                })
                // * 첫 이벤트가 오기까지와 이후 이벤트 사이의 대기 시간을 제한한다.
                .timeout(eventTimeout)
                .onErrorMap(TimeoutException.class, error -> new PredictionGatewayException(
                        HttpStatus.GATEWAY_TIMEOUT, "The prediction server timed out."))
                .onErrorMap(error -> error instanceof WebClientException
                                || error instanceof IOException || error instanceof CodecException,
                        error -> upstreamFailure());
    }

    private static PredictionGatewayException upstreamFailure() {
        return new PredictionGatewayException(HttpStatus.BAD_GATEWAY,
                "The prediction server could not return a valid stream.");
    }

    // * FastAPI 호출에서 예상할 수 있는 실패에 공개할 상태 코드와 메시지를 담는다.
    public static final class PredictionGatewayException extends ResponseStatusException {
        private PredictionGatewayException(HttpStatus status, String message) {
            super(status, message);
        }
    }
}
