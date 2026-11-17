import { CLASSES } from '../features.js';
import RiceGrain from './RiceGrain.jsx';

// * FastAPI 이벤트 본문은 {"result": {"prediction": ["Cammeo"], "probabilities": [0.9, 0.1]}} 형태다.
export function readResult(data) {
  const result = data?.result ?? data;
  const prediction = Array.isArray(result?.prediction) ? result.prediction[0] : result?.prediction;
  const probabilities = Array.isArray(result?.probabilities) ? result.probabilities : null;
  if (prediction == null) return null;

  const index = CLASSES.findIndex((c) => c.name === String(prediction));
  const confidence = probabilities && index !== -1 ? probabilities[index] : null;
  return { prediction: String(prediction), probabilities, confidence };
}

export function classColor(name) {
  return CLASSES.find((c) => c.name === name)?.color ?? 'var(--ink-soft)';
}

function percent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function SingleResult({ item }) {
  const { result } = item;
  const winner = CLASSES.find((c) => c.name === result.prediction);
  return (
    <div className="result-card" style={{ '--accent': winner?.color ?? 'var(--ink)' }}>
      <div className="result-grain">
        <RiceGrain values={item.values} size={150} rotate={-14} />
      </div>
      <p className="result-kicker">예측 품종</p>
      <p className="result-name">{result.prediction}</p>
      {winner && <p className="result-desc">{winner.desc}</p>}
      {result.confidence != null && (
        <p className="result-conf">
          확신도 <b>{percent(result.confidence)}</b>
        </p>
      )}
      {result.probabilities && (
        <ul className="probs">
          {CLASSES.map((c, i) => {
            const p = result.probabilities[i] ?? 0;
            return (
              <li key={c.name}>
                <span className="prob-name">{c.name}</span>
                <span className="prob-track">
                  <span className="prob-fill" style={{ width: `${p * 100}%`, background: c.color }} />
                </span>
                <span className="prob-val">{percent(p)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BatchSummary({ items, summary }) {
  const succeeded = summary.finished - summary.errors;
  const leader = CLASSES.reduce((a, b) => (summary.counts[b.name] > summary.counts[a.name] ? b : a));

  return (
    <div className="summary" style={{ '--accent': succeeded > 0 ? leader.color : 'var(--ink)' }}>
      <p className="result-kicker">
        {summary.finished < summary.total ? `집계 중 · ${summary.finished}/${summary.total}` : `${summary.total}개 검사 완료`}
      </p>

      <div className="tally">
        {CLASSES.map((c) => {
          const n = summary.counts[c.name] ?? 0;
          return (
            <div key={c.name} className="tally-cell" style={{ '--c': c.color }}>
              <span className="tally-name">{c.name}</span>
              <span className="tally-count">{n}</span>
              <span className="tally-pct">{succeeded > 0 ? percent(n / succeeded) : '–'}</span>
            </div>
          );
        })}
      </div>

      <div className="stack" role="img" aria-label="품종 비율">
        {CLASSES.map((c) => (
          <span
            key={c.name}
            style={{ flexGrow: summary.counts[c.name] ?? 0, background: c.color }}
          />
        ))}
        {summary.errors > 0 && <span style={{ flexGrow: summary.errors }} className="stack-error" />}
      </div>

      <dl className="stats">
        <div>
          <dt>평균 확신도</dt>
          <dd>{summary.meanConfidence != null ? percent(summary.meanConfidence) : '–'}</dd>
        </div>
        <div>
          <dt>오류</dt>
          <dd className={summary.errors > 0 ? 'is-bad' : ''}>{summary.errors}건</dd>
        </div>
      </dl>

      <div className="waffle" aria-label="샘플별 분류">
        {items.map((item) => (
          <span
            key={item.id}
            title={`#${item.index} ${item.status === 'done' ? item.result.prediction : item.status === 'error' ? '오류' : '대기'}`}
            className={`cell cell-${item.status}`}
            style={item.status === 'done' ? { background: classColor(item.result.prediction) } : undefined}
          />
        ))}
      </div>
      <p className="hint">세부 결과는 검사 라인 아래에서 볼 수 있습니다.</p>
    </div>
  );
}

export default function ResultPanel({ runState, items, summary, onClear }) {
  const allFailed = summary.total > 0 && summary.finished === summary.total && summary.errors === summary.total;
  const singleDone = items.length === 1 && items[0].status === 'done';

  return (
    <section className={`result run-${runState}`}>
      <header className="panel-head">
        <span className="step">03</span>
        <h2>분류 결과</h2>
      </header>

      <div className="bin">
        {allFailed && (
          <div className="result-error" role="alert">
            <strong>분류하지 못했습니다</strong>
            <p>{summary.firstError}</p>
          </div>
        )}

        {!allFailed && singleDone && <SingleResult item={items[0]} />}

        {!allFailed && items.length > 1 && summary.finished > 0 && <BatchSummary items={items} summary={summary} />}

        {!allFailed && !singleDone && !(items.length > 1 && summary.finished > 0) && (
          <div className="bin-empty">
            <div className="bin-mouth" />
            <p>
              {runState === 'idle'
                ? '컨베이어를 통과한 쌀알이 여기에 도착합니다'
                : runState === 'stopped'
                  ? '검사를 중지했습니다'
                  : '쌀알을 기다리는 중…'}
            </p>
          </div>
        )}

        {items.length > 0 && runState !== 'running' && (
          <button type="button" className="ghost" onClick={onClear}>
            결과 지우기
          </button>
        )}
      </div>
    </section>
  );
}
