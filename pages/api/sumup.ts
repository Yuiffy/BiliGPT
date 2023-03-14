import { Redis } from "@upstash/redis";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchSubtitle } from "~/lib/fetchSubtitle";
import {
  ChatGPTAgent,
  fetchOpenAIResult,
} from "~/lib/openai/fetchOpenAIResult";
import { getSmallSizeTranscripts } from "~/lib/openai/getSmallSizeTranscripts";
import {
  getExamplePrompt,
  getSystemPrompt,
  getUserSubtitlePrompt,
  getUserSubtitleWithTimestampPrompt,
} from "~/lib/openai/prompt";
import { selectApiKeyAndActivatedLicenseKey } from "~/lib/openai/selectApiKeyAndActivatedLicenseKey";
import { SummarizeParams } from "~/lib/types";
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
  const { videoConfig, userConfig } = (req.body || (await req.json())) as SummarizeParams;
  const { userKey, shouldShowTimestamp } = userConfig;
  const { videoId } = videoConfig;

  if (!videoId) {
    return new Response("No videoId in the request", { status: 500 });
  }
  const { title, subtitlesArray, descriptionText } = await fetchSubtitle(
    videoConfig,
    shouldShowTimestamp
  );
  // 不支持只有简介的
  if (!subtitlesArray) {
    console.error("No subtitle in the video: ", videoId);
    if(res) return res.status(501).json('No subtitle in the video');
    return new Response("No subtitle in the video", { status: 501 });
  }
  const inputText = subtitlesArray
    ? getSmallSizeTranscripts(subtitlesArray, subtitlesArray)
    : `这个视频没有字幕，只有简介：${descriptionText}`; // subtitlesArray.map((i) => i.text).join("\n")

  // TODO: try the apiKey way for chrome extensions
  // const systemPrompt = getSystemPrompt({
  //   shouldShowTimestamp: subtitlesArray ? shouldShowTimestamp : false,
  // });
  // const examplePrompt = getExamplePrompt();
  const userPrompt = shouldShowTimestamp
    ? getUserSubtitleWithTimestampPrompt(title, inputText, videoConfig)
    : getUserSubtitlePrompt(title, inputText, videoConfig);
  if (true || isDev) {
    // console.log("final system prompt: ", systemPrompt);
    // console.log("final example prompt: ", examplePrompt);
    console.log("final user prompt: ", userPrompt);
  }

  try {
    const stream = true;
    const openAiPayload = {
      model: "gpt-3.5-turbo",
      messages: [
        // { role: ChatGPTAgent.system, content: systemPrompt },
        // { role: ChatGPTAgent.user, content: examplePrompt.input },
        // { role: ChatGPTAgent.assistant, content: examplePrompt.output },
        { role: ChatGPTAgent.user, content: userPrompt },
      ],
      // temperature: 0.5,
      // top_p: 1,
      // frequency_penalty: 0,
      // presence_penalty: 0,
      max_tokens: Number(videoConfig.detailLevel) || Number.parseInt((process.env.MAX_TOKENS || (userKey ? "800" : "600")) as string),
      stream,
      // n: 1,
    };

    // TODO: need refactor
    const openaiApiKey = await selectApiKeyAndActivatedLicenseKey(
      userKey,
      videoId
    );
    const result = await fetchOpenAIResult(
      openAiPayload,
      openaiApiKey,
      videoConfig
    );
    if (stream) {
      return new Response(result);
    }

    return  res ? res.status(200).json(result) : NextResponse.json(result);
  } catch (error: any) {
    console.error(error.message);
    return new Response(
      JSON.stringify({
        errorMessage: error.message,
      }),
      {
        status: 500,
      }
    );
  }
  res.status(500).json({message: 'what'});
}
