package com.riceclassifier.back.service;

import com.riceclassifier.back.client.FastApiPredictionClient;
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
        return predictionClient.predict(request);
    }
}
