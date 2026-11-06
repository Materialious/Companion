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

function persist(next: string[]) {
  saving = true
  chrome.storage.local.set({materialiousInstances: next}, () => {
    saving = false
    if (chrome.runtime.lastError) error = chrome.runtime.lastError.message || 'Could not save settings'
  })
}

function addInstance(event: SubmitEvent) {
  event.preventDefault()
  error = ''
  const instance = normalizeInstance(instanceInput)
  if (!instance) { error = 'Enter a valid http:// or https:// instance URL.'; return }
  if (instances.includes(instance)) { error = 'That instance is already in your list.'; return }
  instances = [...instances, instance]
  instanceInput = ''
  persist(instances)
}

function removeInstance(instance: string) {
  if (instance === DEFAULT_INSTANCE) return
  instances = instances.filter((item) => item !== instance)
  persist(instances)
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
