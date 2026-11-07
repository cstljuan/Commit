import * as Haptics from 'expo-haptics';

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

let enabled = true;
/** Set by Settings. Every haptic in the app goes through this file. */
export const setHapticsEnabled = (on: boolean) => {
  enabled = on;
};

export const impactAsync = async (style?: Haptics.ImpactFeedbackStyle) => {
  if (enabled) await Haptics.impactAsync(style);
};
export const notificationAsync = async (type?: Haptics.NotificationFeedbackType) => {
  if (enabled) await Haptics.notificationAsync(type);
};
export const selectionAsync = async () => {
  if (enabled) await Haptics.selectionAsync();
};
