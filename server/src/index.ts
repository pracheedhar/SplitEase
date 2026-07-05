import './utils/env.js';

import app from './app.js';
import { logger } from './utils/logger.js';
import { connectDB } from './utils/database.js';
import { startRecurringExpensesJob } from './services/RecurringJobService.js';

const port = process.env.PORT || 5001;
const nodeEnv = process.env.NODE_ENV || 'development';

const startServer = async () => {
  // Connect to MongoDB before starting HTTP server
  await connectDB();
  startRecurringExpensesJob();

  const server = app.listen(port, () => {
    logger.info(`Server is running in ${nodeEnv} mode on port ${port}`);
  });

  // Graceful Shutdown/Error handling
  process.on('uncaughtException', (err) => {
    logger.error(
      `UNCAUGHT EXCEPTION! Shutting down...\nError: ${err.message}\nStack: ${err.stack}`
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (err: any) => {
    logger.error(
      `UNHANDLED REJECTION! Shutting down...\nError: ${err?.message || err}\nStack: ${err?.stack}`
    );
    server.close(() => {
      process.exit(1);
    });
  });
};

startServer();
