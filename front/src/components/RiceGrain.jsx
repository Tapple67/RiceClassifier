import { useId, useMemo } from 'react';

const POINTS = 180;
// * 데이터셋 최대 장축(약 240px)이 viewBox 폭(270) 안에 들어가도록 잡은 배율
const PX_PER_UNIT = 0.93;

function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

// * 7개 특성을 쌀알 윤곽선으로 옮긴다.
// * 장축·단축 → 크기, 면적 → 전체 배율 보정, 외접 사각형 비율 → 모서리의 각진 정도,
// * 이심률 → 양 끝의 뾰족함, 볼록 껍질 면적 → 배아 쪽 홈의 깊이, 둘레 → 외곽선의 울퉁불퉁함
export function buildGrainPath(values) {
  const major = values.Major_Axis_Length;
  const minor = Math.min(values.Minor_Axis_Length, major);
  const ellipseArea = (Math.PI / 4) * major * minor;
  const areaScale = Math.min(1.15, Math.max(0.85, Math.sqrt(values.Area / ellipseArea)));

  const a = (major / 2) * PX_PER_UNIT * areaScale;
  const b = (minor / 2) * PX_PER_UNIT * areaScale;

  const exponent = mapRange(values.Extent, 0.49, 0.87, 1.75, 3.1);
  const taper = mapRange(values.Eccentricity, 0.77, 0.95, 0.02, 0.26);

  const deficiency = Math.max(0, (values.Convex_Area - values.Area) / values.Convex_Area);
  const notchDepth = mapRange(deficiency, 0, 0.07, 0, 0.42) * b;

  const halfA = major / 2;
  const halfB = minor / 2;
  const ellipsePerimeter =
    Math.PI * (3 * (halfA + halfB) - Math.sqrt((3 * halfA + halfB) * (halfA + 3 * halfB)));
  const roughness = mapRange(values.Perimeter / ellipsePerimeter, 1.0, 1.08, 0, 0.035);

  const points = [];
  for (let i = 0; i < POINTS; i += 1) {
    const t = (i / POINTS) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let x = a * Math.sign(c) * Math.abs(c) ** (2 / exponent);
    let y = b * Math.sign(s) * Math.abs(s) ** (2 / exponent);

    const along = Math.abs(x) / a;
    y *= 1 - taper * along ** 2.4;

    // * 배아 홈은 오른쪽 끝의 아랫부분에 둔다.
    const dx = (x - a * 0.78) / (a * 0.16);
    const dy = (y - b * 0.55) / (b * 0.7);
    if (y > 0) y -= notchDepth * Math.exp(-(dx * dx + dy * dy));

    const wobble = 1 + roughness * (Math.sin(t * 9) * 0.6 + Math.sin(t * 17 + 1.3) * 0.4);
    x *= wobble;
    y *= wobble;
    points.push([x, y]);
  }

  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`;
}

// * size를 생략하면 부모 폭을 꽉 채운다.
export default function RiceGrain({ values, size, rotate = -6, className = '' }) {
  const id = useId().replace(/:/g, '');
  const path = useMemo(() => buildGrainPath(values), [values]);
  const major = values.Major_Axis_Length * PX_PER_UNIT;
  const minor = values.Minor_Axis_Length * PX_PER_UNIT;

  return (
    <svg
      className={`grain ${className}`}
      viewBox="-135 -76 270 152"
      width={size ?? '100%'}
      height={size ? (size * 152) / 270 : undefined}
      overflow="visible"
      role="img"
      aria-label={`장축 ${values.Major_Axis_Length}, 단축 ${values.Minor_Axis_Length}인 쌀알`}
    >
      <defs>
        <radialGradient id={`body-${id}`} cx="42%" cy="34%" r="75%">
          <stop offset="0%" stopColor="var(--grain-light)" />
          <stop offset="55%" stopColor="var(--grain-mid)" />
          <stop offset="100%" stopColor="var(--grain-dark)" />
        </radialGradient>
        <radialGradient id={`chalk-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={`shadow-${id}`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="var(--shadow)" floodOpacity="0.35" />
        </filter>
      </defs>
      <g transform={`rotate(${rotate})`}>
        <path d={path} fill={`url(#body-${id})`} filter={`url(#shadow-${id})`} className="grain-body" />
        <ellipse cx={-major * 0.12} cy={-minor * 0.08} rx={major * 0.2} ry={minor * 0.16} fill={`url(#chalk-${id})`} />
        <path d={path} fill="none" stroke="var(--grain-edge)" strokeWidth="1.2" className="grain-body" />
      </g>
    </svg>
  );
}
