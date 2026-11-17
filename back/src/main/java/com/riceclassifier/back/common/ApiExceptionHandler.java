package com.riceclassifier.back.common;

import com.riceclassifier.back.client.FastApiPredictionClient.PredictionGatewayException;

import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(PredictionGatewayException.class)
    public ResponseEntity<ProblemDetail> handlePredictionFailure(PredictionGatewayException error) {
        // ! 스트림 시작 전 호출 오류에는 Spring에서 정의한 공개 메시지만 보낸다.
        return ResponseEntity.status(error.getStatusCode())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(error.getBody());
    }
}
