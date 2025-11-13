import { Player } from '../../domain/entities/player.entity';
import { AnswerViewDto } from './answer.view-dto';

export class PlayerProgressViewDto {
  answers: AnswerViewDto[];
  player: {
    id: string;
    login: string;
  };
  score: number;

  static mapToView(player: Player): PlayerProgressViewDto {
    if (!player.user) {
      throw new Error('User is not loaded for Player');
    }
    return {
      answers: player.answers
        ? player.answers.map((answer) => AnswerViewDto.mapToView(answer))
        : [],
      player: {
        id: player.user.id,
        login: player.user.login,
      },
      score: player.score,
    };
  }
}
