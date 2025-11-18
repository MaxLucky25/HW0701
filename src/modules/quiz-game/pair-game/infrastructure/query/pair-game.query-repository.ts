import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PairGame } from '../../domain/entities/pair-game.entity';
import { FindActiveGameByUserIdDto } from '../dto/pair-game-repo.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GameStatus } from '../../domain/dto/game-status.enum';

@Injectable()
export class PairGameQueryRepository {
  constructor(
    @InjectRepository(PairGame)
    private readonly repository: Repository<PairGame>,
  ) {}

  async getCurrentGameByUserId(
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
      .getOne();
  }

  async getGameByIdForUser(
    gameId: string,
    userId: string,
  ): Promise<PairGame | null> {
    // Сначала проверяем, существует ли игра
    const gameExists = await this.repository.findOne({
      where: { id: gameId },
    });

    if (!gameExists) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Game not found!',
        field: 'Game',
      });
    }

    // Теперь проверяем, участвует ли пользователь в игре
    const game = await this.repository
      .createQueryBuilder('game')
      .innerJoin('game.players', 'player')
      .leftJoinAndSelect('game.players', 'players')
      .leftJoinAndSelect('players.user', 'user')
      .leftJoinAndSelect('game.questions', 'questions')
      .leftJoinAndSelect('questions.question', 'question')
      .leftJoinAndSelect('players.answers', 'answers')
      .leftJoinAndSelect('answers.gameQuestion', 'answerGameQuestion')
      .where('game.id = :gameId', { gameId })
      .andWhere('player.userId = :userId', { userId })
      .getOne();

    // Если игра существует, но пользователь не участвует, возвращаем null
    // Use case обработает это как Forbidden
    return game;
  }
}
