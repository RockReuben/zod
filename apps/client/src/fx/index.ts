/** FX Module - Live Activity Animations for Zod Control Center */

export * from './motionConfig';
export * from './effectTokens';
export * from './classifyEvent';
export * from './nodeGeometry';
export * from './CameraController';
export * from './EffectsEngine';
export * from './ActivityDirector';
export * from './panZoomUtils';
export { FxLayer, FollowPill, MotionSetting } from './FxLayer';

// Re-export types from motionConfig (single source of truth)
export type { Clock, RNG } from './motionConfig';