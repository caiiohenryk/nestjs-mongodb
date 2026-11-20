import { type BeforeApplicationShutdown, Injectable } from '@nestjs/common';

@Injectable()
export class ShutdownState implements BeforeApplicationShutdown {
  private shuttingDown = false;

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }
}
