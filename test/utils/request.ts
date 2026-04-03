import type { NextApiHandler } from '@fastgpt/service/common/middle/entry';
import type { MockReqType } from '../mocks/request';
import { vi } from 'vitest';

export async function Call<B = any, Q = any, R = any>(
  handler: NextApiHandler<R>,
  props?: MockReqType<B, Q>
) {
  const { body = {}, query = {}, ...rest } = props || {};
  let raw;
  const headers = new Map<string, any>();
  const res: any = {
    setHeader: vi.fn((key: string, value: any) => {
      headers.set(key, value);
    }),
    getHeader: vi.fn((key: string) => headers.get(key)),
    write: vi.fn((data: any) => {
      raw = data;
    }),
    end: vi.fn()
  };
  const response = (await handler(
    {
      body: JSON.parse(JSON.stringify(body)),
      query: JSON.parse(JSON.stringify(query)),
      ...(rest as any)
    },
    res
  )) as any;
  return {
    ...response,
    raw,
    headers: Object.fromEntries(headers.entries())
  } as {
    code: number;
    data: R;
    error?: any;
    raw?: any;
    headers?: Record<string, any>;
  };
}
