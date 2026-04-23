import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { operatorCreateSchema, operatorUpdateSchema } from '../../shared/validation/operator'
import { operatorRepository } from '../db/repositories/operator'

export function registerOperatorHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OPERATOR_GET_ALL, async (_, opts: unknown) => {
    const includeInactive =
      typeof opts === 'object' &&
      opts !== null &&
      (opts as { includeInactive?: unknown }).includeInactive === true
    return operatorRepository.getAll({ includeInactive })
  })

  ipcMain.handle(IPC_CHANNELS.OPERATOR_CREATE, async (_, data: unknown) => {
    const parsed = operatorCreateSchema.parse(data)
    return operatorRepository.create(parsed)
  })

  ipcMain.handle(IPC_CHANNELS.OPERATOR_UPDATE, async (_, id: unknown, data: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    const parsed = operatorUpdateSchema.parse(data)
    return operatorRepository.update(id, parsed)
  })

  ipcMain.handle(IPC_CHANNELS.OPERATOR_DELETE, async (_, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    return operatorRepository.softDelete(id)
  })
}
