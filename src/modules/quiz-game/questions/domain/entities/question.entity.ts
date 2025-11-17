import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CreateQuestionDomainDto } from '../dto/create-question.domain.dto';
import { UpdateQuestionDomainDto } from '../dto/update-question.domain.dto';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'simple-array', name: 'correct_answers' })
  correctAnswers: string[];

  @Column({ default: false })
  published: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
  })
  updatedAt: Date;

  /**
   * Статический метод для создания нового вопроса
   */
  static create(dto: CreateQuestionDomainDto): Question {
    const question = new Question();
    question.body = dto.body;
    question.correctAnswers = dto.correctAnswers;
    question.published = false;
    // createdAt и updatedAt установятся автоматически через @CreateDateColumn и @UpdateDateColumn

    return question;
  }

  /**
   * Опубликовать вопрос
   */
  publish(): void {
    this.published = true;
    // updatedAt обновится автоматически через @UpdateDateColumn
  }

  /**
   * Снять вопрос с публикации
   */
  unpublish(): void {
    this.published = false;
    // updatedAt обновится автоматически через @UpdateDateColumn
  }

  /**
   * Обновить вопрос
   */
  update(dto: UpdateQuestionDomainDto): void {
    if (dto.body !== undefined) {
      this.body = dto.body;
    }
    if (dto.correctAnswers !== undefined) {
      this.correctAnswers = dto.correctAnswers;
    }
    // updatedAt обновится автоматически через @UpdateDateColumn
  }

  /**
   * Проверить, является ли ответ правильным
   */
  isAnswerCorrect(answer: string): boolean {
    return this.correctAnswers.some(
      (correct) => correct.toLowerCase().trim() === answer.toLowerCase().trim(),
    );
  }
}
