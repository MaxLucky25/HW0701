import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../domain/entities/player.entity';
import {
  FindPlayerByIdDto,
  FindPlayerByGameAndUserDto,
  FindPlayersByGameIdDto,
} from './dto/player-repo.dto';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class PlayerRepository {
  constructor(
    @InjectRepository(Player)
    private readonly repository: Repository<Player>,
  ) {}

  async findById(dto: FindPlayerByIdDto): Promise<Player | null> {
    return await this.repository.findOne({
      where: { id: dto.id },
      relations: ['answers'],
    });
  }

  async findByIdOrNotFoundFail(dto: FindPlayerByIdDto): Promise<Player> {
    const player = await this.findById(dto);

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Player not found!',
        field: 'Player',
      });
    }

    return player;
  }

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
