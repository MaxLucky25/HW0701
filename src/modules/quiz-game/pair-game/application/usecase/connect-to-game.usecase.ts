import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PairGameRepository } from '../../infrastructure/pair-game.repository';
import { PairGameViewDto } from '../../api/view-dto/pair-game.view-dto';
import { QuestionsRepository } from '../../../questions/infrastructure/questions.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GAME_CONSTANTS } from '../../domain/dto/game.constants';

export class ConnectToGameCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(ConnectToGameCommand)
export class ConnectToGameUseCase
  implements ICommandHandler<ConnectToGameCommand, PairGameViewDto>
{
  constructor(
    private pairGameRepository: PairGameRepository,
    private questionsRepository: QuestionsRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: ConnectToGameCommand): Promise<PairGameViewDto> {
    // Проверяем, есть ли у пользователя активная игра (вне транзакции)
    const activeGame = await this.pairGameRepository.findActiveGameByUserId({
      userId: command.userId,
    });

    if (activeGame) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: 'Current user is already participating in active pair',
        field: 'Game',
      });
    }

    // Вся логика матчмейкинга выполняется в транзакции
    await this.dataSource.transaction(async (manager) => {
      // Ищем игру в ожидании второго игрока (внутри транзакции с блокировкой)
      const waitingGame =
        await this.pairGameRepository.findWaitingGameForMatchmaking(
          {
            excludeUserId: command.userId,
          },
          manager,
        );

      if (waitingGame) {
        // Находим случайные опубликованные вопросы
        const questions = await this.questionsRepository.findRandomQuestions({
          count: GAME_CONSTANTS.QUESTIONS_PER_GAME,
        });

        if (questions.length < GAME_CONSTANTS.QUESTIONS_PER_GAME) {
          throw new DomainException({
            code: DomainExceptionCode.BadRequest,
            message: 'Not enough published questions available',
            field: 'Questions',
          });
        }

        // Подключаемся к ожидающей игре (внутри транзакции)
        await this.pairGameRepository.joinGameToWaitingPlayer(
          waitingGame.id,
          command.userId,
          questions,
          manager,
        );
      } else {
        // Создаем новую игру (внутри транзакции)
        await this.pairGameRepository.createGame(command.userId, manager);
      }
    });

    // Загружаем полные данные игры для ответа (после коммита транзакции)
    const fullGame =
      await this.pairGameRepository.getCurrentGameByUserIdWithRelations({
        userId: command.userId,
      });

    if (!fullGame) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'Failed to load game after connection',
        field: 'Game',
      });
    }

    return PairGameViewDto.mapToView(fullGame);
  }
}
