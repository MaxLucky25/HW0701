import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PairGameRepository } from '../../infrastructure/pair-game.repository';
import { PairGameViewDto } from '../../api/view-dto/pair-game.view-dto';
import { QuestionsRepository } from '../../../questions/infrastructure/questions.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PairGameQueryRepository } from '../../infrastructure/query/pair-game.query-repository';

export class ConnectToGameCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(ConnectToGameCommand)
export class ConnectToGameUseCase
  implements ICommandHandler<ConnectToGameCommand, PairGameViewDto>
{
  constructor(
    private pairGameRepository: PairGameRepository,
    private pairGameQueryRepository: PairGameQueryRepository,
    private questionsRepository: QuestionsRepository,
  ) {}

  async execute(command: ConnectToGameCommand): Promise<PairGameViewDto> {
    // Проверяем, есть ли у пользователя активная игра
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

    // Ищем игру в ожидании второго игрока
    const waitingGame =
      await this.pairGameRepository.findWaitingGameForMatchmaking({
        excludeUserId: command.userId,
      });

    if (waitingGame) {
      // Находим 5 случайных опубликованных вопросов
      const questions = await this.questionsRepository.findRandomQuestions({
        count: 5,
      });

      if (questions.length < 5) {
        throw new DomainException({
          code: DomainExceptionCode.BadRequest,
          message: 'Not enough published questions available',
          field: 'Questions',
        });
      }

      // Подключаемся к ожидающей игре
      await this.pairGameRepository.joinGameToWaitingPlayer(
        waitingGame.id,
        command.userId,
        questions,
      );
    } else {
      // Создаем новую игру
      await this.pairGameRepository.createGame(command.userId);
    }

    // Загружаем полные данные игры для ответа
    const fullGame = await this.pairGameQueryRepository.getCurrentGameByUserId({
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
