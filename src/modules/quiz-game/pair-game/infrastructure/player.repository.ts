import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../domain/entities/player.entity';
import {
  FindPlayerByGameAndUserDto,
  FindPlayersByGameIdDto,
} from './dto/player-repo.dto';

@Injectable()
export class PlayerRepository {
  constructor(
    @InjectRepository(Player)
    private readonly repository: Repository<Player>,
  ) {}

  async findByGameAndUser(
    dto: FindPlayerByGameAndUserDto,
    loadAnswers: boolean = false,
  ): Promise<Player | null> {
    return await this.repository.findOne({
      where: {
        gameId: dto.gameId,
        userId: dto.userId,
      },
      relations: loadAnswers ? ['answers'] : [],
    });
  }

  async findByGameId(dto: FindPlayersByGameIdDto): Promise<Player[]> {
    return await this.repository.find({
      where: { gameId: dto.gameId },
      relations: ['user', 'answers'],
      order: {
        role: 'ASC',
      },
    });
  }

  async save(player: Player): Promise<Player> {
    return await this.repository.save(player);
  }

  async saveMany(players: Player[]): Promise<Player[]> {
    return await this.repository.save(players);
  }
}
