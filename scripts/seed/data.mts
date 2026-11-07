// Synthetic demo data. Every person, project and prompt here is made up.
// No real photos: avatarUrl stays null, the app draws a Critter from the public key.

export type Role = 'Frontend' | 'Backend' | 'AI/ML' | 'Security' | 'Mobile' | 'Design' | 'PM' | 'Hardware';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export type SeedUser = {
  key: string; // stable id inside this file, also the email local part
  name: string;
  username: string;
  role: Role;
  level: Level;
  occupation: 'student' | 'working';
  skills: string[];
  prompts: { q: string; a: string }[];
  hours: number;
  reliability: number; // seeded so the deck order visibly changes
  womenOnly?: boolean;
  demo?: boolean; // Alice and Bob: real demo accounts, keys come from their phones (F11)
  hackNeeds?: { role: Role; open: number }[]; // if set, the user has a hack team shell
};

export type SeedProject = {
  key: string;
  owner: string; // SeedUser.key
  title: string;
  teaser: string;
  visibility: 'private' | 'public';
  idea: string; // full idea. Public: stored as idea_public. Private: encrypted with a team key.
  theme: string;
  timeframe: 'weekend' | '1 month' | 'semester' | 'ongoing';
  githubUrl?: string;
  roles: { role: Role; open: number }[];
  womenOnly?: boolean;
};

export const DEMO_DOMAIN = 'commit-demo.dev';

export const users: SeedUser[] = [
  { key: 'alice', name: 'Alice', username: 'alice_ships', role: 'Frontend', level: 'intermediate', occupation: 'student',
    skills: ['React Native', 'TypeScript', 'Figma'], hours: 12, reliability: 91, demo: true,
    prompts: [{ q: 'Worst commit message', a: 'final_final_v3' }, { q: 'I will not shut up about', a: 'Spaced repetition' }] },
  { key: 'bob', name: 'Bob', username: 'bob_builds', role: 'Backend', level: 'intermediate', occupation: 'student',
    skills: ['TypeScript', 'Postgres', 'Python', 'Supabase'], hours: 10, reliability: 82, demo: true,
    prompts: [{ q: 'Worst commit message', a: 'fix fix fix' }, { q: 'I will not shut up about', a: 'Row level security' }] },

  { key: 'priya', name: 'Priya', username: 'priya_pixels', role: 'Design', level: 'advanced', occupation: 'working',
    skills: ['Figma', 'Motion', 'Design systems'], hours: 8, reliability: 94,
    prompts: [{ q: 'My toxic trait', a: 'Redoing the icon set at 3 AM' }, { q: 'Green flag in a teammate', a: 'Names their layers' }] },
  { key: 'kenji', name: 'Kenji', username: 'kenji_kernels', role: 'Security', level: 'intermediate', occupation: 'student',
    skills: ['Rust', 'Threat modeling', 'CTFs'], hours: 15, reliability: 85,
    prompts: [{ q: 'I will not shut up about', a: 'Timing attacks' }] },
  { key: 'sam', name: 'Sam', username: 'sam_ships_ml', role: 'AI/ML', level: 'beginner', occupation: 'student',
    skills: ['Python', 'PyTorch', 'Jupyter'], hours: 20, reliability: 70,
    prompts: [{ q: 'Worst commit message', a: 'it works now dont touch' }] },
  { key: 'miguel', name: 'Miguel', username: 'miguel_maps', role: 'Mobile', level: 'advanced', occupation: 'working',
    skills: ['Swift', 'MapKit', 'Kotlin'], hours: 6, reliability: 77,
    prompts: [{ q: 'Best side project', a: 'A bus tracker my whole dorm uses' }] },
  { key: 'dana', name: 'Dana', username: 'dana_dev', role: 'Frontend', level: 'beginner', occupation: 'student',
    skills: ['HTML', 'CSS', 'JavaScript'], hours: 10, reliability: 62,
    prompts: [{ q: 'First hackathon?', a: 'Second, the first one we shipped a toaster app' }] },
  { key: 'ola', name: 'Ola', username: 'ola_audio', role: 'PM', level: 'intermediate', occupation: 'student',
    skills: ['Roadmaps', 'User interviews', 'Notion'], hours: 9, reliability: 72,
    prompts: [{ q: 'Green flag in a teammate', a: 'Says the scary thing early' }] },
  { key: 'lee', name: 'Lee', username: 'lee_lens', role: 'Hardware', level: 'intermediate', occupation: 'student',
    skills: ['Arduino', 'C++', 'Raspberry Pi'], hours: 11, reliability: 80,
    prompts: [{ q: 'Best thing I soldered', a: 'A plant that texts me when it is thirsty' }] },

  // Women mode
  { key: 'nina', name: 'Nina', username: 'nina_nodes', role: 'Backend', level: 'advanced', occupation: 'working',
    skills: ['Go', 'Postgres', 'Kubernetes'], hours: 7, reliability: 89, womenOnly: true,
    prompts: [{ q: 'My toxic trait', a: 'Writing a migration for one column' }] },
  { key: 'zara', name: 'Zara', username: 'zara_zaps', role: 'Frontend', level: 'advanced', occupation: 'student',
    skills: ['React Native', 'Reanimated', 'TypeScript'], hours: 14, reliability: 90, womenOnly: true,
    prompts: [{ q: 'My toxic trait', a: 'Animating the loading spinner' }] },
  { key: 'aisha', name: 'Aisha', username: 'aisha_algo', role: 'AI/ML', level: 'intermediate', occupation: 'student',
    skills: ['Python', 'scikit-learn', 'SQL'], hours: 10, reliability: 83, womenOnly: true,
    prompts: [{ q: 'I will not shut up about', a: 'Evaluation sets' }] },
  { key: 'mei', name: 'Mei', username: 'mei_makes', role: 'Hardware', level: 'intermediate', occupation: 'working',
    skills: ['Arduino', 'C++', '3D printing'], hours: 5, reliability: 78, womenOnly: true,
    prompts: [{ q: 'Best side project', a: 'Lamp that dims when my calendar is full' }] },
  { key: 'fatima', name: 'Fatima', username: 'fatima_figma', role: 'Design', level: 'beginner', occupation: 'student',
    skills: ['Figma', 'Illustration'], hours: 12, reliability: 74, womenOnly: true,
    prompts: [{ q: 'Green flag in a teammate', a: 'Leaves comments, not vibes' }] },

  // Hack mode (each has a hack team shell with roles needed)
  { key: 'rio', name: 'Rio', username: 'rio_rebases', role: 'Frontend', level: 'advanced', occupation: 'student',
    skills: ['React', 'Expo', 'Tailwind'], hours: 24, reliability: 88, hackNeeds: [{ role: 'Backend', open: 1 }, { role: 'Design', open: 1 }],
    prompts: [{ q: 'git blame says', a: 'it was me, it is always me' }] },
  { key: 'tess', name: 'Tess', username: 'tess_tensors', role: 'AI/ML', level: 'intermediate', occupation: 'student',
    skills: ['Python', 'FastAPI', 'Embeddings'], hours: 24, reliability: 81, hackNeeds: [{ role: 'Backend', open: 2 }],
    prompts: [{ q: 'Hackathon fuel', a: 'Cold brew and spite' }] },
  { key: 'omar', name: 'Omar', username: 'omar_ops', role: 'Security', level: 'advanced', occupation: 'working',
    skills: ['Pentesting', 'Go', 'Docker'], hours: 24, reliability: 93, hackNeeds: [{ role: 'Frontend', open: 1 }, { role: 'Design', open: 1 }],
    prompts: [{ q: 'Sleep schedule this weekend', a: 'git stash' }] },
  { key: 'lina', name: 'Lina', username: 'lina_layouts', role: 'Design', level: 'intermediate', occupation: 'student',
    skills: ['Figma', 'Prototyping'], hours: 24, reliability: 76, hackNeeds: [{ role: 'Backend', open: 1 }, { role: 'Mobile', open: 1 }],
    prompts: [{ q: 'Merge conflict style', a: 'Accept both, cry later' }] },
];

export const projects: SeedProject[] = [
  // The judge swipe: Alice's project, first in Bob's deck (Alice has already liked Bob, so Bob's right swipe matches).
  // Public because Alice's keys live on her phone (F11), so the script cannot wrap a team key she could open.
  { key: 'tutor', owner: 'alice', title: 'Pocket Tutor', visibility: 'public', theme: 'Education', timeframe: 'weekend',
    teaser: 'Turns your lecture notes into quizzes that target what you keep forgetting.',
    idea: 'A study app that reads your lecture notes, builds short quizzes from them, and uses spaced repetition to resurface the exact facts you missed last time. It tracks which topics you keep forgetting and schedules a five minute review before each class.',
    roles: [{ role: 'Backend', open: 1 }, { role: 'AI/ML', open: 1 }] },
  { key: 'greenroute', owner: 'miguel', title: 'GreenRoute', visibility: 'public', theme: 'Climate', timeframe: '1 month',
    githubUrl: 'https://github.com/example/greenroute',
    teaser: 'Bike commute planner that picks the route with the cleanest air.',
    idea: 'GreenRoute pulls open air quality sensor data and city bike lane maps, then scores each route by exposure, not just distance. Riders get a daily commute suggestion and a weekly lungs report.',
    roles: [{ role: 'Backend', open: 1 }, { role: 'Design', open: 1 }] },
  { key: 'shelfie', owner: 'dana', title: 'Shelfie', visibility: 'private', theme: 'Food', timeframe: 'weekend',
    teaser: 'Snap your pantry, get three dinners you can make tonight.',
    idea: 'Take a photo of your shelves, an image model lists the ingredients, and the app suggests three recipes that use what you already have, sorted by cooking time.',
    roles: [{ role: 'AI/ML', open: 1 }, { role: 'Backend', open: 1 }] },
  { key: 'studyjams', owner: 'ola', title: 'StudyJams', visibility: 'public', theme: 'Social', timeframe: 'semester',
    teaser: 'Lo-fi study rooms where your friends can see you are actually working.',
    idea: 'Shared focus rooms with a lo-fi soundtrack. Friends join a room, set a goal, and see each other\'s timers. Breaks are synced so the room chats together for five minutes every hour.',
    roles: [{ role: 'Frontend', open: 1 }, { role: 'Backend', open: 1 }] },
  { key: 'lostfound', owner: 'lee', title: 'Campus Lost and Found', visibility: 'public', theme: 'Campus', timeframe: '1 month',
    teaser: 'Report a lost item, get pinged when someone finds something that looks like it.',
    idea: 'Students post found items with a photo. An image model matches them against lost reports and notifies the owner, who verifies with a detail only they would know.',
    roles: [{ role: 'Mobile', open: 1 }, { role: 'Backend', open: 1 }] },
  { key: 'ctfcoach', owner: 'kenji', title: 'CTF Coach', visibility: 'private', theme: 'Security', timeframe: 'ongoing',
    teaser: 'Practice capture the flag puzzles with hints that teach, not spoil.',
    idea: 'A practice platform for beginner CTF players. Each puzzle has three levels of hints that explain the concept behind the exploit, and a weekly team ladder.',
    roles: [{ role: 'Frontend', open: 1 }, { role: 'Backend', open: 1 }] },
  // Women mode projects
  { key: 'cyclesafe', owner: 'nina', title: 'CycleSafe', visibility: 'private', theme: 'Health', timeframe: '1 month', womenOnly: true,
    teaser: 'Period tracker where your data never leaves your phone.',
    idea: 'A cycle tracker that keeps every entry encrypted on the device, with optional end to end sync between a user\'s own devices. Predictions run locally.',
    roles: [{ role: 'Mobile', open: 1 }, { role: 'Security', open: 1 }] },
  { key: 'mentormatch', owner: 'aisha', title: 'MentorMatch', visibility: 'public', theme: 'Education', timeframe: 'semester', womenOnly: true,
    teaser: 'Pairs first year CS students with seniors who took the same classes.',
    idea: 'Seniors list classes they aced and hours they can give. First years get matched by class and schedule, with a 20 minute first call template so nobody has to plan it.',
    roles: [{ role: 'Backend', open: 1 }, { role: 'Design', open: 1 }] },
];
