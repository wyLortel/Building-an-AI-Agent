import { calculate } from './calc';
import { chat, type ChatMessage, type ToolSchema } from './ollama-chat';

//도구 툴 설정
//'./calc' 우리가 여기에서 작성함 함수에 맞추어서 툴 스키마를 정의
const calculateSchema: ToolSchema = {
  type: 'function',
  function: {
    name: 'calculate',
    description: "산술 수식을 계산합니다. 예: '17*23'",
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '계산할 수식' },
      },
      required: ['expression'],
    },
  },
};

const messages: ChatMessage[] = [
  { role: 'system', content: '당신은 도구를 쓸 수 있는 한국어 도우미입니다.' },
  { role: 'user', content: '17 곱하기 23은?' },
];

//어떤 도구를 쓰게할건지 알기위해 도구를 넘김
const reply = await chat(messages, [calculateSchema]);

//기록남기기 머리속에 기억넣는거
messages.push(reply);

const call = reply.tool_calls![0];
const result = String(calculate(call.function.arguments.expression as string));
console.log('계산 결과 ', result);

//이걸로 인해 어던 도구를 불럿고 어떤 결과가 나왓는지 저장
messages.push({ role: 'tool', content: result, tool_name: call.function.name });
// console.log(reply.content);
// console.log(JSON.stringify(reply, null, 2));
// reply.tool_calls[0].function.arguments.expression
