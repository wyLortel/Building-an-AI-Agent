//만들어 놓은 계산기 가져오기
import { calculate } from './calc';
//올리마 챗에 3가지를 가져옴
import { chat, type ChatMessage, type ToolSchema } from './ollama-chat';

//도구 툴 설정
//'./calc' 우리가 여기에서 작성함 함수에 맞추어서 툴 스키마를 정의
//calculateSchema는 계산기 자체가 아님 ai에게 보여주는 계산기 사용 설명서
// calculate
// → 실제로 계산함

// calculateSchema
// → AI에게 calculate가 뭔지 설명함

const calculateSchema: ToolSchema = {
  //도구의 형태 (함수)
  type: 'function',
  //안에 이 함수 이름은 뭐고 무슨일을 하고 무엇을 받아야하는지
  function: {
    //이름은
    name: 'calculate',
    //언제 이 도구를 사용해야하는지 설명해주는 부분
    description: "산술 수식을 계산합니다. 예: '17*23'",
    //이 도구를 사용할때 어떤값을 넣어야하는지에 대한것
    parameters: {
      //타입 배열
      type: 'object',
      //{ expression: "17*23"} 이런식으로 넣어 달라는것
      properties: {
        expression: { type: 'string', description: '계산할 수식' },
      },
      //expression은 무조건 있어야한다는 뜻
      required: ['expression'],
    },
  },
};

//ai와 나눈 대화 전체 기록
const messages: ChatMessage[] = [
  //시스템은 ai에게 주는 최상위 지시 사항 (보통 사용자는 이걸 안봄) 너는 한국어로 대답해.이런걸 넣나봄
  { role: 'system', content: '당신은 도구를 쓸 수 있는 한국어 도우미입니다.' },
  //이건뭐 유저가 ai에게 하는 질문
  { role: 'user', content: '17 곱하기 23은?' },
];

//어떤 도구를 쓰게할건지 알기위해 도구를 넘김
//왜 배열로 넘기지 ?? 도구가 나중에는 여러개일수 있기 떄문
const reply = await chat(messages, [calculateSchema]);

//기록남기기 머리속에 기억넣는거
//ai의 방금 응답을 대화 기록에 추가함
messages.push(reply);

//call은
// {
//     function: {
//         name: "calculate",
//         arguments: {
//             expression: "17*23"
//         }
//     }
//이걸 가져옴 !이건 분명   undefined 아닐 거야 없으면 위험한데 하지만 개발자가 ㄱㅊ다 하는거
const call = reply.tool_calls![0];
//도구 실행
//as string 문자열이라고 생각해
const result = String(calculate(call.function.arguments.expression as string));
console.log('계산 결과 ', result);

//이걸로 인해 어던 도구를 불럿고 어떤 결과가 나왓는지 저장
//"네가 요청한 calculate 도구의 실행 결과는 391이다." 이걸 저장함
messages.push({ role: 'tool', content: result, tool_name: call.function.name });
// console.log(reply.content);
// console.log(JSON.stringify(reply, null, 2));
// reply.tool_calls[0].function.arguments.expression

const final = await chat(messages, [calculateSchema]);
console.log(final);

// ┌─────────────────────┐
// │      사용자          │
// │ "17 × 23은?"        │
// └──────────┬──────────┘
//            ↓

// ┌─────────────────────┐
// │        LLM           │
// │                     │
// │ "계산기가 필요해!"   │
// └──────────┬──────────┘
//            │
//            │ tool_call
//            ↓

// {
//   name: "calculate",
//   expression: "17*23"
// }

//            ↓

// ┌─────────────────────┐
// │   우리 TypeScript    │
// │                     │
// │ calculate("17*23")  │
// └──────────┬──────────┘
//            ↓
//           391
//            ↓

// ┌─────────────────────┐
// │ messages에 저장      │
// │                     │
// │ role: "tool"        │
// │ content: "391"      │
// └──────────┬──────────┘
//            ↓

// ┌─────────────────────┐
// │       LLM 다시 호출   │
// │                     │
// │ "결과가 391이군!"    │
// └──────────┬──────────┘
//            ↓

// ┌─────────────────────┐
// │ 사용자에게 최종답변   │
// │                     │
// │ "17 × 23 = 391입니다"│
// └─────────────────────┘
