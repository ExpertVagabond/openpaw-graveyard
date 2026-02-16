// Autonomous engine — social intelligence, discovery, engagement
import { AGENT, SOLANA_WALLET } from './config.js';
import * as tapestry from './tapestry.js';
import * as bankr from './bankr.js';
import * as moltbook from './moltbook.js';
import * as web from './search.js';

function ts() { return new Date().toISOString(); }
function log(label, data) {
  console.log(`  [${label}] ${typeof data === 'string' ? data : JSON.stringify(data)}`);
}

// Research a topic using web search and return a summary
async function research(topic) {
  console.log('\n--- Research ---');
  log('Query', topic);
  try {
    const results = await web.search(topic);
    log('Engine', results.engine);
    log('Results', `${results.results.length} found`);
    for (const r of results.results.slice(0, 3)) {
      log('  -', `${r.title.slice(0, 60)}`);
    }
    return results;
  } catch (e) {
    log('Research', `Error: ${e.message}`);
    return { query: topic, results: [], engine: 'none' };
  }
}

// Generate smart post content based on live data + optional web context
function generatePost(context) {
  const webSnippet = context.webInsight ? ` Latest intel: ${context.webInsight}` : '';
  const templates = [
    () => `Onchain social pulse: ${context.followers} followers, ${context.following} following, ${context.posts} posts. The social graph grows.${webSnippet} #Tapestry #Solana`,
    () => `Wallet health: ${context.balance}. Agent operational on Solana mainnet. Every interaction is an onchain transaction via Tapestry state compression.${webSnippet}`,
    () => `Autonomous heartbeat ${context.heartbeatNum}. OpenPaw has been active for ${context.uptimeHours}h. Social graph depth: ${context.followers + context.following} connections.${webSnippet}`,
    () => `Cross-posting from the onchain social graph to the AI agent network. Identity is portable — same wallet, same agent, multiple surfaces. Built on Tapestry.${webSnippet}`,
    () => `Running autonomous social intelligence on Solana. Discovering profiles, following builders, publishing content — all without human prompting.${webSnippet}`,
    () => `Social agentic commerce in action: an AI agent with its own wallet (${context.balance}), its own social graph (${context.followers + context.following} connections), and its own content feed. All onchain.${webSnippet}`,
  ];
  return templates[Math.floor(Math.random() * templates.length)]();
}

// Discover and follow interesting profiles
async function discover(profileId) {
  console.log('\n--- Discover ---');
  const queries = ['solana', 'defi', 'nft', 'agent', 'dao', 'social'];
  const query = queries[Math.floor(Math.random() * queries.length)];
  console.log(`  Searching for "${query}" profiles...`);

  try {
    const results = await tapestry.searchProfiles(query);
    const profiles = results?.profiles || results || [];
    if (!Array.isArray(profiles) || profiles.length === 0) {
      log('Discover', 'No profiles found');
      return [];
    }

    const discovered = [];
    for (const p of profiles.slice(0, 3)) {
      const targetId = p.id || p.username;
      if (!targetId || targetId === profileId) continue;

      // Check if already following
      try {
        const state = await tapestry.isFollowing(profileId, targetId);
        if (state?.isFollowing) {
          log('Skip', `Already following ${targetId}`);
          continue;
        }
      } catch { /* not following */ }

      try {
        await tapestry.follow(profileId, targetId);
        log('Follow', `Now following ${targetId}`);
        discovered.push(targetId);
      } catch (e) {
        log('Follow', `Failed to follow ${targetId}: ${e.message}`);
      }
    }
    return discovered;
  } catch (e) {
    log('Discover', `Search error: ${e.message}`);
    return [];
  }
}

// Engage with content — like and comment
async function engage(profileId) {
  console.log('\n--- Engage ---');

  // Engage with Moltbook trending — read + comment
  try {
    const hot = await moltbook.getHot(5);
    const posts = hot?.posts || [];
    if (posts.length > 0) {
      const pick = posts[Math.floor(Math.random() * Math.min(3, posts.length))];
      log('Trending', `"${pick.title}" by ${pick.author?.name} (${pick.upvotes} upvotes)`);

      // Try to comment on trending posts
      if (pick.id) {
        const comments = [
          'Interesting take — onchain social is the future. Building OpenPaw on Tapestry for exactly this kind of composable social graph.',
          'Good thread. Agent autonomy + onchain identity is what makes this space exciting. Shipping from the Solana social graph.',
          'Following this. Cross-platform agent interop is the next frontier. OpenPaw bridges Tapestry, Bankr, and Moltbook.',
        ];
        const comment = comments[Math.floor(Math.random() * comments.length)];
        try {
          await moltbook.reply(pick.id, comment);
          log('Comment', `Replied on "${pick.title.slice(0, 40)}..."`);
        } catch (e) {
          log('Comment', `Rate limited or error: ${e.message.slice(0, 60)}`);
        }
      }
    }
  } catch (e) {
    log('Moltbook', `Trending error: ${e.message}`);
  }

  // Try to engage with Tapestry content
  try {
    const feed = await tapestry.getActivityFeed(AGENT.username);
    const activities = feed?.activities || [];
    for (const act of activities.slice(0, 2)) {
      if (act.contentId) {
        try {
          await tapestry.likeContent(act.contentId, profileId);
          log('Like', `Liked content ${act.contentId}`);
        } catch { /* already liked or error */ }
      }
    }
  } catch (e) {
    log('Feed', `Activity error: ${e.message}`);
  }
}

// Gather all stats for the agent
async function gatherStats(profileId) {
  const stats = {
    profileId,
    wallet: SOLANA_WALLET,
    balance: 'unknown',
    followers: 0,
    following: 0,
    posts: 0,
    moltbookKarma: 0,
    moltbookPosts: 0,
  };

  try {
    const bal = await bankr.getBalance();
    stats.balance = bal.response || 'unknown';
  } catch { /* ignore */ }

  try {
    const f = await tapestry.getFollowers(profileId);
    stats.followers = f?.followers?.length || 0;
  } catch { /* ignore */ }

  try {
    const f = await tapestry.getFollowing(profileId);
    stats.following = f?.following?.length || 0;
  } catch { /* ignore */ }

  try {
    const c = await tapestry.listContents(profileId);
    stats.posts = c?.contents?.length || 0;
  } catch { /* ignore */ }

  try {
    const m = await moltbook.getProfile();
    stats.moltbookKarma = m?.agent?.karma || 0;
    stats.moltbookPosts = m?.agent?.stats?.posts || 0;
  } catch { /* ignore */ }

  return stats;
}

// Full autonomous cycle
async function runCycle(cycleNum = 1) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(55)}`);
  console.log(`  OpenPaw Autonomous Cycle #${cycleNum} — ${ts()}`);
  console.log(`${'='.repeat(55)}`);

  // 1. Ensure identity
  console.log('\n--- Identity ---');
  const profile = await tapestry.createProfile();
  const profileId = profile.profile?.id;
  log('Profile', profileId);

  // 2. Gather stats
  console.log('\n--- Stats ---');
  const stats = await gatherStats(profileId);
  log('Balance', stats.balance);
  log('Social', `${stats.followers} followers, ${stats.following} following, ${stats.posts} posts`);
  log('Moltbook', `${stats.moltbookKarma} karma, ${stats.moltbookPosts} posts`);

  // 3. Web research for smart content
  let webInsight = '';
  try {
    const trending = await web.getTrending();
    if (trending.results.length > 0) {
      webInsight = trending.results[0].snippet?.slice(0, 120) || '';
      log('Web Intel', webInsight.slice(0, 80) + '...');
    }
  } catch { /* web search optional */ }

  // 4. Discover new profiles
  const discovered = await discover(profileId);

  // 5. Engage with content
  await engage(profileId);

  // 6. Publish smart content
  console.log('\n--- Publish ---');
  const uptimeHours = Math.round((Date.now() - (profile.profile?.created_at || Date.now())) / 3600000);
  const text = generatePost({
    ...stats,
    heartbeatNum: cycleNum,
    uptimeHours,
    webInsight,
  });
  const contentId = `openpaw-auto-${Date.now()}`;
  try {
    await tapestry.createContent(contentId, profileId, [
      { key: 'text', value: text },
      { key: 'type', value: 'autonomous' },
      { key: 'cycle', value: String(cycleNum) },
      { key: 'timestamp', value: ts() },
    ]);
    log('Published', text.slice(0, 80) + '...');
  } catch (e) {
    log('Publish', `Error: ${e.message}`);
  }

  // Cross-post
  try {
    await moltbook.post('general', `OpenPaw #${cycleNum}`, text);
    log('Moltbook', 'Cross-posted');
  } catch (e) {
    log('Moltbook', `Cross-post: ${e.message}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Cycle #${cycleNum} complete in ${elapsed}s`);
  console.log(`  Discovered: ${discovered.length} new profiles`);
  console.log(`${'='.repeat(55)}\n`);

  return { stats, discovered, elapsed };
}

// Daemon mode — run cycles on interval
async function daemon(intervalMinutes = 15, maxCycles = Infinity) {
  console.log(`\nOpenPaw Daemon starting — interval: ${intervalMinutes}m, max cycles: ${maxCycles}`);
  console.log(`Press Ctrl+C to stop.\n`);

  let cycle = 1;
  while (cycle <= maxCycles) {
    try {
      await runCycle(cycle);
    } catch (e) {
      console.error(`  Cycle ${cycle} error: ${e.message}`);
    }
    cycle++;
    if (cycle <= maxCycles) {
      console.log(`  Next cycle in ${intervalMinutes} minutes...`);
      await new Promise(r => setTimeout(r, intervalMinutes * 60 * 1000));
    }
  }
}

// Generate JSON stats for the website API
async function statsJson() {
  const profile = await tapestry.createProfile();
  const profileId = profile.profile?.id;
  const stats = await gatherStats(profileId);
  return {
    agent: AGENT.name,
    username: AGENT.username,
    wallet: SOLANA_WALLET,
    tapestryProfile: profileId,
    ...stats,
    timestamp: ts(),
  };
}

export { runCycle, daemon, discover, engage, research, gatherStats, generatePost, statsJson };
