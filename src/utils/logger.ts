/**
 * 日志工具
 * 提供基于日志级别的条件日志输出
 * 使用 winston 进行日志管理，支持文件轮转
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import { LOGGING_CONFIG, LogLevel } from '../config/constants';

// 日志文件配置
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_FILES = 50; // 最多保留50个旧日志文件

// 确保日志目录存在
fs.ensureDirSync(LOG_DIR);

// 缓存最后一次检查的文件大小，减少频繁的文件系统访问
let lastFileSize = 0;
let lastCheckTime = 0;
const CHECK_INTERVAL = 1000; // 每1秒最多检查一次

/**
 * 轮转日志文件
 * 当文件大小超过限制时，将旧文件重命名为 app.log.1, app.log.2, ... app.log.50
 */
function rotateLogFile(): void {
  try {
    const now = Date.now();
    // 如果距离上次检查时间太短，且上次检查时文件大小未超过限制，则跳过
    if (now - lastCheckTime < CHECK_INTERVAL && lastFileSize < MAX_FILE_SIZE) {
      return;
    }
    lastCheckTime = now;

    // 检查主日志文件是否存在以及大小
    if (!fs.existsSync(LOG_FILE)) {
      lastFileSize = 0;
      return;
    }

    const stats = fs.statSync(LOG_FILE);
    lastFileSize = stats.size;
    if (stats.size < MAX_FILE_SIZE) {
      return; // 文件大小未超过限制，不需要轮转
    }

    // 删除最旧的日志文件（如果存在）
    const oldestLog = path.join(LOG_DIR, `app.log.${MAX_FILES}`);
    if (fs.existsSync(oldestLog)) {
      fs.removeSync(oldestLog);
    }

    // 将所有现有日志文件向后移动一位
    // app.log.49 -> app.log.50
    // app.log.48 -> app.log.49
    // ...
    // app.log.1 -> app.log.2
    // app.log -> app.log.1
    for (let i = MAX_FILES - 1; i >= 1; i--) {
      const oldFile = path.join(LOG_DIR, `app.log.${i}`);
      const newFile = path.join(LOG_DIR, `app.log.${i + 1}`);
      if (fs.existsSync(oldFile)) {
        fs.moveSync(oldFile, newFile, { overwrite: true });
      }
    }

    // 将当前日志文件重命名为 app.log.1
    const firstRotatedLog = path.join(LOG_DIR, 'app.log.1');
    if (fs.existsSync(LOG_FILE)) {
      fs.moveSync(LOG_FILE, firstRotatedLog, { overwrite: true });
      lastFileSize = 0; // 重置文件大小，因为文件已被重命名
    }
  } catch (error) {
    // 轮转失败时，直接输出到原始 console.error，避免递归日志
    // 使用 process.stderr.write 避免触发重定向的 console.error
    process.stderr.write(`Failed to rotate log file: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

/**
 * 自定义格式化器，将 LogLevel 映射到 winston 级别
 */
function mapLogLevelToWinston(level: LogLevel): string {
  switch (level) {
    case LogLevel.ERROR:
      return 'error';
    case LogLevel.WARN:
      return 'warn';
    case LogLevel.INFO:
      return 'info';
    case LogLevel.DEBUG:
      return 'debug';
    case LogLevel.VERBOSE:
      return 'verbose';
    default:
      return 'info';
  }
}

/**
 * 自定义文件 transport，支持按大小轮转
 */
class RotatingFileTransport extends winston.transports.File {
  constructor() {
    super({
      filename: LOG_FILE,
      silent: false,
    });
  }

  log(info: any, callback?: () => void): void {
    // 在写入前检查并轮转
    rotateLogFile();
    if (callback) {
      super.log(info, callback);
    } else {
      super.log(info);
    }
  }
}

/**
 * 创建 winston logger 实例
 */
const logger = winston.createLogger({
  level: 'silly', // winston 的级别，我们会在应用层过滤
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    // 控制台输出（保持原有格式，不带时间戳）
    new winston.transports.Console({
      format: winston.format.printf(({ message }): string => {
        return String(message); // 直接输出消息，保持原有的 emoji 格式
      }),
      silent: false, // 总是输出到控制台
    }),
    // 文件输出（使用自定义轮转 transport）
    new RotatingFileTransport(),
  ],
});

/**
 * 根据日志级别输出日志
 */
export function log(level: LogLevel, message: string): void {
  if (level <= LOGGING_CONFIG.LEVEL) {
    const winstonLevel = mapLogLevelToWinston(level);
    logger.log(winstonLevel, message);
  }
}

/**
 * 错误日志 (总是显示)
 */
export function logError(message: string): void {
  log(LogLevel.ERROR, message);
}

/**
 * 警告日志 (WARN 及以上级别显示)
 */
export function logWarn(message: string): void {
  log(LogLevel.WARN, message);
}

/**
 * 信息日志 (INFO 及以上级别显示)
 */
export function logInfo(message: string): void {
  log(LogLevel.INFO, message);
}

/**
 * 调试日志 (DEBUG 及以上级别显示)
 */
export function logDebug(message: string): void {
  log(LogLevel.DEBUG, message);
}

/**
 * 详细日志 (VERBOSE 级别显示)
 */
export function logVerbose(message: string): void {
  log(LogLevel.VERBOSE, message);
}

/**
 * 重定向 console 输出到日志文件
 * 确保所有控制台输出都被记录到日志文件
 */
function redirectConsoleOutput(): void {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;

  // 重定向 console.log
  console.log = (...args: any[]) => {
    originalConsoleLog.apply(console, args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.info(message);
  };

  // 重定向 console.error
  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.error(message);
  };

  // 重定向 console.warn
  console.warn = (...args: any[]) => {
    originalConsoleWarn.apply(console, args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.warn(message);
  };

  // 重定向 console.info
  console.info = (...args: any[]) => {
    originalConsoleInfo.apply(console, args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.info(message);
  };
}

// 在模块加载时重定向 console 输出
redirectConsoleOutput();
