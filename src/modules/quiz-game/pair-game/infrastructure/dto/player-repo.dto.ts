export class FindPlayerByIdDto {
  id: string;
}

export class FindPlayerByGameAndUserDto {
  gameId: string;
  userId: string;
}

export class FindPlayersByGameIdDto {
  gameId: string;
}

export class CountAnswersByPlayerIdDto {
  playerId: string;
}
