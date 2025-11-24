import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PairGame } from '../../domain/entities/pair-game.entity';
import { FindActiveGameByUserIdDto } from '../dto/pair-game-repo.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GameStatus } from '../../domain/dto/game-status.enum';

@Injectable()
export class PairGameQueryRepository {
  private readonly logger = new Logger(PairGameQueryRepository.name);

  constructor(
    @InjectRepository(PairGame)
    private readonly repository: Repository<PairGame>,
  ) {}

  async getCurrentGameByUserId(
    dto: FindActiveGameByUserIdDto,
  ): Promise<PairGame | null> {
    const timestamp = new Date().toISOString();
    this.logger.log(
      `[${timestamp}] [PairGameQueryRepository.getCurrentGameByUserId] START - Searching active game for userId: "${dto.userId}". Statuses: PENDING_SECOND_PLAYER, ACTIVE`,
    );

    const game = await this.repository
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

    if (game) {
      this.logger.log(
        `[${timestamp}] [PairGameQueryRepository.getCurrentGameByUserId] Active game found - gameId: "${game.id}", gameStatus: "${game.status}", userId: "${dto.userId}"`,
      );
    } else {
      this.logger.log(
        `[${timestamp}] [PairGameQueryRepository.getCurrentGameByUserId] No active game found - userId: "${dto.userId}". Returning null.`,
      );
    }

    return game;
  }

  async getGameByIdForUser(
    gameId: string,
    userId: string,
  ): Promise<PairGame | null> {
    const timestamp = new Date().toISOString();
    this.logger.log(
      `[${timestamp}] [PairGameQueryRepository.getGameByIdForUser] START - Searching game with gameId: "${gameId}", userId: "${userId}"`,
    );

    // Проверяем, участвует ли пользователь в игре
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
      .orderBy('questions.order', 'ASC')
      .getOne();

    if (game) {
      this.logger.log(
        `[${timestamp}] [PairGameQueryRepository.getGameByIdForUser] Game found for user - gameId: "${gameId}", userId: "${userId}", gameStatus: "${game.status}"`,
      );
      return game;
    }

    // Если игра не найдена (null), проверяем существование игры
    // для правильной обработки ошибок (404 vs 403)
    this.logger.log(
      `[${timestamp}] [PairGameQueryRepository.getGameByIdForUser] Game not found for user. Checking if game exists in DB - gameId: "${gameId}"`,
    );

    const gameExists = await this.repository.findOne({
      where: { id: gameId },
    });

    if (!gameExists) {
      this.logger.warn(
        `[${timestamp}] [PairGameQueryRepository.getGameByIdForUser] ERROR - Game does not exist in database. gameId: "${gameId}". Throwing NotFound exception (404).`,
      );
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Game not found!',
        field: 'Game',
      });
    }

    // Если игра существует, но пользователь не участвует, возвращаем null
    // Use case обработает это как Forbidden
    this.logger.log(
      `[${timestamp}] [PairGameQueryRepository.getGameByIdForUser] Game exists but user is not participant - gameId: "${gameId}", userId: "${userId}". Returning null (will be handled as Forbidden in use case).`,
    );
    return null;
  }
}
