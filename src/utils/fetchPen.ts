/**
 * 許可するスキームを制限し、SSRF / javascript: URI を防止する。
 */
function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`無効な URL です: ${url}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      `${parsed.protocol} スキームは許可されていません。https: または http: のみ使用できます`,
    );
  }
  return parsed;
}

export async function fetchPenText(url: string): Promise<string> {
  validateUrl(url);

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
