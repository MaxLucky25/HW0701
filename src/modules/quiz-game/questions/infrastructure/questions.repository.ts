import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../domain/entities/question.entity';
import { CreateQuestionDomainDto } from '../domain/dto/create-question.domain.dto';
import { UpdateQuestionDomainDto } from '../domain/dto/update-question.domain.dto';
import {
  FindQuestionByIdDto,
  FindRandomQuestionsDto,
} from './dto/questions-repo.dto';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class QuestionsRepository {
  constructor(
    @InjectRepository(Question)
    private readonly repository: Repository<Question>,
  ) {}

  async findById(dto: FindQuestionByIdDto): Promise<Question | null> {
    return await this.repository.findOne({
      where: { id: dto.id },
    });
  }

  async findByIdOrNotFoundFail(dto: FindQuestionByIdDto): Promise<Question> {
    const question = await this.findById(dto);

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Question not found!',
        field: 'Question',
      });
    }

    return question;
  }

  async findRandomQuestions(dto: FindRandomQuestionsDto): Promise<Question[]> {
    // Получаем все опубликованные вопросы
    const allQuestions = await this.repository.find({
      where: { published: true },
    });

    // Перемешиваем массив и берем нужное количество
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, dto.count);
  }

  async findAllPublished(): Promise<Question[]> {
    return await this.repository.find({
      where: { published: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createQuestion(dto: CreateQuestionDomainDto): Promise<Question> {
    const question = Question.create(dto);
    return await this.repository.save(question);
  }

  async updateQuestion(
    entity: Question,
    dto: UpdateQuestionDomainDto,
  ): Promise<Question> {
    entity.update(dto);
    return await this.repository.save(entity);
  }

  async publishQuestion(entity: Question): Promise<Question> {
    entity.publish();
    return await this.repository.save(entity);
  }

  async unpublishQuestion(entity: Question): Promise<Question> {
    entity.unpublish();
    return await this.repository.save(entity);
  }

  async deleteQuestion(entity: Question): Promise<void> {
    await this.repository.remove(entity);
  }
}
