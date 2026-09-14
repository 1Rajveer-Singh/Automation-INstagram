import { ScheduledPost } from '../types/instagram';

export interface ParsedSpreadsheetPost {
  dateStr: string;
  dayOfWeek: string;
  timeStr: string;
  platform: string;
  status: 'PLANNED' | 'QUEUED' | 'PUBLISHED' | 'FAILED';
  contentPillar: string;
  postTopic: string;
  visualType: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'REELS' | 'CAROUSEL';
  thumbnailUrl: string;
  caption: string;
  finalContentLink: string;
  mediaUrl: string;
  designReference: string;
  scheduledTime: string;
  carouselMedia?: string;
  coverUrl?: string;
  hashtags?: string;
  locationName?: string;
  altText?: string;
  song?: string;
  tag?: string;
  competitorDiscovery?: string;
  createdAt?: string;
}

const FIELD_SYNONYMS: Record<string, string[]> = {
  date: ['date', 'publish date', 'scheduled date', 'post date', 'schedule date'],
  day: ['day', 'day of week', 'weekday'],
  time: ['publish_time', 'publish time', 'publishtime', 'time', 'scheduled time', 'post time', 'slot'],
  platform: ['platform', 'network', 'channel', 'social platform'],
  status: ['status', 'post status', 'state'],
  contentPillar: ['content pillar', 'pillar', 'category', 'theme', 'bucket'],
  postTopic: ['post topic', 'topic', 'title', 'headline', 'subject', 'concept'],
  visualType: ['visual type', 'visual_type', 'format', 'media type', 'type', 'content type'],
  mediaUrl: ['media url', 'media_url', 'media', 'final content link', 'content link', 'image url', 'video url', 'media link', 'file link', 'asset link'],
  carouselMedia: ['carousel media', 'carousel images', 'carousel urls', 'carousel slides', 'carousel items', 'carousel', 'slides'],
  coverUrl: ['cover url', 'cover_url', 'cover', 'thumbnail link', 'thumbnail url', 'thumbnail', 'thumb'],
  caption: ['caption', 'post caption', 'content', 'copy', 'text', 'description', 'body', 'post text'],
  hashtags: ['hashtags', 'tags list', 'hashtag list', 'hash tags'],
  locationName: ['location', 'location name', 'location_name', 'place', 'geo', 'city'],
  scheduledAt: ['scheduled at', 'schedule at', 'scheduled time', 'publish at'],
  altText: ['alt text', 'alternative text', 'image description', 'accessibility text', 'alt'],
  song: ['song', 'audio', 'sound', 'music', 'trending audio', 'track', 'song name'],
  tag: ['tag', 'tags', 'collaborator', 'mentions', 'user tag', 'user tags', 'collab', 'collabs'],
  competitorDiscovery: ['competitor discovery', 'discovery competitor', 'competitor post', 'competitor url', 'competing post', 'discovery compititor', 'competitor'],
  createdAt: ['created at', 'creation time', 'added at', 'date created'],
  designReference: ['design reference', 'reference link', 'reference', 'inspiration', 'ref link', 'ig reference', 'link reference'],
};

function normalizeHeader(h: string): string {
  return (h || '')
    .toLowerCase()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanUrl(str: string): string {
  if (!str) return '';
  const s = str.trim();
  // Markdown link [url](url) or [text](url)
  const mdMatch = s.match(/\[.*?\]\((https?:\/\/.*?)\)/i);
  if (mdMatch) return mdMatch[1].trim();

  // Raw URL match
  const rawMatch = s.match(/https?:\/\/[^\s\)'"]+/i);
  if (rawMatch) return rawMatch[0].replace(/[\[\]\(\)'"]/g, '').trim();

  return s;
}

function isUrl(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  return /^(https?:\/\/|www\.)/i.test(s) || /^\[.*?\]\(https?:\/\//i.test(s) || /^\[https?:\/\//i.test(s);
}

function normalizeMediaType(vType: string): 'IMAGE' | 'VIDEO' | 'REELS' | 'CAROUSEL' {
  const lower = (vType || '').toLowerCase().trim();
  if (lower.includes('reel')) return 'REELS';
  if (lower.includes('carousel') || lower.includes('album') || lower.includes('slide')) return 'CAROUSEL';
  if (lower.includes('video') || lower.includes('mp4') || lower.includes('mov')) return 'VIDEO';
  return 'IMAGE';
}

function normalizeStatus(st: string): 'PLANNED' | 'QUEUED' | 'PUBLISHED' | 'FAILED' {
  const upper = (st || '').toUpperCase().trim();
  if (upper === 'PUBLISHED') return 'PUBLISHED';
  if (upper === 'FAILED') return 'FAILED';
  if (upper === 'QUEUED' || upper === 'READY' || upper === 'SCHEDULED') return 'QUEUED';
  return 'PLANNED';
}

function buildScheduledIsoTime(dateStr?: string, timeStr?: string): string {
  const now = new Date();
  if (!dateStr && !timeStr) {
    return new Date(now.getTime() + 4 * 3600000).toISOString();
  }

  const cleanDate = (dateStr || '').trim();
  const cleanTime = (timeStr || '').trim();

  if (cleanDate && cleanTime) {
    const combined = `${cleanDate} ${cleanTime}`;
    const parsed = new Date(combined);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }

  if (cleanDate) {
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date(now.getTime() + 4 * 3600000).toISOString();
}

/**
 * Robust State-Machine Delimited Text Parser (handles multiline cells, quotes, BOM, commas, tabs, semicolons)
 */
function parseDelimitedRows(text: string, delimiter?: string): string[][] {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  // Auto-detect delimiter if not specified
  let delim = delimiter;
  if (!delim) {
    const firstLine = clean.split(/\r?\n/)[0] || '';
    if (firstLine.includes('\t')) {
      delim = '\t';
    } else {
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      delim = semicolonCount > commaCount ? ';' : ',';
    }
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delim && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \r\n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Matches a header string against known synonym lists
 */
function mapHeaderToFieldKey(header: string): string | null {
  const norm = normalizeHeader(header);
  for (const [fieldKey, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      if (norm === syn || norm.replace(/\s+/g, '') === syn.replace(/\s+/g, '')) {
        return fieldKey;
      }
    }
  }
  // Secondary fuzzy contains check
  for (const [fieldKey, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      if (norm.includes(syn) || syn.includes(norm)) {
        return fieldKey;
      }
    }
  }
  return null;
}

/**
 * Primary Spreadsheet Entrypoint: Parses CSV, TSV, or Multiline Block formats
 */
export function parseSpreadsheet(rawText: string): ParsedSpreadsheetPost[] {
  if (!rawText || !rawText.trim()) return [];

  const cleanText = rawText.trim();

  // Test standard delimited parsing (CSV / TSV)
  const delimitedRows = parseDelimitedRows(cleanText);

  // If we have at least 2 rows and row 0 has recognizable headers:
  if (delimitedRows.length >= 2) {
    const headerRow = delimitedRows[0];
    const recognizedCount = headerRow.filter(h => mapHeaderToFieldKey(h) !== null).length;

    // If at least 2 columns match known headers, it's a valid CSV/TSV table!
    if (recognizedCount >= 2) {
      const fieldKeys = headerRow.map(h => mapHeaderToFieldKey(h));
      const results: ParsedSpreadsheetPost[] = [];

      for (let r = 1; r < delimitedRows.length; r++) {
        const row = delimitedRows[r];
        if (row.every(cell => !cell || !cell.trim())) continue;

        const rowObj: Record<string, string> = {};
        fieldKeys.forEach((key, idx) => {
          if (key && row[idx] !== undefined) {
            rowObj[key] = row[idx].trim();
          }
        });

        results.push(createPostFromNormalizedRow(rowObj));
      }

      if (results.length > 0) {
        return results;
      }
    }
  }

  // Otherwise, attempt Multiline Block Parsing (e.g. user pasted header list + value lines)
  return parseBlockSpreadsheet(cleanText);
}

function parseBlockSpreadsheet(text: string): ParsedSpreadsheetPost[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  // Check if text starts with a sequence of known headers
  let headerCount = 0;
  while (headerCount < lines.length && headerCount < 20) {
    const key = mapHeaderToFieldKey(lines[headerCount]);
    if (key) {
      headerCount++;
    } else {
      break;
    }
  }

  if (headerCount >= 4) {
    const headers = lines.slice(0, headerCount);
    const valueLines = lines.slice(headerCount);
    return [parseVerticalBlockValues(headers, valueLines)];
  }

  // Fallback: Check for Key: Value pairs e.g. "Date: 22 Jul 2026"
  const rowObj: Record<string, string> = {};
  const captionLines: string[] = [];

  lines.forEach(line => {
    const match = line.match(/^([a-zA-Z\s]{2,30})[:=]\s*(.*)$/);
    if (match) {
      const key = mapHeaderToFieldKey(match[1]);
      if (key) {
        rowObj[key] = match[2].trim();
        return;
      }
    }
    captionLines.push(line);
  });

  if (!rowObj['caption']) {
    rowObj['caption'] = captionLines.join('\n');
  }

  return [createPostFromNormalizedRow(rowObj)];
}

function parseVerticalBlockValues(headerLines: string[], valueLines: string[]): ParsedSpreadsheetPost {
  const rowObj: Record<string, string> = {};
  const keys = headerLines.map(h => mapHeaderToFieldKey(h) || normalizeHeader(h));
  let valIdx = 0;

  for (const key of keys) {
    if (key === 'caption') {
      // Once we reach caption, all subsequent lines up to URLs belong to caption
      break;
    }

    if (valIdx >= valueLines.length) break;
    const val = valueLines[valIdx];

    // If this field is a link/URL but the line is plain text/sentences, the link cell was empty
    if ((key === 'thumbnailLink' || key === 'finalContentLink' || key === 'designReference') && !isUrl(val)) {
      continue;
    }

    rowObj[key] = val;
    valIdx++;
  }

  // All remaining lines: separate text into caption and trailing URLs into links
  const remaining = valueLines.slice(valIdx);
  const captionBuffer: string[] = [];
  const extractedUrls: string[] = [];

  remaining.forEach(line => {
    if (isUrl(line) && line.length < 300) {
      extractedUrls.push(cleanUrl(line));
    } else {
      captionBuffer.push(line);
    }
  });

  if (!rowObj['caption']) {
    rowObj['caption'] = captionBuffer.join('\n').trim();
  }

  // Intelligently assign extracted URLs
  extractedUrls.forEach(url => {
    if (url.includes('instagram.com/p/') || url.includes('instagram.com/reel/')) {
      if (!rowObj['designReference']) rowObj['designReference'] = url;
    } else if (!rowObj['thumbnailLink'] && (url.includes('.jpg') || url.includes('.png') || url.includes('unsplash') || url.includes('thumb'))) {
      rowObj['thumbnailLink'] = url;
    } else if (!rowObj['finalContentLink']) {
      rowObj['finalContentLink'] = url;
    } else if (!rowObj['designReference']) {
      rowObj['designReference'] = url;
    }
  });

  return createPostFromNormalizedRow(rowObj);
}

function createPostFromNormalizedRow(fields: Record<string, string>): ParsedSpreadsheetPost {
  const dateStr = fields['date'] || '';
  const dayOfWeek = fields['day'] || '';
  const timeStr = fields['time'] || '';
  const platform = fields['platform'] || 'Instagram';
  const status = normalizeStatus(fields['status'] || 'Planned');
  const contentPillar = fields['contentPillar'] || fields['pillar'] || '';
  const postTopic = fields['postTopic'] || fields['topic'] || fields['title'] || '';
  const visualType = fields['visualType'] || fields['format'] || fields['type'] || 'Reel';
  const mediaType = normalizeMediaType(visualType);
  const coverUrl = cleanUrl(fields['coverUrl'] || fields['thumbnailLink'] || fields['thumbnail'] || '');
  const thumbnailUrl = coverUrl;
  let caption = fields['caption'] || fields['content'] || fields['text'] || '';
  const hashtags = fields['hashtags'] || '';
  const locationName = fields['locationName'] || '';
  const altText = fields['altText'] || '';
  const song = fields['song'] || fields['audio'] || fields['sound'] || fields['music'] || '';
  const tag = fields['tag'] || fields['collaborator'] || fields['mentions'] || '';
  const createdAt = fields['createdAt'] || new Date().toISOString();
  const carouselMedia = fields['carouselMedia'] || '';
  const designReference = cleanUrl(fields['designReference'] || fields['reference'] || '');
  
  // Combine hashtags into caption if present and not already in caption
  if (hashtags && !caption.includes(hashtags.trim())) {
    caption = `${caption}\n\n${hashtags}`.trim();
  }

  // Final content / media URL
  const mediaUrl = cleanUrl(fields['mediaUrl'] || fields['finalContentLink'] || '');
  const finalContentLink = mediaUrl;

  // Scheduled time from scheduledAt or date/time
  let scheduledTime = '';
  if (fields['scheduledAt']) {
    const parsed = new Date(fields['scheduledAt']);
    if (!isNaN(parsed.getTime())) scheduledTime = parsed.toISOString();
  }
  if (!scheduledTime) {
    scheduledTime = buildScheduledIsoTime(dateStr, timeStr);
  }

  return {
    dateStr,
    dayOfWeek,
    timeStr,
    platform,
    status,
    contentPillar,
    postTopic,
    visualType,
    mediaType: carouselMedia ? 'CAROUSEL' : mediaType,
    thumbnailUrl,
    caption,
    finalContentLink,
    mediaUrl: carouselMedia ? (carouselMedia.split(/[\n,;]+/)[0]?.trim() || mediaUrl) : mediaUrl,
    designReference,
    scheduledTime,
    carouselMedia,
    coverUrl,
    hashtags,
    locationName,
    altText,
    song,
    tag,
    createdAt,
  };
}

/**
 * Generates the professional Scheduler Queue CSV Template with the 10 specified fields:
 * Date, Day, Publish_Time, Status, Visual Type, Media url, cover url, caption, location, tag
 */
export function getSpreadsheetTemplateCsv(): string {
  const headers = [
    'Date',
    'Day',
    'Publish_Time',
    'Status',
    'Visual Type',
    'Media url',
    'cover url',
    'caption',
    'location',
    'tag',
  ];

  const escapeCsv = (str: string = '') => `"${(str || '').replace(/"/g, '""')}"`;

  const sampleRows = [
    [
      escapeCsv('22 Jul 2026'),
      escapeCsv('Wednesday'),
      escapeCsv('06:00 PM'),
      escapeCsv('QUEUED'),
      escapeCsv('Single Post'),
      escapeCsv('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'),
      escapeCsv('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'),
      escapeCsv('Stop scrolling if you want to scale results in your business! 🚀\n\nMost people overlook the fundamental mechanics of consistent organic reach. When you align your positioning with high-intent search, reach multiplies.\n\n👉 Share this with someone who needs this!\n💬 Comment "GROW" for our private guide.\n\n#growth #creators #instagramtips #strategy'),
      escapeCsv('New York, NY'),
      escapeCsv('@creatorgrowth'),
    ],
    [
      escapeCsv('23 Jul 2026'),
      escapeCsv('Thursday'),
      escapeCsv('07:30 PM'),
      escapeCsv('QUEUED'),
      escapeCsv('Carousel'),
      escapeCsv('https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80'),
      escapeCsv('https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80'),
      escapeCsv('The 3-Step Practical Framework to 10x your profile reach. 👉 Swipe through for the teardown!\n\nSave this carousel for your next content sprint! 📌\n\n#strategy #instagramgrowth #marketing #business'),
      escapeCsv('Los Angeles, CA'),
      escapeCsv('@marketinglead'),
    ],
    [
      escapeCsv('24 Jul 2026'),
      escapeCsv('Friday'),
      escapeCsv('05:00 PM'),
      escapeCsv('PLANNED'),
      escapeCsv('Single Post'),
      escapeCsv('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80'),
      escapeCsv('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80'),
      escapeCsv('Real creators build in public. Here is our creative sprint workspace setup this Friday. 👇\n\nWhat are your weekend goals?\n\n#community #buildinpublic #behindthescenes #work'),
      escapeCsv('Austin, TX'),
      escapeCsv('@agencyhub'),
    ],
  ];

  return ['\uFEFF' + headers.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n');
}

/**
 * Exports ScheduledPosts array into standard CSV format matching the 10 fields
 */
export function exportQueueToCsv(posts: ScheduledPost[]): string {
  const headers = [
    'Date',
    'Day',
    'Publish_Time',
    'Status',
    'Visual Type',
    'Media url',
    'cover url',
    'caption',
    'location',
    'tag',
  ];

  const escapeCsv = (str: string = '') => `"${(str || '').replace(/"/g, '""')}"`;

  const rows = posts.map(p => {
    const d = p.scheduledTime ? new Date(p.scheduledTime) : new Date();
    const dateStr = p.dateStr || d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayStr = p.dayOfWeek || d.toLocaleDateString('en-US', { weekday: 'long' });
    const timeStr = p.timeStr || d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return [
      escapeCsv(dateStr),
      escapeCsv(dayStr),
      escapeCsv(timeStr),
      escapeCsv(p.status || 'QUEUED'),
      escapeCsv(p.visualType || p.mediaType || 'Reel'),
      escapeCsv(p.mediaUrl || p.finalContentLink || ''),
      escapeCsv(p.coverUrl || p.thumbnailUrl || ''),
      escapeCsv(p.caption || ''),
      escapeCsv(p.locationName || ''),
      escapeCsv(p.tag || ''),
    ].join(',');
  });

  return ['\uFEFF' + headers.join(','), ...rows].join('\r\n');
}
