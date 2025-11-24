import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PairGameQueryRepository } from '../../infrastructure/query/pair-game.query-repository';
import { PairGameViewDto } from '../../api/view-dto/pair-game.view-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class GetGameByIdQuery {
  constructor(
    public readonly gameId: string,
    public readonly userId: string,
  ) {}
}

@QueryHandler(GetGameByIdQuery)
export class GetGameByIdUseCase
  implements IQueryHandler<GetGameByIdQuery, PairGameViewDto>
{
  private readonly logger = new Logger(GetGameByIdUseCase.name);

  constructor(private pairGameQueryRepository: PairGameQueryRepository) {}

  async execute(query: GetGameByIdQuery): Promise<PairGameViewDto> {
    const timestamp = new Date().toISOString();
    this.logger.log(
      `[${timestamp}] [GetGameByIdUseCase.execute] START - gameId: "${query.gameId}", userId: "${query.userId}"`,
    );

    const game = await this.pairGameQueryRepository.getGameByIdForUser(
      query.gameId,
      query.userId,
    );

    if (!game) {
      this.logger.warn(
        `[${timestamp}] [GetGameByIdUseCase.execute] WARNING - Game not found or user is not participant. gameId: "${query.gameId}", userId: "${query.userId}". Throwing Forbidden exception.`,
      );
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: 'Current user is not participant of this pair',
        field: 'Game',
      });
    }

    this.logger.log(
      `[${timestamp}] [GetGameByIdUseCase.execute] Game found - gameId: "${query.gameId}", gameStatus: "${game.status}"`,
    );

    const firstPlayer = game.getFirstPlayer();

    if (!firstPlayer) {
      this.logger.error(
        `[${timestamp}] [GetGameByIdUseCase.execute] ERROR - First player not found in game. gameId: "${query.gameId}"`,
      );
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'First player not found in game',
        field: 'Game',
      });
    }

    this.logger.log(
      `[${timestamp}] [GetGameByIdUseCase.execute] SUCCESS - Returning game view. gameId: "${query.gameId}"`,
    );
    return PairGameViewDto.mapToView(game);
  }
}
