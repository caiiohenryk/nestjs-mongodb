import { type Cursor, encodeCursor } from './cursor.js';
import type { PageResponse } from './page.response.js';

export type PageSource<TRecord, TResponse> = {
  readonly records: readonly TRecord[];
  readonly limit: number;
  readonly toResponse: (record: TRecord) => TResponse;
  readonly cursorOf: (record: TRecord) => Cursor;
};

export function buildPage<TRecord, TResponse>(source: PageSource<TRecord, TResponse>): PageResponse<TResponse> {
  const page = source.records.slice(0, source.limit);
  const last = page.at(-1);
  const hasMore = source.records.length > source.limit && last !== undefined;
  return {
    data: page.map(source.toResponse),
    nextCursor: hasMore ? encodeCursor(source.cursorOf(last)) : null,
  };
}
