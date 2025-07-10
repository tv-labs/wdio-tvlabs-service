import type { LogLevel } from './types.js';
import chalk from 'chalk';

// TODO: Replace this with @wdio/logger
// It is currently not compatible with CJS

const LOG_LEVEL_COLORS: Record<LogLevel, typeof chalk> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyanBright,
  debug: chalk.green,
  trace: chalk.cyan,
  silent: chalk.gray,
};

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
  silent: 5,
};

export class Logger {
  constructor(
    private name: string,
    private logLevel: LogLevel = 'info',
  ) {}

  private shouldLog(level: LogLevel): boolean {
    if (this.logLevel === 'silent') {
      return false;
    }
    return LOG_LEVELS[level] <= LOG_LEVELS[this.logLevel];
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const levelColor = LOG_LEVEL_COLORS[level];
    return `${chalk.gray(timestamp)} ${levelColor(level.toUpperCase())} ${chalk.white(this.name)}: ${args
      .map((arg) =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
      )
      .join(' ')}`;
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', ...args));
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', ...args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', ...args));
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', ...args));
    }
  }

  trace(...args: unknown[]): void {
    if (this.shouldLog('trace')) {
      console.trace(this.formatMessage('trace', ...args));
    }
  }
}
