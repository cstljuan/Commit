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
      greet: [['hey', 'been looking at the study buddy idea, it\'s a good one'], ['yo, what are you working on right now']],
      thanks: [['anytime'], ['all good, that\'s what the team is for']],
      bye: [['later, I\'ll push the schema before I sleep'], ['night, text me if anything breaks']],
      commit: [['already held mine, it\'s on you now'], ['yeah I\'m in. hold the button and we\'re a team']],
      time: [['I can start tonight, probably until 3ish', 'tomorrow I\'m free after 11'], ['tonight works. give me an hour to get the tables up']],
      tech: [['Postgres on Supabase is what I would do', 'tables first, then row level security, then the API'], ['I can own the backend. you keep the screens, I\'ll hand you typed functions']],
      skills: [['mostly TypeScript and Postgres, some Go', 'I shipped a campus events API last semester'], ['backend is my thing. I\'m decent at SQL and bad at CSS']],
      plan: [['simple split: I do notes, quizzes and attempts tables, you do upload and the quiz screen', 'we need a designer though'], ['first thing is upload notes, get a quiz back. everything else is extra']],
      personal: [['running on cold pizza and regret', 'you?'], ['tired but fine. hackathon tired, the good kind']],
      about: [['student, backend, third year', 'my worst commit message is literally asdf'], ['CS student. I like databases, which I know is weird']],
      real: [['honest answer, I\'m a demo teammate in Commit, not a real person', 'real matches text you here once they sign up']],
      ack: [['cool'], ['nice']],
      no: [['no worries, what would you do instead'], ['fair. what are you thinking']],
    },
    agenda: [
      ['I\'ll make the tables for notes, quizzes and attempts first'],
      ['do you want me on auth too or are you handling it'],
      ['we still need a designer, anyone in mind?'],
      ['hold to commit when you\'re good, I already did mine'],
    ],
    unknown: ['not sure I follow, is that for the study buddy?', 'hm say more', 'wait what do you mean, like for the quiz part or something else?'],
  },
  priya_builds: {
    lines: {
      greet: [['hi! tabs or spaces, be honest'], ['hey, I was just testing quiz generation on my bio notes']],
      thanks: [['of course!'], ['happy to, this one\'s fun']],
      bye: [['bye! I\'ll send eval numbers when they finish'], ['night, go sleep at some point']],
      commit: [['I want to see a working upload first, then I\'ll hold it'], ['almost. show me the demo flow and I\'m in']],
      time: [['I\'m around until 2, then again at 10'], ['tonight is good, my training run is going anyway']],
      tech: [['for quizzes I would start with a small model and a good prompt', 'we can measure which questions people miss'], ['Python service, one endpoint, returns questions as JSON. you just call it']],
      skills: [['Python and PyTorch mostly, and I can do Figma if I have to'], ['I did an NLP research project on question generation, so this is close']],
      plan: [['I own the quiz generation, you own getting notes in', 'the hard part is picking what to ask again'], ['smallest version: paste text, get 5 questions, track the wrong ones']],
      personal: [['whatever ships, that\'s my answer to tabs or spaces'], ['good! too much caffeine, thanks for asking']],
      about: [['student, AI/ML, I like things that can be measured'], ['I\'m the person who asks for the eval numbers']],
      real: [['honest answer, I\'m a demo teammate in Commit, not a real person', 'real matches text you here once they sign up']],
      ack: [['love that'], ['ok good']],
      no: [['fair, why not though?'], ['ok what would you change']],
    },
    agenda: [
      ['can you send me some example notes to test on'],
      ['should wrong answers come back the next day or the same session?'],
      ['I can have a first quiz endpoint in a couple of hours'],
    ],
    unknown: ['wait, explain that like I haven\'t slept', 'hm tell me more', 'is that for the quiz side or the app side?'],
  },
  dev_ana: {
    lines: {
      greet: [['hey, did you see the screens I sent'], ['hi! I\'m moving things around in Figma, what\'s up']],
      thanks: [['anytime!'], ['of course']],
      bye: [['bye, I\'ll drop the next round in the morning'], ['talk soon']],
      commit: [['we\'re both in on Rent splitter, it\'s official'], ['already committed, this one\'s happening']],
      time: [['evenings work best since I work during the day'], ['after 6 I\'m all yours']],
      tech: [['I can hand off in Figma or just write the React myself'], ['I care most about the split screen, it has to feel instant']],
      skills: [['design and front end, 4 years at a small studio'], ['Figma, React and a lot of motion work']],
      plan: [['next up is the add expense flow', 'three taps max or nobody uses it'], ['I\'ll do flows, you check they\'re buildable']],
      personal: [['tabs. fight me'], ['good, too many Figma frames open though']],
      about: [['I work as a designer, this is my side thing'], ['product designer by day, hackathon goblin by night']],
      real: [['honest answer, I\'m a demo teammate in Commit, not a real person', 'real matches text you here once they sign up']],
      ack: [['great'], ['perfect']],
      no: [['ok what\'s bugging you about it'], ['fair, want a different direction?']],
    },
    agenda: [
      ['I\'m thinking one big total on top and a list under it, thoughts?'],
      ['should people settle up inside the app or just mark it paid'],
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

const personaReply = (chatId: string, username: string, text: string): string[] => {
  const persona = PERSONAS[username] ?? PERSONAS.ben_codes;
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

const firstMessageTip = () => {
  const m = demoMatches.find((x) => !x.iCommitted) ?? demoMatches[0];
  return `Ask @${m.username} something specific about ${m.project}. Like: "What would you build first if we only had tonight?"`;
};

const HACHI_TOPICS: { re: RegExp; texts: () => string[]; action?: ChatAction }[] = [
  {
    re: /\b(are you (real|a bot|ai|human)|who are you|what are you|your name|hachi|octopus)\b/,
    texts: () => ['I am Hachi, the octopus that lives in Commit. Hachi means eight, and yes, I can count.', 'There are 13 ways to play with me. Can you find them all?'],
    action: { label: 'Meet Hachi', href: '/hachi' },
  },
  {
    re: /\b(teammate|team|who should|need|designer|find|looking for|roles?|gap)\b/,
    texts: () => {
      const open = demoTeam.roles.filter((r) => !r.username).map((r) => r.role);
      return [`${demoTeam.title} still needs ${open.join(' and ') || 'nobody, the team is full'}.`, 'Filter the deck to that role and swipe only on people who fill it.'];
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
    texts: () => [`Try this for ${demoTeam.title}: "Upload your notes, get a quiz that keeps asking what you got wrong until you stop getting it wrong."`, 'One sentence, what it does, and who it helps. Want a different angle? Tell me who it is for.'],
    action: { label: 'Open my project', href: `/project/${demoTeam.id}` },
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
  if (topic) return { texts: topic.texts(), action: topic.action };
  return {
    texts: [pick(chatId, 'unknown', ["I can't help with that one yet.", 'That one is beyond my eight arms.']), 'I am good at teammates, your pitch, first messages, your score and proof. Which one?'],
    action: undefined,
  };
};

const systemPrompt = (chatId: string, username?: string): string => {
  if (chatId === HACHI_CHAT || !username) {
    return [
      'You are Hachi, the small octopus mascot inside Commit, an app for finding hackathon and project teammates by swiping.',
      'Reply in one or two short, warm sentences. No emoji. No lists. Never invent app features or numbers.',
      'Facts: people swipe on projects and builders by role. Both saying yes is a match. Joining takes a held press called a commit.',
      'The shows up score starts at 70: finishing is +5, leaving with notice is -3, ghosting is -15.',
      'Ideas get a hash chained to the previous one, like git, so tampering is detectable. Reworded copies raise a private alert to the owner.',
      `The sample project is ${demoTeam.title}, and it still needs: ${demoTeam.roles.filter((r) => !r.username).map((r) => r.role).join(', ')}.`,
    ].join(' ');
  }
  const p = demoPeople[username];
  const match = demoMatches.find((m) => m.username === username);
  return [
    `You are @${username}, a ${p?.level ?? ''} ${p?.role ?? ''} builder (${p?.occupation ?? 'student'}) texting a possible teammate about their project "${match?.project ?? 'the project'}".`,
    `You know ${p?.skills.join(', ') ?? 'a few things'}.`,
    'Text like a real person: one or two short lowercase sentences, no emoji, no lists, stay on the project and move it forward with a concrete next step.',
    'If asked whether you are real, say you are a demo teammate in the Commit app, not a real person.',
  ].join(' ');
};

/** Answers the latest message. Always resolves, with built-in replies if no model answers. */
export async function getReply(chatId: string, username: string | undefined, history: DemoMessage[]): Promise<Reply> {
  const last = history[history.length - 1]?.body ?? '';
  const isHachi = chatId === HACHI_CHAT;
  if (llmAvailable()) {
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt(chatId, username) },
      ...history.slice(-12).map((m): LlmMessage => ({ role: m.mine ? 'user' : 'assistant', content: m.body })),
    ];
    const text = await askLocalModel(messages);
    if (text) return { texts: [text], action: isHachi ? hachiTopic(last)?.action : undefined, source: 'local' };
  }
  if (isHachi) return { ...hachiReply(chatId, last), source: 'built-in' };
  return { texts: personaReply(chatId, username ?? 'ben_codes', last), source: 'built-in' };
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
