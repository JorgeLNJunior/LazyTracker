/* eslint-disable @typescript-eslint/no-unused-vars */
import { ApplicationCache, CacheData } from '@localtypes/http/cache.type'

export class FakeCache implements ApplicationCache {
  async get(key: string): Promise<CacheData | undefined> {
    return undefined
  }
  async set(
    key: string,
    value: unknown,
    expire?: number | undefined
  ): Promise<void> {
    return
  }
}
