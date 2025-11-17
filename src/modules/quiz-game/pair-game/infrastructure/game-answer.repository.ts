import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameAnswer } from '../domain/entities/game-answer.entity';
import {
  FindAnswerByGameQuestionAndPlayerDto,
  FindAnswersByPlayerIdDto,
  FindAnswersByGameQuestionIdDto,
} from './dto/game-answer-repo.dto';

@Injectable()
export class GameAnswerRepository {
  constructor(
    @InjectRepository(GameAnswer)
    private readonly repository: Repository<GameAnswer>,
  ) {}

  async findByGameQuestionAndPlayer(
    dto: FindAnswerByGameQuestionAndPlayerDto,
  ): Promise<GameAnswer | null> {
    return await this.repository.findOne({
      where: {
        gameQuestionId: dto.gameQuestionId,
        playerId: dto.playerId,
      },
      relations: ['gameQuestion', 'gameQuestion.question'],
    });
  }

  async findByPlayerId(dto: FindAnswersByPlayerIdDto): Promise<GameAnswer[]> {
    return await this.repository.find({
      where: { playerId: dto.playerId },
      relations: ['gameQuestion', 'gameQuestion.question'],
      order: {
        addedAt: 'ASC',
      },
    });
  }

  async findByGameQuestionId(
    dto: FindAnswersByGameQuestionIdDto,
  ): Promise<GameAnswer[]> {
    return await this.repository.find({
      where: { gameQuestionId: dto.gameQuestionId },
      relations: ['player'],
    });
  }

  async countByPlayerId(playerId: string): Promise<number> {
    return await this.repository.count({
      where: { playerId },
    });
  }

  async save(answer: GameAnswer): Promise<GameAnswer> {
    return await this.repository.save(answer);
  }
}
