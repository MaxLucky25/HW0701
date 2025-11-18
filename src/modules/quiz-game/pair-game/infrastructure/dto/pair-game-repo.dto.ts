export class FindActiveGameByUserIdDto {
  userId: string;
}

export class FindWaitingGameDto {
  excludeUserId: string;
}

export class GameIdResultDto {
  id: string;
}
