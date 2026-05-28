export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class TaskTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskTooLargeError';
  }
}

export class TooManyRetriesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TooManyRetriesError';
  }
}
