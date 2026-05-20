"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import PipelineView from "@/components/PipelineView";
import RequirementDocViewer from "@/components/RequirementDocViewer";

interface Idea {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  author_name: string;
  author_contact?: string;
  clarification_doc?: string;
  version?: string;
  screenshots: string;
  source: string;
  visible: number;
  moderation_status: string;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  idea_id: string;
  author_name: string;
  content: string;
  is_admin: number;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "待澄清" },
  { value: "clarified", label: "已澄清" },
  { value: "in_progress", label: "进行中" },
  { value: "published", label: "已实现" },
  { value: "deferred", label: "已搁置" },
  { value: "closed", label: "已关闭" },
];

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cobuilder_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminIdeaEditorPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const ideaId = params.id;

  const [idea, setIdea] = useState<Idea | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Editable fields
  const [description, setDescription] = useState("");
  const [clarificationDoc, setClarificationDoc] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState("");
  const [visible, setVisible] = useState(false);

  // AI Clarify
  const [clarifying, setClarifying] = useState(false);
  const [clarifyResult, setClarifyResult] = useState<string | null>(null);

  const fetchIdea = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/admin/ideas/${ideaId}`, { headers });
      if (!res.ok) throw new Error("加载想法失败");
      const data = await res.json();
      setIdea(data);
      setDescription(data.description || "");
      setClarificationDoc(data.clarification_doc || "");
      setStatus(data.status || "pending");
      setVersion(data.version || "");
      setVisible(data.visible === 1);

      // Fetch comments
      const commentsRes = await fetch(`/api/ideas/${ideaId}/comments`, {
        headers,
      });
      if (commentsRes.ok) {
        setComments(await commentsRes.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchIdea();
  }, [fetchIdea]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };
      const res = await fetch(`/api/admin/ideas/${ideaId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          description,
          clarification_doc: clarificationDoc || undefined,
          status,
          version: version || undefined,
          visible: visible ? 1 : 0,
        }),
      });

      if (!res.ok) throw new Error("保存失败");

      setSaveMessage("已保存");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleClarify = async () => {
    setClarifying(true);
    setClarifyResult(null);

    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };
      const res = await fetch(`/api/admin/ideas/${ideaId}/clarify`, {
        method: "POST",
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "AI 澄清失败");
      }

      const data = await res.json();
      setClarifyResult(data.clarification || data.content || "澄清完成");
      // Reload to get updated data
      fetchIdea();
    } catch (e) {
      setClarifyResult(`错误: ${e instanceof Error ? e.message : "AI 澄清失败"}`);
    } finally {
      setClarifying(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("确定要删除这条评论吗？")) return;

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/admin/comments/${commentId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这个想法吗？此操作不可撤销。")) return;

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/admin/ideas/${ideaId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        window.location.href = "/admin";
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">想法不存在</p>
        <Link href="/admin" className="text-sm text-gold hover:text-gold-light mt-2 inline-block">
          返回列表
        </Link>
      </div>
    );
  }

  const screenshots: string[] = (() => {
    try {
      return JSON.parse(idea.screenshots || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-lg font-bold text-ink truncate">
            {idea.title}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            by {idea.author_name} · {formatDate(idea.created_at)} · {idea.votes} 票
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pipeline View */}
          <PipelineView ideaId={ideaId} />

          {/* Description */}
          <div className="bg-paper rounded-xl border border-border p-5">
            <label className="block text-sm font-medium text-ink mb-2">
              原始描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-lg bg-cream border border-border text-sm text-ink font-mono leading-relaxed focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all resize-none"
            />
            {/* Screenshots Preview */}
            {screenshots.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {screenshots.map((url: string, i: number) => (
                  <div
                    key={i}
                    className="aspect-video rounded-lg overflow-hidden bg-cream border border-border"
                  >
                    <img
                      src={url}
                      alt={`截图 ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clarification Doc */}
          <div className="bg-paper rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink">
                澄清文档
              </label>
              <button
                onClick={handleClarify}
                disabled={clarifying}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-light disabled:opacity-50 transition-colors"
              >
                {clarifying ? (
                  <div className="w-3.5 h-3.5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
                {clarifying ? "AI 澄清中..." : "AI 自动澄清"}
              </button>
            </div>
            <textarea
              value={clarificationDoc}
              onChange={(e) => setClarificationDoc(e.target.value)}
              placeholder="AI 澄清后的文档将显示在这里，也可以手动编辑..."
              rows={10}
              className="w-full px-4 py-3 rounded-lg bg-cream border border-border text-sm text-ink font-mono leading-relaxed focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all resize-none placeholder:text-muted/40"
            />
            {clarifyResult && (
              <div className="mt-3 p-3 rounded-lg bg-gold/5 border border-gold/20">
                <p className="text-xs font-medium text-gold mb-1">
                  {clarifyResult.startsWith("错误") ? "操作结果" : "AI 澄清完成"}
                </p>
                <div className="prose prose-xs max-w-none text-sm text-ink/70">
                  <ReactMarkdown>{clarifyResult}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Requirement Doc Viewer */}
          <RequirementDocViewer ideaId={ideaId} />

          {/* Comments */}
          <div className="bg-paper rounded-xl border border-border p-5">
            <h3 className="text-sm font-medium text-ink mb-4">
              评论 ({comments.length})
            </h3>
            {comments.length === 0 ? (
              <p className="text-sm text-muted/60">暂无评论</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex gap-3 p-3 rounded-lg bg-cream"
                  >
                    <div className="w-7 h-7 rounded-full bg-paper border border-border flex items-center justify-center shrink-0">
                      {comment.is_admin ? (
                        <span className="text-xs font-bold text-gold">管</span>
                      ) : (
                        <span className="text-xs text-muted">
                          {comment.author_name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-ink">
                          {comment.author_name}
                        </span>
                        {comment.is_admin ? (
                          <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-gold/10 text-gold">
                            管理员
                          </span>
                        ) : null}
                        <span className="text-[11px] text-muted/70">
                          {formatDate(comment.created_at)}
                        </span>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-auto text-[11px] text-red-400 hover:text-red-600 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                      <div className="text-xs text-ink/70 leading-relaxed">
                        {comment.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Status + Version */}
          <div className="bg-paper rounded-xl border border-border p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                状态
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-cream border border-border text-sm text-ink focus:outline-none focus:border-gold/40 transition-all"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                版本号
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
                className="w-full px-3 py-2 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/40 focus:outline-none focus:border-gold/40 transition-all"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20"
                />
                <span className="text-sm text-ink">对外可见</span>
              </label>
              <p className="text-xs text-muted/60 mt-1 ml-6">
                {visible
                  ? "用户可以在前台看到这个想法"
                  : "这个想法仅管理员可见"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-paper rounded-xl border border-border p-5 space-y-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-light disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-all"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {saving ? "保存中..." : "保存"}
            </button>

            {saveMessage && (
              <p
                className={`text-xs text-center ${
                  saveMessage === "已保存"
                    ? "text-status-published"
                    : "text-red-500"
                }`}
              >
                {saveMessage}
              </p>
            )}

            <button
              onClick={handleDelete}
              className="w-full inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2.5 rounded-lg text-sm transition-all border border-red-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除想法
            </button>
          </div>

          {/* Meta Info */}
          <div className="bg-paper rounded-xl border border-border p-5">
            <h3 className="text-xs font-medium text-muted mb-3">信息</h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">来源</dt>
                <dd className="text-ink font-medium">{idea.source}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">审核状态</dt>
                <dd className="text-ink font-medium">{idea.moderation_status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">更新时间</dt>
                <dd className="text-ink font-medium">{formatDate(idea.updated_at)}</dd>
              </div>
              {idea.author_contact && (
                <div className="flex justify-between">
                  <dt className="text-muted">联系方式</dt>
                  <dd className="text-ink font-medium">{idea.author_contact}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">ID</dt>
                <dd className="text-ink font-mono text-[10px] truncate max-w-[140px]">
                  {idea.id}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
