import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import {
  SceneConnect,
  SceneCost,
  SceneCta,
  SceneEdit,
  SceneExtras,
  SceneHistory,
  SceneLanding,
  SceneProblem,
  SceneRender,
  SceneTitle,
  SceneVariables,
} from './scenes';
import { COLOR } from './theme';

/** シーンの長さ（フレーム / 30fps）。合計が Composition の durationInFrames と一致する。 */
export const INTRO_SCENES = [
  { Comp: SceneTitle, frames: 135 },
  { Comp: SceneProblem, frames: 130 },
  { Comp: SceneLanding, frames: 130 },
  { Comp: SceneConnect, frames: 130 },
  { Comp: SceneRender, frames: 125 },
  { Comp: SceneVariables, frames: 110 },
  { Comp: SceneEdit, frames: 125 },
  { Comp: SceneHistory, frames: 140 },
  { Comp: SceneExtras, frames: 130 },
  { Comp: SceneCost, frames: 120 },
  { Comp: SceneCta, frames: 155 },
] as const;

export const INTRO_DURATION = INTRO_SCENES.reduce((n, s) => n + s.frames, 0);

export const Intro: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLOR.bg }}>
    <Series>
      {INTRO_SCENES.map(({ Comp, frames }, i) => (
        <Series.Sequence key={i} durationInFrames={frames}>
          <Comp />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);

/** はてなブログに直接貼れるよう、GIF 用に短くしたもの。 */
export const INTRO_SHORT_SCENES = [
  { Comp: SceneTitle, frames: 105 },
  { Comp: SceneLanding, frames: 95 },
  { Comp: SceneHistory, frames: 110 },
  { Comp: SceneCta, frames: 110 },
] as const;

export const INTRO_SHORT_DURATION = INTRO_SHORT_SCENES.reduce((n, s) => n + s.frames, 0);

export const IntroShort: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLOR.bg }}>
    <Series>
      {INTRO_SHORT_SCENES.map(({ Comp, frames }, i) => (
        <Series.Sequence key={i} durationInFrames={frames}>
          <Comp />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
