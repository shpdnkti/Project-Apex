export type AdmissionRow = {
  province: string
  year: number
  category?: string
  batch?: string
  school: string
  major: string
  score: number
  rank: number
  quota?: number
}

export type AdmissionPayload = {
  meta: {
    generatedFrom: string
    fullDbRows: number
    sampleRows: number
    provinces: string[]
    years: number[]
    keywords: string[]
    note: string
  }
  rows: AdmissionRow[]
}

export type ParsedInfo = {
  province: string
  rank: number
  score: number
  subject: string
  majors: string[]
  avoidMajors: string[]
  schools: string[]
  regionAvoid: string[]
}

export type Band = 'chong' | 'wen' | 'bao'

export type Recommendation = AdmissionRow & {
  band: Band
  source: 'sample'
  distanceLabel: string
  matchedBy: string
}

export type AdvisorResult = {
  parsed: ParsedInfo
  recommendations: Record<Band, Recommendation[]>
  warnings: string[]
  sourceNotes: string[]
  dataMode: 'sample' | 'needs-more-info'
}

const PROVINCES = [
  '北京',
  '天津',
  '上海',
  '重庆',
  '河北',
  '山西',
  '辽宁',
  '吉林',
  '黑龙江',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '内蒙古',
]

const MAJORS = [
  '计算机',
  '软件',
  '人工智能',
  '大数据',
  '物联网',
  '电子',
  '通信',
  '电气',
  '自动化',
  '机械',
  '能源',
  '交通',
  '航空航天',
  '法学',
  '会计',
  '金融',
  '临床',
  '口腔',
  '医学',
  '护理',
  '师范',
  '汉语言',
  '思政',
  '数学',
  '化学',
  '材料',
  '化工',
  '生物',
  '环境',
  '土木',
  '新闻',
  '英语',
  '日语',
  '设计',
  '美术',
  '音乐',
  '体育',
]

const POLICY: Record<string, { mode: string; count: number }> = {
  浙江: { mode: '专业+院校', count: 80 },
  山东: { mode: '专业+院校', count: 96 },
  河北: { mode: '专业+院校', count: 96 },
  重庆: { mode: '专业+院校', count: 96 },
  辽宁: { mode: '专业+院校', count: 112 },
  江苏: { mode: '院校+专业组', count: 40 },
  广东: { mode: '院校+专业组', count: 45 },
  湖北: { mode: '院校+专业组', count: 45 },
  湖南: { mode: '院校+专业组', count: 45 },
  福建: { mode: '院校+专业组', count: 40 },
  北京: { mode: '院校+专业组', count: 30 },
  天津: { mode: '院校+专业组', count: 50 },
  上海: { mode: '院校+专业组', count: 24 },
  海南: { mode: '院校+专业组', count: 24 },
  河南: { mode: '院校+专业组', count: 48 },
  四川: { mode: '院校+专业组', count: 45 },
  陕西: { mode: '院校+专业组', count: 45 },
  山西: { mode: '院校+专业组', count: 45 },
  云南: { mode: '院校+专业组', count: 40 },
  贵州: { mode: '院校+专业组', count: 45 },
  内蒙古: { mode: '院校+专业组', count: 45 },
  安徽: { mode: '院校+专业组', count: 45 },
  江西: { mode: '院校+专业组', count: 45 },
  黑龙江: { mode: '院校+专业组', count: 40 },
  吉林: { mode: '院校+专业组', count: 40 },
  广西: { mode: '院校+专业组', count: 40 },
  甘肃: { mode: '院校+专业组', count: 45 },
  新疆: { mode: '院校+专业组', count: 45 },
  宁夏: { mode: '院校+专业组', count: 45 },
  青海: { mode: '院校+专业组', count: 45 },
  西藏: { mode: '院校+专业组', count: 45 },
}

const CN_DIGIT: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

function digitValue(input: string) {
  if (!input) return 0
  if (CN_DIGIT[input] !== undefined) return CN_DIGIT[input]
  const value = Number(input)
  return Number.isFinite(value) ? value : 0
}

export function formatNumber(value: number) {
  if (!value) return '-'
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function getProvincePolicy(province: string) {
  return POLICY[province]
}

function parseSmallChineseNumber(input: string): number {
  if (!input) return 0
  if (/^\d+$/.test(input)) return Number(input)
  if (input === '十') return 10
  if (input.includes('千')) {
    const [left, right = ''] = input.split('千')
    return digitValue(left) * 1000 + parseSmallChineseNumber(right)
  }
  if (input.includes('百')) {
    const [left, right = ''] = input.split('百')
    return digitValue(left) * 100 + parseSmallChineseNumber(right)
  }
  if (input.includes('十')) {
    const [left, right = ''] = input.split('十')
    const tens = left ? digitValue(left) : 1
    return tens * 10 + digitValue(right)
  }
  return digitValue(input)
}

function parseRank(text: string) {
  const normalized = text.replace(/[,，\s]/g, '')
  const direct =
    normalized.match(/(?:位次|排名|排位|省排|排)[^\d]{0,3}(\d{4,7})/) ??
    normalized.match(/(\d{4,7})(?:位|名)/)
  if (direct) return Number(direct[1])

  const arabicWan = normalized.match(/(\d+(?:\.\d+)?)万(\d{0,4})/)
  if (arabicWan) {
    const base = Number(arabicWan[1]) * 10000
    const suffix = arabicWan[2]
    const add = suffix ? (suffix.length <= 2 ? Number(suffix) * 1000 : Number(suffix)) : 0
    return Math.round(base + add)
  }

  const chineseWan = normalized.match(/([一二两三四五六七八九十\d]+)万([一二两三四五六七八九十百千\d]{0,5})/)
  if (chineseWan) {
    const base = parseSmallChineseNumber(chineseWan[1]) * 10000
    const suffix = chineseWan[2]
    const add = suffix.length === 1 ? parseSmallChineseNumber(suffix) * 1000 : parseSmallChineseNumber(suffix)
    return base + add
  }

  return 0
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

export function extractInfo(text: string): ParsedInfo {
  const provinceHits = PROVINCES.map((province) => ({ province, index: text.indexOf(province) }))
    .filter((hit) => hit.index >= 0)
    .sort((a, b) => a.index - b.index)

  const scoreMatch = text.match(/(\d{3})\s*分/) ?? text.match(/分数[^\d]{0,3}(\d{3})/)
  const subject = text.includes('物理') || text.includes('物化') ? '物理类' : text.includes('历史') || text.includes('史政') ? '历史类' : ''
  const negativeSegments = text.match(/(?:不学|不接受|不读|不选|别推荐|别学|拒绝|排斥|不想学|不考虑).*?(?:[。，,；;\n]|$)/g) ?? []
  const negativeText = negativeSegments.join('')
  const avoidMajors = MAJORS.filter((major) => negativeText.includes(major))
  const majors = MAJORS.filter((major) => text.includes(major) && !avoidMajors.includes(major))
  const schoolMatches = text.match(/[一-鿿]{2,12}(?:大学|学院)/g) ?? []
  const regionAvoid = PROVINCES.filter((province) => negativeText.includes(province))

  return {
    province: provinceHits[0]?.province ?? '',
    rank: parseRank(text),
    score: scoreMatch ? Number(scoreMatch[1]) : 0,
    subject,
    majors: Array.from(new Set(majors)),
    avoidMajors,
    schools: Array.from(new Set(schoolMatches)).slice(0, 3),
    regionAvoid,
  }
}

function rankBand(rowRank: number, userRank: number): Band | '' {
  if (!rowRank || !userRank) return ''
  if (rowRank < userRank && rowRank >= userRank * 0.78) return 'chong'
  if (rowRank >= userRank && rowRank <= userRank * 1.28) return 'wen'
  if (rowRank > userRank * 1.28 && rowRank <= userRank * 1.75) return 'bao'
  return ''
}

function scoreBand(rowScore: number, userScore: number): Band | '' {
  if (!rowScore || !userScore) return ''
  if (rowScore > userScore && rowScore <= userScore + 25) return 'chong'
  if (rowScore >= userScore - 18 && rowScore <= userScore + 8) return 'wen'
  if (rowScore >= userScore - 55 && rowScore < userScore - 18) return 'bao'
  return ''
}

function byBestEvidence(a: Recommendation, b: Recommendation) {
  const yearDiff = b.year - a.year
  if (yearDiff !== 0) return yearDiff
  return Math.abs(a.rank) - Math.abs(b.rank)
}

function compactRows(rows: Recommendation[], limit: number) {
  const seen = new Set<string>()
  const output: Recommendation[] = []
  for (const row of rows.sort(byBestEvidence)) {
    const key = `${row.school}-${row.major}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(row)
    if (output.length >= limit) break
  }
  return output
}

export function buildAdvisorResult(rows: AdmissionRow[], text: string): AdvisorResult {
  const parsed = extractInfo(text)
  const warnings: string[] = []
  const sourceNotes: string[] = []

  if (!parsed.province) warnings.push('还没识别到省份，推荐会先按样本库泛查。')
  if (!parsed.rank && !parsed.score) warnings.push('缺少位次或分数，无法严格切冲稳保。')
  if (parsed.avoidMajors.length) warnings.push(`已过滤排斥方向：${parsed.avoidMajors.join('、')}`)
  if (parsed.regionAvoid.length) warnings.push(`已记录地域回避：${parsed.regionAvoid.join('、')}`)

  if (!parsed.rank && !parsed.score) {
    return {
      parsed,
      recommendations: { chong: [], wen: [], bao: [] },
      warnings,
      sourceNotes,
      dataMode: 'needs-more-info',
    }
  }

  const provinceRows = parsed.province ? rows.filter((row) => row.province.includes(parsed.province)) : rows
  const targetRows = provinceRows.length ? provinceRows : rows
  const majorRows = parsed.majors.length
    ? targetRows.filter((row) => includesAny(`${row.school}${row.major}`, parsed.majors))
    : targetRows
  const usableRows = majorRows.length >= 6 ? majorRows : targetRows

  if (parsed.majors.length && majorRows.length < 6) {
    warnings.push('样本库里该专业命中较少，已临时放宽到同省相近位次。')
  }

  const recommendations: Record<Band, Recommendation[]> = { chong: [], wen: [], bao: [] }

  for (const row of usableRows) {
    const band = parsed.rank ? rankBand(row.rank, parsed.rank) : scoreBand(row.score, parsed.score)
    if (!band) continue
    if (parsed.avoidMajors.length && includesAny(row.major, parsed.avoidMajors)) continue
    const source = row.year >= 2025 ? '2025 样本库' : '2024 样本库'
    recommendations[band].push({
      ...row,
      band,
      source: 'sample',
      distanceLabel: parsed.rank
        ? `距你位次 ${formatNumber(Math.abs(row.rank - parsed.rank))}`
        : `距你分数 ${Math.abs(row.score - parsed.score)} 分`,
      matchedBy: parsed.majors.length && includesAny(`${row.school}${row.major}`, parsed.majors) ? parsed.majors.join(' / ') : '同省位次',
    })
    sourceNotes.push(`${row.school} ${row.major}：${source}`)
  }

  return {
    parsed,
    recommendations: {
      chong: compactRows(recommendations.chong, 8),
      wen: compactRows(recommendations.wen, 8),
      bao: compactRows(recommendations.bao, 8),
    },
    warnings,
    sourceNotes: Array.from(new Set(sourceNotes)).slice(0, 12),
    dataMode: 'sample',
  }
}

function bandLines(title: string, rows: Recommendation[]) {
  if (!rows.length) return `${title}：样本库暂未命中。`
  return [
    `${title}：`,
    ...rows.slice(0, 5).map((row) => `- ${row.school} ${row.major}，${row.year} 年 ${row.score} 分 / ${formatNumber(row.rank)} 位 [样本DB]`),
  ].join('\n')
}

export function buildLocalReply(result: AdvisorResult, meta?: AdmissionPayload['meta']) {
  const { parsed, recommendations } = result
  const policy = parsed.province ? getProvincePolicy(parsed.province) : undefined
  const policyLine = policy
    ? `你是${parsed.province}考生，${policy.mode}模式，可填 ${policy.count} 个志愿。`
    : '你还没说清省份，我先按内置样本做方向盘点。'
  const dataLine = meta
    ? `当前 Web 复刻加载的是轻量样本：${formatNumber(meta.sampleRows)} 行，覆盖 ${meta.provinces.join('、')}；完整库请以原项目和考试院为准。`
    : '当前使用内置样本数据。'
  const ask = [
    !parsed.subject ? '选科/科类' : '',
    !parsed.majors.length ? '想学和排斥的专业' : '',
    !parsed.rank ? '全省位次' : '',
    '家庭资源与就业偏好',
  ].filter(Boolean)

  return [
    policyLine,
    `识别结果：${parsed.province || '省份未知'}，${parsed.score || '-'} 分，${parsed.rank ? `${formatNumber(parsed.rank)} 位` : '位次未知'}，方向：${parsed.majors.join('、') || '未限定'}。`,
    dataLine,
    '',
    bandLines('冲', recommendations.chong),
    '',
    bandLines('稳', recommendations.wen),
    '',
    bandLines('保', recommendations.bao),
    '',
    result.warnings.length ? `提醒：${result.warnings.join(' ')}` : '提醒：优先看位次，不要只看分数；所有学校仍需回到省考试院和学校招生网复核。',
    `我还需要你补充：${ask.slice(0, 2).join('、')}。`,
  ].join('\n')
}

export function buildFunReply(text: string, result: AdvisorResult) {
  const { parsed } = result
  if (!parsed.score && !parsed.rank) {
    return `这条问题还缺关键数据。\n把省份、分数、位次、选科补上，我才能帮你盘出冲稳保。可以这样发：浙江物理类655分，位次10500，想学计算机电子。`
  }
  const major = parsed.majors[0] || '热门专业'
  return [
    `我先按娱乐模式给你做一个快速判断。`,
    `你这条信息里我抓到的是：${parsed.province || '省份没说'}，${parsed.score || '-'} 分，${parsed.rank ? `${formatNumber(parsed.rank)} 位` : '位次没说'}，想看 ${major}。`,
    `别光盯学校名，普通家庭更要看专业壁垒、城市机会和能不能就业。${major.includes('金融') || text.includes('金融') ? '金融听着光鲜，没资源就要谨慎。' : '技术类方向可以看，但别闭眼冲冷门组。'}`,
    `我已经在右边按样本库切了冲稳保，正经填报还是切回“报考”模式逐条核数据。`,
  ].join('\n')
}
