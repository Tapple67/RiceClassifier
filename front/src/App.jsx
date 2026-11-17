import { useEffect, useMemo, useRef, useState } from 'react';
import { streamPrediction } from './api/predict.js';
import Conveyor from './components/Conveyor.jsx';
import DetailsPanel from './components/DetailsPanel.jsx';
import FeatureSliders from './components/FeatureSliders.jsx';
import ResultPanel, { readResult } from './components/ResultPanel.jsx';
import RiceGrain from './components/RiceGrain.jsx';
import { CLASSES, FEATURES, PRESETS, clampFeature, deriveFromAxes, randomSample } from './features.js';

const AXIS_KEYS = ['Major_Axis_Length', 'Minor_Axis_Length'];
const DERIVED_KEYS = ['Area', 'Perimeter', 'Eccentricity', 'Convex_Area'];
const MAX_RANDOM = 100;

// * 연출 시간(ms). 개수가 많을수록 짧게 잡아 100개도 오래 걸리지 않게 한다.
// * travel: 벨트 입구→스캐너, scan: 응답이 빨라도 스캐너에 머무는 최소 시간, deliver: 스캐너→결과함
function timingFor(count) {
  if (count === 1) return { travel: 1600, scan: 900, deliver: 900 };
  if (count <= 10) return { travel: 1000, scan: 400, deliver: 700 };
  return { travel: 650, scan: 150, deliver: 500 };
}

// * Spring API는 요청 한 번에 쌀알 한 건을 받으므로 여러 건은 동시에 최대 4건씩 보낸다.
// * 동시에 검사 중인 쌀알은 스캐너 아래에서 각자 다른 칸(lane)에 멈춘다.
function lanesFor(count) {
  return count === 1 ? [62] : [50, 60, 70, 80].slice(0, Math.min(4, count));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [values, setValues] = useState(PRESETS[0].values);
  const [linked, setLinked] = useState(true);
  const [randomCount, setRandomCount] = useState(20);
  const [runState, setRunState] = useState('idle');
  const [items, setItems] = useState([]);
  const [run, setRun] = useState({ timing: timingFor(1), lanes: lanesFor(1) });
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = runState === 'running';

  const summary = useMemo(() => {
    const counts = Object.fromEntries(CLASSES.map((c) => [c.name, 0]));
    let finished = 0;
    let errors = 0;
    let confidenceSum = 0;
    for (const item of items) {
      if (item.status === 'done') {
        finished += 1;
        counts[item.result.prediction] = (counts[item.result.prediction] ?? 0) + 1;
        confidenceSum += item.result.confidence ?? 0;
      } else if (item.status === 'error') {
        finished += 1;
        errors += 1;
      }
    }
    const succeeded = finished - errors;
    return {
      total: items.length,
      finished,
      errors,
      counts,
      meanConfidence: succeeded > 0 ? confidenceSum / succeeded : null,
      firstError: items.find((item) => item.status === 'error')?.error ?? '',
    };
  }, [items]);

  function handleChange(key, value) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (linked && AXIS_KEYS.includes(key)) {
        const derived = deriveFromAxes(next);
        for (const f of FEATURES) derived[f.key] = clampFeature(f, derived[f.key]);
        return derived;
      }
      return next;
    });
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function stop() {
    abortRef.current?.abort();
    setItems((prev) =>
      prev.map((item) => (item.status === 'done' || item.status === 'error' ? { ...item, stage: 'gone' } : { ...item, stage: 'gone', status: 'stopped' })),
    );
    setRunState('stopped');
  }

  function clear() {
    abortRef.current?.abort();
    setItems([]);
    setRunState('idle');
  }

  async function inspectOne(item, lane, timing, signal) {
    updateItem(item.id, { stage: 'spawn', lane, status: 'pending' });

    let received = null;
    const request = streamPrediction(item.values, {
      signal,
      onEvent: (event) => {
        if (event.name === 'prediction_error') throw new Error('예측 스트림이 중간에 끊겼습니다.');
        const parsed = readResult(event.data);
        if (parsed) received = parsed;
      },
    });
    request.catch(() => {});

    // * 첫 위치(-12%)가 그려진 뒤 목표 위치를 바꿔야 CSS transition이 동작한다.
    await wait(40);
    if (signal.aborted) return;
    updateItem(item.id, { stage: 'enter' });
    await wait(timing.travel);
    if (signal.aborted) return;
    updateItem(item.id, { stage: 'scan' });

    let patch;
    try {
      await Promise.all([request, wait(timing.scan)]);
      if (!received) throw new Error('예측 결과 이벤트를 받지 못했습니다.');
      patch = { status: 'done', result: received };
    } catch (err) {
      patch = {
        status: 'error',
        error: err.code === 'ERR_NETWORK' ? 'Spring Boot 서버(8080)에 연결할 수 없습니다.' : err.message,
      };
    }
    if (signal.aborted) return;

    updateItem(item.id, { ...patch, stage: 'exit' });
    await wait(timing.deliver);
    if (signal.aborted) return;
    updateItem(item.id, { stage: 'gone' });
  }

  async function startRun(samples) {
    if (busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timing = timingFor(samples.length);
    const lanes = lanesFor(samples.length);
    const queue = samples.map((sample, i) => ({
      id: `${Date.now()}-${i}`,
      index: i + 1,
      values: sample,
      status: 'queued',
      stage: 'queued',
      lane: 0,
      result: null,
      error: '',
    }));

    setRun({ timing, lanes });
    setItems(queue);
    setRunState('running');

    let next = 0;
    const workers = lanes.map(async (_, lane) => {
      while (next < queue.length && !controller.signal.aborted) {
        const item = queue[next];
        next += 1;
        await inspectOne(item, lane, timing, controller.signal);
      }
    });
    await Promise.all(workers);
    if (!controller.signal.aborted) setRunState('done');
  }

  function sendRandom() {
    const count = Math.min(MAX_RANDOM, Math.max(1, Math.round(randomCount) || 1));
    setRandomCount(count);
    startRun(Array.from({ length: count }, randomSample));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Rice Classifier</h1>
            <p>쌀알의 크기와 모양으로 Cammeo · Osmancik 품종 판별</p>
          </div>
        </div>
        <ol className="flow" aria-label="처리 흐름">
          <li>React</li>
          <li>Spring Boot</li>
          <li>FastAPI · LightGBM</li>
        </ol>
      </header>

      <main className="stage">
        <section className="input">
          <header className="panel-head">
            <span className="step">01</span>
            <h2>쌀알 측정값</h2>
          </header>

          <div className="specimen">
            <div className="specimen-grid" aria-hidden="true" />
            <RiceGrain values={values} className="specimen-grain" />
            <div className="specimen-meta">
              <span>{values.Major_Axis_Length.toFixed(3)} × {values.Minor_Axis_Length.toFixed(3)} px</span>
              <span>e = {values.Eccentricity.toFixed(3)}</span>
            </div>
          </div>

          <div className="toolbar">
            <div className="presets" role="group" aria-label="예시 샘플">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" className="chip" disabled={busy} onClick={() => setValues(p.values)}>
                  {p.name}
                </button>
              ))}
            </div>
            <label className="toggle" title="장축·단축을 바꾸면 면적, 둘레, 이심률, 볼록 면적을 타원 공식으로 맞춥니다">
              <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
              <span>형태 연동</span>
            </label>
          </div>

          <FeatureSliders
            values={values}
            onChange={handleChange}
            disabled={busy}
            linkedKeys={linked ? DERIVED_KEYS : []}
          />

          <div className="actions">
            <button type="button" className="send" onClick={() => startRun([{ ...values }])} disabled={busy}>
              {busy ? '검사 중…' : '현재 값 보내기'}
              <span aria-hidden="true">→</span>
            </button>

            <div className="random">
              <label htmlFor="random-count">무작위 샘플</label>
              <input
                id="random-count"
                type="number"
                min={1}
                max={MAX_RANDOM}
                value={randomCount}
                disabled={busy}
                onChange={(e) => setRandomCount(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setRandomCount((n) => Math.min(MAX_RANDOM, Math.max(1, Math.round(n) || 1)))}
              />
              <span>개</span>
              <button type="button" className="send-random" onClick={sendRandom} disabled={busy}>
                무작위 보내기
              </button>
            </div>
            {busy && (
              <button type="button" className="ghost" onClick={stop}>
                검사 중지
              </button>
            )}
          </div>
        </section>

        <div className="center">
          <Conveyor
            runState={runState}
            items={items}
            preview={values}
            timing={run.timing}
            lanes={run.lanes}
            summary={summary}
          />
          <DetailsPanel items={items} busy={busy} onLoad={setValues} />
        </div>

        <ResultPanel runState={runState} items={items} summary={summary} onClear={clear} />
      </main>
    </div>
  );
}
