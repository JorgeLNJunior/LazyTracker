import { PINO_LOGGER } from '@dependencies/dependency.tokens'
import { ApplicationLogger } from '@localtypes/logger.type'
import { ScrapeGamePriceData } from '@localtypes/queue.type'
import { FindGameByIdRepository } from '@modules/shared/repositories/findGameById.repository'
import { GetCurrentGamePriceRepository } from '@modules/shared/repositories/getCurrentGamePrice.repository'
import { NotificationQueue } from '@queue/notification.queue'
import { NuuvemScraper } from '@scrapers/nuuvem.scraper'
import { SteamScraper } from '@scrapers/steam.scraper'
import { inject, injectable } from 'tsyringe'

import { InsertGamePriceRepository } from './repositories/insertGamePrice.repository'

@injectable()
export class GameJobProcessor {
  /**
   * Process all game related jobs from the game queue.
   * @param steamScraper - An instance of `SteamScraper`.
   * @param nuuvemScraper - An instance of `NuuvemScraper`.
   * @param insertGamePriceRepository - An instance of `InsertGamePriceRepository`.
   * @param getCurrentGamePriceRepository - An instance of `GetCurrentGamePriceRepository`.
   * @param findGameByIdRepository - An instance of `FindGameByIdRepository`
   * @param notificationQueue - An instance of `NotificationQueue`.
   * @param logger - An instance of `ApplicationLogger`.
   */
  constructor(
    private steamScraper: SteamScraper,
    private nuuvemScraper: NuuvemScraper,
    private insertGamePriceRepository: InsertGamePriceRepository,
    private getCurrentGamePriceRepository: GetCurrentGamePriceRepository,
    private findGameByIdRepository: FindGameByIdRepository,
    private notificationQueue: NotificationQueue,
    @inject(PINO_LOGGER) private logger: ApplicationLogger
  ) {}

  /**
   * Scrapes and saves the current game price.
   *
   * Notifies if the current price is lower than the latest registered.
   * @param data - The game data.
   */
  async scrapePrice(data: ScrapeGamePriceData): Promise<void> {
    let currentNuuvemPrice = null

    const currentSteamPrice = await this.steamScraper.getGamePrice(
      data.steamUrl
    )

    const hasNuuvemUrl = data.nuuvemUrl
    if (hasNuuvemUrl) {
      currentNuuvemPrice = await this.nuuvemScraper.getGamePrice(
        data.nuuvemUrl as string
      )
    }

    if (!currentSteamPrice) return
    const game = await this.findGameByIdRepository.find(data.gameId)
    if (!game) return

    const lastRegisteredPrice =
      await this.getCurrentGamePriceRepository.getPrice(data.gameId)

    await this.insertGamePriceRepository.insert(data.gameId, {
      steam_price: currentSteamPrice,
      nuuvem_price: currentNuuvemPrice
    })

    // needs rewrite, i coudn't find a cleaner solution.
    // should notify if current price at steam or nuuvem is lower than last registered price (both platforms).
    if (
      lastRegisteredPrice &&
      currentNuuvemPrice &&
      lastRegisteredPrice.nuuvem_price
    ) {
      const isNuuvemPriceLowest =
        currentNuuvemPrice <
        Math.min(
          lastRegisteredPrice.nuuvem_price,
          lastRegisteredPrice.steam_price,
          currentSteamPrice
        )
      if (isNuuvemPriceLowest) {
        return this.notificationQueue.add({
          currentPrice: currentNuuvemPrice as number,
          oldPrice: lastRegisteredPrice.nuuvem_price as number,
          gameTitle: game.title,
          platform: 'Nuuvem',
          gameUrl: game.nuuvem_url as string
        })
      }

      const isSteamPriceLowest =
        currentSteamPrice <
        Math.min(
          lastRegisteredPrice.nuuvem_price,
          lastRegisteredPrice.steam_price,
          currentNuuvemPrice
        )
      if (isSteamPriceLowest) {
        return this.notificationQueue.add({
          currentPrice: currentSteamPrice,
          oldPrice: lastRegisteredPrice.steam_price,
          gameTitle: game.title,
          platform: 'Steam',
          gameUrl: game.steam_url
        })
      }
    }
    if (
      lastRegisteredPrice &&
      currentSteamPrice < lastRegisteredPrice.steam_price
    ) {
      return this.notificationQueue.add({
        currentPrice: currentSteamPrice,
        oldPrice: lastRegisteredPrice.steam_price,
        gameTitle: game.title,
        platform: 'Steam',
        gameUrl: game.steam_url
      })
    }
  }
}
