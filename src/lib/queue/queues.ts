/**
 * BullMQ Queue Definitions
 *
 * Defines all job queues used by the application.
 */

import { Queue } from "bullmq";
import { redisConnection } from "../redis";

// Queue for fetching papers from arXiv
export const arxivFetchQueue = new Queue("arxiv-fetch", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
});

// Queue for generating AI summaries
export const summaryQueue = new Queue("summary-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10000, // Longer backoff for API calls
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Queue for discovering author social media profiles
export const socialDiscoveryQueue = new Queue("social-discovery", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Queue for monitoring social media mentions
export const socialMonitorQueue = new Queue("social-monitor", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Queue for fetching news mentions
export const newsFetchQueue = new Queue("news-fetch", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Queue for DTL-P paper analysis
export const analysisQueue = new Queue("paper-analysis", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 15000, // Longer backoff - analysis uses more tokens
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Export all queues for easy access
export const queues = {
  arxivFetch: arxivFetchQueue,
  summary: summaryQueue,
  socialDiscovery: socialDiscoveryQueue,
  socialMonitor: socialMonitorQueue,
  newsFetch: newsFetchQueue,
  analysis: analysisQueue,
};
