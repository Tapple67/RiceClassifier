package com.riceclassifier.back.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Getter;
import lombok.Setter;

// * Java 필드명은 camelCase로 쓰고, JSON 키는 FastAPI가 받는 이름을 사용한다.
@Getter
@Setter
public class RicePredictionRequest {
    @JsonProperty("Area")
    private Integer area;

    @JsonProperty("Perimeter")
    private Double perimeter;

    @JsonProperty("Major_Axis_Length")
    private Double majorAxisLength;

    @JsonProperty("Minor_Axis_Length")
    private Double minorAxisLength;

    @JsonProperty("Eccentricity")
    private Double eccentricity;

    @JsonProperty("Convex_Area")
    private Integer convexArea;

    @JsonProperty("Extent")
    private Double extent;
}
