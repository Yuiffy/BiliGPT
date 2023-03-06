import { Redis } from "@upstash/redis";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchSubtitle } from "~/lib/bilibili";
import { OpenAIResult } from "~/lib/openai/OpenAIResult";
import { getChunckedTranscripts, getSummaryPrompt } from "~/lib/openai/prompt";
import { selectApiKeyAndActivatedLicenseKey } from "~/lib/openai/selectApiKeyAndActivatedLicenseKey";
import { SummarizeParams, UserConfig } from "~/lib/types";
import { isDev } from "~/utils/env";

export const config = {
  runtime: process.env.OPENAI_HTTP_PROXY ? "nodejs" : "edge"
};

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing env var from OpenAI");
}

export default async function handler(
  req: NextRequest,
  // context: NextFetchEvent
  res: any,
) {
  const { bvId, userConfig } = (req.body || (await req.json())) as SummarizeParams;
  const { userKey, shouldShowTimestamp } = userConfig;

  if (!bvId) {
    return new Response("No bvid in the request", { status: 500 });
  }
  const { title, subtitles } = await fetchSubtitle(bvId);
  if (!subtitles) {
    console.error("No subtitle in the video: ", bvId);
    if(res) return res.status(501).json('No subtitle in the video');
    return new Response("No subtitle in the video", { status: 501 });
  }
  // @ts-ignore
  const transcripts = subtitles.body.map((item, index) => {
    return {
      text: `${item.from}: ${item.content}`,
      index,
    };
  });
  // console.log("========transcripts========", transcripts);
  const text = getChunckedTranscripts(transcripts, transcripts);
  const prompt = getSummaryPrompt(title, text, shouldShowTimestamp);

  try {
    userKey && console.log("========use user apiKey========");
    isDev && console.log("prompt", prompt);
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user" as const, content: prompt }],
      temperature: 0.5,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: Number.parseInt((process.env.MAX_TOKENS || (userKey ? "400" : "300")) as string),
      stream: false,
      n: 1,
    };

    // TODO: need refactor
    const openaiApiKey = await selectApiKeyAndActivatedLicenseKey(
      userKey,
      bvId
    );
    const result = await OpenAIResult(payload, openaiApiKey);
    // TODO: add better logging when dev or prod
    console.log("result", result);
    const redis = Redis.fromEnv();
    const data = await redis.set(`${bvId}_${process.env.PROMPT_VERSION}`, result);
    console.log(`bvId ${bvId}_${process.env.PROMPT_VERSION} cached:`, data);

    return  res ? res.status(200).json(result) : NextResponse.json(result);
  } catch (error: any) {
    console.log("API error", error, error.message);
    return (!res) ?NextResponse.json({
      errorMessage: error.message,
    }) : res.status(500).json({message: error.message});
  }
  res.status(500).json({message: 'what'});
}
