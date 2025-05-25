// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 允许所有来源跨域（开发用，生产建议指定 origin）
  app.enableCors({
    origin: '*', // 或者 origin: 'http://localhost:5173'
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(3001);
}
bootstrap();
