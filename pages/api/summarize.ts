import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import type { NextFetchEvent, NextRequest } from "next/server";
import { OpenAIResult } from "../../utils/OpenAIResult";
import { getChunckedTranscripts, getSummaryPrompt } from "../../utils/prompt";

export const config = {
  runtime: "edge",
};

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing env var from OpenAI");
}

export default async function handler(
  req: NextRequest,
  context: NextFetchEvent
) {
  const { bvId, apiKey } = (await req.json()) as {
    bvId: string;
    apiKey?: string;
  };

  if (!bvId) {
    return new Response("No bvid in the request", { status: 500 });
  }

  try {
    const requestUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvId}`;
    console.log(`fetch`, requestUrl);
    const response = await fetch(requestUrl, {
      method: "GET",
    });
    const res = await response.json();
    // @ts-ignore
    const title = res.data?.title;
    const subtitleList = res.data?.subtitle?.list;
    if (subtitleList && subtitleList.length < 1) {
      return new Response("No subtitle in the video", { status: 501 });
    }
    const betterSubtitle =
      subtitleList.find(({ lan }: { lan: string }) => lan === "zh-CN") ||
      subtitleList?.[0];
    const subtitleUrl = betterSubtitle?.subtitle_url;
    console.log("subtitle_url", subtitleUrl);

    const subtitleResponse = await fetch(subtitleUrl);
    const subtitles = await subtitleResponse.json();
    // @ts-ignore
    const transcripts = subtitles.body.map((item, index) => {
      return {
        text: item.content,
        index,
        timestamp: item.from,
      };
    });
    // console.log("========transcripts========", transcripts);
    const text = getChunckedTranscripts(transcripts, transcripts);
    const prompt = getSummaryPrompt(title, text);

    apiKey && console.log("========use user key========");
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user" as const, content: prompt }],
      temperature: 0.5,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: apiKey ? 400 : 300,
      stream: false,
      n: 1,
    };

    const result = await OpenAIResult(payload, apiKey);
    console.log("result", result);
    const redis = Redis.fromEnv();
    const data = await redis.set(`${bvId}_${process.env.PROMPT_VERSION}`, result);
    console.log(`bvId ${bvId} cached:`, data);

    return NextResponse.json(result);
  } catch (error: any) {
    console.log(error);
    return NextResponse.json({
      errorMessage: error.message,
    });
  }
}
