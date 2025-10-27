import type { CollectionEntry } from "astro:content"
import { createEffect, createSignal, For, Show } from "solid-js"
import ArrowCard from "@components/ArrowCard"
import { cn } from "@lib/utils"

type Props = {
  tags: string[]
  data: CollectionEntry<"blog">[]
}

type SortOption = "date-desc" | "date-asc" | "title-asc" | "title-desc"

export default function Blog({ data, tags }: Props) {
  const [filter, setFilter] = createSignal(new Set<string>())
  const [posts, setPosts] = createSignal<CollectionEntry<"blog">[]>([])
  const [isFilterOpen, setIsFilterOpen] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal("")
  const [sortBy, setSortBy] = createSignal<SortOption>("date-desc")

  createEffect(() => {
    let filteredPosts = data.filter((entry) => {
      // Filter by tags
      const tagMatch = Array.from(filter()).every((value) => 
        entry.data.tags.some((tag: string) => 
          tag.toLowerCase() === String(value).toLowerCase()
        )
      )

      // Filter by search query
      const searchLower = searchQuery().toLowerCase()
      const searchMatch = searchLower === "" || 
        entry.data.title.toLowerCase().includes(searchLower) ||
        entry.data.summary?.toLowerCase().includes(searchLower) ||
        entry.data.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))

      return tagMatch && searchMatch
    })

    // Sort posts
    filteredPosts = [...filteredPosts].sort((a, b) => {
      switch (sortBy()) {
        case "date-desc":
          return new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
        case "date-asc":
          return new Date(a.data.date).getTime() - new Date(b.data.date).getTime()
        case "title-asc":
          return a.data.title.localeCompare(b.data.title)
        case "title-desc":
          return b.data.title.localeCompare(a.data.title)
        default:
          return 0
      }
    })

    setPosts(filteredPosts)
  })

  function toggleTag(tag: string) {
    setFilter((prev) => 
      new Set(prev.has(tag) 
        ? [...prev].filter((t) => t !== tag) 
        : [...prev, tag]
      )
    )
  }

  function toggleFilterMenu() {
    setIsFilterOpen(!isFilterOpen())
  }

  function clearAllFilters() {
    setFilter(new Set())
    setSearchQuery("")
  }

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement
    setSearchQuery(target.value)
  }

  function handleSortChange(e: Event) {
    const target = e.target as HTMLSelectElement
    setSortBy(target.value as SortOption)
  }

  return (
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {/* Desktop Filter - Sidebar */}
      <div class="hidden sm:block col-span-1">
        <div class="sticky top-24">
          {/* Search Bar - Desktop */}
          <div class="mb-4">
            <label class="text-sm font-semibold uppercase mb-2 text-black dark:text-white block">
              Search
            </label>
            <div class="relative">
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery()}
                onInput={handleSearchInput}
                class={cn(
                  "w-full px-3 py-2 pr-10 rounded-lg",
                  "bg-black/5 dark:bg-white/10",
                  "border border-black/10 dark:border-white/20",
                  "focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/30",
                  "placeholder:text-black/40 dark:placeholder:text-white/40",
                  "transition-all duration-200"
                )}
              />
              <Show when={searchQuery()}>
                <button
                  onClick={() => setSearchQuery("")}
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 dark:hover:bg-white/20 rounded"
                  aria-label="Clear search"
                >
                  <svg class="size-4 fill-black/50 dark:fill-white/50">
                    <use href={`/ui.svg#x`} />
                  </svg>
                </button>
              </Show>
            </div>
          </div>

          {/* Filter Tags - Desktop */}
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-semibold uppercase text-black dark:text-white">
              Filter
            </div>
            <Show when={filter().size > 0}>
              <button
                onClick={clearAllFilters}
                class={cn(
                  "text-xs px-2 py-1 rounded",
                  "bg-black/5 dark:bg-white/10",
                  "hover:bg-black/10 hover:dark:bg-white/15",
                  "transition-colors duration-200"
                )}
              >
                Clear all
              </button>
            </Show>
          </div>
          <ul class="flex flex-col gap-1.5">
            <For each={tags}>
              {(tag) => (
                <li>
                  <button 
                    onClick={() => toggleTag(tag)} 
                    class={cn(
                      "w-full px-2 py-1 rounded",
                      "whitespace-nowrap overflow-hidden overflow-ellipsis",
                      "flex gap-2 items-center",
                      "bg-black/5 dark:bg-white/10",
                      "hover:bg-black/10 hover:dark:bg-white/15",
                      "transition-colors duration-300 ease-in-out",
                      filter().has(tag) && "text-black dark:text-white"
                    )}
                  >
                    <svg class={cn(
                      "size-5 fill-black/50 dark:fill-white/50",
                      "transition-colors duration-300 ease-in-out",
                      filter().has(tag) && "fill-black dark:fill-white"
                    )}>
                      <use href={`/ui.svg#square`} class={cn(!filter().has(tag) ? "block" : "hidden")} />
                      <use href={`/ui.svg#square-check`} class={cn(filter().has(tag) ? "block" : "hidden")} />
                    </svg>
                    {tag}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>

      {/* Mobile Search & Filter */}
      <div class="sm:hidden col-span-1 space-y-3">
        {/* Search Bar - Mobile */}
        <div class="relative">
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery()}
            onInput={handleSearchInput}
            class={cn(
              "w-full px-4 py-3 pr-10 rounded-lg",
              "bg-black/5 dark:bg-white/10",
              "border border-black/10 dark:border-white/20",
              "focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/30",
              "placeholder:text-black/40 dark:placeholder:text-white/40",
              "transition-all duration-200"
            )}
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 dark:hover:bg-white/20 rounded"
              aria-label="Clear search"
            >
              <svg class="size-5 fill-black/50 dark:fill-white/50">
                <use href={`/ui.svg#x`} />
              </svg>
            </button>
          </Show>
        </div>

        {/* Filter Collapsible - Mobile */}
        <button
          onClick={toggleFilterMenu}
          class={cn(
            "w-full px-4 py-3 rounded-lg",
            "flex justify-between items-center",
            "bg-black/5 dark:bg-white/10",
            "hover:bg-black/10 hover:dark:bg-white/15",
            "transition-all duration-300 ease-in-out",
            "text-sm font-semibold uppercase"
          )}
        >
          <span class="flex items-center gap-2">
            <svg class="size-5 fill-black dark:fill-white">
              <use href={`/ui.svg#filter`} />
            </svg>
            Filter Tags
            {filter().size > 0 && (
              <span class="ml-2 px-2 py-0.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold">
                {filter().size}
              </span>
            )}
          </span>
          <svg 
            class={cn(
              "size-5 fill-black dark:fill-white",
              "transition-transform duration-300",
              isFilterOpen() && "rotate-180"
            )}
          >
            <use href={`/ui.svg#chevron-down`} />
          </svg>
        </button>

        <div class={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isFilterOpen() ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div class="p-3 bg-black/5 dark:bg-white/5 rounded-lg space-y-3">
            <Show when={filter().size > 0}>
              <button
                onClick={clearAllFilters}
                class={cn(
                  "w-full text-sm px-3 py-2 rounded-lg",
                  "bg-black/10 dark:bg-white/15",
                  "hover:bg-black/15 hover:dark:bg-white/20",
                  "transition-colors duration-200",
                  "font-medium"
                )}
              >
                Clear all filters
              </button>
            </Show>
            <ul class="flex flex-wrap gap-1.5">
              <For each={tags}>
                {(tag) => (
                  <li>
                    <button 
                      onClick={() => toggleTag(tag)} 
                      class={cn(
                        "px-3 py-1.5 rounded-full text-sm",
                        "whitespace-nowrap",
                        "flex gap-2 items-center",
                        "bg-black/5 dark:bg-white/10",
                        "hover:bg-black/10 hover:dark:bg-white/15",
                        "transition-colors duration-300 ease-in-out",
                        filter().has(tag) && "bg-black dark:bg-white text-white dark:text-black font-semibold"
                      )}
                    >
                      {tag}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div class="col-span-1 sm:col-span-2">
        <div class="flex flex-col">
          {/* Header with count and sort */}
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div class="text-sm uppercase">
              SHOWING {posts().length} OF {data.length} POSTS
            </div>
            
            {/* Sort Dropdown */}
            <div class="flex items-center gap-2">
              <label for="sort-select" class="text-sm uppercase whitespace-nowrap">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortBy()}
                onChange={handleSortChange}
                class={cn(
                  "px-3 py-1.5 rounded-lg text-sm",
                  "bg-black/5 dark:bg-white/10",
                  "border border-black/10 dark:border-white/20",
                  "focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/30",
                  "cursor-pointer",
                  "transition-all duration-200"
                )}
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Posts List */}
          <Show 
            when={posts().length > 0}
            fallback={
              <div class="text-center py-12">
                <p class="text-lg text-black/50 dark:text-white/50 mb-2">
                  No posts found
                </p>
                <Show when={filter().size > 0 || searchQuery()}>
                  <button
                    onClick={clearAllFilters}
                    class={cn(
                      "text-sm px-4 py-2 rounded-lg",
                      "bg-black/5 dark:bg-white/10",
                      "hover:bg-black/10 hover:dark:bg-white/15",
                      "transition-colors duration-200"
                    )}
                  >
                    Clear filters
                  </button>
                </Show>
              </div>
            }
          >
            <ul class="flex flex-col gap-3">
              <For each={posts()}>
                {(post) => (
                  <li>
                    <ArrowCard entry={post} />
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </div>
  )
}