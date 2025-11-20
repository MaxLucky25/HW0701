import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { PairGame } from '../entities/pair-game.entity';
import { GameAnswer } from '../entities/game-answer.entity';
import { GAME_CONSTANTS } from '../dto/game.constants';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PlayerRepository } from '../../infrastructure/player.repository';
import { GameAnswerRepository } from '../../infrastructure/game-answer.repository';
import { GameQuestionRepository } from '../../infrastructure/game-question.repository';
import { PairGameRepository } from '../../infrastructure/pair-game.repository';

@Injectable()
export class AnswerSubmissionService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly pairGameRepository: PairGameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly gameAnswerRepository: GameAnswerRepository,
    private readonly gameQuestionRepository: GameQuestionRepository,
  ) {}

  async submitAnswer(userId: string, answer: string): Promise<GameAnswer> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Найти активную игру
      const game = await this.pairGameRepository.findActiveGameByUserId(
        { userId },
        manager,
      );

      if (!game) {
        throw new DomainException({
          code: DomainExceptionCode.Forbidden,
          message:
            'Current user is not inside active pair or user is in active pair but has already answered to all questions',
          field: 'Game',
        });
      }

      // 2. Найти игрока
      const player = await this.playerRepository.findPlayerOrNotFoundFail(
        { gameId: game.id, userId },
        manager,
      );

      // 3. Подсчитать ответы игрока
      const answersCount = await this.gameAnswerRepository.countAnswers(
        { playerId: player.id },
        manager,
      );

      // 4. Проверить лимит ответов
      if (answersCount >= GAME_CONSTANTS.QUESTIONS_PER_GAME) {
        throw new DomainException({
          code: DomainExceptionCode.Forbidden,
          message:
            'Current user is not inside active pair or user is in active pair but has already answered to all questions',
          field: 'Game',
        });
      }

      // 5. Найти следующий вопрос
      const nextQuestion =
        await this.gameQuestionRepository.findNextQuestionOrNotFoundFail(
          { gameId: game.id, order: answersCount },
          manager,
        );

      // 6. Проверить существующий ответ
      const existingAnswer = await this.gameAnswerRepository.findAnswer(
        { gameQuestionId: nextQuestion.id, playerId: player.id },
        manager,
      );

      if (existingAnswer) {
        throw new DomainException({
          code: DomainExceptionCode.BadRequest,
          message: 'Answer already submitted for this question',
          field: 'GameAnswer',
        });
      }

      // 7. Проверить правильность ответа
      const isCorrect = nextQuestion.question.isAnswerCorrect(answer);

      // 8. Создать и сохранить ответ
      const answerEntity = GameAnswer.create({
        gameQuestionId: nextQuestion.id,
        playerId: player.id,
        answer: answer,
        isCorrect: isCorrect,
      });

      const savedAnswer = await manager.save(GameAnswer, answerEntity);

      // 9. Обновить счет игрока
      await this.playerRepository.updatePlayerScore(
        player,
        isCorrect,
        nextQuestion.isLast(),
        manager,
      );

      // 10. Проверить и завершить игру если нужно
      await this.checkAndFinishGame(game, manager);

      // 11. Использовать сохраненный объект
      savedAnswer.gameQuestion = nextQuestion;
      return savedAnswer;
    });
  }

  private async checkAndFinishGame(
    game: PairGame,
    manager: EntityManager,
  ): Promise<void> {
    // Загружаем всех игроков игры для проверки завершения
    const allPlayers = await this.playerRepository.findAllByGameId(
      { gameId: game.id },
      manager,
    );

    const allPlayersFinished = allPlayers.every((p) => p.hasFinished());

    if (allPlayersFinished) {
      // Вычисляем бонусы
      const firstPlayer = allPlayers.find((p) => p.isFirstPlayer());
      const secondPlayer = allPlayers.find((p) => p.isSecondPlayer());

      if (firstPlayer && secondPlayer) {
        // Бонус получает тот, кто закончил быстрее И имеет хотя бы один правильный ответ
        if (firstPlayer.finishedAt && secondPlayer.finishedAt) {
          const fasterPlayer =
            firstPlayer.finishedAt < secondPlayer.finishedAt
              ? firstPlayer
              : secondPlayer;

          if (fasterPlayer.score > 0) {
            fasterPlayer.awardBonus();
          }
        }

        // Сохраняем игроков
        await this.playerRepository.savePlayers(
          [firstPlayer, secondPlayer],
          manager,
        );
      }

      // Завершаем игру
      await this.pairGameRepository.finishGame(game, manager);
    }
  }
}
