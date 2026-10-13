"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Sparkles } from "lucide-react";
import { ExternalLink } from "@/components/shared/external-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/forms/fields";
import { TOPIC_TITLES, type Difficulty, type TopicSlug } from "@/lib/leetcode/catalog";
import { recommend, type RecommendInput, type Recommendation, type RecommendationKind } from "@/lib/leetcode/recommend";
import { DIFFICULTY_COLORS } from "@/lib/leetcode/view";

const KIND_LABEL: Record<RecommendationKind, string> = {
  review_due: "Review due",
  build_confidence: "Build confidence",
  retry: "Try again",
  weak_topic: "Strengthen a topic",
  low_coverage: "Explore a topic",
  next_step: "Next step",
};

function ProblemPick({ recommendation }: { recommendation: Recommendation }) {
  const { problem, kind, reason } = recommendation;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-background/40 p-4">
      <span className="text-xs font-medium text-primary">{KIND_LABEL[kind]}</span>
      <h3 className="text-base font-medium leading-snug">{problem.title}</h3>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full" style={{ background: DIFFICULTY_COLORS[problem.difficulty] }} />
          <span className="capitalize">{problem.difficulty}</span>
        </span>
        <span>{TOPIC_TITLES[problem.topic]}</span>
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">{reason}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
        <ExternalLink href={`https://leetcode.com/problems/${problem.slug}/`}>Open problem</ExternalLink>
        <Link
          href={`/practice?log=${problem.slug}`}
          scroll={false}
          aria-label={`Log an attempt for ${problem.title}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Log attempt
        </Link>
      </div>
    </li>
  );
}

export function RecommendedCard({ input, connected }: { input: RecommendInput; connected: boolean }) {
  const [topic, setTopic] = useState<TopicSlug | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "auto">("auto");
  const recs = recommend({
    ...input,
    focusTopic: topic === "all" ? undefined : topic,
    difficulty: difficulty === "auto" ? undefined : difficulty,
    limit: 6,
  });
  const filtered = topic !== "all" || difficulty !== "auto";

  return (
    <Card className="border-t-2 border-primary/50">
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <Sparkles aria-hidden className="size-4 text-primary" /> Recommended next
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {connected
              ? "Personalized from your logged results, confidence, review dates and public LeetCode profile."
              : "Personalized from your logged results, confidence and review dates. Connect LeetCode below to add profile insights."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,12rem)_auto] sm:items-end">
          <div className="grid gap-1.5 text-xs font-medium">
            <label htmlFor="recommend-topic">Topic focus</label>
            <NativeSelect id="recommend-topic" value={topic} onChange={(event) => setTopic(event.target.value as TopicSlug | "all")}>
              <option value="all">All topics</option>
              {Object.entries(TOPIC_TITLES).map(([slug, title]) => (
                <option key={slug} value={slug}>
                  {title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5 text-xs font-medium">
            <label htmlFor="recommend-difficulty">Difficulty</label>
            <NativeSelect
              id="recommend-difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as Difficulty | "auto")}
            >
              <option value="auto">Match my progress</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </NativeSelect>
          </div>
          {filtered ? (
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => {
                setTopic("all");
                setDifficulty("auto");
              }}
            >
              Reset filters
            </Button>
          ) : null}
        </div>
        <p role="status" className="sr-only">
          {recs.length} recommended problems{filtered ? " matching your filters" : ""}.
        </p>
        {recs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            {filtered
              ? "No suitable picks for this combination. Try another topic or difficulty, or reset the filters."
              : "You have covered the suitable problems in this curated list. Choose another difficulty or log a review date to plan your next session."}
          </div>
        ) : (
          <>
            <ul aria-label="Top recommended problems" className="grid gap-3 lg:grid-cols-3">
              {recs.slice(0, 3).map((recommendation) => (
                <ProblemPick key={recommendation.problem.slug} recommendation={recommendation} />
              ))}
            </ul>
            {recs.length > 3 ? (
              <details key={`${topic}-${difficulty}`} className="group">
                <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" /> {recs.length - 3} more
                  suggestions
                </summary>
                <ul aria-label="More recommended problems" className="mt-4 grid gap-3 lg:grid-cols-3">
                  {recs.slice(3).map((recommendation) => (
                    <ProblemPick key={recommendation.problem.slug} recommendation={recommendation} />
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Reviews come first, then confidence, retries and topic coverage.{" "}
          {connected
            ? "LeetCode exposes recent accepted problems, so older solves may still appear; log them to exclude them."
            : "Log topics and confidence for better picks as you practice."}
        </p>
      </CardContent>
    </Card>
  );
}
