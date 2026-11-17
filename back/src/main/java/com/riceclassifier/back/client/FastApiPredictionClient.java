package com.riceclassifier.back.client;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeoutException;

import com.riceclassifier.back.dto.RicePredictionRequest;

import lombok.RequiredArgsConstructor;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.codec.CodecException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.reactive.function.client.ClientResponse;
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

    // * 쌀알 특성값을 FastAPI에 보내고, Spring이 React에 중계할 예측 스트림을 반환한다.
    public Flux<ServerSentEvent<String>> predict(RicePredictionRequest request) {
        return webClient.post()
                .uri("/api/check")    // FastAPI에게 요청 
                .contentType(MediaType.APPLICATION_JSON)  // 쌀알 특성값을 JSON으로 보냄
                .accept(MediaType.TEXT_EVENT_STREAM)  //결과를 sse로 받겠다
                .bodyValue(request)     // request를 본문에 담는다
                .exchangeToFlux(this::readPredictionEvents) // FastAPI 응답을 검사하고 SSE로 읽는 일을 맡긴다.
                // * 첫 이벤트가 오기까지와 이후 이벤트 사이의 대기 시간을 제한한다.
                .timeout(eventTimeout)
                .onErrorMap(TimeoutException.class, error -> new PredictionGatewayException(
                        HttpStatus.GATEWAY_TIMEOUT, "The prediction server timed out."))
                .onErrorMap(error -> error instanceof WebClientException
                                || error instanceof IOException || error instanceof CodecException,
                        error -> upstreamFailure());
    }





    // * FastAPI 응답을 확인해 정상 응답은 SSE 이벤트로 읽고, 실패 응답은 Spring 예외로 바꾼다.
    private Flux<ServerSentEvent<String>> readPredictionEvents(ClientResponse response) {
        HttpStatusCode status = response.statusCode();
        if (status.value() == 400 || status.value() == 422) {
            // ! FastAPI 검증 오류 본문에는 요청값이 포함될 수 있어 정해진 메시지만 전달한다.
            return response.releaseBody().thenMany(Flux.error(
                    new PredictionGatewayException(HttpStatus.BAD_REQUEST, "Invalid prediction input.")));
        }

        boolean isEventStream = response.headers().contentType()
                .filter(MediaType.TEXT_EVENT_STREAM::isCompatibleWith)
                .isPresent();
        if (!status.is2xxSuccessful() || !isEventStream) {
            return response.releaseBody().thenMany(Flux.error(upstreamFailure()));
        }

        return response.bodyToFlux(SSE_TYPE);    // 응답에서 예측을 하나씩 읽어 Spring에 넘긴다.
        //data: {"result":{"prediction":["Cammeo"],"probabilities":[0.99,0.01]}}
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
