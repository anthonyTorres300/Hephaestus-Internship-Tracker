// Curated interview-prep problems (Blind 75 / NeetCode-style). Titles, slugs and difficulty were verified against LeetCode's public API;
// premium-only problems are excluded. A problem appears under the topic it is best known for.
export type Difficulty = "easy" | "medium" | "hard";

export interface CatalogProblem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topic: TopicSlug;
}

export type TopicSlug =
  | "arrays-hash-maps"
  | "two-pointers"
  | "sliding-window"
  | "stacks-queues"
  | "binary-search"
  | "linked-lists"
  | "trees-bst"
  | "heaps"
  | "graphs"
  | "recursion-backtracking"
  | "dynamic-programming"
  | "greedy"
  | "intervals"
  | "bit-manipulation"
  | "math";

export const TOPIC_TITLES: Record<TopicSlug, string> = {
  "arrays-hash-maps": "Arrays / Hash Maps",
  "two-pointers": "Two Pointers",
  "sliding-window": "Sliding Window",
  "stacks-queues": "Stacks / Queues",
  "binary-search": "Binary Search",
  "linked-lists": "Linked Lists",
  "trees-bst": "Trees / BST",
  heaps: "Heaps",
  graphs: "Graphs",
  "recursion-backtracking": "Recursion / Backtracking",
  "dynamic-programming": "Dynamic Programming",
  greedy: "Greedy",
  intervals: "Intervals",
  "bit-manipulation": "Bit Manipulation",
  math: "Math",
};

export const CATALOG: CatalogProblem[] = [
  { slug: "two-sum", title: "Two Sum", difficulty: "easy", topic: "arrays-hash-maps" },
  { slug: "contains-duplicate", title: "Contains Duplicate", difficulty: "easy", topic: "arrays-hash-maps" },
  { slug: "valid-anagram", title: "Valid Anagram", difficulty: "easy", topic: "arrays-hash-maps" },
  { slug: "group-anagrams", title: "Group Anagrams", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "top-k-frequent-elements", title: "Top K Frequent Elements", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "product-of-array-except-self", title: "Product of Array Except Self", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "longest-consecutive-sequence", title: "Longest Consecutive Sequence", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "best-time-to-buy-and-sell-stock", title: "Best Time to Buy and Sell Stock", difficulty: "easy", topic: "arrays-hash-maps" },
  { slug: "maximum-subarray", title: "Maximum Subarray", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "maximum-product-subarray", title: "Maximum Product Subarray", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "set-matrix-zeroes", title: "Set Matrix Zeroes", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "spiral-matrix", title: "Spiral Matrix", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "rotate-image", title: "Rotate Image", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "word-search", title: "Word Search", difficulty: "medium", topic: "arrays-hash-maps" },
  { slug: "valid-palindrome", title: "Valid Palindrome", difficulty: "easy", topic: "two-pointers" },
  { slug: "3sum", title: "3Sum", difficulty: "medium", topic: "two-pointers" },
  { slug: "container-with-most-water", title: "Container With Most Water", difficulty: "medium", topic: "two-pointers" },
  { slug: "remove-nth-node-from-end-of-list", title: "Remove Nth Node From End of List", difficulty: "medium", topic: "two-pointers" },
  { slug: "two-sum-ii-input-array-is-sorted", title: "Two Sum II - Input Array Is Sorted", difficulty: "medium", topic: "two-pointers" },
  { slug: "trapping-rain-water", title: "Trapping Rain Water", difficulty: "hard", topic: "two-pointers" },
  {
    slug: "longest-substring-without-repeating-characters",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "medium",
    topic: "sliding-window",
  },
  {
    slug: "longest-repeating-character-replacement",
    title: "Longest Repeating Character Replacement",
    difficulty: "medium",
    topic: "sliding-window",
  },
  { slug: "minimum-window-substring", title: "Minimum Window Substring", difficulty: "hard", topic: "sliding-window" },
  { slug: "permutation-in-string", title: "Permutation in String", difficulty: "medium", topic: "sliding-window" },
  { slug: "sliding-window-maximum", title: "Sliding Window Maximum", difficulty: "hard", topic: "sliding-window" },
  { slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "easy", topic: "stacks-queues" },
  { slug: "min-stack", title: "Min Stack", difficulty: "medium", topic: "stacks-queues" },
  { slug: "evaluate-reverse-polish-notation", title: "Evaluate Reverse Polish Notation", difficulty: "medium", topic: "stacks-queues" },
  { slug: "daily-temperatures", title: "Daily Temperatures", difficulty: "medium", topic: "stacks-queues" },
  { slug: "largest-rectangle-in-histogram", title: "Largest Rectangle in Histogram", difficulty: "hard", topic: "stacks-queues" },
  { slug: "car-fleet", title: "Car Fleet", difficulty: "medium", topic: "stacks-queues" },
  { slug: "binary-search", title: "Binary Search", difficulty: "easy", topic: "binary-search" },
  { slug: "search-a-2d-matrix", title: "Search a 2D Matrix", difficulty: "medium", topic: "binary-search" },
  { slug: "koko-eating-bananas", title: "Koko Eating Bananas", difficulty: "medium", topic: "binary-search" },
  {
    slug: "find-minimum-in-rotated-sorted-array",
    title: "Find Minimum in Rotated Sorted Array",
    difficulty: "medium",
    topic: "binary-search",
  },
  { slug: "search-in-rotated-sorted-array", title: "Search in Rotated Sorted Array", difficulty: "medium", topic: "binary-search" },
  { slug: "time-based-key-value-store", title: "Time Based Key-Value Store", difficulty: "medium", topic: "binary-search" },
  { slug: "median-of-two-sorted-arrays", title: "Median of Two Sorted Arrays", difficulty: "hard", topic: "binary-search" },
  { slug: "reverse-linked-list", title: "Reverse Linked List", difficulty: "easy", topic: "linked-lists" },
  { slug: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", difficulty: "easy", topic: "linked-lists" },
  { slug: "linked-list-cycle", title: "Linked List Cycle", difficulty: "easy", topic: "linked-lists" },
  { slug: "reorder-list", title: "Reorder List", difficulty: "medium", topic: "linked-lists" },
  { slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "medium", topic: "linked-lists" },
  { slug: "copy-list-with-random-pointer", title: "Copy List with Random Pointer", difficulty: "medium", topic: "linked-lists" },
  { slug: "lru-cache", title: "LRU Cache", difficulty: "medium", topic: "linked-lists" },
  { slug: "merge-k-sorted-lists", title: "Merge k Sorted Lists", difficulty: "hard", topic: "linked-lists" },
  { slug: "invert-binary-tree", title: "Invert Binary Tree", difficulty: "easy", topic: "trees-bst" },
  { slug: "maximum-depth-of-binary-tree", title: "Maximum Depth of Binary Tree", difficulty: "easy", topic: "trees-bst" },
  { slug: "same-tree", title: "Same Tree", difficulty: "easy", topic: "trees-bst" },
  { slug: "subtree-of-another-tree", title: "Subtree of Another Tree", difficulty: "easy", topic: "trees-bst" },
  {
    slug: "lowest-common-ancestor-of-a-binary-search-tree",
    title: "Lowest Common Ancestor of a Binary Search Tree",
    difficulty: "medium",
    topic: "trees-bst",
  },
  { slug: "binary-tree-level-order-traversal", title: "Binary Tree Level Order Traversal", difficulty: "medium", topic: "trees-bst" },
  { slug: "validate-binary-search-tree", title: "Validate Binary Search Tree", difficulty: "medium", topic: "trees-bst" },
  { slug: "kth-smallest-element-in-a-bst", title: "Kth Smallest Element in a BST", difficulty: "medium", topic: "trees-bst" },
  {
    slug: "construct-binary-tree-from-preorder-and-inorder-traversal",
    title: "Construct Binary Tree from Preorder and Inorder Traversal",
    difficulty: "medium",
    topic: "trees-bst",
  },
  { slug: "binary-tree-maximum-path-sum", title: "Binary Tree Maximum Path Sum", difficulty: "hard", topic: "trees-bst" },
  { slug: "serialize-and-deserialize-binary-tree", title: "Serialize and Deserialize Binary Tree", difficulty: "hard", topic: "trees-bst" },
  { slug: "implement-trie-prefix-tree", title: "Implement Trie (Prefix Tree)", difficulty: "medium", topic: "trees-bst" },
  {
    slug: "design-add-and-search-words-data-structure",
    title: "Design Add and Search Words Data Structure",
    difficulty: "medium",
    topic: "trees-bst",
  },
  { slug: "word-search-ii", title: "Word Search II", difficulty: "hard", topic: "trees-bst" },
  { slug: "count-good-nodes-in-binary-tree", title: "Count Good Nodes in Binary Tree", difficulty: "medium", topic: "trees-bst" },
  { slug: "diameter-of-binary-tree", title: "Diameter of Binary Tree", difficulty: "easy", topic: "trees-bst" },
  { slug: "kth-largest-element-in-a-stream", title: "Kth Largest Element in a Stream", difficulty: "easy", topic: "heaps" },
  { slug: "last-stone-weight", title: "Last Stone Weight", difficulty: "easy", topic: "heaps" },
  { slug: "k-closest-points-to-origin", title: "K Closest Points to Origin", difficulty: "medium", topic: "heaps" },
  { slug: "kth-largest-element-in-an-array", title: "Kth Largest Element in an Array", difficulty: "medium", topic: "heaps" },
  { slug: "task-scheduler", title: "Task Scheduler", difficulty: "medium", topic: "heaps" },
  { slug: "find-median-from-data-stream", title: "Find Median from Data Stream", difficulty: "hard", topic: "heaps" },
  { slug: "number-of-islands", title: "Number of Islands", difficulty: "medium", topic: "graphs" },
  { slug: "clone-graph", title: "Clone Graph", difficulty: "medium", topic: "graphs" },
  { slug: "max-area-of-island", title: "Max Area of Island", difficulty: "medium", topic: "graphs" },
  { slug: "pacific-atlantic-water-flow", title: "Pacific Atlantic Water Flow", difficulty: "medium", topic: "graphs" },
  { slug: "surrounded-regions", title: "Surrounded Regions", difficulty: "medium", topic: "graphs" },
  { slug: "rotting-oranges", title: "Rotting Oranges", difficulty: "medium", topic: "graphs" },
  { slug: "course-schedule", title: "Course Schedule", difficulty: "medium", topic: "graphs" },
  { slug: "course-schedule-ii", title: "Course Schedule II", difficulty: "medium", topic: "graphs" },
  { slug: "redundant-connection", title: "Redundant Connection", difficulty: "medium", topic: "graphs" },
  { slug: "word-ladder", title: "Word Ladder", difficulty: "hard", topic: "graphs" },
  { slug: "subsets", title: "Subsets", difficulty: "medium", topic: "recursion-backtracking" },
  { slug: "combination-sum", title: "Combination Sum", difficulty: "medium", topic: "recursion-backtracking" },
  { slug: "permutations", title: "Permutations", difficulty: "medium", topic: "recursion-backtracking" },
  { slug: "subsets-ii", title: "Subsets II", difficulty: "medium", topic: "recursion-backtracking" },
  { slug: "combination-sum-ii", title: "Combination Sum II", difficulty: "medium", topic: "recursion-backtracking" },
  { slug: "palindrome-partitioning", title: "Palindrome Partitioning", difficulty: "medium", topic: "recursion-backtracking" },
  {
    slug: "letter-combinations-of-a-phone-number",
    title: "Letter Combinations of a Phone Number",
    difficulty: "medium",
    topic: "recursion-backtracking",
  },
  { slug: "n-queens", title: "N-Queens", difficulty: "hard", topic: "recursion-backtracking" },
  { slug: "climbing-stairs", title: "Climbing Stairs", difficulty: "easy", topic: "dynamic-programming" },
  { slug: "min-cost-climbing-stairs", title: "Min Cost Climbing Stairs", difficulty: "easy", topic: "dynamic-programming" },
  { slug: "house-robber", title: "House Robber", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "house-robber-ii", title: "House Robber II", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "longest-palindromic-substring", title: "Longest Palindromic Substring", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "palindromic-substrings", title: "Palindromic Substrings", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "decode-ways", title: "Decode Ways", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "coin-change", title: "Coin Change", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "word-break", title: "Word Break", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "longest-increasing-subsequence", title: "Longest Increasing Subsequence", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "partition-equal-subset-sum", title: "Partition Equal Subset Sum", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "unique-paths", title: "Unique Paths", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "longest-common-subsequence", title: "Longest Common Subsequence", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "combination-sum-iv", title: "Combination Sum IV", difficulty: "medium", topic: "dynamic-programming" },
  { slug: "jump-game", title: "Jump Game", difficulty: "medium", topic: "greedy" },
  { slug: "jump-game-ii", title: "Jump Game II", difficulty: "medium", topic: "greedy" },
  { slug: "gas-station", title: "Gas Station", difficulty: "medium", topic: "greedy" },
  { slug: "hand-of-straights", title: "Hand of Straights", difficulty: "medium", topic: "greedy" },
  { slug: "partition-labels", title: "Partition Labels", difficulty: "medium", topic: "greedy" },
  { slug: "merge-triplets-to-form-target-triplet", title: "Merge Triplets to Form Target Triplet", difficulty: "medium", topic: "greedy" },
  { slug: "valid-parenthesis-string", title: "Valid Parenthesis String", difficulty: "medium", topic: "greedy" },
  { slug: "insert-interval", title: "Insert Interval", difficulty: "medium", topic: "intervals" },
  { slug: "merge-intervals", title: "Merge Intervals", difficulty: "medium", topic: "intervals" },
  { slug: "non-overlapping-intervals", title: "Non-overlapping Intervals", difficulty: "medium", topic: "intervals" },
  {
    slug: "minimum-interval-to-include-each-query",
    title: "Minimum Interval to Include Each Query",
    difficulty: "hard",
    topic: "intervals",
  },
  { slug: "single-number", title: "Single Number", difficulty: "easy", topic: "bit-manipulation" },
  { slug: "number-of-1-bits", title: "Number of 1 Bits", difficulty: "easy", topic: "bit-manipulation" },
  { slug: "counting-bits", title: "Counting Bits", difficulty: "easy", topic: "bit-manipulation" },
  { slug: "reverse-bits", title: "Reverse Bits", difficulty: "easy", topic: "bit-manipulation" },
  { slug: "missing-number", title: "Missing Number", difficulty: "easy", topic: "bit-manipulation" },
  { slug: "sum-of-two-integers", title: "Sum of Two Integers", difficulty: "medium", topic: "bit-manipulation" },
  { slug: "palindrome-number", title: "Palindrome Number", difficulty: "easy", topic: "math" },
  { slug: "reverse-integer", title: "Reverse Integer", difficulty: "medium", topic: "math" },
  { slug: "happy-number", title: "Happy Number", difficulty: "easy", topic: "math" },
  { slug: "plus-one", title: "Plus One", difficulty: "easy", topic: "math" },
  { slug: "multiply-strings", title: "Multiply Strings", difficulty: "medium", topic: "math" },
];

export const catalogBySlug = new Map(CATALOG.map((p) => [p.slug, p]));
