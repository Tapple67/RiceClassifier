import { useState } from 'react';
import { CLASSES, FEATURES, formatFeature } from '../features.js';
import { classColor } from './ResultPanel.jsx';
import RiceGrain from './RiceGrain.jsx';

const STATUS_TEXT = { queued: '대기', pending: '검사 중', stopped: '중지', error: '오류' };

const FILTERS = [
  { key: 'all', label: '전체', match: () => true },
  ...CLASSES.map((c) => ({
    key: c.name,
    label: c.name,
    match: (item) => item.status === 'done' && item.result.prediction === c.name,
  })),
  { key: 'error', label: '오류', match: (item) => item.status === 'error' },
];

export default function DetailsPanel({ items, busy, onLoad }) {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const rows = items.filter(active.match);

  return (
    <section className="details">
      <header className="panel-head">
        <span className="step">04</span>
        <h2>세부 결과</h2>
        <div className="filters" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={filter === f.key ? 'filter on' : 'filter'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <small>{items.filter(f.match).length}</small>
            </button>
          ))}
        </div>
      </header>

      {items.length === 0 ? (
        <p className="details-empty">검사를 시작하면 쌀알별 측정값과 확률이 여기에 쌓입니다.</p>
      ) : (
        <ol className="rows">
          {rows.map((item) => {
            const open = openId === item.id;
            const done = item.status === 'done';
            return (
              <li key={item.id} className={open ? 'row open' : 'row'}>
                <button type="button" className="row-main" onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open}>
                  <span className="row-index">#{item.index}</span>
                  <span className="row-grain">
                    <RiceGrain values={item.values} size={58} rotate={0} />
                  </span>
                  <span
                    className={`badge badge-${item.status}`}
                    style={done ? { '--c': classColor(item.result.prediction) } : undefined}
                  >
                    {done ? item.result.prediction : STATUS_TEXT[item.status]}
                  </span>
                  <span className="row-conf">
                    {done && item.result.confidence != null && (
                      <>
                        <span className="conf-track">
                          <span
                            style={{ width: `${item.result.confidence * 100}%`, background: classColor(item.result.prediction) }}
                          />
                        </span>
                        <b>{(item.result.confidence * 100).toFixed(1)}%</b>
                      </>
                    )}
                  </span>
                  <span className="chev" aria-hidden="true">▾</span>
                </button>

                {open && (
                  <div className="row-detail">
                    <dl className="values">
                      {FEATURES.map((f) => (
                        <div key={f.key}>
                          <dt>{f.key}</dt>
                          <dd>{formatFeature(f, item.values[f.key])}</dd>
                        </div>
                      ))}
                      {done &&
                        item.result.probabilities &&
                        CLASSES.map((c, i) => (
                          <div key={c.name}>
                            <dt>P({c.name})</dt>
                            <dd>{(item.result.probabilities[i] * 100).toFixed(3)}%</dd>
                          </div>
                        ))}
                    </dl>
                    {item.status === 'error' && <p className="row-error">{item.error}</p>}
                    <button type="button" className="chip" disabled={busy} onClick={() => onLoad(item.values)}>
                      슬라이더로 불러오기
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {rows.length === 0 && <li className="details-empty">해당하는 결과가 없습니다.</li>}
        </ol>
      )}
    </section>
  );
}
