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

export { getHot, post, reply, getProfile };
