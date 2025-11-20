import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { GameAnswer } from '../domain/entities/game-answer.entity';
import {
  FindAnswerByGameQuestionAndPlayerDto,
  CountAnswersByPlayerIdDto,
} from './dto/game-answer-repo.dto';

@Injectable()
export class GameAnswerRepository {
  constructor(
    @InjectRepository(GameAnswer)
    private readonly repository: Repository<GameAnswer>,
  ) {}

  async countAnswers(
    dto: CountAnswersByPlayerIdDto,
    manager: EntityManager,
  ): Promise<number> {
    return await manager.count(GameAnswer, {
      where: { playerId: dto.playerId },
    });
  }

  async findAnswer(
    dto: FindAnswerByGameQuestionAndPlayerDto,
    manager: EntityManager,
  ): Promise<GameAnswer | null> {
    return await manager.findOne(GameAnswer, {
      where: {
        gameQuestionId: dto.gameQuestionId,
        playerId: dto.playerId,
      },
    });
  }
}
