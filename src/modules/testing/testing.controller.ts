import { Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { TestingService } from './testing.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('testing')
@Controller('testing')
export class TestingController {
  constructor(private readonly testingService: TestingService) {}

  @Delete('all-data')
  @ApiOperation({ summary: 'Delete all data (test endpoint)' })
  @ApiParam({ name: 'all-data', description: 'Delete all data' })
  @ApiResponse({ status: 204, description: 'All data deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAll() {
    await this.testingService.clearAllTables();
  }
}
