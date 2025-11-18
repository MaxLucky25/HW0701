import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameQuestion } from '../domain/entities/game-question.entity';

@Injectable()
export class GameQuestionRepository {
  constructor(
    @InjectRepository(GameQuestion)
    private readonly repository: Repository<GameQuestion>,
  ) {}

  async findByGameId(gameId: string): Promise<GameQuestion[]> {
    return await this.repository.find({
      where: { gameId },
      relations: ['question', 'answers'],
      order: {
        order: 'ASC',
      },
    });
  }
}
