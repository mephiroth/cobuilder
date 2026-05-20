import React from "react";
import Markdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-slate max-w-none text-[#2C2C2C]">
      <Markdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-3xl font-bold mt-6 mb-3 text-[#2C2C2C]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-2xl font-bold mt-5 mb-2 text-[#2C2C2C]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-xl font-bold mt-4 mb-2 text-[#2C2C2C]">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-serif text-lg font-bold mt-3 mb-1 text-[#2C2C2C]">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[#2C2C2C] leading-relaxed mb-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 text-[#2C2C2C]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 text-[#2C2C2C]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-[#2C2C2C]">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#8B6914] pl-4 italic text-gray-600 my-3">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-gray-100 text-[#8B6914] px-1.5 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className ?? ""} block`}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-4 text-sm font-mono">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-[#8B6914] underline hover:text-[#6B5010] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-[#E8E4DE] my-6" />,
          strong: ({ children }) => (
            <strong className="font-bold text-[#2C2C2C]">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#2C2C2C]">{children}</em>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
