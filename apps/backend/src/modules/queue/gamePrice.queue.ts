import ConfigService from '@config/config.service'
import { PINO_LOGGER } from '@dependencies/dependency.tokens'
import { ApplicationLogger } from '@localtypes/logger.type'
import {
  type GamePriceScraperData,
  QueueJobName,
  QueueName
} from '@localtypes/queue.type'
import { Queue } from 'bullmq'
import { inject, singleton } from 'tsyringe'

import { ONE_MINUTE, ONE_WEEK } from './time/time'

@singleton()
export class GamePriceQueue {
  private queue!: Queue<GamePriceScraperData>

  /**
   * Handles the game queue.
   * @param config - An instance of `ConfigService`.
   * @param logger - An instance of `ApplicationLogger`.
   */
  constructor (
    private readonly config: ConfigService,
    @inject(PINO_LOGGER) private readonly logger: ApplicationLogger
  ) {}

  /**
   * Adds a job to the queue.
   * You must call `init()` before call this method.
   * @example
   * ```
   * await queue.init()
   * await queue.add(data)
   * ```
   * @param data - The data to add to the queue.
   */
  async add (data: GamePriceScraperData): Promise<void> {
    await this.queue.add(QueueJobName.SCRAPE_GAME_PRICE, data)
  }

  /**
   * Starts the queue.
   * You must call this method before add a job to the queue.
   * @example
   * ```
   * await queue.init()
   * ```
   */
  async init (): Promise<void> {
    this.queue = new Queue<GamePriceScraperData>(QueueName.GAME_PRICE_SCRAPING, {
      connection: {
        host: this.config.getEnv('REDIS_HOST'),
        port: this.config.getEnv('REDIS_PORT'),
        password: this.config.getEnv('REDIS_PASSWORD'),
        enableOfflineQueue: false
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: ONE_MINUTE * 5
        },
        removeOnComplete: {
          count: 100,
          age: ONE_WEEK
        },
        removeOnFail: {
          count: 500,
          age: ONE_WEEK
        }
      }
    })

    this.queue.on('error', (err) => {
      this.logger.error(err, '[GamePriceQueue] queue failed')
    })
  }

  /**
   * Gracefully stops the queue
   * @example
   * ```
   * await queue.stop()
   * ```
   */
  async stop (): Promise<void> {
    this.logger.info('[GamePriceQueue] stopping the queue')
    await this.queue.close()
    this.logger.info('[GamePriceQueue] the queue stopped')
  }
}
