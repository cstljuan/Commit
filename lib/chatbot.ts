import { getMyProjects } from './api';
import { demoMatches, demoPeople, demoTeam, type DemoMessage } from './demoData';
import { askLocalModel, llmAvailable, type LlmMessage } from './llm';

/**
 * Who answers in chat until real people are on the other end. Sample teammates and Hachi
 * read what you wrote and answer it, using a local model when one is reachable and the
 * replies below when not. Real matches will use getMessages and subscribeMessages from
 * lib/api.ts. Hachi stays as a helper either way.
 */
export const HACHI_CHAT = 'hachi';

export type ChatAction = { label: string; href: string };
export type Reply = { texts: string[]; action?: ChatAction; source: 'local' | 'built-in' };

type Intent = 'greet' | 'thanks' | 'bye' | 'commit' | 'time' | 'tech' | 'skills' | 'plan' | 'personal' | 'about' | 'real' | 'ack' | 'no';

const INTENTS: [Intent, RegExp][] = [
  ['real', /\b(are you (real|a bot|ai|human)|is this (a bot|real|ai)|you a bot)\b/],
  ['thanks', /\b(thanks|thank you|thx|ty|appreciate)\b/],
  ['bye', /\b(bye|gtg|got to go|gotta go|good ?night|gn|later|ttyl)\b/],
  ['greet', /^(hi+|hey+|hello|yo+|sup|hola|howdy|gm|what'?s up|wassup)\b/],
  ['commit', /\b(commit|committed|join|are you in|you in|on board|down to|lock in|locked in)\b/],
  ['time', /\b(when|tonight|tomorrow|today|free|available|hours?|deadline|schedule|sleep|meet|call|start)\b/],
  ['tech', /\b(stack|tech|supabase|postgres|sql|schema|database|db|api|auth|rls|react|expo|typescript|python|pytorch|model|llm|go|figma|motion|screens?|ui|design|deploy|frontend|backend)\b/],
  ['skills', /\b(experience|skills?|good at|built|worked on|background|used)\b/],
  ['plan', /\b(plan|split|divide|who does|what should|first|next|mvp|scope|feature|idea|project|todo|task|help)\b/],
  ['personal', /\b(how are|how'?s it|you good|tired|snack|coffee|food|pizza|tabs|spaces|music)\b/],
  ['about', /\b(who are you|about you|tell me about|student|school|major|study|where)\b/],
  ['no', /^(no|nah|nope|not really|can'?t)\b/],
  ['ack', /^(yes|yeah|yep|yup|sure|ok|okay|cool|nice|bet|perfect|great|sounds good|love|lol|haha|word|fine)\b/],
];

/** Everything a message asks, in priority order, so "when and how do we split it" gets both. */
const intentsOf = (text: string): Intent[] => {
  const s = text.toLowerCase().trim();
  return INTENTS.filter(([, re]) => re.test(s)).map(([name]) => name);
};

type Persona = {
  lines: Record<Intent, string[][]>;
  /** What this person brings up next, so a conversation always moves forward. */
  agenda: string[][];
  unknown: string[];
};

const PERSONAS: Record<string, Persona> = {
  ben_codes: {
    lines: {
      greet: [['hey', 'been looking at {project}, it\'s a good one'], ['yo, what are you working on right now']],
      thanks: [['anytime'], ['all good, that\'s what the team is for']],
      bye: [['later, I\'ll push the schema before I sleep'], ['night, text me if anything breaks']],
      commit: [['already held mine, it\'s on you now'], ['yeah I\'m in. hold the button and we\'re a team']],
      time: [['I can start tonight, probably until 3ish', 'tomorrow I\'m free after 11'], ['tonight works. give me an hour to get the tables up']],
      tech: [['Postgres on Supabase is what I would do', 'tables first, then row level security, then the API'], ['I can own the backend. you keep the screens, I\'ll hand you typed functions']],
      skills: [['mostly TypeScript and Postgres, some Go', 'I shipped a campus events API last semester'], ['backend is my thing. I\'m decent at SQL and bad at CSS']],
      plan: [['simple split: I take the backend and hand you typed functions, you keep the screens', 'do we have a designer yet?'], ['first thing is one full flow working end to end. everything else is extra']],
      personal: [['running on cold pizza and regret', 'you?'], ['tired but fine. hackathon tired, the good kind']],
      about: [['student, backend, third year', 'my worst commit message is literally asdf'], ['CS student. I like databases, which I know is weird']],
      real: [['honest answer, I\'m a demo teammate in Commit, not a real person', 'real matches text you here once they sign up']],
      ack: [['cool'], ['nice']],
      no: [['no worries, what would you do instead'], ['fair. what are you thinking']],
    },
    agenda: [
      ['I\'ll sketch the tables for {project} first'],
      ['do you want me on auth too or are you handling it'],
      ['we still need a designer, anyone in mind?'],
      ['hold to commit when you\'re good, I already did mine'],
    ],
    unknown: ['not sure I follow, is that for {project}?', 'hm say more', 'wait what do you mean, like for the backend or something else?'],
  },
  priya_builds: {
    lines: {
      greet: [['hi! tabs or spaces, be honest'], ['hey, I was just reading your idea again']],
      thanks: [['of course!'], ['happy to, this one\'s fun']],
      bye: [['bye! I\'ll send eval numbers when they finish'], ['night, go sleep at some point']],
      commit: [['I want to see a working upload first, then I\'ll hold it'], ['almost. show me the demo flow and I\'m in']],
      time: [['I\'m around until 2, then again at 10'], ['tonight is good, my training run is going anyway']],
      tech: [['I would start with a small model and a good prompt', 'then we measure what it gets wrong'], ['Python service, one endpoint, returns JSON. you just call it']],
      skills: [['Python and PyTorch mostly, and I can do Figma if I have to'], ['I did an NLP research project last year, so this is close']],
      plan: [['I own the model side, you own the app', 'the hard part is knowing when it is wrong'], ['smallest version: one input, one good output, then we measure']],
      personal: [['whatever ships, that\'s my answer to tabs or spaces'], ['good! too much caffeine, thanks for asking']],
      about: [['student, AI/ML, I like things that can be measured'], ['I\'m the person who asks for the eval numbers']],
      real: [['honest answer, I\'m a demo teammate in Commit, not a real person', 'real matches text you here once they sign up']],
      ack: [['love that'], ['ok good']],
      no: [['fair, why not though?'], ['ok what would you change']],
    },
    agenda: [
      ['can you send me some example data to test on'],
      ['what does a good result look like to you?'],
      ['I can have a first endpoint in a couple of hours'],
    ],
    unknown: ['wait, explain that like I haven\'t slept', 'hm tell me more', 'is that for the model side or the app side?'],
  },
  dev_ana: {
    lines: {
      greet: [['hey, did you see the screens I sent'], ['hi! I\'m moving things around in Figma, what\'s up']],
      thanks: [['anytime!'], ['of course']],
      bye: [['bye, I\'ll drop the next round in the morning'], ['talk soon']],
      commit: [['we\'re both in on {project}, it\'s official'], ['already committed, this one\'s happening']],
      time: [['evenings work best since I work during the day'], ['after 6 I\'m all yours']],
      tech: [['I can hand off in Figma or just write the React myself'], ['I care most about the first screen, it has to feel instant']],
      skills: [['design and front end, 4 years at a small studio'], ['Figma, React and a lot of motion work']],
      plan: [['next up is the main flow', 'three taps max or nobody uses it'], ['I\'ll do flows, you check they\'re buildable']],
      personal: [['tabs. fight me'], ['good, too many Figma frames open though']],
      about: [['I work as a designer, this is my side thing'], ['product designer by day, hackathon goblin by night']],
      real: [['honest answer, I\'m a demo teammate in Commit, not a real person', 'real matches text you here once they sign up']],
      ack: [['great'], ['perfect']],
      no: [['ok what\'s bugging you about it'], ['fair, want a different direction?']],
    },
    agenda: [
      ['I\'m thinking one big number on top and a list under it, thoughts?'],
      ['should this work before people make an account?'],
      ['I\'ll send the next screens when you\'re happy with this flow'],
    ],
    unknown: ['not sure I get it, can you show me?', 'say more?', 'is that a design thing or a build thing?'],
  },
};

// Never the same line twice in a row: each chat walks through its options.
const seen = new Map<string, number>();
const pick = <T,>(chatId: string, key: string, options: T[]): T => {
  const id = `${chatId}:${key}`;
  const n = seen.get(id) ?? 0;
  seen.set(id, n + 1);
  return options[n % options.length];
};

const VOICE_BY_ROLE: Partial<Record<string, string>> = { 'AI/ML': 'priya_builds', Design: 'dev_ana', Frontend: 'dev_ana' };

type Peer = { role: string; project: string };
const peers = new Map<string, Peer>();
/** Lets a sample match made from a swipe answer in a voice that fits its role and project. */
export const rememberMatch = (matchId: string, peer: Peer) => {
  peers.set(matchId, peer);
};
export const peerOf = (matchId: string) => peers.get(matchId);

const personaReply = (chatId: string, username: string, text: string): string[] => {
  const persona = PERSONAS[username] ?? PERSONAS[VOICE_BY_ROLE[peers.get(chatId)?.role ?? ''] ?? 'ben_codes'];
  const intents = intentsOf(text);
  const intent = intents[0] ?? null;
  const asks = intents.filter((i) => i !== 'ack' && i !== 'no' && i !== 'greet');
  if (asks.length >= 2) return [pick(chatId, asks[0], persona.lines[asks[0]])[0], pick(chatId, asks[1], persona.lines[asks[1]])[0]];
  if (intent === 'ack' || intent === null) {
    // A question they cannot answer gets a straight "what do you mean". Anything else moves on.
    if (intent === null && text.trim().endsWith('?')) return [pick(chatId, 'unknown', persona.unknown)];
    if (intent === null && text.trim().split(/\s+/).length <= 2) return [pick(chatId, 'unknown', persona.unknown)];
    const next = pick(chatId, 'agenda', persona.agenda);
    return intent === 'ack' ? [pick(chatId, 'ack', persona.lines.ack)[0], ...next] : next;
  }
  return pick(chatId, intent, persona.lines[intent]);
};

// The project Hachi talks about: your newest one, or the sample until you have one.
let current: { id: string; title: string; idea: string; roles: { role: string; username: string | null }[] } = demoTeam;

const firstMessageTip = () => {
  const m = demoMatches.find((x) => !x.iCommitted) ?? demoMatches[0];
  return `Ask @${m.username} something specific about ${m.project}. Like: "What would you build first if we only had tonight?"`;
};

// Hachi in Normal and Hack, Hana in Women mode. The chat screen sets it.
let mascot = 'Hachi';
export const setMascot = (name: string) => {
  mascot = name;
};

const HACHI_TOPICS: { re: RegExp; texts: () => string[]; action?: ChatAction }[] = [
  {
    re: /\b(are you (real|a bot|ai|human)|who are you|what are you|your name|hachi|hana|octopus)\b/,
    texts: () => [
      mascot === 'Hana'
        ? 'I am Hana, the octopus who runs Women mode. Hana means flower. Hachi is my brother.'
        : 'I am Hachi, the octopus that lives in Commit. Hachi means eight, and yes, I can count.',
      'There are 13 ways to play with me. Can you find them all?',
    ],
    action: { label: 'Play with me', href: '/hachi' },
  },
  {
    re: /\b(teammate|team|who should|need|designer|find|looking for|roles?|gap)\b/,
    texts: () => {
      const open = current.roles.filter((r) => !r.username).map((r) => r.role);
      return [`${current.title} still needs ${open.join(' and ') || 'nobody, the team is full'}.`, 'Filter the deck to that role and swipe only on people who fill it.'];
    },
    action: { label: 'Open filters', href: '/filters' },
  },
  {
    re: /\b(first message|icebreaker|what do i say|what should i say|text them|message|say to)\b/,
    texts: () => [firstMessageTip(), 'Specific questions get answers. "hey" gets "hey".'],
    action: { label: 'See my matches', href: '/teams' },
  },
  {
    re: /\b(pitch|describe|description|summary|write|blurb|explain my)\b/,
    texts: () => [`Try this for ${current.title}: "${current.idea}"`, 'One sentence, what it does, and who it helps. Want a different angle? Tell me who it is for.'],
    action: { label: 'Open my project', href: '/project/current' },
  },
  {
    re: /\b(score|reliab|shows? up|ghost|points?|flake)\b/,
    texts: () => ['Everyone starts at 70. Finishing a project is +5, leaving with notice is -3, and ghosting your team is -15.', 'Beginners are not punished, and scores recover over time.'],
    action: { label: 'See my score', href: '/score' },
  },
  {
    re: /\b(copy|copied|stole|steal|stolen|reworded|rip ?off|alert|similar)\b/,
    texts: () => ['If someone posts a reworded version of your idea, I warn you and only you.', 'Your commit hash and timestamp show you had it first, and you decide what to do next.'],
    action: { label: 'See an example', href: '/alert' },
  },
  {
    re: /\b(hash|proof|prove|chain|verify|tamper|timestamp)\b/,
    texts: () => ['Each idea gets a hash that links to the one before it, like git. Change one old entry and every hash after it stops matching.', 'Tap Simulate an edit and watch me catch it.'],
    action: { label: 'Open Verify', href: '/verify' },
  },
  {
    re: /\b(private|encrypt|secret|safe|privacy|who can see|security)\b/,
    texts: () => ['Private ideas are built to encrypt on your phone before upload, so only your team can read them.', 'Public ideas show on the deck. You pick per idea.'],
  },
  {
    re: /\b(commit|hold|join)\b/,
    texts: () => ['Joining is a promise, so it takes a held press instead of a tap. When both of you hold, you are a team.'],
    action: { label: 'See my projects', href: '/projects' },
  },
  {
    re: /\b(modes?|women|normal|hack mode)\b/,
    texts: () => ['Commit has three modes: Normal, Women and Hack. Each has its own deck and its own look. Switch at the top of Swipe.'],
  },
  {
    re: /\b(idea|what should i build|brainstorm|stuck|project)\b/,
    texts: () => ['Start with something that annoyed you this week. What was it?', 'Then post it and let the deck find you the people to build it.'],
    action: { label: 'See my projects', href: '/projects' },
  },
  {
    re: /\b(joke|funny|bored)\b/,
    texts: () => ['Why did the developer go broke? They used up all their cache.', 'I have eight limbs and no sense of shame.'],
  },
  { re: /\b(thanks|thank you|thx|ty)\b/, texts: () => ['Any time. Go find your people.'] },
  { re: /\b(bye|good ?night|gn|later)\b/, texts: () => ['Night. I will be asleep on the tab bar.'] },
  {
    re: /^(hi+|hey+|hello|yo+|sup|hola|gm|what'?s up|wassup)\b/,
    texts: () => ['Hey! I can help you find teammates, write your pitch, plan a first message, or explain your score and proof.', 'What do you need?'],
  },
];

const hachiTopic = (text: string) => HACHI_TOPICS.find((topic) => topic.re.test(text.toLowerCase().trim()));

const hachiReply = (chatId: string, text: string) => {
  const topic = hachiTopic(text);
  if (topic) {
    const action = topic.action && { ...topic.action, href: topic.action.href.replace('/project/current', `/project/${current.id}`) };
    return { texts: topic.texts(), action };
  }
  return {
    texts: [pick(chatId, 'unknown', ["I can't help with that one yet.", 'That one is beyond my eight arms.']), 'I am good at teammates, your pitch, first messages, your score and proof. Which one?'],
    action: undefined,
  };
};

const systemPrompt = (chatId: string, username?: string): string => {
  if (chatId === HACHI_CHAT || !username) {
    return [
      `You are ${mascot}, the small octopus mascot inside Commit, an app for finding hackathon and project teammates by swiping.`,
      'Talk like a friendly, slightly cheeky friend in a chat app: usually one sentence, two at most. Answer what they actually asked, using their words.',
      'No emoji, no lists, no "let me know if", no "as an AI", never start with "Sure" or "Great question". Never invent app features or numbers.',
      'Facts: people swipe on projects and builders by role. Both saying yes is a match. Joining takes a held press called a commit.',
      'The shows up score starts at 70: finishing is +5, leaving with notice is -3, ghosting is -15.',
      'Ideas get a hash chained to the previous one, like git, so tampering is detectable. Reworded copies raise a private alert to the owner.',
      `The user's project is ${current.title}, and it still needs: ${current.roles.filter((r) => !r.username).map((r) => r.role).join(', ')}.`,
    ].join(' ');
  }
  const p = demoPeople[username];
  const peer = peers.get(chatId);
  const project = peer?.project ?? demoMatches.find((m) => m.username === username)?.project ?? 'the project';
  return [
    `You are @${username}, a ${p?.level ?? ''} ${p?.role ?? peer?.role ?? ''} builder (${p?.occupation ?? 'student'}) texting a possible teammate about the project "${project}".`,
    p ? `You know ${p.skills.join(', ')}.` : '',
    'You are texting, not writing an email. Usually 3 to 15 words, lowercase, casual, sometimes just a quick reaction like "oh nice" or "wait fr?".',
    'React to exactly what they just said first. Ask a question back about half the time. Have opinions and small details (a time you are free, a tool you like, what you would build first).',
    'Never repeat an earlier message, never sound like customer support, no emoji, no lists, no "let me know", no "sounds great!" openers.',
    'If they are confused, explain your last message in plain words. If asked whether you are real, say you are a demo teammate in the Commit app, not a real person.',
  ].join(' ');
};

const TEXTING_EXAMPLES: LlmMessage[] = [
  { role: 'user', content: 'you free tonight?' },
  { role: 'assistant', content: 'ya after 9, lab till then' },
  { role: 'user', content: 'what would you build first' },
  { role: 'assistant', content: 'the quiz screen honestly. if that feels good the rest is easy' },
  { role: 'user', content: 'i can do backend' },
  { role: 'assistant', content: 'oh perfect, supabase? i can take the screens' },
];

/** Answers the latest message. Always resolves, with built-in replies if no model answers. */
export async function getReply(chatId: string, username: string | undefined, history: DemoMessage[]): Promise<Reply> {
  const last = history[history.length - 1]?.body ?? '';
  const isHachi = chatId === HACHI_CHAT;
  if (isHachi) current = (await getMyProjects().catch(() => [])).find((p) => p.mine) ?? demoTeam;
  if (llmAvailable()) {
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt(chatId, username) },
      // A small model copies examples better than it follows rules, so show it how a teammate texts.
      ...(isHachi ? [] : TEXTING_EXAMPLES),
      ...history.slice(-12).map((m): LlmMessage => ({ role: m.mine ? 'user' : 'assistant', content: m.body })),
    ];
    let text = await askLocalModel(messages);
    // Teammates text in lowercase; Hachi and Hana keep their capitals.
    if (text && !isHachi) text = text.charAt(0).toLowerCase() + text.slice(1);
    if (text) return { texts: [text], action: isHachi ? hachiTopic(last)?.action : undefined, source: 'local' };
  }
  if (isHachi) return { ...hachiReply(chatId, last), source: 'built-in' };
  const project = peers.get(chatId)?.project ?? demoMatches.find((m) => m.username === username)?.project ?? 'the project';
  // Confused? Explain the last thing we said instead of changing the subject.
  if (/\b(what (do|does) (you|that|dat|it) mean|what dat mean|what does that mean|you just said|who are you talking to|huh|confus|what are you (on|saying))\b/i.test(last) || /^what\b.{0,30}\?*$/i.test(last.trim())) {
    const said = [...history].reverse().find((m) => !m.mine)?.body;
    const texts = /who are you talking to/i.test(last)
      ? ['you, sorry, I was thinking out loud', `I mean ${project}: what part do you want to take?`]
      : said
        ? [`my bad, I meant: ${said.replace(/^(my bad, I meant: )+/i, '')}`, `basically, how do you want to split ${project}?`]
        : [`sorry, I mean ${project}. what part do you want to take?`];
    return { texts, source: 'built-in' };
  }
  const texts = personaReply(chatId, username ?? 'ben_codes', last).map((t) => t.replace('{project}', project));
  return { texts, source: 'built-in' };
}

// Conversations last while the app is open, so leaving a chat and coming back keeps them.
const threads = new Map<string, DemoMessage[]>();
export const getThread = (chatId: string, initial: DemoMessage[]) => threads.get(chatId) ?? initial;
export const saveThread = (chatId: string, messages: DemoMessage[]) => {
  threads.set(chatId, messages);
};
export const lastLineOf = (chatId: string) => {
  const t = threads.get(chatId);
  return t?.[t.length - 1]?.body;
};
