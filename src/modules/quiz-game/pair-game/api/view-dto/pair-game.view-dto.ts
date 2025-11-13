import { PairGame } from '../../domain/entities/pair-game.entity';
import { PlayerProgressViewDto } from './player-progress.view-dto';
import { GameStatus } from '../../domain/dto/game-status.enum';
import { PlayerRole } from '../../domain/dto/player-role.enum';

export class PairGameViewDto {
  id: string;
  firstPlayerProgress: PlayerProgressViewDto;
  secondPlayerProgress: PlayerProgressViewDto | null;
  questions: Array<{ id: string; body: string }> | null;
  status: GameStatus;
  pairCreatedDate: string;
  startGameDate: string | null;
  finishGameDate: string | null;

  static mapToView(game: PairGame): PairGameViewDto {
    const firstPlayer = game.players?.find(
      (p) => p.role === PlayerRole.FIRST_PLAYER,
    );
    const secondPlayer = game.players?.find(
      (p) => p.role === PlayerRole.SECOND_PLAYER,
    );

    // Если статус PendingSecondPlayer - не возвращаем questions и secondPlayerProgress
    const shouldHideQuestions =
      game.status === GameStatus.PENDING_SECOND_PLAYER;

    return {
      id: game.id,
      firstPlayerProgress: firstPlayer
        ? PlayerProgressViewDto.mapToView(firstPlayer)
        : {
            answers: [],
            player: { id: '', login: '' },
            score: 0,
          },
      secondPlayerProgress: shouldHideQuestions
        ? null
        : secondPlayer
          ? PlayerProgressViewDto.mapToView(secondPlayer)
          : null,
      questions: shouldHideQuestions
        ? null
        : game.questions
          ? game.questions
              .sort((a, b) => a.order - b.order)
              .map((gq) => ({
                id: gq.question.id,
                body: gq.question.body,
              }))
          : null,
      status: game.status,
      pairCreatedDate: game.createdAt.toISOString(),
      startGameDate: game.startGameDate
        ? game.startGameDate.toISOString()
        : null,
      finishGameDate: game.finishGameDate
        ? game.finishGameDate.toISOString()
        : null,
    };
  }
}
