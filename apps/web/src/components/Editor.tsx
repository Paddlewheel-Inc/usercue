import {
  CHANGELOG_SECTIONS,
  type ChangelogSection,
  changelogSectionChip,
  changelogSectionLabel,
  IMAGE_WIDTH,
  isEmptyHtml,
  isPostHref,
  LIMITS,
  mentionChip,
  sanitizeHtml,
} from "@usercue/shared";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { uploadImage } from "../lib/api";
import { type EmojiMatch, emojiFor, loadEmoji, searchEmoji } from "../lib/emoji";
import { usePeople, usePosts } from "../lib/queries";
import {
  At,
  Bold,
  BulletList,
  Hash,
  Heading,
  Highlight,
  ImageIcon,
  Italic,
  LinkIcon,
  NumberedList,
  Underline,
} from "./icons";
import { Avatar, STATUS_DOT } from "./ui";

interface EditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
  mentions?: boolean;
  people?: boolean;
  headings?: boolean;
  sections?: boolean;
  excludeId?: number;
  autoFocus?: boolean;
}

interface EmojiMenu {
  items: EmojiMatch[];
  index: number;
  top: number;
  left: number;
}

interface ImageFrame {
  top: number;
  left: number;
  width: number;
  height: number;
}

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function caretText(root: HTMLElement | null) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const node = range.startContainer as Text;
  if (!root?.contains(node)) return null;
  const end = range.startOffset;
  return { node, end, text: node.data.slice(0, end) };
}

function readMention(root: HTMLElement | null) {
  const caret = caretText(root);
  const match = caret?.text.match(/(^|[\s\u00a0])#([^\s#]*)$/);
  if (!caret || !match) return null;
  const query = match[2] ?? "";
  return { node: caret.node, start: caret.end - query.length - 1, end: caret.end, query };
}

function readPing(root: HTMLElement | null) {
  const caret = caretText(root);
  const match = caret?.text.match(/(^|[\s\u00a0])@([^\s@]*)$/);
  if (!caret || !match) return null;
  const query = match[2] ?? "";
  return { node: caret.node, start: caret.end - query.length - 1, end: caret.end, query };
}

function readSlash(root: HTMLElement | null) {
  const caret = caretText(root);
  const match = caret?.text.match(/(^|[\s\u00a0])\/([a-zA-Z]*)$/);
  if (!caret || !match) return null;
  const query = match[2] ?? "";
  return { node: caret.node, start: caret.end - query.length - 1, end: caret.end, query };
}

function sectionMatches(query: string) {
  const q = query.trim().toLowerCase();
  return CHANGELOG_SECTIONS.filter((label) => !q || label.toLowerCase().startsWith(q));
}

function readShortcode(root: HTMLElement | null) {
  const caret = caretText(root);
  const match = caret?.text.match(/(?<![\w:]):([\w+-]+)(:?)$/);
  if (!caret || !match) return null;
  return {
    node: caret.node,
    start: caret.end - match[0].length,
    end: caret.end,
    name: match[1] ?? "",
    closed: match[2] === ":",
  };
}

function linkHref(value: string) {
  if (isPostHref(value)) return value;
  if (/^(?:https?:\/\/|mailto:)\S+$/i.test(value)) return value;
  if (/^[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?$/.test(value)) return `https://${value}`;
  return null;
}

function imageSrc(value: string) {
  return /^(?:https?:\/\/\S+|\/(?:api\/)?uploads\/[\w.-]+)$/i.test(value) ? value : null;
}

function wrapped(delimiter: string, char: string) {
  return `${delimiter}([^${char}\\s](?:[^${char}]*[^${char}\\s])?)${delimiter}`;
}

interface InlineRule {
  source: string;
  render: (match: RegExpMatchArray) => string | null;
}

const INLINE: InlineRule[] = [
  {
    source: String.raw`!\[([^\]]*)\]\(([^)\s]+)\)`,
    render: (m) => {
      const src = imageSrc(m[2] ?? "");
      return src ? `<img src="${src}" alt="${m[1] ?? ""}">` : null;
    },
  },
  {
    source: String.raw`(?<!!)\[([^\]]+)\]\(([^)\s]+)\)`,
    render: (m) => {
      const href = linkHref(m[2] ?? "");
      return href ? `<a href="${href}">${m[1]}</a>` : null;
    },
  },
  { source: wrapped(String.raw`\*\*`, "*"), render: (m) => `<b>${m[1]}</b>` },
  { source: wrapped("__", "_"), render: (m) => `<u>${m[1]}</u>` },
  { source: wrapped("==", "="), render: (m) => `<mark>${m[1]}</mark>` },
  {
    source: String.raw`(?<![\w*])${wrapped(String.raw`\*`, "*")}(?!\*)`,
    render: (m) => `<i>${m[1]}</i>`,
  },
  { source: String.raw`(?<!\w)${wrapped("_", "_")}(?!\w)`, render: (m) => `<i>${m[1]}</i>` },
];

const TYPED = INLINE.map((rule) => ({ ...rule, pattern: new RegExp(`(?:${rule.source})$`) }));
const PASTED = INLINE.map((rule) => ({ ...rule, pattern: new RegExp(rule.source, "g") }));
const TRIGGERS = new Set(["*", "_", "=", ")"]);

function inlineMarkdown(text: string) {
  const held: string[] = [];
  let out = escapeHtml(text);
  for (const rule of PASTED) {
    out = out.replace(rule.pattern, (...args) => {
      const html = rule.render(args.slice(0, -2) as RegExpMatchArray);
      if (!html) return args[0];
      held.push(html);
      return `\uE000${held.length - 1}\uE001`;
    });
  }
  return out.replace(/\uE000(\d+)\uE001/g, (_, i) => held[Number(i)] ?? "");
}

const MARKDOWN_HINT = new RegExp(
  [
    String.raw`^\s*(?:[-*+]|\d+[.)])\s`,
    String.raw`^#{1,3}\s`,
    ...INLINE.map((rule) => rule.source),
  ].join("|"),
  "m",
);

function markdownToHtml(text: string, headings: boolean) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  for (const line of lines) {
    const item = /^\s*(?:([-*+])|\d+[.)])\s+(.*)$/.exec(line);
    const kind = item ? (item[1] ? "ul" : "ol") : null;
    if (list && kind !== list) {
      out.push(`</${list}>`);
      list = null;
    }
    if (item && kind) {
      if (!list) out.push(`<${kind}>`);
      list = kind;
      out.push(`<li>${inlineMarkdown(item[2] ?? "")}</li>`);
      continue;
    }
    const heading = headings ? /^(#{1,3})\s+(.*)$/.exec(line) : null;
    if (heading) {
      const tag = heading[1]?.length === 3 ? "h3" : "h2";
      out.push(`<${tag}>${inlineMarkdown(heading[2] ?? "")}</${tag}>`);
    } else if (lines.length === 1) {
      out.push(inlineMarkdown(line));
    } else {
      out.push(line.trim() ? `<div>${inlineMarkdown(line)}</div>` : "<div><br></div>");
    }
  }
  if (list) out.push(`</${list}>`);
  return sanitizeHtml(out.join(""));
}

const EMOJI_MENU_WIDTH = 224;
const CARET_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

const BLOCKS = new Set(["DIV", "P", "LI", "UL", "OL", "H2", "H3"]);

function lineBefore(root: HTMLElement, node: Text, offset: number) {
  let text = node.data.slice(0, offset);
  let cur: Node = node;
  while (cur !== root) {
    for (let prev = cur.previousSibling; prev; prev = prev.previousSibling) {
      if (prev.nodeName === "BR" || BLOCKS.has(prev.nodeName)) return text;
      text = (prev.textContent ?? "") + text;
    }
    const parent = cur.parentNode;
    if (!parent || parent === root || BLOCKS.has(parent.nodeName)) return text;
    cur = parent;
  }
  return text;
}

function selectText(node: Text, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function Editor({
  value,
  onChange,
  placeholder = "Add more detail (optional)",
  maxLength = LIMITS.body,
  mentions = false,
  people = false,
  headings = false,
  sections = false,
  excludeId,
  autoFocus = false,
}: EditorProps) {
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const saved = useRef<Range | null>(null);
  const formatted = useRef<Element | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<ImageFrame | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState("https://");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mention, setMention] = useState<{ query: string; pinned?: boolean } | null>(null);
  const [ping, setPing] = useState<{ query: string; pinned?: boolean } | null>(null);
  const [slash, setSlash] = useState<{ query: string; index: number } | null>(null);
  const [emoji, setEmoji] = useState<EmojiMenu | null>(null);
  const filled = useRef(false);
  const slashItems = slash ? sectionMatches(slash.query) : [];

  useLayoutEffect(() => {
    if (filled.current) return;
    filled.current = true;
    const el = root.current;
    if (!el || value === "") return;
    el.innerHTML = sanitizeHtml(value);
    el.classList.toggle("is-empty", isEmptyHtml(el.innerHTML));
  }, [value]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (value === "" && el.innerHTML !== "") el.innerHTML = "";
  }, [value]);

  useEffect(() => {
    if (autoFocus) root.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!ping && !mention && !slash) return;
    function onPointer(event: Event) {
      const target = event.target as Node | null;
      if (!target) return;
      if (picker.current?.contains(target)) return;
      setPing(null);
      setMention(null);
      setSlash(null);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [ping, mention, slash]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      const target = formatted.current;
      formatted.current = null;
      const sel = window.getSelection();
      if (!target?.isConnected || e.inputType !== "insertText" || !e.data) return;
      if (!sel?.rangeCount || !sel.isCollapsed) return;
      const caret = sel.getRangeAt(0);
      if (!target.contains(caret.startContainer)) return;
      const rest = document.createRange();
      rest.setStart(caret.startContainer, caret.startOffset);
      rest.setEndAfter(target);
      if (rest.toString() !== "") return;
      e.preventDefault();
      rest.selectNode(target);
      sel.removeAllRanges();
      sel.addRange(rest);
      exec("insertHTML", target.outerHTML + escapeHtml(e.data));
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  useLayoutEffect(() => {
    const img = picked;
    const outer = box.current;
    if (!img || !outer) {
      setFrame(null);
      return;
    }
    const place = () => {
      if (!img.isConnected) {
        setPicked(null);
        return;
      }
      const from = outer.getBoundingClientRect();
      const rect = img.getBoundingClientRect();
      setFrame({
        top: rect.top - from.top,
        left: rect.left - from.left,
        width: rect.width,
        height: rect.height,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(img);
    observer.observe(outer);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [picked]);

  function resizeImage(e: PointerEvent<HTMLButtonElement>) {
    const img = picked;
    const el = root.current;
    if (!img || !el) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const limit = Math.min(IMAGE_WIDTH.max, el.clientWidth);
    const move = (next: globalThis.PointerEvent) => {
      const width = Math.round(
        Math.min(limit, Math.max(IMAGE_WIDTH.min, startWidth + next.clientX - startX)),
      );
      img.setAttribute("width", String(width));
      setDragWidth(width);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setDragWidth(null);
      emit();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  function emit() {
    const el = root.current;
    const html = sanitizeHtml(el?.innerHTML ?? "");
    el?.classList.toggle("is-empty", isEmptyHtml(el.innerHTML));
    if (html.length > maxLength) return;
    onChange(isEmptyHtml(html) ? "" : html);
  }

  function remember() {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }

  function rememberToken(token: { node: Text; start: number; end: number }) {
    const range = document.createRange();
    range.setStart(token.node, token.start);
    range.setEnd(token.node, token.end);
    saved.current = range;
  }

  function restore() {
    const range = saved.current;
    const sel = window.getSelection();
    if (!range || !sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function run(command: string, arg?: string) {
    root.current?.focus();
    exec(command, arg);
    emit();
  }

  function typeMarkdown(input: InputEvent) {
    const el = root.current;
    const sel = window.getSelection();
    if (!el || input.isComposing || input.inputType !== "insertText" || !input.data) return;
    if (!sel?.rangeCount || !sel.isCollapsed) return;
    const { startContainer, startOffset: end } = sel.getRangeAt(0);
    if (startContainer.nodeType !== Node.TEXT_NODE || !el.contains(startContainer)) return;
    const node = startContainer as Text;

    if (input.data === " ") {
      const line = lineBefore(el, node, end).replace(/\u00a0/g, " ");
      if (line.length > end) return;
      let command: [string, string?] | null = null;
      if (/^[-*+] $/.test(line)) command = ["insertUnorderedList"];
      else if (/^\d+[.)] $/.test(line)) command = ["insertOrderedList"];
      else if (headings && /^#{1,3} $/.test(line)) {
        command = ["formatBlock", line.length === 4 ? "h3" : "h2"];
      }
      if (!command) return;
      if (command[0] !== "formatBlock" && document.queryCommandState(command[0])) return;
      selectText(node, end - line.length, end);
      exec("delete");
      exec(...command);
      return;
    }

    if (!TRIGGERS.has(input.data)) return;
    const before = node.data.slice(0, end);
    for (const rule of TYPED) {
      const match = rule.pattern.exec(before);
      if (!match) continue;
      const html = rule.render(match.map((part) => part && escapeHtml(part)) as RegExpMatchArray);
      if (!html) continue;
      selectText(node, end - match[0].length, end);
      exec("insertHTML", html);
      const tag = /^<(b|i|u|mark|a)[\s>]/.exec(html)?.[1];
      const at = window.getSelection()?.anchorNode?.parentElement;
      formatted.current = (tag && at?.closest(tag)) || null;
      return;
    }
  }

  function typeEmoji(input: InputEvent) {
    const outer = box.current;
    const found = input.isComposing ? null : readShortcode(root.current);
    if (!outer || !found) {
      setEmoji(null);
      return;
    }
    if (found.closed) {
      setEmoji(null);
      const char = input.data === ":" && emojiFor(found.name);
      if (!char) return;
      selectText(found.node, found.start, found.end);
      exec("insertText", char);
      return;
    }
    const items = found.name.length >= 2 ? searchEmoji(found.name) : [];
    const caret = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
    if (!items.length || !caret) {
      setEmoji(null);
      return;
    }
    const from = outer.getBoundingClientRect();
    setEmoji({
      items,
      index: 0,
      top: caret.bottom - from.top + 6,
      left: Math.max(0, Math.min(caret.left - from.left, from.width - EMOJI_MENU_WIDTH)),
    });
  }

  function pickEmoji(item: EmojiMatch) {
    const found = readShortcode(root.current);
    setEmoji(null);
    if (!found) return;
    selectText(found.node, found.start, found.end);
    exec("insertText", item.emoji);
    emit();
  }

  function submitForm() {
    const form = root.current?.closest("form");
    const button = form?.querySelector<HTMLButtonElement>("button[type=submit]");
    if (form && button && !button.disabled) form.requestSubmit(button);
  }

  function applyLink() {
    restore();
    root.current?.focus();
    const url = href.trim();
    if (url && url !== "https://") exec("createLink", url);
    setLinking(false);
    setHref("https://");
    emit();
  }

  function replaceToken(found: { node: Text; start: number; end: number } | null, html: string) {
    root.current?.focus();
    if (found?.node.isConnected) {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.setStart(found.node, found.start);
        range.setEnd(found.node, found.end);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      restore();
    }
    exec("insertHTML", html);
  }

  function insertPostRef(id: number, title: string) {
    replaceToken(readMention(root.current), `<a href="/post/${id}">${escapeHtml(title)}</a>\u00a0`);
    setMention(null);
    setPing(null);
    setSlash(null);
    emit();
  }

  function insertPerson(id: number, name: string) {
    replaceToken(readPing(root.current), `${mentionChip(id, name)}\u00a0`);
    setPing(null);
    setMention(null);
    setSlash(null);
    emit();
  }

  function insertSection(label: ChangelogSection) {
    replaceToken(readSlash(root.current), `${changelogSectionChip(label)}\u00a0`);
    setSlash(null);
    setMention(null);
    setPing(null);
    emit();
  }

  async function insertFile(next: File) {
    setError(null);
    setBusy(true);
    try {
      const url = await uploadImage(next);
      root.current?.focus();
      restore();
      exec("insertImage", url);
      emit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={box} className="relative flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-0.5">
        {headings && (
          <Tool
            label="Heading"
            onClick={() => {
              root.current?.focus();
              const current = document.queryCommandValue("formatBlock").toLowerCase();
              exec("formatBlock", current === "h2" ? "div" : "h2");
              emit();
            }}
          >
            <Heading />
          </Tool>
        )}
        <Tool label="Bold" keys="⌘B" onClick={() => run("bold")}>
          <Bold />
        </Tool>
        <Tool label="Italic" keys="⌘I" onClick={() => run("italic")}>
          <Italic />
        </Tool>
        <Tool label="Underline" keys="⌘U" onClick={() => run("underline")}>
          <Underline />
        </Tool>
        <Tool
          label="Highlight"
          onClick={() => {
            exec("styleWithCSS", "true");
            root.current?.focus();
            exec("hiliteColor", "#ffe4f0");
            exec("backColor", "#ffe4f0");
            emit();
          }}
        >
          <Highlight />
        </Tool>
        <Tool label="Bulleted list" keys="⌘⇧8" onClick={() => run("insertUnorderedList")}>
          <BulletList />
        </Tool>
        <Tool label="Numbered list" keys="⌘⇧7" onClick={() => run("insertOrderedList")}>
          <NumberedList />
        </Tool>
        <Tool
          label="Link"
          keys="⌘K"
          onClick={() => {
            remember();
            setMention(null);
            setLinking((open) => !open);
          }}
        >
          <LinkIcon />
        </Tool>
        {mentions && (
          <Tool
            label="Reference a suggestion"
            onClick={() => {
              remember();
              setLinking(false);
              setPing(null);
              setMention({ query: "", pinned: true });
            }}
          >
            <Hash />
          </Tool>
        )}
        {people && (
          <Tool
            label="Mention someone"
            onClick={() => {
              remember();
              setLinking(false);
              setMention(null);
              setPing({ query: "", pinned: true });
            }}
          >
            <At />
          </Tool>
        )}
        <Tool label="Image" onClick={() => file.current?.click()} disabled={busy}>
          <ImageIcon />
        </Tool>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/gif"
          className="hidden"
          onChange={(e) => {
            const next = e.target.files?.[0];
            e.target.value = "";
            if (next) void insertFile(next);
          }}
        />
      </div>

      {linking && (
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="https://"
            value={href}
            autoFocus
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinking(false);
            }}
          />
          <button type="button" className="btn-quiet" onClick={applyLink}>
            Add
          </button>
        </div>
      )}

      {(mention || ping || (slash && slashItems.length > 0)) && (
        <div ref={picker}>
          {mention && (
            <SuggestionPicker
              query={mention.query}
              excludeId={excludeId}
              focusSearch={Boolean(mention.pinned)}
              onPick={insertPostRef}
              onClose={() => setMention(null)}
            />
          )}

          {ping && (
            <PeoplePicker
              query={ping.query}
              focusSearch={Boolean(ping.pinned)}
              onPick={insertPerson}
              onClose={() => setPing(null)}
            />
          )}

          {slash && slashItems.length > 0 && (
            <div role="listbox" aria-label="Section" className="menu w-44 py-1">
              {slashItems.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  role="option"
                  aria-selected={i === slash.index}
                  className={`menu-item gap-2 ${i === slash.index ? "bg-hover text-fg" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertSection(label)}
                >
                  <span className={`changelog-chip ${sectionToneClass(label)}`}>{label}</span>
                  <span className="text-faint">/{label.toLowerCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={root}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        contentEditable
        data-placeholder={placeholder}
        className="rich editor is-empty min-h-16 outline-none"
        onInput={(e) => {
          typeMarkdown(e.nativeEvent as InputEvent);
          typeEmoji(e.nativeEvent as InputEvent);
          if (mentions) {
            const found = readMention(root.current);
            if (found) {
              rememberToken(found);
              setMention({ query: found.query });
              setPing(null);
            } else {
              setMention((open) => (open?.pinned ? open : null));
            }
          }
          if (people) {
            const found = readPing(root.current);
            if (found) {
              rememberToken(found);
              setPing({ query: found.query });
              setMention(null);
            } else {
              setPing((open) => (open?.pinned ? open : null));
            }
          }
          if (sections) {
            const found = readSlash(root.current);
            if (found) {
              rememberToken(found);
              setSlash({ query: found.query, index: 0 });
            } else {
              setSlash(null);
            }
          }
          emit();
        }}
        onPaste={(e) => {
          const image = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
          if (image) {
            e.preventDefault();
            remember();
            void insertFile(image);
            return;
          }
          const text = e.clipboardData.getData("text/plain");
          if (!MARKDOWN_HINT.test(text)) return;
          e.preventDefault();
          exec("insertHTML", markdownToHtml(text, headings));
          emit();
        }}
        onFocus={() => void loadEmoji()}
        onClick={(e) => {
          setEmoji(null);
          const target = e.target;
          if (!(target instanceof HTMLImageElement)) {
            setPicked(null);
            return;
          }
          const range = document.createRange();
          range.selectNode(target);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
          setPicked(target);
        }}
        onBlur={() => {
          setPicked(null);
          setEmoji(null);
        }}
        onKeyDown={(e) => {
          setPicked(null);
          const mod = e.metaKey || e.ctrlKey;
          if (emoji && !mod && !e.nativeEvent.isComposing) {
            const count = emoji.items.length;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.key === "ArrowDown" ? 1 : count - 1;
              setEmoji({ ...emoji, index: (emoji.index + step) % count });
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const item = emoji.items[emoji.index];
              if (item) pickEmoji(item);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEmoji(null);
              return;
            }
            if (CARET_KEYS.has(e.key)) setEmoji(null);
          }
          if (slash && slashItems.length > 0 && !mod && !e.nativeEvent.isComposing) {
            const count = slashItems.length;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.key === "ArrowDown" ? 1 : count - 1;
              setSlash({ ...slash, index: (slash.index + step) % count });
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const item = slashItems[slash.index];
              if (item) insertSection(item);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setSlash(null);
              return;
            }
          }
          if (e.key === "Escape" && mention) {
            e.preventDefault();
            setMention(null);
            return;
          }
          if (e.key === "Escape" && ping) {
            e.preventDefault();
            setPing(null);
            return;
          }
          if (!mod) return;
          if (e.key === "Enter") {
            e.preventDefault();
            submitForm();
            return;
          }
          const key = e.key.toLowerCase();
          if (e.shiftKey && (e.code === "Digit8" || e.code === "Digit7")) {
            e.preventDefault();
            run(e.code === "Digit8" ? "insertUnorderedList" : "insertOrderedList");
          } else if (key === "b") {
            e.preventDefault();
            run("bold");
          } else if (key === "i") {
            e.preventDefault();
            run("italic");
          } else if (key === "u") {
            e.preventDefault();
            run("underline");
          } else if (key === "k") {
            e.preventDefault();
            remember();
            setLinking(true);
          }
        }}
      />
      {picked && frame && (
        <div className="pointer-events-none absolute rounded-xl ring-2 ring-accent" style={frame}>
          <button
            type="button"
            aria-label="Resize image"
            title="Drag to resize, double-click to reset"
            className="pointer-events-auto absolute top-1/2 -right-1.5 h-8 w-3 -translate-y-1/2 cursor-ew-resize touch-none rounded-full border-2 border-accent bg-surface shadow-sm"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={resizeImage}
            onDoubleClick={() => {
              picked.removeAttribute("width");
              emit();
            }}
          />
          {dragWidth !== null && (
            <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
              {dragWidth} px
            </span>
          )}
        </div>
      )}
      {emoji && (
        <div
          role="listbox"
          aria-label="Emoji"
          className="menu absolute z-30 py-1"
          style={{ top: emoji.top, left: emoji.left, width: EMOJI_MENU_WIDTH }}
        >
          {emoji.items.map((item, i) => (
            <button
              key={item.name}
              type="button"
              role="option"
              aria-selected={i === emoji.index}
              className={`menu-item ${i === emoji.index ? "bg-hover text-fg" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickEmoji(item)}
            >
              <span className="text-base leading-none">{item.emoji}</span>
              <span className="truncate">:{item.name}:</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function sectionToneClass(label: string) {
  switch (changelogSectionLabel(label)) {
    case "New":
      return "is-new";
    case "Changed":
      return "is-changed";
    case "Fixed":
      return "is-fixed";
    case "Removed":
      return "is-removed";
    default:
      return "";
  }
}

export function PeoplePicker({
  query,
  focusSearch = false,
  onPick,
  onClose,
}: {
  query: string;
  focusSearch?: boolean;
  onPick: (id: number, name: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(query);
  useEffect(() => setQ(query), [query]);
  const { data } = usePeople(q.trim());
  const list = data?.people ?? [];

  return (
    <div className="card overflow-hidden p-1.5">
      <input
        className="input h-8"
        placeholder="Search people…"
        value={q}
        autoFocus={focusSearch}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const first = list[0];
            if (first) onPick(first.id, first.name);
          }
        }}
      />
      <ul className="mt-1 max-h-56 overflow-y-auto">
        {list.length === 0 && (
          <li className="px-2.5 py-2 text-[12px] text-faint">No matching people</li>
        )}
        {list.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left hover:bg-hover"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(person.id, person.name)}
            >
              <Avatar name={person.name} src={person.avatarUrl} size="xs" />
              <span className="min-w-0 truncate text-[13px]">{person.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SuggestionPicker({
  query,
  excludeId,
  focusSearch = false,
  onPick,
  onClose,
}: {
  query: string;
  excludeId?: number;
  focusSearch?: boolean;
  onPick: (id: number, title: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(query);
  useEffect(() => setQ(query), [query]);
  const { data: posts } = usePosts({ q: q.trim() || undefined, sort: "top" });
  const list = (posts ?? []).filter((post) => post.id !== excludeId).slice(0, 7);

  return (
    <div className="card overflow-hidden p-1.5">
      <input
        className="input h-8"
        placeholder="Search suggestions…"
        value={q}
        autoFocus={focusSearch}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const first = list[0];
            if (first) onPick(first.id, first.title);
          }
        }}
      />
      <ul className="mt-1 max-h-56 overflow-y-auto">
        {list.length === 0 && (
          <li className="px-2.5 py-2 text-[12px] text-faint">No matching suggestions</li>
        )}
        {list.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-xl px-2.5 py-1.5 text-left hover:bg-hover"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(post.id, post.title)}
            >
              <span
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${STATUS_DOT[post.status]}`}
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{post.title}</span>
                <span className="block truncate text-[11px] text-faint">{post.authorName}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tool({
  label,
  keys,
  onClick,
  disabled,
  children,
}: {
  label: string;
  keys?: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={keys ? `${label} (${keys})` : label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}
