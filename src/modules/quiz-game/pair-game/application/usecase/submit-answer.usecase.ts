import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PairGameRepository } from '../../infrastructure/pair-game.repository';
import { GameAnswerRepository } from '../../infrastructure/game-answer.repository';
import { GameQuestionRepository } from '../../infrastructure/game-question.repository';
import { PlayerRepository } from '../../infrastructure/player.repository';
import { SubmitAnswerInputDto } from '../../api/input-dto/submit-answer.input.dto';
import { AnswerViewDto } from '../../api/view-dto/answer.view-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GameAnswer } from '../../domain/entities/game-answer.entity';

export class SubmitAnswerCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: SubmitAnswerInputDto,
  ) {}
}

@CommandHandler(SubmitAnswerCommand)
export class SubmitAnswerUseCase
  implements ICommandHandler<SubmitAnswerCommand, AnswerViewDto>
{
  constructor(
    private pairGameRepository: PairGameRepository,
    private gameAnswerRepository: GameAnswerRepository,
    private gameQuestionRepository: GameQuestionRepository,
    private playerRepository: PlayerRepository,
  ) {}

  async execute(command: SubmitAnswerCommand): Promise<AnswerViewDto> {
    // Находим активную игру пользователя
    const game = await this.pairGameRepository.findActiveGameByUserId({
      userId: command.userId,
    });

    if (!game || !game.isActive()) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message:
          'Current user is not inside active pair or user is in active pair but has already answered to all questions',
        field: 'Game',
      });
    }

    // Загружаем игрока
    const player = await this.playerRepository.findByGameAndUser({
      gameId: game.id,
      userId: command.userId,
    });

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Player not found',
        field: 'Player',
      });
    }

    // Проверяем, сколько ответов уже дал игрок
    const answersCount = await this.gameAnswerRepository.countByPlayerId(
      player.id,
    );

    if (answersCount >= 5) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message:
          'Current user is not inside active pair or user is in active pair but has already answered to all questions',
        field: 'Game',
      });
    }

    // Находим следующий вопрос (по порядку)
    const gameQuestions = await this.gameQuestionRepository.findByGameId(
      game.id,
    );
    const nextQuestion = gameQuestions.find((gq) => gq.order === answersCount);

    if (!nextQuestion) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Next question not found',
        field: 'GameQuestion',
      });
    }

    // Проверяем, не ответил ли уже игрок на этот вопрос
    const existingAnswer =
      await this.gameAnswerRepository.findByGameQuestionAndPlayer({
        gameQuestionId: nextQuestion.id,
        playerId: player.id,
      });

    if (existingAnswer) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Answer already submitted for this question',
        field: 'GameAnswer',
      });
    }

    // Проверяем правильность ответа
    const isCorrect = nextQuestion.question.isAnswerCorrect(command.dto.answer);

    // Создаем ответ
    const answer = GameAnswer.create({
      gameQuestionId: nextQuestion.id,
      playerId: player.id,
      answer: command.dto.answer,
      isCorrect: isCorrect,
    });

    // Сохраняем ответ
    await this.gameAnswerRepository.save(answer);

    // Если ответ правильный, увеличиваем счет
    if (isCorrect) {
      player.incrementScore();
    }

    // Если это последний вопрос (5-й), устанавливаем время завершения
    if (nextQuestion.isLast()) {
      player.setFinishedAt(new Date());
    }

    // Сохраняем игрока
    const savedPlayer = await this.playerRepository.save(player);

    // Загружаем полные данные ответа для возврата с relations
    const fullAnswer =
      await this.gameAnswerRepository.findByGameQuestionAndPlayer({
        gameQuestionId: nextQuestion.id,
        playerId: savedPlayer.id,
      });

    if (!fullAnswer) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'Failed to load answer after submission',
        field: 'GameAnswer',
      });
    }

    // Проверяем, нужно ли завершить игру (оба игрока ответили на все вопросы)
    // Перезагружаем игроков, чтобы получить актуальные данные
    const allPlayers = await this.playerRepository.findByGameId({
      gameId: game.id,
    });

    const allPlayersFinished = allPlayers.every((p) => p.hasFinished());

    if (allPlayersFinished) {
      // Вычисляем бонусы
      const firstPlayer = allPlayers.find((p) => p.isFirstPlayer());
      const secondPlayer = allPlayers.find((p) => p.isSecondPlayer());

      if (firstPlayer && secondPlayer) {
        // Бонус получает тот, кто закончил быстрее И имеет хотя бы один правильный ответ
        if (
          firstPlayer.finishedAt &&
          secondPlayer.finishedAt &&
          firstPlayer.finishedAt < secondPlayer.finishedAt &&
          firstPlayer.score > 0
        ) {
          firstPlayer.setBonus(1);
        } else if (
          firstPlayer.finishedAt &&
          secondPlayer.finishedAt &&
          secondPlayer.finishedAt < firstPlayer.finishedAt &&
          secondPlayer.score > 0
        ) {
          secondPlayer.setBonus(1);
        }

        await this.playerRepository.saveMany([firstPlayer, secondPlayer]);
      }

      // Завершаем игру
      await this.pairGameRepository.finishGame(game);
    }

    return AnswerViewDto.mapToView(fullAnswer);
  }
}
