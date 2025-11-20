import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { PairGame } from '../entities/pair-game.entity';
import { Player } from '../entities/player.entity';
import { GameQuestion } from '../entities/game-question.entity';
import { Question } from '../../../questions/domain/entities/question.entity';
import { GameStatus } from '../dto/game-status.enum';
import { PlayerRole } from '../dto/player-role.enum';
import { GAME_CONSTANTS } from '../dto/game.constants';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class MatchmakingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async connectUserToGame(userId: string): Promise<PairGame> {
    return await this.dataSource.transaction(async (manager) => {
      // Проверка активной игры внутри транзакции
      const activeGame = await manager
        .createQueryBuilder(PairGame, 'game')
        .innerJoin('game.players', 'player')
        .where('player.userId = :userId', { userId })
        .andWhere('game.status IN (:...statuses)', {
          statuses: [GameStatus.PENDING_SECOND_PLAYER, GameStatus.ACTIVE],
        })
        .getOne();

      if (activeGame) {
        throw new DomainException({
          code: DomainExceptionCode.Forbidden,
          message: 'Current user is already participating in active pair',
          field: 'Game',
        });
      }

      // Поиск ожидающей игры с блокировкой
      const waitingGame = await manager
        .createQueryBuilder(PairGame, 'game')
        .where('game.status = :status', {
          status: GameStatus.PENDING_SECOND_PLAYER,
        })
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM players p 
            WHERE p.game_id = game.id AND p.user_id = :userId
          )`,
          { userId },
        )
        .orderBy('game.createdAt', 'ASC')
        .setLock('pessimistic_write_or_fail')
        .getOne();

      if (waitingGame) {
        // Получаем вопросы через репозиторий из EntityManager
        // Это гарантирует, что запрос будет в той же транзакции
        const questionRepository = manager.getRepository(Question);
        const questions = await questionRepository
          .createQueryBuilder('question')
          .where('question.published = :published', { published: true })
          .orderBy('RANDOM()')
          .limit(GAME_CONSTANTS.QUESTIONS_PER_GAME)
          .getMany();

        if (questions.length < GAME_CONSTANTS.QUESTIONS_PER_GAME) {
          throw new DomainException({
            code: DomainExceptionCode.BadRequest,
            message: 'Not enough published questions available',
            field: 'Questions',
          });
        }

        // Подключаемся к игре
        return await this.joinGameToWaitingPlayer(
          waitingGame,
          userId,
          questions,
          manager,
        );
      } else {
        // Создаем новую игру
        return await this.createNewGame(userId, manager);
      }
    });
  }

  private async createNewGame(
    userId: string,
    manager: EntityManager,
  ): Promise<PairGame> {
    // Создаем игру
    const game = PairGame.create();
    const savedGame = await manager.save(PairGame, game);

    // Создаем первого игрока
    const firstPlayer = Player.create({
      gameId: savedGame.id,
      userId: userId,
      role: PlayerRole.FIRST_PLAYER,
    });
    await manager.save(Player, firstPlayer);

    return savedGame;
  }

  /**
   * Проверяет, является ли ошибка ошибкой уникального ограничения PostgreSQL
   */
  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    );
  }

  private async joinGameToWaitingPlayer(
    game: PairGame,
    userId: string,
    questions: Question[],
    manager: EntityManager,
  ): Promise<PairGame> {
    // Игра уже загружена, проверяем статус
    if (!game.isPendingSecondPlayer()) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Game can only be started from PendingSecondPlayer status',
        field: 'status',
      });
    }

    // Создаем второго игрока
    const secondPlayer = Player.create({
      gameId: game.id,
      userId: userId,
      role: PlayerRole.SECOND_PLAYER,
    });

    try {
      await manager.save(Player, secondPlayer);
    } catch (error: unknown) {
      // Если ошибка уникального индекса - значит игрок уже существует (race condition)
      if (this.isUniqueConstraintError(error)) {
        // Игрок уже был создан другим запросом - это нормально, продолжаем
        const existingPlayer = await manager.findOne(Player, {
          where: { gameId: game.id, userId },
        });
        if (!existingPlayer) {
          // Если игрок не найден, значит что-то пошло не так - пробрасываем ошибку
          throw error;
        }
        // Игрок существует - продолжаем выполнение
      } else {
        // Другая ошибка - пробрасываем дальше
        throw error;
      }
    }

    // Создаем вопросы для игры
    const gameQuestions = questions.map((question, index) =>
      GameQuestion.create({
        gameId: game.id,
        questionId: question.id,
        order: index,
      }),
    );
    await manager.save(GameQuestion, gameQuestions);

    // Начинаем игру
    game.startGame();
    await manager.save(PairGame, game);

    return game;
  }
}
