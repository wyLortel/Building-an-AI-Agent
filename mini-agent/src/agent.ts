import { generateText, stepCountIs, streamText } from 'ai';
import { model } from './provider.js';
import { tool } from 'ai';
import { z } from 'zod';
import { calculate } from './calc.js';

// const result = await generateText({
//     model,
//     temperature: 0,
//     prompt: "안녕하세요. 오늘 날씨가 좋네요.",
// });

// const calculateTool = tool({
//     description: "산술 수식을 계산합니다. 예: '17*23'",
//     inputSchema: z.object({ expression: z.string().describe("계산할 수식") }),
//     execute: async ({ expression }) => String(calculate(expression)),
// });

export const SYSTEM_PROMPT =
  '당신은 도구를 쓸 수 있는 한국어 업무 助手입니다. 필요할 때만 도구를 호출하고, 충분한 정보를 얻으면 한국어로 간결하게 답하세요.';

//description: "산술 수식을 계산합니다. 예: '17*23'",
//inputSchema: z.object({ expression: z.string().describe('계산할 수식') }),
//이 두가지가 결국 모델에게 전달되고 모델은 이 두가지의 정보만 보면서 아 내가 이런 상황에서 이런걸 써야하는구나
//인지
//이런 툴 구조 설계나 도구를 잘 만드는건 단순하게 코드를 잘 짜는게 아니라는것
//사실상 모델에 관점을 잘 이해하고 디스크립션과 인풋 스키마를 잘 설계하는게 중요
//그래서 중요한 4가지 원칙
//1 디스크립션은 반드시 구체적으로 써야한다 모호한 말이 아닌  무엇을 어디서 어던 결과를 내는지 명시해줘야한다
//도구가 비슷한게 여러개 있을때는 중복성을 유니크함을 지켜주기 위해서 특히 중요하다
//inputSchema 얘는 정확하게 선언해줘야한다 모델이 넘겨줄값의 타입 형시 의미를 명확하게 해야한다
//그리고 필드마다 디스크라이브를 붙여줌으로서 이 인자는 어던 의미라고 알려줘야하는것이다
//예를들어 url을 받는 도구나 ? z.string().url 이라고 하면 모델이 잘못된 형식을 넘겨주는 경우를 줄일수있다
//세번쨰는 결과는 간결하게 반환해야한다 이 결과값은 컨텍스트가 된다 이컨텍스트가 길면 토큰이 쌓이고
//처리는 느려지는거다 모델이 필요로 하는 핵심 정보만 담아서 돌려주는 원칙을 지켜줘야한다
//에러는 명확하게 처리할것 잘못된 경로나 0으로 나눈다거나 실패하면 이런 에러를 어떻게 다르느냐가 에이전트
//의 안정성을 좌우해 준다 이 4가지 명칙을 꼭 명심
export const tools = {
  calculate: tool({
    description: "산술 수식을 계산합니다. 예: '17*23'",
    inputSchema: z.object({ expression: z.string().describe('계산할 수식') }),
    execute: async ({ expression }) => String(calculate(expression)),
  }),
  // current_time: tool({
  //   description: '현재 시각을 ISO 문자열로 반환합니다.',
  //   inputSchema: z.object({}),
  //   execute: async () => new Date().toISOString(),
  // }),
};

export async function runAgent(
  userInput: string,
  maxSteps = 6,
): Promise<string> {
  const result = await generateText({
    model,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(maxSteps),
    prompt: userInput,
  });

  for (const [i, step] of result.steps.entries())
    for (const call of step.toolCalls ?? [])
      console.log(
        `  [step ${i + 1}] ${call.toolName}(${JSON.stringify(call.input)})`,
      );

  return result.text;
}

// const input = process.argv.slice(2).join(" ") || "17 곱하기 23은?";
// await runAgent(input).then((t) => console.log(t));

export async function streamAgent(userInput: string): Promise<void> {
  const result = streamText({
    model,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(6),
    prompt: userInput,
  });
  for await (const delta of result.textStream) process.stdout.write(delta);
  process.stdout.write('\n');
}

const input = process.argv.slice(2).join(' ') || '17 곱하기 23은?';
await streamAgent(input);

// const result = await generateText({
//     model,
//     temperature: 0,
//     system: "당신은 도구를 쓸 수 있는 한국어 업무 助手입니다. 필요할 때만 도구를 호출하고, 충분한 정보를 얻으면 한국어로 간결하게 답하세요.",
//     prompt: "2 더하기 2는 뭐예요?",
// });

// console.log(result.text);

//그냥 스트림은 ui가 흘러나오는 경험을 주고싶을떄만 사용
//질문애 따라서 모델이 순차적으로 도구를 불러쓸수도 있고
//병렬로 불를수도 있음
//멀티스텝 도구를 병렬적으로 가져올수도 있음
