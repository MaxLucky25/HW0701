import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PairGame } from '../domain/entities/pair-game.entity';
import { GameStatus } from '../domain/dto/game-status.enum';
import { Player } from '../domain/entities/player.entity';
import { GameQuestion } from '../domain/entities/game-question.entity';
import { Question } from '../../questions/domain/entities/question.entity';
import {
  FindGameByIdDto,
  FindActiveGameByUserIdDto,
  FindWaitingGameDto,
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

  async findById(dto: FindGameByIdDto): Promise<PairGame | null> {
    return await this.repository.findOne({
      where: { id: dto.id },
      relations: ['players', 'questions'],
    });
  }

  async findByIdOrNotFoundFail(dto: FindGameByIdDto): Promise<PairGame> {
    const game = await this.findById(dto);

    if (!game) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Game not found!',
        field: 'Game',
      });
    }

    return game;
  }

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
   * Найти игру в ожидании второго игрока (для матчмейкинга)
   * Используется с FOR UPDATE SKIP LOCKED для безопасного матчмейкинга
   */
  async findWaitingGameForMatchmaking(
    dto: FindWaitingGameDto,
  ): Promise<PairGame | null> {
    return await this.dataSource
      .getRepository(PairGame)
      .createQueryBuilder('game')
      .where('game.status = :status', {
        status: GameStatus.PENDING_SECOND_PLAYER,
      })
      .andWhere(
        'game.id NOT IN (SELECT game_id FROM players WHERE user_id = :userId)',
        { userId: dto.excludeUserId },
      )
      .orderBy('game.createdAt', 'ASC')
      .setLock('pessimistic_write')
      .getOne();
  }

  async createGame(userId: string): Promise<PairGame> {
    return await this.dataSource.transaction(async (manager) => {
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
    });
  }

  async joinGameToWaitingPlayer(
    gameId: string,
    userId: string,
    questions: Question[],
  ): Promise<PairGame> {
    return await this.dataSource.transaction(async (manager) => {
      // Находим игру
      const game = await manager.findOne(PairGame, {
        where: { id: gameId },
        relations: ['players'],
      });

      if (!game) {
        throw new DomainException({
          code: DomainExceptionCode.NotFound,
          message: 'Game not found!',
          field: 'Game',
        });
      }

      // Создаем второго игрока
      const secondPlayer = Player.create({
        gameId: gameId,
        userId: userId,
        role: PlayerRole.SECOND_PLAYER,
      });
      await manager.save(Player, secondPlayer);

      // Создаем 5 вопросов для игры
      const gameQuestions = questions.map((question, index) =>
        GameQuestion.create({
          gameId: gameId,
          questionId: question.id,
          order: index,
        }),
      );
      await manager.save(GameQuestion, gameQuestions);

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
      await manager.save(PairGame, game);

      return game;
    });
  }

  async save(game: PairGame): Promise<PairGame> {
    return await this.repository.save(game);
  }

  async finishGame(game: PairGame): Promise<PairGame> {
    // Валидируем, что игра в правильном статусе перед завершением
    if (!game.isActive()) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Game can only be finished from Active status',
        field: 'status',
      });
    }

    game.finishGame();
    return await this.repository.save(game);
  }
}
