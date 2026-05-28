import Link from "next/link";
import StatusTag from "./StatusTag";

interface IdeaCardProps {
  id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  authorName: string;
  createdAt: string;
  commentCount?: number;
  animationDelay?: number;
}

function formatRelativeTime(dateStr: string) {
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*+]\s/gm, "")
    .replace(/^>\s/gm, "")
    .trim();
}

export default function IdeaCard({
  id,
  title,
  description,
  status,
  votes,
  authorName,
  createdAt,
  commentCount,
  animationDelay = 0,
}: IdeaCardProps) {
  const cleanDesc = stripMarkdown(description);
  const truncated = cleanDesc.length > 110 ? cleanDesc.slice(0, 110) + "…" : cleanDesc;

  return (
    <Link
      href={`/ideas/${id}`}
      className="group card card-hover block p-5 animate-fade-in"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex gap-4">
        {/* Vote Column */}
        <div className="flex-shrink-0 flex flex-col items-center pt-0.5">
          <div className="vote-btn group-hover:border-gold-border group-hover:bg-gold-subtle group-hover:text-gold">
            <svg
              className="w-3.5 h-3.5 text-muted group-hover:text-gold transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            <span className="text-xs font-bold text-ink group-hover:text-gold transition-colors leading-none">
              {votes}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-serif text-[15px] font-bold text-ink group-hover:text-gold transition-colors leading-snug line-clamp-2">
              {title}
            </h3>
            <StatusTag status={status} size="sm" />
          </div>

          {/* Description */}
          <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-3">
            {truncated}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-muted-light">
            <span className="font-medium text-muted">{authorName}</span>
            <span>·</span>
            <span>{formatRelativeTime(createdAt)}</span>
            {commentCount !== undefined && commentCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {commentCount}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
