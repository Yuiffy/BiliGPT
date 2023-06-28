// Copyright (c) 2022 Kazuki Nakayashiki.
// Modified work: Copyright (c) 2023 Qixiang Zhu.
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// via https://github.com/lxfater/BilibiliSummary/blob/3d1a67cbe8e96adba60672b778ce89644a43280d/src/prompt.ts#L62
export function limitTranscriptByteLength(str: string, byteLimit: number = LIMIT_COUNT) {
  const utf8str = unescape(encodeURIComponent(str))
  const byteLength = utf8str.length
  if (byteLength > byteLimit) {
    const ratio = byteLimit / byteLength
    const newStr = str.substring(0, Math.floor(str.length * ratio))
    return newStr
  }
  return str
}
function filterHalfRandomly<T>(arr: T[]): T[] {
  const filteredArr: T[] = []
  const halfLength = Math.floor(arr.length / 2)
  const indicesToFilter = new Set<number>()

  // 随机生成要过滤掉的元素的下标
  while (indicesToFilter.size < halfLength) {
    const index = Math.floor(Math.random() * arr.length)
    if (!indicesToFilter.has(index)) {
      indicesToFilter.add(index)
    }
  }

  // 过滤掉要过滤的元素
  for (let i = 0; i < arr.length; i++) {
    if (!indicesToFilter.has(i)) {
      filteredArr.push(arr[i])
    }
  }
  console.log('filter once', { l1: arr.length, l2: filteredArr.length })
  return filteredArr
}
function getByteLength(text: string) {
  return unescape(encodeURIComponent(text)).length
}

function itemInIt(textData: SubtitleItem[], text: string): boolean {
  return textData.find((t) => t.text === text) !== undefined
}

type SubtitleItem = {
  text: string
  index: number
}

const ENV_LIMIT = process.env.PROMPT_BYTE_LIMIT_COUNT
// Seems like 15,000 bytes is the limit for the prompt
// 13000 = 6500*2
const LIMIT_COUNT = ENV_LIMIT ? Number.parseInt(ENV_LIMIT) : 6200 // 2000 is a buffer
export function getSmallSizeTranscripts(
  newTextData: SubtitleItem[],
  oldTextData: SubtitleItem[],
  byteLimit: number = LIMIT_COUNT,
): string {
  const text = newTextData
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')
  const byteLength = getByteLength(text)

  if (byteLength > byteLimit) {
    const filtedData = filterHalfRandomly(newTextData)
    return getSmallSizeTranscripts(filtedData, oldTextData, byteLimit)
  }

  let resultData = newTextData.slice()
  let resultText = text
  let lastByteLength = byteLength

  for (let i = 0; i < oldTextData.length; i++) {
    const obj = oldTextData[i]
    // 在newTextData里的已经在resultData里了，不需要处理
    if (itemInIt(newTextData, obj.text)) {
      continue
    }

    const nextTextByteLength = getByteLength(obj.text)
    const isOverLimit = lastByteLength + nextTextByteLength > byteLimit
    if (isOverLimit) {
      // 超额的也不许删减字数加入！影响判断了。而且这个插入方式，每个其实都会插回来，导致byte溢出
      // const overRate = (lastByteLength + nextTextByteLength - byteLimit) / nextTextByteLength
      // const chunkedText = obj.text.substring(0, Math.floor(obj.text.length * overRate))
      // resultData.push({ text: chunkedText, index: obj.index })
    } else {
      resultData.push(obj)
    }
    resultText = resultData
      .sort((a, b) => a.index - b.index)
      .map((t) => t.text)
      .join(' ')
    lastByteLength = getByteLength(resultText)
  }
  console.log('resultData length', resultData.length)
  return resultText
}

function shuffle(array: any[]) {
  let currentIndex = array.length,
    randomIndex

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // And swap it with the current element.
    ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }

  return array
}

export function getSmallSizeTranscriptsByShuffle(textData: SubtitleItem[], byteLimit: number = LIMIT_COUNT): string {
  let resultData = []
  let lastByteLength = 0
  const shuffled = shuffle(textData)

  for (let i = 0; i < shuffled.length; i++) {
    const obj = shuffled[i]

    const nextTextByteLength = getByteLength(obj.text) + 1
    const isOverLimit = lastByteLength + nextTextByteLength > byteLimit
    if (isOverLimit) {
      break
    } else {
      resultData.push(obj)
      lastByteLength += nextTextByteLength
    }
  }
  const resultText = resultData
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')
  console.log('getSmallSizeTranscriptsByShuffle', { startLength: textData.length, resultLength: resultData.length })
  return resultText
}
