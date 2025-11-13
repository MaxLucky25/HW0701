import { GameAnswer } from '../../domain/entities/game-answer.entity';

export class AnswerViewDto {
  questionId: string;
  answerStatus: 'Correct' | 'Incorrect';
  addedAt: string;

  static mapToView(answer: GameAnswer): AnswerViewDto {
    if (!answer.gameQuestion) {
      throw new Error('GameQuestion is not loaded for GameAnswer');
    }
    return {
      questionId: answer.gameQuestion.questionId,
      answerStatus: answer.isCorrect ? 'Correct' : 'Incorrect',
      addedAt: answer.addedAt.toISOString(),
    };
  }
}
