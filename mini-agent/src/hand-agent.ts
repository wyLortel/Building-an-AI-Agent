import {
  chat,
  type ChatMessage,
  type ToolCall,
  type ToolSchema,
} from './ollama-chat.js';
import { calculate } from './calc.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const WORKSPACE = path.resolve(process.cwd(), 'workspace');

type Tool = {
  schema: ToolSchema;
  run: (args: any) => Promise<string> | string;
};

const tools: Record<string, Tool> = {
  calculate: {
    schema: {
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
    },
    run: ({ expression }) => String(calculate(String(expression))),
  },
  current_time: {
    schema: {
      type: 'function',
      function: {
        name: 'current_time',
        description: '현재 시각을 ISO 문자열로 반환합니다.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    run: () => new Date().toISOString(),
  },
  read_file: {
    schema: {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'workspace 폴더 안의 파일 내용을 읽습니다.',
        parameters: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'workspace 기준 상대 경로' },
          },
          required: ['file'],
        },
      },
    },
    run: async ({ file }) =>
      fs.readFile(path.join(WORKSPACE, String(file)), 'utf-8'),
  },
};

export async function runHandAgent(
  userInput: string,
  maxSteps = 6,
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '당신은 도구를 쓸 수 있는 한국어 업무 助手입니다. 필요하면 도구를 호출하고, 충분하면 최종 답을 한국어로 말하세요.',
    },
    { role: 'user', content: userInput },
  ];
  const toolSchemas = Object.values(tools).map((t) => t.schema);

  for (let step = 0; step < maxSteps; step++) {
    const message = await chat(messages, toolSchemas);
    messages.push(message);

    const calls: ToolCall[] = message.tool_calls ?? [];
    if (calls.length === 0) return message.content;

    for (const call of calls) {
      const tool = tools[call.function.name];
      let result: string;
      try {
        result = tool
          ? await tool.run(call.function.arguments)
          : `알 수 없는 도구: ${call.function.name}`;
      } catch (error: unknown) {
        result = `도구 오류: ${error instanceof Error ? error.message : String(error)}`;
      }
      console.log(
        `  [step ${step + 1}] ${call.function.name}(${JSON.stringify(call.function.arguments)}) -> ${result}`,
      );
      messages.push({
        role: 'tool',
        content: result,
        tool_name: call.function.name,
      });
    }
  }

  return '최대 스텝에 도달했습니다.';
}

const input = process.argv.slice(2).join(' ') || '17 곱하기 23은?';
console.log(await runHandAgent(input));

//함수 호출이라는것은 결국 우리가 이렇게 구조화된 출려과 파싱 그리고 루프를 통해서 구현된다
//이게 현실적으로 에이전트가 돌아가는 방식
//모델은 자체적으로 자기 스스로 마법처럼 도구를 쓰는게 아니다 어떤 도구를 어떤값으로 부르냐
//이걸 정해진 구조로 실행하면서 훈련시키는것 이게 툴 코스
// 이구조화된 걸 읽어서 함수 실행 결과를 다시 모델에게 넣어주고
//모델이 이 과정에서 도구를 다 쓸때가지 반복 이게 에이전트의 내부
