// * 슬라이더 범위는 UCI Rice 데이터셋(3,810행)의 최솟값·최댓값을 조금 넓혀 잡았다.
export const FEATURES = [
  { key: 'Area', label: '면적', unit: 'px²', min: 7500, max: 19000, step: 1, integer: true,
    hint: '쌀알이 차지하는 픽셀 수' },
  { key: 'Perimeter', label: '둘레', unit: 'px', min: 355, max: 550, step: 0.001,
    hint: '외곽선 전체 길이' },
  { key: 'Major_Axis_Length', label: '장축 길이', unit: 'px', min: 145, max: 240, step: 0.001,
    hint: '긴 방향 길이' },
  { key: 'Minor_Axis_Length', label: '단축 길이', unit: 'px', min: 59, max: 108, step: 0.001,
    hint: '짧은 방향 길이' },
  { key: 'Eccentricity', label: '이심률', unit: '', min: 0.77, max: 0.95, step: 0.001,
    hint: '1에 가까울수록 길쭉함' },
  { key: 'Convex_Area', label: '볼록 껍질 면적', unit: 'px²', min: 7700, max: 19100, step: 1, integer: true,
    hint: '오목한 곳을 메운 면적' },
  { key: 'Extent', label: '외접 사각형 비율', unit: '', min: 0.49, max: 0.87, step: 0.001,
    hint: '감싸는 사각형 대비 면적' },
];

export const PRESETS = [
  {
    name: '샘플 A',
    values: {
      Area: 15231, Perimeter: 525.579, Major_Axis_Length: 229.75, Minor_Axis_Length: 85.094,
      Eccentricity: 0.929, Convex_Area: 15617, Extent: 0.573,
    },
  },
  {
    name: '샘플 B',
    values: {
      Area: 14656, Perimeter: 494.311, Major_Axis_Length: 206.02, Minor_Axis_Length: 91.731,
      Eccentricity: 0.895, Convex_Area: 15072, Extent: 0.615,
    },
  },
  {
    name: '샘플 C',
    values: {
      Area: 11434, Perimeter: 404.71, Major_Axis_Length: 161.08, Minor_Axis_Length: 90.869,
      Eccentricity: 0.826, Convex_Area: 11591, Extent: 0.802,
    },
  },
];

// * LightGBM의 classes_는 알파벳순이므로 probabilities[0]은 Cammeo, [1]은 Osmancik이다.
export const CLASSES = [
  { name: 'Cammeo', desc: '길고 가는 중립종', color: 'var(--cammeo)' },
  { name: 'Osmancik', desc: '짧고 통통한 중립종', color: 'var(--osmancik)' },
];

export function roundTo(value, step) {
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(value.toFixed(digits));
}

// * 장축·단축을 바꾸면 타원 공식으로 나머지 값을 함께 맞춘다. 계수는 샘플 A의 실제값에 맞춘 보정치다.
export function deriveFromAxes(values) {
  const major = values.Major_Axis_Length;
  const minor = Math.min(values.Minor_Axis_Length, major);
  const a = major / 2;
  const b = minor / 2;
  const area = (Math.PI / 4) * major * minor * 0.992;
  const ellipsePerimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

  return {
    ...values,
    Area: Math.round(area),
    Perimeter: roundTo(ellipsePerimeter * 1.009, 0.001),
    Eccentricity: roundTo(Math.sqrt(1 - (minor / major) ** 2), 0.001),
    Convex_Area: Math.round(area * 1.025),
  };
}

export function clampFeature(feature, value) {
  return Math.min(feature.max, Math.max(feature.min, value));
}

const randomBetween = (min, max) => min + Math.random() * (max - min);

// * 무작위 샘플도 실제 쌀알처럼 보이도록 장축과 이심률을 먼저 뽑고 나머지는 타원 공식에 잡음을 더해 만든다.
export function randomSample() {
  const major = randomBetween(150, 235);
  const eccentricity = randomBetween(0.79, 0.94);
  // * 단축 범위를 좁혀 면적이 데이터셋 범위(약 7,500~19,000) 끝에 몰리지 않게 한다.
  const minor = Math.min(100, Math.max(66, major * Math.sqrt(1 - eccentricity ** 2)));

  const base = deriveFromAxes({
    Major_Axis_Length: major,
    Minor_Axis_Length: minor,
    Extent: randomBetween(0.52, 0.84),
  });
  const area = base.Area * randomBetween(0.97, 1.03);
  const sample = {
    ...base,
    Area: Math.round(area),
    Perimeter: base.Perimeter * randomBetween(0.98, 1.03),
    Convex_Area: Math.round(area * randomBetween(1.008, 1.05)),
  };

  const result = {};
  for (const f of FEATURES) result[f.key] = roundTo(clampFeature(f, sample[f.key]), f.step);
  return result;
}

export function formatFeature(feature, value) {
  return feature.integer ? value.toLocaleString('ko-KR') : value.toFixed(3);
}
