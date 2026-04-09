export async function fetchPenText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // 多くは CORS エラー。fetch の失敗は TypeError になるので文面で区別可能
    throw new Error(`${url} の取得に失敗しました: ${message}(CORS 制限の可能性があります)`);
  }
  if (!res.ok) {
    throw new Error(`${url}: HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}
