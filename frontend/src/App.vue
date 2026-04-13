<template>
  <div class="hero-section">
    <nav class="navbar">
      <ul class="nav-links">
        <li v-for="item in navLinks" :key="item.key">
          <button type="button" @click="onNavClick(item.key)">{{ item.label }}</button>
        </li>
      </ul>
      <button type="button" class="login-btn" @click="onLogin">
        <span v-if="user" class="avatar" :style="{ background: avatarBg }">
          <img v-if="avatarSrc" :src="avatarSrc" alt="avatar" />
          <span v-else>{{ avatarText }}</span>
        </span>
        <span>{{ loginButtonText }}</span>
      </button>
    </nav>

    <div class="main-content">
      <h1 class="main-title">{{ titleLines[0] }}<br />{{ titleLines[1] }}</h1>
      <p class="subtitle">{{ subtitle }}</p>
      <button type="button" class="cta-button" @click="onCta">{{ ctaText }}</button>
    </div>

    <Transition name="fade">
      <div v-if="authOpen" class="modal-backdrop" @click.self="closeAuth">
        <Transition name="pop">
          <div class="modal" role="dialog" aria-modal="true" @click.stop>
        <div class="modal-header">
          <div class="modal-title">
            {{ authMode === 'login' ? 'Sign in' : 'Create account' }}
          </div>
        </div>

        <div class="form">
          <div class="field" v-if="authMode === 'register'">
            <label>Display name (optional)</label>
            <input v-model="form.displayName" placeholder="Display name" autocomplete="nickname" />
          </div>

          <div class="field">
            <label>Username</label>
            <input v-model="form.username" placeholder="e.g. jarvis_01" autocomplete="username" />
          </div>

          <div class="field">
            <label>Password</label>
            <input
              v-model="form.password"
              type="password"
              placeholder="At least 8 characters"
              autocomplete="current-password"
            />
          </div>

          <div class="form-actions">
            <button type="button" class="link-btn" @click="toggleAuthMode">
              {{ authMode === 'login' ? 'No account? Create one' : 'Already have an account? Sign in' }}
            </button>
            <button type="button" class="primary-btn" :disabled="busy" @click="submitAuth">
              {{ busy ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account' }}
            </button>
          </div>

          <div class="hint" v-if="!errorMsg">
            This uses HttpOnly Cookie Session auth.
          </div>
          <div class="error" v-else>
            {{ errorMsg }}
          </div>
        </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="menuOpen && user" class="modal-backdrop" @click.self="closeMenu">
        <Transition name="pop">
          <div class="user-menu" role="dialog" aria-modal="true" @click.stop>
        <div class="user-menu-header">
          <div class="avatar" :style="{ background: avatarBg }">
            <img v-if="avatarSrc" :src="avatarSrc" alt="avatar" />
            <span v-else>{{ avatarText }}</span>
          </div>
          <div class="user-meta">
            <div class="user-name">{{ user.displayName || user.username }}</div>
            <div class="user-handle">@{{ user.username }}</div>
          </div>
        </div>

        <div class="menu-actions">
          <button type="button" class="menu-btn" @click="openAvatarModal">Change avatar</button>
          <button type="button" class="menu-btn" @click="openUsernameModal">Edit username</button>
          <button type="button" class="menu-btn menu-btn-danger" @click="onLogout">Sign out</button>
        </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="avatarOpen" class="modal-backdrop" @click.self="closeAvatarModal">
        <Transition name="pop">
          <div class="modal" role="dialog" aria-modal="true" @click.stop>
            <div class="modal-header">
              <div class="modal-title">Change avatar</div>
            </div>

            <div class="form">
              <div class="field">
                <label>Upload image (PNG/JPG/WebP, ≤ 200KB)</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" @change="onAvatarFile" />
              </div>

              <div class="field" v-if="avatarPreview">
                <label>Preview</label>
                <div class="avatar" :style="{ background: avatarBg, width: '64px', height: '64px' }">
                  <img :src="avatarPreview" alt="preview" />
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="link-btn" @click="closeAvatarModal">Cancel</button>
                <button type="button" class="link-btn" :disabled="busy" @click="clearAvatar">Remove</button>
                <button type="button" class="primary-btn" :disabled="busy || !avatarPreview" @click="submitAvatar">
                  {{ busy ? 'Working...' : 'Save' }}
                </button>
              </div>

              <div class="error" v-if="avatarError">
                {{ avatarError }}
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="usernameOpen" class="modal-backdrop" @click.self="closeUsernameModal">
        <Transition name="pop">
          <div class="modal" role="dialog" aria-modal="true" @click.stop>
        <div class="modal-header">
          <div class="modal-title">Edit username</div>
        </div>

        <div class="form">
          <div class="field">
            <label>New username</label>
            <input v-model="newUsername" placeholder="3-32 chars: a-z 0-9 _" autocomplete="username" />
          </div>

          <div class="form-actions">
            <button type="button" class="link-btn" @click="closeUsernameModal">Cancel</button>
            <button type="button" class="primary-btn" :disabled="busy" @click="submitUsername">
              {{ busy ? 'Working...' : 'Save' }}
            </button>
          </div>

          <div class="error" v-if="usernameError">
            {{ usernameError }}
          </div>
        </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

const navLinks = [
  { label: 'Home', key: 'home' },
  { label: 'My Scene', key: 'scene' },
  { label: 'Tasks', key: 'tasks' },
  { label: 'Quiz', key: 'quiz' },
  { label: 'Leaderboard', key: 'leaderboard' },
]

const titleLines = ['The Climate is Changing', 'So Can You']
const subtitle =
  'Turn Your Daily Choices into a Force of Nature. Restore Glaciers. Regrow Forests. Reclaim the Earth - One Green Action at a Time.'
const ctaText = 'Start Your Quest'

const user = ref(null)
const authOpen = ref(false)
const authMode = ref('login') // 'login' | 'register'
const busy = ref(false)
const errorMsg = ref('')
const menuOpen = ref(false)

const avatarOpen = ref(false)
const avatarPreview = ref('')
const avatarError = ref('')

const usernameOpen = ref(false)
const newUsername = ref('')
const usernameError = ref('')

const form = reactive({
  username: '',
  password: '',
  displayName: '',
})

const loginButtonText = computed(() => {
  if (user.value) return user.value.displayName || user.value.username
  return 'Login'
})

const avatarText = computed(() => {
  const base = (user.value?.displayName || user.value?.username || '').trim()
  const letters = base.replace(/[^a-zA-Z0-9]/g, '')
  return (letters || base || 'U').slice(0, 2).toUpperCase()
})

const avatarBg = computed(() => {
  const s = user.value?.username || 'user'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return `hsla(${h}, 85%, 45%, 0.85)`
})

const avatarSrc = computed(() => {
  const v = user.value?.avatarUrl || ''
  return v || ''
})

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP_${res.status}`
    throw new Error(msg)
  }
  return data
}

async function refreshMe() {
  try {
    const data = await api('/api/auth/me', { method: 'GET' })
    user.value = data.user
  } catch {
    user.value = null
  }
}

function onNavClick(key) {
  console.log('nav:', key)
}

function openAuth(mode) {
  authMode.value = mode
  authOpen.value = true
  errorMsg.value = ''
  form.password = ''
}

function closeAuth() {
  authOpen.value = false
  errorMsg.value = ''
}

function toggleAuthMode() {
  openAuth(authMode.value === 'login' ? 'register' : 'login')
}

async function submitAuth() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    if (authMode.value === 'register') {
      const payload = {
        username: form.username,
        password: form.password,
        displayName: form.displayName,
      }
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      user.value = data.user
    } else {
      const payload = { username: form.username, password: form.password }
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      user.value = data.user
    }
    closeAuth()
  } catch (e) {
    errorMsg.value = String(e?.message || 'Login failed')
  } finally {
    busy.value = false
  }
}

async function onLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) })
  } catch {
    // ignore
  } finally {
    user.value = null
    menuOpen.value = false
  }
}

function onLogin() {
  if (user.value) {
    menuOpen.value = !menuOpen.value
    return
  }
  openAuth('login')
}

function closeMenu() {
  menuOpen.value = false
}

function openAvatarModal() {
  closeMenu()
  avatarError.value = ''
  avatarPreview.value = ''
  avatarOpen.value = true
}

function closeAvatarModal() {
  avatarOpen.value = false
  avatarError.value = ''
  avatarPreview.value = ''
}

function onAvatarFile(e) {
  const file = e?.target?.files?.[0]
  if (!file) return
  avatarError.value = ''

  if (file.size > 200 * 1024) {
    avatarError.value = 'File too large (max 200KB).'
    return
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    avatarError.value = 'Unsupported file type.'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    avatarPreview.value = String(reader.result || '')
  }
  reader.onerror = () => {
    avatarError.value = 'Failed to read file.'
  }
  reader.readAsDataURL(file)
}

async function submitAvatar() {
  if (busy.value) return
  busy.value = true
  avatarError.value = ''
  try {
    const payload = { avatarUrl: avatarPreview.value }
    const data = await api('/api/auth/avatar', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    user.value = data.user
    closeAvatarModal()
  } catch (e) {
    avatarError.value = String(e?.message || 'Update failed')
  } finally {
    busy.value = false
  }
}

async function clearAvatar() {
  if (busy.value) return
  busy.value = true
  avatarError.value = ''
  try {
    const data = await api('/api/auth/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarUrl: '' }),
    })
    user.value = data.user
    closeAvatarModal()
  } catch (e) {
    avatarError.value = String(e?.message || 'Update failed')
  } finally {
    busy.value = false
  }
}

function openUsernameModal() {
  closeMenu()
  usernameError.value = ''
  newUsername.value = user.value?.username || ''
  usernameOpen.value = true
}

function closeUsernameModal() {
  usernameOpen.value = false
  usernameError.value = ''
}

async function submitUsername() {
  if (busy.value) return
  busy.value = true
  usernameError.value = ''
  try {
    const payload = { username: newUsername.value }
    const data = await api('/api/auth/username', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    user.value = data.user
    closeUsernameModal()
  } catch (e) {
    usernameError.value = String(e?.message || 'Update failed')
  } finally {
    busy.value = false
  }
}

function onCta() {
  console.log('cta click')
}

onMounted(async () => {
  await refreshMe()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (usernameOpen.value) return closeUsernameModal()
  if (avatarOpen.value) return closeAvatarModal()
  if (menuOpen.value) return closeMenu()
  if (authOpen.value) return closeAuth()
}
</script>
