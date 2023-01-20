import { fastify, FastifyInstance } from 'fastify'
import { singleton } from 'tsyringe'

import { Logger } from '../infra/logger'
import ConfigService from '../services/config.service'
import { adaptRoute } from './adapters/route.adapter'
import { BaseController } from './interfaces/baseController.interface'

@singleton()
export class Server {
  private fastify: FastifyInstance

  constructor(private config: ConfigService, private logger: Logger) {
    this.fastify = fastify()
  }

  /**
   * Start the server and listen at `PORT` env or `3000`.
   *
   * ```
   * await server.listen()
   * ```
   */
  public async listen(): Promise<void> {
    return this.fastify.listen(
      {
        host: this.config.getEnv<string>('HOST') || '0.0.0.0',
        port: this.config.getEnv<number>('PORT') || 3000
      },
      (error) => {
        if (error) this.logger.fatal(error, 'server startup error')
        else this.logger.info('server listening')
      }
    )
  }

  /**
   * Close the server and stop listen.
   *
   * ```
   * await server.close()
   * ```
   */
  public async close(): Promise<void> {
    return this.fastify.close()
  }

  /**
   * Get the fastify instance.
   *
   * ```
   * const fastify = server.getFastifyInstance()
   * ```
   */
  public getFastifyInstance(): FastifyInstance {
    return this.fastify
  }

  /**
   * Register a list of controllers.
   *
   * ```
   * server.registerControllers(
   *    new CatController(),
   *    new DogController(),
   * )
   * ```
   *
   * @param controllers A list of `BaseController`.
   *
   */
  public registerControllers(...controllers: BaseController[]): void {
    controllers.forEach((controller) => {
      this.fastify.route({
        url: controller.url,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        method: controller.method as any,
        handler: adaptRoute(controller)
      })
    })
  }
}
