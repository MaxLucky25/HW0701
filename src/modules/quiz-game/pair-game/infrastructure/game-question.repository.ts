import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { GameQuestion } from '../domain/entities/game-question.entity';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { FindNextQuestionByGameAndOrderDto } from './dto/game-question-repo.dto';

@Injectable()
export class GameQuestionRepository {
  constructor(
    @InjectRepository(GameQuestion)
    private readonly repository: Repository<GameQuestion>,
  ) {}

  // ==================== ANSWER SUBMISSION METHODS ====================

  /**
   * Найти следующий вопрос игры по порядку или выбросить исключение
   *
   * @usedIn AnswerSubmissionService.submitAnswer - поиск следующего вопроса для ответа
   */
  async findNextQuestionOrNotFoundFail(
    dto: FindNextQuestionByGameAndOrderDto,
    manager: EntityManager,
  ): Promise<GameQuestion> {
    const nextQuestion = await manager.findOne(GameQuestion, {
      where: { gameId: dto.gameId, order: dto.order },
      relations: ['question'],
    });

    if (!nextQuestion) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Next question not found',
        field: 'GameQuestion',
      });
    }

    return nextQuestion;
  }

  // ==================== MATCHMAKING METHODS ====================

  /**
   * Создает и сохраняет вопросы для игры
   *
   * @usedIn MatchmakingService.joinGameToWaitingPlayer - создание вопросов при старте игры
   */
  async createGameQuestions(
    gameId: string,
    questions: Array<{ id: string }>,
    manager: EntityManager,
  ): Promise<void> {
    const gameQuestions = questions.map((question, index) =>
      GameQuestion.create({
        gameId,
        questionId: question.id,
        order: index,
      }),
    );
    await manager.save(GameQuestion, gameQuestions);
  }
}
