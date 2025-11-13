import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Question)
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
    const game = PairGame.create(userId);
    const savedGame = await this.repository.save(game);

    // Создаем первого игрока
    const firstPlayer = Player.create(
      savedGame.id,
      userId,
      PlayerRole.FIRST_PLAYER,
    );
    await this.playerRepository.save(firstPlayer);

    return savedGame;
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
      const secondPlayer = Player.create(
        gameId,
        userId,
        PlayerRole.SECOND_PLAYER,
      );
      await manager.save(Player, secondPlayer);

      // Создаем 5 вопросов для игры
      const gameQuestions = questions.map((question, index) =>
        GameQuestion.create(gameId, question.id, index),
      );
      await manager.save(GameQuestion, gameQuestions);

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
    game.finishGame();
    return await this.repository.save(game);
  }
}
