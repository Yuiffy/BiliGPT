import { isDev } from '~/utils/env'
import nodeFetch from 'node-fetch'
// import HttpsProxyAgent from "https-proxy-agent";
const HttpsProxyAgent = require('https-proxy-agent')

export const SUBTITLE_DOWNLOADER_URL = 'https://savesubs.com'
export async function fetchYoutubeSubtitleUrls(videoId: string) {
  const url = `https://www.youtube.com/watch?v=${videoId}`

  const proxyUrl = process.env.OPENAI_HTTP_PROXY
  const fetchParams: any = {}

  let fetchFunc = fetch
  if (proxyUrl) {
    fetchFunc = nodeFetch as any
    fetchParams.agent = new HttpsProxyAgent(proxyUrl) as any
  }

  const response = await fetchFunc(SUBTITLE_DOWNLOADER_URL + '/action/extract', {
    ...fetchParams,
    method: 'POST',
    body: JSON.stringify({
      data: { url },
    }),
    headers: {
      'Content-Type': 'text/plain',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      'X-Auth-Token': `${process.env.SAVESUBS_X_AUTH_TOKEN}` || '',
      'X-Requested-Domain': 'savesubs.com',
      'X-Requested-With': 'xmlhttprequest',
    },
  })
  const { response: json = {} } = await response.json()
  if (isDev) {
    console.log('========json========', { json, url })
  }
  /*
  * "title": "Microsoft vs Google: AI War Explained | tech",
    "duration": "13 minutes and 15 seconds",
    "duration_raw": "795",
    "uploader": "Joma Tech / 2023-02-20",
    "thumbnail": "//i.ytimg.com/vi/BdHaeczStRA/mqdefault.jpg",
  * */
  return { title: json.title, subtitleList: json.formats }
}
