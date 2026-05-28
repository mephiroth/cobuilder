"use client";

interface VoteButtonProps {
  votes: number;
  hasVoted: boolean;
  loading: boolean;
  onVote: () => void;
  size?: "sm" | "lg";
}

export default function VoteButton({
  votes,
  hasVoted,
  loading,
  onVote,
  size = "sm",
}: VoteButtonProps) {
  if (size === "lg") {
    return (
      <button
        onClick={onVote}
        disabled={loading || hasVoted}
        className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${
          hasVoted
            ? "bg-gold-subtle text-gold border-gold-border cursor-default"
            : "bg-surface hover:bg-gold-subtle text-ink hover:text-gold border-border hover:border-gold-border active:scale-[0.97]"
        } disabled:opacity-60`}
      >
        {loading ? (
          <div className="spinner spinner-sm" />
        ) : (
          <svg
            className={`w-4 h-4 transition-colors ${hasVoted ? "text-gold" : "text-muted"}`}
            fill={hasVoted ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
        <span>{hasVoted ? "已投票" : "投票支持"}</span>
        <span className="font-bold text-base">{votes}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onVote}
      disabled={loading || hasVoted}
      className={`vote-btn ${hasVoted ? "voted" : ""} disabled:opacity-60`}
      title={hasVoted ? "已投票" : "投票支持"}
    >
      {loading ? (
        <div className="spinner spinner-sm" />
      ) : (
        <svg
          className="w-3.5 h-3.5"
          fill={hasVoted ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      )}
      <span className="text-xs font-bold leading-none">{votes}</span>
    </button>
  );
}
