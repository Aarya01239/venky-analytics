export function insertedRange(previous: string, next: string) {
  let start = 0;
  while (start < previous.length && previous[start] === next[start]) start++;
  let previousEnd = previous.length;
  let end = next.length;
  while (previousEnd > start && end > start && previous[previousEnd - 1] === next[end - 1]) {
    previousEnd--;
    end--;
  }
  return { start, end };
}
