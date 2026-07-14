// Generic PostgREST pagination helper. Loops .range() in 1000-row chunks
// until a short page is returned, so callers get every row instead of the
// PostgREST default cap of 1000.
//
// Pure utility — no server-only imports, safe from any bundle.

const PAGE = 1000;

export async function fetchAllRows<T>(
  builder: () => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  },
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await builder().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}
