import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { PairGame } from '../domain/entities/pair-game.entity';
import { GameStatus } from '../domain/dto/game-status.enum';
import { Player } from '../domain/entities/player.entity';
import { GameQuestion } from '../domain/entities/game-question.entity';
import { Question } from '../../questions/domain/entities/question.entity';
import {
  FindActiveGameByUserIdDto,
  FindWaitingGameDto,
  GameIdResultDto,
} from './dto/pair-game-repo.dto';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { PlayerRole } from '../domain/dto/player-role.enum';

@Injectable()
export class PairGameRepository {
  constructor(
    @InjectRepository(PairGame)
    private readonly repository: Repository<PairGame>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findActiveGameByUserId(
    dto: FindActiveGameByUserIdDto,
  ): Promise<PairGame | null> {
    return await this.repository
      .createQueryBuilder('game')
      .innerJoin('game.players', 'player')
      .where('player.userId = :userId', { userId: dto.userId })
      .andWhere('game.status IN (:...statuses)', {
        statuses: [GameStatus.PENDING_SECOND_PLAYER, GameStatus.ACTIVE],
      })
      .getOne();
  }

  /**
   * Получить текущую игру пользователя со всеми связями для чтения
   * Используется для получения полных данных игры после изменения состояния
   */
  async getCurrentGameByUserIdWithRelations(
    dto: FindActiveGameByUserIdDto,
  ): Promise<PairGame | null> {
    return await this.repository
      .createQueryBuilder('game')
      .innerJoin('game.players', 'player')
      .leftJoinAndSelect('game.players', 'players')
      .leftJoinAndSelect('players.user', 'user')
      .leftJoinAndSelect('game.questions', 'questions')
      .leftJoinAndSelect('questions.question', 'question')
      .leftJoinAndSelect('players.answers', 'answers')
      .leftJoinAndSelect('answers.gameQuestion', 'answerGameQuestion')
      .where('player.userId = :userId', { userId: dto.userId })
      .andWhere('game.status IN (:...statuses)', {
        statuses: [GameStatus.PENDING_SECOND_PLAYER, GameStatus.ACTIVE],
      })
      .orderBy('questions.order', 'ASC')
      .getOne();
  }

  /**
   * Найти игру в ожидании второго игрока (для матчмейкинга)
   * Используется с FOR UPDATE SKIP LOCKED для безопасного матчмейкинга
   * Должен вызываться внутри транзакции
   */
  async findWaitingGameForMatchmaking(
    dto: FindWaitingGameDto,
    manager?: EntityManager,
  ): Promise<PairGame | null> {
    const repository = manager
      ? manager.getRepository(PairGame)
      : this.dataSource.getRepository(PairGame);

    // Используем raw SQL с SKIP LOCKED для правильной блокировки и избежания гонок
    // Разделяем логику для правильной типизации: EntityManager и DataSource имеют разные сигнатуры query
    let rawResult: GameIdResultDto[];
    if (manager) {
      rawResult = await manager.query<GameIdResultDto[]>(
        `SELECT id FROM pair_games 
         WHERE status = $1 
         AND id NOT IN (SELECT game_id FROM players WHERE user_id = $2)
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [GameStatus.PENDING_SECOND_PLAYER, dto.excludeUserId],
      );
    } else {
      rawResult = await this.dataSource.query<GameIdResultDto[]>(
        `SELECT id FROM pair_games 
         WHERE status = $1 
         AND id NOT IN (SELECT game_id FROM players WHERE user_id = $2)
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [GameStatus.PENDING_SECOND_PLAYER, dto.excludeUserId],
      );
    }

    if (!rawResult || rawResult.length === 0) {
      return null;
    }

    const firstResult = rawResult[0];
    if (!firstResult) {
      return null;
    }

    // Загружаем полную сущность через EntityManager
    return await repository.findOne({
      where: { id: firstResult.id },
    });
  }

  async createGame(userId: string, manager?: EntityManager): Promise<PairGame> {
    const execute = async (mgr: EntityManager) => {
      // Создаем игру
      const game = PairGame.create();
      const savedGame = await mgr.save(PairGame, game);

      // Создаем первого игрока через стандартные методы TypeORM
      // Устанавливаем объект game, TypeORM автоматически синхронизирует gameId
      const firstPlayer = Player.create({
        gameId: savedGame.id,
        userId: userId,
        role: PlayerRole.FIRST_PLAYER,
      });

      // Устанавливаем связь game - TypeORM автоматически синхронизирует gameId
      firstPlayer.game = savedGame;

      // Сохраняем через EntityManager
      await mgr.save(Player, firstPlayer);

      return savedGame;
    };

    if (manager) {
      return await execute(manager);
    } else {
      return await this.dataSource.transaction(execute);
    }
  }

  async joinGameToWaitingPlayer(
    gameId: string,
    userId: string,
    questions: Question[],
    manager?: EntityManager,
  ): Promise<PairGame> {
    const execute = async (mgr: EntityManager) => {
      // Находим игру БЕЗ загрузки связей, чтобы избежать проблем с каскадными операциями
      const game = await mgr.findOne(PairGame, {
        where: { id: gameId },
        // НЕ загружаем relations, чтобы TypeORM не пытался синхронизировать связи
      });

      if (!game) {
        throw new DomainException({
          code: DomainExceptionCode.NotFound,
          message: 'Game not found!',
          field: 'Game',
        });
      }

      // Создаем второго игрока через стандартные методы TypeORM
      // Устанавливаем объект game, TypeORM автоматически синхронизирует gameId
      const secondPlayer = Player.create({
        gameId: gameId,
        userId: userId,
        role: PlayerRole.SECOND_PLAYER,
      });

      // Устанавливаем связь game - TypeORM автоматически синхронизирует gameId
      secondPlayer.game = game;

      // Сохраняем через EntityManager
      try {
        await mgr.save(Player, secondPlayer);
      } catch (error: unknown) {
        // Если ошибка уникального индекса - значит игрок уже существует (гонка)
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23505'
        ) {
          // Загружаем существующего игрока
          const existingPlayer = await mgr.findOne(Player, {
            where: { gameId, userId },
          });
          if (!existingPlayer) {
            throw error;
          }
        } else {
          throw error;
        }
      }

      // Создаем вопросы для игры
      const gameQuestions = questions.map((question, index) =>
        GameQuestion.create({
          gameId: gameId,
          questionId: question.id,
          order: index,
        }),
      );
      await mgr.save(GameQuestion, gameQuestions);

      // Валидируем, что игра в правильном статусе перед началом
      if (!game.isPendingSecondPlayer()) {
        throw new DomainException({
          code: DomainExceptionCode.BadRequest,
          message: 'Game can only be started from PendingSecondPlayer status',
          field: 'status',
        });
      }

      // Начинаем игру
      game.startGame();
      await mgr.save(PairGame, game);

      return game;
    };

    if (manager) {
      return await execute(manager);
    } else {
      return await this.dataSource.transaction(execute);
    }
  }

  async save(game: PairGame): Promise<PairGame> {
    return await this.repository.save(game);
  }

  async finishGame(game: PairGame): Promise<PairGame> {
    // Перезагружаем игру из базы данных, чтобы получить актуальный статус
    const freshGame = await this.repository.findOne({
      where: { id: game.id },
    });

    if (!freshGame) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Game not found!',
        field: 'Game',
      });
    }

    // Валидируем, что игра в правильном статусе перед завершением
    if (!freshGame.isActive()) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Game can only be finished from Active status',
        field: 'status',
      });
    }

    freshGame.finishGame();
    return await this.repository.save(freshGame);
  }
}
