export async function fetchFearGreedIndex() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: Array<{ value?: string; value_classification?: string; timestamp?: string }>;
    };
    const row = json.data?.[0];
    if (!row) return null;

    return {
      value: Number(row.value),
      classification: row.value_classification,
      timestamp: row.timestamp,
      source: "alternative.me",
    };
  } catch {
    return null;
  }
}
