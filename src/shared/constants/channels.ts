export const IPC_CHANNELS = {
  PLATFORM_GET_ALL: 'platform:get-all',
  PLATFORM_GET_BY_ID: 'platform:get-by-id',
  PLATFORM_CREATE: 'platform:create',
  PLATFORM_UPDATE: 'platform:update',
  DB_HEALTH: 'db:health'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
