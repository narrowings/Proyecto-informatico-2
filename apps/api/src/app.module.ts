import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { rateLimitOptions } from './common/http/rate-limit';
import { ApplicationsModule } from './applications/applications.module';
import { AuditModule } from './audit/audit.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { EngagementsModule } from './engagements/engagements.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { PasswordResetModule } from './identity/password-reset.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RatingsModule } from './ratings/ratings.module';
import { ProfilesModule } from './profiles/profiles.module';
import { SessionModule } from './session/session.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot(rateLimitOptions),
    PrismaModule,
    AuditModule,
    HealthModule,
    CatalogsModule,
    SessionModule,
    IdentityModule,
    ProfilesModule,
    OpportunitiesModule,
    ApplicationsModule,
    EngagementsModule,
    RatingsModule,
    NotificationsModule,
    PasswordResetModule,
  ],
})
export class AppModule {}
