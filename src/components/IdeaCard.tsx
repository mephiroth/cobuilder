"use client";

import React from "react";
import { useRouter } from "next/navigation";
import StatusTag from "./StatusTag";

interface IdeaCardProps {
  id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  author_name: string;
  comment_count: number;
  created_at: string;
  project_id: string;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHr < 24) return `${diffHr}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
  return `${Math.floor(diffDay / 365)}年前`;
}

export default function IdeaCard({
  id,
  title,
  description,
  status,
  votes,
  author_name,
  comment_count,
  created_at,
  project_id,
}: IdeaCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/ideas/${id}`)}
      className="flex items-start gap-4 bg-white rounded-xl shadow-sm border border-[#E8E4DE] p-4 cursor-pointer hover:shadow-md transition-shadow duration-200"
    >
      {/* Vote section */}
      <div className="flex flex-col items-center gap-1 min-w-[48px] pt-1">
        <svg
          className="w-5 h-5 text-[#8B6914]"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-lg font-bold text-[#8B6914]">{votes}</span>
      </div>

      {/* Content section */}
      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-lg font-bold text-[#2C2C2C] mb-1 truncate">
          {title}
        </h3>

        <p className="text-sm text-gray-500 line-clamp-2 mb-2">
          {description}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusTag status={status} size="sm" />

          <div className="flex items-center gap-3 ml-auto text-xs text-gray-400">
            <span>{author_name}</span>
            <span>·</span>
            <span>{relativeTime(created_at)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {comment_count}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
