import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ErrorResponse } from '../common/filters/error.response.js';
import type { PageResponse } from '../common/pagination/page.response.js';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { DailyRevenueResponse } from './dto/daily-revenue.response.js';
import { OrderPageResponse, OrderResponse } from './dto/order.response.js';
import { QueryDailyRevenueDto } from './dto/query-daily-revenue.dto.js';
import { QueryOrderDto } from './dto/query-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { IdempotencyKey } from './idempotency-key.decorator.js';
import { IdempotencyKeyPipe } from './idempotency-key.pipe.js';
import { OrdersQueryService } from './orders-query.service.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiBadRequestResponse({ type: ErrorResponse, description: 'Invalid input' })
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersQueryService: OrdersQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Retrying with the same key returns the original order instead of creating another',
  })
  @ApiCreatedResponse({ type: OrderResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: 'Idempotency-Key reused with another body' })
  create(
    @Body() dto: CreateOrderDto,
    @IdempotencyKey(IdempotencyKeyPipe) idempotencyKey: string | undefined,
  ): Promise<OrderResponse> {
    return this.ordersService.create(dto, idempotencyKey);
  }

  @Get()
  @ApiOkResponse({ type: OrderPageResponse })
  findPage(@Query() query: QueryOrderDto): Promise<PageResponse<OrderResponse>> {
    return this.ordersQueryService.findPage(query);
  }

  @Get('reports/daily-revenue')
  @ApiOkResponse({ type: DailyRevenueResponse })
  dailyRevenue(@Query() query: QueryDailyRevenueDto): Promise<DailyRevenueResponse> {
    return this.ordersQueryService.dailyRevenue(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  findById(@Param('id', ObjectIdPipe) id: string): Promise<OrderResponse> {
    return this.ordersQueryService.findById(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: OrderResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: 'Status transition not allowed' })
  update(@Param('id', ObjectIdPipe) id: string, @Body() dto: UpdateOrderDto): Promise<OrderResponse> {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  remove(@Param('id', ObjectIdPipe) id: string): Promise<void> {
    return this.ordersService.remove(id);
  }
}
