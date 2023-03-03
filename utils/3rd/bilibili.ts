import pRetry from "p-retry";

var myHeaders = new Headers();
myHeaders.append("authority", "api.bilibili.com");
myHeaders.append("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
myHeaders.append("accept-language", "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6,ja;q=0.5");
myHeaders.append("cache-control", "max-age=0");
myHeaders.append("cookie", process.env.BILIBILI_COOKIE);
myHeaders.append("sec-ch-ua", "\"Chromium\";v=\"110\", \"Not A(Brand\";v=\"24\", \"Google Chrome\";v=\"110\"");
myHeaders.append("sec-ch-ua-mobile", "?0");
myHeaders.append("sec-ch-ua-platform", "\"macOS\"");
myHeaders.append("sec-fetch-dest", "document");
myHeaders.append("sec-fetch-mode", "navigate");
myHeaders.append("sec-fetch-site", "none");
myHeaders.append("sec-fetch-user", "?1");
myHeaders.append("upgrade-insecure-requests", "1");
myHeaders.append("user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36");
const run = async (bvId: string) => {
  const requestUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvId}`;
  console.log(`fetch`, requestUrl);
  const response = await fetch(requestUrl, {
    method: "GET",
    headers: myHeaders,
  });
  const json = await response.json();
  // 多run几次也拿不到字幕，所以这里不判断字幕了，在外面判断。
  return json;
};

export async function fetchSubtitle(bvId: string) {
  const res = await pRetry(() => run(bvId), {
    onFailedAttempt: (error) => {
      console.log(
        `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`
      );
    },
    retries: 2,
  });

  // @ts-ignore
  const title = res.data?.title;
  const subtitleList = res.data?.subtitle?.list;
  if (!subtitleList || subtitleList?.length < 1) {
    return { title, subtitles: null };
  }

  const betterSubtitle =
    subtitleList.find(({ lan }: { lan: string }) => lan === "zh-CN") ||
    subtitleList[0];
  const subtitleUrl = betterSubtitle?.subtitle_url;
  console.log("subtitle_url", subtitleUrl);

  const subtitleResponse = await fetch(subtitleUrl);
  const subtitles = await subtitleResponse.json();
  return { title, subtitles };
}
