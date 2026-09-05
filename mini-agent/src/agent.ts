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

export const tools = {
  calculate: tool({
    description: "산술 수식을 계산합니다. 예: '17*23'",
    inputSchema: z.object({ expression: z.string().describe('계산할 수식') }),
    execute: async ({ expression }) => String(calculate(expression)),
  }),
  current_time: tool({
    description: '현재 시각을 ISO 문자열로 반환합니다.',
    inputSchema: z.object({}),
    execute: async () => new Date().toISOString(),
  }),
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
