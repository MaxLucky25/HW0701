import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RefreshTokenAuthGuard } from '../../guards/bearer/refresh-token-auth.guard';
import { ExtractUserForRefreshTokenGuard } from '../../guards/decorators/param/extract-user-for-refresh-token-guard.decorator';
import { TokenContextDto } from '../../guards/dto/token-context.dto';
import { DeviceViewDto } from './view-dto/device.view-dto';
import { GetUserDevicesQuery } from '../application/query-usecase/get-user-devices.usecase';
import { DeleteDeviceCommand } from '../application/usecase/delete-device.usecase';
import { DeleteAllDevicesCommand } from '../application/usecase/delete-all-devices.usecase';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('security')
@SkipThrottle()
@UseGuards(RefreshTokenAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(
    private queryBus: QueryBus,
    private commandBus: CommandBus,
  ) {}

  @Get('devices')
  @ApiOperation({
    summary: 'Get list of active user devices',
    description:
      'Returns list of all active devices for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active devices',
    type: [DeviceViewDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserDevices(
    @ExtractUserForRefreshTokenGuard() user: TokenContextDto,
  ): Promise<DeviceViewDto[]> {
    return this.queryBus.execute(new GetUserDevicesQuery(user.userId));
  }

  @Delete('devices/:deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete specific device',
    description: 'Revokes session for the specified device',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID to delete' })
  @ApiResponse({ status: 204, description: 'Device deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - cannot delete device from another user',
  })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async deleteDevice(
    @Param('deviceId') deviceId: string,
    @ExtractUserForRefreshTokenGuard() user: TokenContextDto,
  ): Promise<void> {
    return this.commandBus.execute(
      new DeleteDeviceCommand(user.userId, deviceId),
    );
  }

  @Delete('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete all devices except current',
    description: 'Revokes all user sessions except the current one',
  })
  @ApiResponse({
    status: 204,
    description: 'All other devices deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAllDevices(
    @ExtractUserForRefreshTokenGuard() user: TokenContextDto,
  ): Promise<void> {
    return this.commandBus.execute(
      new DeleteAllDevicesCommand(user.userId, user.deviceId),
    );
  }
}
