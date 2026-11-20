import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'KB-01', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku: string;

  @ApiProperty({ example: 'Keyboard', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @ApiProperty({ example: 25990, minimum: 0, maximum: 100_000_000, description: 'Price in cents' })
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  unitPriceCents: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Ana', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName: string;

  @ApiProperty({ example: 'ana@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  customerEmail: string;

  @ApiProperty({ type: [CreateOrderItemDto], minItems: 1, maxItems: MAX_ORDER_ITEMS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
