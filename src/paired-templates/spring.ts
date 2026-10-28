/**
 * remotion@4.0.502 spring(), ported for the one call remotion-templates makes:
 * spring({frame, fps, config: {damping: 200}, durationInFrames: round(fps * 0.7)}).
 * The arithmetic follows the package step for step so results match exactly;
 * spring-tables.ts holds samples taken from the real package, and the tests
 * require equality at 24, 30 and 60 fps. Remotion 4.0.536 differs, so port
 * again only when remotion-templates moves its pin.
 */
const CONFIG = { damping: 200, mass: 1, stiffness: 100 };
const REST_THRESHOLD = 0.005;

type SpringState = {
  lastTimestamp: number;
  current: number;
  toValue: number;
  velocity: number;
};

function advance(animation: SpringState, now: number): SpringState {
  const { toValue, lastTimestamp, current, velocity } = animation;
  const deltaTime = Math.min(now - lastTimestamp, 64);
  const c = CONFIG.damping;
  const m = CONFIG.mass;
  const k = CONFIG.stiffness;
  const v0 = -velocity;
  const x0 = toValue - current;
  const zeta = c / (2 * Math.sqrt(k * m));
  const omega0 = Math.sqrt(k / m);
  const omega1 = omega0 * Math.sqrt(1 - zeta ** 2);
  const t = deltaTime / 1000;
  const sin1 = Math.sin(omega1 * t);
  const cos1 = Math.cos(omega1 * t);
  const underDampedEnvelope = Math.exp(-zeta * omega0 * t);
  const underDampedFrag1 =
    underDampedEnvelope *
    (sin1 * ((v0 + zeta * omega0 * x0) / omega1) + x0 * cos1);
  const underDampedPosition = toValue - underDampedFrag1;
  const underDampedVelocity =
    zeta * omega0 * underDampedFrag1 -
    underDampedEnvelope *
      (cos1 * (v0 + zeta * omega0 * x0) - omega1 * x0 * sin1);
  const criticallyDampedEnvelope = Math.exp(-omega0 * t);
  const criticallyDampedPosition =
    toValue - criticallyDampedEnvelope * (x0 + (v0 + omega0 * x0) * t);
  const criticallyDampedVelocity =
    criticallyDampedEnvelope *
    (v0 * (t * omega0 - 1) + t * x0 * omega0 * omega0);
  return {
    toValue,
    lastTimestamp: now,
    current: zeta < 1 ? underDampedPosition : criticallyDampedPosition,
    velocity: zeta < 1 ? underDampedVelocity : criticallyDampedVelocity,
  };
}

function springCalculation(frame: number, fps: number): SpringState {
  let animation: SpringState = {
    lastTimestamp: 0,
    current: 0,
    toValue: 1,
    velocity: 0,
  };
  const frameClamped = Math.max(0, frame);
  const unevenRest = frameClamped % 1;
  for (let f = 0; f <= Math.floor(frameClamped); f++) {
    if (f === Math.floor(frameClamped)) f += unevenRest;
    animation = advance(animation, (f / fps) * 1000);
  }
  return animation;
}

function measureSpring(fps: number): number {
  let frame = 0;
  let animation = springCalculation(frame, fps);
  let difference = Math.abs(animation.current - animation.toValue);
  while (difference >= REST_THRESHOLD) {
    frame++;
    animation = springCalculation(frame, fps);
    difference = Math.abs(animation.current - animation.toValue);
  }
  // Remotion waits until the spring stays settled for 20 more frames.
  let finishedFrame = frame;
  for (let i = 0; i < 20; i++) {
    frame++;
    animation = springCalculation(frame, fps);
    difference = Math.abs(animation.current - animation.toValue);
    if (difference >= REST_THRESHOLD) {
      i = 0;
      finishedFrame = frame + 1;
    }
  }
  return finishedFrame;
}

/** Entrance progress at frames 0 to durationInFrames + 1, where it is 1. */
export function springSamples(fps: number): number[] {
  const durationInFrames = Math.round(fps * 0.7);
  const naturalDuration = measureSpring(fps);
  return Array.from({ length: durationInFrames + 2 }, (_, frame) =>
    frame > durationInFrames
      ? 1
      : springCalculation(frame / (durationInFrames / naturalDuration), fps)
          .current
  );
}
