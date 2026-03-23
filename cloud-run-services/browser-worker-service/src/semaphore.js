export class Semaphore {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.queue = [];
  }

  async use(taskFn) {
    await this.acquire();
    try {
      return await taskFn();
    } finally {
      this.release();
    }
  }

  acquire() {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    }).then(() => {
      this.active += 1;
    });
  }

  release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}
