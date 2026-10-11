import { useSyncExternalStore } from 'react'
import { isAtlasReady, subscribeAtlas } from '../game/sprites'

/** true once every sprite sheet has loaded */
export const useAtlas = () => useSyncExternalStore(subscribeAtlas, isAtlasReady)
