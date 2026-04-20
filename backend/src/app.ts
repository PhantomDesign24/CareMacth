import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import hpp from 'hpp';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import guardianRoutes from './routes/guardian';
import caregiverRoutes from './routes/caregiver';
import careRequestRoutes from './routes/careRequest';
import matchingRoutes from './routes/matching';
import contractRoutes from './routes/contract';
import paymentRoutes from './routes/payment';
import careRecordRoutes from './routes/careRecord';
import reviewRoutes from './routes/review';
import reportRoutes from './routes/report';
import adminRoutes from './routes/admin';
import educationRoutes from './routes/education';
import notificationRoutes from './routes/notification';
import insuranceRoutes from './routes/insurance';
import disputeRoutes from './routes/dispute';
import { errorHandler } from './middlewares/errorHandler';
import { generalLimiter } from './middlewares/rateLimiter';
import { sanitizeInput } from './middlewares/sanitize';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// ===========================================
// 보안 미들웨어
// ===========================================

// Apache 리버스 프록시 뒤에서 동작하므로 trust proxy 설정
app.set('trust proxy', 1);

// Helmet: 보안 HTTP 헤더 설정
// 응답 압축 (gzip)
app.use(compression());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://cm.phantomdesign.kr'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: [
    'https://cm.phantomdesign.kr',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// HPP: HTTP Parameter Pollution 방어
app.use(hpp());

// 요청 본문 크기 제한
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 입력 값 sanitize (XSS 방어)
app.use(sanitizeInput);

// 전체 API Rate Limiting (테스트 환경 제외)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', generalLimiter);
  app.use(morgan('combined'));
}

// 정적 파일 (업로드) - 인증 불필요하지만 디렉토리 트래버설 방어
app.use('/uploads', express.static('uploads', {
  dotfiles: 'deny',
  index: false,
}));

// ===========================================
// 라우트
// ===========================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 공개: 상담사 연결용 회사 대표번호 + 영업일 여부
import { isNonBusinessDay } from './services/cronJobs';
app.get('/api/public/contact', async (_req, res, next) => {
  try {
    const cfg = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
    res.json({
      success: true,
      data: {
        companyPhone: cfg?.companyPhone || null,
        isNonBusinessDay: isNonBusinessDay(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/caregiver', caregiverRoutes);
app.use('/api/care-requests', careRequestRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/care-records', careRecordRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/disputes', disputeRoutes);

// Error handler
app.use(errorHandler);

export { prisma };
export default app;
