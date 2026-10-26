// Exercise order within a running session: shuffling (#67) and restoring a
// paused session's order. Pure functions, so they can be checked without React.

// Group consecutive exercises into blocks: exercise i joins i+1 when linksToNext(i).
// started(i) marks an exercise as started; a block is started if any member is.
export function exerciseBlocks(count, linksToNext, started) {
  const blocks = [];
  let current = null;
  for (let i = 0; i < count; i++) {
    if (!current) current = { indices: [], started: false };
    current.indices.push(i);
    current.started ||= started(i);
    if (!linksToNext(i)) {
      blocks.push(current);
      current = null;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

export function canShuffle(blocks) {
  return blocks.filter((b) => !b.started).length >= 2;
}

// New index order: started blocks stay on top in their order, the untouched
// blocks follow in Fisher–Yates order. Blocks keep their internal order.
export function shuffleOrder(blocks, random = Math.random) {
  const started = blocks.filter((b) => b.started);
  const untouched = blocks.filter((b) => !b.started);
  for (let i = untouched.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [untouched[i], untouched[j]] = [untouched[j], untouched[i]];
  }
  return [...started, ...untouched].flatMap((b) => b.indices);
}

// Superset links (i -> i+1) at their new indices. Linked exercises share a block,
// so they stay next to each other in the new order.
export function remapSupersets(supersets, order) {
  const next = new Set();
  order.forEach((oldIdx, newIdx) => {
    if (supersets.has(oldIdx) && order[newIdx + 1] === oldIdx + 1) next.add(newIdx);
  });
  return next;
}

// A resumed session follows the saved sets' order, not the template's. Exercises
// removed during the session are left out, and saved sets whose exercise can't
// be found are skipped, so exercises and sets stay parallel.
export function restoreOrder(templateExercises, savedSets) {
  const byId = new Map(templateExercises.map((ex) => [ex.id, ex]));
  const kept = savedSets.filter((s) => byId.has(s.exerciseId));
  return { exercises: kept.map((s) => byId.get(s.exerciseId)), sets: kept };
}
