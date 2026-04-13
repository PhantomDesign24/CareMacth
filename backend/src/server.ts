import app, { prisma } from './app';
import { setupCronJobs } from './services/cronJobs';

const PORT = process.env.PORT || 4000;

// Start server
app.listen(PORT, () => {
  console.log(`CareMatch API Server running on port ${PORT}`);
  setupCronJobs();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };
export default app;
