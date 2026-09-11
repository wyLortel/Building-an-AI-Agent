import { generateText, stepCountIs, streamText } from 'ai';
import { model } from './provider.js';
import { tool } from 'ai';
import { z } from 'zod';
import { calculate } from './tools/calc.js';
import { readFile, writeFile, listFiles, searchFiles } from './tools/files.js';

export const SYSTEM_PROMPT =
  '당신은 도구를 쓸 수 있는 한국어 업무 助手입니다. 필요할 때만 도구를 호출하고, 충분한 정보를 얻으면 한국어로 간결하게 답하세요.';

export const tools = {
  calculate: tool({
    description: "산술 수식을 계산합니다. 예: '17*23'", // 구체적으로 작성!!
    inputSchema: z.object({ expression: z.string().describe('계산할 수식') }), // 정확하게 선언, z.string().url()
    execute: async ({ expression }) => String(calculate(expression)),
  }),
  read_file: tool({
    description: 'workspace 안의 파일을 읽습니다.',
    inputSchema: z.object({
      file: z.string().describe('읽을 파일의 상대 경로'),
    }),
    execute: async ({ file }) => readFile(file),
  }),
  write_file: tool({
    description: 'workspace 안에 파일을 만들거나 덮어씁니다.',
    inputSchema: z.object({
      file: z.string().describe('쓸 파일의 상대 경로'),
      content: z.string().describe('파일에 넣을 내용'),
    }),
    execute: async ({ file, content }) => writeFile(file, content),
  }),
  list_files: tool({
    description: 'workspace의 파일 목록을 봅니다.',
    inputSchema: z.object({
      dir: z.string().default('.').describe('조회할 폴더 경로. 기본값은 루트'),
    }),
    execute: async ({ dir }) => (await listFiles(dir)).join('\n'),
  }),
  search_files: tool({
    description: 'workspace 파일 내용에서 키워드를 찾습니다.',
    inputSchema: z.object({ query: z.string().describe('검색할 키워드') }),
    execute: async ({ query }) => {
      const xs = await searchFiles(query);
      return xs.length ? xs.join('\n') : '없음';
    },
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

const input = process.argv.slice(2).join(' ') || '17 곱하기 23은?';
await runAgent(input).then((t) => console.log(t));

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
