/**
 * Which way a composer-anchored floating menu opens. The composer itself
 * moves — centered mid-viewport on an empty chat, pinned to the bottom once
 * there's a conversation — so every menu hanging off it needs to flip
 * consistently with that, or it ends up opening into whichever side happens
 * to have no room.
 */
export type MenuDirection = 'up' | 'down';
