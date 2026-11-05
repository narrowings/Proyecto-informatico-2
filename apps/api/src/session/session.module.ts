import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AccessTokenMiddleware } from './access-token.middleware';
import { AccessTokenService } from './access-token.service';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  controllers: [SessionController],
  providers: [SessionService, AccessTokenService, AccessTokenMiddleware],
  exports: [AccessTokenService],
})
export class SessionModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AccessTokenMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}