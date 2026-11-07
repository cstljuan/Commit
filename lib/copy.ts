export type ModeCopy = {
  label: string;
  stampRight: string;
  stampLeft: string;
  stampUp: string;
  undo: string;
  match: string;
  teamFormed: string;
  emptyDeck: string;
};

// Git language is for Hack mode only.
export const copy: Record<'normal' | 'women' | 'hack', ModeCopy> = {
  normal: {
    label: 'Normal',
    stampRight: 'LIKE',
    stampLeft: 'PASS',
    stampUp: 'SUPER COMMIT',
    undo: 'Undo',
    match: "It's a match!",
    teamFormed: 'Team formed',
    emptyDeck: "You've seen everyone",
  },
  women: {
    label: 'Women',
    stampRight: 'OBSESSED',
    stampLeft: 'NOT IT',
    stampUp: 'ICON',
    undo: 'Wait, go back',
    match: 'Besties!',
    teamFormed: 'Girl gang formed',
    emptyDeck: "That's everyone for now",
  },
  hack: {
    label: 'Hack',
    stampRight: 'git add',
    stampLeft: '.gitignore',
    stampUp: 'git push --force',
    undo: 'git revert',
    match: "It's a merge!",
    teamFormed: 'merged into main',
    emptyDeck: 'nothing to commit, working tree clean',
  },
};
