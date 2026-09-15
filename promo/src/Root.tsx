import React from 'react';
import { Composition } from 'remotion';
import { Intro, INTRO_DURATION, IntroShort, INTRO_SHORT_DURATION } from './Intro';
import { FPS, HEIGHT, WIDTH } from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Intro"
      component={Intro}
      durationInFrames={INTRO_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="IntroShort"
      component={IntroShort}
      durationInFrames={INTRO_SHORT_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
