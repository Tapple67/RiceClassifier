import RiceGrain from './RiceGrain.jsx';

const ON_BELT = ['spawn', 'enter', 'scan', 'exit'];

// * 단계마다 쌀알의 위치와 이동 시간을 정한다. 실제 이동은 CSS transition이 맡는다.
function grainStyle(item, lanes, timing) {
  const scanAt = `${lanes[item.lane] ?? lanes[0]}%`;
  switch (item.stage) {
    case 'spawn':
      return { left: '-12%', transition: 'none' };
    case 'enter':
    case 'scan':
      return { left: scanAt, transition: `left ${timing.travel}ms cubic-bezier(0.55, 0, 0.3, 1)` };
    default:
      return { left: '112%', transition: `left ${timing.deliver}ms cubic-bezier(0.6, 0, 0.9, 0.6)` };
  }
}

export default function Conveyor({ runState, items, preview, timing, lanes, summary }) {
  const running = runState === 'running';
  const onBelt = items.filter((item) => ON_BELT.includes(item.stage));
  const scanning = onBelt.some((item) => item.stage === 'scan');
  const single = items.length <= 1;
  const grainSize = single ? 120 : 84;
  const progress = summary.total > 0 ? (summary.finished / summary.total) * 100 : 0;

  const scannerLeft = lanes[0] - 7;
  const scannerRight = 100 - lanes[lanes.length - 1] - 7;

  let stageText = '대기 중 · 값을 조정하고 보내기를 누르세요';
  if (running) stageText = scanning ? 'FastAPI · LightGBM 추론 중' : 'Spring Boot로 전송 중';
  if (runState === 'done') stageText = summary.errors === summary.total ? '라인 정지 · 분류 실패' : '검사 완료';
  if (runState === 'stopped') stageText = '검사 중지됨';

  const reached = {
    react: runState !== 'idle',
    spring: runState !== 'idle',
    fastapi: scanning || summary.finished > 0,
    result: summary.finished > 0,
  };

  return (
    <section className={`conveyor run-${runState}${scanning ? ' is-scanning' : ''}`} aria-live="polite">
      <header className="panel-head">
        <span className="step">02</span>
        <h2>검사 라인</h2>
        {summary.total > 0 && (
          <span className="panel-meta">
            {summary.finished} / {summary.total}
          </span>
        )}
      </header>

      <div className="line">
        <div className="stations">
          <span className={reached.react ? 'station on' : 'station'}>React</span>
          <span className={reached.spring ? 'station on' : 'station'}>Spring</span>
          <span className={reached.fastapi ? 'station on' : 'station'}>FastAPI</span>
          <span className={reached.result ? 'station on' : 'station'}>결과</span>
        </div>

        <div className="belt-area">
          <div className="scanner" style={{ left: `${scannerLeft}%`, right: `${scannerRight}%` }}>
            <div className="scanner-head">
              <span className="lamp" />
              LGBM
            </div>
            <div className="beam" />
          </div>

          {runState === 'idle' && (
            <div className="belt-grain is-preview" style={{ left: '12%' }}>
              <RiceGrain values={preview} size={grainSize} rotate={0} />
            </div>
          )}

          {onBelt.map((item) => (
            <div
              key={item.id}
              className={`belt-grain stage-${item.stage} status-${item.status}`}
              style={grainStyle(item, lanes, timing)}
            >
              {item.stage === 'exit' && (
                <span className="grain-tag">{item.status === 'done' ? item.result.prediction : '오류'}</span>
              )}
              <RiceGrain values={item.values} size={grainSize} rotate={0} />
            </div>
          ))}

          <div className={running ? 'belt running' : 'belt'}>
            <div className="belt-surface" />
            <div className="rollers">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="roller" />
              ))}
            </div>
          </div>
          <div className="legs">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="progress" aria-hidden={summary.total === 0}>
          <span style={{ width: `${progress}%` }} />
        </div>

        <p className="stage-text">
          <span className={running ? 'dot blink' : 'dot'} />
          {stageText}
          {summary.errors > 0 && <small>오류 {summary.errors}건</small>}
        </p>
      </div>
    </section>
  );
}
