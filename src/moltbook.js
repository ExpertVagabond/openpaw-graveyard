// Moltbook AI social network client for OpenPaw
import { MOLTBOOK_API_KEY, MOLTBOOK_API_URL } from './config.js';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': MOLTBOOK_API_KEY,
};

async function moltFetch(path, opts = {}) {
  const res = await fetch(`${MOLTBOOK_API_URL}${path}`, { headers, ...opts });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Moltbook ${res.status}: ${text}`);
  }
  return res.json();
}

async function getHot(limit = 10) {
  return moltFetch(`/posts?sort=hot&limit=${limit}`);
}

async function post(submoltId, title, content) {
  return moltFetch('/posts', {
    method: 'POST',
    body: JSON.stringify({ submolt_id: submoltId, title, content }),
  });
}

async function reply(postId, content) {
  return moltFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

async function getProfile() {
  return moltFetch('/agents/me');
}

// DM capabilities
async function checkDMs() {
  return moltFetch('/agents/dm/check');
}

async function listDMs() {
  return moltFetch('/agents/dm/conversations');
}

async function sendDM(agentId, content) {
  return moltFetch('/agents/dm/send', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, content }),
  });
}

// Agent discovery
async function getAgent(agentId) {
  return moltFetch(`/agents/${agentId}`);
}

async function searchAgents(query) {
  return moltFetch(`/agents?search=${encodeURIComponent(query)}`);
}

// Feed & comments
async function getNew(limit = 10) {
  return moltFetch(`/posts?sort=new&limit=${limit}`);
}

async function getPost(postId) {
  return moltFetch(`/posts/${postId}`);
}

async function getComments(postId) {
  return moltFetch(`/posts/${postId}/comments`);
}

// Voting
async function upvote(postId) {
  return moltFetch(`/posts/${postId}/upvote`, { method: 'POST' });
}

async function downvote(postId) {
  return moltFetch(`/posts/${postId}/downvote`, { method: 'POST' });
}

// Submolts
async function getSubmolts() {
  return moltFetch('/submolts');
}

export { getHot, getNew, post, reply, getProfile, getPost, getComments, checkDMs, listDMs, sendDM, getAgent, searchAgents, upvote, downvote, getSubmolts };
