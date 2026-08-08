import { Injectable } from '@nestjs/common';
import { ExecuteService } from '../execute/execute.service';

export interface TestCaseInput {
  stdin: string;
  expected: string;
  points: number;
  hidden: boolean;
  order: number;
}

export interface CaseResult {
  order: number;
  hidden: boolean;
  passed: boolean;
  points: number;
  timedOut: boolean;
  expected?: string;
  actual?: string;
  stderr?: string;
}

export interface GradeResult {
  passed: number;
  total: number;
  score: number;
  maxScore: number;
  results: CaseResult[];
}

function normalize(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '')
    .trimEnd();
}

@Injectable()
export class GradingService {
  constructor(private readonly execute: ExecuteService) {}

  async grade(
    code: string,
    testCases: TestCaseInput[],
    language = 'python',
  ): Promise<GradeResult> {
    const ordered = [...testCases].sort((a, b) => a.order - b.order);
    const results: CaseResult[] = [];
    let passed = 0;
    let score = 0;
    let maxScore = 0;

    for (const tc of ordered) {
      maxScore += tc.points;
      const out = await this.execute.run(language, code, tc.stdin);
      const actual = normalize(out.stdout);
      const ok =
        !out.timedOut && out.exitCode === 0 && actual === normalize(tc.expected);
      if (ok) {
        passed += 1;
        score += tc.points;
      }
      const r: CaseResult = {
        order: tc.order,
        hidden: tc.hidden,
        passed: ok,
        points: tc.points,
        timedOut: out.timedOut,
      };
      if (!tc.hidden) {
        r.expected = normalize(tc.expected);
        r.actual = actual;
        r.stderr = out.stderr;
      }
      results.push(r);
    }

    return { passed, total: ordered.length, score, maxScore, results };
  }
}
