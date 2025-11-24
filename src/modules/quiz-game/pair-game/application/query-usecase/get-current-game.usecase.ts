import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PairGameQueryRepository } from '../../infrastructure/query/pair-game.query-repository';
import { PairGameViewDto } from '../../api/view-dto/pair-game.view-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class GetCurrentGameQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetCurrentGameQuery)
export class GetCurrentGameUseCase
  implements IQueryHandler<GetCurrentGameQuery, PairGameViewDto>
{
  private readonly logger = new Logger(GetCurrentGameUseCase.name);

  constructor(private pairGameQueryRepository: PairGameQueryRepository) {}

  async execute(query: GetCurrentGameQuery): Promise<PairGameViewDto> {
    const timestamp = new Date().toISOString();
    this.logger.log(
      `[${timestamp}] [GetCurrentGameUseCase.execute] START - Searching current active game for userId: "${query.userId}"`,
    );

    const game = await this.pairGameQueryRepository.getCurrentGameByUserId({
      userId: query.userId,
    });

    if (!game) {
      this.logger.warn(
        `[${timestamp}] [GetCurrentGameUseCase.execute] WARNING - No active game found for user. userId: "${query.userId}". Throwing NotFound exception (404).`,
      );
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'No active pair for current user',
        field: 'Game',
      });
    }

    this.logger.log(
      `[${timestamp}] [GetCurrentGameUseCase.execute] Active game found - gameId: "${game.id}", gameStatus: "${game.status}", userId: "${query.userId}"`,
    );

    const firstPlayer = game.getFirstPlayer();

    if (!firstPlayer) {
      this.logger.error(
        `[${timestamp}] [GetCurrentGameUseCase.execute] ERROR - First player not found in game. gameId: "${game.id}", userId: "${query.userId}"`,
      );
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'First player not found in game',
        field: 'Game',
      });
    }

    this.logger.log(
      `[${timestamp}] [GetCurrentGameUseCase.execute] SUCCESS - Returning current game view. gameId: "${game.id}", userId: "${query.userId}"`,
    );
    return PairGameViewDto.mapToView(game);
  }
}
