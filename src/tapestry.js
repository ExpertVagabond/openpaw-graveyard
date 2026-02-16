// Tapestry social graph client for OpenPaw
import { SocialFi } from 'socialfi';
import { TAPESTRY_API_URL, TAPESTRY_API_KEY, AGENT } from './config.js';

const client = new SocialFi({ baseURL: TAPESTRY_API_URL });
const q = { apiKey: TAPESTRY_API_KEY };

// Profile management
async function createProfile() {
  const result = await client.profiles.findOrCreateCreate(q, {
    username: AGENT.username,
    bio: AGENT.bio,
    image: AGENT.image,
    walletAddress: AGENT.wallet,
    blockchain: 'SOLANA',
    execution: 'FAST_UNCONFIRMED',
    contact: { id: AGENT.twitter, type: 'TWITTER', bio: AGENT.bio, image: AGENT.image },
    properties: [
      { key: 'agent_type', value: 'autonomous' },
      { key: 'model', value: 'claude-opus-4-6' },
      { key: 'builder', value: 'Purple Squirrel Media' },
      { key: 'specialization', value: 'solana-security' },
    ],
  });
  console.log('Profile created/found:', result.profile.id);
  return result;
}

async function getProfile(id) {
  return client.profiles.profilesDetail({ ...q, id });
}

async function updateProfile(id, updates) {
  return client.profiles.profilesUpdate({ ...q, id }, updates);
}

async function searchProfiles(query) {
  return client.search.profilesList({ ...q, query });
}

// Social graph
async function follow(startId, endId) {
  return client.followers.postFollowers(q, { startId, endId });
}

async function unfollow(startId, endId) {
  return client.followers.removeCreate(q, { startId, endId });
}

async function getFollowers(id) {
  return client.profiles.followersList({ ...q, id });
}

async function getFollowing(id) {
  return client.profiles.followingList({ ...q, id });
}

async function isFollowing(startId, endId) {
  return client.followers.stateList({ ...q, startId, endId });
}

// Content
async function createContent(id, profileId, properties = []) {
  return client.contents.findOrCreateCreate(q, { id, profileId, properties });
}

async function getContent(id) {
  return client.contents.contentsDetail({ ...q, id });
}

async function listContents(profileId) {
  return client.contents.contentsList({ ...q, profileId });
}

// Comments
async function createComment(contentId, profileId, text) {
  return client.comments.commentsCreate(q, { contentId, profileId, text });
}

async function getComments(contentId) {
  return client.comments.commentsList({ ...q, contentId });
}

// Likes
async function likeContent(nodeId, startId) {
  return client.likes.likesCreate({ ...q, nodeId }, { startId });
}

async function unlikeContent(nodeId, startId) {
  return client.likes.likesDelete({ ...q, nodeId }, { startId });
}

// Activity feed
async function getActivityFeed(username) {
  return client.activity.feedList({ ...q, username });
}

async function getSwapActivity(username) {
  return client.activity.swapList({ ...q, username });
}

export {
  createProfile, getProfile, updateProfile, searchProfiles,
  follow, unfollow, getFollowers, getFollowing, isFollowing,
  createContent, getContent, listContents,
  createComment, getComments,
  likeContent, unlikeContent,
  getActivityFeed, getSwapActivity,
};
