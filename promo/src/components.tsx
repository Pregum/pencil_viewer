import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLOR, FONT } from './theme';

/** ランディングと同じ「方眼紙」の地。 */
export const Backdrop: React.FC<{ children: React.ReactNode; tint?: string }> = ({ children, tint }) => (
  <AbsoluteFill
    style={{
      backgroundColor: tint ?? COLOR.bg,
      backgroundImage:
        'linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px)',
      backgroundSize: '64px 64px',
      fontFamily: FONT.sans,
      color: COLOR.ink,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** delay フレーム後に、下からすっと現れる。 */
export const FadeUp: React.FC<{
  delay?: number;
  distance?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, distance = 28, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** スクリーンショットをブラウザ風の枠に入れて、ゆっくり寄る。 */
export const Shot: React.FC<{
  src: string;
  delay?: number;
  /** 1 に近いほど寄る。既定はほぼ等倍からわずかに寄る。 */
  zoom?: [number, number];
  width?: number;
}> = ({ src, delay = 0, zoom = [1.0, 1.05], width = 1340 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.8 } });
  const scale = interpolate(frame, [0, durationInFrames], zoom, { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px) scale(${scale})`,
        width,
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${COLOR.line}`,
        boxShadow: '0 32px 80px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.06)',
        backgroundColor: COLOR.panel,
      }}
    >
      <div
        style={{
          height: 34,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px',
          borderBottom: `1px solid ${COLOR.line}`,
          backgroundColor: '#F8FAFC',
        }}
      >
        {['#F87171', '#FBBF24', '#34D399'].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: c }} />
        ))}
        <span
          style={{
            marginLeft: 14,
            fontFamily: FONT.mono,
            fontSize: 13,
            color: COLOR.faint,
          }}
        >
          pregum.github.io/pencil_viewer
        </span>
      </div>
      <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
    </div>
  );
};

/** 画面左上に置く小見出し。「いま何の話か」を常に出しておく。 */
export const Kicker: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
  <FadeUp delay={delay} distance={14}>
    <div
      style={{
        display: 'inline-block',
        padding: '8px 18px',
        borderRadius: 999,
        backgroundColor: COLOR.accentSoft,
        color: COLOR.accent,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </div>
  </FadeUp>
);

export const Headline: React.FC<{ children: React.ReactNode; delay?: number; size?: number }> = ({
  children,
  delay = 0,
  size = 68,
}) => (
  <FadeUp delay={delay}>
    <h2
      style={{
        margin: 0,
        fontSize: size,
        lineHeight: 1.25,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        // 「ちゃ」のような拗音が行頭に落ちないよう、日本語の禁則を厳密に効かせる
        lineBreak: 'strict',
        wordBreak: 'normal',
        overflowWrap: 'normal',
      }}
    >
      {children}
    </h2>
  </FadeUp>
);

export const Sub: React.FC<{ children: React.ReactNode; delay?: number; size?: number }> = ({
  children,
  delay = 0,
  size = 30,
}) => (
  <FadeUp delay={delay} distance={18}>
    <p
      style={{
        margin: 0,
        fontSize: size,
        lineHeight: 1.7,
        color: COLOR.muted,
        fontWeight: 400,
        lineBreak: 'strict',
        wordBreak: 'normal',
        overflowWrap: 'normal',
      }}
    >
      {children}
    </p>
  </FadeUp>
);

/** 等幅で書きたい語（.pen、$token、コマンドなど）。 */
export const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontFamily: FONT.mono,
      fontSize: '0.92em',
      padding: '0.04em 0.3em',
      borderRadius: 6,
      backgroundColor: 'rgba(15,23,42,0.06)',
    }}
  >
    {children}
  </span>
);
