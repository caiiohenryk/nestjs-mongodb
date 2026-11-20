import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponse {
  @ApiProperty({ example: 404 })
  readonly statusCode: number;

  @ApiProperty({ example: 'NOT_FOUND' })
  readonly error: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Order 6b00be361d93441c0ebd7935 not found',
  })
  readonly message: string | string[];

  @ApiProperty({ example: '/orders/6b00be361d93441c0ebd7935' })
  readonly path: string;

  @ApiProperty({ format: 'date-time' })
  readonly timestamp: string;
}
