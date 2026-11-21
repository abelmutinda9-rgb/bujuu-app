/**
 * BUJUU Playback Gate
 * Free streaming: all playback gates are permanently open.
 */

export type PlaybackGate = "open" | "loading";

export function usePlaybackGate() {
  return {
    gate: "open" as const,
    refresh: () => {},
    trial: {
      trial: { deviceId: "guest", active: true, valid: true },
      canStream: true,
      isLoading: false,
    },
    account: {
      signedIn: false,
      isPremium: true,
      loading: false,
    },
  };
}

export function Paywall(_props: { gate?: any; onPaid?: () => void }) {
  return null;
}
