// Server-only. Lovable AI Gateway helpers + slip reading via the Responses API.
// Never import this from client code.
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, type ModelMessage } from "ai";
import { z } from "zod";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

/** Request-local run-ID propagation per the Lovable AI Gateway contract. Never mint run IDs in app code. */
export function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  };
}

const slipSchema = z.strictObject({
  /** Amount transferred, in THB, as printed on the slip. null when unreadable. */
  amount: z.number().nullable(),
  /** Transfer date on the slip, YYYY-MM-DD. null when unreadable. */
  paid_on: z.string().nullable(),
  /** Bank name or transfer channel printed on the slip. null when unreadable. */
  bank: z.string().nullable(),
});

export type SlipRead = z.infer<typeof slipSchema>;

const slipInstructions =
  "You read Thai bank-transfer slips (payment slips). Extract the transferred amount in THB and the transfer date. " +
  "Dates on Thai slips may use the Buddhist calendar (พ.ศ.), e.g. 2569 means 2026: subtract 543 from a year above 2400. " +
  "Return only what is clearly printed on the slip; use null for anything unreadable. Reply with the JSON object only.";

/** Read a slip image (data URL) and return the extracted amount/date. Streams the call; consumes the final object server-side. */
export async function readSlipWithAI(imageDataUrl: string): Promise<
  { ok: true; data: SlipRead } | { ok: false; error: string }
> {
  const runIdFetch = createRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: process.env["LOVABLE_API_KEY"] ?? "",
    headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "", "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: "อ่านสลิปการโอนเงินนี้ แล้วส่งคืนยอดเงินและวันที่โอนในรูปแบบ JSON" },
        { type: "image", image: imageDataUrl },
      ],
    },
  ];
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      system: slipInstructions,
      messages,
      output: Output.object({ schema: slipSchema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const parsed = await result.output;
    if (!parsed || (parsed.amount == null && parsed.paid_on == null)) {
      return { ok: false, error: "ไม่สามารถอ่านข้อมูลจากสลิปได้ กรุณาตรวจสลิปด้วยตนเอง" };
    }
    return { ok: true, data: parsed };
  } catch (error) {
    // Log provider details server-side; surface a safe message.
    console.error("[slip-reader] gateway call failed", error);
    const message = error instanceof Error ? error.message : "";
    const safe = message.replace(/\b(sk-[A-Za-z0-9-]+|Bearer\s+\S+)\b/g, "").slice(0, 300);
    return { ok: false, error: safe || "เรียก AI ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
