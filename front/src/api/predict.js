import axios from 'axios';

// * React(axios) ⇄ Spring Boot(WebClient) ⇄ FastAPI(LightGBM)
// * 개발 중에는 Vite 프록시가 /api를 Spring(8080)으로 넘기므로 baseURL을 비워 둔다.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  // * 브라우저 기본 XHR 어댑터는 응답을 끝까지 모은 뒤 넘겨 준다.
  // * fetch 어댑터와 stream 응답을 쓰면 SSE 이벤트가 도착하는 대로 읽을 수 있다.
  adapter: 'fetch',
  responseType: 'stream',
  validateStatus: () => true,
});

// * Spring의 POST /api/predictions/stream은 SSE로 응답한다.
export async function streamPrediction(sample, { onEvent, signal }) {
  const response = await api.post('/api/predictions/stream', sample, {
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    signal,
  });

  const reader = response.data.pipeThrough(new TextDecoderStream()).getReader();

  if (response.status < 200 || response.status >= 300) {
    // * 스트림 시작 전 오류는 ApiExceptionHandler가 ProblemDetail JSON으로 보낸다.
    throw new PredictionError(response.status, await readProblemDetail(reader, response.status));
  }

  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, '\n');

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseEvent(raw);
      if (event) onEvent(event);
    }
  }

  const tail = parseEvent(buffer.trim());
  if (tail) onEvent(tail);
}

async function readProblemDetail(reader, status) {
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      text += value;
    }
    const problem = JSON.parse(text);
    return problem.detail || problem.title || statusMessage(status);
  } catch {
    return statusMessage(status);
  }
}

function parseEvent(raw) {
  if (!raw) return null;
  let name = 'message';
  const dataLines = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue;
    const sep = line.indexOf(':');
    const field = sep === -1 ? line : line.slice(0, sep);
    const value = sep === -1 ? '' : line.slice(sep + 1).replace(/^ /, '');
    if (field === 'event') name = value;
    else if (field === 'data') dataLines.push(value);
  }
  if (dataLines.length === 0) return null;

  const text = dataLines.join('\n');
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // JSON이 아닌 이벤트는 문자열 그대로 넘긴다.
  }
  return { name, data };
}

function statusMessage(status) {
  if (status === 400) return '입력값이 올바르지 않습니다.';
  if (status === 502) return '예측 서버(FastAPI)에 연결할 수 없습니다.';
  if (status === 504) return '예측 서버 응답 시간이 초과되었습니다.';
  // * Spring이 꺼져 있으면 Vite 프록시가 본문 없는 500을 돌려준다.
  if (status === 500) return 'Spring Boot 서버(8080)가 응답하지 않습니다.';
  return `요청이 실패했습니다. (HTTP ${status})`;
}

export class PredictionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
