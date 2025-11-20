import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Player } from '../domain/entities/player.entity';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
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

  async findPlayerOrNotFoundFail(
    dto: FindPlayerByGameAndUserDto,
    manager: EntityManager,
  ): Promise<Player> {
    const player = await manager
      .createQueryBuilder(Player, 'player')
      .where('player.gameId = :gameId', { gameId: dto.gameId })
      .andWhere('player.userId = :userId', { userId: dto.userId })
      .setLock('pessimistic_write')
      .getOne();

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Player not found',
        field: 'Player',
      });
    }

    return player;
  }

  async updatePlayerScore(
    player: Player,
    isCorrect: boolean,
    isLastQuestion: boolean,
    manager: EntityManager,
  ): Promise<void> {
    if (isCorrect) {
      player.incrementScore();
    }

    if (isLastQuestion) {
      player.finish();
    }

    await manager.save(Player, player);
  }

  async findAllByGameId(
    dto: FindPlayersByGameIdDto,
    manager: EntityManager,
  ): Promise<Player[]> {
    return await manager.find(Player, {
      where: { gameId: dto.gameId },
    });
  }

  async savePlayers(players: Player[], manager: EntityManager): Promise<void> {
    await manager.save(Player, players);
  }
}
