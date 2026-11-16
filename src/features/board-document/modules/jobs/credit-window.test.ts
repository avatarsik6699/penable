import { describe, expect, it } from "vitest";
import { CreditWindow } from "./credit-window";
import { SourceUpload } from "./source-upload";
import { DocumentCodec } from "../codec";
import type { JobRequest } from "./jobs-protocol";
import type { Stroke } from "~/entities/board";

describe("document transfer credits", () => {
  it("registers before synchronous ACK, ignores duplicates and rejects impossible future ACK", async () => {
    const credits = new CreditWindow();

    await credits.send((seq) => credits.acknowledge(seq));
    credits.acknowledge(1);
    await credits.drain();
    expect(() => credits.acknowledge(2)).toThrow();
  });

  it("blocks a third packet and drain, then rejects both on reset", async () => {
    const credits = new CreditWindow(),
      posted: number[] = [];

    await credits.send((seq) => posted.push(seq));
    await credits.send((seq) => posted.push(seq));

    const sending = credits.send((seq) => posted.push(seq));
    const drained = credits.drain();
    const sent = expect(sending).rejects.toThrow("cancelled");
    const drain = expect(drained).rejects.toThrow("cancelled");

    await Promise.resolve();
    expect(posted).toEqual([1, 2]);
    credits.fail(new Error("cancelled"));
    await Promise.all([sent, drain]);
  });

  it("packs a million points into 489 transfers, retains source identity and warm knowledge", async () => {
    const strokes: Stroke[] = Array.from({ length: 20000 }, (_, id) => ({
      id: id + 1,
      width: 3,
      color: "#182230",
      points: Array.from({ length: 50 }, (_, index) => ({
        x: index,
        y: id,
        pressure: 0.5,
        time: index,
      })),
    }));

    const first = strokes[0]!.points,
      upload = new SourceUpload(),
      messages: JobRequest[] = [];

    const document = { ...DocumentCodec.emptyDocument(), strokes };
    const credits = new CreditWindow();

    const port = {
      postMessage(message: JobRequest) {
        messages.push(message);

        if ("seq" in message) credits.acknowledge(message.seq);
      },
    };

    const used = await upload.send(
      document,
      port,
      1,
      () => {},
      async () => {},
      true,
      credits,
    );

    const packed = messages.filter(
      (message) => message.type === "points-batch",
    );

    expect(packed).toHaveLength(489);

    expect(
      packed.reduce((sum, packet) => sum + packet.values.length / 4, 0),
    ).toBe(1000000);

    expect(
      packed.every(
        (packet) => packet.ranges.length <= 64 && packet.values.length <= 8192,
      ),
    ).toBe(true);

    expect(packed[0]!.ranges.slice(0, 2)).toEqual([
      { geometry: 1, length: 50, offset: 0, start: 0, count: 50 },
      { geometry: 2, length: 50, offset: 0, start: 50, count: 50 },
    ]);

    expect(strokes[0]!.points).toBe(first);
    expect(first).toHaveLength(50);
    upload.commit(used, strokes);
    messages.length = 0;

    await upload.send(
      document,
      port,
      2,
      () => {},
      async () => {},
      true,
      credits,
    );

    expect(messages.some((message) => message.type === "points-batch")).toBe(
      false,
    );
  });

  it("rejects malformed emergency geometry without coercing its raw value", async () => {
    const point = { x: "1", y: 2, pressure: 1, time: 0 };

    const document = {
      ...DocumentCodec.emptyDocument(),
      strokes: [{ id: 1, width: 3, color: "#182230", points: [point] }],
    };

    await expect(
      new SourceUpload().send(
        document as unknown as import("../../board-document.types").BoardDocument,
        { postMessage() {} },
        1,
        () => {},
        async () => {},
        true,
        new CreditWindow(),
      ),
    ).rejects.toThrow("Invalid raw");

    expect(point.x).toBe("1");
  });
});
