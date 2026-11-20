export class PageResponse<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}
