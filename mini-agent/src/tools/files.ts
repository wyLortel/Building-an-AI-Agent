//파일 시스템 (읽기 쓰기 삭제 폴거만들기 가능)
import { promises as fs } from 'node:fs';
import path from 'node:path';

//현재 이게 실행하고 잇는 폴더 의 워크스페이스 주소를 변수에 담음
const WORKSPACE = path.resolve(process.cwd(), 'workspace');
// Users/me/agenet-demo -> WORKSPACE == Users/me/agenet-demo/workspace

//사용자가 입력한 경로가 정말 워크 스페이스에 있는지 검사하고 실제 전체 경로로 바꾸어줌
//relative path, 즉 상대 경로
function resolveInWorkspace(rel: string): string {
  const abs = path.resolve(WORKSPACE, rel);
  // path.sep == /
  // /home/me/workspace -> /home/me/workspace-evil
  if (abs !== WORKSPACE && !abs.startsWith(WORKSPACE + path.sep)) {
    throw new Error('워크스페이스 밖 경로는 허용되지 않습니다');
  }
  return abs;
}

export async function readFile(file: string): Promise<string> {
  return fs.readFile(resolveInWorkspace(file), 'utf-8');
}

export async function writeFile(
  file: string,
  content: string,
): Promise<string> {
  const abs = resolveInWorkspace(file);
  await fs.mkdir(path.dirname(abs), { recursive: true }); // reports/2026/summary.md
  await fs.writeFile(abs, content, 'utf-8');
  return `${file} 저장됨 (${content.length}자)`;
}

export async function listFiles(dir = '.'): Promise<string[]> {
  const entries = await fs.readdir(resolveInWorkspace(dir), {
    withFileTypes: true,
  });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

export async function searchFiles(query: string): Promise<string[]> {
  const hits: string[] = [];
  async function walk(rel: string): Promise<void> {
    for (const e of await fs.readdir(resolveInWorkspace(rel), {
      withFileTypes: true,
    })) {
      const childRel = path.join(rel, e.name);
      if (e.isDirectory()) await walk(childRel);
      else if (
        (await fs.readFile(resolveInWorkspace(childRel), 'utf-8')).includes(
          query,
        )
      )
        hits.push(childRel);
    }
  }
  await walk('.');
  return hits;
}
