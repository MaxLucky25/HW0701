import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../../domain/entities/question.entity';
import { QuestionViewDto } from '../../api/view-dto/question.view-dto';
import { FindQuestionByIdDto } from '../dto/questions-repo.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GetQuestionsQueryParams } from '../../api/input-dto/get-questions-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/base.paginated.view-dto';
import { PublishedStatuses } from '../../api/input-dto/published-statuses.enum';

@Injectable()
export class QuestionsQueryRepository {
  constructor(
    @InjectRepository(Question)
    private readonly repository: Repository<Question>,
  ) {}

  async getByIdOrNotFoundFail(
    dto: FindQuestionByIdDto,
  ): Promise<QuestionViewDto> {
    const question = await this.repository.findOne({
      where: { id: dto.id },
    });

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Question not found!',
        field: 'Question',
      });
    }

    return QuestionViewDto.mapToView(question);
  }

  async getAll(
    query: GetQuestionsQueryParams,
  ): Promise<PaginatedViewDto<QuestionViewDto[]>> {
    const queryBuilder = this.repository.createQueryBuilder('question');

    const conditions: string[] = [];
    const params: Record<string, any> = {};

    // Фильтр по publishedStatus
    if (query.publishedStatus === PublishedStatuses.PUBLISHED) {
      conditions.push('question.published = :published');
      params.published = true;
    } else if (query.publishedStatus === PublishedStatuses.NOT_PUBLISHED) {
      conditions.push('question.published = :published');
      params.published = false;
    }
    // Если 'all' - не добавляем условие

    // Поиск по bodySearchTerm
    if (query.bodySearchTerm) {
      conditions.push('question.body ILIKE :bodySearchTerm');
      params.bodySearchTerm = `%${query.bodySearchTerm}%`;
    }

    // Применяем условия
    if (conditions.length > 0) {
      queryBuilder.where(conditions.join(' AND '), params);
    }

    // Сортировка
    const orderBy = query.sortBy;
    const direction = query.sortDirection.toUpperCase() as 'ASC' | 'DESC';
    queryBuilder.orderBy(`question.${orderBy}`, direction);

    // Пагинация
    const limit = query.pageSize;
    const offset = query.calculateSkip();
    queryBuilder.limit(limit).offset(offset);

    // Получаем данные и общее количество
    const [questions, totalCount] = await queryBuilder.getManyAndCount();

    const items = questions.map((question) =>
      QuestionViewDto.mapToView(question),
    );

    return PaginatedViewDto.mapToView({
      items,
      totalCount,
      page: query.pageNumber,
      size: query.pageSize,
    });
  }
}
