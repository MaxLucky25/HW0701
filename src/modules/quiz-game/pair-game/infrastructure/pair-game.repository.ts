import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { PairGame } from '../domain/entities/pair-game.entity';
import { GameStatus } from '../domain/dto/game-status.enum';
import { FindActiveGameByUserIdDto } from './dto/pair-game-repo.dto';

@Injectable()
export class PairGameRepository {
  constructor(
    @InjectRepository(PairGame)
    private readonly repository: Repository<PairGame>,
  ) {}

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

  async findActiveGameByUserId(
    dto: FindActiveGameByUserIdDto,
    manager: EntityManager,
  ): Promise<PairGame | null> {
    return await manager
      .createQueryBuilder(PairGame, 'game')
      .innerJoin('game.players', 'player')
      .where('player.userId = :userId', { userId: dto.userId })
      .andWhere('game.status = :status', { status: GameStatus.ACTIVE })
      .setLock('pessimistic_write')
      .getOne();
  }

  async finishGame(game: PairGame, manager: EntityManager): Promise<void> {
    game.finishGame();
    await manager.save(PairGame, game);
  }
}
