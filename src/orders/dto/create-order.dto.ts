import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_ORDER_ITEMS } from '../schemas/order.schema.js';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  unitPriceCents: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName: string;

  @IsEmail()
  @MaxLength(254)
  customerEmail: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
