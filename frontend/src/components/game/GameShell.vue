<template>
  <div class="game-shell">
    <!-- Top bar -->
    <header class="shell-topbar">
      <div class="shell-page-title">{{ title }}</div>
      <div class="shell-topbar-right">
        <button class="topbar-home-btn" type="button" @click="$emit('back-home')">← Home</button>
        <span class="topbar-badge">🪙 {{ coins.toLocaleString() }}</span>
        <span class="topbar-badge">🔥 {{ streak }}d</span>
        <button class="topbar-home-btn subtle" type="button" @click="$emit('reset')">Reset</button>
      </div>
    </header>

    <!-- Sidebar tabs -->
    <aside class="game-sidebar">
      <div class="sidebar-logo">
        <span class="sidebar-logo-icon">🌍</span>
        <span class="sidebar-logo-text">ClimateQuest</span>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="sidebar-item"
          :class="{ active: activeTab === item.key }"
          type="button"
          @click="onTab(item.key)"
        >
          <span class="sidebar-icon">{{ item.icon }}</span>
          <span class="sidebar-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-user" v-if="user">
        <div class="sidebar-avatar" :style="{ background: avatarBg }">{{ avatarText }}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">{{ user.displayName || user.username }}</div>
          <div class="sidebar-user-sub">@{{ user.username }}</div>
        </div>
        <button class="sidebar-logout" type="button" @click="$emit('logout')" title="Sign out">⏻</button>
      </div>
    </aside>

    <main class="game-main">
      <CanvasScene
        :themeType="themeType"
        :progress="sceneProgress"
        :trees="trees"
        :flowers="flowers"
        :placements="placements"
      />
    </main>

    <PanelDrawer :open="drawerOpen" :title="drawerTitle" @close="drawerOpen = false">
      <slot :activeTab="activeTab" />
    </PanelDrawer>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CanvasScene from './CanvasScene.vue'
import PanelDrawer from './PanelDrawer.vue'

const props = defineProps({
  user: { type: Object, default: null },
  themeType: { type: String, default: 'forest' },
  sceneProgress: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  trees: { type: Number, default: 0 },
  flowers: { type: Number, default: 0 },
  placements: { type: Object, default: null },
  defaultTab: { type: String, default: 'tasks' },
})

const emit = defineEmits(['tab', 'logout', 'back-home', 'reset'])

const activeTab = ref(props.defaultTab)
const drawerOpen = ref(true)

watch(
  () => props.defaultTab,
  (v) => {
    if (v) activeTab.value = v
  }
)

function onTab(key) {
  activeTab.value = key
  drawerOpen.value = true
  emit('tab', key)
}

const navItems = [
  { key: 'tasks', icon: '✅', label: 'Tasks' },
  { key: 'shop', icon: '🛒', label: 'Shop' },
  { key: 'quiz', icon: '📚', label: 'Quiz' },
  { key: 'progress', icon: '📈', label: 'Progress' },
  { key: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
]

const title = computed(() => 'Rainforest Quest')

const drawerTitle = computed(() => {
  const m = {
    tasks: 'Daily Tasks',
    shop: 'Shop',
    quiz: 'Daily Quiz',
    progress: 'Progress',
    leaderboard: 'Leaderboard',
  }
  return m[activeTab.value] || 'Panel'
})

const avatarText = computed(() => {
  const base = (props.user?.displayName || props.user?.username || '').trim()
  const letters = base.replace(/[^a-zA-Z0-9]/g, '')
  return (letters || base || 'U').slice(0, 2).toUpperCase()
})

const avatarBg = computed(() => {
  const s = props.user?.username || 'user'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return `hsla(${h},70%,42%,0.9)`
})
</script>

<style scoped>
.game-shell {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.82) 100%), url('/img1.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.game-sidebar {
  width: 220px;
  min-height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 30;
  padding-top: 80px; /* below topbar */
  padding-bottom: 16px;
}

.sidebar-logo {
  position: fixed;
  top: 0;
  left: 0;
  width: 220px;
  height: 80px;
  padding: 20px 18px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 31;
}
.sidebar-logo-icon {
  font-size: 1.4rem;
}
.sidebar-logo-text {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.3px;
}

.sidebar-nav {
  padding: 14px 10px;
  flex: 1;
}
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 13px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;
  text-align: left;
}
.sidebar-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}
.sidebar-item.active {
  color: var(--primary-accent);
  background: rgba(0, 242, 255, 0.08);
  border-color: rgba(0, 242, 255, 0.2);
}
.subtle {
  opacity: 0.85;
}
.sidebar-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.sidebar-user {
  margin: 0 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.sidebar-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.sidebar-user-name {
  font-size: 0.82rem;
  font-weight: 800;
  color: #fff;
}
.sidebar-user-sub {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.45);
}
.sidebar-logout {
  margin-left: auto;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 1rem;
  transition: color 0.2s;
}
.sidebar-logout:hover {
  color: #ff6b6b;
}

.game-main {
  margin-left: 220px;
  padding: 98px 18px 18px; /* below topbar */
  min-height: 100vh;
}

@media (max-width: 640px) {
  .game-sidebar,
  .sidebar-logo {
    width: 56px;
  }
  .game-main {
    margin-left: 56px;
  }
  .sidebar-logo-text,
  .sidebar-label,
  .sidebar-user-info,
  .sidebar-logout {
    display: none;
  }
  .sidebar-logo {
    justify-content: center;
    padding: 18px 8px;
  }
  .sidebar-item {
    justify-content: center;
    padding: 12px;
  }
  .sidebar-user {
    justify-content: center;
  }
}
</style>

