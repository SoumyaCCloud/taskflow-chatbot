/*
 * The wire protocol the TaskFlow agent speaks: Server-Sent Events whose `data:`
 * payload is one JSON object per event. Both ends of the app share these types —
 * `app/api/agent/route.ts` writes them, `lib/use-agent-chat.ts` reads them — so
 * a change to the shape breaks compilation rather than the stream at runtime.
 *
 *   data: {"type":"token","content":"Hel"}
 *   data: {"type":"tool_call","tool":"list_tasks","args":{"status":"open"}}
 *   data: {"type":"tool_result","tool":"list_tasks","output":"3 open tasks"}
 *   data: {"type":"done"}
 */
export type AgentEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; tool: string; args: unknown }
  | { type: 'tool_result'; tool: string; output: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** What the client POSTs. History lives server-side, keyed by `thread_id`. */
export type AgentRequest = {
  message: string;
  thread_id: string;
};

/**
 * One event as an SSE frame. The trailing blank line is the frame delimiter —
 * without it the reader keeps buffering and nothing renders.
 */
export function encodeEvent(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Pulls whole frames out of a growing buffer, returning the parsed events and
 * the unconsumed tail. A network chunk can split a frame anywhere, so the tail
 * has to survive until the bytes that finish it arrive.
 */
export function drainEvents(buffer: string): {
  events: AgentEvent[];
  rest: string;
} {
  const frames = buffer.split('\n\n');
  // The last piece is either an incomplete frame or '' — either way it is not
  // ready to parse, so it goes back on the buffer.
  const rest = frames.pop() ?? '';
  const events: AgentEvent[] = [];

  for (const frame of frames) {
    for (const line of frame.split('\n')) {
      const trimmed = line.trim();
      // Comments (': keep-alive') and non-data fields are protocol noise.
      if (!trimmed.startsWith('data:')) continue;

      try {
        events.push(JSON.parse(trimmed.slice(5).trim()) as AgentEvent);
      } catch {
        // A malformed frame is not worth killing a live stream over.
      }
    }
  }

  return { events, rest };
}
