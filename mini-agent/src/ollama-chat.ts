//호출을 많이 사용하니 함수화

//export를 붙임으로서 밖에 다른 파일도 사용가능

//그래서 우리 코드가 Ollama에게 말을 걸려면 주소를 알아야 함.
const OLLAMA_URL = 'http://localhost:11434';
//모델 이름
export const MODEL = 'qwen2.5';

//응답에 담겨울 도구 호출에 대한 스키마
//arguments: Record<string, unknown>
//키 이름은 문자열인데, 안에 무슨 값이 들어올지는 아직 모르는 객체
// //왜냐면
// {
//   expression: "17*23"
// } 이건 문자열이지만
// {
//   city: "서울",
//   days: 3,
//   includeRain: true
// } 다른 도구는 아닐수도 있기 때문 그래서 unknown
//Ollama는 약속된 모양을 기대하니까. 타입의 안은 일단 저렇게 고정 모델에 따라 다른듯
export type ToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

//우리가 보낼 도구 우리가 쓸 툴에 대한 모양
export type ToolSchema = {
  type: 'function';
  function: { name: string; description: string; parameters: object };
};

//챗메세지 타입
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[]; //도구가 있을수도 있고 없을수도 있다 그리고 도구가 여러개일수있기에 배열
  tool_name?: string; // 룰이 툴일때 이 결과가 어느 도구에서 나온거인지 알기위해 사용
};

//잠만 왜 여기서 어느 도구에서 나온거인지 알아야하냐
//만약 도구를 2개 호출했을때
//27 이런식으로 값만 나오면 ai가 모름 이게 기온이노 환율이노 습도이노 그래서 이름표가 필요함
//이 결과가 어느 행동의 대한 결과인지 알려주는게 중요함

export async function chat(
  messages: ChatMessage[],
  tools?: ToolSchema[],
): Promise<ChatMessage> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      stream: false,
      options: { temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama 요청 실패: ${response.status}`);
  const data = (await response.json()) as { message: ChatMessage };
  return data.message;
}
