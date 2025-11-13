export class FindGameByIdDto {
  id: string;
}

export class FindActiveGameByUserIdDto {
  userId: string;
}

export class FindWaitingGameDto {
  excludeUserId: string;
}
