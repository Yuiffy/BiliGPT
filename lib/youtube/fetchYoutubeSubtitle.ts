import { fetchYoutubeSubtitleUrls, SUBTITLE_DOWNLOADER_URL } from '~/lib/youtube/fetchYoutubeSubtitleUrls'
import { find } from '~/utils/fp'
import { reduceYoutubeSubtitleTimestamp } from '~/utils/reduceSubtitleTimestamp'
import nodeFetch from 'node-fetch'

const HttpsProxyAgent = require('https-proxy-agent')

export async function fetchYoutubeSubtitle(videoId: string, shouldShowTimestamp: boolean | undefined) {
  const { title, subtitleList } = await fetchYoutubeSubtitleUrls(videoId)
  if (!subtitleList || subtitleList?.length <= 0) {
    return { title, subtitlesArray: null }
  }
  console.log('subtitleList', subtitleList)
  const betterSubtitle =
    find(subtitleList, { quality: 'Japanese (auto' }) ||
    find(subtitleList, { quality: 'zh-CN' }) ||
    find(subtitleList, { quality: 'English' }) ||
    find(subtitleList, { quality: 'English (auto' }) ||
    subtitleList[0]

  const proxyUrl = process.env.OPENAI_HTTP_PROXY
  const fetchParams: any = {}
  let fetchFunc = fetch
  if (proxyUrl) {
    fetchFunc = nodeFetch as any
    fetchParams.agent = new HttpsProxyAgent(proxyUrl) as any
  }

  console.log('will fetch subtitle', { betterSubtitle, fetchParams })

  if (shouldShowTimestamp) {
    const subtitleUrl = `${SUBTITLE_DOWNLOADER_URL}${betterSubtitle.url}?ext=json`
    const response = await fetchFunc(subtitleUrl, fetchParams)
    const subtitles = await response.json()
    // console.log("========youtube subtitles========", subtitles);
    const transcripts = reduceYoutubeSubtitleTimestamp(subtitles)
    return { title, subtitlesArray: transcripts }
  }

  const subtitleUrl = `${SUBTITLE_DOWNLOADER_URL}${betterSubtitle.url}?ext=txt`
  const response = await fetchFunc(subtitleUrl, fetchParams)
  const subtitles = await response.text()
  const transcripts = subtitles.split('\r\n\r\n')?.map((text: string, index: number) => ({ text, index }))
  return { title, subtitlesArray: transcripts }
}
