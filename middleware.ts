import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "1 s"),
});

export async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { bvId } = await req.json();
  // TODO: unique to a user (userid, email etc) instead of IP
  const ip = req.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.redirect(new URL("/blocked", req.url));
  }

  const result = await redis.get<string>(`${bvId}_${process.env.PROMPT_VERSION}`);
  if (result) {
    console.log("hit cache for ", bvId);
    return NextResponse.json(result);
  }
}

export const config = {
  matcher: "/api/summarize",
};
