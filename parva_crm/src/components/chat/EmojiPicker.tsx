import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Smile, ThumbsUp, Heart, Sparkles, Building, X } from 'lucide-react'

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void
  onClose: () => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

interface EmojiCategory {
  id: string
  name: string
  icon: React.ReactNode
  emojis: string[]
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯', '🚀', '✨', '🤝', '😍']

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: <Smile size={16} />,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
      '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
      '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
      '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮',
      '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
      '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
    ],
  },
  {
    id: 'gestures',
    name: 'People & Gestures',
    icon: <ThumbsUp size={16} />,
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '👊', '✊', '🤛', '🤜', '🤞', '✌️',
      '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖',
      '👋', '🤙', '💪', '🦾', '🖕', '✍️', '🙏', '🦶', '🦵', '👂', '🦻', '👃', '🧠',
      '👀', '👁️', '👅', '👄', '💋', '👤', '👥', '🫂', '🧑‍💼', '👨‍💼', '👩‍💼', '🦸',
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts & Symbols',
    icon: <Heart size={16} />,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '⭐️', '🌟', '✨', '⚡️', '🔥', '💥', '☀️',
      '🌈', '☁️', '❄️', '💯', '✅', '✔️', '❌', '❎', '➕', '➖', '➗', '⚠️', '🚨',
      '🔔', '🔕', '💬', '💭', '🗯️', 'ℹ️', '❓', '❗', '‼️', '💡', '📌', '📍', '🎯',
    ],
  },
  {
    id: 'celebrate',
    name: 'Celebration & Fun',
    icon: <Sparkles size={16} />,
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🎂', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🚀', '✈️',
      '🏖️', '🏝️', '☕', '🍵', '🥂', '🍻', '🍷', '🍕', '🍔', '🍟', '🍰', '🍫', '🍿',
      '🚗', '🚕', '🚙', '🏎️', '🛵', '🚲', '🛴', '⛵', '🚢', '⚓', '🎵', '🎶', '🎤',
    ],
  },
  {
    id: 'realty',
    name: 'Work & Real Estate',
    icon: <Building size={16} />,
    emojis: [
      '🏢', '🏠', '🏡', '🏘️', '🏗️', '🏛️', '🏙️', '🏰', '🔑', '🗝️', '🚪', '🛋️', '🛏️',
      '💼', '📁', '📂', '📄', '📃', '📑', '📊', '📈', '📉', '📋', '📅', '📆', '🗓️',
      '📇', '⏰', '⏱️', '⏳', '⌛', '💰', '💵', '💴', '💶', '💷', '💳', '💎', '🏷️',
      '✉️', '📧', '📨', '📩', '📦', '📫', '📬', '💻', '🖥️', '📱', '☎️', '📞', '📠',
    ],
  },
]

// Emoji keywords map for search functionality
const EMOJI_KEYWORDS: Record<string, string[]> = {
  '❤️': ['heart', 'love', 'red', 'like'],
  '👍': ['thumbsup', 'like', 'approve', 'yes', 'ok', 'good'],
  '👎': ['thumbsdown', 'dislike', 'no', 'bad'],
  '😂': ['laugh', 'joy', 'lol', 'funny', 'haha'],
  '🤣': ['rofl', 'laugh', 'rolling', 'funny'],
  '😮': ['wow', 'surprised', 'omg', 'gasp'],
  '😢': ['cry', 'sad', 'tear', 'unhappy'],
  '😭': ['sob', 'crying', 'sad', 'tears'],
  '🙏': ['pray', 'thanks', 'thank you', 'please', 'namaste', 'hope'],
  '🔥': ['fire', 'flame', 'lit', 'hot', 'awesome'],
  '👏': ['clap', 'applause', 'bravo', 'congrats'],
  '🎉': ['party', 'celebrate', 'tada', 'congratulations', 'yay'],
  '💯': ['100', 'hundred', 'perfect', 'score'],
  '🚀': ['rocket', 'launch', 'fast', 'growth', 'up'],
  '✨': ['sparkles', 'stars', 'magic', 'clean', 'new'],
  '🤝': ['handshake', 'deal', 'agreement', 'partner'],
  '🏢': ['office', 'building', 'company', 'work', 'property'],
  '🏠': ['home', 'house', 'property', 'real estate'],
  '🏡': ['villa', 'house', 'garden', 'realty'],
  '🔑': ['key', 'access', 'property', 'handover'],
  '💰': ['money', 'cash', 'wealth', 'commission', 'sale'],
  '💼': ['briefcase', 'work', 'job', 'business'],
  '📈': ['chart', 'growth', 'increase', 'profit', 'sales'],
  '✅': ['check', 'done', 'yes', 'verified', 'approved'],
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelectEmoji,
  onClose,
  position = 'top-left',
}) => {
  const [activeTab, setActiveTab] = useState<string>('smileys')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Auto focus search input on open
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Filter emojis based on search query
  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null

    const results: string[] = []
    const seen = new Set<string>()

    // Check keyword map first
    Object.entries(EMOJI_KEYWORDS).forEach(([emoji, tags]) => {
      if (tags.some((tag) => tag.includes(q)) && !seen.has(emoji)) {
        seen.add(emoji)
        results.push(emoji)
      }
    })

    // Search across all categories
    EMOJI_CATEGORIES.forEach((cat) => {
      if (cat.name.toLowerCase().includes(q)) {
        cat.emojis.forEach((emoji) => {
          if (!seen.has(emoji)) {
            seen.add(emoji)
            results.push(emoji)
          }
        })
      }
    })

    return results
  }, [searchQuery])

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeTab) || EMOJI_CATEGORIES[0]

  return (
    <div
      ref={containerRef}
      className={`absolute z-50 w-80 sm:w-88 bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden text-foreground animate-in fade-in zoom-in-95 duration-150 ${
        position === 'top-left'
          ? 'bottom-full left-0 mb-2'
          : position === 'top-right'
          ? 'bottom-full right-0 mb-2'
          : position === 'bottom-right'
          ? 'top-full right-0 mt-2'
          : 'top-full left-0 mt-2'
      }`}
      style={{
        boxShadow: '0 20px 35px -10px rgba(28, 43, 74, 0.2), 0 0 1px 1px rgba(201, 169, 110, 0.25)',
      }}
    >
      {/* Header & Search */}
      <div className="p-3 border-b border-border/80 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emoji (heart, thumbsup, smile...)"
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick Reactions Bar */}
        {!searchQuery && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Quick Reactions
            </p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSelectEmoji(emoji)}
                  className="w-7 h-7 flex items-center justify-center text-lg rounded-lg hover:bg-accent/15 hover:scale-125 transition-transform shrink-0"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex items-center justify-between px-2 pt-2 border-b border-border/60 bg-muted/20">
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex-1 flex items-center justify-center py-2 text-xs font-medium border-b-2 transition-all ${
                  isActive
                    ? 'border-accent text-accent font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
                title={cat.name}
                type="button"
              >
                {cat.icon}
              </button>
            )
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-3 h-56 overflow-y-auto scrollbar-thin">
        {searchQuery ? (
          filteredEmojis && filteredEmojis.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-2">
                Search Results ({filteredEmojis.length})
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {filteredEmojis.map((emoji, idx) => (
                  <button
                    key={`${emoji}-${idx}`}
                    onClick={() => onSelectEmoji(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-accent/15 hover:scale-120 active:scale-95 transition-transform"
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-6 text-muted-foreground">
              <Smile size={28} className="mb-2 opacity-40" />
              <p className="text-xs">No matching emojis</p>
            </div>
          )
        ) : (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-2">
              {currentCategory.name}
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {currentCategory.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSelectEmoji(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-accent/15 hover:scale-120 active:scale-95 transition-transform"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-muted/40 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>Click to insert emoji</span>
        <span className="font-mono text-[9px] opacity-70">ESC to close</span>
      </div>
    </div>
  )
}
export default EmojiPicker
