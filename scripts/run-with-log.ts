#!/usr/bin/env node
/**
 * Run a shell command with its output mirrored to both the console and a
 * timestamped log file under `output/execution-<timestamp>.log` in the
 * caller's cwd. Wired into the tenant template's `migrate` and
 * `migrate:content` scripts so `pnpm migrate` produces a shareable log
 * without losing real-time console feedback.
 *
 *   tsx ../../scripts/run-with-log.ts "pnpm run extract && pnpm run tags && ..."
 *
 * Exits with the child's exit code so the surrounding pnpm chain still
 * fails fast on stage errors.
 */
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const command = process.argv.slice(2).join(" ");
if (!command) {
  console.error("usage: run-with-log <command...>   (the command is passed to `sh -c`)");
  process.exit(2);
}

const outputDir = join(process.cwd(), "output");
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "_")
  .slice(0, 19);
const logPath = join(outputDir, `execution-${timestamp}.log`);
const stream = createWriteStream(logPath, { flags: "a" });

const banner = `[run-with-log] ${new Date().toISOString()} — logging to ${logPath}\n`;
process.stderr.write(banner);
stream.write(banner);
stream.write(`[run-with-log] $ ${command}\n`);

const child = spawn("sh", ["-c", command], {
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (chunk: Buffer) => {
  process.stdout.write(chunk);
  stream.write(chunk);
});
child.stderr.on("data", (chunk: Buffer) => {
  process.stderr.write(chunk);
  stream.write(chunk);
});

child.on("exit", (code, signal) => {
  const exitLine = `[run-with-log] ${new Date().toISOString()} — exit ${code ?? `signal ${signal}`}\n`;
  process.stderr.write(exitLine);
  stream.write(exitLine);
  stream.end(() => process.exit(code ?? (signal ? 1 : 0)));
});
