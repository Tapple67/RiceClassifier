package com.riceclassifier.back.service;

import com.riceclassifier.back.client.FastApiPredictionClient;
import com.riceclassifier.back.client.FastApiPredictionClient.PredictionGatewayException;
import com.riceclassifier.back.dto.RicePredictionRequest;

import lombok.RequiredArgsConstructor;

import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;

import reactor.core.publisher.Flux;

@Service
@RequiredArgsConstructor
public class PredictionService {
    private final FastApiPredictionClient predictionClient;

    public Flux<ServerSentEvent<String>> streamPredictions(RicePredictionRequest request) {
        return predictionClient.predict(request).switchOnFirst((first, events) -> {
            // * 첫 이벤트 전의 오류는 공통 예외 처리기가 HTTP 오류 응답으로 바꾼다.
            if (!first.hasValue()) {
                return events;
            }

            // * 첫 SSE 이후에는 HTTP 상태가 확정되므로 오류를 SSE로 전달한다.
            return events.onErrorReturn(PredictionGatewayException.class,
                    ServerSentEvent.builder("{\"code\":\"PREDICTION_STREAM_FAILED\"}")
                            .event("prediction_error")
                            .build());
        });
    }
}
