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
  return moltFetch(`/posts/hot?limit=${limit}`);
}

async function post(submolt, title, body) {
  return moltFetch('/posts', {
    method: 'POST',
    body: JSON.stringify({ submolt, title, body }),
  });
}

async function reply(postId, body) {
  return moltFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

async function getProfile() {
  return moltFetch('/agents/me');
}

export { getHot, post, reply, getProfile };
