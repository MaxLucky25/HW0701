import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { GameQuestion } from './game-question.entity';
import { Player } from './player.entity';

@Entity('game_answers')
@Index(['gameQuestionId', 'playerId'], { unique: true }) // один ответ игрока на конкретный вопрос
export class GameAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameQuestion, (gameQuestion) => gameQuestion.answers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'game_question_id' })
  gameQuestion: GameQuestion;

  @Column({ name: 'game_question_id' })
  gameQuestionId: string;

  @ManyToOne(() => Player, (player) => player.answers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'player_id' })
  playerId: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ name: 'is_correct' })
  isCorrect: boolean;

  @CreateDateColumn({
    name: 'added_at',
    type: 'timestamp',
  })
  addedAt: Date;

  /**
   * Статический метод для создания ответа игрока
   */
  static create(
    gameQuestionId: string,
    playerId: string,
    answer: string,
    isCorrect: boolean,
  ): GameAnswer {
    const gameAnswer = new GameAnswer();
    gameAnswer.gameQuestionId = gameQuestionId;
    gameAnswer.playerId = playerId;
    gameAnswer.answer = answer;
    gameAnswer.isCorrect = isCorrect;
    // addedAt установится автоматически через @CreateDateColumn

    return gameAnswer;
  }

  /**
   * Проверить, правильный ли ответ
   */
  isAnswerCorrect(): boolean {
    return this.isCorrect;
  }
}
