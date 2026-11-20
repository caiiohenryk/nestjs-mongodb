import { Module } from '@nestjs/common';
import { MongooseModule, type MongooseModuleOptions } from '@nestjs/mongoose';
import { AppConfigService } from '../config/app-config.service.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): MongooseModuleOptions => ({
        uri: config.mongodbUri,
        autoIndex: !config.isProduction,
        autoCreate: !config.isProduction,
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
        serverSelectionTimeoutMS: 5000,
      }),
    }),
  ],
})
export class DatabaseModule {}
