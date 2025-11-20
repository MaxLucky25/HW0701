import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PairGame } from '../domain/entities/pair-game.entity';
import { GameStatus } from '../domain/dto/game-status.enum';
import { FindActiveGameByUserIdDto } from './dto/pair-game-repo.dto';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class PairGameRepository {
  constructor(
    @InjectRepository(PairGame)
    private readonly repository: Repository<PairGame>,
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

  async findById(gameId: string): Promise<PairGame | null> {
    return await this.repository.findOne({
      where: { id: gameId },
    });
  }

  async create(game: PairGame): Promise<PairGame> {
    return await this.repository.save(game);
  }

  async save(game: PairGame): Promise<PairGame> {
    return await this.repository.save(game);
  }

  async finishGame(game: PairGame): Promise<PairGame> {
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
