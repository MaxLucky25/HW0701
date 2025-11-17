import {
  BaseQueryParams,
  SortDirection,
} from '../../../../../core/dto/base.query-params.input-dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PublishedStatuses } from './published-statuses.enum';

export enum QuestionsSortBy {
  CreatedAt = 'createdAt',
}

export class GetQuestionsQueryParams extends BaseQueryParams {
  @IsEnum(QuestionsSortBy)
  sortBy: QuestionsSortBy = QuestionsSortBy.CreatedAt;

  sortDirection: SortDirection = SortDirection.Desc;

  @IsString()
  @IsOptional()
  bodySearchTerm: string | null = null;

  @IsEnum(PublishedStatuses)
  @IsOptional()
  publishedStatus: PublishedStatuses = PublishedStatuses.ALL;
}
