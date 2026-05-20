import * as fs from 'fs';
import * as path from 'path';

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.rs'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', '.next', 'build', 'coverage', '__pycache__', 'uploads'];

interface ScoredFile {
  filePath: string;
  score: number;
}

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (IGNORE_DIRS.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getAllSourceFiles(fullPath));
      } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction: split by common separators, filter short words
  const words = text
    .replace(/[^\w\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .map(w => w.toLowerCase());
  // Deduplicate
  return Array.from(new Set(words));
}

function scoreFile(filePath: string, keywords: string[], rootDir: string): number {
  const relativePath = path.relative(rootDir, filePath).toLowerCase();
  let score = 0;

  // Path name match
  for (const kw of keywords) {
    if (relativePath.includes(kw)) score += 10;
  }

  // Content match
  try {
    const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
    for (const kw of keywords) {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = content.match(regex);
      if (matches) score += matches.length;
    }
  } catch {
    // Can't read file
  }

  return score;
}

function extractRelevantLines(lines: string[], keywords: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;

  // Score each line
  const scored = lines.map((line, i) => ({
    index: i,
    score: keywords.reduce((s, kw) => {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = line.match(regex);
      return s + (matches ? matches.length : 0);
    }, 0)
  }));

  // Take top scoring lines, sorted by position
  const topLines = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLines)
    .sort((a, b) => a.index - b.index);

  return topLines.map(l => lines[l.index]);
}

export interface CodeContext {
  filePath: string;
  content: string;
}

export function scanCodebase(
  rootDir: string,
  description: string,
  maxFiles = 5,
  maxLinesPerFile = 150
): CodeContext[] {
  const keywords = extractKeywords(description);
  if (keywords.length === 0) return [];

  const files = getAllSourceFiles(rootDir);
  if (files.length === 0) return [];

  const scored: ScoredFile[] = files.map(f => ({
    filePath: f,
    score: scoreFile(f, keywords, rootDir)
  }));

  const results: CodeContext[] = [];
  for (const { filePath, score } of scored.sort((a, b) => b.score - a.score).slice(0, maxFiles)) {
    if (score <= 0) break;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relevant = extractRelevantLines(lines, keywords, maxLinesPerFile);
      results.push({
        filePath: path.relative(rootDir, filePath),
        content: relevant.join('\n'),
      });
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

export function formatContext(contexts: CodeContext[]): string {
  if (contexts.length === 0) return '';
  return contexts
    .map(c => `--- ${c.filePath} ---\n${c.content}`)
    .join('\n\n');
}
