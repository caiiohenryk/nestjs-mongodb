import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import type { PageResponse } from '../common/pagination/page.response.js';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import type { OrderResponse } from './dto/order.response.js';
import { QueryOrderDto } from './dto/query-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto): Promise<OrderResponse> {
    return this.ordersService.create(dto);
  }

  @Get()
  findPage(@Query() query: QueryOrderDto): Promise<PageResponse<OrderResponse>> {
    return this.ordersService.findPage(query);
  }

  @Get(':id')
  findById(@Param('id', ObjectIdPipe) id: string): Promise<OrderResponse> {
    return this.ordersService.findById(id);
  }

  @Patch(':id')
  update(@Param('id', ObjectIdPipe) id: string, @Body() dto: UpdateOrderDto): Promise<OrderResponse> {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ObjectIdPipe) id: string): Promise<void> {
    return this.ordersService.remove(id);
  }
}
