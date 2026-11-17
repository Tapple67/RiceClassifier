package com.riceclassifier.back.controller;

import com.riceclassifier.back.dto.RicePredictionRequest;
import com.riceclassifier.back.service.PredictionService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
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
    public Flux<ServerSentEvent<String>> predict(@RequestBody RicePredictionRequest request) {
        return predictionService.streamPredictions(request);
    }
}
