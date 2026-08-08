import { google } from "@ai-sdk/google";
import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    streamText,
    toUIMessageStream,
    type UIMessage,
} from "ai";

export const maxDuration = 30; // allow 30s for long project work

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const result = streamText({
        model: google("gemini-3.6-flash"), // Gemini 3.6 Flash model
        messages: await convertToModelMessages(messages),
        system: "You are a helpful assistant that provides concise and accurate answers to user questions.",
    });
    return createUIMessageStreamResponse({
        stream: toUIMessageStream({
            stream: result.stream,
            // v7 masks stream errors as "An error occurred." so server details are
            // not leaked. Surface the real message in dev only.
            onError: (error) =>
                process.env.NODE_ENV === "development"
                    ? error instanceof Error
                        ? error.message
                        : String(error)
                    : "An error occurred.",
        }),
    });
}
