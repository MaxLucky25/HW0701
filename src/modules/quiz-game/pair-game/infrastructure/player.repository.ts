import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Player } from '../domain/entities/player.entity';
import { PlayerRole } from '../domain/dto/player-role.enum';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import {
  FindPlayerByGameAndUserDto,
  FindPlayersByGameIdDto,
} from './dto/player-repo.dto';

@Injectable()
export class PlayerRepository {
  constructor(
    @InjectRepository(Player)
    private readonly repository: Repository<Player>,
  ) {}

  // ==================== ANSWER SUBMISSION METHODS ====================

  /**
   * Найти игрока по игре и пользователю или выбросить исключение
   * Использует блокировку для предотвращения race conditions
   *
   * @usedIn AnswerSubmissionService.submitAnswer - поиск игрока перед отправкой ответа
   */
  async findPlayerOrNotFoundFail(
    dto: FindPlayerByGameAndUserDto,
    manager: EntityManager,
  ): Promise<Player> {
    const player = await manager
      .createQueryBuilder(Player, 'player')
      .where('player.gameId = :gameId', { gameId: dto.gameId })
      .andWhere('player.userId = :userId', { userId: dto.userId })
      .setLock('pessimistic_write')
      .getOne();

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Player not found',
        field: 'Player',
      });
    }

    return player;
  }

  /**
   * Обновить счет игрока (увеличивает при правильном ответе, завершает при последнем вопросе)
   *
   * @usedIn AnswerSubmissionService.submitAnswer - обновление счета после отправки ответа
   */
  async updatePlayerScore(
    player: Player,
    isCorrect: boolean,
    isLastQuestion: boolean,
    manager: EntityManager,
  ): Promise<void> {
    if (isCorrect) {
      player.incrementScore();
    }

    if (isLastQuestion) {
      player.finish();
    }

    await manager.save(Player, player);
  }

  /**
   * Найти всех игроков игры
   *
   * @usedIn AnswerSubmissionService.checkAndFinishGame - проверка завершения игры всеми игроками
   */
  async findAllByGameId(
    dto: FindPlayersByGameIdDto,
    manager: EntityManager,
  ): Promise<Player[]> {
    return await manager.find(Player, {
      where: { gameId: dto.gameId },
    });
  }

  /**
   * Сохранить нескольких игроков (используется для обновления бонусов)
   *
   * @usedIn AnswerSubmissionService.checkAndFinishGame - сохранение игроков с начисленными бонусами
   */
  async savePlayers(players: Player[], manager: EntityManager): Promise<void> {
    await manager.save(Player, players);
  }

  // ==================== MATCHMAKING METHODS ====================

  /**
   * Создает и сохраняет первого игрока
   *
   * @usedIn MatchmakingService.createNewGame - создание первого игрока при создании новой игры
   */
  async createFirstPlayer(
    gameId: string,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const firstPlayer = Player.create({
      gameId,
      userId,
      role: PlayerRole.FIRST_PLAYER,
    });
    await manager.save(Player, firstPlayer);
  }

  /**
   * Создает второго игрока с обработкой race condition
   * Если игрок уже существует (из-за параллельных запросов), продолжает выполнение
   *
   * @usedIn MatchmakingService.joinGameToWaitingPlayer - создание второго игрока при подключении к игре
   */
  async createSecondPlayerWithRaceConditionHandling(
    gameId: string,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const secondPlayer = Player.create({
      gameId,
      userId,
      role: PlayerRole.SECOND_PLAYER,
    });

    try {
      await manager.save(Player, secondPlayer);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        // Игрок уже был создан другим запросом - проверяем его существование
        await this.checkPlayerExists(gameId, userId, manager);
      } else {
        throw error;
      }
    }
  }

  /**
   * Проверяет существование игрока, выбрасывает исключение если не найден
   *
   * @usedIn PlayerRepository.createSecondPlayerWithRaceConditionHandling - внутренний метод для обработки race condition
   */
  async checkPlayerExists(
    gameId: string,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const existingPlayer = await manager.findOne(Player, {
      where: { gameId, userId },
    });

    if (!existingPlayer) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'Player creation failed due to race condition',
        field: 'Player',
      });
    }
  }

  /**
   * Проверяет, является ли ошибка ошибкой уникального ограничения PostgreSQL
   *
   * @usedIn PlayerRepository.createSecondPlayerWithRaceConditionHandling - внутренний метод для обработки race condition
   */
  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
