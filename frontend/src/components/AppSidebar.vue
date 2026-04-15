<template>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <span class="sidebar-logo-icon">🌍</span>
      <span class="sidebar-logo-text">ClimateQuest</span>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="sidebar-item"
        :class="{ active: currentView === item.key }"
        @click="$emit('navigate', item.key)"
      >
        <span class="sidebar-icon">{{ item.icon }}</span>
        <span class="sidebar-label">{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar-user">
      <div class="sidebar-avatar" :style="{ background: avatarBg }">{{ avatarText }}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">{{ displayName }}</div>
        <div class="sidebar-user-sub">@{{ user?.username }}</div>
      </div>
      <button class="sidebar-logout" @click="$emit('logout')" title="Sign out">⏻</button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  user:        { type: Object, default: null },
  currentView: { type: String, default: 'dashboard' },
})
defineEmits(['navigate', 'logout'])

const navItems = [
  { key: 'dashboard',   icon: '🏠', label: 'Dashboard'   },
  { key: 'tasks',       icon: '✅', label: 'Daily Tasks'  },
  { key: 'scene',       icon: '🌍', label: 'My Scene'     },
  { key: 'quiz',        icon: '📚', label: 'Quiz'         },
  { key: 'leaderboard', icon: '🏆', label: 'Leaderboard'  },
]

const displayName = computed(() => props.user?.displayName || props.user?.username || '–')
const avatarText  = computed(() => {
  const base = (props.user?.displayName || props.user?.username || '').replace(/[^a-zA-Z0-9]/g,'')
  return (base || 'U').slice(0, 2).toUpperCase()
})
const avatarBg = computed(() => {
  const s = props.user?.username || 'user'
  let h = 0; for (let i = 0; i < s.length; i++) h = (h*31 + s.charCodeAt(i)) % 360
  return `hsla(${h},70%,42%,0.9)`
})
</script>

<style scoped>
.sidebar {
  width: 220px;
  min-height: 100vh;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(16px);
  border-right: 1px solid rgba(255,255,255,0.1);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0;
  z-index: 30;
  padding-bottom: 16px;
}
.sidebar-logo {
  padding: 20px 18px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  gap: 10px;
}
.sidebar-logo-icon { font-size: 1.4rem; }
.sidebar-logo-text { font-size: 1rem; font-weight: 800; color: #fff; letter-spacing: -0.3px; }

.sidebar-nav { padding: 14px 10px; flex: 1; }
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 13px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255,255,255,0.55);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 3px;
  text-align: left;
}
.sidebar-item:hover { color: #fff; background: rgba(255,255,255,0.06); }
.sidebar-item.active {
  color: var(--primary-accent);
  background: rgba(0,242,255,0.08);
  border-color: rgba(0,242,255,0.2);
}
.sidebar-icon  { font-size: 1rem; width: 20px; text-align: center; }

.sidebar-user {
  margin: 0 10px;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.sidebar-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 0.78rem; font-weight: 800; color: #fff; flex-shrink: 0;
}
.sidebar-user-name { font-size: 0.82rem; font-weight: 700; color: #fff; }
.sidebar-user-sub  { font-size: 0.68rem; color: rgba(255,255,255,0.45); }
.sidebar-logout {
  margin-left: auto;
  background: none; border: none;
  color: rgba(255,255,255,0.3);
  cursor: pointer; font-size: 1rem;
  transition: color 0.2s;
}
.sidebar-logout:hover { color: #ff6b6b; }

@media (max-width: 640px) {
  .sidebar { width: 56px; }
  .sidebar-logo-text, .sidebar-label, .sidebar-user-info, .sidebar-logout { display: none; }
  .sidebar-logo { justify-content: center; padding: 18px 8px; }
  .sidebar-item { justify-content: center; padding: 12px; }
  .sidebar-user { justify-content: center; }
}
</style>
