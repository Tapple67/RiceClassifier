package com.riceclassifier.back.config;

import java.time.Duration;

import com.riceclassifier.back.client.FastApiPredictionClient;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration(proxyBeanMethods = false)
public class FastApiConfig {
    // * 앱 시작 시 설정값으로 클라이언트를 만들고 PredictionService에 주입할 빈으로 등록한다.
    @Bean
    public FastApiPredictionClient fastApiPredictionClient(
            @Value("${fastapi.base-url}") String baseUrl,
            @Value("${fastapi.event-timeout-seconds}") long eventTimeoutSeconds
    ) {
        WebClient webClient = WebClient.create(baseUrl);
        return new FastApiPredictionClient(webClient, Duration.ofSeconds(eventTimeoutSeconds));
    }
}
