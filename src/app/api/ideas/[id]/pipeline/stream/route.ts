import { logBus } from '@/lib/pipeline/log-bus';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      logBus.getBuffered(id).forEach((chunk) => send({ chunk }));

      const unsub = logBus.subscribe(id, (chunk) => send({ chunk }));

      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
