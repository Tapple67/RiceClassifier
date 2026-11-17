import { FEATURES, formatFeature } from '../features.js';

export default function FeatureSliders({ values, onChange, disabled, linkedKeys }) {
  return (
    <ul className="sliders">
      {FEATURES.map((feature) => {
        const value = values[feature.key];
        const percent = ((value - feature.min) / (feature.max - feature.min)) * 100;
        const linked = linkedKeys.includes(feature.key);
        return (
          <li key={feature.key} className={linked ? 'slider is-linked' : 'slider'}>
            <label htmlFor={`f-${feature.key}`} className="slider-head">
              <span className="slider-label">
                {feature.label}
                <code>{feature.key}</code>
              </span>
              <span className="slider-value">
                {formatFeature(feature, value)}
                {feature.unit && <small>{feature.unit}</small>}
              </span>
            </label>
            <input
              id={`f-${feature.key}`}
              type="range"
              min={feature.min}
              max={feature.max}
              step={feature.step}
              value={value}
              disabled={disabled}
              style={{ '--fill': `${percent}%` }}
              onChange={(e) => onChange(feature.key, Number(e.target.value))}
              title={feature.hint}
            />
          </li>
        );
      })}
    </ul>
  );
}
