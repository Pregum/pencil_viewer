import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, Code, FadeUp, Headline, Kicker, Shot, Sub } from './components';
import { COLOR, FONT } from './theme';

const PAD = 110;

/** 左にコピー、右にスクリーンショットの定型レイアウト。 */
const SplitScene: React.FC<{
  kicker: string;
  headline: React.ReactNode;
  sub: React.ReactNode;
  shot: string;
  zoom?: [number, number];
}> = ({ kicker, headline, sub, shot, zoom }) => (
  <Backdrop>
    <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center' }}>
      <div
        style={{
          width: 700,
          paddingLeft: PAD,
          paddingRight: 44,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
        }}
      >
        <Kicker>{kicker}</Kicker>
        <Headline delay={4} size={50}>
          {headline}
        </Headline>
        <Sub delay={10} size={27}>
          {sub}
        </Sub>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        <Shot src={shot} delay={8} width={1120} zoom={zoom} />
      </div>
    </AbsoluteFill>
  </Backdrop>
);

export const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });

  return (
    <Backdrop>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: PAD, paddingRight: PAD }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            opacity: p,
            transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)`,
          }}
        >
          <span style={{ fontSize: 46 }}>✏️</span>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.01em' }}>Pencil Viewer</span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 22,
              color: COLOR.faint,
              border: `1px solid ${COLOR.line}`,
              borderRadius: 6,
              padding: '3px 10px',
            }}
          >
            MIT
          </span>
        </div>

        <div style={{ height: 44 }} />
        <Headline delay={12} size={108}>
          ワイヤーフレームを、
          <br />
          自分のリポジトリに置く。
        </Headline>
        <div style={{ height: 34 }} />
        <Sub delay={26} size={34}>
          GitHub にある <Code>.pen</Code> を、ブラウザで開いて、編集して、コミットする。
          <br />
          アカウント登録もサーバーも保管料もありません。
        </Sub>
      </AbsoluteFill>
    </Backdrop>
  );
};

export const SceneProblem: React.FC = () => (
  <Backdrop>
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: PAD, paddingRight: PAD }}>
      <Kicker>よくある状態</Kicker>
      <div style={{ height: 34 }} />
      <Headline delay={6} size={72}>
        画面の履歴と、実装の履歴が、
        <br />
        別々の場所にある。
      </Headline>
      <div style={{ height: 40 }} />
      <div style={{ display: 'flex', gap: 28 }}>
        {[
          { label: 'デザイン', place: '外部サービスのクラウド', tone: COLOR.warn },
          { label: 'コード', place: '自分の git リポジトリ', tone: COLOR.git },
        ].map((c, i) => (
          <FadeUp key={c.label} delay={16 + i * 8}>
            <div
              style={{
                width: 480,
                padding: '30px 34px',
                borderRadius: 16,
                backgroundColor: COLOR.panel,
                border: `1px solid ${COLOR.line}`,
                boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
              }}
            >
              <div style={{ fontSize: 24, color: c.tone, fontWeight: 700 }}>{c.label}</div>
              <div style={{ marginTop: 10, fontSize: 30, color: COLOR.ink }}>{c.place}</div>
            </div>
          </FadeUp>
        ))}
      </div>
      <div style={{ height: 36 }} />
      <Sub delay={34} size={30}>
        レビューのたびに URL を貼り直し、「最新はどれ？」を毎回確かめる。
      </Sub>
    </AbsoluteFill>
  </Backdrop>
);

export const SceneLanding: React.FC = () => (
  <SplitScene
    kicker="置き場所"
    headline={
      <>
        <Code>.pen</Code> を、
        <br />
        リポジトリに置く。
      </>
    }
    sub={
      <>
        Pencil.dev の <Code>.pen</Code> をあなたの GitHub リポジトリで管理します。 アプリは GitHub Pages
        の静的ファイル。バックエンドはありません。
      </>
    }
    shot="shots/landing.png"
  />
);

export const SceneConnect: React.FC = () => (
  <SplitScene
    kicker="はじめかた"
    headline={
      <>
        トークンを貼るだけ。
        <br />
        30 秒で繋がる。
      </>
    }
    sub={
      <>
        必要な権限は <Code>Contents: Read &amp; Write</Code> だけ。 トークンはこの端末の{' '}
        <Code>localStorage</Code> にだけ残り、通信は <Code>api.github.com</Code> と直接行われます。
      </>
    }
    shot="shots/github-connect.png"
  />
);

export const SceneRender: React.FC = () => (
  <SplitScene
    kicker="描画"
    headline={
      <>
        フォーマットを
        <br />
        一通り、そのまま。
      </>
    }
    sub={
      <>
        flex レイアウトのフレーム、グラデーション、シャドウ、アイコンフォント、 ドキュメント内の{' '}
        <Code>$token</Code> 変数まで解決します。
      </>
    }
    shot="shots/dashboard.png"
    zoom={[1.0, 1.06]}
  />
);

export const SceneVariables: React.FC = () => (
  <SplitScene
    kicker="デザイントークン"
    headline={
      <>
        <Code>$token</Code> は
        <br />
        書いたまま解決。
      </>
    }
    sub={<>色も角丸も余白も、ハードコードではなく変数参照のまま描画します。</>}
    shot="shots/variables.png"
  />
);

export const SceneEdit: React.FC = () => (
  <SplitScene
    kicker="編集"
    headline={
      <>
        見るだけでなく、
        <br />
        ちゃんと直せる。
      </>
    }
    sub={
      <>
        移動・リサイズ・整列・取り消し。レイヤーパネル、コマンドパレット（
        <Code>Cmd+Shift+P</Code>）、必要なら vim キーバインドも。
      </>
    }
    shot="shots/mobile-app-panels.png"
  />
);

/** コミットが 1 行ずつ積まれていく図。実画面ではなく作図。 */
export const SceneHistory: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const commits = [
    { sha: 'a1c9f2e', msg: 'カート画面に空状態を追加' },
    { sha: '7e02b41', msg: '商品行の余白を 8px に統一' },
    { sha: '3fd6c08', msg: '支払いボタンの文言を修正' },
  ];

  return (
    <Backdrop>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: PAD, paddingRight: PAD }}>
        <Kicker>履歴</Kicker>
        <div style={{ height: 30 }} />
        <Headline delay={6} size={72}>
          保存は、コミット。
        </Headline>
        <div style={{ height: 40 }} />

        <div
          style={{
            width: 1180,
            borderRadius: 16,
            border: `1px solid ${COLOR.line}`,
            backgroundColor: COLOR.panel,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(15,23,42,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 30px',
              borderBottom: `1px solid ${COLOR.line}`,
            }}
          >
            <span style={{ fontFamily: FONT.mono, fontSize: 26 }}>design/checkout.pen</span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 20,
                color: COLOR.muted,
                border: `1px solid ${COLOR.line}`,
                borderRadius: 999,
                padding: '4px 16px',
              }}
            >
              main
            </span>
          </div>
          {commits.map((c, i) => {
            const p = spring({ frame: frame - 18 - i * 14, fps, config: { damping: 200, mass: 0.6 } });
            return (
              <div
                key={c.sha}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26,
                  padding: '24px 30px',
                  borderTop: i === 0 ? 'none' : `1px solid ${COLOR.line}`,
                  opacity: p,
                  transform: `translateX(${interpolate(p, [0, 1], [-24, 0])}px)`,
                }}
              >
                <span
                  style={{ fontFamily: FONT.mono, fontSize: 24, color: i === 0 ? COLOR.git : COLOR.faint }}
                >
                  {c.sha}
                </span>
                <span style={{ fontSize: 28 }}>{c.msg}</span>
              </div>
            );
          })}
        </div>

        <div style={{ height: 36 }} />
        <Sub delay={62} size={30}>
          過去の版を開いて中身を見て、そのまま復元。差分はふだんの git の履歴に並びます。
        </Sub>
      </AbsoluteFill>
    </Backdrop>
  );
};

export const SceneExtras: React.FC = () => {
  const items = [
    { title: 'MCP ブリッジ', desc: 'Claude Code からノードを読み書き' },
    { title: 'AI デザインレビュー', desc: '5 つの UI 状態と a11y を自動チェック' },
    { title: 'P2P 共同編集', desc: 'WebRTC + Yjs、サーバーに残らない' },
    { title: 'URL 共有 / CI', desc: '共有リンクと .pen 検証 Action' },
  ];

  return (
    <Backdrop>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: PAD, paddingRight: PAD }}>
        <Kicker>任意で足せるもの</Kicker>
        <div style={{ height: 30 }} />
        <Headline delay={6} size={66}>
          エンジニア側から触れる口も用意してある。
        </Headline>
        <div style={{ height: 46 }} />
        <div style={{ display: 'flex', gap: 24 }}>
          {items.map((it, i) => (
            <FadeUp key={it.title} delay={16 + i * 7}>
              <div
                style={{
                  width: 400,
                  height: 220,
                  padding: '32px 30px',
                  borderRadius: 16,
                  backgroundColor: COLOR.panel,
                  border: `1px solid ${COLOR.line}`,
                  boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 700 }}>{it.title}</div>
                <div style={{ marginTop: 16, fontSize: 25, lineHeight: 1.6, color: COLOR.muted }}>
                  {it.desc}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
        <div style={{ height: 38 }} />
        <Sub delay={48} size={28}>
          いずれも既定では無効。必要なときだけ環境変数で有効にします。
        </Sub>
      </AbsoluteFill>
    </Backdrop>
  );
};

export const SceneCost: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.9 } });

  return (
    <Backdrop>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            fontSize: 250,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: COLOR.accent,
            opacity: p,
            transform: `scale(${interpolate(p, [0, 1], [0.86, 1])})`,
          }}
        >
          $0
        </div>
        <div style={{ height: 10 }} />
        <Headline delay={18} size={54}>
          保管するものが無いので、増える請求も無い。
        </Headline>
        <div style={{ height: 40 }} />
        <div style={{ display: 'flex', gap: 20 }}>
          {['MIT ライセンス', 'アカウント登録なし', '処理はすべてブラウザ内'].map((t, i) => (
            <FadeUp key={t} delay={28 + i * 6}>
              <div
                style={{
                  padding: '16px 30px',
                  borderRadius: 999,
                  border: `1px solid ${COLOR.line}`,
                  backgroundColor: COLOR.panel,
                  fontSize: 28,
                }}
              >
                <span style={{ color: COLOR.git, marginRight: 12 }}>■</span>
                {t}
              </div>
            </FadeUp>
          ))}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

export const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  return (
    <Backdrop>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fadeOut }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 56 }}>✏️</span>
          <span style={{ fontSize: 66, fontWeight: 700 }}>Pencil Viewer</span>
        </div>
        <div style={{ height: 28 }} />
        <Sub delay={8} size={34}>
          サインインせずに、サンプルを開くところからどうぞ。
        </Sub>
        <div style={{ height: 52 }} />
        <FadeUp delay={16}>
          <div
            style={{
              padding: '24px 52px',
              borderRadius: 14,
              backgroundColor: COLOR.ink,
              color: '#fff',
              fontFamily: FONT.mono,
              fontSize: 36,
            }}
          >
            pregum.github.io/pencil_viewer
          </div>
        </FadeUp>
        <div style={{ height: 26 }} />
        <FadeUp delay={24}>
          <div style={{ fontFamily: FONT.mono, fontSize: 28, color: COLOR.muted }}>
            github.com/Pregum/pencil_viewer
          </div>
        </FadeUp>
      </AbsoluteFill>
    </Backdrop>
  );
};
