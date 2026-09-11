import { promises as fs } from 'node:fs';
import path from 'node:path';

//워크스페이스 안에서만 읽을수잇게만듬
const WORKSPACE = path.resolve(process.cwd(), 'workspace');
// Users/me/agenet-demo -> WORKSPACE == Users/me/agenet-demo/workspace

function resolveInWorkspace(rel: string): string {
  const abs = path.resolve(WORKSPACE, rel);
  // path.sep == /
  // /home/me/workspace -> /home/me/workspace-evil
  if (abs !== WORKSPACE && !abs.startsWith(WORKSPACE + path.sep)) {
    throw new Error('워크스페이스 밖 경로는 허용되지 않습니다');
  }
  return abs;
}
