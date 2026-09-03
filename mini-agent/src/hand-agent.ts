//모델에게 도구 사용법을 알려주고 판단시키기

// 사용자
//  ↓
// "price.txt 읽고 ×3 해줘"

// AI
//  ↓
// "먼저 파일을 읽어야겠다."
//  ↓
// read_file 호출 요청

// 우리 프로그램
//  ↓
// 파일 읽음
//  ↓
// "100"

// AI에게 다시 전달
//  ↓

// AI
//  ↓
// "100을 3배 해야겠네."
//  ↓
// calculate 호출 요청

// 우리 프로그램
//  ↓
// calculate("100*3")
//  ↓
// "300"

// AI에게 다시 전달
//  ↓

// AI
//  ↓
// "결과는 300입니다."

// 끝

import {
  chat,
  type ChatMessage,
  type ToolCall,
  type ToolSchema,
} from './ollama-chat.js';
import { calculate } from './calc.js';
//컴퓨터 파일을 읽고 쓰는 기능
import { promises as fs } from 'node:fs';
//이건 파일 경로를 안전하게 다루는 도구.
//운영체제마다 경로 표현이 조금 다를 수 있기 때문에 직접 문자열을 막 이어붙이기보다 path를 쓰는 게 좋음.
import path from 'node:path';

//process.cwd() 지금 실행한 폴더의 절대 경로(루트)를 알려줘
///Users/uyeong/mini-agent/workspace
//AI가 읽을 수 있는 파일 영역을 workspace 폴더로 정한 것.
const WORKSPACE = path.resolve(process.cwd(), 'workspace');

// Tool
// │
// ├── schema
// │    → AI에게 보여주는 설명서
// │
// └── run
//      → 실제 실행하는 함수  툴타입은 이걸 하나로 묶어 버린것
type Tool = {
  schema: ToolSchema;
  //args: any 입력값 하나를 받고 반환값이 둘중하나
  //Promise<string> 파일읽기는 시간이 걸리고
  //string 계산기는 즉시 끝나니  둘다 받을수있게
  run: (args: any) => Promise<string> | string;
};

//Record<string, Tool> 문자열 이름을 넣으면 Tool 하나가 나오는 객체
// calculate" -> 계산기 Tool , "current_time" -> 현재시간 Tool
//여기 변수안에 몇가지 툴의 사용 설명서가 들어 있음
//그리고 이러면 tools[이름]하면 바로 도구를 찾을수있음
//tools['calculate'] 하면
//{schema: ... run: ...} 가 나옴
//Record<키의 타입, 값의 타입>
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
    //진짜 실행 함수
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
  //유저 메시지 (사용자 질문)
  userInput: string,
  //에이전트가 최대 몇번 생각하고 행동할수 있는지 제한 무한루프 방지 계속 도구 사용할수있음
  maxSteps = 6,
): Promise<string> {
  const messages: ChatMessage[] = [
    //ai의 행동 규칙 시스템룰이니
    {
      role: 'system',
      content:
        '당신은 도구를 쓸 수 있는 한국어 업무 助手입니다. 필요하면 도구를 호출하고, 충분하면 최종 답을 한국어로 말하세요.',
    },
    //유저 인풋넣기
    { role: 'user', content: userInput },
  ];
  //툴 스키마 목록 만들기 Object.values(tools).map((t) => t.schema);
  //키는 버리고 값만 가져오고 스키마만 꺼냄
  //   [
  //   calculateSchema,
  //   currentTimeSchema,
  //   readFileSchema
  // ] 왜냐면run함수까지 보여줄 필요없음 ai가필요한건 무슨 도구고 언제쓰고 무슨값을 넣어야하는지에 대한것
  // AI에게 → schema만     우리 프로그램 → schema + run
  const toolSchemas = Object.values(tools).map((t) => t.schema);

  //최대 6번 반복 왜 반복하냐 한번의 툴 호출로는 안끝날수잇음
  // 사용자 요청 파일 읽고 그 값 계산해줘 이면
  //1단계 파일 읽고 2단계 계산기로 계산하고 3단계 최종답변해야함
  for (let step = 0; step < maxSteps; step++) {
    //지금까지 모든 기록이랑 사용가능한 도구 설명서 ai에게 전달
    const message = await chat(messages, toolSchemas);
    //ai가 방금한 판단을 기록
    messages.push(message);

    const calls: ToolCall[] = message.tool_calls ?? [];
    //툴 호출이 없으면 종료 즉 ai가 더이상 툴을 요청하지않음
    if (calls.length === 0) return message.content;

    //AI가 한 번에 Tool을 여러 개 요청할 수도 있으니까 각각 실행함.
    //current_time calculate 이렇게 두개를 요청할수도 있음 그럼 각각 처리
    for (const call of calls) {
      //이러면 "calculate"를 보내면   tools['calculate']이렇게 투을 찾음
      const tool = tools[call.function.name];
      //나중에 툴 실행 결과를 담을 변수
      let result: string;
      try {
        result = tool //삼향 연산자
          ? await tool.run(call.function.arguments) // 툴이 있다면 실제함수 실행
          : `알 수 없는 도구: ${call.function.name}`; //없다면 알수없는 도구라말함
      } catch (error: unknown) {
        //실행중 오류가 나면 여기로 에러 발생
        result = `도구 오류: ${error instanceof Error ? error.message : String(error)}`;
      }
      //개발자가 보는 로그
      console.log(
        `  [step ${step + 1}] ${call.function.name}(${JSON.stringify(call.function.arguments)}) -> ${result}`,
      );
      //툴 결과를 메세지에 추가
      messages.push({
        role: 'tool',
        content: result,
        tool_name: call.function.name,
      });
    }
  }

  return '최대 스텝에 도달했습니다.';
}

const input =
  process.argv.slice(2).join(' ') ||
  '17 곱하기 23은? 아 그리고 워크스페이스 안에 노트스엠디 파일 뭐더라 그리고 현재 시각은 ?';
console.log(await runHandAgent(input));

//함수 호출이라는것은 결국 우리가 이렇게 구조화된 출려과 파싱 그리고 루프를 통해서 구현된다
//이게 현실적으로 에이전트가 돌아가는 방식
//모델은 자체적으로 자기 스스로 마법처럼 도구를 쓰는게 아니다 어떤 도구를 어떤값으로 부르냐
//이걸 정해진 구조로 실행하면서 훈련시키는것 이게 툴 코스
// 이구조화된 걸 읽어서 함수 실행 결과를 다시 모델에게 넣어주고
//모델이 이 과정에서 도구를 다 쓸때가지 반복 이게 에이전트의 내부
//하지만 지금 방법은 기능이 복잡해지면 반복작업으로 휴먼에러 발생
//특히나 도구의 입력값을 타입으로 안전하게 다르는 기능 그래서 프레임워크가 있음
