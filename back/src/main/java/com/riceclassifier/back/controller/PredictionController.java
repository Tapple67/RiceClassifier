package com.riceclassifier.back.controller;

import com.riceclassifier.back.client.FastApiPredictionClient.PredictionGatewayException;
import com.riceclassifier.back.dto.RicePredictionRequest;
import com.riceclassifier.back.service.PredictionService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import reactor.core.publisher.Flux;

@RestController
@RequiredArgsConstructor
// ! React 개발 서버처럼 Spring과 출처가 다른 브라우저 요청은 설정한 Origin에만 허용한다.
@CrossOrigin(origins = "${app.frontend-origin}")
public class PredictionController {
    private final PredictionService predictionService;

    // * React의 JSON 한 건을 받아 같은 HTTP 응답으로 예측 이벤트를 차례로 보낸다.
    @PostMapping(
            path = "/api/predictions/stream",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public Flux<ServerSentEvent<String>> predict(
            @RequestBody RicePredictionRequest request,
            ServerHttpResponse response
    ) {
        return predictionService.streamPredictions(request)
                .onErrorResume(PredictionGatewayException.class, error -> {
                    // * 응답이 열리기 전의 오류는 공통 예외 처리기가 HTTP 응답으로 만든다.
                    if (!response.isCommitted()) {
                        return Flux.error(error);
                    }

                    // * 이미 응답을 보내는 중이면 오류를 SSE 이벤트로 알린다.
                    return Flux.just(ServerSentEvent.builder("{\"code\":\"PREDICTION_STREAM_FAILED\"}")
                            .event("prediction_error")
                            .build());
                });
    }
}
