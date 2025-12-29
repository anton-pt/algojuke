/**
 * Inngest Function Registry
 *
 * Central export point for all Inngest functions. Functions added here are
 * automatically registered with the Inngest server when the worker service starts.
 *
 * Usage:
 * 1. Define your function in a separate file (e.g., demoTask.ts)
 * 2. Import and add to the functions array below
 * 3. Function will be automatically discovered by Inngest
 */

import { demoTask } from "./demoTask.js";
import { trackIngestion } from "./trackIngestion.js";

/**
 * Array of all Inngest functions to be served by this worker
 *
 * Currently registered functions:
 * - demoTask: Infrastructure validation demo task with 5-step workflow
 * - trackIngestion: Track ingestion pipeline (feature 006)
 */
export const functions = [demoTask, trackIngestion];
