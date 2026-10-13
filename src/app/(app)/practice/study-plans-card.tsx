"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, List, Map as MapIcon, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "@/components/shared/external-link";
import { cn } from "@/lib/utils";
import { DIFFICULTY_COLORS } from "@/lib/leetcode/view";
import { ROADMAP_TOPICS, STUDY_PLANS, studyProblems, studyProgress, type RoadmapTopicId, type StudyPlan } from "@/lib/leetcode/study-plans";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 76;
const GRAPH_WIDTH = 760;
const GRAPH_HEIGHT = 880;

export function StudyPlansCard({
  solved,
  attempted,
  connected,
}: {
  solved: readonly string[];
  attempted: readonly string[];
  connected: boolean;
}) {
  const [plan, setPlan] = useState<StudyPlan>("blind75");
  const [selected, setSelected] = useState<RoadmapTopicId>("arrays");
  const [view, setView] = useState<"map" | "topics">("map");
  const [zoom, setZoom] = useState(0.85);
  const [query, setQuery] = useState("");
  const [remaining, setRemaining] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = viewport.current;
    if (container) container.scrollLeft = Math.max(0, (GRAPH_WIDTH * zoom - container.clientWidth) / 2);
  }, [zoom, view]);
  const solvedSet = new Set(solved);
  const attemptedSet = new Set(attempted);
  const problems = studyProblems(plan);
  const progress = studyProgress(problems, solvedSet);
  const topic = ROADMAP_TOPICS.find((candidate) => candidate.id === selected)!;
  const topicProblems = problems.filter((problem) => problem.group === selected);
  const topicProgress = studyProgress(topicProblems, solvedSet);
  const visible = topicProblems.filter(
    (problem) => (!remaining || !solvedSet.has(problem.slug)) && problem.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const byId = new Map<string, (typeof ROADMAP_TOPICS)[number]>(ROADMAP_TOPICS.map((group) => [group.id, group]));
  function selectTopic(id: RoadmapTopicId) {
    setSelected(id);
    setQuery("");
  }
  function resetZoom() {
    setZoom(0.85);
    viewport.current?.scrollTo({ top: 0, left: 0 });
  }

  function topicButton(group: (typeof ROADMAP_TOPICS)[number], map: boolean) {
    const status = studyProgress(
      problems.filter((problem) => problem.group === group.id),
      solvedSet,
    );
    const complete = status.total > 0 && status.done === status.total;
    return (
      <button
        key={group.id}
        type="button"
        aria-pressed={selected === group.id}
        aria-controls="study-topic-panel"
        aria-label={`${group.title}: ${status.done} of ${status.total} solved`}
        onClick={() => selectTopic(group.id)}
        className={cn(
          "grid content-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-left outline-none transition-colors hover:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          map ? "absolute" : "min-w-0",
          selected === group.id ? "border-primary bg-primary/10" : complete ? "border-emerald-500/50" : "border-border",
        )}
        style={map ? { left: group.x, top: group.y, width: NODE_WIDTH, height: NODE_HEIGHT } : undefined}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
          {complete ? <Check aria-hidden className="size-3.5 shrink-0 text-emerald-400" /> : null}
          {group.title}
        </span>
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {status.done}/{status.total} solved
          {status.done > 0 ? <span className="text-emerald-400">{status.percent}%</span> : null}
        </span>
        <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${status.percent}%` }} />
        </span>
      </button>
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid max-w-xl gap-2">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <BookOpen aria-hidden className="size-4 text-primary" /> Study plans & roadmap
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Follow a structured problem list. Select a topic to explore its problems and track your progress as you log attempts.
            </p>
          </div>
          <div role="group" aria-label="Study plan" className="flex flex-wrap gap-1 rounded-lg bg-background/60 p-1 ring-1 ring-border">
            {(Object.keys(STUDY_PLANS) as StudyPlan[]).map((id) => (
              <Button
                key={id}
                size="sm"
                variant={plan === id ? "secondary" : "ghost"}
                aria-pressed={plan === id}
                onClick={() => setPlan(id)}
              >
                {STUDY_PLANS[id].title}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-border/60 bg-background/40 p-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1">
            <h3 className="font-medium">{STUDY_PLANS[plan].title}</h3>
            <p className="text-sm text-muted-foreground">{STUDY_PLANS[plan].description}</p>
          </div>
          <p className="self-center text-sm tabular-nums" aria-live="polite">
            <span className="text-lg font-medium">
              {progress.done}/{progress.total}
            </span>{" "}
            solved <span className="ml-2 text-muted-foreground">{progress.percent}%</span>
          </p>
          <div
            role="progressbar"
            aria-label={`${STUDY_PLANS[plan].title} progress`}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-1.5 overflow-hidden rounded-full bg-muted sm:col-span-2"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label="Roadmap view" className="flex gap-1">
                <Button
                  variant={view === "map" ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={view === "map"}
                  onClick={() => setView("map")}
                >
                  <MapIcon aria-hidden /> Roadmap
                </Button>
                <Button
                  variant={view === "topics" ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={view === "topics"}
                  onClick={() => setView("topics")}
                >
                  <List aria-hidden /> Topics
                </Button>
              </div>
              {view === "map" ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Zoom out roadmap"
                    disabled={zoom <= 0.6}
                    onClick={() => setZoom((value) => Math.max(0.6, Math.round((value - 0.1) * 100) / 100))}
                  >
                    <Minus aria-hidden />
                  </Button>
                  <span className="w-10 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Zoom in roadmap"
                    disabled={zoom >= 1.3}
                    onClick={() => setZoom((value) => Math.min(1.3, Math.round((value + 0.1) * 100) / 100))}
                  >
                    <Plus aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Reset roadmap zoom" onClick={resetZoom}>
                    <RotateCcw aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
            {view === "map" ? (
              <div
                ref={viewport}
                role="region"
                aria-label="Interactive topic roadmap"
                tabIndex={0}
                className="max-h-[500px] overflow-auto rounded-lg border border-border bg-background/60 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div style={{ width: GRAPH_WIDTH * zoom, height: GRAPH_HEIGHT * zoom }}>
                  <div
                    className="relative origin-top-left"
                    style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT, transform: `scale(${zoom})` }}
                  >
                    <svg aria-hidden="true" width={GRAPH_WIDTH} height={GRAPH_HEIGHT} className="absolute inset-0">
                      <defs>
                        <marker
                          id="study-roadmap-arrow"
                          viewBox="0 0 10 10"
                          refX="8"
                          refY="5"
                          markerWidth="5"
                          markerHeight="5"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                        </marker>
                      </defs>
                      {ROADMAP_TOPICS.flatMap((child) =>
                        child.parents.map((id) => {
                          const parent = byId.get(id)!;
                          const startX = parent.x + NODE_WIDTH / 2;
                          const startY = parent.y + NODE_HEIGHT;
                          const endX = child.x + NODE_WIDTH / 2;
                          const endY = child.y - 3;
                          const middle = (startY + endY) / 2;
                          const highlighted = child.id === selected || parent.id === selected;
                          return (
                            <path
                              key={`${id}-${child.id}`}
                              d={`M${startX},${startY} C${startX},${middle} ${endX},${middle} ${endX},${endY}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={highlighted ? 2 : 1.5}
                              markerEnd="url(#study-roadmap-arrow)"
                              className={highlighted ? "text-primary/80" : "text-muted-foreground/25"}
                            />
                          );
                        }),
                      )}
                    </svg>
                    {ROADMAP_TOPICS.map((group) => topicButton(group, true))}
                  </div>
                </div>
              </div>
            ) : (
              <div role="group" aria-label="Study topics" className="grid gap-2 sm:grid-cols-3">
                {ROADMAP_TOPICS.map((group) => topicButton(group, false))}
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {view === "map" ? "Scroll to explore and use + / − to zoom. " : ""}Arrows suggest a learning order; every topic is available.
              Gold shows your selected topic; green shows completed topics.
            </p>
          </div>

          <section
            id="study-topic-panel"
            aria-labelledby="study-topic-title"
            className="grid min-w-0 content-start gap-3 rounded-lg border border-border/60 bg-background/40 p-4"
          >
            <div className="grid gap-2" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <h3 id="study-topic-title" className="text-base font-medium">
                  {topic.title}
                </h3>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {topicProgress.done}/{topicProgress.total} solved
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{topic.hint}</p>
            </div>
            <label htmlFor="study-problem-search" className="text-xs font-medium">
              Search this topic
            </label>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                id="study-problem-search"
                className="pl-8"
                placeholder="Problem name…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={remaining}
                onChange={(event) => setRemaining(event.target.checked)}
                className="size-4 accent-primary"
              />{" "}
              Show remaining only
            </label>
            <p role="status" className="sr-only">
              {visible.length} problems shown in {topic.title}.
            </p>
            {visible.length ? (
              <ul aria-label={`${topic.title} study problems`} className="grid max-h-[400px] gap-3 overflow-y-auto pr-1">
                {visible.map((problem) => {
                  const done = solvedSet.has(problem.slug);
                  const tried = attemptedSet.has(problem.slug);
                  return (
                    <li key={problem.slug} className="grid gap-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium">{problem.title}</span>
                        <span className={cn("shrink-0 text-xs", done ? "text-emerald-400" : "text-muted-foreground")}>
                          {done ? "Solved" : tried ? "Tried" : "New"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="size-1.5 rounded-full"
                            style={{ background: DIFFICULTY_COLORS[problem.difficulty] }}
                          />
                          <span className="capitalize">{problem.difficulty}</span>
                        </span>
                        {problem.premium ? <span>LeetCode Premium</span> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                        <ExternalLink href={problem.alternateUrl ?? `https://leetcode.com/problems/${problem.slug}/`}>
                          {problem.alternateUrl ? "Alternate practice" : "Practice"}
                        </ExternalLink>
                        <ExternalLink href={`https://www.youtube.com/watch?v=${problem.video}`}>Walkthrough</ExternalLink>
                        <Link
                          href={`/practice?log=${problem.slug}`}
                          scroll={false}
                          aria-label={`Log study attempt for ${problem.title}`}
                          className={buttonVariants({ variant: "outline", size: "xs", className: "ml-auto" })}
                        >
                          {done ? "Log review" : "Log attempt"}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                {remaining && topicProgress.done === topicProgress.total
                  ? "All problems in this topic are solved. Turn off the remaining filter to review them."
                  : "No problems match that search. Try another name or clear the search."}
              </p>
            )}
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <p className="max-w-xl leading-relaxed">
            Progress comes from solved attempts, including hints{connected ? ", and recent public LeetCode solves" : ""}.{" "}
            {connected ? "Older LeetCode solves may need to be logged here." : "Log an attempt to save progress across visits."}
          </p>
          <div className="flex flex-wrap gap-3">
            <ExternalLink href={STUDY_PLANS[plan].url}>NeetCode problem list</ExternalLink>
            <ExternalLink href="https://neetcode.io/roadmap/">Original roadmap</ExternalLink>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
