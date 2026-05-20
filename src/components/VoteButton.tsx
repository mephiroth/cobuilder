"use client";

import React, { useState, useEffect, useCallback } from "react";

function getVotedIdeas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("voted_ideas");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setVotedIdeas(ideas: string[]) {
  localStorage.setItem("voted_ideas", JSON.stringify(ideas));
}

function getVoterId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("voter_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("voter_id", id);
  }
  return id;
}

interface VoteButtonProps {
  ideaId: string;
  initialCount: number;
}

export default function VoteButton({ ideaId, initialCount }: VoteButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [hasVoted, setHasVoted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setHasVoted(getVotedIdeas().includes(ideaId));
  }, [ideaId]);

  const handleVote = useCallback(async () => {
    if (hasVoted) return;

    const voterId = getVoterId();
    if (!voterId) return;

    try {
      const res = await fetch(`/api/ideas/${ideaId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter_id: voterId }),
      });

      if (res.ok) {
        setAnimating(true);
        setCount((prev) => prev + 1);
        setHasVoted(true);
        setVotedIdeas([...getVotedIdeas(), ideaId]);

        setTimeout(() => setAnimating(false), 300);
      }
    } catch (err) {
      console.error("Vote failed:", err);
    }
  }, [hasVoted, ideaId]);

  return (
    <button
      onClick={handleVote}
      disabled={hasVoted}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${
        hasVoted
          ? "bg-[#8B6914]/10 text-[#8B6914] cursor-not-allowed"
          : "bg-white border border-[#E8E4DE] text-[#8B6914] hover:border-[#8B6914] hover:bg-[#8B6914]/5 cursor-pointer"
      }`}
    >
      <svg
        className={`w-5 h-5 transition-transform duration-300 ${
          animating ? "scale-125" : "scale-100"
        }`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span
        className={`text-sm font-bold transition-transform duration-300 ${
          animating ? "scale-110" : "scale-100"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
