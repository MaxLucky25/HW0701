export class FindQuestionByIdDto {
  id: string;
}

export class FindRandomQuestionsDto {
  count: number;
}

export class FindQuestionsByPublishedStatusDto {
  publishedStatus: 'all' | 'published' | 'notPublished';
}
