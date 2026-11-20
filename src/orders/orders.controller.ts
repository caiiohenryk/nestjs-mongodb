import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPreconditionFailedResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { RequestHeader } from '../common/decorators/request-header.decorator.js';
import { ErrorResponse } from '../common/filters/error.response.js';
import type { PageResponse } from '../common/pagination/page.response.js';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { DailyRevenueResponse } from './dto/daily-revenue.response.js';
import { OrderPageResponse, OrderResponse } from './dto/order.response.js';
import { QueryDailyRevenueDto } from './dto/query-daily-revenue.dto.js';
import { QueryOrderDto } from './dto/query-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { IdempotencyKeyPipe } from './idempotency-key.pipe.js';
import { OrderEtagInterceptor } from './order-etag.interceptor.js';
import { IfMatchPipe } from './order-version.js';
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
    @RequestHeader('idempotency-key', IdempotencyKeyPipe) idempotencyKey: string | undefined,
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
  @UseInterceptors(OrderEtagInterceptor)
  @ApiOkResponse({ type: OrderResponse, headers: { ETag: { description: 'Version to send back in If-Match' } } })
  @ApiNotFoundResponse({ type: ErrorResponse })
  findById(@Param('id', ObjectIdPipe) id: string): Promise<OrderResponse> {
    return this.ordersQueryService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(OrderEtagInterceptor)
  @ApiHeader({ name: 'If-Match', required: false, description: 'ETag from GET; the update fails with 412 if stale' })
  @ApiOkResponse({ type: OrderResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiPreconditionFailedResponse({ type: ErrorResponse, description: 'Order changed since the given ETag' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: 'Status transition not allowed' })
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: UpdateOrderDto,
    @RequestHeader('if-match', IfMatchPipe) expectedUpdatedAt: Date | undefined,
  ): Promise<OrderResponse> {
    return this.ordersService.update({ id, dto, expectedUpdatedAt });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  remove(@Param('id', ObjectIdPipe) id: string): Promise<void> {
    return this.ordersService.remove(id);
  }
}
