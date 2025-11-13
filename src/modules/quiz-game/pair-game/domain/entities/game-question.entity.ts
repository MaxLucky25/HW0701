import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { PairGame } from './pair-game.entity';
import { Question } from '../../../questions/domain/entities/question.entity';
import { GameAnswer } from './game-answer.entity';

@Entity('game_questions')
@Index(['gameId', 'order'], { unique: true }) // порядок уникален в рамках игры
export class GameQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PairGame, (game) => game.questions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'game_id' })
  game: PairGame;

  @Column({ name: 'game_id' })
  gameId: string;

  @ManyToOne(() => Question, { nullable: false })
  @JoinColumn({ name: 'question_id' })
  question: Question;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ type: 'int' })
  order: number;

  @OneToMany(() => GameAnswer, (answer) => answer.gameQuestion)
  answers: GameAnswer[];

  /**
   * Статический метод для создания вопроса в игре
   */
  static create(
    gameId: string,
    questionId: string,
    order: number,
  ): GameQuestion {
    const gameQuestion = new GameQuestion();
    gameQuestion.gameId = gameId;
    gameQuestion.questionId = questionId;
    gameQuestion.order = order;

    return gameQuestion;
  }

  /**
   * Проверить, является ли это первым вопросом
   */
  isFirst(): boolean {
    return this.order === 0;
  }

  /**
   * Проверить, является ли это последним вопросом
   */
  isLast(): boolean {
    return this.order === 4;
  }
}
