import { create } from 'zustand'

interface NetworkState {
  // Optimistic default: true — avoids flash of offline banner on server/local-only machines.
  // The reconnect poller (5s interval) will push the real state within ~5s on client machines.
  // Server machines and local-only machines never receive a 'connection:status' false event.
  online: boolean
  setOnline: (online: boolean) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  online: true,
  setOnline: (online) => set({ online })
}))
