import { generateText } from 'ai';
import { model } from './provider.js';

const result = await generateText({
  model,
  temperature: 0,
  prompt: '안녕이라고 짧게 대답해줘',
});

console.log(result.text);
//Vercel AI SDK의 generateText()는 신이다
//generateText
//이게 내가 만든 챗 함수의 중간 역할을 해줌
//

// 우리 코드
// ↓
// chat()
// ↓
// Ollama API 요청 형식 만들기
// ↓
// HTTP 요청
// ↓
// 응답 JSON 받기
// ↓
// 텍스트 꺼내기
// ↓
// 우리 코드

// 변화후
// 우리 코드
// ↓
// generateText()
// ↓
// AI SDK가 알아서 처리
// ↓
// model에 연결된 AI 제공자 호출
// ↓
// 응답 정리
// ↓
// result.text

//심지어 나중에 모델만 바꾸면 갈아끼우기 쉬움
// Claude
// → Gemini
// → OpenAI
// → Ollama

// 예전에는:

// 우리가 AI API 호출 구조까지 직접 관리

// 지금은:

// AI SDK
// ↓
// 모델 호출 방식 통일
// ↓
// 우리는 Agent 로직에 집중

// 즉,

// HTTP 어떻게 보내지?
// JSON 어떻게 파싱하지?
// Claude 응답 구조가 뭐지?

// 같은 잡일을 줄이고,

// 어떤 Tool을 쓸까?
// ↓
// 검색 결과가 충분한가?
// ↓
// 다시 검색해야 하나?
// ↓
// 목표 달성했나?

// 이걸 만드는 데 집중할 수 있는 구조야.
