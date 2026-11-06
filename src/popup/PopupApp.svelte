<script lang="ts">
import {onMount} from 'svelte'
import logo from '../images/materialious-toolbar.svg'
import darkLogo from '../images/materialious-toolbar-dark.svg'

const DEFAULT_INSTANCE = 'https://app.materialio.us'
let instances = $state<string[]>([DEFAULT_INSTANCE])
let instanceInput = $state('')
let error = $state('')
let saving = $state(false)

onMount(() => {
  chrome.storage.local.get({materialiousInstances: [DEFAULT_INSTANCE]}, (data) => {
    instances = normalizeList(data.materialiousInstances)
  })
})

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [DEFAULT_INSTANCE]
  const normalized = value.map(normalizeInstance).filter((item): item is string => !!item)
  return [...new Set([DEFAULT_INSTANCE, ...normalized])]
}

function normalizeInstance(value: string): string | undefined {
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
    return url.origin
  } catch { return }
}

function persist(next: string[]): Promise<void> {
  saving = true
  // Svelte state arrays are proxies; pass Chrome storage a plain structured
  // clone so serialization cannot silently fail when settings are saved.
  const savedInstances = Array.from(next)
  return new Promise((resolve, reject) => chrome.storage.local.set({materialiousInstances: savedInstances}, () => {
    saving = false
    if (chrome.runtime.lastError) {
      error = chrome.runtime.lastError.message || 'Could not save settings'
      reject(new Error(error))
    } else resolve()
  }))
}

function originPermissionPattern(instance: string): string {
  const url = new URL(instance)
  // Match patterns do not include ports; the content script checks the exact
  // configured origin before exposing the bridge.
  return `${url.protocol}//${url.hostname}/*`
}

function requestOriginPermission(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request({origins: [originPermissionPattern(origin)]}, resolve)
  })
}

async function addInstance(event: SubmitEvent) {
  event.preventDefault()
  error = ''
  const instance = normalizeInstance(instanceInput)
  if (!instance) { error = 'Enter a valid http:// or https:// instance URL.'; return }
  if (instances.includes(instance)) { error = 'That instance is already in your list.'; return }
  instances = [...instances, instance]
  instanceInput = ''
  const savePromise = persist(instances)
  // Start the permission request in the original click handler so Chrome still
  // recognizes the user gesture. Both operations begin before yielding.
  let permissionPromise: Promise<boolean>
  try {
    permissionPromise = requestOriginPermission(instance)
  } catch {
    await savePromise
    instances = instances.filter((item) => item !== instance)
    await persist(instances)
    error = 'Could not request permission for this instance.'
    return
  }
  try {
    // Chrome may close the popup while showing the prompt, so start saving
    // before requesting permission and wait for the write before continuing.
    await savePromise
  } catch {
    instances = instances.filter((item) => item !== instance)
    return
  }
  saving = true
  let granted = false
  try {
    granted = await permissionPromise
  } catch {
    error = 'Could not request permission for this instance.'
  }
  saving = false
  if (!granted) {
    if (!error) error = 'Permission was not granted, so this instance was not added.'
    instances = instances.filter((item) => item !== instance)
    await persist(instances)
    return
  }
  chrome.runtime.sendMessage(
    {type: 'registerMaterialiousInstance', origin: instance},
    (result) => {
      if (chrome.runtime.lastError || !result?.ok) {
        error = chrome.runtime.lastError?.message || result?.error || 'Could not activate this instance. Reload the extension and try again.'
      }
    }
  )
}

function removeInstance(instance: string) {
  if (instance === DEFAULT_INSTANCE) return
  instances = instances.filter((item) => item !== instance)
  persist(instances)
  const permissionPattern = originPermissionPattern(instance)
  const stillUsed = instances.some((saved) => originPermissionPattern(saved) === permissionPattern)
  chrome.runtime.sendMessage({
    type: 'unregisterMaterialiousInstance',
    origin: instance,
    revokePermission: !stillUsed
  })
}
</script>

<main class="popup">
  <header class="topbar">
    <picture><source srcset={darkLogo} media="(prefers-color-scheme: dark)" /><img src={logo} alt="" /></picture>
    <div><h1>Materialious Companion</h1><p>Browser request bridge</p></div>
  </header>

  <section class="card">
    <div class="section-heading"><div><h2>Materialious instances</h2><p>Companion activates on these sites.</p></div></div>
    <ul class="instance-list">
      {#each instances as instance (instance)}
        <li>
          <span class="status-dot" aria-hidden="true"></span>
          <span class="instance-url">{instance}</span>
          {#if instance === DEFAULT_INSTANCE}
            <span class="default-tag">default</span>
          {:else}
            <button class="icon-button" aria-label="Remove {instance}" onclick={() => removeInstance(instance)}>×</button>
          {/if}
        </li>
      {/each}
    </ul>
    <form onsubmit={addInstance}>
      <label for="instance">Add an instance</label>
      <div class="input-row">
        <input id="instance" bind:value={instanceInput} placeholder="https://materialious.example.com" autocomplete="url" />
        <button class="add-button" type="submit" disabled={saving}>Add</button>
      </div>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
  </section>
  <footer>Requests are made from your browser. Instance settings stay on this device.</footer>
</main>
