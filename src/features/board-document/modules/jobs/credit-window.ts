// One owner per stream. Register credits before posting so synchronous ports are safe.
export class CreditWindow {
  private sequence = 0;
  private readonly pending = new Map<
    number,
    {
      promise: Promise<void>;
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  >();
  private failure: unknown;

  async send(post: (sequence: number) => void): Promise<void> {
    while (this.pending.size >= 2) {
      await this.pending.values().next().value!.promise;
    }

    if (this.failure) throw this.failure;

    const sequence = ++this.sequence;
    let resolve!: () => void, reject!: (error: unknown) => void;

    const promise = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });

    void promise.catch(() => {});
    this.pending.set(sequence, { promise, resolve, reject });

    try {
      post(sequence);
    } catch (error) {
      this.fail(error);

      throw error;
    }
  }

  acknowledge(sequence: number) {
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > this.sequence)
      throw new Error("Invalid document transfer acknowledgement");

    const entry = this.pending.get(sequence);

    this.pending.delete(sequence);
    entry?.resolve();
  }

  async drain() {
    await Promise.all([...this.pending.values()].map((entry) => entry.promise));

    if (this.failure) throw this.failure;
  }

  fail(error: unknown) {
    this.failure = error;

    for (const entry of this.pending.values()) entry.reject(error);

    this.pending.clear();
  }
}
