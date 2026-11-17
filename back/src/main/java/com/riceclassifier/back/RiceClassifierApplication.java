package com.riceclassifier.back;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// * 서버를 시작하고 이 패키지 아래의 설정, 컨트롤러, 서비스 등을 Spring에 등록한다.
@SpringBootApplication
public class RiceClassifierApplication {
    public static void main(String[] args) {
        SpringApplication.run(RiceClassifierApplication.class, args);
    }
}
